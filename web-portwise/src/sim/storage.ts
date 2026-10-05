import { mulberry32 } from "@/data/containers";
import { STORAGE, storageProfile } from "@/data/storage";
import type { CargoLine, StorageProfile, StorageZone } from "@/data/storage";
import { MIN_T } from "./constants";

/**
 * Live warehouse stock. Each storage site gets a seeded stream of inbound and outbound movements (one per slot,
 * sized by the profile's lot range). Stock at time t is the opening stock plus every movement up to t, so the
 * totals, cargo mix, zones and movement log always agree and replay exactly with the time bar.
 */

export type StorageDir = "in" | "out";

export interface StorageEvent {
  id: number;
  t: number;
  dir: StorageDir;
  qty: number;
  cargoId: string;
  zoneId: string;
  via: string;
  totalAfter: number;
}

export interface CargoStock {
  line: CargoLine;
  qty: number;
  /** Share of current stock, 0..1. */
  share: number;
}

export interface ZoneStock {
  zone: StorageZone;
  qty: number;
  fill: number;
  /** Quantity by cargo id, in profile cargo order. */
  mix: Array<{ cargoId: string; qty: number; color: string }>;
  /** Set when a movement touched this zone in the last 150 s. */
  activeDir?: StorageDir;
  /** Live air temperature for refrigerated chambers. */
  tempC?: number;
  /** Zone takes no cargo (tank out of service). */
  isIdle: boolean;
}

export interface StorageLive {
  profile: StorageProfile;
  total: number;
  fill: number;
  free: number;
  cargo: CargoStock[];
  zones: ZoneStock[];
  /** Latest movements, newest first. */
  recent: StorageEvent[];
  next?: StorageEvent;
  inLastHour: number;
  outLastHour: number;
  /** Stock every 5 min over the last hour (13 points, oldest first). */
  trend: number[];
}

interface Gen {
  profile: StorageProfile;
  seed: number;
  slot: number;
  slotLen: number;
  /** q[zone][cargo] while generating. */
  q: number[][];
  init: number[][];
  eligible: boolean[][];
  total: number;
  baseTotal: number;
  weightSum: number;
  events: StorageEvent[];
}

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const sum = (a: number[]): number => a.reduce((s, v) => s + v, 0);

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Cargo ids a zone is reserved for; undefined = shared floor, [] = out of service. */
function zoneHolds(p: StorageProfile, z: StorageZone): string[] | undefined {
  if (z.holds) return z.holds;
  if (z.cargoId) return [z.cargoId];
  return p.layout === "tanks" ? [] : undefined;
}

function createGen(p: StorageProfile): Gen {
  const holds = p.zones.map((z) => zoneHolds(p, z));
  const reserved = new Set<string>(holds.flatMap((h) => h ?? []));
  const eligible = p.zones.map((_, i) => p.cargo.map((c) => (holds[i] ? holds[i].includes(c.id) : !reserved.has(c.id))));
  // Opening stock: each cargo spreads over the zones that can hold it, in proportion to the zones' opening fill.
  const init = p.zones.map(() => p.cargo.map(() => 0));
  p.cargo.forEach((c, j) => {
    const zs = p.zones.map((_, i) => i).filter((i) => eligible[i][j]);
    const wsum = sum(zs.map((i) => p.zones[i].base));
    let left = c.base;
    zs.forEach((i, k) => {
      const share = k === zs.length - 1 ? left : Math.floor((c.base * p.zones[i].base) / Math.max(1, wsum));
      init[i][j] = share;
      left -= share;
    });
  });
  const baseTotal = sum(p.cargo.map((c) => c.base));
  const meanLot = (p.lot[0] + p.lot[1]) / 2;
  return {
    profile: p,
    seed: hashStr(p.facilityId),
    slot: 0,
    slotLen: (3600 * meanLot) / (p.inPerHour + p.outPerHour),
    q: init.map((r) => r.slice()),
    init,
    eligible,
    total: baseTotal,
    baseTotal,
    weightSum: baseTotal,
    events: [],
  };
}

function step(g: Gen): void {
  const p = g.profile;
  const r = mulberry32(g.seed ^ Math.imul(g.slot + 1, 2654435761));
  const t = MIN_T + g.slot * g.slotLen + g.slotLen * (0.1 + 0.8 * r());
  // Mean reversion keeps stock near its usual level however long the page stays open.
  const pIn = clamp(p.inPerHour / (p.inPerHour + p.outPerHour) + ((g.baseTotal - g.total) / p.capacity) * 4, 0.12, 0.88);
  const dir: StorageDir = r() < pIn ? "in" : "out";
  let w = r() * g.weightSum;
  let j = 0;
  for (; j < p.cargo.length - 1; j++) {
    w -= p.cargo[j].base;
    if (w <= 0) break;
  }
  const c = p.cargo[j];
  const lot = c.lot ?? p.lot;
  let qty = Math.round(lot[0] + (lot[1] - lot[0]) * r());
  const routes = dir === "in" ? (c.inVia ?? p.inVia) : (c.outVia ?? p.outVia);
  const via = routes[Math.floor(r() * routes.length)] ?? "";
  let best = -1;
  let bestV = 0;
  p.zones.forEach((z, i) => {
    if (!g.eligible[i][j]) return;
    const v = dir === "in" ? z.capacity - sum(g.q[i]) : g.q[i][j];
    if (v > bestV) {
      bestV = v;
      best = i;
    }
  });
  if (best < 0) return;
  qty = Math.min(qty, bestV);
  if (qty <= 0) return;
  g.q[best][j] += dir === "in" ? qty : -qty;
  g.total += dir === "in" ? qty : -qty;
  g.events.push({ id: g.slot, t, dir, qty, cargoId: c.id, zoneId: p.zones[best].id, via, totalAfter: g.total });
}

