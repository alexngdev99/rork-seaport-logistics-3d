import { VESSELS } from "@/data/port";
import type { Vessel } from "@/data/types";
import { craneHoldReason, env } from "@/state/environment";
import { ARRIVAL_SECONDS, SIM_START_SEC } from "./constants";
import { BLUE_MARLIN, MERLION_STAR, ORIENT_LOTUS, T_BM_ANCHORED, T_HEAVE, T_MK_CARGO_DONE, T_MK_PILOT, T_MK_SLIP } from "./ais/portCalls";
import { WIND_STOP_T, sim } from "./simStore";

/*
 * Today's arrivals (all fast alongside, i.e. ETB) and departures (lines let go, i.e. ETD) at the terminal.
 * Every status, estimate and actual is derived from sim time, the AIS port calls, cargo progress and the
 * current weather, so the board stays exact while replaying.
 */

export type MoveKind = "arrival" | "departure";
export type MoveTone = "signal" | "moss" | "amber" | "brick" | "harbor" | "slate";

interface MoveSpec {
  id: string;
  kind: MoveKind;
  vesselId?: string;
  name: string;
  short: string;
  line: string;
  /** Origin for arrivals, destination for departures. */
  port: string;
  berth: number;
  /** Planned time, seconds of day (≥ 86 400 means tomorrow). */
  planned: number;
}

export interface Movement extends MoveSpec {
  /** Best current estimate, seconds of day. */
  est: number;
  /** When it actually happened, once it has. */
  actual: number | null;
  /** Minutes behind (+) or ahead (−) of plan. */
  delayMin: number;
  delayReason: string | null;
  status: string;
  tone: MoveTone;
  /** 0 … 1 for approaches and cargo work, else null. */
  progress: number | null;
  moving: boolean;
  done: boolean;
}

const DAY = 86400;
const H = 3600;

/** "09:50" or "08:00 (+1)" → seconds of day. */
const clockOf = (s: string): number => {
  const [h, m] = s.slice(0, 5).split(":").map(Number);
  return h * H + m * 60 + (s.includes("+1") ? DAY : 0);
};

/** Original plan where today's live times have already slipped. */
const PLANNED_OVERRIDE: Record<string, string> = {
  [`${ORIENT_LOTUS}:arrival`]: "09:10",
  [`${ORIENT_LOTUS}:departure`]: "23:00",
};

/** Known slips from earlier this morning. `from` is the sim time they became known. */
const SCRIPTED_DELAY: Record<string, { min: number; reason: string; from: number }> = {
  [`${ORIENT_LOTUS}:departure`]: { min: 40, reason: "Late arrival from Hong Kong", from: -Infinity },
  "seastar-07:departure": { min: 25, reason: "STS-04 squall stop", from: WIND_STOP_T },
};

const OTHER_CARRIERS: MoveSpec[] = [
  { id: "wan-hai-316:departure", kind: "departure", name: "WAN HAI 316", short: "WAN HAI 316", line: "Wan Hai Lines", port: "Kaohsiung", berth: 3, planned: 4.5 * H },
  { id: "sitc-hakata:departure", kind: "departure", name: "SITC HAKATA", short: "SITC HAKATA", line: "SITC", port: "Ho Chi Minh", berth: 6, planned: 6.5 * H },
  { id: "kota-layang:departure", kind: "departure", name: "KOTA LAYANG", short: "KOTA LAYANG", line: "PIL", port: "Port Klang", berth: 4, planned: 7.2 * H },
  { id: "ever-glory:arrival", kind: "arrival", name: "EVER GLORY", short: "EVER GLORY", line: "Evergreen", port: "Colombo", berth: 7, planned: 18 * H },
  { id: "ever-glory:departure", kind: "departure", name: "EVER GLORY", short: "EVER GLORY", line: "Evergreen", port: "Chittagong", berth: 7, planned: DAY + 6 * H },
];

