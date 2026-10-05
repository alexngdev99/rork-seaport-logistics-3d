import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { FastForward, Pause, Play, Radio, Rewind, StepBack, StepForward } from "lucide-react";
import { cn } from "@/lib/utils";
import { MIN_T, SIM_START_SEC, TIMELINE_EVENTS, clockSnapshot, fmtClock, fmtDuration, timeControl, useClock } from "@/sim/simStore";
import type { ClockSnapshot } from "@/sim/simStore";
import { usePort } from "@/state/PortProvider";
import { useHudHidden } from "@/state/hudVisibility";

const REWIND_RATES = [-2, -8, -32];
const FORWARD_RATES = [2, 8, 32];
const TICK_EVERY = 15 * 60;

const TONE_BG = { brick: "bg-brick", amber: "bg-amber", moss: "bg-moss", harbor: "bg-harbor" } as const;

const nextRate = (list: number[], current: number): number => {
  const i = list.indexOf(current);
  return i === -1 ? list[0] : list[(i + 1) % list.length];
};

/** Human label for the current playback mode. */
function modeLabel(s: ClockSnapshot): string {
  if (s.live) return "Live";
  if (s.rate === 0) return "Paused";
  if (s.rate < 0) return `Rewinding ×${-s.rate}`;
  if (s.rate > 1) return `Fast-forward ×${s.rate}`;
  return "Replay";
}

function TBtn({ label, onClick, disabled, active, className, children }: { label: string; onClick: () => void; disabled?: boolean; active?: boolean; className?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "relative grid h-10 w-10 place-items-center rounded-[10px] text-ink transition-[background-color,transform] hover:bg-sand active:scale-90 disabled:pointer-events-none disabled:opacity-30 lg:h-9 lg:w-9",
        active && "bg-signal-soft text-[#B8441A] hover:bg-signal-soft",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Scrubber({ compact = false }: { compact?: boolean }) {
  const snap = useClock();
  const { open } = usePort();
  const track = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const drag = useRef<{ resume: boolean } | null>(null);
  const [hover, setHover] = useState<{ t: number; x: number } | null>(null);
  const span = Math.max(1, snap.liveT - MIN_T);
  const pctOf = (t: number): string => `${Math.max(0, Math.min(1, (t - MIN_T) / span)) * 100}%`;

  // The playhead is driven every frame so it glides smoothly between store ticks.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const s = clockSnapshot();
      const p = Math.max(0, Math.min(1, (s.t - MIN_T) / Math.max(1, s.liveT - MIN_T)));
      const w = `${p * 100}%`;
      if (fill.current) fill.current.style.width = w;
      if (head.current) head.current.style.left = w;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const tAt = (clientX: number): { t: number; x: number } => {
    const r = track.current?.getBoundingClientRect();
    if (!r) return { t: 0, x: 0 };
    const k = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    return { t: MIN_T + k * (clockSnapshot().liveT - MIN_T), x: k * r.width };
  };

  const scrubTo = (clientX: number) => {
    const edge = clockSnapshot().liveT;
    timeControl.seek(Math.min(tAt(clientX).t, edge - 1));
  };

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-marker]")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const s = clockSnapshot();
    drag.current = { resume: s.live || s.rate !== 0 };
    timeControl.pause();
    scrubTo(e.clientX);
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    setHover(tAt(e.clientX));
    if (drag.current) scrubTo(e.clientX);
  };
  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const { resume } = drag.current;
    drag.current = null;
    const { t } = tAt(e.clientX);
    if (t >= clockSnapshot().liveT - 3) timeControl.goLive();
    else if (resume) timeControl.play();
  };

  const ticks: number[] = [];
  const first = Math.ceil((SIM_START_SEC + MIN_T) / TICK_EVERY) * TICK_EVERY;
  for (let a = first; a <= SIM_START_SEC + snap.liveT; a += TICK_EVERY) ticks.push(a - SIM_START_SEC);
  const events = TIMELINE_EVENTS.filter((ev) => ev.t <= snap.liveT);

  return (
    <div className={cn("relative min-w-0 flex-1 select-none", !compact && "pt-1")}>
      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label="Timeline"
        aria-valuemin={0}
        aria-valuemax={Math.round(span)}
        aria-valuenow={Math.round(snap.t - MIN_T)}
        aria-valuetext={fmtClock(SIM_START_SEC + snap.t, true)}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            e.stopPropagation();
            timeControl.step((e.key === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 60 : 10));
          } else if (e.key === "End") {
            e.preventDefault();
            timeControl.goLive();
          }
        }}
        className={cn("group relative flex cursor-pointer touch-none items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ink/40", compact ? "h-9" : "h-7")}
      >
        <div className="pw-hatch absolute inset-x-0 h-[6px] overflow-hidden rounded-full bg-sand transition-[height] group-hover:h-[8px]">
          <div ref={fill} className={cn("h-full rounded-full", snap.live ? "bg-moss" : "bg-ink")} />
        </div>
        {ticks.map((t) => (
          <span key={t} className="pointer-events-none absolute top-1/2 h-3 w-px -translate-y-1/2 bg-paper" style={{ left: pctOf(t) }} aria-hidden="true" />
        ))}
        {events.map((ev) => (
          <button
            key={ev.id}
            type="button"
            data-marker
            onClick={() => {
              timeControl.seek(ev.t - 4);
              open(ev.target);
            }}
            className={cn("group/m absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2", compact ? "p-2" : "p-1")}
            style={{ left: pctOf(ev.t) }}
            aria-label={`${fmtClock(SIM_START_SEC + ev.t)} · ${ev.label}`}
          >
            <span className={cn("block h-3 w-3 rotate-45 rounded-[3px] border-2 border-paper shadow-sm transition-transform group-hover/m:scale-125", TONE_BG[ev.tone])} />
            <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-[8px] bg-ink px-2.5 py-1.5 text-left text-[11.5px] font-semibold text-paper shadow-panel group-hover/m:block">
              <span className="mr-1.5 font-mono text-paper/70">{fmtClock(SIM_START_SEC + ev.t)}</span>
              {ev.label}
            </span>
          </button>
        ))}
        <div ref={head} className="pointer-events-none absolute top-1/2 z-20 -translate-x-1/2 -translate-y-1/2" aria-hidden="true">
          <span className={cn("block h-[18px] w-[18px] rounded-full border-[3px] border-paper shadow-panel transition-transform group-active:scale-110", snap.live ? "bg-moss" : "bg-signal")} />
        </div>
        {hover ? (
          <span className="pointer-events-none absolute bottom-full z-30 mb-1 -translate-x-1/2 rounded-md bg-ink px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-paper tnum" style={{ left: hover.x }}>
            {fmtClock(SIM_START_SEC + hover.t, true)}
          </span>
        ) : null}
      </div>
      <div className={cn("pointer-events-none relative h-3.5", compact ? "hidden" : "hidden sm:block")} aria-hidden="true">
        {ticks.map((t) => (
          <span key={t} className="absolute top-0 -translate-x-1/2 font-mono text-[10px] text-slate tnum" style={{ left: pctOf(t) }}>
            {fmtClock(SIM_START_SEC + t)}
          </span>
        ))}
        <span className="absolute right-0 top-0 font-mono text-[10px] font-bold text-moss">NOW</span>
      </div>
    </div>
  );
}

