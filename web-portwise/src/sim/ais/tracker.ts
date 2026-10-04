import { AIS_DEFS, AisTrack, deadReckon } from "./tracks";
import type { AisReport, AisVesselDef, DrPose } from "./tracks";
import { classAInterval, rotDegPerMin } from "./nmea";
import { lerpAngle } from "./geo";

/** Time over which the display eases from the old dead-reckoned track onto a fresh report. */
export const BLEND_SEC = 2.2;
/** A target with no fix for this long is shown as lost (VTS convention: 6 min for Class A). */
export const LOST_SEC = 360;
/** Moored reports within this many scene units of the berth are snapped to it, like a VTS display. */
const SNAP_UNITS = 30;

const tracks = new Map<string, AisTrack>(AIS_DEFS.map((d) => [d.id, new AisTrack(d)]));

export const aisDef = (id: string): AisVesselDef | undefined => tracks.get(id)?.def;
export const hasAis = (id: string): boolean => tracks.has(id);

/** Displayed state of one AIS target at a sim time, derived only from reports received by then. */
export interface AisFix extends DrPose {
  report: AisReport | null;
  sog: number;
  cog: number;
  rot: number | null;
  status: number;
  /** Seconds since the last received fix was taken. */
  age: number;
  /** Nominal ITU reporting interval for the current dynamics. */
  expected: number;
  stale: boolean;
  lost: boolean;
  snapped: boolean;
  blending: boolean;
}

export const newFix = (): AisFix => ({ x: 0, z: 0, heading: 0, report: null, sog: 0, cog: 0, rot: null, status: 15, age: 0, expected: 10, stale: false, lost: false, snapped: false, blending: false });

/** Index of the last element whose `tRecv` is ≤ t, or −1. */
function lastIndex(list: AisReport[], t: number): number {
  let lo = 0;
  let hi = list.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid].tRecv <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

const prevPose: DrPose = { x: 0, z: 0, heading: 0 };
const smooth = (u: number): number => u * u * (3 - 2 * u);

/**
 * Where to draw a ship at time t: dead-reckon the newest received report (SOG/COG/ROT), and for a
 * couple of seconds after it lands, blend from the previous report's projection so the hull never
 * teleports. Pure function of t, so replay is exact.
 */
export function aisFix(id: string, t: number, out: AisFix): AisFix {
  const tr = tracks.get(id);
  if (!tr) {
    out.report = null;
    return out;
  }
  tr.ensure(t);
  const i = lastIndex(tr.rx, t);
  if (i < 0) {
    const truth = tr.def.truth(t, { x: 0, z: 0, heading: 0, status: 15 });
    out.x = truth.x;
    out.z = truth.z;
    out.heading = truth.heading;
    out.report = null;
    out.lost = true;
    return out;
  }
  const cur = tr.rx[i];
  deadReckon(cur, t, out);
  const since = t - cur.tRecv;
  out.blending = false;
  if (i > 0 && !cur.reset && since < BLEND_SEC) {
    deadReckon(tr.rx[i - 1], t, prevPose);
    const s = smooth(Math.max(0, since) / BLEND_SEC);
    out.x = prevPose.x + (out.x - prevPose.x) * s;
    out.z = prevPose.z + (out.z - prevPose.z) * s;
    out.heading = lerpAngle(prevPose.heading, out.heading, s);
    out.blending = true;
  }
  const m = cur.msg;
  const berth = tr.def.berth;
  out.snapped = false;
  if (m.NavigationalStatus === 5 && m.Sog < 0.5 && berth !== undefined) {
    const bx = tr.def.truth(t, { x: 0, z: 0, heading: 0, status: 5 });
    if (bx.status === 5 && Math.hypot(bx.x - out.x, bx.z - out.z) < SNAP_UNITS) {
      const s = since < BLEND_SEC ? smooth(Math.max(0, since) / BLEND_SEC) : 1;
      out.x += (bx.x - out.x) * s;
      out.z += (bx.z - out.z) * s;
      out.heading = lerpAngle(out.heading, tr.def.berthHeading, s);
      out.snapped = true;
    }
  }
  out.report = cur;
  out.sog = m.Sog;
  out.cog = m.Cog;
  out.rot = rotDegPerMin(m.RateOfTurn);
  out.status = m.NavigationalStatus;
  out.age = Math.max(0, t - cur.tFix);
  out.expected = classAInterval(m.NavigationalStatus, m.Sog, out.rot ?? 0);
  out.lost = out.age > Math.max(LOST_SEC, out.expected * 3.5);
  out.stale = !out.lost && out.age > out.expected * 2.2 + 2;
  return out;
}

/** Received reports with `tRecv` in (t − window, t], oldest first. */
export function aisReceived(id: string, t: number, window: number): AisReport[] {
  const tr = tracks.get(id);
  if (!tr) return [];
  tr.ensure(t);
  const hi = lastIndex(tr.rx, t);
  const lo = lastIndex(tr.rx, t - window);
  return tr.rx.slice(lo + 1, hi + 1);
}

/** Latest `n` transmissions known at time t (decoded ones once received, missed ones once their slot passed), newest first. */
export function aisLog(id: string, t: number, n: number): AisReport[] {
  const tr = tracks.get(id);
  if (!tr) return [];
  tr.ensure(t + 2);
  const out: AisReport[] = [];
  for (let i = tr.all.length - 1; i >= 0 && out.length < n; i--) {
    const r = tr.all[i];
    if ((r.received ? r.tRecv : r.tFix + 1.5) <= t) out.push(r);
  }
  return out;
}

/** Reception statistics over a window: transmissions decoded vs. missed (slot collisions, fading). */
export function aisReception(id: string, t: number, window: number): { received: number; missed: number } {
  const tr = tracks.get(id);
  if (!tr) return { received: 0, missed: 0 };
  tr.ensure(t);
  let received = 0;
  let missed = 0;
  for (let i = tr.all.length - 1; i >= 0; i--) {
    const r = tr.all[i];
    if (r.tFix > t) continue;
    if (r.tFix < t - window) break;
    if (r.received) received++;
    else missed++;
  }
  return { received, missed };
}
