import * as THREE from "three";
import { SHIP_Z, berthX } from "@/data/layout";
import type { NavStatus } from "./nmea";
import { KN, M_PER_UNIT, bearingOf, lerpAngle, wrap360 } from "./geo";

/** Ground-truth state of a ship (what its GNSS and gyro actually measure). */
export interface Truth {
  x: number;
  z: number;
  heading: number;
  status: NavStatus;
}

/** Where a ship is in its port call. Drives labels, tug assistance and the movement list. */
export type VoyagePhase = "inbound" | "anchored" | "berthing" | "alongside" | "unberthing" | "outbound" | "sailed";

/** One leg of a port call. `until` is the absolute sim time the leg ends (Infinity for the last). */
export type LegSpec =
  | { kind: "anchor"; until: number; swing: number }
  | { kind: "moored"; until: number; berth: number; heading: number }
  | { kind: "path"; until: number; pts: Array<[number, number]>; endKn: number; phase: "inbound" | "outbound"; startKn?: number; turnSec?: number; drift?: number }
  | { kind: "push"; until: number; to: [number, number]; heading: number; phase: "berthing" | "unberthing" }
  | { kind: "cruise"; sailedAfter: number };

export interface BuiltLeg {
  kind: LegSpec["kind"];
  phase: VoyagePhase;
  status: NavStatus;
  t0: number;
  t1: number;
  /** Cruise legs: seconds after which the ship counts as sailed (pilot dropped, past the fairway buoy). */
  sailedAfter?: number;
  eval: (t: number, out: Truth) => void;
}

export interface Voyage {
  legs: BuiltLeg[];
  truth: (t: number, out: Truth) => Truth;
  legAt: (t: number) => BuiltLeg;
  phaseAt: (t: number) => VoyagePhase;
  /** Times the officer of the watch changes nav status (the transponder sends an immediate type 3 report). */
  statusChanges: number[];
  /** Tug-assistance windows [from, to] around every berthing/unberthing. */
  tugWindows: Array<[number, number]>;
}

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const smooth = (u: number): number => u * u * (3 - 2 * u);
const hermite = (u: number, p0: number, p1: number, m0: number, m1: number): number => {
  const u2 = u * u;
  const u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * m1;
};
const knToUnits = (kn: number): number => (kn * KN) / M_PER_UNIT;

export interface Pose {
  x: number;
  z: number;
  heading: number;
}

/**
 * Chains port-call legs into one continuous ground-truth track: each leg starts exactly where (and as
 * fast as) the previous one ended, so position, heading and speed never jump. Nav status follows the
 * leg (anchor → 1 "At anchor", moored → 5 "Moored", everything else → 0 "Under way using engine").
 */
