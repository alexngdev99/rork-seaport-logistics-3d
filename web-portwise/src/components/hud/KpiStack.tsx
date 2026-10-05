import { ArrowUp, Boxes, Clock3, Ship } from "lucide-react";
import type { ReactNode } from "react";
import { YARD_BLOCKS } from "@/data/port";
import { liveCraneRate, sim, useSimTick } from "@/sim/simStore";
import { CraneGlyph, Panel } from "./primitives";

const nf = new Intl.NumberFormat("en-US");
const nf1 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function Kpi({ icon, label, value, unit, delta, delay }: { icon: ReactNode; label: string; value: string; unit?: string; delta?: string; delay: number }) {
  return (
    <Panel className="flex min-w-0 items-center gap-2.5 px-3 py-3 sm:gap-3.5 sm:px-4 sm:py-3.5" as="div">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-sand text-ink max-[374px]:hidden sm:h-11 sm:w-11 sm:rounded-[11px]" style={{ animationDelay: `${delay}ms` }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[12px] font-medium text-slate sm:text-[12.5px]">{label}</p>
        <p className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="font-mono text-[21px] font-bold leading-tight tracking-tight text-ink tnum sm:text-[26px]">{value}</span>
          {unit ? <span className="text-[12px] font-medium text-slate sm:text-[12.5px]">{unit}</span> : null}
          {delta ? (
            <span className="inline-flex items-center text-[12px] font-semibold text-moss">
              <ArrowUp className="h-3 w-3" />
              {delta}
            </span>
          ) : null}
        </p>
      </div>
    </Panel>
  );
}

export function KpiStack() {
  useSimTick();
  const fill = YARD_BLOCKS.reduce((s, b) => s + b.fill, 0) / YARD_BLOCKS.length;
  return (
    <div className="grid grid-cols-2 gap-2.5 lg:flex lg:flex-col lg:gap-3" role="group" aria-label="Terminal KPIs">
      <Kpi icon={<Ship className="h-5 w-5" />} label="TEU today" value={nf.format(sim.teuToday)} delta="6%" delay={0} />
      <Kpi icon={<CraneGlyph className="h-6 w-6" />} label="Crane productivity" value={nf1.format(liveCraneRate())} unit="moves/h" delay={60} />
      <Kpi icon={<Clock3 className="h-5 w-5" />} label="On-time berthing" value="94.2%" delay={120} />
      <Kpi icon={<Boxes className="h-5 w-5" />} label="Yard utilization" value={`${Math.round(fill * 100)}%`} delay={180} />
    </div>
  );
}
