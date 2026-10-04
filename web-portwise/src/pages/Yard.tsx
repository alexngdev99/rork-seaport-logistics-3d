import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowRight, Boxes, Check, ChevronRight, Copy, Cpu, MapPin, Package, Scale, Ship, Snowflake, X } from "lucide-react";
import { HudLayout } from "@/components/hud/HudLayout";
import { DefRow, IconButton, Panel, PanelHeader, ProgressBar, StatusChip } from "@/components/hud/primitives";
import type { Tone } from "@/components/hud/primitives";
import { CATEGORY_LABEL, YARD_BLOCKS, blockById, vesselById } from "@/data/port";
import { blockStats, containerById, containersInBlock } from "@/data/containers";
import type { Container, YardBlock } from "@/data/types";
import { cn } from "@/lib/utils";
import { usePort } from "@/state/PortProvider";
import type { YardFilter } from "@/state/PortProvider";

const nf = new Intl.NumberFormat("en-US");
export const fillBarTone = (f: number): Tone => (f >= 0.85 ? "brick" : f >= 0.6 ? "amber" : "moss");

function MiniGrid({ block }: { block: YardBlock }) {
  const cells = useMemo(() => {
    const list = containersInBlock(block.id);
    return Array.from({ length: 12 }, (_, i) => list[(i * 17) % Math.max(1, list.length)]?.color ?? "#E3DDD0");
  }, [block.id]);
  return (
    <span className="grid h-8 w-10 shrink-0 grid-cols-4 gap-[2px] rounded-[6px] bg-sand p-[3px]" aria-hidden="true">
      {cells.map((c, i) => (
        <span key={i} className="rounded-[1.5px]" style={{ background: c }} />
      ))}
    </span>
  );
}

const FILTERS: Array<[YardFilter, string]> = [
  ["all", "All"],
  ["import", "Import"],
  ["export", "Export"],
  ["reefer", "Reefer"],
];

