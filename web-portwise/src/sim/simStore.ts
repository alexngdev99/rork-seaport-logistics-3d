import { useSyncExternalStore } from "react";
import type { Object3D } from "three";
import type { Alert, QuayCrane, Selection } from "@/data/types";
import { ALERTS, QUAY_CRANES, VESSELS } from "@/data/port";
import { ARRIVAL_SECONDS, MIN_T, SIM_START_SEC, fmtClock, fmtDuration } from "./constants";
import { ORIENT_LOTUS, PORT_CALLS, PORT_EVENTS, T_MK_CARGO_DONE, T_MK_SAILED, T_MK_SLIP } from "./ais/portCalls";
import type { VoyagePhase } from "./ais/voyage";
import { aisDef, aisFix, newFix } from "./ais/tracker";

export { ARRIVAL_SECONDS, MIN_T, SIM_START_SEC, fmtClock, fmtDuration };

/* ------------------------------------------------------------------ */
/* Clock                                                               */
/* ------------------------------------------------------------------ */

/** STS-04 stopped for a Sumatra squall at 09:32. */
export const WIND_STOP_T = -12 * 60;
export const CRANE_CYCLE = 13;
/** Seconds into a crane cycle at which the box is set down. */
export const CRANE_DROP_AT = 10.2;
const BOOM_SWING_SEC = 6;

const nowMs = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());
const realStart = nowMs();
const realT = (): number => (nowMs() - realStart) / 1000;

interface ClockState {
  live: boolean;
  rate: number;
  anchorT: number;
  anchorMs: number;
}

const clock: ClockState = { live: true, rate: 1, anchorT: 0, anchorMs: realStart };

let notifyQueued = false;
function queueNotify(): void {
  if (notifyQueued) return;
  notifyQueued = true;
  queueMicrotask(() => {
    notifyQueued = false;
    bump();
  });
}

function anchor(t: number, rate: number): void {
  clock.live = false;
  clock.anchorT = t;
  clock.anchorMs = nowMs();
  clock.rate = rate;
  queueNotify();
}

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const mod = (a: number, n: number): number => ((a % n) + n) % n;

/**
 * Current simulation time in seconds relative to 09:44:00. Every animation and live number
 * derives from this, so pausing, rewinding or scrubbing replays the port exactly.
 */
export function simT(): number {
  if (clock.live) return realT();
  const t = clock.anchorT + ((nowMs() - clock.anchorMs) / 1000) * clock.rate;
  const edge = realT();
  if (t >= edge) {
    clock.live = true;
    clock.rate = 1;
    queueNotify();
    return edge;
  }
  if (t <= MIN_T) {
    if (clock.rate !== 0 || clock.anchorT !== MIN_T) anchor(MIN_T, 0);
    return MIN_T;
  }
  return t;
}

/** The live edge: how far the real port has progressed. */
export const liveT = (): number => realT();

export const simNowSec = (): number => SIM_START_SEC + simT();
export const simNowHours = (): number => simNowSec() / 3600;
export const simElapsedMin = (): number => simT() / 60;

/** Playback controls for the time bar. */
export const timeControl = {
  play(): void {
    if (clock.live) return;
    anchor(simT(), 1);
  },
  pause(): void {
    anchor(simT(), 0);
  },
  toggle(): void {
    if (clock.live || clock.rate !== 0) timeControl.pause();
    else timeControl.play();
  },
  /** Negative rates rewind. Fast-forward is ignored while already live. */
  setRate(rate: number): void {
    if (clock.live && rate >= 1) return;
    anchor(simT(), rate);
  },
  seek(t: number): void {
    const edge = realT();
    if (t >= edge - 0.5) {
      timeControl.goLive();
      return;
    }
    anchor(clamp(t, MIN_T, edge), clock.live ? 1 : clock.rate);
  },
  step(dt: number): void {
    timeControl.seek(simT() + dt);
  },
  goLive(): void {
    clock.live = true;
    clock.rate = 1;
    queueNotify();
  },
};

export interface ClockSnapshot {
  t: number;
  liveT: number;
  live: boolean;
  rate: number;
}

