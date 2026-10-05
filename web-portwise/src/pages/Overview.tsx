import { useEffect } from "react";
import { HudLayout } from "@/components/hud/HudLayout";
import { KpiStack } from "@/components/hud/KpiStack";
import { AlertsPanel } from "@/components/hud/AlertsPanel";
import { BerthSchedule } from "@/components/hud/BerthSchedule";
import { PortSchedule } from "@/components/hud/PortSchedule";
import { usePort } from "@/state/PortProvider";

export default function Overview() {
  const { setPageSelection, setView } = usePort();
  useEffect(() => {
    setPageSelection(null);
    setView("overview");
  }, [setPageSelection, setView]);

  return <HudLayout left={<KpiStack />} right={
        <>
          <AlertsPanel />
          <PortSchedule />
        </>
      } bottom={<BerthSchedule />} />;
}
