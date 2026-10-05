import { useSyncExternalStore } from "react";
import type { Alert } from "@/data/types";
import { liveT, simT } from "@/sim/simStore";
import { sgtDayOfYear, sgtSecondsOfDay, solarPosition } from "@/sim/sun";

export type WeatherKind = "clear" | "cloudy" | "rain" | "storm" | "fog" | "haze";
export const WEATHER_KINDS: WeatherKind[] = ["clear", "cloudy", "rain", "storm", "fog", "haze"];
export type WeatherChoice = "live" | WeatherKind;
export type SkyMode = "live" | "manual" | "timelapse";

/** 0 … 1 blend targets for each visual layer of the scene. */
export interface WeatherLook {
  cloud: number;
  rain: number;
  storm: number;
  fog: number;
  haze: number;
}

export interface WeatherState {
  kind: WeatherKind;
  label: string;
  tempC: number;
  humidity: number;
  windMs: number;
  gustMs: number;
  /** Direction the wind blows FROM, degrees true. */
  windFromDeg: number;
  visibilityKm: number;
  cloudCover: number;
  precipMm: number;
  aqi: number | null;
  look: WeatherLook;
  source: "live" | "demo" | "offline";
}

/** Raw current conditions from Open-Meteo for Pasir Panjang. */
export interface LiveWeather {
  code: number;
  tempC: number;
  humidity: number;
  windMs: number;
  gustMs: number;
  windFromDeg: number;
  cloudCover: number;
  precipMm: number;
  visibilityM: number;
  aqi: number | null;
  /** Observation time, "HH:MM" SGT. */
  observedAt: string;
}

export type LiveStatus = "loading" | "ok" | "error";

const PRESETS: Record<WeatherKind, Omit<WeatherState, "kind" | "look" | "source">> = {
  clear: { label: "Clear", tempC: 31, humidity: 64, windMs: 3.2, gustMs: 6.1, windFromDeg: 160, visibilityKm: 18, cloudCover: 0.12, precipMm: 0, aqi: 41 },
  cloudy: { label: "Overcast", tempC: 29, humidity: 74, windMs: 4.8, gustMs: 8.6, windFromDeg: 145, visibilityKm: 14, cloudCover: 0.9, precipMm: 0, aqi: 52 },
  rain: { label: "Heavy rain", tempC: 26, humidity: 93, windMs: 7.6, gustMs: 12.4, windFromDeg: 200, visibilityKm: 4.5, cloudCover: 1, precipMm: 7.2, aqi: 24 },
  storm: { label: "Thunderstorm", tempC: 24, humidity: 97, windMs: 15.2, gustMs: 23.4, windFromDeg: 250, visibilityKm: 1.6, cloudCover: 1, precipMm: 31, aqi: 18 },
  fog: { label: "Fog", tempC: 25, humidity: 99, windMs: 1.2, gustMs: 2.4, windFromDeg: 120, visibilityKm: 0.6, cloudCover: 0.7, precipMm: 0, aqi: 58 },
  haze: { label: "Haze", tempC: 32, humidity: 68, windMs: 2.6, gustMs: 4.6, windFromDeg: 230, visibilityKm: 3.2, cloudCover: 0.35, precipMm: 0, aqi: 162 },
};

const LOOKS: Record<WeatherKind, WeatherLook> = {
  clear: { cloud: 0, rain: 0, storm: 0, fog: 0, haze: 0 },
  cloudy: { cloud: 0.85, rain: 0, storm: 0, fog: 0, haze: 0 },
  rain: { cloud: 1, rain: 1, storm: 0, fog: 0, haze: 0 },
  storm: { cloud: 1, rain: 1, storm: 1, fog: 0, haze: 0 },
  fog: { cloud: 0.6, rain: 0, storm: 0, fog: 1, haze: 0 },
  haze: { cloud: 0.3, rain: 0, storm: 0, fog: 0, haze: 1 },
};