const SPECS: MoveSpec[] = [
  ...VESSELS.flatMap((v): MoveSpec[] =>
    (["arrival", "departure"] as const).map((kind) => {
      const id = `${v.id}:${kind}`;
      return {
        id,
        kind,
        vesselId: v.id,
        name: v.name,
        short: v.short,
        line: v.line,
        port: kind === "arrival" ? v.from : v.to,
        berth: v.berth,
        planned: clockOf(PLANNED_OVERRIDE[id] ?? (kind === "arrival" ? v.etb : v.etd)),
      };
    }),
  ),
  ...OTHER_CARRIERS,
];

const vesselOf = (id?: string): Vessel | undefined => (id ? VESSELS.find((v) => v.id === id) : undefined);
const kn = (sog: number): string => `${sog.toFixed(1)} kn`;

/** Planned slips: scripted ones plus weather knock-on effects within the next 6 h. */
function delaysFor(spec: MoveSpec, working: boolean, now: number, t: number): { min: number; reason: string | null } {
  let min = 0;
  const reasons: string[] = [];
  const s = SCRIPTED_DELAY[spec.id];
  if (s && t >= s.from) {
    min += s.min;
    reasons.push(s.reason);
  }
  if (spec.planned - now < 6 * H) {
    const w = env.weather();
    if (spec.kind === "departure" && working) {
      if (craneHoldReason(w)) {
        min += 45;
        reasons.push("Crane weather hold");
      } else if (w.kind === "rain") {
        min += 20;
        reasons.push("Rain slows cargo work");
      }
    }
    if (spec.kind === "arrival" && w.kind === "storm") {
      min += 30;
      reasons.push("Pilot boarding suspended");
    }
    if (w.visibilityKm < 1) {
      min += 15;
      reasons.push("Restricted visibility");
    }
  }
  return { min, reason: reasons.length ? reasons.join(" · ") : null };
}

function make(spec: MoveSpec, p: Partial<Movement> & Pick<Movement, "est" | "status" | "tone">): Movement {
  const actual = p.actual ?? null;
  const delayMin = Math.round(((actual ?? p.est) - spec.planned) / 60);
  return { ...spec, actual, delayMin, delayReason: p.delayReason ?? null, progress: p.progress ?? null, moving: p.moving ?? false, done: actual !== null, est: p.est, status: p.status, tone: p.tone };
}

function arrival(spec: MoveSpec, t: number): Movement {
  const now = SIM_START_SEC + t;
  const v = vesselOf(spec.vesselId);
  const call = spec.vesselId ? sim.calls[spec.vesselId] : undefined;

  if (spec.vesselId === ORIENT_LOTUS && call) {
    const berthed = SIM_START_SEC + ARRIVAL_SECONDS;
    if (sim.arrivalBerthed) return make(spec, { est: berthed, actual: berthed, status: "Alongside", tone: "moss" });
    const est = sim.arrival.etbSec ?? spec.planned;
    const reason = "Late from Hong Kong · waited at anchorage";
    if (call.lost) return make(spec, { est, status: "AIS signal lost", tone: "brick", delayReason: reason });
    if (call.phase === "berthing") return make(spec, { est, status: "Berthing · tugs fast", tone: "harbor", moving: true, progress: sim.arrivalProgress, delayReason: reason });
    if (call.phase === "anchored") return make(spec, { est, status: t >= T_HEAVE - 480 ? "At anchor · pilot on board" : "At anchor", tone: "amber", delayReason: reason });
    return make(spec, {
      est,
      status: t >= T_HEAVE ? `Under pilotage · ${kn(call.sog)}` : `Inbound · ${kn(call.sog)}`,
      tone: "harbor",
      moving: true,
      progress: t >= T_HEAVE ? sim.arrivalProgress : null,
      delayReason: reason,
    });
  }

  const pending = spec.vesselId === BLUE_MARLIN || !v || v.status === "scheduled";
  if (!pending) return make(spec, { est: spec.planned, actual: spec.planned, status: "Alongside", tone: "moss" });

  const d = delaysFor(spec, false, now, t);
  const est = spec.planned + d.min * 60;
  if (now >= est) return make(spec, { est, actual: est, status: "Alongside", tone: "moss", delayReason: d.reason });
  if (spec.vesselId === BLUE_MARLIN && call) {
    if (t < T_BM_ANCHORED) return make(spec, { est, status: `Inbound · ${kn(call.sog)}`, tone: "harbor", moving: true, delayReason: d.reason });
    return make(spec, { est, status: "At anchor · awaiting berth", tone: "amber", delayReason: d.reason });
  }
  return make(spec, { est, status: est - now < 2 * H ? "Approaching" : "Expected", tone: est - now < 2 * H ? "harbor" : "slate", delayReason: d.reason });
}

