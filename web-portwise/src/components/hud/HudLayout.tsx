import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { selKey, usePort } from "@/state/PortProvider";
import { useHudHidden } from "@/state/hudVisibility";
import { sheet } from "@/state/sheet";
import { useIsCompact, useIsPhone, useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { CameraRail } from "./CameraRail";
import { CraneCard } from "./CraneCard";
import { TruckCard } from "./TruckCard";
import { BottomSheet, SideDock } from "./BottomSheet";
import { TimeControls } from "./TimeBar";

type Slot = "left" | "right" | "bottom" | "bottomLeft";

interface HudLayoutProps {
  left?: ReactNode;
  right?: ReactNode;
  bottom?: ReactNode;
  bottomLeft?: ReactNode;
  wideLeft?: boolean;
  /** Order of the panels when they stack in the phone/tablet sheet. Detail cards usually go first. */
  sheetOrder?: Slot[];
}

const DEFAULT_ORDER: Slot[] = ["left", "right", "bottom", "bottomLeft"];
const LANDSCAPE_SHORT = "(max-height: 559px) and (orientation: landscape)";
/** Scrubber (36) + transport row (44) + padding. */
const STACKED_H = 88;

let hintShown = false;

/** One-time touch gesture hint over the map. */
function GestureHint() {
  const [isVisible, setIsVisible] = useState<boolean>(() => !hintShown && window.matchMedia("(pointer: coarse)").matches);
  useEffect(() => {
    if (!isVisible) return;
    hintShown = true;
    const t = window.setTimeout(() => setIsVisible(false), 5200);
    return () => window.clearTimeout(t);
  }, [isVisible]);
  return (
    <div
      className={cn(
        "pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink/90 px-3.5 py-2 text-[12px] font-semibold text-paper shadow-lift transition-[opacity,transform] duration-500",
        isVisible ? "pw-rise opacity-100" : "-translate-y-2 opacity-0",
      )}
      aria-hidden="true"
    >
      Drag to pan · Pinch to zoom · Two fingers to rotate
    </div>
  );
}

/**
 * Floating HUD frame over the 3D scene.
 * Desktop / iPad landscape: side columns + bottom strip. The frame ignores pointer events so the scene
 * stays draggable; panels opt back in.
 * Phones / iPad portrait: everything stacks into a draggable bottom sheet whose header holds the time controls.
 * Short landscape phones: a scrollable side dock.
 * Crane/truck inspectors replace the right column (and come first in the sheet).
 */
export function HudLayout({ left, right, bottom, bottomLeft, wideLeft, sheetOrder = DEFAULT_ORDER }: HudLayoutProps) {
  const { overrideSelection } = usePort();
  const hidden = useHudHidden();
  const isCompact = useIsCompact();
  const isPhone = useIsPhone();
  const isLandscapeShort = useMediaQuery(LANDSCAPE_SHORT);
  const { pathname, search } = useLocation();
  const inspector =
    overrideSelection?.kind === "crane" ? (
      <CraneCard key={overrideSelection.id} id={overrideSelection.id} />
    ) : overrideSelection?.kind === "truck" ? (
      <TruckCard key={overrideSelection.id} id={overrideSelection.id} />
    ) : null;

  const focusKey = `${pathname}${search}|${selKey(overrideSelection)}`;
  useEffect(() => {
    if (isCompact) sheet.focus(focusKey, pathname === "/");
  }, [focusKey, isCompact, pathname]);

  if (isCompact) {
    const slots: Record<Slot, ReactNode> = { left, right: inspector ? null : right, bottom, bottomLeft };
    const content = (
      <>
        {inspector}
        {sheetOrder.map((s) => (slots[s] ? <div key={s} className="contents">{slots[s]}</div> : null))}
      </>
    );
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[var(--hud-top)] z-20">
        <div className="absolute right-[max(12px,env(safe-area-inset-right))] top-3 z-10">
          <CameraRail />
        </div>
        <GestureHint />
        {isLandscapeShort ? (
          <SideDock hidden={hidden} headerHeight={STACKED_H} header={<TimeControls stacked />}>
            {content}
          </SideDock>
        ) : (
          <BottomSheet hidden={hidden} headerHeight={isPhone ? STACKED_H : 60} header={<TimeControls stacked={isPhone} />}>
            {content}
          </BottomSheet>
        )}
      </div>
    );
  }

  const fade = cn("transition-[opacity,transform,visibility] duration-300", hidden && "invisible opacity-0");
  return (
    <div className={cn("pointer-events-none absolute inset-x-0 top-[var(--hud-top)] z-20 flex flex-col gap-3 p-4", hidden ? "bottom-0" : "bottom-[calc(76px+var(--sab))]")}>
      <div className="flex min-h-0 flex-1 flex-row gap-3">
        <div className={cn("flex min-h-0 shrink-0 flex-col justify-between gap-3", wideLeft ? "w-[320px]" : "w-[248px]", fade, hidden && "-translate-x-6")}>
          <div className="scroll-thin flex min-h-0 flex-col gap-3 overflow-y-auto">{left}</div>
          {bottomLeft ? <div>{bottomLeft}</div> : null}
        </div>
        <div className="min-h-0 flex-1" />
        <div className="flex min-h-0 w-[380px] shrink-0 flex-col items-end justify-between gap-3">
          <div className={cn("scroll-thin flex max-h-full min-h-0 w-full flex-col gap-3 overflow-y-auto", fade, hidden && "translate-x-6")}>{inspector ?? right}</div>
          <CameraRail />
        </div>
      </div>
      {bottom && !hidden ? <div className="shrink-0">{bottom}</div> : null}
    </div>
  );
}
