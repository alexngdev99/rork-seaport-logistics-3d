import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Crosshair, Link2, Share2 } from "lucide-react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { vesselById } from "@/data/port";
import { facilityById } from "@/data/facilities";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { fmtHeading, fmtLat, fmtLon, fmtRange, readView, shareUrl, viewFromLocation } from "@/lib/viewLink";
import type { SharedView } from "@/lib/viewLink";
import { cameraApi, cameraFit } from "@/three/CameraRig";
import { HUD_TOASTER_ID } from "./BerthingToasts";

const isTypingTarget = (e: KeyboardEvent): boolean =>
  Boolean((e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable='true'], [role='dialog']"));

const canNativeShare = (): boolean => typeof navigator !== "undefined" && typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches;

/** What the link opens besides the view: the page (and the vessel / site it is about). */
function pageLabel(pathname: string): string {
  const [, section, id] = pathname.split("/");
  if (section === "vessels" && id) return vesselById(id)?.short ?? "Vessel detail";
  if (section === "vessels") return "Vessels";
  if (section === "yard") return id ? `Yard · Block ${id}` : "Yard";
  if (section === "shipments") return id ? `Shipment ${id}` : "Shipments";
  if (section === "logistics") return id ? (facilityById(id)?.name ?? "Logistics") : "Logistics";
  return "Overview";
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Embedded previews often block the async clipboard; fall back to a hidden selection.
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    el.remove();
    return ok;
  }
}

/** Chart compass: the signal wedge is the camera's field of view, the inner ring its tilt. */
function ViewDial({ view }: { view: SharedView }) {
  const tilt = Math.max(0, Math.min(1, (view.pitch - 18) / (76 - 18)));
  return (
    <svg viewBox="0 0 76 76" className="h-[76px] w-[76px] shrink-0" aria-hidden="true">
      <circle cx="38" cy="38" r="35" fill="#F3EFE6" stroke="#E3DDD0" />
      <circle cx="38" cy="38" r="24" fill="none" stroke="#2C6FB0" strokeOpacity="0.18" strokeDasharray="2 3" />
      {Array.from({ length: 24 }, (_, i) => (
        <line
          key={i}
          x1="38"
          y1={i % 6 === 0 ? 5 : 6.5}
          x2="38"
          y2="9"
          stroke="#12233F"
          strokeOpacity={i % 6 === 0 ? 0.55 : 0.2}
          strokeWidth={i % 6 === 0 ? 1.2 : 0.8}
          transform={`rotate(${i * 15} 38 38)`}
        />
      ))}
      <text x="38" y="17.5" textAnchor="middle" fontSize="7" fontWeight="800" fill="#F2622E" fontFamily="'Be Vietnam Pro', sans-serif">
        N
      </text>
      <g style={{ transform: `rotate(${view.heading}deg)`, transformOrigin: "38px 38px", transition: "transform 380ms cubic-bezier(0.2, 0.8, 0.2, 1)" }}>
        <path d="M38 38 L28.5 13 A26 26 0 0 1 47.5 13 Z" fill="#F2622E" fillOpacity="0.2" />
        <path d="M38 38 L28.5 13 M38 38 L47.5 13" stroke="#F2622E" strokeWidth="1" strokeOpacity="0.7" />
      </g>
      <circle cx="38" cy="38" r={4 + tilt * 7} fill="none" stroke="#12233F" strokeOpacity="0.35" strokeWidth="1" style={{ transition: "r 380ms ease" }} />
      <circle cx="38" cy="38" r="3.2" fill="#12233F" stroke="#FFFDF8" strokeWidth="1.4" />
    </svg>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-slate">{label}</p>
      <p className="truncate font-mono text-[12px] font-semibold text-ink tnum">{value}</p>
    </div>
  );
}

let announcedSharedOpen = false;

