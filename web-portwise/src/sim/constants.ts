/** Wall-clock time of day (seconds, local SGT, UTC+8) that maps to sim time t = 0. */
export const SIM_START_SEC = 9 * 3600 + 44 * 60;
/** Local time zone offset of Singapore (SGT, UTC+8), used for AIS UTC timestamps. */
export const UTC_OFFSET_SEC = 8 * 3600;
/** How far back the replay buffer reaches (sim seconds before t = 0). */
export const MIN_T = -3600;
/** ORIENT LOTUS is all fast alongside Berth 3 at this sim time (its AIS status flips to "Moored"). */
export const ARRIVAL_SECONDS = 360;

const pad = (n: number): string => String(Math.floor(n)).padStart(2, "0");

/** Formats seconds-of-day as "09:44" or "09:44:05". */
export function fmtClock(sec: number, withSeconds = false): string {
  const s = ((sec % 86400) + 86400) % 86400;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  return withSeconds ? `${pad(h)}:${pad(m)}:${pad(ss)}` : `${pad(h)}:${pad(m)}`;
}

/** "4:05" style duration. */
export function fmtDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${m}:${pad(ss)}`;
}
