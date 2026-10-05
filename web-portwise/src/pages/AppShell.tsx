import { Suspense, lazy, useEffect } from "react";
import { BootScreen } from "@/components/BootScreen";
import { Outlet, useLocation } from "react-router-dom";
import { TopBar } from "@/components/hud/TopBar";
import { SearchDialog } from "@/components/hud/SearchDialog";
import { TimeBar, TimeKeys } from "@/components/hud/TimeBar";
import { useIsCompact } from "@/hooks/useMediaQuery";
import { usePort } from "@/state/PortProvider";
import { useBootRevealed } from "@/state/boot";
import { installTapHaptics } from "@/lib/haptics";

const PortScene = lazy(() => import("@/three/PortScene"));

/** Persistent 3D scene + top bar; routes render floating HUD panels into the Outlet. */
export default function AppShell() {
  const { pathname } = useLocation();
  const { closeOverride } = usePort();
  const isRevealed = useBootRevealed();
  const isCompact = useIsCompact();

  useEffect(() => installTapHaptics(), []);

  useEffect(() => {
    closeOverride();
  }, [pathname, closeOverride]);

  return (
    <div className="pw-app relative w-full overflow-hidden bg-canvas">
      <div className="absolute inset-x-0 bottom-0 top-[var(--hud-top)]">
        <Suspense fallback={null}>
          <PortScene />
        </Suspense>
      </div>
      <TopBar />
      {/* HUD mounts as the boot screen lifts so its rise-in animations play in view. */}
      {isRevealed ? (
        <>
          <Outlet />
          <TimeKeys />
          {/* On phones and tablets the time controls live in the bottom sheet header. */}
          {isCompact ? null : <TimeBar />}
        </>
      ) : null}
      <SearchDialog />
      <BootScreen />
    </div>
  );
}