export const WEATHER_NAMES: Record<WeatherKind, string> = { clear: "Clear", cloudy: "Cloudy", rain: "Rain", storm: "Storm", fog: "Fog", haze: "Haze" };

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** Maps WMO weather codes + visibility + air quality to one of our looks. */
function fromLive(l: LiveWeather): WeatherState {
  const isStorm = l.code >= 95;
  const isRain = !isStorm && ((l.code >= 51 && l.code <= 67) || (l.code >= 80 && l.code <= 82));
  const isFog = !isStorm && !isRain && (l.code === 45 || l.code === 48 || l.visibilityM < 1000);
  const isHaze = !isStorm && !isRain && !isFog && (l.aqi ?? 0) > 100;
  const kind: WeatherKind = isStorm ? "storm" : isRain ? "rain" : isFog ? "fog" : isHaze ? "haze" : l.cloudCover >= 0.6 || l.code === 3 ? "cloudy" : "clear";
  const label = isStorm
    ? "Thunderstorm"
    : isRain
      ? l.code <= 57
        ? "Drizzle"
        : l.precipMm > 4 || l.code === 65 || l.code === 82
          ? "Heavy rain"
          : "Rain"
      : isFog
        ? "Fog"
        : isHaze
          ? l.cloudCover > 0.7
            ? "Haze · overcast"
            : "Haze"
          : l.code === 3 || l.cloudCover > 0.85
            ? "Overcast"
            : l.code >= 1 || l.cloudCover > 0.25
              ? "Partly cloudy"
              : "Clear";
  const look: WeatherLook = {
    cloud: clamp01(l.cloudCover),
    rain: isStorm ? 1 : isRain ? clamp01(0.4 + l.precipMm / 6) : 0,
    storm: isStorm ? 1 : 0,
    fog: isFog ? clamp01((1600 - l.visibilityM) / 1000) : 0,
    haze: clamp01(((l.aqi ?? 0) - 70) / 90),
  };
  return {
    kind,
    label,
    tempC: l.tempC,
    humidity: l.humidity,
    windMs: l.windMs,
    gustMs: l.gustMs,
    windFromDeg: l.windFromDeg,
    visibilityKm: l.visibilityM / 1000,
    cloudCover: l.cloudCover,
    precipMm: l.precipMm,
    aqi: l.aqi,
    look,
    source: "live",
  };
}

const presetState = (kind: WeatherKind, source: WeatherState["source"]): WeatherState => ({ kind, ...PRESETS[kind], look: LOOKS[kind], source });

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

const LAPSE_RATE = 86400 / 72;
const nowMs = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());

interface EnvSnapshot {
  skyMode: SkyMode;
  manualSec: number;
  weatherChoice: WeatherChoice;
  live: LiveWeather | null;
  liveStatus: LiveStatus;
}

let state: EnvSnapshot = { skyMode: "live", manualSec: 12.5 * 3600, weatherChoice: "live", live: null, liveStatus: "loading" };
let lapse = { startSec: 0, startMs: 0 };
let weatherCache: WeatherState | null = null;
const listeners = new Set<() => void>();

function update(patch: Partial<EnvSnapshot>): void {
  state = { ...state, ...patch };
  weatherCache = null;
  listeners.forEach((l) => l());
}

const wrapDay = (s: number): number => ((s % 86400) + 86400) % 86400;

export interface SkyClock {
  /** Seconds after midnight, SGT. */
  sec: number;
  doy: number;
}

/**
 * Sky and weather for the 3D scene. By default both follow reality: the sky uses the real Singapore
 * clock (shifted when the time bar replays the past) and the weather comes from Open-Meteo.
 * The demo panel can pin a time of day, run a 24 h time-lapse, or force a weather preset.
 */
export const env = {
  get: (): EnvSnapshot => state,
  skyClock: (): SkyClock => {
    const now = new Date();
    const doy = sgtDayOfYear(now);
    if (state.skyMode === "manual") return { sec: state.manualSec, doy };
    if (state.skyMode === "timelapse") return { sec: wrapDay(lapse.startSec + ((nowMs() - lapse.startMs) / 1000) * LAPSE_RATE), doy };
    return { sec: wrapDay(sgtSecondsOfDay(now) + (simT() - liveT())), doy };
  },
  sunElevation: (): number => {
    const c = env.skyClock();
    return solarPosition(c.doy, c.sec).elev;
  },
  weather: (): WeatherState => {
    if (weatherCache) return weatherCache;
    if (state.weatherChoice !== "live") weatherCache = presetState(state.weatherChoice, "demo");
    else if (state.live) weatherCache = fromLive(state.live);
    else weatherCache = { ...presetState("cloudy", "offline"), label: "Partly cloudy", look: { ...LOOKS.cloudy, cloud: 0.45 } };
    return weatherCache;
  },
  isOverridden: (): boolean => state.skyMode !== "live" || state.weatherChoice !== "live",
  setLive: (live: LiveWeather): void => update({ live, liveStatus: "ok" }),
  setLiveStatus: (liveStatus: LiveStatus): void => {
    if (liveStatus !== state.liveStatus) update({ liveStatus });
  },
  setSkyLive: (): void => update({ skyMode: "live" }),
  setManualSec: (sec: number): void => update({ skyMode: "manual", manualSec: wrapDay(sec) }),
  startTimelapse: (): void => {
    lapse = { startSec: env.skyClock().sec, startMs: nowMs() };
    update({ skyMode: "timelapse" });
  },
  /** Stops a running time-lapse where it is. */
  stopTimelapse: (): void => update({ skyMode: "manual", manualSec: env.skyClock().sec }),
  setWeather: (weatherChoice: WeatherChoice): void => update({ weatherChoice }),
  cycleWeather: (): void => {
    const order: WeatherChoice[] = ["live", ...WEATHER_KINDS];
    update({ weatherChoice: order[(order.indexOf(state.weatherChoice) + 1) % order.length] });
  },
  /** Quick day/night flip for demos (N key): pins midday or late evening. */
  toggleDayNight: (): void => {
    const isDark = env.sunElevation() < -2;
    update({ skyMode: "manual", manualSec: isDark ? 11 * 3600 : 21.5 * 3600 });
  },
  reset: (): void => update({ skyMode: "live", weatherChoice: "live" }),
  subscribe: (fn: () => void): (() => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

export const useEnv = (): EnvSnapshot => useSyncExternalStore(env.subscribe, env.get, env.get);

/* ------------------------------------------------------------------ */
/* Operational impact                                                  */
/* ------------------------------------------------------------------ */

/** Quay cranes stop above this gust speed (typical STS operating limit). */
export const CRANE_GUST_LIMIT = 20;

const f1 = (v: number): string => v.toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: v < 10 ? 1 : 0 });

