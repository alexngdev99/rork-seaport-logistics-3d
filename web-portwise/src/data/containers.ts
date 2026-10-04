import type { BlockCategory, Container, Shipment, YardBlock } from "./types";
import { YARD_BLOCKS, VESSELS } from "./port";
import {
  BAY_PITCH,
  BLOCK_BAYS,
  BLOCK_HALF_X,
  BLOCK_HALF_Z,
  BLOCK_ROWS,
  BLOCK_TIERS,
  CONTAINER_COLORS,
  CONTAINER_H,
  ROW_PITCH,
} from "./layout";

/** Deterministic PRNG so the yard looks identical on every load. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface LineDef {
  prefix: string;
  line: string;
  colors: string[];
}

const LINES: LineDef[] = [
  { prefix: "SSLU", line: "Seastar Lines", colors: [CONTAINER_COLORS.orange, CONTAINER_COLORS.orange, CONTAINER_COLORS.sand] },
  { prefix: "MSKU", line: "Maersk", colors: [CONTAINER_COLORS.steel] },
  { prefix: "CMAU", line: "CMA CGM", colors: [CONTAINER_COLORS.navy] },
  { prefix: "EGHU", line: "Evergreen", colors: [CONTAINER_COLORS.moss] },
  { prefix: "HLXU", line: "Hapag-Lloyd", colors: [CONTAINER_COLORS.brick] },
  { prefix: "ONEU", line: "ONE", colors: [CONTAINER_COLORS.sand, CONTAINER_COLORS.navy] },
];

const IMPORT_CARGO = ["Electronic components", "Industrial machinery", "PP resin", "Fabric rolls", "Steel plate", "Paper rolls", "Auto parts", "Chemicals (non-hazardous)"];
const EXPORT_CARGO = ["Semiconductors", "Polymer resin", "Pharmaceuticals", "Lubricants", "Precision machinery", "Transshipment – furniture", "Specialty chemicals", "Transshipment – natural rubber"];
const REEFER_CARGO = ["Australian chilled beef", "Frozen shrimp", "Vaccines (+2 to +8 °C)", "Durian", "NZ dairy"];

const IMPORT_VESSELS = ["seastar-07", "seastar-07", "seastar-07", "pacific-harmony", "coral-bay", "orient-lotus"];
const EXPORT_VESSELS = ["merlion-star", "jade-river", "nordic-spirit", "blue-marlin", "asian-dawn", "jakarta-express"];

/** ISO 6346-like check digit for authentic-looking container numbers. */
function checkDigit(code: string): number {
  const map = (ch: string): number => {
    if (/[0-9]/.test(ch)) return Number(ch);
    const v = ch.charCodeAt(0) - 55;
    return v + Math.floor((v - 1) / 10);
  };
  let sum = 0;
  for (let i = 0; i < code.length; i++) sum += map(code[i]) * Math.pow(2, i);
  return (sum % 11) % 10;
}

export const FEATURED_CONTAINER_ID = "SSLU4820197";
export const FEATURED_BLOCK_ID = "B5";

