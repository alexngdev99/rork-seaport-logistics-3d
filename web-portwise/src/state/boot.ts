import { useSyncExternalStore } from "react";

export type BootStage = "fonts" | "engine" | "scene" | "shaders" | "frames";

/** Ordered boot stages; `at` is the overall progress reached once the stage is done. */
export const BOOT_STAGES: ReadonlyArray<{ id: BootStage; label: string; active: string; at: number }> = [
  { id: "fonts", label: "Interface type", active: "Loading interface type", at: 0.12 },
  { id: "engine", label: "3D engine", active: "Loading the 3D engine", at: 0.38 },
  { id: "scene", label: "Terminal, district & strait traffic", active: "Building the terminal and logistics district", at: 0.78 },
  { id: "shaders", label: "Shaders & lighting", active: "Compiling shaders and lighting", at: 0.93 },
  { id: "frames", label: "First frames", active: "Rendering the first frames", at: 1 },
];

export interface BootSnapshot {
  /** Navigation start (performance.now() origin), so stage times read from page open. */
  startedAt: number;
  /** ms since start at which each stage finished. */
  done: Partial<Record<BootStage, number>>;
  isRevealed: boolean;
}

let snap: BootSnapshot = { startedAt: 0, done: {}, isRevealed: false };
const listeners = new Set<() => void>();
const emit = (next: BootSnapshot): void => {
  snap = next;
  listeners.forEach((l) => l());
};

/** App-wide boot progress: the loading screen stays up until every stage is done. */
export const boot = {
  get: (): BootSnapshot => snap,
  mark: (stage: BootStage): void => {
    if (snap.done[stage] !== undefined) return;
    emit({ ...snap, done: { ...snap.done, [stage]: performance.now() - snap.startedAt } });
  },
  reveal: (): void => {
    if (!snap.isRevealed) emit({ ...snap, isRevealed: true });
  },
  isComplete: (s: BootSnapshot = snap): boolean => BOOT_STAGES.every((st) => s.done[st.id] !== undefined),
  subscribe: (fn: () => void): (() => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

export const useBoot = (): BootSnapshot => useSyncExternalStore(boot.subscribe, boot.get, boot.get);

const getRevealed = (): boolean => snap.isRevealed;
export const useBootRevealed = (): boolean => useSyncExternalStore(boot.subscribe, getRevealed, getRevealed);

const UI_FONTS = [
  "400 16px 'Be Vietnam Pro'",
  "500 16px 'Be Vietnam Pro'",
  "600 16px 'Be Vietnam Pro'",
  "700 16px 'Be Vietnam Pro'",
  "800 16px 'Be Vietnam Pro'",
  "600 16px 'JetBrains Mono'",
  "700 16px 'JetBrains Mono'",
];

/** Loads every interface font weight up front (capped at 4.5 s so a slow CDN never blocks boot). */
export function preloadUiFonts(): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return Promise.resolve();
  const loads = Promise.all(UI_FONTS.map((f) => document.fonts.load(f).catch(() => [])));
  const cap = new Promise<void>((resolve) => window.setTimeout(resolve, 4500));
  return Promise.race([loads.then(() => undefined), cap]);
}
