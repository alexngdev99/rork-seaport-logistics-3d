import type { ReactNode } from "react";
import { usePort } from "@/state/PortProvider";
import { useHudHidden } from "@/state/hudVisibility";
import { cn } from "@/lib/utils";
import { CameraRail } from "./CameraRail";
import { CraneCard } from "./CraneCard";
import { TruckCard } from "./TruckCard";

interface HudLayoutProps {
  left?: ReactNode;
  right?: ReactNode;
  bottom?: ReactNode;
  bottomLeft?: ReactNode;
  wideLeft?: boolean;
}

/**
 * Floating HUD frame over the 3D scene. The frame itself ignores pointer events so the
 * scene stays draggable; panels opt back in. Crane/truck inspectors replace the right column.
 */
export function HudLayout({ left, right, bottom, bottomLeft, wideLeft }: HudLayoutProps) {
  const { overrideSelection } = usePort();
  const hidden = useHudHidden();
  const fade = cn("transition-[opacity,transform,visibility] duration-300", hidden && "invisible opacity-0");
  const inspector =
    overrideSelection?.kind === "crane" ? (
      <CraneCard key={overrideSelection.id} id={overrideSelection.id} />
    ) : overrideSelection?.kind === "truck" ? (
      <TruckCard key={overrideSelection.id} id={overrideSelection.id} />
    ) : null;

  return (
    <div className={cn("pointer-events-none absolute inset-x-0 top-16 z-20 flex flex-col gap-3 p-3 md:p-4", hidden ? "bottom-0" : "bottom-[72px] md:bottom-[76px]")}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 md:flex-row">
        <div className={cn("flex min-h-0 shrink-0 flex-col justify-between gap-3", wideLeft ? "md:w-[320px]" : "md:w-[248px]", fade, hidden && "-translate-x-6")}>
          <div className="scroll-thin flex max-h-[34vh] min-h-0 flex-col gap-3 overflow-y-auto md:max-h-none">{left}</div>
          {bottomLeft ? <div className="hidden md:block">{bottomLeft}</div> : null}
        </div>
        <div className="min-h-0 flex-1" />
        <div className="flex min-h-0 shrink-0 flex-col items-end justify-between gap-3 md:w-[380px]">
          <div className={cn("scroll-thin flex max-h-[40vh] min-h-0 w-full flex-col gap-3 overflow-y-auto md:max-h-full", fade, hidden && "translate-x-6")}>{inspector ?? right}</div>
          <CameraRail />
        </div>
      </div>
      {bottom && !hidden ? <div className="shrink-0">{bottom}</div> : null}
    </div>
  );
}