/** Global playback shortcuts (Space, ←/→, L). Mounted once, independent of which time bar layout is showing. */
export function TimeKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, button, a, [contenteditable='true'], [role='dialog']")) return;
      if (e.code === "Space") {
        e.preventDefault();
        timeControl.toggle();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        timeControl.step(e.shiftKey ? -60 : -10);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        timeControl.step(e.shiftKey ? 60 : 10);
      } else if (e.key.toLowerCase() === "l") {
        timeControl.goLive();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}

function PlayButton({ playing }: { playing: boolean }) {
  return (
    <button
      type="button"
      onClick={() => timeControl.toggle()}
      aria-label={playing ? "Pause (Space)" : "Play (Space)"}
      title={playing ? "Pause (Space)" : "Play (Space)"}
      className="mx-1 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-paper shadow-panel transition-[transform,background-color] hover:bg-ink/90 active:scale-90"
    >
      {playing ? <Pause className="h-[18px] w-[18px] fill-current" /> : <Play className="ml-0.5 h-[18px] w-[18px] fill-current" />}
    </button>
  );
}

function ClockReadout({ snap, className }: { snap: ClockSnapshot; className?: string }) {
  return (
    <div className={cn("shrink-0 leading-tight", className)} aria-live="off">
      <p className="font-mono text-[15px] font-bold text-ink tnum lg:text-[16px]">{fmtClock(SIM_START_SEC + snap.t, true)}</p>
      <p className={cn("truncate text-[11px] font-semibold", snap.live ? "text-moss" : snap.rate === 0 ? "text-slate" : "text-[#B8441A]")}>{modeLabel(snap)}</p>
    </div>
  );
}

function LiveState({ snap, short }: { snap: ClockSnapshot; short?: boolean }) {
  const behind = Math.max(0, snap.liveT - snap.t);
  if (snap.live) {
    return (
      <span className="flex h-9 shrink-0 items-center gap-2 rounded-full bg-moss-soft px-3 text-[12.5px] font-bold text-moss">
        <span className="h-2 w-2 rounded-full bg-moss pw-blink" />
        Live
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => timeControl.goLive()}
      title="Jump to live (L)"
      aria-label={`Go live, ${fmtDuration(behind)} behind`}
      className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-signal px-3.5 text-[12.5px] font-bold text-white shadow-panel transition-transform hover:brightness-105 active:scale-95 lg:h-9 lg:px-3"
    >
      <Radio className="h-4 w-4" />
      <span className={cn(short ? "inline" : "hidden sm:inline")}>Go live</span>
      <span className={cn("font-mono text-[11px] font-semibold text-white/80", short ? "hidden min-[400px]:inline" : "hidden lg:inline")}>−{fmtDuration(behind)}</span>
    </button>
  );
}

