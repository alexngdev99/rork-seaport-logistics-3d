import { useState } from "react";
import { ArrowRight, ChevronRight } from "lucide-react";
import type { Alert } from "@/data/types";
import { cn } from "@/lib/utils";
import { useSimTick, visibleAlerts } from "@/sim/simStore";
import { usePort } from "@/state/PortProvider";
import { Panel } from "./primitives";

const DOT: Record<Alert["severity"], string> = {
  danger: "bg-brick",
  warning: "bg-amber",
  info: "bg-harbor",
  success: "bg-moss",
};

export function AlertRow({ alert, onOpen, expanded }: { alert: Alert; onOpen: () => void; expanded?: boolean }) {
  return (
    <li>
      <button type="button" onClick={onOpen} className="group flex w-full items-start gap-3 rounded-[10px] px-2 py-2.5 text-left transition-colors hover:bg-sand/70">
        <span className={cn("mt-[5px] h-2.5 w-2.5 shrink-0 rounded-full", DOT[alert.severity], alert.severity === "danger" && "pw-pulse")} />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold leading-snug text-ink">{alert.title}</span>
          {expanded ? <span className="mt-0.5 block text-[12px] leading-snug text-slate">{alert.detail}</span> : null}
        </span>
        <span className="font-mono text-[11.5px] text-slate tnum">{alert.time}</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate transition-transform group-hover:translate-x-0.5" />
      </button>
    </li>
  );
}

export function AlertsPanel() {
  useSimTick();
  const { open } = usePort();
  const [all, setAll] = useState<boolean>(false);
  const alerts = visibleAlerts();
  const list = all ? alerts : alerts.slice(0, 3);
  return (
    <Panel className="w-full p-3" aria-label="Alerts">
      <div className="flex items-center justify-between px-2 pb-1 pt-1">
        <h2 className="text-[16px] font-bold text-ink">Alerts</h2>
        <button type="button" onClick={() => setAll((v) => !v)} className="flex items-center gap-1 rounded-md text-[12.5px] font-semibold text-harbor hover:underline">
          {all ? "Show less" : `View all (${alerts.length})`}
          <ArrowRight className={cn("h-3.5 w-3.5 transition-transform", all && "-rotate-90")} />
        </button>
      </div>
      {list.length ? (
        <ul className="divide-y divide-hairline/70">
          {list.map((a) => (
            <AlertRow key={a.id} alert={a} expanded={all} onOpen={() => open(a.target)} />
          ))}
        </ul>
      ) : (
        <p className="px-2 py-3 text-[12.5px] text-slate">No alerts at this point in time.</p>
      )}
    </Panel>
  );
}
