import { useSyncExternalStore } from "react";

const STORAGE_KEY = "portwise.night";

const readInitial = (): boolean => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

let isNight = readInitial();
const listeners = new Set<() => void>();

/** Global day/night toggle for the 3D scene (HUD stays on paper). Persisted per browser. */
export const nightMode = {
  get: (): boolean => isNight,
  set: (value: boolean): void => {
    if (value === isNight) return;
    isNight = value;
    try {
      window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch {
      // storage unavailable – keep the in-memory value
    }
    listeners.forEach((l) => l());
  },
  toggle: (): void => nightMode.set(!isNight),
  subscribe: (fn: () => void): (() => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

export const useNightMode = (): boolean => useSyncExternalStore(nightMode.subscribe, nightMode.get, () => false);

/** Eased 0 (day) … 1 (night) blend, advanced every frame by the scene's lighting rig. */
export const nightFx = { mix: isNight ? 1 : 0 };
