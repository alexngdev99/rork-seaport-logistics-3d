import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { ShipClass } from "@/data/shipClasses";
import { useShowsClass } from "@/state/shipFilter";

const GROW_SEC = 0.55;
const SHRINK_SEC = 0.32;
const MIN_SCALE = 0.001;

const smooth = (u: number): number => u * u * (3 - 2 * u);
/** Ease-out with a small overshoot, so a ship "pops" back onto the water. */
const backOut = (u: number): number => {
  const c = 1.4;
  const v = u - 1;
  return 1 + (c + 1) * v * v * v + c * v * v;
};

/**
 * Shows or hides a ship according to the map's ship-type filter. Put it inside the ship's positioned group
 * so the hull settles into (or rises from) the water at its own spot. Fully hidden ships unmount, so they
 * cannot be hovered or clicked and cost nothing to render.
 */
export function ShipGate({ cls, children }: { cls: ShipClass; children: ReactNode }) {
  const shows = useShowsClass(cls);
  const [isMounted, setIsMounted] = useState<boolean>(shows);
  const group = useRef<THREE.Group>(null);
  const k = useRef<number>(shows ? 1 : 0);

  useEffect(() => {
    if (shows) setIsMounted(true);
  }, [shows]);

  useLayoutEffect(() => {
    group.current?.scale.setScalar(Math.max(MIN_SCALE, k.current));
  }, [isMounted]);

  useFrame((_, dt) => {
    const target = shows ? 1 : 0;
    if (k.current === target) return;
    const step = Math.min(dt, 0.05);
    k.current = shows ? Math.min(1, k.current + step / GROW_SEC) : Math.max(0, k.current - step / SHRINK_SEC);
    const g = group.current;
    if (g) {
      const s = shows ? backOut(k.current) : smooth(k.current);
      // Shrinking also flattens the hull a touch more, like it is settling below the surface.
      g.scale.set(Math.max(MIN_SCALE, s), Math.max(MIN_SCALE, shows ? s : s * s), Math.max(MIN_SCALE, s));
    }
    if (k.current === 0 && !shows) setIsMounted(false);
  });

  if (!isMounted) return null;
  return <group ref={group}>{children}</group>;
}
