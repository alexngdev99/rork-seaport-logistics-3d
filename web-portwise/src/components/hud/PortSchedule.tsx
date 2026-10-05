import { memo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronDown, CloudLightning, TimerReset } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { portSchedule, scheduleSummary } from "@/sim/schedule";
import type { Movement, MoveKind } from "@/sim/schedule";
import { SIM_START_SEC, fmtClock, simT, useSimTick } from "@/sim/simStore";
import { useEnv } from "@/state/environment";
import { usePort } from "@/state/PortProvider";
import { Panel, ProgressBar, StatusChip } from "./primitives";

type Filter = "all" | MoveKind;

const DAY = 86400;
const UPCOMING_LIMIT = 6;
const EARLIER_SHOWN = 2;

const clock = (sec: number): string => `${fmtClock(sec)}${sec >= DAY ? "⁺¹" : ""}`;

/** "in 12:04" under an hour, else "in 3 h 36 min". */
function countdown(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  if (s < 3600) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h} h ${String(m).padStart(2, "0")} min`;
}

function delayTone(m: Movement): "moss" | "amber" | "brick" {
  if (m.delayMin >= 30) return "brick";
  if (m.delayMin >= 10) return "amber";
  return "moss";
}

const DELAY_TEXT: Record<"moss" | "amber" | "brick", string> = { moss: "text-moss", amber: "text-[#9A6A08]", brick: "text-brick" };

function delayLabel(m: Movement): string {
  if (Math.abs(m.delayMin) < 5) return "On time";
  return m.delayMin > 0 ? `+${m.delayMin} min` : `${m.delayMin} min early`;
}

const Row = memo(function Row({ m, faded, highlight }: { m: Movement; faded?: boolean; highlight?: boolean }) {
  const { open, setHovered } = usePort();
  const isArrival = m.kind === "arrival";
  const Icon = isArrival ? ArrowDownLeft : ArrowUpRight;
  const shown = m.actual ?? m.est;
  const slipped = Math.abs(m.delayMin) >= 5;
  const dTone = delayTone(m);
  const onClick = () => {
    if (m.vesselId) open({ kind: "vessel", id: m.vesselId });
    else toast(`${m.name} · ${m.line} · Berth ${m.berth} · ${isArrival ? "from" : "to"} ${m.port}`);
  };
  return (
    <li id={`sched-${m.id}`} className={cn("rounded-[11px]", highlight && "ring-1 ring-harbor/30")}>
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => m.vesselId && setHovered({ kind: "vessel", id: m.vesselId })}
        onMouseLeave={() => setHovered(null)}
        className={cn("group grid w-full grid-cols-[52px_1fr] gap-x-2.5 rounded-[11px] px-2 py-2 text-left transition-colors hover:bg-sand/70", faded && "opacity-60 hover:opacity-100")}
      >
        <span className="flex flex-col items-start pt-px">
          <span className={cn("font-mono text-[15px] font-bold leading-none tnum", m.done ? "text-slate" : slipped && m.delayMin > 0 ? DELAY_TEXT[dTone] : "text-ink")}>{clock(shown)}</span>
          {slipped ? <span className="mt-1 font-mono text-[10.5px] leading-none text-slate/80 line-through tnum">{clock(m.planned)}</span> : null}
          <span className={cn("mt-1.5 inline-flex items-center gap-0.5 text-[9.5px] font-bold uppercase tracking-[0.08em]", isArrival ? "text-harbor" : "text-[#B8441A]")}>
            <Icon className="h-3 w-3" />
            {m.done ? (isArrival ? "ATB" : "ATD") : isArrival ? "ETB" : "ETD"}
          </span>
        </span>
        <span className="min-w-0">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-[13px] font-bold text-ink">{m.short}</span>
            <span className="shrink-0 font-mono text-[11px] text-slate tnum">B{m.berth}</span>
          </span>
          <span className="mt-0.5 block truncate text-[11.5px] text-slate">
            {isArrival ? "from" : "to"} {m.port} · {m.line}
          </span>
          <span className="mt-1.5 flex items-center gap-2">
            <StatusChip tone={m.tone} pulse={m.moving}>
              {m.status}
            </StatusChip>
            {!m.done || slipped ? <span className={cn("shrink-0 font-mono text-[11px] font-semibold tnum", DELAY_TEXT[dTone])}>{delayLabel(m)}</span> : null}
          </span>
          {m.progress !== null && !m.done ? <ProgressBar value={m.progress} tone={m.tone === "signal" ? "signal" : m.tone === "harbor" ? "harbor" : "moss"} height="h-1" className="mt-2" live={m.moving} /> : null}
          {m.delayReason && !m.done && m.delayMin >= 5 ? <span className="mt-1.5 block truncate text-[11px] text-slate">{m.delayReason}</span> : null}
        </span>
      </button>
    </li>
  );
});

/**
 * Live arrivals/departures board for today: planned vs. estimated berthing and sailing times,
 * delays (scripted plus weather knock-on), cargo/approach progress and a countdown to the next move.
 */
export function PortSchedule() {
  useSimTick();
  useEnv();
  const [filter, setFilter] = useState<Filter>("all");
  const [showEarlier, setShowEarlier] = useState<boolean>(false);
  const [showAll, setShowAll] = useState<boolean>(false);

  const now = SIM_START_SEC + simT();
  const all = portSchedule(simT());
  const summary = scheduleSummary(all);
  const list = filter === "all" ? all : all.filter((m) => m.kind === filter);
  const done = list.filter((m) => m.done);
  const upcoming = list.filter((m) => !m.done);
  const earlier = showEarlier ? done : done.slice(-EARLIER_SHOWN);
  const next = upcoming.find((m) => m.est > now);
  const nextMoving = upcoming.find((m) => m.moving);
  const visibleUpcoming = showAll ? upcoming : upcoming.slice(0, UPCOMING_LIMIT);
  const counts: Record<Filter, number> = { all: all.length, arrival: all.filter((m) => m.kind === "arrival").length, departure: all.filter((m) => m.kind === "departure").length };
  const weatherDelays = upcoming.filter((m) => m.delayReason && /hold|Rain|Pilot|visibility/.test(m.delayReason)).length;

  return (
    <Panel className="w-full p-3" aria-label="Arrivals and departures">
      <div className="flex items-baseline justify-between px-2 pt-1">
        <h2 className="text-[16px] font-bold text-ink">Arrivals & departures</h2>
        <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-moss">
          <span className="h-1.5 w-1.5 rounded-full bg-moss pw-blink" /> Live
        </span>
      </div>

      <dl className="mt-2.5 grid grid-cols-4 gap-1 px-1">
        {[
          { k: "Arrivals", v: String(summary.arrivalsLeft), sub: "to come" },
          { k: "Sailings", v: String(summary.departuresLeft), sub: "to go" },
          { k: "On time", v: `${Math.round(summary.onTimePct)}%`, sub: "today" },
          { k: "Delayed", v: String(summary.delayed), sub: "≥ 10 min", warn: summary.delayed > 0 },
        ].map((s) => (
          <div key={s.k} className="rounded-[10px] bg-sand/60 px-2 py-2">
            <dt className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-slate">{s.k}</dt>
            <dd className={cn("mt-0.5 font-mono text-[17px] font-bold leading-tight tnum", s.warn ? "text-brick" : "text-ink")}>{s.v}</dd>
            <dd className="text-[10px] text-slate">{s.sub}</dd>
          </div>
        ))}
      </dl>

      {next ? (
        <button
          type="button"
          onClick={() => document.getElementById(`sched-${next.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" })}
          className="mx-1 mt-2.5 flex w-[calc(100%-8px)] items-center gap-3 rounded-[11px] bg-ink px-3 py-2.5 text-left text-paper"
        >
          <TimerReset className="h-[18px] w-[18px] shrink-0 text-amber" />
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-paper/60">Next {next.kind === "arrival" ? "berthing" : "sailing"}</span>
            <span className="block truncate text-[13px] font-bold">
              {next.short} · Berth {next.berth}
            </span>
          </span>
          <span className="text-right">
            <span className="block font-mono text-[15px] font-bold leading-none text-amber tnum">{countdown(next.est - now)}</span>
            <span className="mt-1 block font-mono text-[10.5px] text-paper/60 tnum">at {clock(next.est)}</span>
          </span>
        </button>
      ) : null}

      {weatherDelays > 0 ? (
        <p className="mx-1 mt-2 flex items-center gap-2 rounded-[10px] bg-amber-soft px-2.5 py-2 text-[11.5px] font-semibold text-[#9A6A08]">
          <CloudLightning className="h-4 w-4 shrink-0" /> Weather is pushing back {weatherDelays} {weatherDelays === 1 ? "movement" : "movements"}
        </p>
      ) : null}

      <div role="tablist" aria-label="Filter movements" className="mx-1 mt-2.5 grid grid-cols-3 gap-1 rounded-[10px] bg-sand/70 p-1">
        {(["all", "arrival", "departure"] as const).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={cn("h-8 rounded-[7px] text-[12px] font-semibold transition-colors", filter === f ? "bg-paper text-ink shadow-panel" : "text-slate hover:text-ink")}
          >
            {f === "all" ? "All" : f === "arrival" ? "Arrivals" : "Departures"} <span className="font-mono text-[11px] text-slate tnum">{counts[f]}</span>
          </button>
        ))}
      </div>

      {done.length > EARLIER_SHOWN ? (
        <button type="button" onClick={() => setShowEarlier((v) => !v)} className="mt-2 flex w-full items-center justify-center gap-1 py-1 text-[11.5px] font-semibold text-slate hover:text-ink">
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !showEarlier && "rotate-180")} />
          {showEarlier ? "Hide earlier" : `${done.length - EARLIER_SHOWN} earlier today`}
        </button>
      ) : null}
      <ul className="mt-1 space-y-0.5">
        {earlier.map((m) => (
          <Row key={m.id} m={m} faded />
        ))}
      </ul>

      <div className="relative my-1.5 flex items-center gap-2 px-2" aria-hidden="true">
        <span className="h-[2px] flex-1 rounded-full bg-signal/70" />
        <span className="rounded-full bg-signal px-2 py-0.5 font-mono text-[11px] font-bold text-white tnum">Now {fmtClock(now)}</span>
        <span className="h-[2px] flex-1 rounded-full bg-signal/70" />
      </div>

      <ul className="space-y-0.5">
        {visibleUpcoming.map((m) => (
          <Row key={m.id} m={m} highlight={nextMoving?.id === m.id} />
        ))}
      </ul>
      {upcoming.length > UPCOMING_LIMIT ? (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-1 flex w-full items-center justify-center gap-1 rounded-[9px] py-2 text-[12px] font-semibold text-harbor hover:bg-sand/70">
          {showAll ? "Show less" : `Show ${upcoming.length - UPCOMING_LIMIT} more`}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showAll && "rotate-180")} />
        </button>
      ) : null}
      {!upcoming.length ? <p className="px-2 py-3 text-center text-[12px] text-slate">No more movements today.</p> : null}
    </Panel>
  );
}
