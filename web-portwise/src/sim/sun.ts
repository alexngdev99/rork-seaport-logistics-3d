/** Solar position for Pasir Panjang Terminal (NOAA low-accuracy equations, good to well under a degree). */
const LAT = 1.2655;
const LON = 103.7633;
const TZ_HOURS = 8;
const DEG = Math.PI / 180;

export interface SunPosition {
  /** Degrees above the horizon (negative below). */
  elev: number;
  /** Degrees clockwise from true north. */
  az: number;
}

/** Sun position on day-of-year `doy` at `sec` seconds after local (SGT) midnight. */
export function solarPosition(doy: number, sec: number): SunPosition {
  const hour = sec / 3600;
  const g = ((2 * Math.PI) / 365) * (doy - 1 + (hour - 12) / 24);
  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl =
    0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const trueSolarMin = hour * 60 + eqTime + 4 * LON - 60 * TZ_HOURS;
  const ha = (trueSolarMin / 4 - 180) * DEG;
  const lat = LAT * DEG;
  const cosZen = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha);
  const zen = Math.acos(Math.max(-1, Math.min(1, cosZen)));
  const az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat)) / DEG + 180;
  return { elev: 90 - zen / DEG, az: ((az % 360) + 360) % 360 };
}

export interface SunTimes {
  /** Seconds after local midnight. */
  rise: number;
  set: number;
  noon: number;
}

const timesCache = new Map<number, SunTimes>();

/** Sunrise / sunset (upper limb with refraction, −0.833°) and solar noon for a day of year. */
export function sunTimes(doy: number): SunTimes {
  const hit = timesCache.get(doy);
  if (hit) return hit;
  let rise = 6.9 * 3600;
  let set = 19 * 3600;
  let noon = 13 * 3600;
  let best = -90;
  let prev = solarPosition(doy, 0).elev;
  for (let s = 60; s <= 86400; s += 60) {
    const e = solarPosition(doy, s).elev;
    if (prev < -0.833 && e >= -0.833) rise = s;
    if (prev >= -0.833 && e < -0.833) set = s;
    if (e > best) {
      best = e;
      noon = s;
    }
    prev = e;
  }
  const out = { rise, set, noon };
  timesCache.set(doy, out);
  return out;
}

/** Day of year (1-366) of a Date, in Singapore time. */
export function sgtDayOfYear(date: Date): number {
  const sgt = new Date(date.getTime() + TZ_HOURS * 3600 * 1000);
  const start = Date.UTC(sgt.getUTCFullYear(), 0, 1);
  return Math.floor((sgt.getTime() - start) / 86400000) + 1;
}

/** Seconds after midnight in Singapore time. */
export function sgtSecondsOfDay(date: Date): number {
  const s = (date.getTime() / 1000 + TZ_HOURS * 3600) % 86400;
  return s < 0 ? s + 86400 : s;
}
