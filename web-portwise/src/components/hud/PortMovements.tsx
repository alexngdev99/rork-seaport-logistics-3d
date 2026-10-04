import { ArrowDownLeft, ArrowUpRight, Anchor, Waves } from "lucide-react";
import { VESSELS } from "@/data/port";
import { cn } from "@/lib/utils";
import { PORT_CALLS, PORT_EVENTS } from "@/sim/ais/portCalls";
import type { VoyagePhase } from "@/sim/ais/voyage";
import { MIN_T, SIM_START_SEC, fmtClock, sim, simT, timeControl, useSimTick } from "@/sim/simStore";
import { usePort } from "@/state/PortProvider";
import { Panel, StatusChip } from "./primitives";
import type { Tone } from "./primitives";

const PHASE: Record<VoyagePhase, { label: string; tone: Tone }> = {
  inbound: { label: "Inbound", tone: "harbor" },
  anchored: { label: "At anchor", tone: "amber" },
  berthing: { label: "Berthing", tone: "harbor" },
  alongside: { label: "Alongside", tone: "moss" },
  unberthing: { label: "Unberthing", tone: "harbor" },
  outbound: { label: "Outbound", tone: "harbor" },
  sailed: { label: "Sailed", tone: "slate" },
};

const STEPS: Record<"arrival" | "departure", VoyagePhase[]> = {
  arrival: ["inbound", "anchored", "berthing", "alongside"],
  departure: ["alongside", "unberthing", "outbound", "sailed"],
};

const DOT: Record<string, string> = { harbor: "bg-harbor", moss: "bg-moss", amber: "bg-amber", brick: "bg-brick" };

/** VTS-style list of this morning's arrivals and departures, driven by the AIS port-call simulation. */
export function PortMovements() {
  useSimTick();
  const { open } = usePort();
  const t = simT();
  const log = PORT_EVENTS.filter((e) => e.t <= t && e.t >= MIN_T - 600)
    .slice()
    .reverse()
    .slice(0, 6);

  return (
    <Panel className="w-full p-4" aria-label="Port movements">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[16px] font-bold text-ink">Port movements</h2>
        <span className="flex items-center gap-1.5 text-[11.5px] text-slate">
          <Waves className="h-3.5 w-3.5 text-harbor" /> VTS · AIS
        </span>
      </div>
      <ul className="mt-2 space-y-1">
        {PORT_CALLS.map((c) => {
          const v = VESSELS.find((x) => x.id === c.id);
          const live = sim.calls[c.id];
          if (!v || !live) return null;
          const ph = PHASE[live.phase];
          const steps = STEPS[c.kind];
          const idx = Math.max(0, steps.indexOf(live.phase === "anchored" && c.kind === "departure" ? "alongside" : live.phase));
          const Icon = c.kind === "arrival" ? ArrowDownLeft : ArrowUpRight;
          const moving = live.phase === "inbound" || live.phase === "outbound" || live.phase === "berthing" || live.phase === "unberthing";
          return (
            <li key={c.id}>
              <button type="button" onClick={() => open({ kind: "vessel", id: c.id })} className="w-full rounded-[11px] px-2 py-2 text-left transition-colors hover:bg-sand/70">
                <span className="flex items-center gap-2.5">
                  <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-[9px]", c.kind === "arrival" ? "bg-harbor-soft text-harbor" : "bg-signal-soft text-[#B8441A]")}>
                    {live.phase === "anchored" ? <Anchor className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-bold text-ink">{v.short}</span>
                      <span className="font-mono text-[11px] text-slate tnum">{c.kind === "arrival" ? `→ Berth ${c.berth}` : `Berth ${c.berth} →`}</span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-2">
                      <StatusChip tone={live.lost ? "brick" : ph.tone} pulse={moving}>
                        {live.lost ? "AIS lost" : ph.label}
                        {moving ? ` · ${live.sog.toFixed(1)} kn` : ""}
                      </StatusChip>
                      {live.etaSec !== null ? (
                        <span className="truncate font-mono text-[11px] text-slate tnum">
                          {live.etaLabel} {fmtClock(live.etaSec)}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </span>
                <span className="mt-2 flex gap-1 pl-[42px]" aria-hidden="true">
                  {steps.map((s, i) => (
                    <span key={s} className={cn("h-1 flex-1 rounded-full", i < idx ? "bg-ink/70" : i === idx ? (c.kind === "arrival" ? "bg-harbor" : "bg-signal") : "bg-sand")} />
                  ))}
                </span>
                <span className="mt-1 flex justify-between pl-[42px] text-[9.5px] font-semibold uppercase tracking-[0.08em] text-slate/80">
                  {steps.map((s) => (
                    <span key={s}>{PHASE[s].label}</span>
                  ))}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="eyebrow mt-3 pb-1">Movement log</p>
      <ol className="space-y-0.5">
        {log.map((e, i) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => {
                timeControl.seek(e.t - 4);
                open({ kind: "vessel", id: e.vesselId });
              }}
              className={cn("flex w-full gap-2.5 rounded-[8px] px-1.5 py-1.5 text-left text-[12px] hover:bg-sand/70", i === 0 && "pw-rise")}
            >
              <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", DOT[e.tone])} />
              <span className="shrink-0 font-mono text-slate tnum">{fmtClock(SIM_START_SEC + e.t)}</span>
              <span className="text-ink">{e.text}</span>
            </button>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