export function buildVoyage(start: Pose, t0: number, specs: LegSpec[]): Voyage {
  const legs: BuiltLeg[] = [];
  let pose: Pose = { ...start };
  let vel = { x: 0, z: 0 };
  let tStart = t0;
  const a: Truth = { x: 0, z: 0, heading: 0, status: 0 };
  const b: Truth = { x: 0, z: 0, heading: 0, status: 0 };

  specs.forEach((spec, idx) => {
    const p0 = { ...pose };
    const v0 = { ...vel };
    const speed0 = Math.hypot(v0.x, v0.z);
    const t1 = spec.kind === "cruise" ? Infinity : spec.until;
    const ts = tStart;
    let leg: BuiltLeg;

    switch (spec.kind) {
      case "anchor": {
        const swing = spec.swing;
        leg = {
          kind: "anchor",
          phase: "anchored",
          status: 1,
          t0: ts,
          t1,
          eval: (t, out) => {
            const dt = t - ts;
            const ramp = smooth(clamp(dt / 240, 0, 1));
            out.x = p0.x + 2.6 * Math.sin(dt / 170) * ramp;
            out.z = p0.z + 1.6 * Math.sin(dt / 230) * ramp;
            out.heading = lerpAngle(p0.heading, wrap360(swing + 6 * Math.sin(dt / 410)), smooth(clamp(dt / 200, 0, 1)));
            out.status = 1;
          },
        };
        break;
      }
      case "moored": {
        const x = berthX(spec.berth);
        const heading = spec.heading;
        leg = {
          kind: "moored",
          phase: "alongside",
          status: 5,
          t0: ts,
          t1,
          eval: (_t, out) => {
            out.x = x;
            out.z = SHIP_Z;
            out.heading = heading;
            out.status = 5;
          },
        };
        break;
      }
      case "path": {
        const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(p0.x, 0, p0.z), ...spec.pts.map(([x, z]) => new THREE.Vector3(x, 0, z))], false, "centripetal");
        curve.arcLengthDivisions = 1200;
        const L = curve.getLength();
        const dur = t1 - ts;
        const vs = idx === 0 ? knToUnits(spec.startKn ?? 0) : speed0;
        const ve = knToUnits(spec.endKn);
        // Speed profile v(u) = vs→ve (smoothstep) plus a mid-leg bump sized so the leg covers exactly L.
        const bump = 1.5 * (L / dur - (vs + ve) / 2);
        const dist = (u: number): number => dur * (vs * u + (ve - vs) * (u * u * u - (u * u * u * u) / 2) + bump * (2 * u * u - (4 / 3) * u * u * u));
        const pt = new THREE.Vector3();
        const tan = new THREE.Vector3();
        curve.getTangentAt(0, tan);
        const tan0 = tan.clone();
        const turnSec = spec.turnSec ?? 60;
        const drift = spec.drift ?? 1.4;
        leg = {
          kind: "path",
          phase: spec.phase,
          status: 0,
          t0: ts,
          t1,
          eval: (t, out) => {
            const tau = t - ts;
            out.status = 0;
            if (tau < 0) {
              out.x = p0.x + tan0.x * vs * tau;
              out.z = p0.z + tan0.z * vs * tau;
              out.heading = vs > 0 ? bearingOf(tan0.x, tan0.z) : p0.heading;
              return;
            }
            const u = clamp(tau / dur, 0, 1);
            const frac = clamp(dist(u) / L, 0, 1);
            curve.getPointAt(frac, pt);
            curve.getTangentAt(Math.min(frac, 0.9999), tan);
            out.x = pt.x;
            out.z = pt.z;
            const track = bearingOf(tan.x, tan.z);
            const base = lerpAngle(p0.heading, track, smooth(clamp(tau / turnSec, 0, 1)));
            // Small crab angle from the river current, zero at both ends of the leg.
            out.heading = wrap360(base + drift * Math.sin(t / 53) * Math.min(1, u * 5) * Math.min(1, (1 - u) * 6));
          },
        };
        break;
      }
      case "push": {
        const dur = t1 - ts;
        const [tx, tz] = spec.to;
        const heading = spec.heading;
        leg = {
          kind: "push",
          phase: spec.phase,
          status: 0,
          t0: ts,
          t1,
          eval: (t, out) => {
            const u = clamp((t - ts) / dur, 0, 1);
            out.x = hermite(u, p0.x, tx, v0.x * dur, 0);
            out.z = hermite(u, p0.z, tz, v0.z * dur, 0);
            out.heading = lerpAngle(p0.heading, heading, smooth(Math.min(1, u * 1.6)));
            out.status = 0;
          },
        };
        break;
      }
      case "cruise": {
        const bearing = speed0 > 1e-3 ? bearingOf(v0.x, v0.z) : p0.heading;
        const sx = Math.sin((bearing * Math.PI) / 180) * speed0;
        const sz = -Math.cos((bearing * Math.PI) / 180) * speed0;
        leg = {
          kind: "cruise",
          phase: "outbound",
          sailedAfter: spec.sailedAfter,
          status: 0,
          t0: ts,
          t1,
          eval: (t, out) => {
            const dt = Math.max(0, t - ts);
            out.x = p0.x + sx * dt;
            out.z = p0.z + sz * dt;
            out.heading = bearing;
            out.status = 0;
          },
        };
        break;
      }
    }

    legs.push(leg);
    if (Number.isFinite(t1)) {
      leg.eval(t1, a);
      leg.eval(t1 - 0.25, b);
      pose = { x: a.x, z: a.z, heading: a.heading };
      vel = { x: (a.x - b.x) / 0.25, z: (a.z - b.z) / 0.25 };
      if (spec.kind === "push" || spec.kind === "moored" || spec.kind === "anchor") vel = { x: 0, z: 0 };
      tStart = t1;
    }
  });

  const legAt = (t: number): BuiltLeg => {
    for (const l of legs) if (t < l.t1) return l;
    return legs[legs.length - 1];
  };
  const phaseAt = (t: number): VoyagePhase => {
    const l = legAt(t);
    return l.sailedAfter !== undefined && t - l.t0 > l.sailedAfter ? "sailed" : l.phase;
  };
  const statusChanges: number[] = [];
  for (let i = 1; i < legs.length; i++) if (legs[i].status !== legs[i - 1].status) statusChanges.push(legs[i].t0);
  const tugWindows: Array<[number, number]> = legs.filter((l) => l.kind === "push").map((l) => [l.t0 - 150, l.t1 + 60]);

  return {
    legs,
    legAt,
    phaseAt,
    statusChanges,
    tugWindows,
    truth: (t, out) => {
      legAt(t).eval(t, out);
      return out;
    },
  };
}
