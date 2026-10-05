import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode, WheelEvent as ReactWheelEvent } from "react";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { hudInset } from "@/state/hudInset";
import { sheet, useSheetSnap } from "@/state/sheet";
import type { SheetSnap } from "@/state/sheet";

const HANDLE_H = 26;
/** How much of the first panel peeks above the fold when collapsed. */
const PEEK_CONTENT = 92;
const SNAPS: SheetSnap[] = ["peek", "half", "full"];
const EASE = "transform 420ms cubic-bezier(0.22, 0.9, 0.24, 1)";
const DOCK_FADE = "opacity 300ms ease, transform 300ms ease";

/** `sheet`: bottom sheet (portrait). `dock`: left column (short landscape, e.g. a phone on its side). */
export type PanelMode = "sheet" | "dock";

interface Heights {
  peek: number;
  half: number;
  full: number;
}

interface DragState {
  startY: number;
  startVisible: number;
  lastY: number;
  lastT: number;
  v: number;
  moved: boolean;
  startSnap: SheetSnap;
  /** Detent the finger is currently nearest to, for crossing ticks while dragging. */
  near: SheetSnap;
  /** Whether the sheet is currently stretched past an outer detent. */
  isStretched: boolean;
}

interface PanelSheetProps {
  mode: PanelMode;
  header: ReactNode;
  headerHeight: number;
  children: ReactNode;
  hidden: boolean;
}

const nearestSnap = (vis: number, h: Heights): SheetSnap => SNAPS.reduce((best, s) => (Math.abs(h[s] - vis) < Math.abs(h[best] - vis) ? s : best), "peek" as SheetSnap);

/** Detent changes by tap / keyboard: a light tick, slightly firmer when the sheet opens fully. */
const setSnapWithHaptic = (next: SheetSnap): void => {
  if (next === sheet.get()) return;
  haptic(next === "full" ? "medium" : "light");
  sheet.set(next);
};

const translateFor = (vis: number, h: Heights): string => `translate3d(0, ${h.full - vis + (vis === 0 ? 24 : 0)}px, 0)`;

/**
 * Phone / tablet HUD container.
 * Portrait: a draggable bottom sheet with peek, half and full detents (Apple Maps pattern). The header
 * (time controls) stays visible at every detent; content only scrolls at full height, so vertical swipes
 * elsewhere move the sheet.
 * Short landscape: the same element docks as a scrollable left column.
 * Both modes share one element tree, so rotating the device restyles the panels in place: nothing
 * remounts, and panel state, scroll position and the sheet detent all survive the rotation.
 */