function buildContainers(): Container[] {
  const out: Container[] = [];
  const rand = mulberry32(20931);
  for (const block of YARD_BLOCKS) {
    for (let bay = 0; bay < BLOCK_BAYS; bay++) {
      for (let row = 0; row < BLOCK_ROWS; row++) {
        const isFeaturedStack = block.id === FEATURED_BLOCK_ID && bay === 6 && row === 2;
        const noise = (rand() - 0.5) * 2.2;
        let height = Math.round(block.fill * BLOCK_TIERS + noise);
        height = Math.max(0, Math.min(BLOCK_TIERS, height));
        if (isFeaturedStack) height = Math.max(height, 3);
        for (let tier = 0; tier < height; tier++) {
          const isFeatured = isFeaturedStack && tier === 1;
          const line = isFeatured ? LINES[0] : block.category === "reefer" ? LINES[Math.floor(rand() * LINES.length)] : LINES[Math.floor(rand() * LINES.length)];
          const color = block.category === "reefer" ? CONTAINER_COLORS.reefer : line.colors[Math.floor(rand() * line.colors.length)];
          const serial = isFeatured ? "482019" : String(Math.floor(100000 + rand() * 899999));
          const base = `${line.prefix}${serial}`;
          const digit = isFeatured ? 7 : checkDigit(base);
          const id = `${base}${digit}`;
          const cargoList = block.category === "import" ? IMPORT_CARGO : block.category === "export" ? EXPORT_CARGO : REEFER_CARGO;
          const vesselPool = block.category === "export" ? EXPORT_VESSELS : IMPORT_VESSELS;
          const customsRoll = rand();
          const index = out.length;
          const c: Container = {
            index,
            id,
            code: `${line.prefix} ${serial} ${digit}`,
            prefix: line.prefix,
            line: line.line,
            blockId: block.id,
            bay: (bay + 1) * 2,
            row: row + 1,
            tier: tier + 1,
            position: `${block.id}-${String((bay + 1) * 2).padStart(2, "0")}-${String(row + 1).padStart(2, "0")}-${tier + 1}`,
            x: block.x - BLOCK_HALF_X + BAY_PITCH * (bay + 0.5),
            y: CONTAINER_H * (tier + 0.5) + 0.02,
            z: block.z - BLOCK_HALF_Z + ROW_PITCH * (row + 0.5),
            color: isFeatured ? CONTAINER_COLORS.orange : color,
            size: block.category === "reefer" ? "40' RF" : rand() > 0.42 ? "40' HC" : "20' GP",
            category: block.category,
            cargo: isFeatured ? "Electronic components" : cargoList[Math.floor(rand() * cargoList.length)],
            weight: isFeatured ? 24600 : Math.round((8 + rand() * 20) * 10) * 100,
            vesselId: isFeatured ? "seastar-07" : vesselPool[Math.floor(rand() * vesselPool.length)],
            customs: isFeatured ? "Cleared" : customsRoll > 0.45 ? "Cleared" : customsRoll > 0.18 ? "Declaring" : "Inspection hold",
            shipmentId: isFeatured ? "SHP-20931" : `SHP-${30000 + index}`,
          };
          out.push(c);
        }
      }
    }
  }
  return out;
}

export const CONTAINERS: Container[] = buildContainers();

/** Containers grouped by block for fast per-block lookups. */
const byBlock = new Map<string, Container[]>();
for (const c of CONTAINERS) {
  const list = byBlock.get(c.blockId);
  if (list) list.push(c);
  else byBlock.set(c.blockId, [c]);
}

const containerMap = new Map<string, Container>(CONTAINERS.map((c) => [c.id, c]));

export const containerById = (id: string): Container | undefined => containerMap.get(id);

export const containersInBlock = (blockId: string): Container[] => byBlock.get(blockId) ?? [];

export const containersForVessel = (vesselId: string): Container[] => containersOfVessel(vesselId);

export function blockStats(block: YardBlock): { teu: number; count: number; customsHold: number } {
  const list = containersInBlock(block.id);
  return {
    teu: Math.round(block.fill * block.capacity),
    count: list.length,
    customsHold: list.filter((c) => c.customs !== "Cleared").length,
  };
}

const IMPORT_STEPS = ["Berthed", "Discharged", "In yard", "Customs", "Gate out", "Delivered"];
const EXPORT_STEPS = ["Picked up", "Gate in", "In yard", "Customs", "Loaded", "Sailed"];

const DESTINATIONS_IMPORT = ["Merlion Microelectronics, Jurong", "Tuas Logistics Hub", "Keppel Distripark", "Changi Airfreight Centre", "Woodlands → Johor Bahru"];
const CONSIGNEES = ["Merlion Microelectronics Pte Ltd", "Tuas Polymers Pte Ltd", "Straits Pharma Pte Ltd", "Jurong Steel Pte Ltd", "Orchard Retail Group", "Lion City Foods Pte Ltd", "Kallang Precision Pte Ltd"];
const DESTINATIONS_EXPORT: Record<string, string> = {
  "merlion-star": "Kaohsiung, Taiwan",
  "jade-river": "Manila, Philippines",
  "nordic-spirit": "Colombo, Sri Lanka",
  "blue-marlin": "Busan, South Korea",
  "asian-dawn": "Shanghai, China",
  "jakarta-express": "Jakarta, Indonesia",
};

