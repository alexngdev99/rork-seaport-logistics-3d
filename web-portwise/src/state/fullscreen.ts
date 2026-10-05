import { useSyncExternalStore } from "react";

type WebkitDocument = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type WebkitElement = HTMLElement & {
  webkitRequestFullscreen?: (options?: FullscreenOptions) => Promise<void> | void;
};

/**
 * How this browser can hide its own chrome:
 * - `api`: Fullscreen API (Android Chrome/Samsung/Firefox, iPad Safari, desktop).
 * - `standalone`: already launched from the Home Screen / installed, so there is no browser bar to hide.
 * - `ios-install`: iPhone Safari has no element fullscreen; the only route is Add to Home Screen.
 * - `none`: nothing we can do.
 */
export type FullscreenSupport = "api" | "standalone" | "ios-install" | "none";

const doc = (): WebkitDocument => document as WebkitDocument;

function detect(): FullscreenSupport {
  if (typeof window === "undefined") return "none";
  const isStandalone =
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (isStandalone) return "standalone";
  if (document.fullscreenEnabled || doc().webkitFullscreenEnabled) return "api";
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return isIOS ? "ios-install" : "none";
}

const currentElement = (): Element | null => document.fullscreenElement ?? doc().webkitFullscreenElement ?? null;

let support: FullscreenSupport | null = null;
const listeners = new Set<() => void>();
const emit = (): void => listeners.forEach((l) => l());

/** Browser fullscreen (hides the address bar and system bars) for the whole app. */
export const fullscreen = {
  support: (): FullscreenSupport => (support ??= detect()),
  isActive: (): boolean => currentElement() !== null,
  /** Must be called from a user gesture (tap / click / key). Resolves false if the browser refused. */
  enter: async (): Promise<boolean> => {
    if (fullscreen.support() !== "api" || fullscreen.isActive()) return fullscreen.isActive();
    const el = document.documentElement as WebkitElement;
    try {
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" });
      else await el.webkitRequestFullscreen?.();
      return true;
    } catch (err) {
      console.warn("[fullscreen] request refused", err instanceof Error ? err.message : err);
      return false;
    }
  },
  exit: async (): Promise<void> => {
    if (!fullscreen.isActive()) return;
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else await doc().webkitExitFullscreen?.();
    } catch (err) {
      console.warn("[fullscreen] exit failed", err instanceof Error ? err.message : err);
    }
  },
  toggle: (): Promise<unknown> => (fullscreen.isActive() ? fullscreen.exit() : fullscreen.enter()),
  subscribe: (fn: () => void): (() => void) => {
    if (listeners.size === 0) {
      document.addEventListener("fullscreenchange", emit);
      document.addEventListener("webkitfullscreenchange", emit);
    }
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
      if (listeners.size === 0) {
        document.removeEventListener("fullscreenchange", emit);
        document.removeEventListener("webkitfullscreenchange", emit);
      }
    };
  },
};

export const useIsFullscreen = (): boolean => useSyncExternalStore(fullscreen.subscribe, fullscreen.isActive, () => false);
