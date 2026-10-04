import { Suspense, lazy, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { TopBar } from "@/components/hud/TopBar";
import { SearchDialog } from "@/components/hud/SearchDialog";
import { TimeBar } from "@/components/hud/TimeBar";
import { usePort } from "@/state/PortProvider";

const PortScene = lazy(() => import("@/three/PortScene"));

function SceneLoader() {
  return (
    <div className="absolute inset-0 grid place-items-center bg-canvas">
      <div className="flex flex-col items-center gap-3 text-slate">
        <img src="/icon.png" alt="" className="h-14 w-14 animate-pulse rounded-[14px]" />
        <p className="text-[13px] font-medium">Building the 3D terminal…</p>
      </div>
    </div>
  );
}

/** Persistent 3D scene + top bar; routes render floating HUD panels into the Outlet. */
export default function AppShell() {
  const { pathname } = useLocation();
  const { closeOverride } = usePort();

  useEffect(() => {
    closeOverride();
  }, [pathname, closeOverride]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-canvas">
      <div className="absolute inset-x-0 bottom-0 top-16">
        <Suspense fallback={<SceneLoader />}>
          <PortScene />
        </Suspense>
      </div>
      <TopBar />
      <Outlet />
      <TimeBar />
      <SearchDialog />
    </div>
  );
}