function departure(spec: MoveSpec, t: number): Movement {
  const now = SIM_START_SEC + t;
  const v = vesselOf(spec.vesselId);
  const call = spec.vesselId ? sim.calls[spec.vesselId] : undefined;

  if (spec.vesselId === MERLION_STAR && v) {
    const slip = SIM_START_SEC + T_MK_SLIP;
    if (t >= T_MK_SLIP) {
      if (call?.phase === "unberthing") return make(spec, { est: slip, actual: slip, status: "Unberthing · tugs fast", tone: "harbor", moving: true });
      if (call?.phase === "outbound") return make(spec, { est: slip, actual: slip, status: `Outbound · ${kn(call.sog)}`, tone: "harbor", moving: true });
      return make(spec, { est: slip, actual: slip, status: "Sailed", tone: "slate" });
    }
    if (t < T_MK_CARGO_DONE) {
      const live = sim.vessels[v.id];
      return make(spec, { est: slip, status: `Loading · ${Math.round((live.loaded / v.loadTotal) * 100)}%`, tone: "moss", progress: live.loaded / v.loadTotal });
    }
    return make(spec, { est: slip, status: t >= T_MK_PILOT ? "Pilot on board" : "Cargo complete", tone: t >= T_MK_PILOT ? "harbor" : "moss", progress: 1 });
  }

  if (!v) {
    if (spec.planned <= now) return make(spec, { est: spec.planned, actual: spec.planned, status: "Sailed", tone: "slate" });
    return make(spec, { est: spec.planned, status: "After arrival", tone: "slate" });
  }

  const alongside = v.id === ORIENT_LOTUS ? sim.arrivalBerthed : v.id !== BLUE_MARLIN && v.status !== "scheduled";
  const d = delaysFor(spec, alongside, now, t);
  const est = spec.planned + d.min * 60;
  if (now >= est) return make(spec, { est, actual: est, status: "Sailed", tone: "slate", delayReason: d.reason });
  if (!alongside) return make(spec, { est, status: `After arrival · ETB ${v.etb}`, tone: "slate", delayReason: d.reason });

  const live = sim.vessels[v.id];
  const total = v.dischargeTotal + v.loadTotal;
  const progress = total ? (live.discharged + live.loaded) / total : 0;
  const discharging = live.discharged < v.dischargeTotal;
  return make(spec, {
    est,
    status: `${discharging ? "Discharging" : "Loading"} · ${Math.round(progress * 100)}%`,
    tone: discharging ? "signal" : "moss",
    progress,
    delayReason: d.reason,
  });
}

/** Every movement of the day at sim time t, in time order (actual time once done, else the estimate). */
export function portSchedule(t: number): Movement[] {
  return SPECS.map((s) => (s.kind === "arrival" ? arrival(s, t) : departure(s, t))).sort((a, b) => (a.actual ?? a.est) - (b.actual ?? b.est));
}

export interface ScheduleSummary {
  arrivalsLeft: number;
  departuresLeft: number;
  /** Share of today's completed movements within 15 min of plan. */
  onTimePct: number;
  delayed: number;
}

export function scheduleSummary(list: Movement[]): ScheduleSummary {
  const done = list.filter((m) => m.done && m.planned < DAY);
  const onTime = done.filter((m) => Math.abs(m.delayMin) <= 15).length;
  return {
    arrivalsLeft: list.filter((m) => m.kind === "arrival" && !m.done).length,
    departuresLeft: list.filter((m) => m.kind === "departure" && !m.done).length,
    onTimePct: done.length ? (onTime / done.length) * 100 : 100,
    delayed: list.filter((m) => !m.done && m.delayMin >= 10).length,
  };
}
