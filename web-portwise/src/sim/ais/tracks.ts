import { VESSELS } from "@/data/port";
import { SHIP_Z, berthX } from "@/data/layout";
import { MIN_T, SIM_START_SEC, UTC_OFFSET_SEC } from "../constants";
import { AIS_STATIC } from "./static";
import type { ShipStaticData } from "./static";
import { classAInterval, decodeAivdm, encodePositionReport, encodeRot, rotDegPerMin } from "./nmea";
import type { AisChannel, PositionReport } from "./nmea";
import { DEG, KN, M_PER_UNIT, angleDiff, bearingOf, geoToScene, sceneToGeo, wrap360 } from "./geo";
import { PORT_CALLS, TRANSITS } from "./portCalls";
import type { Truth } from "./voyage";

export { ORIENT_LOTUS, T_HEAVE, T_ALONGSIDE } from "./portCalls";
export type { Truth } from "./voyage";

export interface Kinematics extends Truth {
  /** knots */
  sog: number;
  /** degrees */
  cog: number;
  /** degrees per minute, positive = starboard */
  rot: number;
}

export type AisRole = "call" | "transit" | "anchored" | "moored";

export interface AisVesselDef {
  id: string;
  name: string;
  short: string;
  static: ShipStaticData;
  role: AisRole;
  /** Berth the ship is (or will be) moored at; moored reports snap to the berth like a real VTS display. */
  berth?: number;
  berthHeading: number;
  /** Ships that actually sail during the simulation get a track overlay. */
  moving: boolean;
  truth: (t: number, out: Truth) => Truth;
  /** Times when the officer of the watch changes nav status; the transponder sends an immediate type 3 report. */
  statusChanges: number[];
}

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const mod = (a: number, n: number): number => ((a % n) + n) % n;

const mooredTruth =
  (berth: number) =>
  (_t: number, out: Truth): Truth => {
    out.x = berthX(berth);
    out.z = SHIP_Z;
    out.heading = 90;
    out.status = 5;
    return out;
  };

const callDefs: AisVesselDef[] = PORT_CALLS.map((c) => {
  const v = VESSELS.find((x) => x.id === c.id);
  return {
    id: c.id,
    name: v?.name ?? c.id,
    short: v?.short ?? c.id,
    static: AIS_STATIC[c.id],
    role: "call",
    berth: c.berth,
    berthHeading: c.berthHeading,
    moving: true,
    truth: c.voyage.truth,
    statusChanges: c.voyage.statusChanges,
  };
});

export const AIS_DEFS: AisVesselDef[] = [
  ...callDefs,
  ...VESSELS.filter((v) => v.inScene && !PORT_CALLS.some((c) => c.id === v.id)).map<AisVesselDef>((v) => ({
    id: v.id,
    name: v.name,
    short: v.short,
    static: AIS_STATIC[v.id],
    role: "moored",
    berth: v.berth,
    berthHeading: 90,
    moving: false,
    truth: mooredTruth(v.berth),
    statusChanges: [],
  })),
  ...TRANSITS.map<AisVesselDef>((tr) => ({
    id: tr.id,
    name: tr.name,
    short: tr.name,
    static: AIS_STATIC[tr.id],
    role: tr.kind === "anchored" ? "anchored" : "transit",
    berthHeading: 270,
    moving: tr.kind === "transit",
    truth: tr.voyage.truth,
    statusChanges: [],
  })),
];

/* ------------------------------------------------------------------ */
/* Kinematics + dead reckoning                                         */
/* ------------------------------------------------------------------ */

const ka: Truth = { x: 0, z: 0, heading: 0, status: 0 };
const kb: Truth = { x: 0, z: 0, heading: 0, status: 0 };

/** Ground truth plus SOG/COG/ROT measured over a 1 s window (one-sided across track wraps). */
export function kinematics(def: AisVesselDef, t: number, out: Kinematics): Kinematics {
  def.truth(t, out);
  def.truth(t - 0.5, ka);
  def.truth(t + 0.5, kb);
  let dx = kb.x - ka.x;
  let dz = kb.z - ka.z;
  let dt = 1;
  if (dx * dx + dz * dz > 100) {
    dt = 0.5;
    dx = out.x - ka.x;
    dz = out.z - ka.z;
    if (dx * dx + dz * dz > 25) {
      dx = kb.x - out.x;
      dz = kb.z - out.z;
    }
  }
  const speed = Math.hypot(dx, dz) / dt;
  out.sog = (speed * M_PER_UNIT) / KN;
  out.cog = speed > 1e-4 ? bearingOf(dx, dz) : out.heading;
  out.rot = angleDiff(ka.heading, kb.heading) * 60;
  return out;
}

export interface DrPose {
  x: number;
  z: number;
  heading: number;
}

/** Dead reckoning is trusted for at most this long after a fix. */
export const MAX_DR_SEC = 30;

/**
 * Projects a decoded report forward to time t: constant SOG along a COG that turns at the reported
 * ROT (a circular arc), heading advanced by ROT. Ships slower than 0.5 kn hold their fix.
 */
