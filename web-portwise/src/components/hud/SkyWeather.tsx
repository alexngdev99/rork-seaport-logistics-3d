import { useEffect, useState } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSun,
  Droplets,
  Eye,
  Gauge,
  Haze,
  Moon,
  Navigation2,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Sun,
  Sunrise,
  Sunset,
  Thermometer,
  Wind,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { fmtClock } from "@/sim/constants";
import { solarPosition, sunTimes } from "@/sim/sun";
import { WEATHER_KINDS, WEATHER_NAMES, env, useEnv, weatherImpacts, type ImpactTone, type WeatherKind, type WeatherState } from "@/state/environment";

const nf1 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const ICON: Record<WeatherKind, LucideIcon> = { clear: Sun, cloudy: Cloud, rain: CloudRain, storm: CloudLightning, fog: CloudFog, haze: Haze };

/** Icon for the conditions, switching to night variants after dark. */
function weatherIcon(w: WeatherState, isDark: boolean): LucideIcon {
  if (w.kind === "clear") return isDark ? Moon : w.cloudCover > 0.25 ? CloudSun : Sun;
  if (w.kind === "cloudy" && w.cloudCover < 0.75) return isDark ? CloudMoon : CloudSun;
  return ICON[w.kind];
}

const IMPACT_DOT: Record<ImpactTone, string> = { moss: "bg-moss", amber: "bg-amber", brick: "bg-brick", slate: "bg-slate" };

const isTypingTarget = (e: KeyboardEvent): boolean =>
  Boolean((e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable='true'], [role='dialog']"));

const compass = (deg: number): string => ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round((((deg % 360) + 360) % 360) / 45) % 8];

