import { useCallback, useSyncExternalStore } from "react";

/** Below this width the HUD switches from floating side columns to a bottom sheet (phones + iPad portrait). */
export const COMPACT_QUERY = "(max-width: 1023px)";
/** Phones: full-width sheet. Between this and COMPACT the sheet floats as a left card (iPad portrait, phone landscape). */
export const PHONE_QUERY = "(max-width: 767px)";

/** Subscribes to a CSS media query; reads synchronously on first render so layouts never flash. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export const useIsCompact = (): boolean => useMediaQuery(COMPACT_QUERY);
export const useIsPhone = (): boolean => useMediaQuery(PHONE_QUERY);