export function clockSnapshot(): ClockSnapshot {
  const t = simT();
  return { t, liveT: clock.live ? t : realT(), live: clock.live, rate: clock.live ? 1 : clock.rate };
}

/* ------------------------------------------------------------------ */
/* Cranes                                                              */
/* ------------------------------------------------------------------ */

interface CraneWindow {
  from: number;
  until: number;
}

const CRANE_WINDOW_OVERRIDES: Record<string, CraneWindow> = {
  "STS-04": { from: -Infinity, until: WIND_STOP_T },
  "STS-01": { from: -Infinity, until: T_MK_CARGO_DONE },
  "STS-05": { from: ARRIVAL_SECONDS, until: Infinity },
};

const craneIndex = new Map<string, number>(QUAY_CRANES.map((c, i) => [c.id, i]));
export const craneOffset = (index: number): number => index * 3.7;

function windowOf(c: QuayCrane): CraneWindow | null {
  const o = CRANE_WINDOW_OVERRIDES[c.id];
  if (o) return o;
  if (c.mode === "discharge" || c.mode === "load") return { from: -Infinity, until: Infinity };
  return null;
}

const ease = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export interface CraneStatus {
  state: "active" | "paused" | "idle";
  reason?: string;
  loading: boolean;
  /** 0 = boom lowered over the ship, 1 = fully raised. */
  boom: number;
}

/** Idle reason that follows the port calls (STS-01 stands down once MERLION STAR is complete). */
function reasonAt(c: QuayCrane, t: number): string {
  if (c.id === "STS-01" && t >= T_MK_CARGO_DONE) return t < T_MK_SLIP ? "Cargo complete" : t < T_MK_SAILED ? "Vessel unberthing" : "Next: BLUE MARLIN 13:30";
  return c.reason ?? "Idle";
}

/** Crane state at sim time t (STS-04 worked until the wind stop, STS-05 starts after ORIENT LOTUS berths, STS-01 stops when MERLION STAR is complete). */
export function craneStatusAt(c: QuayCrane, t: number): CraneStatus {
  const loading = VESSELS.find((v) => v.id === c.vesselId)?.status === "loading";
  const w = windowOf(c);
  const reason = reasonAt(c, t);
  if (!w) return { state: c.mode === "paused" ? "paused" : "idle", reason, loading, boom: 1 };
  if (t < w.from) return { state: "idle", reason, loading, boom: 1 };
  if (t > w.until) return { state: c.mode === "paused" ? "paused" : "idle", reason, loading, boom: ease(clamp((t - w.until) / BOOM_SWING_SEC, 0, 1)) };
  return { state: "active", loading, boom: 1 - ease(clamp((t - w.from) / BOOM_SWING_SEC, 0, 1)) };
}

const latestCycle = (offset: number, x: number): number => Math.floor((x + offset - CRANE_DROP_AT) / CRANE_CYCLE);
const dropTime = (offset: number, k: number): number => k * CRANE_CYCLE + CRANE_DROP_AT - offset;
const evensIn = (m1: number, m2: number): number => Math.floor(m2 / 2) - Math.floor((m1 - 1) / 2);

/** Moves/TEU a crane added between t = 0 and t (negative when t is in the past). */
function deltaSinceZero(c: QuayCrane, idx: number, t: number): { moves: number; teu: number } {
  const w = windowOf(c);
  if (!w) return { moves: 0, teu: 0 };
  if (t >= 0) {
    const lo = Math.max(0, Number.isFinite(w.from) ? w.from + BOOM_SWING_SEC : w.from);
    const hi = Math.min(t, w.until);
    if (hi <= lo) return { moves: 0, teu: 0 };
    const off = craneOffset(idx);
    const k1 = latestCycle(off, lo) + 1;
    const k2 = latestCycle(off, hi);
    if (k2 < k1) return { moves: 0, teu: 0 };
    const n = k2 - k1 + 1;
    return { moves: n, teu: n + evensIn(k1 + idx, k2 + idx) };
  }
  const secs = Math.max(0, Math.min(0, w.until) - Math.max(t, w.from));
  const m = ((c.movesPerHour || 28) * secs) / 3600;
  return { moves: -m, teu: -m * 1.5 };
}

