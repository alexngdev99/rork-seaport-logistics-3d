import { createContext, memo, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { Selection } from "@/data/types";
import { selKey, usePort } from "@/state/PortProvider";
import { COLORS } from "@/data/layout";

/** 0 = none, 1 = hovered, 2 = selected – inherited by every Part inside a Selectable. */
const HighlightCtx = createContext<number>(0);

export const unitBox = new THREE.BoxGeometry(1, 1, 1);
export const unitCyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);

const matCache = new Map<string, THREE.MeshStandardMaterial>();
export function mat(color: string, opts?: { rough?: number; metal?: number; emissive?: string; glow?: number }): THREE.MeshStandardMaterial {
  const key = `${color}|${opts?.rough ?? 0.85}|${opts?.metal ?? 0}|${opts?.emissive ?? ""}|${opts?.glow ?? 0.35}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: opts?.rough ?? 0.85, metalness: opts?.metal ?? 0 });
    if (opts?.emissive) {
      m.emissive = new THREE.Color(opts.emissive);
      m.emissiveIntensity = opts.glow ?? 0.35;
    }
    matCache.set(key, m);
  }
  return m;
}

/** Material for a part given its highlight level (0 none, 1 hover, 2 selected). */
export function hlMat(color: string, level: number): THREE.MeshStandardMaterial {
  if (level === 0) return mat(color);
  return mat(color, { emissive: COLORS.signal, glow: level === 2 ? 0.55 : 0.28 });
}

interface PartProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale: [number, number, number];
  color: string;
  cylinder?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  outline?: boolean;
}

/** A shaded box (or cylinder) that draws the selection outline when its Selectable is active. */
export const Part = memo(function Part({ position, rotation, scale, color, cylinder, castShadow = true, receiveShadow = true, outline = true }: PartProps) {
  const hl = useContext(HighlightCtx);
  return (
    <mesh
      geometry={cylinder ? unitCyl : unitBox}
      material={outline ? hlMat(color, hl) : mat(color)}
      position={position}
      rotation={rotation}
      scale={scale}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  );
});

const UP = new THREE.Vector3(0, 1, 0);

/** Box stretched between two points – used for truss members and stays. */
export function Beam({ from, to, size = 0.4, color }: { from: [number, number, number]; to: [number, number, number]; size?: number; color: string }) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = b.clone().sub(a);
    const len = dir.length();
    const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize());
    const mid = a.add(b).multiplyScalar(0.5);
    return { position: mid, quaternion: q, length: len };
  }, [from, to]);
  const hl = useContext(HighlightCtx);
  return (
    <mesh geometry={unitBox} material={hlMat(color, hl)} position={position} quaternion={quaternion} scale={[size, length, size]} castShadow />
  );
}

interface SelectableProps {
  sel: Selection;
  children: ReactNode;
}

/** Wraps a 3D object so hovering/clicking it highlights and opens it. */
export function Selectable({ sel, children }: SelectableProps) {
  const { selection, hovered, setHovered, open } = usePort();
  const key = selKey(sel);
  const level = selKey(selection) === key ? 2 : selKey(hovered) === key ? 1 : 0;

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(sel);
    document.body.style.cursor = "pointer";
  };
  const onOut = () => {
    setHovered(null);
    document.body.style.cursor = "";
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 6) return;
    open(sel);
  };

  return (
    <group onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
      <HighlightCtx.Provider value={level}>{children}</HighlightCtx.Provider>
    </group>
  );
}

export const useHighlight = (): number => useContext(HighlightCtx);
