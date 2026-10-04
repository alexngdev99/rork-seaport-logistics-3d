import createContextHook from "@nkzw/create-context-hook";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { BlockCategory, Selection } from "@/data/types";
import { containerById } from "@/data/containers";

export type CameraView = "overview" | "vessels" | "yard" | "gate" | "logistics";
export type YardFilter = "all" | BlockCategory;

export const selKey = (s: Selection | null): string => (s ? `${s.kind}:${s.id}` : "none");

export const [PortProvider, usePort] = createContextHook(() => {
  const navigate = useNavigate();
  const [pageSelection, setPageSelection] = useState<Selection | null>(null);
  const [overrideSelection, setOverrideSelection] = useState<Selection | null>(null);
  const [hovered, setHovered] = useState<Selection | null>(null);
  const [view, setView] = useState<CameraView>("overview");
  const [yardFilter, setYardFilter] = useState<YardFilter>("all");
  const [homeNonce, setHomeNonce] = useState<number>(0);
  const [searchOpen, setSearchOpen] = useState<boolean>(false);

  const selection = overrideSelection ?? pageSelection;

  const goHome = useCallback(() => {
    setOverrideSelection(null);
    setHomeNonce((n) => n + 1);
  }, []);

  /** Unified handler for clicks on 3D objects, alerts and search results. */
  const open = useCallback(
    (sel: Selection) => {
      switch (sel.kind) {
        case "vessel":
          setOverrideSelection(null);
          navigate(`/vessels/${sel.id}`);
          break;
        case "block":
          setOverrideSelection(null);
          navigate(`/yard/${sel.id}`);
          break;
        case "container": {
          const c = containerById(sel.id);
          setOverrideSelection(null);
          if (c) navigate(`/yard/${c.blockId}?c=${c.id}`);
          break;
        }
        case "shipment":
          setOverrideSelection(null);
          navigate(`/shipments/${sel.id}`);
          break;
        case "facility":
          setOverrideSelection(null);
          navigate(`/logistics/${sel.id}`);
          break;
        case "crane":
        case "truck":
          setOverrideSelection(sel);
          break;
      }
    },
    [navigate],
  );

  const closeOverride = useCallback(() => setOverrideSelection(null), []);

  return useMemo(
    () => ({
      selection,
      pageSelection,
      overrideSelection,
      setPageSelection,
      setOverrideSelection,
      closeOverride,
      hovered,
      setHovered,
      view,
      setView,
      yardFilter,
      setYardFilter,
      homeNonce,
      goHome,
      open,
      searchOpen,
      setSearchOpen,
    }),
    [selection, pageSelection, overrideSelection, closeOverride, hovered, view, yardFilter, homeNonce, goHome, open, searchOpen],
  );
});
