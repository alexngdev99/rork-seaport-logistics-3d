import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CONTAINER_COLORS } from "@/data/layout";
import { mulberry32 } from "@/data/containers";
import { HWY_DECK_Y, HWY_LANES_E, HWY_LANES_W, HWY_MAX_X, HWY_MIN_X } from "@/data/facilities";
import { SCAN, scanAt } from "@/sim/logistics";
import type { ScanState } from "@/sim/logistics";
import { simT } from "@/sim/simStore";
import { nightFx } from "@/state/nightMode";
import { unitBox } from "../parts";
import { TruckModel } from "../Trucks";
import { Glow, LIGHT } from "../nightLights";

const noRay = (): null => null;

interface Car {
  lane: number;
  dir: 1 | -1;
  speed: number;
  phase: number;
  len: number;
  h: number;
  color: string;
  box: string | null;
}

const LEN = HWY_MAX_X - HWY_MIN_X;
const PARTS = 3;

/** Expressway traffic: instanced cars, vans and container trucks looping both carriageways (pure function of sim time). */
export function HighwayTraffic() {
  const body = useRef<THREE.InstancedMesh>(null);
  const lights = useRef<THREE.InstancedMesh>(null);
  const cars = useMemo<Car[]>(() => {
    const r = mulberry32(4711);
    const cols = ["#F6F3EC", "#C9CED1", "#1E3A66", "#B5463A", "#2B3442", "#E8A317", "#4F6D8F", "#F6F3EC"];
    const boxes = Object.values(CONTAINER_COLORS);
    const out: Car[] = [];
    for (const [lanes, dir] of [
      [HWY_LANES_E, 1],
      [HWY_LANES_W, -1],
    ] as Array<[number[], 1 | -1]>) {
      lanes.forEach((lane, li) => {
        const n = li === 0 ? 34 : 26;
        const base = li === 0 ? 13 : 19;
        for (let i = 0; i < n; i++) {
          const truck = li === 0 ? r() < 0.55 : r() < 0.15;
          out.push({
            lane,
            dir,
            speed: base + (truck ? -2 : 0) + r() * 1.2,
            phase: (i / n) * LEN + r() * 8,
            len: truck ? 6.2 : 2.9 + r() * 0.8,
            h: truck ? 1.7 : 1.05 + r() * 0.3,
            color: truck ? "#F6F3EC" : cols[Math.floor(r() * cols.length)],
            box: truck ? boxes[Math.floor(r() * boxes.length)] : null,
          });
        }
      });
    }
    return out;
  }, []);

  const init = useRef<boolean>(false);
  const o = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const red = useMemo(() => new THREE.Color(LIGHT.red), []);
  const white = useMemo(() => new THREE.Color(LIGHT.white), []);

  useFrame(() => {
    const b = body.current;
    const l = lights.current;
    if (!b || !l) return;
    const t = simT();
    cars.forEach((c, i) => {
      const s = (((c.phase + c.speed * t) % LEN) + LEN) % LEN;
      const x = c.dir > 0 ? HWY_MIN_X + s : HWY_MAX_X - s;
      const y = HWY_DECK_Y;
      const ry = c.dir > 0 ? 0 : Math.PI;
      if (c.box) {
        o.position.set(x + c.dir * 2.2, y + 1.0, c.lane);
        o.rotation.set(0, ry, 0);
        o.scale.set(1.5, 1.6, 1.3);
        o.updateMatrix();
        b.setMatrixAt(i * PARTS, o.matrix);
        o.position.set(x - c.dir * 0.8, y + 1.25, c.lane);
        o.scale.set(3.0, 1.25, 1.26);
        o.updateMatrix();
        b.setMatrixAt(i * PARTS + 1, o.matrix);
        o.position.set(x - c.dir * 0.2, y + 0.4, c.lane);
        o.scale.set(4.6, 0.55, 1.2);
        o.updateMatrix();
        b.setMatrixAt(i * PARTS + 2, o.matrix);
      } else {
        o.position.set(x, y + c.h / 2 + 0.2, c.lane);
        o.rotation.set(0, ry, 0);
        o.scale.set(c.len, c.h, 1.3);
        o.updateMatrix();
        b.setMatrixAt(i * PARTS, o.matrix);
        o.position.set(x - c.dir * 0.2, y + c.h + 0.35, c.lane);
        o.scale.set(c.len * 0.55, 0.45, 1.15);
        o.updateMatrix();
        b.setMatrixAt(i * PARTS + 1, o.matrix);
        o.scale.set(0, 0, 0);
        o.updateMatrix();
        b.setMatrixAt(i * PARTS + 2, o.matrix);
      }
      // Head- and tail-lights as small emissive bars.
      const half = (c.box ? 6.2 : c.len) / 2;
      o.rotation.set(0, 0, 0);
      o.position.set(x + c.dir * (c.box ? 3.0 : half + 0.02), y + 0.7, c.lane);
      o.scale.set(0.08, 0.25, 1.1);
      o.updateMatrix();
      l.setMatrixAt(i * 2, o.matrix);
      o.position.set(x - c.dir * (c.box ? 2.35 : half + 0.02), y + 0.7, c.lane);
      o.updateMatrix();
      l.setMatrixAt(i * 2 + 1, o.matrix);
      if (!init.current) {
        b.setColorAt(i * PARTS, col.set(c.box ? "#F6F3EC" : c.color));
        b.setColorAt(i * PARTS + 1, col.set(c.box ?? "#9CC0DE"));
        b.setColorAt(i * PARTS + 2, col.set("#2F343C"));
        l.setColorAt(i * 2, white);
        l.setColorAt(i * 2 + 1, red);
      }
    });
    b.instanceMatrix.needsUpdate = true;
    l.instanceMatrix.needsUpdate = true;
    if (!init.current) {
      if (b.instanceColor) b.instanceColor.needsUpdate = true;
      if (l.instanceColor) l.instanceColor.needsUpdate = true;
      init.current = true;
    }
    (l.material as THREE.MeshBasicMaterial).opacity = 0.25 + nightFx.mix * 0.75;
  });

  return (
    <group>
      <instancedMesh ref={body} args={[unitBox, undefined, cars.length * PARTS]} castShadow frustumCulled={false} raycast={noRay}>
        <meshStandardMaterial roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={lights} args={[unitBox, undefined, cars.length * 2]} frustumCulled={false} raycast={noRay}>
        <meshBasicMaterial transparent toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

/** Truck creeping through the customs X-ray portal, with a sweeping scan curtain while it is inside. */
export function ScanTruck() {
  const g = useRef<THREE.Group>(null);
  const beam = useRef<THREE.Mesh>(null);
  const st = useRef<ScanState | null>(null);
  useFrame(() => {
    st.current = scanAt(simT(), st.current ?? undefined);
    const s = st.current;
    if (g.current) {
      g.current.visible = s.visible;
      g.current.position.x = s.x;
    }
    if (beam.current) {
      beam.current.visible = s.scanning;
      const m = beam.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.35 + 0.25 * Math.sin(simT() * 12);
    }
  });
  return (
    <group>
      <group ref={g} position={[150, 0, SCAN.laneZ]}>
        <TruckModel cab="#2C6FB0" containerColor={CONTAINER_COLORS.brick} itv={false} />
      </group>
      <mesh ref={beam} geometry={unitBox} position={[SCAN.portalX, 3.2, SCAN.laneZ]} scale={[0.15, 6, 6.2]} raycast={noRay} visible={false}>
        <meshBasicMaterial color="#FF6A3D" transparent opacity={0.4} toneMapped={false} depthWrite={false} />
      </mesh>
      <Glow position={[SCAN.portalX, 6.4, SCAN.laneZ]} color="#FF6A3D" size={2.4} blink={0.6} />
    </group>
  );
}

interface Puff {
  x: number;
  z: number;
  y0: number;
  rise: number;
  life: number;
  phase: number;
  size: number;
}

/** Soft rising plumes from the steel mill stacks and the cold hub condensers. */
export function Smoke() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const puffs = useMemo<Puff[]>(() => {
    const out: Puff[] = [];
    const src: Array<[number, number, number, number]> = [
      [-256, -190, 32.5, 1.4],
      [-246, -190, 32.5, 1.4],
      [-292, -196, 31.5, 0.7],
    ];
    src.forEach(([x, z, y0, size], si) => {
      for (let i = 0; i < 10; i++) out.push({ x, z, y0, rise: 1.6, life: 10, phase: i + si * 0.37, size });
    });
    return out;
  }, []);
  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const t = simT();
    puffs.forEach((p, i) => {
      const k = (((t + p.phase) % p.life) + p.life) % p.life / p.life;
      o.position.set(p.x + k * 9, p.y0 + k * p.life * p.rise, p.z - k * 3);
      o.scale.setScalar(p.size * (1 + k * 3.2));
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    (m.material as THREE.MeshStandardMaterial).opacity = 0.42 - nightFx.mix * 0.2;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, puffs.length]} frustumCulled={false} raycast={noRay}>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color="#E9E6E0" transparent opacity={0.42} depthWrite={false} roughness={1} flatShading />
    </instancedMesh>
  );
}
