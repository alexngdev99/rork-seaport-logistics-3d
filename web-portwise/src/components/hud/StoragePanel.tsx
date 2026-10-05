import { memo, useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Snowflake } from "lucide-react";
import { cn } from "@/lib/utils";
import { SIM_START_SEC, fmtClock, fmtDuration } from "@/sim/constants";
import { fillTone, storageAt, unitShort } from "@/sim/storage";
import type { StorageEvent, StorageLive, ZoneStock } from "@/sim/storage";
import { StatusChip } from "./primitives";

const nf = new Intl.NumberFormat("en-US");
const pct = (v: number): string => `${Math.round(v * 100)}%`;
const fmtTemp = (c: number): string => `${c < 0 ? "−" : "+"}${Math.abs(c).toFixed(1)} °C`;
const TONE_TEXT = { moss: "text-moss", amber: "text-[#9A6A08]", brick: "text-brick" } as const;
const TONE_BG = { moss: "bg-moss", amber: "bg-amber", brick: "bg-brick" } as const;

/** Total cells drawn in the rack capacity map. */
const MAP_CELLS = 120;

function Sparkline({ values, capacity }: { values: number[]; capacity: number }) {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max(capacity * 0.004, (hi - lo) * 0.25, 1);
  const min = lo - pad;
  const max = hi + pad;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * 100, 30 - ((v - min) / (max - min)) * 28 - 1] as const);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-9 w-full overflow-visible" aria-hidden="true">
      <polygon points={`0,30 ${line} 100,30`} fill="#F2622E" opacity={0.1} />
      <polyline points={line} fill="none" stroke="#F2622E" strokeWidth={1.6} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={2.4} fill="#F2622E" className="pw-blink" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Big live headline: stock / capacity, fill %, free space, last-hour flow and the 1-hour trend. */
function Headline({ live }: { live: StorageLive }) {
  const p = live.profile;
  const tone = fillTone(live.fill);
  const net = live.inLastHour - live.outLastHour;
  return (
    <div className="rounded-[12px] bg-sand/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11.5px] font-medium text-slate">Stored now</p>
          <p className="mt-0.5 whitespace-nowrap font-mono text-[22px] font-bold leading-none text-ink tnum">
            {nf.format(live.total)}
            <span className="ml-1 text-[12px] font-semibold text-slate">/ {nf.format(p.capacity)} {p.unit}</span>
          </p>
        </div>
        <div className="text-right">
          <p className={cn("font-mono text-[22px] font-bold leading-none tnum", TONE_TEXT[tone])}>{pct(live.fill)}</p>
          <p className="mt-1 text-[11px] text-slate">full</p>
        </div>
      </div>
      <div className="relative mt-2.5 h-2.5 overflow-hidden rounded-full bg-paper pw-hatch">
        <div className={cn("h-full rounded-full transition-[width] duration-700 ease-out", TONE_BG[tone])} style={{ width: `${Math.min(100, live.fill * 100)}%` }} />
        {[0.7, 0.85].map((m) => (
          <span key={m} className="absolute inset-y-0 w-px bg-ink/25" style={{ left: `${m * 100}%` }} />
        ))}
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <p className="text-slate">Free</p>
          <p className="font-mono text-[13px] font-bold text-ink tnum">{nf.format(live.free)}</p>
        </div>
        <div>
          <p className="flex items-center gap-1 text-slate">
            <ArrowDownToLine className="h-3 w-3 text-moss" /> In 1 h
          </p>
          <p className="font-mono text-[13px] font-bold text-moss tnum">+{nf.format(live.inLastHour)}</p>
        </div>
        <div>
          <p className="flex items-center gap-1 text-slate">
            <ArrowUpFromLine className="h-3 w-3 text-harbor" /> Out 1 h
          </p>
          <p className="font-mono text-[13px] font-bold text-harbor tnum">−{nf.format(live.outLastHour)}</p>
        </div>
      </div>
      <div className="mt-2 border-t border-hairline/80 pt-2">
        <div className="flex items-center justify-between text-[11px] text-slate">
          <span>Last hour</span>
          <span className={cn("font-mono font-semibold tnum", net >= 0 ? "text-moss" : "text-harbor")}>
            Net {net >= 0 ? "+" : "−"}
            {nf.format(Math.abs(net))} {unitShort(p.unit)}
          </span>
        </div>
        <Sparkline values={live.trend} capacity={p.capacity} />
      </div>
    </div>
  );
}

