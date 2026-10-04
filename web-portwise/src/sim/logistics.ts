import { SIM_START_SEC, fmtClock, fmtDuration } from "./constants";

/** Inter-terminal haulage (ITH) shuttle train between Pasir Panjang and Tuas Mega Port. Pure function of sim time. */
export const TRAIN = {
  id: "SL-24",
  to: "Tuas Mega Port",
  cycle: 720,
  offset: 200,
  approach: 120,
  dwellEnd: 540,
  departEnd: 660,
  /** x of the leading locomotive's nose when stopped at the buffer. */
  stopX: -140,
  farX: -1150,
  slots: 32,
  trackZ: -125,
} as const;

export type TrainPhase = "arriving" | "unloading" | "loading" | "departing" | "away";

export interface TrainState {
  phase: TrainPhase;
  headX: number;
  /** 0..1 progress through the dwell (unload first half, load second half). */
  k: number;
  worked: number;
  /** Sim time at which the current cycle started. */
  cycleStart: number;
  tau: number;
}

const mod = (a: number, n: number): number => ((a % n) + n) % n;

export function trainAt(t: number, out?: TrainState): TrainState {
  const s: TrainState = out ?? { phase: "away", headX: TRAIN.farX, k: 0, worked: 0, cycleStart: 0, tau: 0 };
  const tau = mod(t + TRAIN.offset, TRAIN.cycle);
  s.tau = tau;
  s.cycleStart = t - tau;
  const span = TRAIN.stopX - TRAIN.farX;
  if (tau < TRAIN.approach) {
    const u = tau / TRAIN.approach;
    s.phase = "arriving";
    s.headX = TRAIN.stopX - span * (1 - u) * (1 - u);
    s.k = 0;
    s.worked = 0;
  } else if (tau < TRAIN.dwellEnd) {
    const k = (tau - TRAIN.approach) / (TRAIN.dwellEnd - TRAIN.approach);
    s.k = k;
    s.headX = TRAIN.stopX;
    s.phase = k < 0.5 ? "unloading" : "loading";
    s.worked = Math.min(TRAIN.slots, Math.floor(halfK(s) * TRAIN.slots));
  } else if (tau < TRAIN.departEnd) {
    const u = (tau - TRAIN.dwellEnd) / (TRAIN.departEnd - TRAIN.dwellEnd);
    s.phase = "departing";
    s.headX = TRAIN.stopX - span * u * u;
    s.k = 1;
    s.worked = TRAIN.slots;
  } else {
    s.phase = "away";
    s.headX = TRAIN.farX;
    s.k = 1;
    s.worked = TRAIN.slots;
  }
  return s;
}

/** Progress 0..1 within the current unloading or loading half of the dwell. */
export function halfK(s: TrainState): number {
  if (s.phase === "unloading") return Math.min(1, s.k * 2);
  if (s.phase === "loading") return Math.min(1, (s.k - 0.5) * 2);
  return s.phase === "arriving" ? 0 : 1;
}

/** Two RMGs work the train at once: one on the front half of the slots, one on the rear half. */
export const HALF = TRAIN.slots / 2;

/** 0 = empty flatcar slot, 1 = import box (arrived on train), 2 = export box (loaded here). */
export function slotState(i: number, s: TrainState): 0 | 1 | 2 {
  const j = i % HALF;
  const f = halfK(s) * HALF;
  if (s.phase === "arriving") return 1;
  // The RMG lifts the box off ~10% into the slot's cycle and sets an export box down ~60% in.
  if (s.phase === "unloading") return f > j + 0.1 ? 0 : 1;
  if (s.phase === "loading") return f > j + 0.6 ? 2 : 0;
  return 2;
}

/** x of slot i given the head position (loco 7.5 long, 16 cars × 7.2, two 20' slots each). */
export const slotX = (i: number, headX: number): number => {
  const car = Math.floor(i / 2);
  const xc = headX - 7.5 - 3.6 - car * 7.2;
  return xc + (i % 2 === 0 ? 1.6 : -1.6);
};

export function trainLine(t: number): { label: string; tone: "harbor" | "moss" | "amber" | "slate"; progress: number } {
  const s = trainAt(t);
  switch (s.phase) {
    case "arriving":
      return { label: `Train ${TRAIN.id} arriving · ${fmtDuration(TRAIN.approach - s.tau)}`, tone: "harbor", progress: s.tau / TRAIN.approach };
    case "unloading":
      return { label: `Unloading ${s.worked}/${TRAIN.slots} boxes`, tone: "moss", progress: s.k };
    case "loading":
      return { label: `Loading ${s.worked}/${TRAIN.slots} for ${TRAIN.to}`, tone: "moss", progress: s.k };
    case "departing":
      return { label: `Train ${TRAIN.id} departed · ${TRAIN.to}`, tone: "harbor", progress: 1 };
    default:
      return { label: `Next train ${fmtClock(SIM_START_SEC + s.cycleStart + TRAIN.cycle)}`, tone: "slate", progress: 0 };
  }
}

