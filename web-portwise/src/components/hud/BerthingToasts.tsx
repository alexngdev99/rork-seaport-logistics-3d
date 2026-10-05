import { memo, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { ArrowRight, X } from "lucide-react";
import { Toaster, toast } from "sonner";
import { VESSELS } from "@/data/port";
import type { Selection } from "@/data/types";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { portSchedule } from "@/sim/schedule";
import type { Movement } from "@/sim/schedule";
import { SIM_START_SEC, clockSnapshot, fmtClock, useSimTick } from "@/sim/simStore";
import { usePort } from "@/state/PortProvider";

/*
 * Small paper toasts announcing each ship that has just finished berthing ("all fast").
 * Berthings come from the arrivals board (`portSchedule`), so they follow AIS, weather slips and replay:
 * a toast fires when the sim clock plays forward across a berthing, never on a seek or scrub jump.
 */

/** The HUD's paper toaster (top-centre under the top bar); other in-map notices post here too. */
export const HUD_TOASTER_ID = "berthing";
const TOASTER_ID = HUD_TOASTER_ID;
const DURATION_MS = 7000;
/** Largest forward step (sim s) between ticks still treated as playback (×32 ticks ≈ 8 s). */
const MAX_STEP = 20;
/** A berthing older than this when first seen is stale (e.g. a weather slip resolving), so no toast. */
const FRESH = 180;

interface BerthNote {
  vesselId?: string;
  short: string;
  line: string;
  port: string;
  berth: number;
  atSec: number;
  delayMin: number;
  cranes: string[];
  hull: string;
  isReplay: boolean;
}

type DelayTone = "moss" | "amber" | "brick";

const DELAY_CHIP: Record<DelayTone, string> = {
  moss: "bg-moss-soft text-moss",
  amber: "bg-amber-soft text-[#9A6A08]",
  brick: "bg-brick-soft text-brick",
};

const delayTone = (min: number): DelayTone => (min >= 30 ? "brick" : min >= 10 ? "amber" : "moss");
const delayText = (min: number): string => (Math.abs(min) < 5 ? "On time" : min > 0 ? `+${min} min` : `${-min} min early`);

/** Top-down vignette: the hull slides onto the quay, lines go out, a check pops. */
function BerthArt({ hull }: { hull: string }) {
  return (
    <span className="relative block h-[52px] w-[52px] shrink-0 overflow-hidden rounded-[11px] bg-harbor-soft" aria-hidden="true">
      <svg viewBox="0 0 52 52" className="h-full w-full">
        <path d="M6 18h10M4 26h8M7 34h9" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
        <rect x="40" y="0" width="12" height="52" fill="#D9D3C6" />
        <rect x="40" y="0" width="1.2" height="52" fill="#12233F" opacity="0.55" />
        <circle cx="44.5" cy="8" r="1.4" fill="#12233F" />
        <circle cx="44.5" cy="44" r="1.4" fill="#12233F" />
        <path className="pw-line-draw" d="M38.5 14 L44.5 8" stroke="#12233F" strokeWidth="0.9" fill="none" />
        <path className="pw-line-draw" d="M38.5 38 L44.5 44" stroke="#12233F" strokeWidth="0.9" fill="none" />
        <g transform="translate(27 9)">
          <g className="pw-berth-in">
            <path d="M6 0 C11 4 12 8 12 12 L12 34 L0 34 L0 12 C0 8 1 4 6 0 Z" fill={hull} />
            <rect x="2" y="10" width="3.6" height="3" rx="0.4" fill="#F2622E" />
            <rect x="6.4" y="10" width="3.6" height="3" rx="0.4" fill="#EDEBE4" />
            <rect x="2" y="14" width="3.6" height="3" rx="0.4" fill="#D9B26A" />
            <rect x="6.4" y="14" width="3.6" height="3" rx="0.4" fill="#F2622E" />
            <rect x="2" y="18" width="3.6" height="3" rx="0.4" fill="#4E7A5A" />
            <rect x="6.4" y="18" width="3.6" height="3" rx="0.4" fill="#4F6D8F" />
            <rect x="2" y="22" width="3.6" height="3" rx="0.4" fill="#EDEBE4" />
            <rect x="6.4" y="22" width="3.6" height="3" rx="0.4" fill="#B5463A" />
            <rect x="2.5" y="27.5" width="7" height="4" rx="0.6" fill="#FFFDF8" />
          </g>
        </g>
        <g className="pw-pop">
          <circle cx="11" cy="42" r="6.5" fill="#2F8F6B" stroke="#FFFDF8" strokeWidth="1.5" />
          <path d="M8 42.2 L10.2 44.4 L14.2 40" stroke="#FFFFFF" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    </span>
  );
}

const BerthToast = memo(function BerthToast({ note, onView, onClose }: { note: BerthNote; onView?: () => void; onClose: () => void }) {
  const tone = delayTone(note.delayMin);
  return (
    <div className="pw-berth-toast relative w-full overflow-hidden rounded-[14px] border border-hairline bg-paper font-sans text-ink shadow-[0_14px_32px_-14px_rgba(18,35,63,0.4),0_2px_6px_-2px_rgba(18,35,63,0.12)]">
      <div className="flex gap-3 py-3 pl-3 pr-2.5">
        <BerthArt hull={note.hull} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-moss">
              <span className="h-1.5 w-1.5 rounded-full bg-moss pw-blink" />
              All fast · Berth {note.berth}
            </span>
            {note.isReplay ? <span className="rounded-full bg-sand px-1.5 py-px text-[9.5px] font-bold uppercase tracking-[0.1em] text-slate">Replay</span> : null}
            <button
              type="button"
              onClick={onClose}
              aria-label="Dismiss"
              className="-my-1 ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate transition-colors hover:bg-sand hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="truncate text-[14.5px] font-extrabold leading-tight">{note.short}</p>
          <p className="mt-0.5 truncate text-[11.5px] text-slate">
            {note.line} · from {note.port}
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="font-mono text-[11px] font-semibold text-ink tnum">
              <span className="text-slate">ATB </span>
              {fmtClock(note.atSec)}
            </span>
            <span className={cn("rounded-full px-1.5 py-px font-mono text-[10.5px] font-semibold tnum", DELAY_CHIP[tone])}>{delayText(note.delayMin)}</span>
            {note.cranes.length ? (
              <span className="hidden truncate rounded-full bg-signal-soft px-1.5 py-px font-mono text-[10.5px] font-semibold text-[#B8441A] min-[380px]:inline">{note.cranes.join(" ")}</span>
            ) : null}
            {onView ? (
              <button
                type="button"
                onClick={onView}
                className="-my-1 ml-auto inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-ink pl-2.5 pr-2 text-[11.5px] font-semibold text-paper transition-transform hover:bg-ink/90 active:scale-95"
              >
                View
                <ArrowRight className="h-3 w-3" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <span className="absolute inset-x-0 bottom-0 h-[3px] bg-sand">
        <span className="pw-toast-timer block h-full bg-moss" style={{ animationDuration: `${DURATION_MS}ms` }} />
      </span>
    </div>
  );
});

function noteOf(m: Movement, atT: number, isReplay: boolean): BerthNote {
  const v = m.vesselId ? VESSELS.find((x) => x.id === m.vesselId) : undefined;
  return {
    vesselId: m.vesselId,
    short: m.short,
    line: m.line,
    port: m.port,
    berth: m.berth,
    atSec: SIM_START_SEC + atT,
    delayMin: m.delayMin,
    cranes: v?.cranes ?? [],
    hull: v?.hull ?? "#1E3A66",
    isReplay,
  };
}

function announce(note: BerthNote, key: string, open: (sel: Selection) => void): void {
  haptic("success");
  toast.custom(
    (id) => (
      <BerthToast
        note={note}
        onClose={() => toast.dismiss(id)}
        onView={
          note.vesselId
            ? () => {
                open({ kind: "vessel", id: note.vesselId as string });
                toast.dismiss(id);
              }
            : undefined
        }
      />
    ),
    { id: key, toasterId: TOASTER_ID, duration: DURATION_MS },
  );
}

const TOASTER_STYLE = { "--width": "372px" } as CSSProperties;

/** Watches the sim clock for completed berthings and hosts their toaster (top-centre, under the top bar). */
export function BerthingToasts() {
  const tick = useSimTick();
  const { open } = usePort();
  const prevT = useRef<number | null>(null);
  const prevDone = useRef<Set<string>>(new Set());

  useEffect(() => {
    const { t, live } = clockSnapshot();
    const arrivals = portSchedule(t).filter((m) => m.kind === "arrival" && m.done);
    const was = prevDone.current;
    const prev = prevT.current;
    prevDone.current = new Set(arrivals.map((m) => m.id));
    prevT.current = t;
    if (prev === null) return;
    const dt = t - prev;
    if (dt <= 0 || dt > MAX_STEP) return;
    for (const m of arrivals) {
      if (was.has(m.id)) continue;
      const at = (m.actual ?? m.est) - SIM_START_SEC;
      if (at < prev - FRESH || at > t + 1) continue;
      announce(noteOf(m, at, !live), `berth:${m.id}:${Math.round(at)}`, open);
    }
  }, [tick, open]);

  return (
    <Toaster
      id={TOASTER_ID}
      theme="light"
      position="top-center"
      offset={{ top: "calc(var(--hud-top) + 12px)" }}
      mobileOffset={{ top: "calc(var(--hud-top) + 8px)", left: "12px", right: "12px" }}
      visibleToasts={3}
      gap={10}
      style={TOASTER_STYLE}
      containerAriaLabel="Port notifications"
    />
  );
}