const PREFIXES = ["SSLU", "MSKU", "CMAU", "EGHU", "HLXU", "ONEU"];
const BLOCK_TARGETS = ["B5", "B1", "C1", "B2", "C2", "B8", "C7", "B9", "C9"];
const containerCode = (idx: number, k: number): string => `${PREFIXES[mod(k + idx, PREFIXES.length)]} ${100000 + mod(k * 7919 + idx * 104729, 899999)}`;

/* ------------------------------------------------------------------ */
/* Derived state                                                       */
/* ------------------------------------------------------------------ */

export interface ActivityItem {
  id: string;
  tau: number;
  time: string;
  craneId: string;
  vesselId: string;
  text: string;
  kind: "discharge" | "load" | "event";
}

interface VesselLive {
  discharged: number;
  loaded: number;
}

/** Live state of a ship making a port movement, as the VTS sees it (status/SOG from AIS, phase from the movement log). */
export interface CallLive {
  phase: VoyagePhase;
  status: number;
  sog: number;
  lost: boolean;
  /** Distance to the end of the current movement (berth, anchorage or port limit). */
  distanceNm: number | null;
  etaSec: number | null;
  etaLabel: string;
}

export interface ArrivalAis {
  /** AIS navigational status code. */
  status: number;
  sog: number;
  /** Seconds-of-day estimate of time berthed, from remaining distance and reported SOG. */
  etbSec: number | null;
  distanceNm: number;
  lost: boolean;
}

interface SimState {
  vessels: Record<string, VesselLive>;
  craneMoves: Record<string, number>;
  craneActive: Record<string, boolean>;
  teuToday: number;
  activity: ActivityItem[];
  arrivalBerthed: boolean;
  arrivalProgress: number;
  /** ORIENT LOTUS as last reported over AIS. */
  arrival: ArrivalAis;
  /** Every ship with a port movement this morning, keyed by vessel id. */
  calls: Record<string, CallLive>;
  truckStatus: Record<string, string>;
}

const BASE_TEU = 11846;

export const sim: SimState = {
  vessels: Object.fromEntries(VESSELS.map((v) => [v.id, { discharged: v.discharged, loaded: v.loaded }])),
  craneMoves: Object.fromEntries(QUAY_CRANES.map((c) => [c.id, c.movesToday])),
  craneActive: {},
  teuToday: BASE_TEU,
  activity: [],
  arrivalBerthed: false,
  arrivalProgress: 0,
  arrival: { status: 0, sog: 0, etbSec: null, distanceNm: 0, lost: false },
  calls: {},
  truckStatus: {},
};

function buildActivity(t: number): ActivityItem[] {
  const items: ActivityItem[] = [];
  QUAY_CRANES.forEach((c, idx) => {
    const w = windowOf(c);
    if (!w || !c.vesselId) return;
    const off = craneOffset(idx);
    const loading = VESSELS.find((v) => v.id === c.vesselId)?.status === "loading";
    let k = latestCycle(off, Math.min(t, w.until));
    for (let n = 0; n < 8; n++, k--) {
      const tau = dropTime(off, k);
      if (tau < w.from + BOOM_SWING_SEC || tau < MIN_T) break;
      const code = containerCode(idx, k);
      items.push({
        id: `${c.id}:${k}`,
        tau,
        time: fmtClock(SIM_START_SEC + tau, true),
        craneId: c.id,
        vesselId: c.vesselId,
        kind: loading ? "load" : "discharge",
        text: loading ? `${c.id} loaded ${code} onboard` : `${c.id} discharged ${code} → block ${BLOCK_TARGETS[mod(k, BLOCK_TARGETS.length)]}`,
      });
    }
  });
  PORT_EVENTS.forEach((ev) => {
    if (ev.t <= t && ev.t >= MIN_T - 600) items.push({ id: `ev:${ev.id}`, tau: ev.t, time: fmtClock(SIM_START_SEC + ev.t, true), craneId: "", vesselId: ev.vesselId, kind: "event", text: ev.text });
  });
  if (t >= WIND_STOP_T) {
    items.push({ id: "ev:wind", tau: WIND_STOP_T, time: fmtClock(SIM_START_SEC + WIND_STOP_T, true), craneId: "STS-04", vesselId: "seastar-07", kind: "event", text: "Sumatra squall, gusts 14 m/s – STS-04 stopped, boom raised" });
  }
  return items.sort((a, b) => b.tau - a.tau).slice(0, 40);
}