/** Customs X-ray portal: one truck every 70 s creeps through the scanner, then into the inspection shed. */
export const SCAN = { cycle: 70, offset: 18, laneZ: -126, portalX: 173 } as const;
const SCAN_PLATES = ["XD6041B", "XB1187N", "XE9024F", "XD3370W", "XE7718C", "XB4566Y"];

export interface ScanState {
  x: number;
  visible: boolean;
  scanning: boolean;
  plate: string;
  tau: number;
}

export function scanAt(t: number, out?: ScanState): ScanState {
  const s: ScanState = out ?? { x: 0, visible: true, scanning: false, plate: "", tau: 0 };
  const tau = mod(t + SCAN.offset, SCAN.cycle);
  const n = Math.floor((t + SCAN.offset) / SCAN.cycle);
  s.tau = tau;
  s.plate = SCAN_PLATES[mod(n, SCAN_PLATES.length)];
  s.visible = tau < 62;
  s.scanning = tau >= 12 && tau < 28;
  const lerp = (a: number, b: number, u: number): number => a + (b - a) * Math.max(0, Math.min(1, u));
  if (tau < 10) s.x = lerp(146, 166, tau / 10);
  else if (tau < 30) s.x = lerp(166, 180, (tau - 10) / 20);
  else if (tau < 42) s.x = lerp(180, 208, (tau - 30) / 12);
  else if (tau < 55) s.x = 208;
  else s.x = lerp(208, 236, (tau - 55) / 7);
  return s;
}

export interface FacilityLive {
  label: string;
  tone: "signal" | "moss" | "amber" | "harbor" | "slate" | "brick";
  progress?: number;
}

const nf = new Intl.NumberFormat("en-US");

/** One-line live status for a logistics facility at sim time t (deterministic, replay-safe). */
export function facilityLive(id: string, t: number): FacilityLive {
  const since = t + 3600;
  switch (id) {
    case "rail-icd":
      return trainLine(t);
    case "customs":
      return scanLine(t);
    case "staging":
      return { label: `${78 + Math.round(9 * Math.sin(t / 300))} trucks waiting · called every 2 min`, tone: "amber" };
    case "truck-stop":
      return { label: `${5 + Math.floor(mod(t / 50, 4))}/10 pumps busy`, tone: "moss" };
    case "cfs":
      return { label: `${7 + Math.floor(mod(t / 90, 4))}/12 doors working · stripping LCL`, tone: "moss" };
    case "bonded":
      return { label: `${nf.format(212 + Math.floor(since / 240))} pallets released today`, tone: "harbor" };
    case "cold-hub":
      return { label: `−24.${Math.floor(mod(t / 40, 10))} °C · all chambers OK`, tone: "harbor" };
    case "seastar-dc":
      return { label: `${nf.format(18420 + Math.floor(since * 0.9))} orders shipped today`, tone: "moss" };
    case "mnr":
      return { label: `${38 + Math.floor(since / 600)} repairs today · 4 wash bays`, tone: "moss" };
    case "electronics":
      return { label: "Running · 3 lines · next inbound 10:20", tone: "moss" };
    case "garments":
      return { label: "Packing vaccine pallets for SEASTAR 07", tone: "moss" };
    case "seafood":
      return { label: `Freezer −28 °C · ${11 + Math.floor(since / 1800)} reefers out`, tone: "harbor" };
    case "steel":
      return { label: `Furnace 1,580 °C · ${nf.format(1240 + Math.floor(since / 60))} t today`, tone: "signal" };
    case "grain":
      return { label: "Milling line running", tone: "moss" };
    case "fuel":
      return { label: "Bunker tanker loading at jetty", tone: "amber" };
    default:
      return { label: "Operating", tone: "moss" };
  }
}

export function scanLine(t: number): { label: string; tone: "signal" | "amber" | "moss" } {
  const s = scanAt(t);
  if (s.scanning) return { label: `X-ray scanning ${s.plate}`, tone: "signal" };
  if (s.tau >= 42 && s.tau < 55) return { label: `Physical check · ${s.plate}`, tone: "amber" };
  return { label: `Queue ${3 + (Math.floor(t / 70) % 3)} trucks · avg 6 min`, tone: "moss" };
}
