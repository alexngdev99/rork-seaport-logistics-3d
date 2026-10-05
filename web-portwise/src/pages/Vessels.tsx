import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Ship } from "lucide-react";
import { HudLayout } from "@/components/hud/HudLayout";
import { BerthSchedule } from "@/components/hud/BerthSchedule";
import { PortMovements } from "@/components/hud/PortMovements";
import { PortSchedule } from "@/components/hud/PortSchedule";
import { Panel, ProgressBar, StatusChip } from "@/components/hud/primitives";
import type { Tone } from "@/components/hud/primitives";
import { CARRIER_NAME, VESSELS } from "@/data/port";
import type { Vessel } from "@/data/types";
import { sim, useSimTick } from "@/sim/simStore";
import { usePort } from "@/state/PortProvider";

export type VesselGroup = "berth" | "moving" | "anchored" | "expected" | "sailed";

/** Which list section a vessel belongs in right now (from its AIS-driven port call, if any). */
export function vesselGroup(v: Vessel): VesselGroup {
  const c = sim.calls[v.id];
  if (!c) return v.status === "scheduled" ? "expected" : "berth";
  if (c.phase === "alongside") return "berth";
  if (c.phase === "anchored") return "anchored";
  if (c.phase === "sailed") return "sailed";
  return "moving";
}

/** Live status of a vessel derived from simulation state. */
export function vesselLive(v: Vessel): { label: string; tone: Tone; progress: number; loading: boolean; active: boolean } {
  const live = sim.vessels[v.id];
  const c = sim.calls[v.id];
  if (c && c.phase !== "alongside") {
    const kn = `${c.sog.toFixed(1)} kn`;
    if (c.lost) return { label: "AIS signal lost", tone: "brick", progress: 0, loading: false, active: false };
    if (c.phase === "sailed") return { label: `Sailed · ATD ${v.etd}`, tone: "slate", progress: 1, loading: false, active: false };
    if (c.phase === "anchored") return { label: v.delayMin ? `At anchor · ${v.delayMin} min late` : "At anchor · awaiting berth", tone: "amber", progress: 0, loading: false, active: false };
    if (c.phase === "berthing") return { label: "Berthing · tugs fast", tone: "harbor", progress: sim.arrivalProgress, loading: false, active: false };
    if (c.phase === "unberthing") return { label: "Unberthing · tugs fast", tone: "harbor", progress: 0, loading: false, active: false };
    if (c.phase === "outbound") return { label: `Outbound · ${kn}`, tone: "harbor", progress: 0, loading: false, active: false };
    return { label: `Inbound · ${kn}`, tone: "harbor", progress: 0, loading: false, active: false };
  }
  if (c && v.id !== "orient-lotus") return { label: `Cargo complete · ETD ${v.etd}`, tone: "moss", progress: 1, loading: true, active: false };
  if (v.id === "orient-lotus") return { label: "Discharging", tone: "signal", progress: live.discharged / v.dischargeTotal, loading: false, active: true };
  if (v.status === "loading") return { label: "Loading", tone: "moss", progress: live.loaded / v.loadTotal, loading: true, active: true };
  if (v.status === "discharging") return { label: "Discharging", tone: "signal", progress: live.discharged / v.dischargeTotal, loading: false, active: true };
  return { label: "Scheduled", tone: "slate", progress: 0, loading: false, active: false };
}

function VesselRow({ v }: { v: Vessel }) {
  const { setHovered } = usePort();
  const s = vesselLive(v);
  const g = vesselGroup(v);
  return (
    <li>
      <Link
        to={`/vessels/${v.id}`}
        onMouseEnter={() => setHovered({ kind: "vessel", id: v.id })}
        onMouseLeave={() => setHovered(null)}
        onFocus={() => setHovered({ kind: "vessel", id: v.id })}
        onBlur={() => setHovered(null)}
        className="group flex items-center gap-3 rounded-[11px] px-2.5 py-2.5 transition-colors hover:bg-sand/70"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] text-paper" style={{ background: v.hull }}>
          <Ship className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-[13.5px] font-bold text-ink">{v.name}</span>
            <span className="shrink-0 whitespace-nowrap font-mono text-[11.5px] text-slate tnum">B{v.berth}</span>
          </span>
          <span className="mt-0.5 block truncate text-[12px] text-slate">
            {v.line} · ETA <span className="font-mono">{v.eta}</span> · ETD <span className="font-mono">{v.etd}</span>
          </span>
          <span className="mt-1.5 flex items-center gap-2">
            <StatusChip tone={s.tone} pulse={g === "moving"}>
              {s.label}
            </StatusChip>
            {s.active ? <ProgressBar value={s.progress} tone={s.loading ? "moss" : "signal"} height="h-1.5" live /> : null}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate transition-transform group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}

export default function Vessels() {
  useSimTick();
  const { setPageSelection, setView } = usePort();
  useEffect(() => {
    setPageSelection(null);
    setView("vessels");
  }, [setPageSelection, setView]);

  const groups: Array<[VesselGroup, string]> = [
    ["moving", "Under way"],
    ["berth", "At berth"],
    ["anchored", "At anchor"],
    ["expected", "Expected today"],
    ["sailed", "Sailed"],
  ];
  const byGroup = (g: VesselGroup): Vessel[] => VESSELS.filter((v) => vesselGroup(v) === g);
  const atBerth = byGroup("berth").length;
  const coming = VESSELS.length - atBerth - byGroup("sailed").length;

  return (
    <HudLayout
      left={
        <Panel className="p-3" aria-label="Vessel list">
          <div className="px-2 pb-2 pt-1">
            <h1 className="text-[17px] font-bold text-ink">{CARRIER_NAME} at the terminal</h1>
            <p className="text-[12.5px] text-slate">
              {atBerth} at berth · {coming} on the move or due
            </p>
          </div>
          {groups.map(([g, label]) => {
            const list = byGroup(g);
            if (!list.length) return null;
            return (
              <div key={g}>
                <p className="eyebrow flex items-center gap-1.5 px-2 pb-1 pt-2.5">
                  {g === "moving" ? <span className="h-1.5 w-1.5 rounded-full bg-harbor pw-blink" /> : null}
                  {label} · {list.length}
                </p>
                <ul>
                  {list.map((v) => (
                    <VesselRow key={v.id} v={v} />
                  ))}
                </ul>
              </div>
            );
          })}
        </Panel>
      }
      right={
        <>
          <PortSchedule />
          <PortMovements />
        </>
      }
      bottom={<BerthSchedule />}
    />
  );
}
