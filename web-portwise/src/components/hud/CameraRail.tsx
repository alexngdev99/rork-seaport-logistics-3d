import { useEffect, useState } from "react";
import { Eye, EyeOff, Home, Maximize, Minimize, Minus, Plus, RotateCw, Share, SquarePlus } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fullscreen, useIsFullscreen, type FullscreenSupport } from "@/state/fullscreen";
import { cameraApi } from "@/three/CameraRig";
import { usePort } from "@/state/PortProvider";
import { SkyWeatherButton } from "./SkyWeather";
import { hudVisibility, useHudHidden } from "@/state/hudVisibility";
import { cn } from "@/lib/utils";

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

const isTypingTarget = (e: KeyboardEvent): boolean =>
  Boolean((e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable='true'], [role='dialog']"));

/** iPhone Safari has no element fullscreen: the only way to lose the browser bars is a Home Screen launch. */
function IosInstallHint() {
  const step = "flex items-start gap-2.5 text-[13px] leading-snug text-ink";
  const num = "mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sand font-mono text-[11px] font-bold text-ink";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Full screen map"
          title="Full screen map"
          className="grid h-11 w-11 place-items-center rounded-[14px] border border-hairline bg-paper text-ink shadow-panel transition-[background-color,transform] duration-300 hover:bg-sand active:scale-90"
        >
          <Maximize className="h-[18px] w-[18px]" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="left" align="start" sideOffset={10} collisionPadding={12} className="w-[272px] rounded-[16px] border-hairline bg-paper p-4 text-ink shadow-lift">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-signal">Full screen on iPhone</p>
        <p className="mt-1 text-[14px] font-semibold leading-snug">Safari keeps its bars on websites. Add Portwise to your Home Screen to open the map edge to edge.</p>
        <ol className="mt-3 flex flex-col gap-2">
          <li className={step}>
            <span className={num}>1</span>
            <span>
              Tap <Share className="mx-0.5 inline h-[15px] w-[15px] -translate-y-px text-harbor" aria-label="Share" /> Share in Safari's toolbar
            </span>
          </li>
          <li className={step}>
            <span className={num}>2</span>
            <span>
              Choose <SquarePlus className="mx-0.5 inline h-[15px] w-[15px] -translate-y-px" aria-hidden="true" /> <b className="font-semibold">Add to Home Screen</b>
            </span>
          </li>
          <li className={step}>
            <span className={num}>3</span>
            <span>Open Portwise from the new icon, with no browser bar</span>
          </li>
        </ol>
        <button
          type="button"
          onClick={() => hudVisibility.set(true)}
          className="mt-3.5 w-full rounded-[12px] bg-sand px-3 py-2.5 text-left text-[12.5px] font-semibold text-ink transition-colors hover:bg-hairline"
        >
          Meanwhile: hide panels for more map <span className="font-mono text-[11px] text-ink/50">(H)</span>
        </button>
      </PopoverContent>
    </Popover>
  );
}

/** Browser fullscreen: hides the address bar and system bars so the 3D map fills the screen. Shortcut: F. */
function FullscreenToggle() {
  const [support] = useState<FullscreenSupport>(() => fullscreen.support());
  const isActive = useIsFullscreen();

  useEffect(() => {
    if (support !== "api") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.key.toLowerCase() !== "f" || isTypingTarget(e)) return;
      void fullscreen.toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [support]);

  if (support === "ios-install") return <IosInstallHint />;
  // Home Screen / installed launches already have no browser chrome.
  if (support !== "api") return null;

  const label = isActive ? "Exit full screen (F)" : "Full screen map (F)";
  const onClick = async () => {
    if (isActive) {
      await fullscreen.exit();
      return;
    }
    const ok = await fullscreen.enter();
    if (!ok) toast("Full screen isn't available here", { description: "Try hiding the panels (H) for a clearer map." });
  };
  return (
    <button
      type="button"
      aria-pressed={isActive}
      aria-label={label}
      title={label}
      onClick={() => void onClick()}
      data-haptic="medium"
      className={cn(
        "group grid h-11 w-11 place-items-center rounded-[14px] border shadow-panel transition-[background-color,border-color,transform] duration-300 active:scale-90",
        isActive ? "border-ink bg-ink text-paper hover:bg-[#1C3157]" : "border-hairline bg-paper text-ink hover:bg-sand",
      )}
    >
      {isActive ? (
        <Minimize className="h-[18px] w-[18px] transition-transform duration-300 group-active:scale-75" />
      ) : (
        <Maximize className="h-[18px] w-[18px] transition-transform duration-300 group-hover:scale-110 group-active:scale-125" />
      )}
    </button>
  );
}

export function CameraRail() {
  const { goHome } = usePort();
  const btn = "grid h-11 w-11 place-items-center text-ink transition-colors hover:bg-sand active:bg-sand lg:h-10 lg:w-10";
  return (
    <div className="pointer-events-auto flex flex-col items-end gap-2">
    <HudToggle />
    <SkyWeatherButton />
    <FullscreenToggle />
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
