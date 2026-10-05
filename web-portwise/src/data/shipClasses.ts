/** Hull types the 3D map can filter by. */
export type ShipClass = "container" | "tanker" | "bulk";

export interface ShipClassMeta {
  id: ShipClass;
  label: string;
  /** Fits the camera-rail pill. */
  short: string;
  one: string;
  blurb: string;
  /** Legend colour on paper. */
  color: string;
  /** Lighter variant that reads on ink. */
  onInk: string;
  tone: "signal" | "brick" | "amber";
}

export const SHIP_CLASSES: ShipClassMeta[] = [
  { id: "container", label: "Container ships", short: "Container", one: "Container ship", blurb: "Mainliners & feeders at the quay and in the Strait", color: "#F2622E", onInk: "#FF9466", tone: "signal" },
  { id: "tanker", label: "Tankers", short: "Tankers", one: "Tanker", blurb: "Crude, product & bunker tankers", color: "#C8423B", onInk: "#F2948C", tone: "brick" },
  { id: "bulk", label: "Bulk carriers", short: "Bulk", one: "Bulk carrier", blurb: "Grain, coal & ore carriers", color: "#E8A317", onInk: "#FFC94D", tone: "amber" },
];

export const shipClassMeta = (c: ShipClass): ShipClassMeta => SHIP_CLASSES.find((m) => m.id === c) ?? SHIP_CLASSES[0];