const pad = (n: number): string => String(n).padStart(2, "0");
const fmtMin = (m: number): string => `${pad(Math.floor(m / 60) % 24)}:${pad(Math.floor(m % 60))}`;

export const CURATED_SHIPMENTS: Shipment[] = [
  {
    id: "SHP-20931",
    direction: "import",
    containerIds: [FEATURED_CONTAINER_ID],
    vesselId: "seastar-07",
    destination: "Merlion Microelectronics, Jurong",
    consignee: "Merlion Microelectronics Pte Ltd",
    cargo: "Electronic components",
    sizeLabel: "1 container · 40' HC",
    steps: [
      { label: "Berthed", time: "06:15" },
      { label: "Discharged", time: "07:02" },
      { label: "In yard", time: "07:20" },
      { label: "Customs", time: "08:45" },
      { label: "Gate out · ETA", time: "09:52" },
      { label: "Delivered", time: "--:--" },
    ],
    current: 3,
    truckId: "XD4821K",
  },
];

/** Builds a deterministic journey for any yard container. */
function synthShipment(container: Container): Shipment {
  const rand = mulberry32(container.index * 97 + 13);
  const isExport = container.category === "export";
  const labels = isExport ? EXPORT_STEPS : IMPORT_STEPS;
  const current = container.customs === "Cleared" ? 4 : 3;
  const start = isExport ? 6 * 60 + Math.floor(rand() * 90) : 6 * 60 + 15;
  const gaps = [0, 30 + rand() * 30, 15 + rand() * 20, 60 + rand() * 60, 30 + rand() * 40, 60 + rand() * 60];
  let t = start;
  const steps = labels.map((label, i) => {
    t += gaps[i];
    if (i < current) return { label, time: fmtMin(t) };
    if (i === current) return { label, time: i === 3 ? "In progress" : fmtMin(t) };
    if (i === current + 1) return { label: `${label} · ETA`, time: fmtMin(t + 20) };
    return { label, time: "--:--" };
  });
  return {
    id: container.shipmentId,
    direction: isExport ? "export" : "import",
    containerIds: [container.id],
    vesselId: container.vesselId,
    destination: isExport ? DESTINATIONS_EXPORT[container.vesselId] ?? "Singapore" : DESTINATIONS_IMPORT[Math.floor(rand() * DESTINATIONS_IMPORT.length)],
    consignee: CONSIGNEES[Math.floor(rand() * CONSIGNEES.length)],
    cargo: container.cargo,
    sizeLabel: `1 container · ${container.size}`,
    steps,
    current,
  };
}

export function shipmentById(id: string): Shipment | undefined {
  const curated = CURATED_SHIPMENTS.find((s) => s.id === id);
  if (curated) return curated;
  const match = /^SHP-(\d+)$/.exec(id);
  if (!match) return undefined;
  const idx = Number(match[1]) - 30000;
  const container = CONTAINERS[idx];
  if (!container || container.shipmentId !== id) return undefined;
  return synthShipment(container);
}

/** A handful of shipments to offer in the shipment switcher. */
export const FEATURED_SHIPMENT_IDS: string[] = (() => {
  const ids = ["SHP-20931"];
  const pickBlocks = ["A1", "D4", "B3", "A8", "C7"];
  for (const b of pickBlocks) {
    const c = CONTAINERS.find((x) => x.blockId === b && x.tier === 1);
    if (c) ids.push(c.shipmentId);
  }
  return ids;
})();

const byVessel = new Map<string, Container[]>();
for (const c of CONTAINERS) {
  const list = byVessel.get(c.vesselId);
  if (list) list.push(c);
  else byVessel.set(c.vesselId, [c]);
}

export const categoryOfVessel = (vesselId: string): BlockCategory =>
  VESSELS.find((v) => v.id === vesselId)?.status === "loading" ? "export" : "import";

export const containersOfVessel = (vesselId: string): Container[] => byVessel.get(vesselId) ?? [];
