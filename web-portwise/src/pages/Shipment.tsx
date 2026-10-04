import { useEffect } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Check, ChevronDown, Container as ContainerIcon, MapPin } from "lucide-react";
import { HudLayout } from "@/components/hud/HudLayout";
import { Panel, StatusChip } from "@/components/hud/primitives";
import { truckStatusTone } from "@/components/hud/TruckCard";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { GATE_TRUCK_IDS, truckById, vesselById } from "@/data/port";
import { FEATURED_SHIPMENT_IDS, containerById, shipmentById } from "@/data/containers";
import type { Shipment as ShipmentT } from "@/data/types";
import { cn } from "@/lib/utils";
import { sim, simElapsedMin, useSimTick } from "@/sim/simStore";
import { usePort } from "@/state/PortProvider";

function GateTable() {
  useSimTick();
  const { open, selection } = usePort();
  return (
    <Panel className="w-full p-4" aria-label="Gate traffic">
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-bold text-ink">Gate traffic</h2>
        <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-moss">
          <span className="h-1.5 w-1.5 rounded-full bg-moss pw-blink" />
          Live
        </span>
      </div>
      <table className="mt-2 w-full text-left text-[12.5px]">
        <thead>
          <tr className="text-[10.5px] uppercase tracking-wider text-slate">
            <th className="py-1.5 font-semibold">Plate</th>
            <th className="py-1.5 font-semibold">Haulier</th>
            <th className="py-1.5 font-semibold">Gate</th>
            <th className="whitespace-nowrap py-1.5 font-semibold">Status</th>
            <th className="py-1.5 text-right font-semibold">Time</th>
          </tr>
        </thead>
        <tbody>
          {GATE_TRUCK_IDS.map((id) => {
            const t = truckById(id);
            if (!t) return null;
            const status = sim.truckStatus[id] ?? "—";
            const minutes = Math.max(0, Math.round((t.baseWait ?? 1) + simElapsedMin()));
            const active = selection?.kind === "truck" && selection.id === id;
            return (
              <tr
                key={id}
                tabIndex={0}
                onClick={() => open({ kind: "truck", id })}
                onKeyDown={(e) => e.key === "Enter" && open({ kind: "truck", id })}
                className={cn("cursor-pointer border-t border-hairline/70 transition-colors hover:bg-sand/60", active && "bg-signal-soft/60")}
              >
                <td className="whitespace-nowrap py-2 pr-2 font-mono font-bold text-ink">{t.plate}</td>
                <td className="max-w-[84px] truncate py-2 pr-2 text-ink">{t.carrier}</td>
                <td className="py-2 text-slate">{t.gate?.replace("Gate ", "")}</td>
                <td className="py-2">
                  <StatusChip tone={truckStatusTone(status)} dot={false}>
                    {status}
                  </StatusChip>
                </td>
                <td className="py-2 text-right font-mono text-slate tnum">{minutes}′</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}

function Journey({ s }: { s: ShipmentT }) {
  const navigate = useNavigate();
  const vessel = vesselById(s.vesselId);
  const container = containerById(s.containerIds[0]);
  const done = s.current >= s.steps.length;
  return (
    <Panel className="flex flex-col gap-4 px-4 py-4 md:flex-row md:items-stretch md:px-6" aria-label="Shipment journey">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="text-[17px] font-bold text-ink">Shipment journey</h1>
          <p className="text-[12.5px] text-slate">{s.direction === "import" ? "Import" : "Export"} · live progress through the terminal</p>
        </div>
        <div className="scroll-thin overflow-x-auto">
          <ol className="relative mt-5 grid min-w-[620px] grid-cols-6">
            {s.steps.map((step, i) => {
              const state = i < s.current ? "done" : i === s.current ? "current" : "todo";
              return (
                <li key={step.label} className="relative flex flex-col items-center text-center">
                  {i < s.steps.length - 1 ? (
                    <span className={cn("absolute left-1/2 top-[17px] h-[3px] w-full", i < s.current ? "bg-ink" : "bg-hairline")} aria-hidden="true" />
                  ) : null}
                  <span
                    className={cn(
                      "relative z-10 grid h-9 w-9 place-items-center rounded-full border-[3px] font-mono text-[13px] font-bold",
                      state === "done" && "border-ink bg-ink text-paper",
                      state === "current" && "pw-pulse border-signal bg-paper text-signal",
                      state === "todo" && "border-hairline bg-paper text-slate",
                    )}
                    aria-current={state === "current" ? "step" : undefined}
                  >
                    {state === "done" ? <Check className="h-4 w-4" strokeWidth={3} /> : state === "current" ? <span className="h-3 w-3 rounded-full bg-signal" /> : i + 1}
                  </span>
                  <span className={cn("mt-2 text-[13.5px] font-semibold", state === "todo" ? "text-slate" : "text-ink")}>{step.label}</span>
                  <span className={cn("font-mono text-[12px] tnum", state === "current" ? "text-signal" : "text-slate")}>{step.time}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      <div className="shrink-0 border-hairline md:w-[320px] md:border-l md:pl-6">
        <div className="flex items-center justify-between gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-md font-mono text-[20px] font-bold text-ink hover:text-signal">
              #{s.id}
              <ChevronDown className="h-4 w-4 text-slate" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              {FEATURED_SHIPMENT_IDS.map((id) => (
                <DropdownMenuItem key={id} onSelect={() => navigate(`/shipments/${id}`)} className="flex justify-between">
                  <span className="font-mono font-semibold">#{id}</span>
                  <span className="truncate pl-2 text-xs text-slate">{shipmentById(id)?.destination}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <StatusChip tone={done ? "moss" : "signal"} pulse={!done}>
            {done ? "Completed" : "In progress"}
          </StatusChip>
        </div>
        <p className="mt-2 flex items-start gap-2 text-[13px] text-ink">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-harbor" />
          {s.direction === "import" ? "Deliver to" : "Bound for"}: {s.destination}
        </p>
        <p className="mt-1 pl-6 text-[12px] text-slate">{s.consignee}</p>
        <div className="mt-3 flex items-center gap-3 border-t border-hairline pt-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-sand text-ink">
            <ContainerIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1 text-[12.5px]">
            <p className="font-semibold text-ink">{s.sizeLabel}</p>
            <p className="truncate text-slate">
              {s.cargo} · {vessel?.short}
            </p>
          </div>
          {container ? (
            <Link to={`/yard/${container.blockId}?c=${container.id}`} className="flex items-center gap-1 text-[12px] font-semibold text-harbor hover:underline">
              {container.position} <ArrowRight className="h-3 w-3" />
            </Link>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

export default function Shipment() {
  const { id = "" } = useParams();
  const s = shipmentById(id);
  const { setPageSelection, setView } = usePort();

  useEffect(() => {
    setView("gate");
    if (s) setPageSelection({ kind: "shipment", id: s.id });
  }, [s, setPageSelection, setView]);

  if (!s) return <Navigate to="/shipments/SHP-20931" replace />;
  return <HudLayout right={<GateTable />} bottom={<Journey s={s} />} />;
}
