import { useSyncExternalStore } from "react";

let isHidden = false;
const listeners = new Set<() => void>();

/** Global switch that hides the floating HUD panels so the whole 3D map is visible. */
export const hudVisibility = {
  isHidden: (): boolean => isHidden,
  set: (hidden: boolean): void => {
    if (hidden === isHidden) return;
    isHidden = hidden;
    listeners.forEach((l) => l());
  },
  toggle: (): void => hudVisibility.set(!isHidden),
  subscribe: (fn: () => void): (() => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

export const useHudHidden = (): boolean => useSyncExternalStore(hudVisibility.subscribe, hudVisibility.isHidden, () => false);