function BlockList({ activeId }: { activeId?: string }) {
  const { yardFilter, setYardFilter, setHovered } = usePort();
  const blocks = YARD_BLOCKS.filter((b) => yardFilter === "all" || b.category === yardFilter);
  return (
    <Panel className="flex min-h-0 flex-col p-3" aria-label="Container yard">
      <div className="flex items-center gap-2 px-1.5 pb-2 pt-1">
        <Boxes className="h-5 w-5 text-ink" />
        <h1 className="whitespace-nowrap text-[16px] font-bold text-ink">Container yard</h1>
        <span className="ml-auto whitespace-nowrap font-mono text-[11.5px] text-slate">{blocks.length} blocks</span>
      </div>
      <div role="tablist" aria-label="Filter by cargo type" className="flex gap-1 rounded-[10px] bg-sand/70 p-1">
        {FILTERS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={yardFilter === k}
            onClick={() => setYardFilter(k)}
            className={cn("flex-1 whitespace-nowrap rounded-[8px] px-1.5 py-1.5 text-[12px] font-semibold transition-colors", yardFilter === k ? "bg-paper text-ink shadow-sm" : "text-slate hover:text-ink")}
          >
            {label}
          </button>
        ))}
      </div>
      <ul className="scroll-thin mt-2 min-h-0 flex-1 overflow-y-auto">
        {blocks.map((b) => {
          const st = blockStats(b);
          const active = b.id === activeId;
          return (
            <li key={b.id}>
              <Link
                to={`/yard/${b.id}`}
                onMouseEnter={() => setHovered({ kind: "block", id: b.id })}
                onMouseLeave={() => setHovered(null)}
                className={cn("group flex items-center gap-3 rounded-[11px] border px-2.5 py-2.5 transition-colors", active ? "border-signal/50 bg-signal-soft/60" : "border-transparent hover:bg-sand/70")}
              >
                <span className="flex w-[58px] shrink-0 flex-col">
                  <span className="font-mono text-[14px] font-bold leading-tight text-ink">{b.id}</span>
                  <span className="flex items-center gap-1 whitespace-nowrap text-[10.5px] text-slate">
                    {b.category === "reefer" ? <Snowflake className="h-3 w-3" /> : null}
                    {CATEGORY_LABEL[b.category]}
                  </span>
                </span>
                <MiniGrid block={b} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <ProgressBar value={b.fill} tone={fillBarTone(b.fill)} height="h-2" />
                    <span className="w-9 text-right font-mono text-[12.5px] font-bold text-ink tnum">{Math.round(b.fill * 100)}%</span>
                  </span>
                  <span className="mt-1 flex items-center gap-1.5 whitespace-nowrap text-[11.5px] text-slate">
                    <span className="font-mono tnum">
                      {nf.format(st.teu)} / {nf.format(b.capacity)} TEU
                    </span>
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function ContainerCard({ c }: { c: Container }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState<boolean>(false);
  const vessel = vesselById(c.vesselId);
  const copy = () => {
    void navigator.clipboard?.writeText(c.id).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };
  const customsTone: Tone = c.customs === "Cleared" ? "moss" : c.customs === "Inspection hold" ? "amber" : "harbor";
  return (
    <Panel className="w-full p-4" aria-label={`Container ${c.code}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-bold text-ink">Container details</h2>
        <Link to={`/yard/${c.blockId}`} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-[10px] text-ink hover:bg-sand">
          <X className="h-4 w-4" />
        </Link>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <p className="font-mono text-[25px] font-bold tracking-wide text-ink">{c.code}</p>
        <IconButton label={copied ? "Copied" : "Copy container number"} onClick={copy} className="ml-auto h-8 w-8">
          {copied ? <Check className="h-3.5 w-3.5 text-moss" /> : <Copy className="h-3.5 w-3.5" />}
        </IconButton>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <StatusChip tone="harbor" dot={false}>
          {c.size} · {CATEGORY_LABEL[c.category]}
        </StatusChip>
        <StatusChip tone="slate" dot={false}>
          {c.line}
        </StatusChip>
      </div>
      <dl className="mt-3">
        <DefRow label={<span className="inline-flex items-center gap-2"><MapPin className="h-3.5 w-3.5" />Position</span>}>{c.position}</DefRow>
        <DefRow label={<span className="inline-flex items-center gap-2"><Cpu className="h-3.5 w-3.5" />Cargo</span>} mono={false}>{c.cargo}</DefRow>
        <DefRow label={<span className="inline-flex items-center gap-2"><Scale className="h-3.5 w-3.5" />Gross weight</span>}>{nf.format(c.weight)} kg</DefRow>
        <DefRow label={<span className="inline-flex items-center gap-2"><Ship className="h-3.5 w-3.5" />Vessel</span>} mono={false}>
          {vessel ? (
            <Link to={`/vessels/${vessel.id}`} className="text-harbor hover:underline">
              {vessel.name}
            </Link>
          ) : (
            "—"
          )}
        </DefRow>
        <DefRow label={<span className="inline-flex items-center gap-2"><Package className="h-3.5 w-3.5" />Customs</span>} mono={false}>
          <StatusChip tone={customsTone}>{c.customs}</StatusChip>
        </DefRow>
      </dl>
      <button
        type="button"
        onClick={() => navigate(`/shipments/${c.shipmentId}`)}
        className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-[11px] bg-ink text-[14px] font-semibold text-paper transition-transform hover:bg-ink/90 active:scale-[0.98]"
      >
        View journey <ArrowRight className="h-4 w-4" />
      </button>
    </Panel>
  );
}

function BlockSummary({ block }: { block: YardBlock }) {
  const st = blockStats(block);
  const list = containersInBlock(block.id);
  const byLine = useMemo(() => {
    const m = new Map<string, number>();
    list.forEach((c) => m.set(c.line, (m.get(c.line) ?? 0) + 1));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [list]);
  return (
    <Panel className="w-full p-4" aria-label={`Block ${block.id}`}>
      <PanelHeader
        eyebrow={CATEGORY_LABEL[block.category]}
        title={`Block ${block.id}`}
        icon={<Boxes className="h-5 w-5" />}
        right={
          <Link to="/yard" aria-label="Close" className="grid h-9 w-9 place-items-center rounded-[10px] text-ink hover:bg-sand">
            <X className="h-4 w-4" />
          </Link>
        }
      />
      <div className="mt-4">
        <div className="mb-1.5 flex justify-between text-[13px]">
          <span className="font-semibold text-ink">
            Occupancy <span className="font-mono tnum">{nf.format(st.teu)} / {nf.format(block.capacity)}</span> TEU
          </span>
          <span className="font-mono font-bold tnum">{Math.round(block.fill * 100)}%</span>
        </div>
        <ProgressBar value={block.fill} tone={fillBarTone(block.fill)} />
      </div>
      <dl className="mt-3">
        <DefRow label="Boxes stored">{st.count}</DefRow>
        <DefRow label="Customs pending">{st.customsHold}</DefRow>
        <DefRow label="Layout">8 bays × 6 rows × 4 tiers</DefRow>
      </dl>
      <p className="eyebrow mt-3 pb-1.5">By shipping line</p>
      <ul className="space-y-1.5">
        {byLine.map(([line, n]) => (
          <li key={line} className="flex items-center gap-2 text-[12.5px]">
            <span className="w-28 truncate text-ink">{line}</span>
            <ProgressBar value={n / list.length} tone="ink" height="h-1.5" />
            <span className="w-8 text-right font-mono text-slate tnum">{n}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 rounded-[10px] bg-sand/70 px-3 py-2.5 text-[12.5px] text-slate">Click any container in the block to see its details and journey.</p>
    </Panel>
  );
}

export default function Yard() {
  const { blockId } = useParams();
  const [params] = useSearchParams();
  const cId = params.get("c");
  const container = cId ? containerById(cId) : undefined;
  const block = blockId ? blockById(blockId) : undefined;
  const { setPageSelection, setView } = usePort();

  useEffect(() => {
    setView("yard");
    if (container) setPageSelection({ kind: "container", id: container.id });
    else if (block) setPageSelection({ kind: "block", id: block.id });
    else setPageSelection(null);
  }, [container, block, setPageSelection, setView]);

  const right = container ? <ContainerCard c={container} /> : block ? <BlockSummary block={block} /> : undefined;

  return <HudLayout wideLeft left={<BlockList activeId={block?.id ?? container?.blockId} />} right={right} />;
}
