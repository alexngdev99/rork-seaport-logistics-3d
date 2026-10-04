import { SHIP_Z, berthX } from "@/data/layout";
import { ARRIVAL_SECONDS } from "../constants";
import { KN, M_PER_UNIT } from "./geo";
import { buildVoyage } from "./voyage";
import type { Truth, Voyage, VoyagePhase } from "./voyage";

/*
 * Port calls for the simulated morning, scripted the way a VTS sees them:
 * a voyage is a chain of legs (sea passage → anchorage → pilotage → tug-assisted berthing → alongside
 * → unberthing → outbound passage), and every nav-status change is a real AIS event.
 *
 * Singapore Strait geometry off Pasir Panjang (scene units, 1 u = 3 m; north = −z, the terminal faces south):
 *   • Quay face z = 20, ships alongside at z = 25.
 *   • Traffic Separation Scheme: westbound lane z ≈ 150 and eastbound lane z ≈ 182 — each keeps to starboard.
 *   • Western Anchorage (AWW) south-east of the terminal, z ≈ 220–252, clear of both lanes.
 */

export const ORIENT_LOTUS = "orient-lotus";
export const MERLION_STAR = "merlion-star";
export const BLUE_MARLIN = "blue-marlin";

/** ORIENT LOTUS drops anchor at the Western Anchorage after her Strait passage (08:45:40). */
export const T_OL_ANCHORED = -3500;
/** ORIENT LOTUS heaves anchor and proceeds to Pasir Panjang under pilotage. */
export const T_HEAVE = -300;
/** End of her channel leg; tugs push her the last 40 m alongside. */
export const T_ALONGSIDE = 260;
/** MERLION STAR's last export box is loaded; STS-01 raises its boom. */
export const T_MK_CARGO_DONE = -240;
export const T_MK_PILOT = 300;
/** MERLION STAR lets go all lines (ATD 09:51). */
export const T_MK_SLIP = 420;
const T_MK_OFF = 580;
const T_MK_PATH_END = 1480;
/** BLUE MARLIN anchors at the Western Anchorage to wait for her 13:30 berth window. */
export const T_BM_ANCHORED = 560;

const OL_ANCHOR: [number, number] = [452, 220];
const BM_ANCHOR: [number, number] = [585, 252];
/** Port limit / fairway buoy: an outbound ship east of this counts as sailed. */
export const PORT_LIMIT_X = 450;

export const laneZ = (dir: "W" | "E", x: number): number => (dir === "W" ? 150 : 182) + 6 * Math.sin(x / 170);
const kn = (k: number): number => (k * KN) / M_PER_UNIT;

/* ------------------------------------------------------------------ */
/* Terminal port calls                                                 */
/* ------------------------------------------------------------------ */

const orientLotus = buildVoyage({ x: 1080, z: 320, heading: 290 }, -4200, [
  { kind: "path", until: T_OL_ANCHORED, pts: [[820, 282], [620, 244], OL_ANCHOR], startKn: 10, endKn: 0, phase: "inbound", drift: 0.8 },
  { kind: "anchor", until: T_HEAVE, swing: 294 },
  { kind: "path", until: T_ALONGSIDE, pts: [[340, 166], [244, 126], [126, 88], [26, 57], [-34, 42], [berthX(3) + 13, SHIP_Z + 14.2]], endKn: 0.7, phase: "inbound", turnSec: 70, drift: 1.6 },
  { kind: "push", until: ARRIVAL_SECONDS, to: [berthX(3), SHIP_Z], heading: 270, phase: "berthing" },
  { kind: "moored", until: Infinity, berth: 3, heading: 270 },
]);

const merlionStar = buildVoyage({ x: berthX(1), z: SHIP_Z, heading: 90 }, -1e6, [
  { kind: "moored", until: T_MK_SLIP, berth: 1, heading: 90 },
  { kind: "push", until: T_MK_OFF, to: [berthX(1) + 10, 50], heading: 84, phase: "unberthing" },
  { kind: "path", until: T_MK_PATH_END, pts: [[-100, 62], [20, 96], [170, 148], [330, 176], [520, 184], [760, 186]], endKn: 10, phase: "outbound", turnSec: 90, drift: 1.2 },
  { kind: "cruise", sailedAfter: 0 },
]);

const blueMarlin = buildVoyage({ x: 1120, z: 340, heading: 290 }, -130, [
  { kind: "path", until: T_BM_ANCHORED, pts: [[900, 310], [720, 276], BM_ANCHOR], startKn: 9, endKn: 0, phase: "inbound", drift: 0.8 },
  { kind: "anchor", until: Infinity, swing: 292 },
]);

