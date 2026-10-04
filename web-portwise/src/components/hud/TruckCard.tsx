import { Link } from "react-router-dom";
import { Truck as TruckIcon, X } from "lucide-react";
import { truckById } from "@/data/port";
import { sim, simElapsedMin, useSimTick } from "@/sim/simStore";
import { usePort } from "@/state/PortProvider";
import { DefRow, IconButton, Panel, PanelHeader, StatusChip } from "./primitives";
import type { Tone } from "./primitives";

export const truckStatusTone = (status: string): Tone => {
  if (status === "Queued") return "amber";
  if (status === "Exiting" || status === "Departed" || status === "Back to terminal") return "moss";
  if (status === "Handling" || /^(Loading|Unloading|Grounding|Picking|Delivering)/.test(status)) return "signal";
  return "harbor";
};

export function TruckCard({ id }: { id: string }) {
  useSimTick();
  const { closeOverride } = usePort();
  const truck = truckById(id);
  if (!truck) return null;
  const status = sim.truckStatus[truck.id] ?? "—";
  const minutes = Math.max(0, Math.round((truck.baseWait ?? 1) + simElapsedMin()));

  return (
    <Panel className="w-full p-4" aria-label={`Truck ${truck.plate}`}>
      <PanelHeader
        eyebrow={truck.kind === "itv" ? "Terminal tractor" : truck.kind === "drayage" ? "Drayage truck · logistics district" : `External truck · ${truck.gate}`}
        title={<span className="font-mono">{truck.plate}</span>}
        icon={<TruckIcon className="h-5 w-5" />}
        right={
          <IconButton label="Close" onClick={closeOverride}>
            <X className="h-4 w-4" />
          </IconButton>
        }
      />
      <div className="mt-3 flex items-center gap-2 pl-[52px]">
        <StatusChip tone={truckStatusTone(status)}>{status}</StatusChip>
        <span className="text-[12px] text-slate">Camera following</span>
      </div>
      <dl className="mt-4">
        <DefRow label="Haulier" mono={false}>
          {truck.carrier}
        </DefRow>
        <DefRow label="Driver" mono={false}>
          {truck.driver}
        </DefRow>
        {truck.trip ? (
          <DefRow label="Run" mono={false}>
            {truck.facilityId ? (
              <Link to={`/logistics/${truck.facilityId}`} className="text-harbor underline-offset-2 hover:underline">
                {truck.trip}
              </Link>
            ) : (
              truck.trip
            )}
          </DefRow>
        ) : null}
        {truck.gate ? <DefRow label="Gate lane" mono={false}>{truck.gate}</DefRow> : null}
        {truck.kind === "drayage" ? null : <DefRow label="Time in terminal">{minutes} min</DefRow>}
        <DefRow label="Type">{truck.kind === "itv" ? "ITV tractor" : "Tractor + 40' chassis"}</DefRow>
        {truck.shipmentId ? (
          <DefRow label="Shipment">
            <Link to={`/shipments/${truck.shipmentId}`} className="text-harbor underline-offset-2 hover:underline">
              #{truck.shipmentId}
            </Link>
          </DefRow>
        ) : null}
      </dl>
    </Panel>
  );
}