function recompute(t: number): void {
  const acc: Record<string, VesselLive> = Object.fromEntries(VESSELS.map((v) => [v.id, { discharged: v.discharged, loaded: v.loaded }]));
  let teu = BASE_TEU;
  QUAY_CRANES.forEach((c, idx) => {
    const st = craneStatusAt(c, t);
    sim.craneActive[c.id] = st.state === "active";
    const d = deltaSinceZero(c, idx, t);
    sim.craneMoves[c.id] = Math.max(0, Math.round(c.movesToday + d.moves));
    teu += d.teu;
    const a = c.vesselId ? acc[c.vesselId] : undefined;
    if (!a) return;
    if (st.loading) a.loaded += d.teu;
    else a.discharged += d.teu;
  });
  VESSELS.forEach((v) => {
    const a = acc[v.id];
    sim.vessels[v.id] = {
      discharged: Math.round(clamp(a.discharged, 0, v.dischargeTotal)),
      loaded: Math.round(clamp(a.loaded, 0, v.loadTotal)),
    };
  });
  sim.teuToday = Math.round(teu);
  updateArrival(t);
  updateCalls(t);
  sim.activity = buildActivity(t);
}

const arrivalFix = newFix();
const NM_UNITS = 1852 / 3;
const arrivalDef = aisDef(ORIENT_LOTUS);
const berthPose = arrivalDef?.truth(ARRIVAL_SECONDS + 1, { x: 0, z: 0, heading: 0, status: 5 }) ?? { x: 0, z: 0 };
const anchorPose = arrivalDef?.truth(-400, { x: 0, z: 0, heading: 0, status: 1 }) ?? { x: 0, z: 0 };
const APPROACH_UNITS = Math.hypot(anchorPose.x - berthPose.x, anchorPose.z - berthPose.z) * 1.04;

/** Arrival progress and ETB derived from the latest AIS reports, not from a scripted timeline. */
function updateArrival(t: number): void {
  const f = aisFix(ORIENT_LOTUS, t, arrivalFix);
  const dist = Math.hypot(f.x - berthPose.x, f.z - berthPose.z) * (f.status === 5 ? 0 : 1.04);
  const moored = f.status === 5;
  sim.arrivalBerthed = moored && t >= ARRIVAL_SECONDS;
  sim.arrivalProgress = moored ? 1 : clamp(1 - dist / APPROACH_UNITS, 0, 1);
  const speedUnits = (Math.max(f.sog, 0.1) * 0.514444) / 3;
  const avgFactor = f.sog > 3 ? 1.35 : 1;
  sim.arrival = {
    status: f.status,
    sog: f.sog,
    distanceNm: dist / NM_UNITS,
    etbSec: moored ? null : f.status === 1 ? SIM_START_SEC + ARRIVAL_SECONDS : SIM_START_SEC + t + (dist / speedUnits) * avgFactor + 45,
    lost: f.lost,
  };
}

const callFix = newFix();
const clockOf = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 3600 + m * 60;
};