function firstTime(v: Voyage, pred: (s: Truth) => boolean, from: number, to: number): number {
  const s: Truth = { x: 0, z: 0, heading: 0, status: 0 };
  for (let t = from; t <= to; t += 1) if (pred(v.truth(t, s))) return t;
  return to;
}

/** MERLION STAR clears the port limit (computed from her track, not scripted). */
export const T_MK_SAILED = firstTime(merlionStar, (s) => s.x > PORT_LIMIT_X, T_MK_OFF, T_MK_PATH_END + 600);

export type MovementKind = "arrival" | "departure";

export interface PortCall {
  id: string;
  kind: MovementKind;
  voyage: Voyage;
  berth: number;
  /** Heading when moored (bow west = 270 for ships that swung on arrival). */
  berthHeading: number;
  /** Where the current leg is heading, for distance/ETA readouts. */
  target: (t: number) => [number, number] | null;
  phaseAt: (t: number) => VoyagePhase;
}

const legTarget =
  (v: Voyage) =>
  (t: number): [number, number] | null => {
    const l = v.legAt(t);
    if (!Number.isFinite(l.t1) || l.kind === "anchor" || l.kind === "moored") return null;
    const s: Truth = { x: 0, z: 0, heading: 0, status: 0 };
    // Arrivals aim for the berth through the push leg; departures for the port limit.
    let end = l.t1;
    const next = v.legs[v.legs.indexOf(l) + 1];
    if (l.kind === "path" && next?.kind === "push") end = next.t1;
    v.truth(end, s);
    return [s.x, s.z];
  };

export const PORT_CALLS: PortCall[] = [
  { id: ORIENT_LOTUS, kind: "arrival", voyage: orientLotus, berth: 3, berthHeading: 270, target: legTarget(orientLotus), phaseAt: (t) => orientLotus.phaseAt(t) },
  {
    id: MERLION_STAR,
    kind: "departure",
    voyage: merlionStar,
    berth: 1,
    berthHeading: 90,
    target: (t) => (t >= T_MK_SLIP && t < T_MK_SAILED ? [PORT_LIMIT_X, laneZ("E", PORT_LIMIT_X)] : null),
    phaseAt: (t) => (t >= T_MK_SAILED ? "sailed" : merlionStar.phaseAt(t)),
  },
  { id: BLUE_MARLIN, kind: "arrival", voyage: blueMarlin, berth: 1, berthHeading: 270, target: legTarget(blueMarlin), phaseAt: (t) => blueMarlin.phaseAt(t) },
];

export const portCall = (id: string): PortCall | undefined => PORT_CALLS.find((p) => p.id === id);

/* ------------------------------------------------------------------ */
/* Movement log                                                        */
/* ------------------------------------------------------------------ */

export interface PortEvent {
  id: string;
  t: number;
  vesselId: string;
  /** Short label for the time-bar marker; omitted for minor events. */
  marker?: string;
  /** Line in the vessel activity log. */
  text: string;
  tone: "harbor" | "moss" | "amber" | "brick";
}

const EVENTS: PortEvent[] = [
  { id: "ol-anchor", t: T_OL_ANCHORED, vesselId: ORIENT_LOTUS, marker: "ORIENT LOTUS anchored (AIS: At anchor)", text: "AIS status → At anchor · ORIENT LOTUS anchored at the Western Anchorage (AWW), waiting for Berth 3", tone: "amber" },
  { id: "ol-pilot", t: T_HEAVE - 480, vesselId: ORIENT_LOTUS, text: "MPA pilot boarded ORIENT LOTUS at the Western Boarding Ground", tone: "harbor" },
  { id: "ol-heave", t: T_HEAVE, vesselId: ORIENT_LOTUS, marker: "ORIENT LOTUS heaves anchor (AIS: Under way)", text: "AIS status → Under way · ORIENT LOTUS heaved anchor, proceeding to Pasir Panjang", tone: "harbor" },
  { id: "ol-tugs", t: T_ALONGSIDE - 150, vesselId: ORIENT_LOTUS, text: "Tugs made fast · ORIENT LOTUS swinging for Berth 3", tone: "harbor" },
  { id: "ol-berth", t: ARRIVAL_SECONDS, vesselId: ORIENT_LOTUS, marker: "ORIENT LOTUS moored (AIS) · STS-05 starts", text: "AIS status → Moored · ORIENT LOTUS all fast at Berth 3 – STS-05 boom down", tone: "moss" },
  { id: "mk-cargo", t: T_MK_CARGO_DONE, vesselId: MERLION_STAR, marker: "MERLION STAR cargo complete", text: "MERLION STAR cargo complete · 580/580 TEU loaded, STS-01 boom up", tone: "moss" },
  { id: "mk-pilot", t: T_MK_PILOT, vesselId: MERLION_STAR, text: "MPA pilot boarded MERLION STAR · tugs on standby at Berth 1", tone: "harbor" },
  { id: "mk-slip", t: T_MK_SLIP, vesselId: MERLION_STAR, marker: "MERLION STAR unberths (AIS: Under way)", text: "AIS status → Under way · MERLION STAR let go all lines from Berth 1", tone: "harbor" },
  { id: "mk-sailed", t: T_MK_SAILED, vesselId: MERLION_STAR, marker: "MERLION STAR joins the eastbound TSS", text: "MERLION STAR joined the eastbound TSS lane · pilot disembarked, bound for Kaohsiung", tone: "moss" },
  { id: "bm-anchor", t: T_BM_ANCHORED, vesselId: BLUE_MARLIN, marker: "BLUE MARLIN anchored (AIS: At anchor)", text: "AIS status → At anchor · BLUE MARLIN anchored at the Western Anchorage, waiting for her 13:30 berth window", tone: "amber" },
];

