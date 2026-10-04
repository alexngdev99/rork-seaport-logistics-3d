import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { COLORS } from "@/data/layout";
import { Part, mat, unitBox, unitCyl } from "../parts";
import { Glow, LIGHT, LightCone, Pool, litMat } from "../nightLights";
import { FONT_URL, Flat } from "../Terrain";

export const coneGeo = new THREE.ConeGeometry(0.5, 1, 18);
export const crownGeo = new THREE.IcosahedronGeometry(1, 1);

export { FONT_URL, Flat };
export type V3 = [number, number, number];

export interface Inst {
  p: V3;
  s: V3;
  c: string;
  r?: V3;
}

const noRay = (): null => null;

/** Static instanced boxes (or cylinders) with per-instance colour; never raycast. */
export function InstMesh({ items, cyl, geo, flat, shadow = true, rough = 0.85, metal = 0, material }: { items: Inst[]; cyl?: boolean; geo?: THREE.BufferGeometry; flat?: boolean; shadow?: boolean; rough?: number; metal?: number; material?: THREE.Material }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const col = new THREE.Color();
    items.forEach((it, i) => {
      o.position.set(it.p[0], it.p[1], it.p[2]);
      o.rotation.set(it.r?.[0] ?? 0, it.r?.[1] ?? 0, it.r?.[2] ?? 0);
      o.scale.set(it.s[0], it.s[1], it.s[2]);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, col.set(it.c));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items]);
  if (!items.length) return null;
  return (
    <instancedMesh key={items.length} ref={ref} args={[geo ?? (cyl ? unitCyl : unitBox), material, items.length]} castShadow={shadow} receiveShadow raycast={noRay}>
      {material ? null : <meshStandardMaterial roughness={rough} metalness={metal} flatShading={flat} />}
    </instancedMesh>
  );
}

/** Appends a parked tractor-trailer (cab, chassis, wheels, optional box) to an instance list. Heading `ry` follows the truck convention (0 = facing +x). */
export function truckParts(out: Inst[], x: number, z: number, ry: number, cab: string, box: string | null): void {
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  const put = (lx: number, y: number, sx: number, sy: number, sz: number, col: string) => out.push({ p: [x + lx * c, y, z - lx * s], s: [sx, sy, sz], c: col, r: [0, ry, 0] });
  put(1.9, 1.05, 1.5, 1.7, 1.35, cab);
  put(-0.5, 0.55, 3.6, 0.25, 1.2, "#2F343C");
  put(0.1, 0.33, 4.4, 0.5, 1.28, "#1B1D22");
  if (box) put(-0.5, 1.32, 3.0, 1.25, 1.26, box);
}

/** Paved plot with painted edge lines. */
export function Lot({ x, z, w, d, color = "#E0D9CA", edge = "#F3EFE6" }: { x: number; z: number; w: number; d: number; color?: string; edge?: string }) {
  return (
    <group>
      <Flat x={x} z={z} w={w} d={d} color={color} y={0.012} />
      <Flat x={x} z={z - d / 2 + 0.15} w={w} d={0.3} color={edge} y={0.018} />
      <Flat x={x} z={z + d / 2 - 0.15} w={w} d={0.3} color={edge} y={0.018} />
      <Flat x={x - w / 2 + 0.15} z={z} w={0.3} d={d} color={edge} y={0.018} />
      <Flat x={x + w / 2 - 0.15} z={z} w={0.3} d={d} color={edge} y={0.018} />
    </group>
  );
}

