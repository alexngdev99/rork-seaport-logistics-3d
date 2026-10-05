import { useSyncExternalStore } from "react";

export type SheetSnap = "peek" | "half" | "full";

let snap: SheetSnap = "peek";
let lastKey: string | null = null;
const listeners = new Set<() => void>();

const emit = (): void => listeners.forEach((l) => l());

/**
 * Bottom-sheet position on phones and tablets. Lives outside React so it survives
 * route changes (every page mounts its own HUD layout).
 */
export const sheet = {
  get: (): SheetSnap => snap,
  set: (next: SheetSnap): void => {
    if (next === snap) return;
    snap = next;
    emit();
  },
  /** Called whenever the page or selection changes: opens the sheet so new content is seen. */
  focus: (key: string, isHome: boolean): void => {
    if (lastKey === null) {
      lastKey = key;
      if (!isHome && snap === "peek") sheet.set("half");
      return;
    }
    if (key !== lastKey && snap === "peek") sheet.set("half");
    lastKey = key;
  },
  subscribe: (fn: () => void): (() => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

export const useSheetSnap = (): SheetSnap => useSyncExternalStore(sheet.subscribe, sheet.get, () => "peek");