/** Camera-rail button that turns the current 3D camera into a link (`?cam=lat,lon,alt,range,heading,pitch`). Shortcut: S. */
export function ShareViewButton() {
  // Re-renders on navigation so the link always carries the current page path.
  const { pathname } = useLocation();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [view, setView] = useState<SharedView | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const copiedTimer = useRef<number>(0);
  const [hasNativeShare] = useState<boolean>(canNativeShare);

  // Someone opened a shared link: say so once, with a way back to the page's own shot.
  useEffect(() => {
    if (announcedSharedOpen) return;
    announcedSharedOpen = true;
    const shared = viewFromLocation();
    if (!shared) return;
    const id = window.setTimeout(() => {
      toast("Opened a shared port view", {
        toasterId: HUD_TOASTER_ID,
        description: `${fmtLat(shared.lat)}, ${fmtLon(shared.lon)} · looking ${fmtHeading(shared.heading)}`,
        duration: 6000,
        icon: <Crosshair className="h-4 w-4 text-signal" />,
        classNames: {
          toast: "!rounded-[14px] !border-hairline !bg-paper !font-sans !text-ink !shadow-lift",
          description: "!font-mono !text-[11px] !text-slate",
        },
      });
    }, 900);
    return () => window.clearTimeout(id);
  }, []);

  // While open, follow the camera so the card always describes what the link will show.
  useEffect(() => {
    if (!isOpen) return;
    const c = cameraApi.current;
    if (!c) return;
    let frame = 0;
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setView(readView(c, cameraFit.current)));
    };
    sync();
    c.addEventListener("update", sync);
    c.addEventListener("rest", sync);
    return () => {
      cancelAnimationFrame(frame);
      c.removeEventListener("update", sync);
      c.removeEventListener("rest", sync);
    };
  }, [isOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.key.toLowerCase() !== "s" || isTypingTarget(e)) return;
      setIsOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

  const url = view ? shareUrl(view) : "";

  const onCopy = useCallback(async () => {
    if (!url) return;
    const ok = await copyText(url);
    if (!ok) {
      toast("Couldn't copy automatically", { description: "Select the link and copy it by hand.", toasterId: HUD_TOASTER_ID });
      return;
    }
    haptic("success");
    setIsCopied(true);
    window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setIsCopied(false), 1800);
  }, [url]);

  const onNativeShare = useCallback(async () => {
    if (!url) return;
    try {
      await navigator.share({ title: "Portwise · Pasir Panjang Terminal", text: `Port view: ${pageLabel(pathname)}`, url });
    } catch {
      // Dismissed share sheet: nothing to do.
    }
  }, [url, pathname]);

  const label = "Share this view (S)";
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          data-haptic="medium"
          className={cn(
            "group grid h-11 w-11 place-items-center rounded-[14px] border shadow-panel transition-[background-color,border-color,transform] duration-300 active:scale-90",
            isOpen ? "border-ink bg-ink text-paper" : "border-hairline bg-paper text-ink hover:bg-sand",
          )}
        >
          <Share2 className="h-[17px] w-[17px] transition-transform duration-300 group-hover:-rotate-12 group-active:scale-90" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="left"
        align="start"
        sideOffset={10}
        collisionPadding={12}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="w-[min(328px,calc(100vw-80px))] rounded-[18px] border-hairline bg-paper p-4 text-ink shadow-lift"
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-signal">Share this view</p>
        <p className="mt-0.5 text-[14px] font-semibold leading-snug">Send exactly what you're looking at. The link opens the map at this camera position.</p>

        <div className="mt-3 flex items-center gap-3 rounded-[14px] bg-sand/70 p-2.5">
          {view ? <ViewDial view={view} /> : <span className="h-[76px] w-[76px] shrink-0 rounded-full bg-sand" />}
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-3 gap-y-1.5">
            <div className="col-span-2 min-w-0">
              <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-slate">Looking at</p>
              <p className="truncate font-mono text-[12px] font-semibold text-ink tnum">{view ? `${fmtLat(view.lat)} ${fmtLon(view.lon)}` : "—"}</p>
            </div>
            <Stat label="Heading" value={view ? fmtHeading(view.heading) : "—"} />
            <Stat label="Range" value={view ? fmtRange(view.range) : "—"} />
            <Stat label="Tilt" value={view ? `${Math.round(view.pitch)}° down` : "—"} />
            <Stat label="Opens on" value={pageLabel(pathname)} />
          </div>
        </div>

        <label className="mt-3 flex h-11 items-center gap-2 rounded-[12px] border border-hairline bg-canvas pl-3 pr-1 focus-within:border-ink">
          <Link2 className="h-4 w-4 shrink-0 text-slate" aria-hidden="true" />
          <input
            readOnly
            value={url}
            aria-label="View link"
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 bg-transparent font-mono text-[16px] text-ink outline-none md:text-[11.5px]"
          />
          <button
            type="button"
            onClick={() => void onCopy()}
            data-haptic="off"
            aria-live="polite"
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] px-3 text-[12.5px] font-semibold transition-[background-color,transform] duration-200 active:scale-95",
              isCopied ? "bg-moss text-white" : "bg-ink text-paper hover:bg-[#1C3157]",
            )}
          >
            {isCopied ? <Check key="ok" className="h-3.5 w-3.5 pw-rise" /> : <Copy key="copy" className="h-3.5 w-3.5" />}
            {isCopied ? "Copied" : "Copy"}
          </button>
        </label>

        {hasNativeShare ? (
          <button
            type="button"
            onClick={() => void onNativeShare()}
            className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-signal text-[13px] font-semibold text-white transition-transform active:scale-[0.98]"
          >
            <Share2 className="h-4 w-4" />
            Share via…
          </button>
        ) : null}

        <p className="mt-2.5 text-[11.5px] leading-snug text-slate">
          Time and weather stay live for whoever opens it. Move the map and the link updates.
        </p>
      </PopoverContent>
    </Popover>
  );
}