/** Reason string when the weather forces every quay crane to stop, else null. */
export function craneHoldReason(w: WeatherState): string | null {
  if (w.kind === "storm") return w.gustMs >= CRANE_GUST_LIMIT ? `Wind & lightning hold · gusts ${f1(w.gustMs)} m/s` : "Lightning hold";
  if (w.gustMs >= CRANE_GUST_LIMIT) return `Wind hold · gusts ${f1(w.gustMs)} m/s`;
  return null;
}

/** Multiplier applied to live crane productivity. */
export function productivityFactor(w: WeatherState): number {
  if (craneHoldReason(w)) return 0;
  if (w.kind === "rain") return 0.85;
  if (w.kind === "fog") return 0.93;
  if (w.kind === "haze") return 0.97;
  return 1;
}

export type ImpactTone = "moss" | "amber" | "brick" | "slate";

export interface Impact {
  tone: ImpactTone;
  title: string;
  detail: string;
}

export function weatherImpacts(w: WeatherState): Impact[] {
  const out: Impact[] = [];
  const hold = craneHoldReason(w);
  if (hold) {
    out.push({ tone: "brick", title: "Quay cranes on hold", detail: w.gustMs >= CRANE_GUST_LIMIT ? `Gusts ${f1(w.gustMs)} m/s exceed the ${CRANE_GUST_LIMIT} m/s limit. Booms raised, spreaders parked.` : "Lightning nearby. Booms raised until 15 min after the last strike." });
  }
  if (w.kind === "storm") {
    out.push({ tone: "brick", title: "Lightning protocol", detail: "Lashing gangs and apron crews called in; reefer checks paused." });
    out.push({ tone: "amber", title: "Pilot boarding suspended", detail: "MPA pilots hold at the Western Boarding Ground. Arrivals wait at anchor." });
  }
  if (w.kind === "rain") {
    out.push({ tone: "amber", title: "Crane productivity −15%", detail: "Wet twistlocks and spray on the cab glass slow every cycle." });
    out.push({ tone: "slate", title: "Yard speed limit 15 km/h", detail: "Wet-weather limit for prime movers inside the terminal." });
  }
  if (w.kind === "fog") {
    out.push({ tone: "amber", title: "Restricted visibility", detail: `Visibility ${f1(w.visibilityKm)} km. VTS radar-assisted pilotage, fog signals sounding.` });
    out.push({ tone: "amber", title: "Crane productivity −7%", detail: "Operators slow down on the long outreach in low visibility." });
  }
  if ((w.aqi ?? 0) > 100) {
    out.push({ tone: "amber", title: `Haze · AQI ${Math.round(w.aqi ?? 0)}`, detail: "Unhealthy air. N95 masks advised for outdoor crews, shorter shifts." });
  }
  if (!out.length) {
    out.push({ tone: "moss", title: "All operations normal", detail: `Wind ${f1(w.windMs)} m/s, visibility ${f1(Math.min(w.visibilityKm, 20))} km. Within crane and pilotage limits.` });
  }
  return out;
}

/** Live weather alert for the alerts panel, or null in benign weather. */
export function weatherAlert(w: WeatherState): Alert | null {
  const hold = craneHoldReason(w);
  if (hold) return { id: "wx-hold", severity: "danger", title: "Weather hold – quay cranes stopped", detail: `${hold}. All STS booms raised.`, time: "Now", target: { kind: "crane", id: "STS-03" } };
  if (w.kind === "rain") return { id: "wx-rain", severity: "warning", title: `${w.label} – crane productivity −15%`, detail: "Wet twistlocks slow every cycle.", time: "Now", target: { kind: "crane", id: "STS-03" } };
  if (w.kind === "fog") return { id: "wx-fog", severity: "warning", title: `Fog – visibility ${f1(w.visibilityKm)} km`, detail: "VTS radar-assisted pilotage.", time: "Now", target: { kind: "vessel", id: "orient-lotus" } };
  if ((w.aqi ?? 0) > 100) return { id: "wx-haze", severity: "warning", title: `Haze – AQI ${Math.round(w.aqi ?? 0)}`, detail: "N95 advisory for outdoor crews.", time: "Now", target: { kind: "crane", id: "STS-03" } };
  return null;
}
