import * as THREE from "three";
import { nightFx } from "@/state/nightMode";

export const LIGHT = {
  sodium: "#FFC274",
  warm: "#FFE0A6",
  white: "#F4F1FF",
  red: "#FF3B2E",
  green: "#36F08A",
  window: "#FFC56A",
} as const;

const noRay = (): null => null;

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (ctx) draw(ctx);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const radial = (stops: Array<[number, number]>): THREE.CanvasTexture =>
  canvasTexture(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    stops.forEach(([o, a]) => g.addColorStop(o, `rgba(255,255,255,${a})`));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });

let glowTex: THREE.CanvasTexture | null = null;
let poolTex: THREE.CanvasTexture | null = null;
let beamTex: THREE.CanvasTexture | null = null;
const getGlowTex = () =>
  (glowTex ??= radial([
    [0, 1],
    [0.1, 0.95],
    [0.24, 0.42],
    [0.55, 0.08],
    [1, 0],
  ]));
const getPoolTex = () =>
  (poolTex ??= radial([
    [0, 0.9],
    [0.3, 0.55],
    [0.65, 0.16],
    [1, 0],
  ]));
const getBeamTex = () =>
  (beamTex ??= canvasTexture(4, 64, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.45, "rgba(255,255,255,0.32)");
    g.addColorStop(1, "rgba(255,255,255,0.04)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 64);
  }));

interface FxEntry {
  mat: THREE.Material;
  base: number;
  blink: number;
  phase: number;
}

const fx: FxEntry[] = [];
const lit: Array<{ mat: THREE.MeshStandardMaterial; base: number }> = [];
const cache = new Map<string, THREE.Material>();

function register<T extends THREE.Material>(key: string, make: () => T, base: number, blink = 0, phase = 0): T {
  const hit = cache.get(key);
  if (hit) return hit as T;
  const m = make();
  m.opacity = base * nightFx.mix;
  m.visible = nightFx.mix > 0.002;
  fx.push({ mat: m, base, blink, phase });
  cache.set(key, m);
  return m;
}

const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false } as const;

/** Camera-facing halo for a lamp. `blink` is the period in seconds (0 = steady). */
export const glowMat = (color: string, base = 1, blink = 0, phase = 0): THREE.SpriteMaterial =>
  register(`g|${color}|${base}|${blink}|${phase}`, () => new THREE.SpriteMaterial({ map: getGlowTex(), color, ...additive }), base, blink, phase);

/** Soft pool of light lying on the ground or water. */
export const poolMat = (color: string, base = 0.4): THREE.MeshBasicMaterial =>
  register(`p|${color}|${base}`, () => new THREE.MeshBasicMaterial({ map: getPoolTex(), color, ...additive }), base);

/** Faint volumetric cone below a floodlight. */
export const beamMat = (color: string, base = 0.12): THREE.MeshBasicMaterial =>
  register(`b|${color}|${base}`, () => new THREE.MeshBasicMaterial({ map: getBeamTex(), color, side: THREE.DoubleSide, ...additive }), base);

/** Surface that keeps its day colour but glows (windows, lamp heads) at night. */
export function litMat(color: string, emissive: string = LIGHT.window, base = 1.6): THREE.MeshStandardMaterial {
  const key = `l|${color}|${emissive}|${base}`;
  const hit = cache.get(key);
  if (hit) return hit as THREE.MeshStandardMaterial;
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, emissive, emissiveIntensity: base * nightFx.mix });
  lit.push({ mat: m, base });
  cache.set(key, m);
  return m;
}

/** Drives every night-light material from the eased day/night blend. */
export function updateNight(mix: number, time: number): void {
  const on = mix > 0.002;
  for (const e of fx) {
    let a = e.base * mix;
    if (e.blink > 0) a *= Math.sin(((time + e.phase) * Math.PI * 2) / e.blink) > 0.35 ? 1 : 0.05;
    e.mat.opacity = a;
    e.mat.visible = on;
  }
  for (const l of lit) l.mat.emissiveIntensity = l.base * mix;
}

const plane = new THREE.PlaneGeometry(1, 1);
const coneCache = new Map<string, THREE.CylinderGeometry>();
const coneGeo = (top: number, bottom: number, h: number): THREE.CylinderGeometry => {
  const key = `${top}|${bottom}|${h}`;
  let g = coneCache.get(key);
  if (!g) {
    g = new THREE.CylinderGeometry(top, bottom, h, 20, 1, true);
    coneCache.set(key, g);
  }
  return g;
};

interface GlowProps {
  position: [number, number, number];
  color?: string;
  size?: number;
  base?: number;
  blink?: number;
  phase?: number;
}

export function Glow({ position, color = LIGHT.warm, size = 1.6, base = 1, blink = 0, phase = 0 }: GlowProps) {
  return <sprite position={position} scale={[size, size, 1]} material={glowMat(color, base, blink, phase)} raycast={noRay} renderOrder={3} />;
}

interface PoolProps {
  position: [number, number, number];
  radius: number;
  color?: string;
  base?: number;
  /** Stretch factor along local x. */
  stretch?: number;
}

export function Pool({ position, radius, color = LIGHT.sodium, base = 0.4, stretch = 1 }: PoolProps) {
  return (
    <mesh geometry={plane} material={poolMat(color, base)} position={position} rotation={[-Math.PI / 2, 0, 0]} scale={[radius * 2 * stretch, radius * 2, 1]} raycast={noRay} renderOrder={2} />
  );
}

interface ConeProps {
  /** Apex (lamp) position; the cone opens downward. */
  position: [number, number, number];
  height: number;
  radius: number;
  color?: string;
  base?: number;
}

export function LightCone({ position, height, radius, color = LIGHT.warm, base = 0.1 }: ConeProps) {
  return (
    <mesh geometry={coneGeo(0.35, radius, height)} material={beamMat(color, base)} position={[position[0], position[1] - height / 2, position[2]]} raycast={noRay} renderOrder={2} />
  );
}
