import { useEffect } from "react";
import { Eye, EyeOff, Home, Minus, Moon, Plus, RotateCw, Sun } from "lucide-react";
import { cameraApi } from "@/three/CameraRig";
import { usePort } from "@/state/PortProvider";
import { nightMode, useNightMode } from "@/state/nightMode";
import { hudVisibility, useHudHidden } from "@/state/hudVisibility";
import { cn } from "@/lib/utils";

/** Day / night switch for the 3D scene. Shortcut: N. */
function NightToggle() {
  const night = useNightMode();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.key.toLowerCase() !== "n") return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, [contenteditable='true'], [role='dialog']")) return;
      nightMode.toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const label = night ? "Switch to day view (N)" : "Switch to night view (N)";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={night}
      aria-label={label}
      title={label}
      onClick={() => nightMode.toggle()}
      data-haptic="medium"
      className={cn(
        "group relative grid h-11 w-11 place-items-center overflow-hidden rounded-[14px] border shadow-panel transition-[background-color,border-color,transform] duration-500 active:scale-90",
        night ? "border-[#2A3B57] bg-[#12233F] text-[#FFC274]" : "border-hairline bg-paper text-ink hover:bg-sand",
      )}
    >
      <Sun className={cn("absolute h-[19px] w-[19px] transition-all duration-500", night ? "translate-y-6 rotate-90 opacity-0" : "translate-y-0 rotate-0 opacity-100")} />
      <Moon className={cn("absolute h-[18px] w-[18px] fill-current transition-all duration-500", night ? "translate-y-0 rotate-0 opacity-100" : "-translate-y-6 -rotate-90 opacity-0")} />
      <span className={cn("absolute right-2 top-2 h-1 w-1 rounded-full bg-[#FFE0A6] transition-opacity duration-700", night ? "opacity-90" : "opacity-0")} />
      <span className={cn("absolute bottom-2.5 left-2 h-[3px] w-[3px] rounded-full bg-[#FFE0A6] transition-opacity delay-150 duration-700", night ? "opacity-70" : "opacity-0")} />
    </button>
  );
}

/** Hides every floating panel so the whole map is visible. Shortcut: H. */
function HudToggle() {
  const hidden = useHudHidden();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.key.toLowerCase() !== "h") return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, [contenteditable='true'], [role='dialog']")) return;
      hudVisibility.toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const label = hidden ? "Show panels (H)" : "Hide panels to see the full map (H)";
  return (
    <button
      type="button"
      aria-pressed={hidden}
      aria-label={label}
      title={label}
      onClick={() => hudVisibility.toggle()}
      data-haptic="medium"
      className={cn(
        "flex h-11 items-center justify-center gap-2 rounded-[14px] border shadow-panel transition-[background-color,border-color,width,transform] duration-300 active:scale-95",
        hidden ? "border-ink bg-ink px-3.5 text-paper hover:bg-[#1C3157]" : "w-11 border-hairline bg-paper text-ink hover:bg-sand",
      )}
    >
      {hidden ? <Eye className="h-[18px] w-[18px]" /> : <EyeOff className="h-[18px] w-[18px]" />}
      {hidden ? <span className="whitespace-nowrap text-[13px] font-semibold">Show panels</span> : null}
    </button>
  );
}

export function CameraRail() {
  const { goHome } = usePort();
  const btn = "grid h-11 w-11 place-items-center text-ink transition-colors hover:bg-sand active:bg-sand lg:h-10 lg:w-10";
  return (
    <div className="pointer-events-auto flex flex-col items-end gap-2">
    <HudToggle />
    <NightToggle />
    <div role="toolbar" aria-label="Camera controls" aria-orientation="vertical" className="panel flex flex-col overflow-hidden [@media(max-height:559px)]:hidden">
      {/* Phones pinch to zoom, so the +/- buttons are tablet/desktop only. */}
      <button type="button" className={`${btn} max-md:hidden`} aria-label="Zoom in" title="Zoom in" onClick={() => void cameraApi.current?.dolly(30, true)}>
        <Plus className="h-[18px] w-[18px]" />
      </button>
      <button type="button" className={`${btn} border-t border-hairline max-md:hidden`} aria-label="Zoom out" title="Zoom out" onClick={() => void cameraApi.current?.dolly(-30, true)}>
        <Minus className="h-[18px] w-[18px]" />
      </button>
      <button type="button" className={`${btn} border-hairline md:border-t`} aria-label="Rotate 45°" title="Rotate 45°" onClick={() => void cameraApi.current?.rotate(Math.PI / 4, 0, true)}>
        <RotateCw className="h-[17px] w-[17px]" />
      </button>
      <button type="button" className={`${btn} border-t border-hairline`} aria-label="Reset view" title="Reset view" onClick={goHome}>
        <Home className="h-[17px] w-[17px]" />
      </button>
    </div>
    </div>
  );
}