export function deadReckon(r: AisReport, t: number, out: DrPose): DrPose {
  const dt = clamp(t - r.tFix, 0, MAX_DR_SEC);
  const m = r.msg;
  const rot = rotDegPerMin(m.RateOfTurn) ?? 0;
  const hdg0 = m.TrueHeading === 511 ? m.Cog : m.TrueHeading;
  out.heading = wrap360(hdg0 + (rot * dt) / 60);
  if (m.Sog < 0.5 || m.Sog >= 102.3 || m.Cog >= 360) {
    out.x = r.x;
    out.z = r.z;
    return out;
  }
  const v = (m.Sog * KN) / M_PER_UNIT;
  const b0 = m.Cog * DEG;
  const w = (rot / 60) * DEG;
  if (Math.abs(w) < 1e-5) {
    out.x = r.x + v * dt * Math.sin(b0);
    out.z = r.z - v * dt * Math.cos(b0);
  } else {
    out.x = r.x + (v / w) * (Math.cos(b0) - Math.cos(b0 + w * dt));
    out.z = r.z - (v / w) * (Math.sin(b0 + w * dt) - Math.sin(b0));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Transponder + receiver                                              */
/* ------------------------------------------------------------------ */

/** One Class A transmission as heard (or missed) by the terminal's VHF receiver. */
export interface AisReport {
  seq: number;
  vesselId: string;
  /** Sim time of the GNSS fix / slot. */
  tFix: number;
  /** Sim time the decoded sentence reached the terminal. */
  tRecv: number;
  channel: AisChannel;
  /** Raw NMEA 0183 sentence exactly as it came off the receiver. */
  sentence: string;
  /** Decoded from `sentence` — the tracker only ever sees these values. */
  msg: PositionReport;
  /** Decoded position projected into the scene. */
  x: number;
  z: number;
  received: boolean;
  /** Type 3 report sent immediately on a nav status change. */
  forced: boolean;
  /** Track restarted (first fix, long gap, or position jump): no blending from the previous report. */
  reset: boolean;
}

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seedOf = (mmsi: number, seq: number): number => Math.imul((mmsi % 1_000_003) + 7, 2654435761) ^ Math.imul(seq + 11, 40503);

/** GNSS fix noise (1σ, scene units ≈ 1.5 m with DGNSS). */
const POS_SIGMA = 0.5;

const drTmp: DrPose = { x: 0, z: 0, heading: 0 };

/** Deterministic, lazily-extended transmission log for one ship. Pure function of sim time, so replay is exact. */
export class AisTrack {
  readonly all: AisReport[] = [];
  readonly rx: AisReport[] = [];
  private nextT: number;
  private nextForced = false;
  private seq = 0;
  private readonly k: Kinematics = { x: 0, z: 0, heading: 0, status: 0, sog: 0, cog: 0, rot: 0 };

  constructor(readonly def: AisVesselDef) {
    this.nextT = MIN_T - 240 - rng(seedOf(def.static.mmsi, -1))() * 170;
  }

  ensure(tMax: number): void {
    let guard = 0;
    while (this.nextT <= tMax && guard++ < 5000) this.emit();
  }

  private emit(): void {
    const t = this.nextT;
    const { def, k } = this;
    const mmsi = def.static.mmsi;
    const r = rng(seedOf(mmsi, this.seq));
    const gauss = (): number => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
    kinematics(def, t, k);

    const geo = sceneToGeo(k.x + gauss() * POS_SIGMA, k.z + gauss() * POS_SIGMA);
    const sog = Math.max(0, k.sog + gauss() * 0.05);
    const cogSigma = clamp(2 / Math.max(k.sog, 0.07), 0.3, 30);
    const cog = (Math.round(wrap360(k.cog + gauss() * cogSigma) * 10) / 10) % 360;
    const utcSec = SIM_START_SEC + t - UTC_OFFSET_SEC;
    const forced = this.nextForced;
    const channel: AisChannel = this.seq % 2 === 0 ? "A" : "B";

    const sentence = encodePositionReport(
      {
        MessageID: forced ? 3 : 1,
        RepeatIndicator: 0,
        UserID: mmsi,
        NavigationalStatus: k.status,
        RateOfTurn: encodeRot(k.rot),
        Sog: Math.round(sog * 10) / 10,
        PositionAccuracy: true,
        Longitude: geo.lon,
        Latitude: geo.lat,
        Cog: cog,
        TrueHeading: Math.round(k.heading) % 360,
        Timestamp: Math.floor(mod(utcSec, 60)),
        SpecialManoeuvreIndicator: 0,
        Raim: false,
        CommunicationState: Math.floor(r() * 524288),
      },
      channel,
    );
    const msg = decodeAivdm(sentence);
    const lossP = k.status === 5 ? 0.03 : 0.08;
    const received = msg !== null && msg.Valid && (forced || r() >= lossP);
    const prev = this.rx[this.rx.length - 1];
    const tRecv = Math.max(t + 0.35 + r() * 1.1, prev ? prev.tRecv + 0.05 : -Infinity);

    if (msg) {
      const pos = geoToScene(msg.Latitude, msg.Longitude, { x: 0, z: 0 });
      let reset = !prev || t - prev.tFix > 600;
      if (!reset && prev) {
        deadReckon(prev, t, drTmp);
        reset = Math.hypot(drTmp.x - pos.x, drTmp.z - pos.z) > 40;
      }
      const rep: AisReport = { seq: this.seq, vesselId: def.id, tFix: t, tRecv, channel, sentence, msg, x: pos.x, z: pos.z, received, forced, reset };
      this.all.push(rep);
      if (received) this.rx.push(rep);
    }

    let next = t + classAInterval(k.status, k.sog, k.rot) * (1 + (r() - 0.5) * 0.04);
    const change = def.statusChanges.find((c) => c > t + 0.01 && c < next);
    this.nextForced = change !== undefined;
    if (change !== undefined) next = change;
    this.nextT = next;
    this.seq++;
  }
}
