import { useEffect } from "react";
import { Check, Ship } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { VESSELS } from "@/data/port";
import { SHIP_CLASSES, shipClassMeta } from "@/data/shipClasses";
import type { ShipClass } from "@/data/shipClasses";
import { TRANSITS } from "@/sim/ais/portCalls";
import { shipFilter, useShipFilter } from "@/state/shipFilter";
import type { ShipFilter } from "@/state/shipFilter";
import { cn } from "@/lib/utils";

/** Ships of each type in the scene: terminal calls are all container ships; the bunker jetty holds one tanker. */
const COUNTS: Record<ShipClass, number> = {
  container: VESSELS.filter((v) => v.inScene).length + TRANSITS.filter((t) => t.cls === "container").length,
  tanker: TRANSITS.filter((t) => t.cls === "tanker").length + 1,
  bulk: TRANSITS.filter((t) => t.cls === "bulk").length,
};
const TOTAL = COUNTS.container + COUNTS.tanker + COUNTS.bulk;

const isTypingTarget = (e: KeyboardEvent): boolean =>
  Boolean((e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable='true'], [role='dialog']"));

/** Side-on hull silhouette, so each option reads at a glance. */
function Silhouette({ cls, color, className }: { cls: ShipClass | "all"; color: string; className?: string }) {
  const hull = <path d="M2 15h40l-3.6 5H6.2z" fill={color} />;
  const house = <path d="M5 7.5h5V15H5z M6 5h3v2.5H6z" fill={color} opacity={0.85} />;
  return (
    <svg viewBox="0 0 44 22" className={className} aria-hidden="true">
      {cls === "container" || cls === "all" ? (
        <g fill={color}>
          {[13, 18, 23, 28, 33].map((x, i) => (
            <rect key={x} x={x} y={i % 2 ? 9 : 7} width={4.3} height={i % 2 ? 6 : 8} rx={0.5} opacity={i % 2 ? 0.55 : 0.8} />
          ))}
        </g>
      ) : null}
      {cls === "tanker" ? (
        <g fill={color}>
          <rect x={12} y={12.6} width={27} height={2.4} rx={0.6} opacity={0.6} />
          <rect x={24} y={9.5} width={1.2} height={3.4} />
          <path d="M24.6 9.6l6 1.6-.4.8-5.8-1.2z" />
        </g>
      ) : null}
      {cls === "bulk" ? (
        <g fill={color}>
          {[13, 20, 27, 34].map((x) => (
            <rect key={x} x={x} y={11.6} width={5.2} height={3.4} rx={0.6} opacity={0.65} />
          ))}
          <rect x={18.6} y={6} width={1.1} height={6} />
          <path d="M19.2 6.2l6.4-2.2.3.8-6.2 2.4z" />
          <rect x={32.6} y={6} width={1.1} height={6} />
          <path d="M33.2 6.2l-6.4-2.2-.3.8 6.2 2.4z" />
        </g>
      ) : null}
      {house}
      {hull}
    </svg>
  );
}

interface OptionProps {
  id: ShipFilter;
  label: string;
  blurb: string;
  count: number;
  color: string;
  isActive: boolean;
}

function Option({ id, label, blurb, count, color, isActive }: OptionProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isActive}
      onClick={() => shipFilter.set(id)}
      className={cn(
        "flex w-full items-center gap-3 rounded-[12px] border px-2.5 py-2 text-left transition-[background-color,border-color] duration-200",
        isActive ? "border-ink bg-ink text-paper" : "border-transparent hover:bg-sand",
      )}
    >
      <span className={cn("grid h-10 w-12 shrink-0 place-items-center rounded-[9px]", isActive ? "bg-white/10" : "bg-sand")}>
        <Silhouette cls={id === "all" ? "all" : id} color={color} className="h-[22px] w-11" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-bold leading-tight">{label}</span>
        <span className={cn("mt-0.5 block truncate text-[11.5px]", isActive ? "text-paper/65" : "text-slate")}>{blurb}</span>
      </span>
      <span className={cn("font-mono text-[13px] font-bold tnum", isActive ? "text-paper" : "text-ink")}>{count}</span>
      <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full border", isActive ? "border-transparent bg-signal text-white" : "border-hairline")}>
        {isActive ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
      </span>
    </button>
  );
}

/**
 * Camera-rail control that narrows the 3D map to one hull type (container ships, tankers or bulk carriers).
 * Paper square when all ships show; an ink pill naming the active type when filtered. Shortcut: T cycles.
 */
export function ShipTypeFilter() {
  const filter = useShipFilter();
  const meta = filter === "all" ? null : shipClassMeta(filter);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.key.toLowerCase() !== "t" || isTypingTarget(e)) return;
      shipFilter.cycle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const label = meta ? `Showing ${meta.label.toLowerCase()} only (T)` : "Filter ships by type (T)";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          data-haptic="medium"
          className={cn(
            "flex h-11 items-center justify-center gap-2 rounded-[14px] border shadow-panel transition-[background-color,border-color,width,transform] duration-300 active:scale-95",
            meta ? "border-ink bg-ink pl-2.5 pr-3.5 text-paper hover:bg-[#1C3157]" : "w-11 border-hairline bg-paper text-ink hover:bg-sand",
          )}
        >
          {meta ? (
            <>
              <Silhouette key={meta.id} cls={meta.id} color={meta.onInk} className="h-[18px] w-9 pw-rise" />
              <span className="whitespace-nowrap text-[13px] font-semibold">{meta.short}</span>
              <span className="font-mono text-[11.5px] text-paper/60 tnum">{COUNTS[meta.id]}</span>
            </>
          ) : (
            <Ship className="h-[18px] w-[18px]" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="left"
        align="start"
        sideOffset={10}
        collisionPadding={12}
        className="w-[min(320px,calc(100vw-80px))] rounded-[18px] border-hairline bg-paper p-3 text-ink shadow-lift"
      >
        <div className="px-1.5 pb-2 pt-0.5">
          <p className="eyebrow">Ships on the map</p>
          <p className="mt-0.5 text-[15px] font-bold">Show by type</p>
        </div>
        <div role="radiogroup" aria-label="Ship type" className="flex flex-col gap-1">
          <Option id="all" label="All ships" blurb="Every hull at the quay, at anchor and in the Strait" count={TOTAL} color={filter === "all" ? "#FFFDF8" : "#12233F"} isActive={filter === "all"} />
          {SHIP_CLASSES.map((c) => (
            <Option key={c.id} id={c.id} label={c.label} blurb={c.blurb} count={COUNTS[c.id]} color={filter === c.id ? c.onInk : c.color} isActive={filter === c.id} />
          ))}
        </div>
        <p className="mt-2.5 border-t border-hairline px-1.5 pt-2.5 text-[11.5px] leading-snug text-slate">
          Cranes, yard and trucks stay visible. Press <span className="rounded-[5px] bg-sand px-1 font-mono text-[11px] font-semibold text-ink">T</span> to cycle types.
        </p>
      </PopoverContent>
    </Popover>
  );
}