/** Re-renders a few times per second while the sky clock is moving (live seconds, time-lapse). */
function useSkyTick(ms: number): number {
  const [n, setN] = useState<number>(0);
  useEffect(() => {
    const id = window.setInterval(() => setN((v) => v + 1), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return n;
}

/** 24 h track coloured by daylight: navy night, coral twilight, cream day. */
function dayGradient(doy: number): string {
  const { rise, set } = sunTimes(doy);
  const p = (s: number): string => `${((s / 86400) * 100).toFixed(2)}%`;
  return `linear-gradient(90deg, #12233F 0%, #12233F ${p(rise - 2700)}, #D79A7C ${p(rise)}, #F6E4CC ${p(rise + 3600)}, #FFF4DC ${p((rise + set) / 2)}, #F6E4CC ${p(set - 3600)}, #D79A7C ${p(set)}, #12233F ${p(set + 2700)}, #12233F 100%)`;
}

function SkySlider() {
  const snap = useEnv();
  useSkyTick(snap.skyMode === "timelapse" ? 120 : 1000);
  const clock = env.skyClock();
  const { rise, set } = sunTimes(clock.doy);
  const elev = solarPosition(clock.doy, clock.sec).elev;
  const isDark = elev < -2;
  const phase = elev < -6 ? "Night" : elev < 0.5 ? (clock.sec < 43200 ? "Dawn" : "Dusk") : elev < 10 ? "Golden hour" : "Daylight";

  return (
    <div className="rounded-[14px] bg-sand/70 p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">{snap.skyMode === "live" ? "Sky · Singapore now" : snap.skyMode === "timelapse" ? "Sky · 24 h time-lapse" : "Sky · demo time"}</p>
          <p className="mt-0.5 flex items-baseline gap-2">
            <span className="font-mono text-[24px] font-bold leading-none text-ink tnum">{fmtClock(clock.sec)}</span>
            <span className="text-[12px] font-semibold text-slate">SGT · {phase}</span>
          </p>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => (snap.skyMode === "timelapse" ? env.stopTimelapse() : env.startTimelapse())}
            aria-label={snap.skyMode === "timelapse" ? "Pause time-lapse" : "Play 24 h time-lapse"}
            title={snap.skyMode === "timelapse" ? "Pause time-lapse" : "Play 24 h time-lapse (72 s)"}
            data-haptic="medium"
            className={cn(
              "grid h-10 w-10 place-items-center rounded-full transition-[background-color,transform] active:scale-90",
              snap.skyMode === "timelapse" ? "bg-signal text-white" : "bg-ink text-paper hover:bg-[#1C3157]",
            )}
          >
            {snap.skyMode === "timelapse" ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
          </button>
          <button
            type="button"
            onClick={() => env.setSkyLive()}
            disabled={snap.skyMode === "live"}
            className={cn(
              "flex h-10 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition-colors",
              snap.skyMode === "live" ? "bg-moss-soft text-moss" : "border border-hairline bg-paper text-ink hover:bg-hairline",
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", snap.skyMode === "live" ? "bg-moss pw-blink" : "bg-slate")} />
            Live
          </button>
        </div>
      </div>

      <SliderPrimitive.Root
        className="relative mt-4 flex h-8 w-full touch-none select-none items-center"
        min={0}
        max={86400 - 60}
        step={300}
        value={[clock.sec]}
        onValueChange={(v) => env.setManualSec(v[0] ?? 0)}
        aria-label="Time of day for the sky"
      >
        <SliderPrimitive.Track className="relative h-3 w-full grow overflow-hidden rounded-full border border-ink/10" style={{ background: dayGradient(clock.doy) }}>
          {[6, 12, 18].map((h) => (
            <span key={h} className="absolute inset-y-0 w-px bg-ink/20" style={{ left: `${(h / 24) * 100}%` }} aria-hidden="true" />
          ))}
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className={cn(
            "grid h-8 w-8 place-items-center rounded-full border-2 shadow-lift outline-none transition-colors focus-visible:ring-2 focus-visible:ring-signal",
            isDark ? "border-[#2A3B57] bg-ink text-[#FFC274]" : "border-paper bg-[#FFB347] text-white",
          )}
        >
          {isDark ? <Moon className="h-4 w-4 fill-current" /> : <Sun className="h-4 w-4" />}
        </SliderPrimitive.Thumb>
      </SliderPrimitive.Root>
      <div className="mt-1.5 flex justify-between font-mono text-[10.5px] text-slate tnum">
        <span>00:00</span>
        <span className="flex items-center gap-1">
          <Sunrise className="h-3 w-3 text-amber" />
          {fmtClock(rise)}
        </span>
        <span className="flex items-center gap-1">
          <Sunset className="h-3 w-3 text-signal" />
          {fmtClock(set)}
        </span>
        <span>24:00</span>
      </div>
    </div>
  );
}

function WeatherTile({ active, label, icon: Icon, onClick }: { active: boolean; label: string; icon: LucideIcon; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex h-[60px] flex-col items-center justify-center gap-1 rounded-[12px] border text-[11.5px] font-semibold transition-[background-color,border-color,transform] active:scale-95",
        active ? "border-ink bg-ink text-paper" : "border-hairline bg-paper text-ink hover:bg-sand",
      )}
    >
      <Icon className="h-[18px] w-[18px]" />
      {label}
    </button>
  );
}

function Stat({ icon: Icon, label, value, warn }: { icon: LucideIcon; label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Icon className={cn("h-4 w-4 shrink-0", warn ? "text-brick" : "text-slate")} />
      <div className="min-w-0">
        <p className="text-[10.5px] font-medium text-slate">{label}</p>
        <p className={cn("truncate font-mono text-[13px] font-bold tnum", warn ? "text-brick" : "text-ink")}>{value}</p>
      </div>
    </div>
  );
}

function SkyWeatherPanel() {
  const snap = useEnv();
  const w = env.weather();
  const impacts = weatherImpacts(w);
  const source =
    w.source === "demo"
      ? "Demo preset"
      : w.source === "live"
        ? `Live · Open-Meteo${snap.live?.observedAt ? ` · ${snap.live.observedAt}` : ""}`
        : snap.liveStatus === "loading"
          ? "Fetching live weather…"
          : "Offline · typical conditions";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-signal">Sky & weather</p>
          <p className="mt-0.5 text-[17px] font-bold leading-tight text-ink">
            {w.label} <span className="font-mono text-[15px] font-semibold text-slate tnum">{nf0.format(w.tempC)}°C</span>
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-slate">
            <Radio className={cn("h-3 w-3", w.source === "live" ? "text-moss" : "text-slate")} />
            {source}
          </p>
        </div>
        {env.isOverridden() ? (
          <button type="button" onClick={() => env.reset()} className="flex shrink-0 items-center gap-1 rounded-full bg-signal-soft px-2.5 py-1.5 text-[11.5px] font-semibold text-[#B8441A] hover:brightness-[0.98]">
            <RotateCcw className="h-3 w-3" />
            Back to live
          </button>
        ) : null}
      </div>

      <SkySlider />

      <div>
        <p className="eyebrow mb-1.5">Weather {snap.weatherChoice === "live" ? "· following live" : "· demo"}</p>
        <div className="grid grid-cols-4 gap-1.5">
          <WeatherTile active={snap.weatherChoice === "live"} label="Live" icon={Radio} onClick={() => env.setWeather("live")} />
          {WEATHER_KINDS.map((k) => (
            <WeatherTile key={k} active={snap.weatherChoice === k} label={WEATHER_NAMES[k]} icon={ICON[k]} onClick={() => env.setWeather(k)} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-x-2 gap-y-2.5 rounded-[12px] border border-hairline px-3 py-2.5">
        <Stat icon={Wind} label="Wind" value={`${nf1.format(w.windMs)} m/s ${compass(w.windFromDeg)}`} />
        <Stat icon={Navigation2} label="Gusts" value={`${nf1.format(w.gustMs)} m/s`} warn={w.gustMs >= 20} />
        <Stat icon={Eye} label="Visibility" value={`${w.visibilityKm >= 10 ? nf0.format(Math.min(w.visibilityKm, 20)) : nf1.format(w.visibilityKm)} km`} warn={w.visibilityKm < 1} />
        <Stat icon={Droplets} label="Humidity" value={`${nf0.format(w.humidity)}%`} />
        <Stat icon={Thermometer} label="Rain" value={`${nf1.format(w.precipMm)} mm/h`} />
        <Stat icon={Gauge} label="AQI (US)" value={w.aqi === null ? "—" : nf0.format(w.aqi)} warn={(w.aqi ?? 0) > 100} />
      </div>

      <div>
        <p className="eyebrow mb-1">Port impact</p>
        <ul className="flex flex-col gap-1.5">
          {impacts.map((i) => (
            <li key={i.title} className="flex gap-2.5">
              <span className={cn("mt-[6px] h-2 w-2 shrink-0 rounded-full", IMPACT_DOT[i.tone], i.tone === "brick" && "pw-blink")} />
              <span className="min-w-0">
                <span className="block text-[12.5px] font-semibold leading-snug text-ink">{i.title}</span>
                <span className="block text-[11.5px] leading-snug text-slate">{i.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="hidden text-[11px] text-slate lg:block">
        Keys: <kbd className="font-mono">N</kbd> day/night · <kbd className="font-mono">W</kbd> cycle weather
      </p>
    </div>
  );
}

/** Camera-rail button showing the current conditions; opens the sky & weather demo panel. Keys: N, W. */
export function SkyWeatherButton() {
  const snap = useEnv();
  useSkyTick(snap.skyMode === "timelapse" ? 250 : 15000);
  const w = env.weather();
  const isDark = env.sunElevation() < -2;
  const Icon = weatherIcon(w, isDark);
  const isOverridden = env.isOverridden();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e)) return;
      const k = e.key.toLowerCase();
      if (k === "n") env.toggleDayNight();
      else if (k === "w") env.cycleWeather();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const label = `Sky & weather: ${w.label}, ${nf0.format(w.tempC)}°C${isOverridden ? " (demo)" : ""}`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          data-haptic="medium"
          className={cn(
            "group relative grid h-11 w-11 place-items-center rounded-[14px] border shadow-panel transition-[background-color,border-color,transform] duration-500 active:scale-90",
            isDark ? "border-[#2A3B57] bg-ink text-[#FFC274]" : "border-hairline bg-paper text-ink hover:bg-sand",
          )}
        >
          <Icon key={`${w.kind}-${isDark}`} className={cn("h-[19px] w-[19px] pw-rise", w.kind === "storm" && "text-amber")} />
          {isOverridden ? <span className="absolute -right-1 -top-1 rounded-full border-2 border-paper bg-signal px-1 text-[8.5px] font-bold uppercase leading-[13px] text-white">Demo</span> : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="left"
        align="start"
        sideOffset={10}
        collisionPadding={12}
        className="scroll-thin max-h-[min(640px,calc(100dvh-var(--hud-top)-24px))] w-[min(340px,calc(100vw-80px))] overflow-y-auto overscroll-contain rounded-[18px] border-hairline bg-paper p-4 text-ink shadow-lift"
      >
        <SkyWeatherPanel />
      </PopoverContent>
    </Popover>
  );
}