/** Perimeter fence or bund wall; `open` leaves the +z side open (the road side). */
export function Fence({ x, z, w, d, h = 1.3, t = 0.14, color = "#A39B8B", open = false }: { x: number; z: number; w: number; d: number; h?: number; t?: number; color?: string; open?: boolean }) {
  const m = mat(color);
  return (
    <group position={[x, h / 2, z]}>
      <mesh geometry={unitBox} material={m} position={[0, 0, -d / 2]} scale={[w, h, t]} castShadow />
      {open ? null : <mesh geometry={unitBox} material={m} position={[0, 0, d / 2]} scale={[w, h, t]} castShadow />}
      <mesh geometry={unitBox} material={m} position={[-w / 2, 0, 0]} scale={[t, h, d]} castShadow />
      <mesh geometry={unitBox} material={m} position={[w / 2, 0, 0]} scale={[t, h, d]} castShadow />
    </group>
  );
}

interface ShedProps {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  wall?: string;
  roof?: string;
  kind?: "gable" | "flat" | "saw";
  band?: string | null;
  glass?: string;
  doors?: number;
  canopy?: boolean;
  label?: string;
  labelColor?: string;
  units?: number;
}

/** Industrial building: walls, gable / flat / sawtooth roof, lit window band, dock doors and canopy on the +z face, wall sign. */
export function Shed({ x, z, w, d, h, wall = "#EFEBE2", roof = "#B9C6CC", kind = "gable", band = COLORS.ink, glass = "#9CC0DE", doors = 0, canopy = false, label, labelColor = COLORS.ink, units = 0 }: ShedProps) {
  const a = 0.2;
  const rise = (d / 2) * Math.tan(a);
  const teeth = Math.max(3, Math.round(d / 6));
  const td = d / teeth;
  const sa = 0.42;
  const sRise = td * Math.tan(sa);
  const canopyY = Math.min(h * 0.45, 4.4);
  const lampCount = Math.max(2, Math.floor(w / 18));
  const roofTop = kind === "gable" ? h + rise : kind === "saw" ? h + sRise : h + 0.4;
  return (
    <group position={[x, 0, z]}>
      <Part position={[0, h / 2, 0]} scale={[w, h, d]} color={wall} />
      {kind === "flat" ? <Part position={[0, h + 0.2, 0]} scale={[w + 0.3, 0.4, d + 0.3]} color={roof} /> : null}
      {kind === "gable" ? (
        <>
          {[-1, 1].map((sd) => (
            <Part key={sd} position={[0, h + rise / 2 + 0.12, (sd * d) / 4]} rotation={[sd * a, 0, 0]} scale={[w + 0.5, 0.3, d / 2 / Math.cos(a) + 0.3]} color={roof} />
          ))}
          <mesh geometry={unitBox} material={mat(wall)} position={[0, h + rise / 3, 0]} scale={[w - 0.1, (rise * 2) / 3, d / 2]} />
        </>
      ) : null}
      {kind === "saw"
        ? Array.from({ length: teeth }, (_, i) => {
            const zc = -d / 2 + td * (i + 0.5);
            return (
              <group key={i}>
                <Part position={[0, h + sRise / 2, zc]} rotation={[sa, 0, 0]} scale={[w + 0.3, 0.25, td / Math.cos(sa) + 0.05]} color={roof} />
                <mesh geometry={unitBox} material={litMat(glass, LIGHT.window, 0.8)} position={[0, h + sRise / 2, zc - td / 2 + 0.06]} scale={[w, sRise, 0.12]} />
              </group>
            );
          })
        : null}
      {band ? <mesh geometry={unitBox} material={litMat(band, LIGHT.window, 0.85)} position={[0, h * 0.62, 0]} scale={[w + 0.05, Math.min(1, h * 0.09), d + 0.05]} /> : null}
      {Array.from({ length: doors }, (_, i) => (
        <mesh key={i} geometry={unitBox} material={i % 4 === 1 ? litMat("#1B2A44", LIGHT.sodium, 0.8) : mat("#1B2A44")} position={[-w / 2 + (i + 0.5) * (w / doors), 1.6, d / 2 + 0.03]} scale={[Math.min(2.8, (w / doors) * 0.62), 2.9, 0.06]} />
      ))}
      {canopy ? (
        <>
          <Part position={[0, canopyY, d / 2 + 1.6]} scale={[w, 0.25, 3.2]} color={roof} />
          {Array.from({ length: lampCount }, (_, i) => (
            <Glow key={`cg${i}`} position={[-w / 2 + ((i + 0.5) * w) / lampCount, canopyY - 0.4, d / 2 + 2.4]} color={LIGHT.sodium} size={2.2} base={0.8} />
          ))}
        </>
      ) : null}
      {Array.from({ length: units }, (_, i) => (
        <group key={`u${i}`} position={[-w / 2 + ((i + 0.5) * w) / units, roofTop, (i % 2 === 0 ? -1 : 1) * d * 0.18]}>
          <mesh geometry={unitBox} material={mat("#C9CED1")} position={[0, 0.7, 0]} scale={[3, 1.4, 2.2]} castShadow />
          <mesh geometry={unitCyl} material={mat("#3A4250")} position={[0, 1.42, 0]} scale={[1.5, 0.06, 1.5]} />
        </group>
      ))}
      {label ? (
        <Text font={FONT_URL} fontSize={Math.min(2.2, h * 0.17)} color={labelColor} position={[0, h - Math.min(1.6, h * 0.14), d / 2 + 0.07]} anchorX="center" anchorY="middle" maxWidth={w - 2}>
          {label}
        </Text>
      ) : null}
    </group>
  );
}