/** Movement state for every port call: AIS status/SOG, distance to go and a speed-based ETA. */
function updateCalls(t: number): void {
  PORT_CALLS.forEach((c) => {
    const f = aisFix(c.id, t, callFix);
    const phase = c.phaseAt(t);
    const target = c.target(t);
    const dist = target ? Math.hypot(f.x - target[0], f.z - target[1]) * 1.04 : null;
    const speedUnits = (Math.max(f.sog, 1) * 0.514444) / 3;
    const fromSpeed = dist !== null ? SIM_START_SEC + t + dist / speedUnits + (c.kind === "arrival" ? 45 : 0) : null;
    let etaSec: number | null = null;
    let etaLabel = "";
    if (c.id === ORIENT_LOTUS) {
      etaLabel = "ETB";
      etaSec = sim.arrival.etbSec;
    } else if (c.kind === "arrival") {
      const v = VESSELS.find((x) => x.id === c.id);
      if (phase === "inbound") {
        etaLabel = "ETA anchorage";
        etaSec = fromSpeed;
      } else if (phase === "anchored" && v) {
        etaLabel = "ETB";
        etaSec = clockOf(v.etb);
      }
    } else if (phase === "alongside") {
      etaLabel = "ETD";
      etaSec = SIM_START_SEC + T_MK_SLIP;
    } else if (phase === "unberthing" || phase === "outbound") {
      etaLabel = "Port limit";
      etaSec = fromSpeed;
    }
    sim.calls[c.id] = { phase, status: f.status, sog: f.sog, lost: f.lost, distanceNm: dist !== null ? dist / NM_UNITS : null, etaSec, etaLabel };
  });
}

/* ------------------------------------------------------------------ */
/* Alerts + timeline events                                            */
/* ------------------------------------------------------------------ */

const clockToT = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 3600 + m * 60 - SIM_START_SEC;
};

/** Alerts that had already fired at the current sim time. */
export function visibleAlerts(): Alert[] {
  const t = simT();
  return ALERTS.filter((a) => clockToT(a.time) <= t);
}

export interface TimelineEvent {
  id: string;
  t: number;
  label: string;
  tone: "brick" | "amber" | "moss" | "harbor";
  target: Selection;
}

const SEVERITY_TONE: Record<Alert["severity"], TimelineEvent["tone"]> = { danger: "brick", warning: "amber", info: "harbor", success: "moss" };

export const TIMELINE_EVENTS: TimelineEvent[] = [
  ...ALERTS.filter((a) => clockToT(a.time) >= MIN_T).map((a) => ({ id: a.id, t: clockToT(a.time), label: a.title, tone: SEVERITY_TONE[a.severity], target: a.target })),
  ...PORT_EVENTS.filter((ev) => ev.marker && ev.t >= MIN_T).map((ev) => ({ id: `ev-${ev.id}`, t: ev.t, label: ev.marker ?? "", tone: ev.tone, target: { kind: "vessel" as const, id: ev.vesselId } })),
].sort((a, b) => a.t - b.t);

/* ------------------------------------------------------------------ */
/* Store plumbing                                                      */
/* ------------------------------------------------------------------ */

let version = 0;
const listeners = new Set<() => void>();

export function bump(): void {
  recompute(simT());
  version++;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Re-renders the caller whenever simulation data or playback state changes. */
export function useSimTick(): number {
  return useSyncExternalStore(subscribe, () => version, () => version);
}

/** Playback snapshot for time controls (re-renders on every sim tick). */
export function useClock(): ClockSnapshot {
  useSimTick();
  return clockSnapshot();
}

recompute(0);

if (typeof window !== "undefined") {
  let lastSec = 0;
  window.setInterval(() => {
    const t = simT();
    const fast = !clock.live && Math.abs(clock.rate) > 1;
    const key = fast ? Math.floor(t * 4) : Math.floor(t);
    const edgeSec = Math.floor(realT());
    const k = key * 100000 + (clock.live ? 0 : edgeSec % 100000);
    if (k !== lastSec) {
      lastSec = k;
      bump();
    }
  }, 200);
}

export const simActions = {
  setTruckStatus(id: string, status: string): void {
    if (sim.truckStatus[id] !== status) sim.truckStatus[id] = status;
  },
};

/** Live crane productivity used by the KPI tile, drifts slightly for a "live" feel. */
export function liveCraneRate(): number {
  const t = simNowSec();
  return 30.6 + Math.sin(t / 37) * 0.6 + Math.sin(t / 11) * 0.2;
}

/** Registry of live 3D objects for camera fly-to and follow. Key: `${kind}:${id}`. */
export const sceneRegistry = new Map<string, Object3D>();

export { craneIndex };