const gens = new Map<string, Gen>();
const memo = new Map<string, { t: number; live: StorageLive }>();

function genFor(p: StorageProfile, untilT: number): Gen {
  let g = gens.get(p.facilityId);
  if (!g) {
    g = createGen(p);
    gens.set(p.facilityId, g);
  }
  while (MIN_T + g.slot * g.slotLen <= untilT) {
    step(g);
    g.slot++;
  }
  return g;
}

/** Live stock, zones and movements of a storage site at sim time t; null for sites that don't store cargo. */
export function storageAt(facilityId: string, t: number): StorageLive | null {
  const p = storageProfile(facilityId);
  if (!p) return null;
  const hit = memo.get(facilityId);
  if (hit && hit.t === t) return hit.live;

  const g = genFor(p, t + g0Len(p) * 3);
  const q = g.init.map((r) => r.slice());
  const zi = new Map<string, number>(p.zones.map((z, i) => [z.id, i]));
  const ci = new Map<string, number>(p.cargo.map((c, i) => [c.id, i]));
  const lastTouch = new Map<string, StorageEvent>();
  let total = g.baseTotal;
  let inLastHour = 0;
  let outLastHour = 0;
  let k = 0;
  for (; k < g.events.length && g.events[k].t <= t; k++) {
    const e = g.events[k];
    const zIdx = zi.get(e.zoneId) ?? 0;
    const cIdx = ci.get(e.cargoId) ?? 0;
    q[zIdx][cIdx] += e.dir === "in" ? e.qty : -e.qty;
    total = e.totalAfter;
    lastTouch.set(e.zoneId, e);
    if (e.t > t - 3600) {
      if (e.dir === "in") inLastHour += e.qty;
      else outLastHour += e.qty;
    }
  }
  const done = g.events.slice(0, k);
  const next = g.events[k];

  const cargo: CargoStock[] = p.cargo.map((line, j) => {
    const qty = sum(q.map((r) => r[j]));
    return { line, qty, share: total > 0 ? qty / total : 0 };
  });
  const zones: ZoneStock[] = p.zones.map((zone, i) => {
    const qty = sum(q[i]);
    const touch = lastTouch.get(zone.id);
    const activeDir = touch && t - touch.t < 150 ? touch.dir : undefined;
    const tempC = zone.setC === undefined ? undefined : zone.setC + 0.35 * Math.sin(t / 97 + i * 1.7) + (activeDir ? (zone.setC < 0 ? 1.1 : 0.6) : 0);
    return {
      zone,
      qty,
      fill: zone.capacity > 0 ? qty / zone.capacity : 0,
      mix: p.cargo.map((c, j) => ({ cargoId: c.id, qty: q[i][j], color: c.color })),
      activeDir,
      tempC,
      isIdle: zoneHolds(p, zone)?.length === 0,
    };
  });

  const trend: number[] = [];
  let m = 0;
  let run = g.baseTotal;
  for (let s = 0; s <= 12; s++) {
    const at = t - 3600 + s * 300;
    while (m < done.length && done[m].t <= at) run = done[m++].totalAfter;
    trend.push(run);
  }

  const live: StorageLive = {
    profile: p,
    total,
    fill: total / p.capacity,
    free: p.capacity - total,
    cargo,
    zones,
    recent: done.slice(-6).reverse(),
    next,
    inLastHour,
    outLastHour,
    trend,
  };
  memo.set(facilityId, { t, live });
  return live;
}

function g0Len(p: StorageProfile): number {
  return (3600 * ((p.lot[0] + p.lot[1]) / 2)) / (p.inPerHour + p.outPerHour);
}

/** Facility ids with a storage profile, in list order. */
export const STORAGE_IDS: string[] = STORAGE.map((s) => s.facilityId);

/** Short unit for compact rows ("plt", "TEU", "t", "m³"). */
export const unitShort = (unit: string): string => (unit.startsWith("pallet") ? "plt" : unit);

/** Moss under 70%, amber under 85%, brick at 85% and above. */
export const fillTone = (fill: number): "moss" | "amber" | "brick" => (fill >= 0.85 ? "brick" : fill >= 0.7 ? "amber" : "moss");