export function PanelSheet({ mode, header, headerHeight, children, hidden }: PanelSheetProps) {
  const snap = useSheetSnap();
  const isDock = mode === "dock";
  const layerRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const modeRef = useRef<PanelMode>(mode);
  modeRef.current = mode;
  const [avail, setAvail] = useState<number>(() => (typeof window === "undefined" ? 700 : window.innerHeight - 56));
  const [sab, setSab] = useState<number>(0);

  useLayoutEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const measure = () => {
      setAvail(layer.clientHeight);
      setSab(probeRef.current?.offsetHeight ?? 0);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(layer);
    return () => ro.disconnect();
  }, []);

  const heights = useMemo<Heights>(() => {
    const full = Math.max(220, avail - 8);
    const peek = Math.min(full, HANDLE_H + headerHeight + PEEK_CONTENT + sab);
    const half = Math.min(full, Math.max(peek + 140, Math.round(avail * 0.52)));
    return { peek, half, full };
  }, [avail, sab, headerHeight]);
  const heightsRef = useRef<Heights>(heights);
  heightsRef.current = heights;

  const visible = hidden ? 0 : heights[snap];

  // Tell the 3D camera how much of the map is covered so focused objects stay centred in what is left.
  useEffect(() => {
    if (!isDock) hudInset.set(0, hidden ? 0 : Math.min(visible, heights.half));
  }, [isDock, hidden, visible, heights.half]);
  useLayoutEffect(() => {
    const el = sheetRef.current;
    if (!isDock || !el) return;
    const update = () => hudInset.set(hidden ? 0 : el.offsetWidth + el.offsetLeft, 0);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isDock, hidden]);
  useEffect(() => () => hudInset.set(0, 0), []);

  // Rotation: cancel any half-finished drag and fade the panels into their new shape.
  const lastMode = useRef<PanelMode>(mode);
  useLayoutEffect(() => {
    if (lastMode.current === mode) return;
    lastMode.current = mode;
    dragRef.current = null;
    const content = contentRef.current;
    // Collapsed sheets clip their content, so start at the top rather than mid-list.
    if (mode === "sheet" && sheet.get() !== "full" && content) content.scrollTop = 0;
    const el = sheetRef.current;
    if (!el) return;
    // Jump straight to the new geometry (no slide from the old position), then cross-fade it in.
    const transition = el.style.transition;
    el.style.transition = "none";
    void el.offsetHeight;
    el.style.transition = transition;
    if (hidden || typeof el.animate !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.animate(
      [
        { opacity: 0, scale: "0.97" },
        { opacity: 1, scale: "1" },
      ],
      { duration: 320, easing: "cubic-bezier(0.22, 0.9, 0.24, 1)" },
    );
  }, [mode, hidden]);

  const applyVisible = useCallback((vis: number) => {
    const el = sheetRef.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.transform = translateFor(vis, heightsRef.current);
  }, []);

  const begin = useCallback((y: number) => {
    if (modeRef.current === "dock") return;
    const s = sheet.get();
    dragRef.current = { startY: y, startVisible: heightsRef.current[s], lastY: y, lastT: performance.now(), v: 0, moved: false, startSnap: s, near: s, isStretched: false };
  }, []);

  const move = useCallback(
    (y: number) => {
      const d = dragRef.current;
      if (!d) return;
      const h = heightsRef.current;
      if (Math.abs(y - d.startY) > 4) d.moved = true;
      let vis = d.startVisible - (y - d.startY);
      // Haptics while dragging: a tick when passing a detent, a firmer bump when hitting the end stops.
      const near = nearestSnap(vis, h);
      const isStretched = vis > h.full + 6 || vis < h.peek - 6;
      if (isStretched && !d.isStretched) haptic("rigid");
      else if (d.moved && near !== d.near && !isStretched) haptic("selection");
      d.near = near;
      d.isStretched = isStretched;
      // Rubber-band past the outer detents.
      if (vis > h.full) vis = h.full + (vis - h.full) * 0.2;
      if (vis < h.peek) vis = h.peek - (h.peek - vis) * 0.35;
      applyVisible(vis);
      const now = performance.now();
      const dt = Math.max(1, now - d.lastT);
      d.v = d.v * 0.4 + ((y - d.lastY) / dt) * 0.6;
      d.lastY = y;
      d.lastT = now;
    },
    [applyVisible],
  );

  const end = useCallback((): boolean => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return false;
    const h = heightsRef.current;
    const vis = d.startVisible - (d.lastY - d.startY);
    // Project the release velocity forward so a quick flick jumps a detent.
    const projected = vis - d.v * 220;
    const target = nearestSnap(projected, h);
    // Settling into a new detent gets a light "click" (also the moment iOS allows a tick: the release gesture).
    if (d.moved && target !== d.startSnap) haptic(target === "full" ? "medium" : "light");
    const el = sheetRef.current;
    if (el) {
      el.style.transition = EASE;
      el.style.transform = translateFor(h[target], h);
    }
    sheet.set(target);
    return d.moved;
  }, []);

  // Native touch listeners on the content: vertical drags move the sheet unless it is full and scrolled.
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    let sx = 0;
    let sy = 0;
    let gesture: "native" | "undecided" | "sheet" = "native";
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || modeRef.current === "dock") {
        gesture = "native";
        return;
      }
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      gesture = "undecided";
    };
    const onMove = (e: TouchEvent) => {
      if (gesture === "native") return;
      const t = e.touches[0];
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (gesture === "undecided") {
        if (Math.abs(dx) < 7 && Math.abs(dy) < 7) return;
        if (Math.abs(dx) > Math.abs(dy)) {
          gesture = "native";
          return;
        }
        const isFull = sheet.get() === "full";
        if (isFull && !(dy > 0 && el.scrollTop <= 0)) {
          gesture = "native";
          return;
        }
        gesture = "sheet";
        begin(sy);
      }
      e.preventDefault();
      move(t.clientY);
    };
    const onEnd = () => {
      if (gesture === "sheet") end();
      gesture = "native";
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [begin, move, end]);

  const tappedRef = useRef<boolean>(false);
  const onHandleDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    tappedRef.current = false;
    begin(e.clientY);
  };
  const onHandleMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragRef.current) move(e.clientY);
  };
  const onHandleUp = () => {
    const moved = end();
    tappedRef.current = !moved;
  };
  const onHandleClick = () => {
    if (!tappedRef.current) return;
    tappedRef.current = false;
    const s = sheet.get();
    setSnapWithHaptic(s === "peek" ? "half" : s === "half" ? "full" : "peek");
  };
  const onHandleKey = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    const i = SNAPS.indexOf(sheet.get());
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSnapWithHaptic(SNAPS[Math.min(2, i + 1)]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSnapWithHaptic(SNAPS[Math.max(0, i - 1)]);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setSnapWithHaptic(SNAPS[(i + 1) % 3]);
    }
  };
  const onWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    if (isDock) return;
    const s = sheet.get();
    if (s !== "full" && e.deltaY > 6) sheet.set(s === "peek" ? "half" : "full");
    else if (s === "full" && e.deltaY < -6 && (contentRef.current?.scrollTop ?? 0) <= 0) sheet.set("half");
  };

  const isScrollable = isDock || (snap === "full" && !hidden);
  const sectionStyle: CSSProperties = isDock
    ? {
        opacity: hidden ? 0 : 1,
        transform: hidden ? "translate3d(-24px, 0, 0)" : "translate3d(0, 0, 0)",
        transition: `${DOCK_FADE}, visibility 0s linear ${hidden ? "300ms" : "0s"}`,
      }
    : {
        height: heights.full,
        opacity: 1,
        transform: translateFor(visible, heights),
        transition: `${EASE}, visibility 0s linear ${hidden ? "420ms" : "0s"}`,
      };

  return (
    <div ref={layerRef} className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      <div ref={probeRef} className="invisible absolute h-[var(--sab)] w-px" aria-hidden="true" />
      <section
        ref={sheetRef}
        aria-label="Port panels"
        data-mode={mode}
        className={cn(
          "pointer-events-auto absolute z-20 flex flex-col overflow-hidden border border-hairline bg-canvas",
          isDock
            ? "bottom-[max(8px,var(--sab))] left-[max(12px,env(safe-area-inset-left))] top-2 w-[min(380px,46vw)] rounded-[18px] shadow-lift"
            : "inset-x-0 bottom-0 rounded-t-[22px] border-b-0 shadow-[0_-12px_32px_-14px_rgba(18,35,63,0.32)] md:inset-x-3",
          hidden && "invisible",
        )}
        style={sectionStyle}
      >
        <div className="shrink-0 border-b border-hairline bg-paper">
          <button
            type="button"
            onPointerDown={onHandleDown}
            onPointerMove={onHandleMove}
            onPointerUp={onHandleUp}
            onPointerCancel={onHandleUp}
            onClick={onHandleClick}
            onKeyDown={onHandleKey}
            data-haptic="off"
            tabIndex={isDock ? -1 : 0}
            aria-hidden={isDock ? true : undefined}
            aria-label={snap === "full" ? "Collapse panels" : "Expand panels"}
            aria-expanded={snap !== "peek"}
            className={cn("w-full cursor-grab touch-none items-center justify-center active:cursor-grabbing", isDock ? "hidden" : "flex")}
            style={{ height: HANDLE_H }}
          >
            <span className="h-[5px] w-10 rounded-full bg-ink/20" />
          </button>
          <div style={{ height: headerHeight }}>{header}</div>
        </div>
        <div
          ref={contentRef}
          onWheel={onWheel}
          className={cn("scroll-thin min-h-0 flex-1 overscroll-contain", isScrollable ? "overflow-y-auto" : "overflow-hidden")}
        >
          <div className={cn("flex flex-col", isDock ? "gap-2.5 p-2.5" : "mx-auto max-w-[720px] gap-3 px-3 pb-[calc(var(--sab)+20px)] pt-3")}>{children}</div>
        </div>
      </section>
    </div>
  );
}