/** Every port movement of the morning, oldest first. */
export const PORT_EVENTS: PortEvent[] = EVENTS.sort((a, b) => a.t - b.t);

/* ------------------------------------------------------------------ */
/* Singapore Strait traffic passing the terminal (TSS)                 */
/* ------------------------------------------------------------------ */

export interface Transit {
  id: string;
  name: string;
  dir: "W" | "E";
  kn: number;
  /** Sim time she passes x = 0. */
  passT: number;
  length: number;
  hull: string;
  voyage: Voyage;
}

const STRAIT_EAST = 1150;
const STRAIT_WEST = -950;

function transitVoyage(dir: "W" | "E", speedKn: number, passT: number): Voyage {
  const xs: number[] = [];
  const step = 150;
  if (dir === "W") for (let x = STRAIT_EAST; x >= STRAIT_WEST; x -= step) xs.push(x);
  else for (let x = STRAIT_WEST; x <= STRAIT_EAST; x += step) xs.push(x);
  const pts: Array<[number, number]> = xs.map((x) => [x, laneZ(dir, x)]);
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const v = kn(speedKn);
  const x0 = pts[0][0];
  const t0 = passT - Math.abs(x0) / v;
  return buildVoyage({ x: x0, z: pts[0][1], heading: dir === "W" ? 270 : 90 }, t0, [
    { kind: "path", until: t0 + len / v, pts: pts.slice(1), startKn: speedKn, endKn: speedKn, phase: "inbound", turnSec: 1, drift: 1 },
    { kind: "cruise", sailedAfter: 0 },
  ]);
}

const TRANSIT_SPECS: Array<Omit<Transit, "voyage">> = [
  { id: "kota-ria", name: "KOTA RIA", dir: "W", kn: 9.0, passT: -2600, length: 24, hull: "#2F5D4E" },
  { id: "batam-link", name: "BATAM LINK", dir: "E", kn: 8.6, passT: -1700, length: 26, hull: "#1E3A66" },
  { id: "jurong-08", name: "JURONG 08", dir: "E", kn: 7.5, passT: -1000, length: 20, hull: "#8A3B34" },
  { id: "sinar-bintan", name: "SINAR BINTAN", dir: "W", kn: 9.4, passT: 420, length: 24, hull: "#4F6D8F" },
  { id: "straits-03", name: "STRAITS 03", dir: "E", kn: 6.5, passT: 1500, length: 20, hull: "#6B5A3E" },
  { id: "ocean-grace", name: "OCEAN GRACE", dir: "W", kn: 10.2, passT: 1750, length: 28, hull: "#B5463A" },
  { id: "johor-pride", name: "JOHOR PRIDE", dir: "W", kn: 8.8, passT: 2500, length: 22, hull: "#2C6FB0" },
  { id: "pacific-21", name: "PACIFIC 21", dir: "E", kn: 8.2, passT: 2950, length: 24, hull: "#2F5D4E" },
];

export const TRANSITS: Transit[] = TRANSIT_SPECS.map((s) => ({ ...s, voyage: transitVoyage(s.dir, s.kn, s.passT) }));

/** Ships further out than this are beyond the scene's fog and hidden. */
export const VISIBLE_X = 960;
