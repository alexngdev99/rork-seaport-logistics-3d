import { Suspense, lazy, useEffect } from "react";
import { BootScreen } from "@/components/BootScreen";
import { Outlet, useLocation } from "react-router-dom";
import { TopBar } from "@/components/hud/TopBar";
import { SearchDialog } from "@/components/hud/SearchDialog";
import { TimeBar } from "@/components/hud/TimeBar";
import { usePort } from "@/state/PortProvider";
import { useBootRevealed } from "@/state/boot";

const PortScene = lazy(() => import("@/three/PortScene"));

/** Persistent 3D scene + top bar; routes render floating HUD panels into the Outlet. */
export default function AppShell() {
  const { pathname } = useLocation();
  const { closeOverride } = usePort();
  const isRevealed = useBootRevealed();

  useEffect(() => {
    closeOverride();
  }, [pathname, closeOverride]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-canvas">
      <div className="absolute inset-x-0 bottom-0 top-16">
        <Suspense fallback={null}>
          <PortScene />
        </Suspense>
      </div>
      <TopBar />
      {/* HUD mounts as the boot screen lifts so its rise-in animations play in view. */}
      {isRevealed ? (
        <>
          <Outlet />
          <TimeBar />
        </>
      ) : null}
      <SearchDialog />
      <BootScreen />
    </div>
  );
}