/** Warehouse floor as a grid of bays: each cell is one bay, coloured by the cargo stored there. */
function RackMap({ live, focus, onFocus }: { live: StorageLive; focus: string | null; onFocus: (id: string | null) => void }) {
  const p = live.profile;
  return (
    <div className="flex flex-col gap-2">
      {live.zones.map((z) => {
        const cells = Math.max(6, Math.round((z.zone.capacity / p.capacity) * MAP_CELLS));
        const perCell = z.zone.capacity / cells;
        const colors: string[] = [];
        for (const m of z.mix) {
          const n = Math.round(m.qty / perCell);
          for (let i = 0; i < n && colors.length < cells; i++) colors.push(m.color);
        }
        const filled = Math.min(cells, Math.round(z.qty / perCell));
        while (colors.length > filled) colors.pop();
        while (colors.length < filled) colors.push(z.mix.find((m) => m.qty > 0)?.color ?? "#8A93A3");
        const isDim = focus !== null && !z.mix.some((m) => m.cargoId === focus && m.qty > 0);
        return (
          <div key={z.zone.id} className={cn("transition-opacity duration-300", isDim && "opacity-35")}>
            <div className="mb-1 flex items-center gap-1.5 text-[11px]">
              <span className="font-semibold text-ink">{z.zone.name}</span>
              {z.activeDir ? <MoveTag dir={z.activeDir} /> : null}
              <span className="ml-auto font-mono text-slate tnum">{pct(z.fill)}</span>
            </div>
            <div className="grid grid-cols-[repeat(20,minmax(0,1fr))] gap-[2px]">
              {Array.from({ length: cells }, (_, i) => {
                const c = colors[i];
                const isEdge = z.activeDir !== undefined && i === filled - (z.activeDir === "in" ? 1 : 0);
                const isFocusCell = focus !== null && c !== undefined && z.mix.find((m) => m.color === c)?.cargoId !== focus;
                return (
                  <span
                    key={i}
                    aria-hidden="true"
                    onMouseEnter={() => c && onFocus(z.mix.find((m) => m.color === c)?.cargoId ?? null)}
                    onMouseLeave={() => onFocus(null)}
                    className={cn("aspect-square rounded-[2.5px] transition-[background-color,opacity] duration-500", !c && "bg-paper ring-1 ring-inset ring-hairline", isEdge && "pw-blink ring-2 ring-signal", isFocusCell && "opacity-25")}
                    style={c ? { background: c } : undefined}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
      <p className="text-[10.5px] text-slate">
        1 cell ≈ {nf.format(Math.round(p.capacity / MAP_CELLS))} {unitShort(p.unit)} · empty bays outlined
      </p>
    </div>
  );
}

/** Tanks or silos drawn as level gauges in the colour of the product they hold. */
function TankMap({ live, focus, onFocus }: { live: StorageLive; focus: string | null; onFocus: (id: string | null) => void }) {
  const cols = live.zones.length > 8 ? "grid-cols-5" : "grid-cols-4";
  return (
    <div className={cn("grid gap-x-2 gap-y-3", cols)}>
      {live.zones.map((z) => {
        const color = live.profile.cargo.find((c) => c.id === z.zone.cargoId)?.color ?? "#8A93A3";
        const isDim = focus !== null && z.zone.cargoId !== focus;
        return (
          <div
            key={z.zone.id}
            onMouseEnter={() => z.zone.cargoId && onFocus(z.zone.cargoId)}
            onMouseLeave={() => onFocus(null)}
            className={cn("flex flex-col items-center transition-opacity duration-300", isDim && "opacity-35")}
          >
            <div className="relative h-[74px] w-full max-w-[52px] overflow-hidden rounded-b-[6px] rounded-t-[14px] border border-hairline bg-paper pw-hatch">
              {!z.isIdle ? (
                <div className="absolute inset-x-0 bottom-0 transition-[height] duration-700 ease-out" style={{ height: `${Math.min(100, z.fill * 100)}%`, background: color }}>
                  <div className="h-[3px] w-full bg-white/35" />
                </div>
              ) : null}
              {[0.25, 0.5, 0.75].map((m) => (
                <span key={m} className="absolute right-0 h-px w-1.5 bg-ink/30" style={{ bottom: `${m * 100}%` }} />
              ))}
              {z.activeDir ? (
                <span className={cn("absolute left-1/2 top-1 grid h-4 w-4 -translate-x-1/2 place-items-center rounded-full bg-paper shadow-sm", z.activeDir === "in" ? "text-moss" : "text-harbor")}>
                  {z.activeDir === "in" ? <ArrowDownToLine className="h-2.5 w-2.5" strokeWidth={3} /> : <ArrowUpFromLine className="h-2.5 w-2.5" strokeWidth={3} />}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-[11px] font-bold text-ink">{z.zone.name}</p>
            <p className="font-mono text-[10.5px] text-slate tnum">{z.isIdle ? "—" : pct(z.fill)}</p>
            <p className="max-w-full truncate text-[10px] text-slate">{z.zone.note}</p>
          </div>
        );
      })}
    </div>
  );
}

function MoveTag({ dir }: { dir: "in" | "out" }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide", dir === "in" ? "bg-moss-soft text-moss" : "bg-harbor-soft text-harbor")}>
      {dir === "in" ? <ArrowDownToLine className="h-2.5 w-2.5" strokeWidth={3} /> : <ArrowUpFromLine className="h-2.5 w-2.5" strokeWidth={3} />}
      {dir === "in" ? "Putaway" : "Picking"}
    </span>
  );
}

/** Stacked share bar plus one row per cargo type. Hovering a row highlights where that cargo sits. */
function CargoMix({ live, focus, onFocus }: { live: StorageLive; focus: string | null; onFocus: (id: string | null) => void }) {
  const p = live.profile;
  const rows = useMemo(() => [...live.cargo].sort((a, b) => b.qty - a.qty), [live.cargo]);
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-paper ring-1 ring-inset ring-hairline">
        {live.cargo.map((c) => (
          <div
            key={c.line.id}
            className={cn("h-full transition-[width,opacity] duration-700 ease-out", focus !== null && focus !== c.line.id && "opacity-30")}
            style={{ width: `${(c.qty / p.capacity) * 100}%`, background: c.line.color }}
          />
        ))}
        <div className="h-full flex-1 pw-hatch" />
      </div>
      <ul className="mt-2">
        {rows.map((c) => (
          <li key={c.line.id}>
            <button
              type="button"
              onMouseEnter={() => onFocus(c.line.id)}
              onMouseLeave={() => onFocus(null)}
              onFocus={() => onFocus(c.line.id)}
              onBlur={() => onFocus(null)}
              onClick={() => onFocus(focus === c.line.id ? null : c.line.id)}
              data-haptic="off"
              className={cn("flex w-full items-center gap-2.5 rounded-[9px] px-1.5 py-1.5 text-left transition-colors", focus === c.line.id ? "bg-sand" : "hover:bg-sand/60")}
            >
              <span className="h-3 w-3 shrink-0 rounded-[3px]" style={{ background: c.line.color }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-semibold text-ink">{c.line.label}</span>
                <span className="block truncate text-[11px] text-slate">{c.line.detail}</span>
              </span>
              <span className="text-right">
                <span className="block font-mono text-[12.5px] font-bold text-ink tnum">{nf.format(c.qty)}</span>
                <span className="block font-mono text-[10.5px] text-slate tnum">{pct(c.share)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ZoneRow({ z, unit }: { z: ZoneStock; unit: string }) {
  const tone = fillTone(z.fill);
  const isOffTemp = z.tempC !== undefined && z.zone.setC !== undefined && Math.abs(z.tempC - z.zone.setC) > 0.9;
  return (
    <li className="border-b border-hairline/70 py-2 last:border-b-0">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[12.5px] font-semibold text-ink">{z.zone.name}</span>
            {z.activeDir ? <MoveTag dir={z.activeDir} /> : null}
          </span>
          <span className="block truncate text-[11px] text-slate">{z.zone.note}</span>
        </span>
        {z.tempC !== undefined ? (
          <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold tnum", isOffTemp ? "bg-amber-soft text-[#9A6A08]" : "bg-harbor-soft text-harbor")}>
            <Snowflake className="h-3 w-3" />
            {fmtTemp(z.tempC)}
          </span>
        ) : null}
        <span className="w-[86px] text-right font-mono text-[11.5px] text-slate tnum">
          <span className="font-bold text-ink">{nf.format(z.qty)}</span>/{nf.format(z.zone.capacity)}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sand">
          <div className={cn("h-full rounded-full transition-[width] duration-700 ease-out", TONE_BG[tone])} style={{ width: `${Math.min(100, z.fill * 100)}%` }} />
        </div>
        <span className={cn("w-9 text-right font-mono text-[11px] font-bold tnum", TONE_TEXT[tone])}>{pct(z.fill)}</span>
      </div>
      <span className="sr-only">{unit}</span>
    </li>
  );
}

function MoveRow({ e, live, t, isNext }: { e: StorageEvent; live: StorageLive; t: number; isNext?: boolean }) {
  const cargo = live.profile.cargo.find((c) => c.id === e.cargoId);
  const zone = live.profile.zones.find((z) => z.id === e.zoneId);
  const isIn = e.dir === "in";
  return (
    <li className={cn("flex items-center gap-2.5 rounded-[9px] px-1.5 py-1.5", isNext && "border border-dashed border-hairline bg-paper")}>
      <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-[8px]", isIn ? "bg-moss-soft text-moss" : "bg-harbor-soft text-harbor")}>
        {isIn ? <ArrowDownToLine className="h-3.5 w-3.5" /> : <ArrowUpFromLine className="h-3.5 w-3.5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: cargo?.color }} />
          <span className="truncate text-[12px] font-semibold text-ink">{cargo?.label}</span>
        </span>
        <span className="block truncate text-[11px] text-slate">
          {e.via} → {zone?.name}
        </span>
      </span>
      <span className="text-right">
        <span className={cn("block font-mono text-[12px] font-bold tnum", isIn ? "text-moss" : "text-harbor")}>
          {isIn ? "+" : "−"}
          {nf.format(e.qty)}
        </span>
        <span className="block font-mono text-[10.5px] text-slate tnum">{isNext ? `in ${fmtDuration(e.t - t)}` : fmtClock(SIM_START_SEC + e.t, true)}</span>
      </span>
    </li>
  );
}

type Tab = "map" | "cargo" | "zones";

/**
 * Live storage detail for a warehouse or storage site: what is stored, how full it is and what is moving.
 * Every number derives from the sim clock, so it replays with the time bar.
 */
export const StoragePanel = memo(function StoragePanel({ facilityId, t }: { facilityId: string; t: number }) {
  const [tab, setTab] = useState<Tab>("map");
  const [focus, setFocus] = useState<string | null>(null);
  const live = storageAt(facilityId, t);
  if (!live) return null;
  const p = live.profile;
  const tabs: Array<[Tab, string]> = [
    ["map", p.layout === "tanks" ? `${p.zoneLabel}` : "Capacity map"],
    ["cargo", "Cargo"],
    ["zones", p.layout === "tanks" ? "Levels" : p.zoneLabel],
  ];
  const isOverWarn = live.fill >= 0.85;
  return (
    <section className="mt-4" aria-label="Storage">
      <div className="mb-2 flex items-center justify-between">
        <p className="eyebrow">Storage · live</p>
        <span className="text-[10.5px] text-slate">{p.source}</span>
      </div>
      <Headline live={live} />
      {isOverWarn ? (
        <p className="mt-2 rounded-[10px] bg-brick-soft px-2.5 py-1.5 text-[11.5px] font-semibold text-brick">Above 85% · new inbound may be diverted</p>
      ) : null}

      <div role="tablist" aria-label="Storage detail" className="mt-3 flex gap-1 rounded-[10px] bg-sand/70 p-1">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn("min-h-9 flex-1 rounded-[8px] px-2 py-1.5 text-[12.5px] font-semibold transition-colors", tab === k ? "bg-paper text-ink shadow-sm" : "text-slate hover:text-ink")}
          >
            {label}
          </button>
        ))}
      </div>

      <div key={tab} className="mt-3 pw-rise">
        {tab === "map" ? (
          <>
            {p.layout === "tanks" ? <TankMap live={live} focus={focus} onFocus={setFocus} /> : <RackMap live={live} focus={focus} onFocus={setFocus} />}
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
              {p.cargo.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  data-haptic="off"
                  onMouseEnter={() => setFocus(c.id)}
                  onMouseLeave={() => setFocus(null)}
                  onClick={() => setFocus(focus === c.id ? null : c.id)}
                  className={cn("flex items-center gap-1 text-[10.5px] transition-opacity", focus !== null && focus !== c.id ? "text-slate/60" : "text-slate")}
                >
                  <span className="h-2 w-2 rounded-[2px]" style={{ background: c.color }} />
                  {c.label}
                </button>
              ))}
            </div>
          </>
        ) : tab === "cargo" ? (
          <CargoMix live={live} focus={focus} onFocus={setFocus} />
        ) : (
          <ul>
            {live.zones.map((z) => (
              <ZoneRow key={z.zone.id} z={z} unit={p.unit} />
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="eyebrow">Movements</p>
        <StatusChip tone="slate" dot={false}>
          Avg dwell {p.dwell}
        </StatusChip>
      </div>
      <ul className="mt-1.5 flex flex-col gap-0.5">
        {live.next ? <MoveRow e={live.next} live={live} t={t} isNext /> : null}
        {live.recent.slice(0, 5).map((e) => (
          <MoveRow key={e.id} e={e} live={live} t={t} />
        ))}
      </ul>
    </section>
  );
});

/** Live fill line for compact places (facility list, 3D chip). */
export function storageFillLabel(facilityId: string, t: number): { fill: number; label: string } | null {
  const live = storageAt(facilityId, t);
  if (!live) return null;
  return { fill: live.fill, label: `${pct(live.fill)} full · ${nf.format(live.free)} ${unitShort(live.profile.unit)} free` };
}