/** Multi-storey office block with glowing window bands. */
export function Office({ x, z, w, d, h, wall = "#F4F1EA", band = COLORS.ink, roof = "#C9D2D6", stripe }: { x: number; z: number; w: number; d: number; h: number; wall?: string; band?: string; roof?: string; stripe?: string }) {
  const floors = Math.max(1, Math.floor(h / 3.2));
  return (
    <group position={[x, 0, z]}>
      <Part position={[0, h / 2, 0]} scale={[w, h, d]} color={wall} />
      <Part position={[0, h + 0.15, 0]} scale={[w + 0.3, 0.3, d + 0.3]} color={roof} />
      {Array.from({ length: floors }, (_, i) => (
        <mesh key={i} geometry={unitBox} material={litMat(band, LIGHT.window, 0.9 + ((i * 7) % 3) * 0.3)} position={[0, 1.8 + i * 3.2, 0]} scale={[w + 0.04, 0.9, d + 0.04]} />
      ))}
      {stripe ? <mesh geometry={unitBox} material={mat(stripe)} position={[0, h - 0.5, 0]} scale={[w + 0.06, 0.6, d + 0.06]} /> : null}
    </group>
  );
}

/** Floodlight mast for lots and depots. */
export function Mast({ x, z, h = 16 }: { x: number; z: number; h?: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={unitCyl} material={mat("#8C8578")} position={[0, h / 2, 0]} scale={[0.3, h, 0.3]} castShadow />
      <mesh geometry={unitBox} material={litMat("#F6F3EC", LIGHT.sodium, 2.2)} position={[0, h + 0.1, 0]} scale={[2.2, 0.5, 2.2]} />
      <Glow position={[0, h - 0.4, 0]} color={LIGHT.sodium} size={5} />
      <LightCone position={[0, h - 0.4, 0]} height={h - 0.5} radius={6.5} color={LIGHT.sodium} base={0.045} />
      <Pool position={[0, 0.09, 0]} radius={14} color={LIGHT.sodium} base={0.32} />
    </group>
  );
}

/** Name painted on the ground at a lot corner. */
export function GroundLabel({ x, z, text, size = 2, color = "#9E9583", anchor = "left" }: { x: number; z: number; text: string; size?: number; color?: string; anchor?: "left" | "center" }) {
  return (
    <Text font={FONT_URL} fontSize={size} color={color} position={[x, 0.06, z]} rotation={[-Math.PI / 2, 0, 0]} anchorX={anchor} anchorY="middle">
      {text}
    </Text>
  );
}
