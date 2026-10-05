import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, ChevronRight, Network, ScanLine, TrainFront, Truck as TruckIcon, X } from "lucide-react";
import { HudLayout } from "@/components/hud/HudLayout";
import { DefRow, IconButton, Panel, PanelHeader, ProgressBar, StatusChip } from "@/components/hud/primitives";
import { FacilityIcon } from "@/components/hud/FacilityIcon";
import { truckStatusTone } from "@/components/hud/TruckCard";
import { FACILITIES, FACILITY_GROUPS, facilityById } from "@/data/facilities";
import type { Facility } from "@/data/facilities";
import { DRAYAGE_TRUCKS } from "@/data/drayage";
import { cn } from "@/lib/utils";
import { TRAIN, facilityLive, scanLine, trainLine } from "@/sim/logistics";
import { sim, simT, useSimTick } from "@/sim/simStore";
import { usePort } from "@/state/PortProvider";

const pct = (v: number): string => `${Math.round(v * 100)}%`;

function FacilityList({ activeId }: { activeId?: string }) {
  const { setHovered } = usePort();
  const t = simT();
  return (
    <Panel className="flex min-h-0 flex-col p-3" aria-label="Logistics district">
      <div className="flex items-center gap-2 px-1.5 pb-1 pt-1">
        <Network className="h-5 w-5 text-ink" />
        <h1 className="whitespace-nowrap text-[16px] font-bold text-ink">Logistics district</h1>
        <span className="ml-auto whitespace-nowrap font-mono text-[11.5px] text-slate">{FACILITIES.length} sites</span>
      </div>
      <p className="px-1.5 text-[12px] text-slate">Everything within 4 km of Gate B</p>
      <div className="scroll-thin mt-1 min-h-0 flex-1 overflow-y-auto">
        {FACILITY_GROUPS.map((g) => (
          <div key={g}>
            <p className="eyebrow px-2 pb-1 pt-3">{g}</p>
            <ul>
              {FACILITIES.filter((f) => f.group === g).map((f) => {
                const live = facilityLive(f.id, t);
                const active = f.id === activeId;
                return (
                  <li key={f.id}>
                    <Link
                      to={`/logistics/${f.id}`}
                      onMouseEnter={() => setHovered({ kind: "facility", id: f.id })}
                      onMouseLeave={() => setHovered(null)}
                      onFocus={() => setHovered({ kind: "facility", id: f.id })}
                      onBlur={() => setHovered(null)}
                      className={cn("group flex items-center gap-3 rounded-[11px] border px-2.5 py-2 transition-colors", active ? "border-signal/50 bg-signal-soft/60" : "border-transparent hover:bg-sand/70")}
                    >
                      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-[10px]", active ? "bg-signal text-paper" : "bg-sand text-ink")}>
                        <FacilityIcon kind={f.kind} className="h-[18px] w-[18px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-[13px] font-bold text-ink">{f.name}</span>
                          <span className="shrink-0 font-mono text-[11px] text-slate tnum">{f.fromGateKm.toFixed(1)} km</span>
                        </span>
                        <span className={cn("mt-0.5 flex items-center gap-1.5 truncate text-[11.5px]", live.tone === "signal" ? "text-[#B8441A]" : "text-slate")}>
                          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", `bg-${live.tone === "slate" ? "slate" : live.tone}`)} />
                          <span className="truncate">{live.label}</span>
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function DrayageRows({ facilityId }: { facilityId?: string }) {
  const { open, selection } = usePort();
  const list = DRAYAGE_TRUCKS.filter((d) => !facilityId || d.facilityId === facilityId);
  if (!list.length) return null;
  return (
    <ul className="mt-1">
      {list.map((d) => {
        const status = sim.truckStatus[d.id] ?? "—";
        const f = d.facilityId ? facilityById(d.facilityId) : undefined;
        const active = selection?.kind === "truck" && selection.id === d.id;
        return (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => open({ kind: "truck", id: d.id })}
              className={cn("flex w-full items-center gap-2.5 rounded-[9px] px-1.5 py-1.5 text-left transition-colors hover:bg-sand/70", active && "bg-signal-soft/60")}
            >
              <span className="h-3 w-5 shrink-0 rounded-[3px]" style={{ background: d.containerColor }} aria-hidden="true" />
              <span className="w-[84px] shrink-0 font-mono text-[12px] font-semibold text-ink">{d.plate}</span>
              <span className="min-w-0 flex-1 truncate text-[11.5px] text-slate">{f?.short}</span>
              <StatusChip tone={truckStatusTone(status)} className="max-w-[150px] truncate">
                {status}
              </StatusChip>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function FlowsPanel() {
  const { open } = usePort();
  const t = simT();
  const train = trainLine(t);
  const scan = scanLine(t);
  return (
    <Panel className="w-full p-4" aria-label="Inland flows">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[16px] font-bold text-ink">Inland flows</h2>
        <span className="text-[11.5px] text-slate">Port → Singapore</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          ["Transship", "85%", "harbor"],
          ["Road", "13%", "moss"],
          ["ITH rail", "2%", "amber"],
        ].map(([k, v, tone]) => (
          <div key={k} className="rounded-[10px] bg-sand/70 px-2.5 py-2">
            <p className="text-[11px] font-medium text-slate">{k} share</p>
            <p className={cn("font-mono text-[18px] font-bold tnum", tone === "moss" ? "text-moss" : tone === "harbor" ? "text-harbor" : "text-[#9A6A08]")}>{v}</p>
          </div>
        ))}
      </div>

      <button type="button" onClick={() => open({ kind: "facility", id: "rail-icd" })} className="mt-3 w-full rounded-[11px] border border-hairline p-3 text-left transition-colors hover:bg-sand/60">
        <span className="flex items-center gap-2">
          <TrainFront className="h-4 w-4 text-harbor" />
          <span className="text-[13px] font-bold text-ink">Rail shuttle {TRAIN.id}</span>
          <span className="ml-auto text-[11.5px] text-slate">Pasir Panjang ⇄ {TRAIN.to}</span>
        </span>
        <span className="mt-2 flex items-center gap-2">
          <StatusChip tone={train.tone} pulse={train.tone !== "slate"}>
            {train.label}
          </StatusChip>
        </span>
        <ProgressBar value={train.progress} tone="harbor" height="h-1.5" className="mt-2" live={train.tone === "moss"} />
      </button>

      <button type="button" onClick={() => open({ kind: "facility", id: "customs" })} className="mt-2 flex w-full items-center gap-2 rounded-[11px] border border-hairline p-3 text-left transition-colors hover:bg-sand/60">
        <ScanLine className="h-4 w-4 text-signal" />
        <span className="text-[13px] font-bold text-ink">Customs scanner</span>
        <StatusChip tone={scan.tone} pulse={scan.tone === "signal"} className="ml-auto">
          {scan.label}
        </StatusChip>
      </button>

      <p className="eyebrow mt-4 flex items-center gap-1.5 pb-0.5">
        <TruckIcon className="h-3.5 w-3.5" /> Drayage trucks · {DRAYAGE_TRUCKS.length}
      </p>
      <DrayageRows />
    </Panel>
  );
}

function FacilityCard({ f }: { f: Facility }) {
  const navigate = useNavigate();
  const t = simT();
  const live = facilityLive(f.id, t);
  const hasTrucks = DRAYAGE_TRUCKS.some((d) => d.facilityId === f.id);
  return (
    <Panel className="w-full p-4" aria-label={f.name}>
      <PanelHeader
        eyebrow={f.group}
        title={f.name}
        icon={<FacilityIcon kind={f.kind} className="h-5 w-5" />}
        right={
          <IconButton label="Close" onClick={() => navigate("/logistics")}>
            <X className="h-4 w-4" />
          </IconButton>
        }
      />
      <div className="mt-3 flex flex-wrap items-center gap-2 pl-[52px]">
        <StatusChip tone={live.tone} pulse={live.tone === "signal" || live.tone === "harbor"}>
          {live.label}
        </StatusChip>
      </div>
      <p className="mt-3 text-[12.5px] leading-relaxed text-slate">{f.summary}</p>
      {live.progress !== undefined ? <ProgressBar value={live.progress} tone="harbor" height="h-1.5" className="mt-3" live /> : null}
      <div className="mt-4">
        <div className="flex items-center justify-between text-[12.5px]">
          <span className="text-slate">{f.utilLabel}</span>
          <span className="font-mono font-bold text-ink tnum">{pct(f.util)}</span>
        </div>
        <ProgressBar value={f.util} tone={f.util >= 0.85 ? "brick" : f.util >= 0.7 ? "amber" : "moss"} height="h-2" className="mt-1.5" />
      </div>
      <dl className="mt-3">
        <DefRow label="Operator" mono={false}>
          {f.operator}
        </DefRow>
        {f.stats.map(([k, v]) => (
          <DefRow key={k} label={k}>
            {v}
          </DefRow>
        ))}
        <DefRow label="Road distance from Gate B">{f.fromGateKm.toFixed(1)} km</DefRow>
      </dl>
      {hasTrucks ? (
        <>
          <p className="eyebrow mt-3">Trucks on this run</p>
          <DrayageRows facilityId={f.id} />
        </>
      ) : null}
      {f.id === "electronics" ? (
        <Link to="/shipments/SHP-20931" className="mt-3 flex items-center justify-between rounded-[11px] bg-ink px-3.5 py-2.5 text-[13px] font-semibold text-paper transition-transform active:scale-[0.98]">
          Inbound shipment #SHP-20931
          <ArrowRight className="h-4 w-4" />
        </Link>
      ) : null}
    </Panel>
  );
}

export default function Logistics() {
  useSimTick();
  const { id } = useParams<{ id: string }>();
  const f = id ? facilityById(id) : undefined;
  const { setPageSelection, setView } = usePort();
  useEffect(() => {
    setView("logistics");
    setPageSelection(f ? { kind: "facility", id: f.id } : null);
  }, [f, setPageSelection, setView]);

  return (
    <HudLayout
      wideLeft
      left={<FacilityList activeId={f?.id} />}
      right={f ? <FacilityCard key={f.id} f={f} /> : <FlowsPanel />}
      sheetOrder={f ? ["right", "left"] : ["left", "right"]}
    />
  );
}