/**
 * Playback controls used inside the phone/tablet bottom sheet header.
 * `stacked` (phones, landscape dock): scrubber on top, transport row below, like a media player.
 */
export function TimeControls({ stacked }: { stacked: boolean }) {
  const snap = useClock();
  const playing = snap.live || snap.rate !== 0;
  const transport = (
    <div className="flex shrink-0 items-center" role="toolbar" aria-label="Playback">
      <TBtn label="Back 30 seconds" onClick={() => timeControl.step(-30)} className={stacked ? "max-[399px]:hidden" : ""}>
        <StepBack className="h-[17px] w-[17px]" />
      </TBtn>
      <TBtn label={snap.rate < 0 ? `Rewind faster (×${-nextRate(REWIND_RATES, snap.rate)})` : "Rewind"} active={snap.rate < 0} onClick={() => timeControl.setRate(nextRate(REWIND_RATES, snap.rate))}>
        <Rewind className="h-[17px] w-[17px]" />
      </TBtn>
      <PlayButton playing={playing} />
      <TBtn label={snap.live ? "Already live" : `Fast-forward (×${nextRate(FORWARD_RATES, snap.rate)})`} disabled={snap.live} active={snap.rate > 1} onClick={() => timeControl.setRate(nextRate(FORWARD_RATES, snap.rate))}>
        <FastForward className="h-[17px] w-[17px]" />
      </TBtn>
      <TBtn label="Forward 30 seconds" disabled={snap.live} onClick={() => timeControl.step(30)} className={stacked ? "max-[399px]:hidden" : ""}>
        <StepForward className="h-[17px] w-[17px]" />
      </TBtn>
    </div>
  );

  if (stacked) {
    return (
      <div role="region" aria-label="Time controls" className="flex flex-col px-3 pb-1.5">
        <Scrubber compact />
        <div className="flex items-center gap-2">
          {transport}
          <ClockReadout snap={snap} className="ml-1 min-w-0" />
          <div className="ml-auto">
            <LiveState snap={snap} short />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div role="region" aria-label="Time controls" className="flex h-[60px] items-center gap-3 px-3">
      {transport}
      <ClockReadout snap={snap} className="w-[84px]" />
      <Scrubber compact />
      <LiveState snap={snap} />
    </div>
  );
}

/** Desktop bottom playback bar: pause, rewind, fast-forward and scrub the whole 3D port through the last hour. */
export function TimeBar() {
  const snap = useClock();
  const playing = snap.live || snap.rate !== 0;
  const hudHidden = useHudHidden();

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-4 bottom-[max(16px,var(--sab))] z-20 transition-[opacity,transform,visibility] duration-300",
        hudHidden && "invisible translate-y-6 opacity-0",
      )}
    >
      <div role="region" aria-label="Time controls" className="panel pw-rise pointer-events-auto flex h-[60px] items-center gap-4 px-3.5">
        <div className="flex shrink-0 items-center gap-0.5" role="toolbar" aria-label="Playback">
          <TBtn label="Back 30 seconds" onClick={() => timeControl.step(-30)} className="hidden sm:grid">
            <StepBack className="h-[17px] w-[17px]" />
          </TBtn>
          <TBtn label={snap.rate < 0 ? `Rewind faster (×${-nextRate(REWIND_RATES, snap.rate)})` : "Rewind"} active={snap.rate < 0} onClick={() => timeControl.setRate(nextRate(REWIND_RATES, snap.rate))}>
            <Rewind className="h-[17px] w-[17px]" />
          </TBtn>
          <PlayButton playing={playing} />
          <TBtn label={snap.live ? "Already live" : `Fast-forward (×${nextRate(FORWARD_RATES, snap.rate)})`} disabled={snap.live} active={snap.rate > 1} onClick={() => timeControl.setRate(nextRate(FORWARD_RATES, snap.rate))}>
            <FastForward className="h-[17px] w-[17px]" />
          </TBtn>
          <TBtn label="Forward 30 seconds" disabled={snap.live} onClick={() => timeControl.step(30)} className="hidden sm:grid">
            <StepForward className="h-[17px] w-[17px]" />
          </TBtn>
        </div>

        <ClockReadout snap={snap} className="w-[92px]" />

        <Scrubber />

        <LiveState snap={snap} />
      </div>
    </div>
  );
}
