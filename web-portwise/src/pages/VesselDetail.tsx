import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, CloudRain, Locate, Ship, Wind, X } from "lucide-react";
import { HudLayout } from "@/components/hud/HudLayout";
import { BerthSchedule } from "@/components/hud/BerthSchedule";
import { AisPanel } from "@/components/hud/AisPanel";
import { hasAis } from "@/sim/ais/tracker";
import { DefRow, IconButton, Panel, ProgressBar, StatusChip } from "@/components/hud/primitives";
import { QUAY_CRANES, vesselById } from "@/data/port";
import { containersForVessel } from "@/data/containers";
import { cn } from "@/lib/utils";
import { craneStatusAt, fmtClock, sim, simT, useSimTick } from "@/sim/simStore";
import { usePort } from "@/state/PortProvider";
import { vesselLive } from "./Vessels";

type Tab = "overview" | "ais" | "containers" | "activity";
const nf = new Intl.NumberFormat("en-US");

function CraneRows({ vesselId }: { vesselId: string }) {
  const { open } = usePort();
  const cranes = QUAY_CRANES.filter((c) => c.vesselId === vesselId);
  if (!cranes.length) return <p className="py-2 text-[12.5px] text-slate">No cranes assigned yet.</p>;
  return (
    <ul>
      {cranes.map((c) => {
        const st = craneStatusAt(c, simT());
        const active = st.state === "active";
        const paused = st.state === "paused";
        return (
          <li key={c.id}>
            <button type="button" onClick={() => open({ kind: "crane", id: c.id })} className="flex w-full items-center gap-3 rounded-[9px] px-1.5 py-2 text-left hover:bg-sand/70">
              <span className={cn("h-2.5 w-2.5 rounded-full", paused ? "bg-brick pw-blink" : active ? "bg-moss" : "bg-amber")} />
              <span className="w-16 font-mono text-[13px] font-bold text-ink">{c.id}</span>
              {paused ? (
                <StatusChip tone="brick">{st.reason}</StatusChip>
              ) : active ? (
                <StatusChip tone="moss">{c.mode === "load" ? "Loading" : "Discharging"}</StatusChip>
              ) : (
                <StatusChip tone="amber">{st.reason}</StatusChip>
              )}
              <span className="ml-auto font-mono text-[12.5px] font-semibold text-ink tnum">{active ? `${c.movesPerHour || 28} moves/h` : "–"}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ContainerList({ vesselId }: { vesselId: string }) {
  const { open } = usePort();
  const list = useMemo(() => containersForVessel(vesselId), [vesselId]);
  if (!list.length) return <p className="py-3 text-[12.5px] text-slate">No containers from this vessel in the yard yet.</p>;
  return (
    <div>
      <p className="pb-2 text-[12px] text-slate">{list.length} containers from this vessel are in the yard</p>
      <ul className="divide-y divide-hairline/70">
        {list.slice(0, 40).map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => open({ kind: "container", id: c.id })} className="flex w-full items-center gap-3 rounded-[8px] px-1.5 py-2 text-left hover:bg-sand/70">
              <span className="h-5 w-2 rounded-[2px]" style={{ background: c.color }} />
              <span className="font-mono text-[12.5px] font-bold text-ink">{c.code}</span>
              <span className="ml-auto font-mono text-[11.5px] text-slate">{c.position}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ActivityLog({ vesselId }: { vesselId: string }) {
  const items = sim.activity.filter((a) => a.vesselId === vesselId);
  if (!items.length) return <p className="py-3 text-[12.5px] text-slate">Waiting for the first crane move…</p>;
  return (
    <ol className="space-y-1">
      {items.slice(0, 18).map((a, i) => (
        <li key={a.id} className={cn("flex gap-3 rounded-[8px] px-1.5 py-1.5 text-[12.5px]", i === 0 && "pw-rise bg-signal-soft/50")}>
          <span className="font-mono text-slate tnum">{a.time}</span>
          <span className="text-ink">{a.text}</span>
        </li>
      ))}
    </ol>
  );
}

function WindWidget() {
  return (
    <Panel className="pointer-events-auto w-full p-4 lg:w-[220px]" as="div">
      <div className="flex items-center gap-2 text-[12.5px] text-slate">
        <Wind className="h-4 w-4 text-brick" /> Sumatra squall · gusting
      </div>
      <p className="mt-1 font-mono text-[28px] font-bold leading-none text-ink tnum">
        14<span className="ml-1 font-sans text-[13px] font-semibold text-slate">m/s</span>
      </p>
      <div className="mt-2 flex items-center gap-2 text-[12.5px] text-slate">
        <CloudRain className="h-4 w-4 text-harbor" /> Heavy rain · visibility 4 km
      </div>
    </Panel>
  );
}

export default function VesselDetail() {
  useSimTick();
  const { id = "" } = useParams();
  const vessel = vesselById(id);
  const { setPageSelection, setView, goHome } = usePort();
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    if (vessel) setPageSelection({ kind: "vessel", id: vessel.id });
    setView("vessels");
  }, [vessel, setPageSelection, setView]);

  if (!vessel) return <Navigate to="/vessels" replace />;

  const s = vesselLive(vessel);
  const live = sim.vessels[vessel.id];
  const call = sim.calls[vessel.id];
  const dPct = live.discharged / vessel.dischargeTotal;
  const lPct = live.loaded / vessel.loadTotal;
  const rate = QUAY_CRANES.filter((c) => c.vesselId === vessel.id && sim.craneActive[c.id]).reduce((a, c) => a + (c.movesPerHour || 28), 0);

  const header = (
    <Panel className="p-4" as="div">
      <Link to="/vessels" className="inline-flex items-center gap-1.5 rounded-md text-[12.5px] font-semibold text-slate hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to vessels
      </Link>
      <h1 className="mt-1.5 text-[24px] font-extrabold leading-tight tracking-tight text-ink">{vessel.name}</h1>
      <p className="mt-0.5 text-[12.5px] text-slate">
        Voyage <span className="font-mono">{vessel.voyage}</span> · {vessel.from} → {vessel.to}
      </p>
    </Panel>
  );

  const tabs: Array<[Tab, string]> = [
    ["overview", "Overview"],
    ...(hasAis(vessel.id) ? ([["ais", "AIS"]] as Array<[Tab, string]>) : []),
    ["containers", "Containers"],
    ["activity", "Activity"],
  ];

  const inspector = (
    <Panel className="w-full p-4" aria-label={`${vessel.name} details`}>
      <header className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] text-paper" style={{ background: vessel.hull }}>
          <Ship className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Vessel · Berth {vessel.berth}</p>
          <h2 className="truncate text-[18px] font-bold leading-tight text-ink">{vessel.name}</h2>
          <p className="text-[12px] text-slate">
            IMO <span className="font-mono">{vessel.imo}</span> · {vessel.line}
          </p>
        </div>
        <div className="flex gap-1.5">
          <IconButton label="Center camera on vessel" onClick={goHome}>
            <Locate className="h-4 w-4" />
          </IconButton>
          <Link to="/vessels" aria-label="Close" className="grid h-10 w-10 place-items-center rounded-[10px] border border-hairline bg-paper text-ink hover:bg-sand lg:h-9 lg:w-9">
            <X className="h-4 w-4" />
          </Link>
        </div>
      </header>
      <div className="mt-2.5 pl-[52px]">
        <StatusChip tone={s.tone} pulse={!!call && call.phase !== "alongside" && call.phase !== "sailed" && call.phase !== "anchored"}>
          {s.label}
        </StatusChip>
      </div>

      <div role="tablist" aria-label="Vessel information" className="mt-4 flex gap-1 rounded-[10px] bg-sand/70 p-1">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn("min-h-9 flex-1 rounded-[8px] px-2 py-1.5 text-[12.5px] font-semibold transition-colors", tab === k ? "bg-paper text-ink shadow-sm" : "text-slate hover:text-ink")}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="pt-3">
          <div className="space-y-3">
            <div>
              <div className="mb-1.5 flex justify-between text-[13px]">
                <span className="font-semibold text-ink">
                  Discharge <span className="font-mono tnum">{nf.format(live.discharged)} / {nf.format(vessel.dischargeTotal)}</span> TEU
                </span>
                <span className="font-mono font-semibold tnum">{Math.round(dPct * 100)}%</span>
              </div>
              <ProgressBar value={dPct} tone="signal" live={s.active && !s.loading} />
            </div>
            <div>
              <div className="mb-1.5 flex justify-between text-[13px]">
                <span className="font-semibold text-ink">
                  Load <span className="font-mono tnum">{nf.format(live.loaded)} / {nf.format(vessel.loadTotal)}</span> TEU
                </span>
                <span className="font-mono font-semibold tnum">{Math.round(lPct * 100)}%</span>
              </div>
              <ProgressBar value={lPct} tone="moss" live={s.active && s.loading} />
            </div>
          </div>
          <dl className="mt-3">
            <DefRow label="ETA">{vessel.eta}</DefRow>
            {call && call.etaSec !== null ? (
              <DefRow label={`${call.etaLabel} (from AIS)`}>
                {fmtClock(call.etaSec)}
                {call.distanceNm !== null ? ` · ${call.distanceNm.toFixed(2)} nm` : ""}
              </DefRow>
            ) : null}
            <DefRow label="ETB">{vessel.etb}</DefRow>
            <DefRow label="ETD (est.)">{vessel.etd}</DefRow>
            <DefRow label="Assigned cranes">{vessel.cranes.join(", ") || "—"}</DefRow>
            <DefRow label="Productivity">{rate ? `${rate} moves/h` : "—"}</DefRow>
          </dl>
          <p className="eyebrow mt-3 pb-1">Quay cranes ({QUAY_CRANES.filter((c) => c.vesselId === vessel.id).length})</p>
          <CraneRows vesselId={vessel.id} />
        </div>
      ) : tab === "ais" ? (
        <AisPanel vesselId={vessel.id} />
      ) : tab === "containers" ? (
        <div className="pt-3">
          <ContainerList vesselId={vessel.id} />
        </div>
      ) : (
        <div className="pt-3">
          <ActivityLog vesselId={vessel.id} />
        </div>
      )}
    </Panel>
  );

  return (
    <HudLayout
      left={header}
      bottomLeft={vessel.berth === 2 ? <WindWidget /> : undefined}
      right={inspector}
      bottom={<BerthSchedule focusBerth={vessel.berth} title={`Berth ${vessel.berth} schedule`} />}
    />
  );
}
