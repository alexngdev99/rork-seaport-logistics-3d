import { useSyncExternalStore } from "react";
import type { ShipClass } from "@/data/shipClasses";

export type ShipFilter = "all" | ShipClass;

const ORDER: ShipFilter[] = ["all", "container", "tanker", "bulk"];
let value: ShipFilter = "all";
const listeners = new Set<() => void>();

/** Which hull types the 3D map shows. Scene-only and not persisted, so every visit starts with all ships. */
export const shipFilter = {
  get: (): ShipFilter => value,
  set: (next: ShipFilter): void => {
    if (next === value) return;
    value = next;
    listeners.forEach((l) => l());
  },
  cycle: (): void => shipFilter.set(ORDER[(ORDER.indexOf(value) + 1) % ORDER.length]),
  shows: (cls: ShipClass): boolean => value === "all" || value === cls,
  subscribe: (fn: () => void): (() => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

export const useShipFilter = (): ShipFilter => useSyncExternalStore(shipFilter.subscribe, shipFilter.get, () => "all");

/** True while ships of this class are visible on the map. */
export const useShowsClass = (cls: ShipClass): boolean => {
  const f = useShipFilter();
  return f === "all" || f === cls;
};
