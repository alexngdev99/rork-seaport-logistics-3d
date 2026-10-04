import { memo, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import {
  BERTH_SPACING,
  BLOCK_HALF_X,
  BLOCK_HALF_Z,
  COLORS,
  COL_ROADS_X,
  CONTAINER_COLORS,
  GATE_X,
  LAND_RAIL_Z,
  QUAY_MAX_X,
  QUAY_MIN_X,
  QUAY_Z,
  ROAD_END_X,
  ROW_ROADS_Z,
  SEA_RAIL_Z,
  berthX,
} from "@/data/layout";
import { BERTH_COUNT, PORT_NAME, YARD_BLOCKS } from "@/data/port";
import { mat, unitBox, unitCyl } from "./parts";
import { mulberry32 } from "@/data/containers";
import { Glow, LIGHT, LightCone, Pool, litMat } from "./nightLights";

export const FONT_URL = "/fonts/BeVietnamPro-Bold.ttf";

export function Flat({ x, z, w, d, color, y = 0.01 }: { x: number; z: number; w: number; d: number; color: string; y?: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, y, z]} receiveShadow material={mat(color, { rough: 1 })}>
      <planeGeometry args={[w, d]} />
    </mesh>
  );
}

interface Seg {
  x: number;
  z: number;
  w: number;
  d: number;
}

const QUAY_W = QUAY_MAX_X - QUAY_MIN_X;
const QUAY_CX = (QUAY_MAX_X + QUAY_MIN_X) / 2;
const YARD_LEFT = COL_ROADS_X[0] - 2.1;
const SPINE_RIGHT = 181.5;
const PLAZA_X0 = SPINE_RIGHT;

const ROADS: Seg[] = [
  { x: QUAY_CX, z: 8, w: QUAY_W, d: 4.2 },
  { x: QUAY_CX, z: 15, w: QUAY_W, d: 4.2 },
  ...ROW_ROADS_Z.map((z) => ({ x: (YARD_LEFT + SPINE_RIGHT) / 2, z, w: SPINE_RIGHT - YARD_LEFT, d: 4.2 })),
  ...COL_ROADS_X.map((x) => ({ x, z: -21.5, w: 4.2, d: 59 })),
  { x: 176.5, z: -21, w: 10, d: 60 },
  { x: (PLAZA_X0 + ROAD_END_X) / 2, z: -11.5, w: ROAD_END_X - PLAZA_X0, d: 23 },
];

/** White dashed centre lines along the main lanes. */
function LaneDashes() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dashes = useMemo(() => {
    const out: Array<[number, number, number, number]> = [];
    for (let x = QUAY_MIN_X + 4; x < QUAY_MAX_X; x += 6) out.push([x, 11.5, 0, 0]);
    for (const z of ROW_ROADS_Z) for (let x = YARD_LEFT + 4; x < 172; x += 6) out.push([x, z, 0, 0]);
    for (let z = 4; z > -50; z -= 6) out.push([176.5, z, 1, 1]);
    for (let x = PLAZA_X0 + 4; x < ROAD_END_X; x += 6) {
      out.push([x, -5.5, 0, 0]);
      out.push([x, -11.5, 1, 0]);
      out.push([x, -17.5, 0, 0]);
    }
    return out;
  }, []);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const yellow = new THREE.Color(COLORS.amber);
    const white = new THREE.Color("#F8F5EE");
    dashes.forEach(([x, z, kind, vertical], i) => {
      o.position.set(x, 0.03, z);
      o.rotation.set(-Math.PI / 2, 0, vertical ? Math.PI / 2 : 0);
      o.scale.set(2.6, 0.22, 1);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, kind === 1 ? yellow : white);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [dashes]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, dashes.length]} receiveShadow>
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial roughness={1} />
    </instancedMesh>
  );
}

function BlockPads() {
  return (
    <group>
      {YARD_BLOCKS.map((b) => {
        const w = BLOCK_HALF_X * 2 + 1.6;
        const d = BLOCK_HALF_Z * 2 + 1.2;
        return (
          <group key={b.id}>
            <Flat x={b.x} z={b.z} w={w} d={d} color={b.category === "reefer" ? "#DCE3E4" : COLORS.pad} y={0.015} />
            <Flat x={b.x} z={b.z + d / 2} w={w} d={0.18} color={COLORS.amber} y={0.03} />
            <Flat x={b.x} z={b.z - d / 2} w={w} d={0.18} color={COLORS.amber} y={0.03} />
            <Flat x={b.x - w / 2} z={b.z} w={0.18} d={d} color={COLORS.amber} y={0.03} />
            <Flat x={b.x + w / 2} z={b.z} w={0.18} d={d} color={COLORS.amber} y={0.03} />
            <Text
              font={FONT_URL}
              fontSize={2.2}
              color="#9E9583"
              position={[b.x - BLOCK_HALF_X + 2.2, 0.05, b.z + d / 2 + 1.2]}
              rotation={[-Math.PI / 2, 0, 0]}
              anchorX="left"
              anchorY="middle"
            >
              {b.id}
            </Text>
          </group>
        );
      })}
    </group>
  );
}

function Quay() {
  const fenders = useMemo(() => {
    const out: number[] = [];
    for (let x = QUAY_MIN_X + 3; x < QUAY_MAX_X; x += 6) out.push(x);
    return out;
  }, []);
  return (
    <group>
      <mesh geometry={unitBox} material={mat(COLORS.quayWall)} position={[0, -1.6, QUAY_Z - 0.3]} scale={[1800, 3.2, 0.6]} receiveShadow />
      <mesh geometry={unitBox} material={mat(COLORS.quay)} position={[QUAY_CX, -0.05, 14]} scale={[QUAY_W, 0.1, 12]} receiveShadow />
      <mesh geometry={unitBox} material={mat("#F3F0E8")} position={[QUAY_CX, 0.02, QUAY_Z - 0.35]} scale={[QUAY_W, 0.08, 0.5]} />
      {[LAND_RAIL_Z, SEA_RAIL_Z].map((z) => (
        <mesh key={z} geometry={unitBox} material={mat("#7D7466", { metal: 0.3, rough: 0.5 })} position={[QUAY_CX, 0.04, z]} scale={[QUAY_W, 0.06, 0.25]} />
      ))}
      {fenders.map((x) => (
        <mesh key={x} geometry={unitBox} material={mat("#2B2F36")} position={[x, -0.8, QUAY_Z + 0.05]} scale={[1.2, 1.4, 0.4]} />
      ))}
      {fenders
        .filter((_, i) => i % 2 === 0)
        .map((x) => (
          <mesh key={`b${x}`} geometry={unitCyl} material={mat(COLORS.ink)} position={[x + 3, 0.35, QUAY_Z - 0.9]} scale={[0.45, 0.7, 0.45]} castShadow />
        ))}
      {Array.from({ length: BERTH_COUNT }, (_, i) => i + 1).map((n) => (
        <group key={n}>
          <Text font={FONT_URL} fontSize={1.5} color="#8C836F" position={[berthX(n) - BERTH_SPACING / 2 + 3, 0.06, 18.9]} rotation={[-Math.PI / 2, 0, 0]} anchorX="left">
            {`BERTH ${n}`}
          </Text>
          {n > 1 ? (
            <mesh geometry={unitBox} material={mat(COLORS.amber)} position={[berthX(n) - BERTH_SPACING / 2, 0.05, 18.9]} scale={[0.25, 0.06, 1.6]} />
          ) : null}
        </group>
      ))}
    </group>
  );
}

function Gate() {
  const canopies: Array<{ z: number; label: string }> = [
    { z: -5.5, label: "GATE A" },
    { z: -17.5, label: "GATE B" },
  ];
  return (
    <group>
      {canopies.map((c) => (
        <group key={c.label} position={[GATE_X, 0, c.z]}>
          <mesh geometry={unitBox} material={mat("#F6F3EC")} position={[0, 5.6, 0]} scale={[5.2, 1.1, 11]} castShadow receiveShadow />
          <mesh geometry={unitBox} material={litMat(COLORS.signal, "#FF7A45", 0.9)} position={[0, 5.0, 0]} scale={[5.3, 0.25, 11.1]} />
          {[-3, 0, 3].map((dz) => (
            <Glow key={`cg${dz}`} position={[0, 4.8, dz]} color={LIGHT.white} size={2} />
          ))}
          <Pool position={[0, 0.07, 0]} radius={7} stretch={0.8} color={LIGHT.white} base={0.42} />
          <Glow position={[2.6, 1.3, 4]} color={LIGHT.red} size={1} />
          <Glow position={[2.6, 1.3, -4]} color={LIGHT.green} size={1} />
          {[-5, 5].map((dz) =>
            [-2, 2].map((dx) => <mesh key={`${dz}${dx}`} geometry={unitBox} material={mat("#C9C2B3")} position={[dx, 2.5, dz]} scale={[0.5, 5, 0.5]} castShadow />),
          )}
          <mesh geometry={unitBox} material={mat("#F6F3EC")} position={[0, 1.1, 0]} scale={[2.4, 2.2, 1.4]} castShadow />
          <mesh geometry={unitBox} material={mat(COLORS.ink)} position={[0, 1.5, 0]} scale={[2.45, 0.6, 1.45]} />
          <mesh geometry={unitBox} material={mat(COLORS.brick)} position={[2.6, 1.1, 2.2]} scale={[0.2, 0.2, 3.4]} />
          <mesh geometry={unitBox} material={mat(COLORS.brick)} position={[2.6, 1.1, -2.2]} scale={[0.2, 0.2, 3.4]} />
          <Text font={FONT_URL} fontSize={0.8} color={COLORS.ink} position={[2.63, 5.62, 0]} rotation={[0, Math.PI / 2, 0]}>
            {c.label}
          </Text>
        </group>
      ))}
    </group>
  );
}

function Building({ x, z, w, d, h, roof = "#C9D2D6", wall = "#F4F1EA", band = COLORS.ink }: { x: number; z: number; w: number; d: number; h: number; roof?: string; wall?: string; band?: string }) {
  const floors = Math.max(1, Math.floor(h / 3.2));
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={unitBox} material={mat(wall)} position={[0, h / 2, 0]} scale={[w, h, d]} castShadow receiveShadow />
      <mesh geometry={unitBox} material={mat(roof)} position={[0, h + 0.15, 0]} scale={[w + 0.3, 0.3, d + 0.3]} castShadow />
      {Array.from({ length: floors }, (_, i) => (
        <mesh key={i} geometry={unitBox} material={litMat(band, LIGHT.window, 0.9 + ((i * 7) % 3) * 0.35)} position={[0, 1.8 + i * 3.2, 0]} scale={[w + 0.04, 0.9, d + 0.04]} />
      ))}
      <Glow position={[0, h + 0.8, 0]} color={LIGHT.red} size={1.4} blink={2.2} phase={x * 0.01} />
    </group>
  );
}

function Warehouse({ x, z, w, d }: { x: number; z: number; w: number; d: number }) {
  const doors = Math.floor(w / 5);
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={unitBox} material={mat("#ECE7DC")} position={[0, 3.2, 0]} scale={[w, 6.4, d]} castShadow receiveShadow />
      <mesh geometry={unitBox} material={mat("#B9C6CC")} position={[0, 6.9, -d / 4]} rotation={[0.28, 0, 0]} scale={[w + 0.4, 0.3, d / 2 + 0.6]} castShadow />
      <mesh geometry={unitBox} material={mat("#AFBDC4")} position={[0, 6.9, d / 4]} rotation={[-0.28, 0, 0]} scale={[w + 0.4, 0.3, d / 2 + 0.6]} castShadow />
      {Array.from({ length: doors }, (_, i) => (
        <mesh key={i} geometry={unitBox} material={i % 3 === 1 ? litMat(COLORS.ink, LIGHT.sodium, 0.9) : mat(COLORS.ink)} position={[-w / 2 + 2.5 + i * 5, 1.6, d / 2 + 0.02]} scale={[2.6, 3.2, 0.06]} />
      ))}
      {Array.from({ length: doors }, (_, i) => (
        <Glow key={`g${i}`} position={[-w / 2 + 2.5 + i * 5, 3.7, d / 2 + 0.5]} color={LIGHT.sodium} size={1.4} base={0.8} />
      ))}
    </group>
  );
}

/** Static stacks of empty containers in the depot beside the gate – adds scale, not clickable. */
function EmptyDepot() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const boxes = useMemo(() => {
    const r = mulberry32(404);
    const palette = [CONTAINER_COLORS.steel, CONTAINER_COLORS.navy, CONTAINER_COLORS.brick, CONTAINER_COLORS.sand, CONTAINER_COLORS.moss, CONTAINER_COLORS.orange];
    const out: Array<{ x: number; y: number; z: number; c: THREE.Color }> = [];
    for (let row = 0; row < 4; row++) {
      for (let bay = 0; bay < 18; bay++) {
        for (let lane = 0; lane < 3; lane++) {
          const h = 2 + Math.floor(r() * 4);
          const x = 196 + bay * 3.3;
          const z = -32 - row * 7 - lane * 1.45;
          for (let t = 0; t < h; t++) out.push({ x, y: 0.65 + t * 1.3, z, c: new THREE.Color(palette[Math.floor(r() * palette.length)]) });
        }
      }
    }
    return out;
  }, []);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    boxes.forEach((b, i) => {
      o.position.set(b.x, b.y, b.z);
      o.scale.set(3.0, 1.25, 1.3);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, b.c);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [boxes]);
  return (
    <group>
      <Flat x={225} z={-43} w={66} d={32} color={COLORS.pad} y={0.012} />
      <instancedMesh ref={ref} args={[undefined, undefined, boxes.length]} geometry={unitBox} castShadow receiveShadow raycast={() => null}>
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
      <Text font={FONT_URL} fontSize={2.2} color="#9E9583" position={[194, 0.05, -26.5]} rotation={[-Math.PI / 2, 0, 0]} anchorX="left">
        EMPTY DEPOT
      </Text>
    </group>
  );
}

/** Instanced lollipop trees scattered around the terminal edges. */
function Trees() {
  const crowns = useRef<THREE.InstancedMesh>(null);
  const trunks = useRef<THREE.InstancedMesh>(null);
  const spots = useMemo(() => {
    const r = mulberry32(77);
    const out: Array<[number, number, number]> = [];
    for (let x = -230; x < 300; x += 5.5) {
      out.push([x + r() * 2, -78 - r() * 3, 0.8 + r() * 0.6]);
      if (r() > 0.4) out.push([x + r() * 3, -86 - r() * 8, 0.9 + r() * 0.7]);
    }
    for (let x = 210; x < 300; x += 5) {
      out.push([x, -0.5, 0.7 + r() * 0.3]);
      out.push([x + 2, -24, 0.7 + r() * 0.3]);
    }
    for (let z = -74; z < 0; z += 4.5) out.push([-222 + r(), z, 0.8 + r() * 0.4]);
    for (let i = 0; i < 40; i++) out.push([262 + r() * 36, -30 - r() * 40, 0.8 + r() * 0.6]);
    return out;
  }, []);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const a = new THREE.Color(COLORS.tree);
    const b = new THREE.Color(COLORS.treeDark);
    const r = mulberry32(5);
    spots.forEach(([x, z, s], i) => {
      o.position.set(x, 2.6 * s + 1.2, z);
      o.scale.setScalar(s * 2.2);
      o.updateMatrix();
      crowns.current?.setMatrixAt(i, o.matrix);
      crowns.current?.setColorAt(i, r() > 0.5 ? a : b);
      o.position.set(x, 1.1 * s, z);
      o.scale.set(0.35, 2.2 * s, 0.35);
      o.updateMatrix();
      trunks.current?.setMatrixAt(i, o.matrix);
    });
    if (crowns.current) {
      crowns.current.instanceMatrix.needsUpdate = true;
      if (crowns.current.instanceColor) crowns.current.instanceColor.needsUpdate = true;
    }
    if (trunks.current) trunks.current.instanceMatrix.needsUpdate = true;
  }, [spots]);
  return (
    <group>
      <instancedMesh ref={crowns} args={[undefined, undefined, spots.length]} castShadow raycast={() => null}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial roughness={0.9} flatShading />
      </instancedMesh>
      <instancedMesh ref={trunks} args={[undefined, undefined, spots.length]} castShadow geometry={unitCyl} material={mat("#8A6E52")} raycast={() => null} />
    </group>
  );
}

function Lamps() {
  const xs = useMemo(() => {
    const out: number[] = [];
    for (let x = QUAY_MIN_X + 8; x < QUAY_MAX_X; x += 24) out.push(x);
    return out;
  }, []);
  /** High-mast floodlights along the yard's cross roads. */
  const yardMasts = useMemo(() => {
    const out: Array<[number, number]> = [];
    for (const z of [ROW_ROADS_Z[0], ROW_ROADS_Z[2]]) for (let k = 0; k < COL_ROADS_X.length; k += 2) out.push([COL_ROADS_X[k] + 1.2, z + 2.6]);
    out.push([176.5 + 6, -42], [226, -2], [258, -28]);
    return out;
  }, []);
  return (
    <group>
      {xs.map((x) => (
        <group key={x} position={[x, 0, 4.6]}>
          <mesh geometry={unitCyl} material={mat("#8C8578")} position={[0, 6, 0]} scale={[0.22, 12, 0.22]} castShadow />
          <mesh geometry={unitBox} material={litMat("#F6F3EC", LIGHT.sodium, 2.2)} position={[0, 12.1, 0]} scale={[1.6, 0.3, 0.6]} castShadow />
          <Glow position={[0, 11.7, 0]} color={LIGHT.sodium} size={4.2} />
          <LightCone position={[0, 11.7, 0]} height={11.6} radius={4.5} color={LIGHT.sodium} base={0.07} />
          <Pool position={[0, 0.08, 0]} radius={10} color={LIGHT.sodium} base={0.42} />
        </group>
      ))}
      {yardMasts.map(([x, z]) => (
        <group key={`m${x}${z}`} position={[x, 0, z]}>
          <mesh geometry={unitCyl} material={mat("#8C8578")} position={[0, 9, 0]} scale={[0.3, 18, 0.3]} castShadow />
          <mesh geometry={unitBox} material={litMat("#F6F3EC", LIGHT.sodium, 2.2)} position={[0, 18.1, 0]} scale={[2.4, 0.5, 2.4]} />
          <Glow position={[0, 17.6, 0]} color={LIGHT.sodium} size={5.5} />
          <LightCone position={[0, 17.6, 0]} height={17.5} radius={7} color={LIGHT.sodium} base={0.05} />
          <Pool position={[0, 0.09, 0]} radius={15} color={LIGHT.sodium} base={0.36} />
        </group>
      ))}
    </group>
  );
}

/** Static environment: land, pavement, quay, roads, yard pads, gate, depot, buildings, trees. */
export const Terrain = memo(function Terrain() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, QUAY_Z - 400]} receiveShadow material={mat(COLORS.land, { rough: 1 })}>
        <planeGeometry args={[2000, 800]} />
      </mesh>
      <Flat x={-15} z={-26} w={398} d={92} color={COLORS.pavement} y={0} />
      <Flat x={-240} z={-60} w={40} d={36} color="#D5DCC3" />
      <Flat x={280} z={-70} w={60} d={40} color="#D5DCC3" />
      {ROADS.map((r, i) => (
        <Flat key={i} x={r.x} z={r.z} w={r.w} d={r.d} color={COLORS.road} y={0.02} />
      ))}
      <LaneDashes />
      <BlockPads />
      <Quay />
      <Gate />
      <EmptyDepot />
      <Building x={236} z={-66} w={24} d={10} h={13} />
      <Text font={FONT_URL} fontSize={1.6} color={COLORS.ink} position={[236, 14.4, -60.8]} anchorX="center">
        {PORT_NAME.toUpperCase()}
      </Text>
      <Building x={264} z={-64} w={12} d={9} h={7.4} band="#4F6D8F" />
      <Building x={-198} z={-12} w={12} d={8} h={7} band="#4F6D8F" />
      <Building x={-198} z={-30} w={10} d={10} h={10} band={COLORS.signal} />
      <Warehouse x={-120} z={-64} w={44} d={11} />
      <Warehouse x={-64} z={-64} w={44} d={11} />
      <Warehouse x={-8} z={-64} w={44} d={11} />
      <Warehouse x={48} z={-64} w={44} d={11} />
      <Warehouse x={110} z={-64} w={52} d={11} />
      <Warehouse x={-176} z={-64} w={40} d={11} />
      <Trees />
      <Lamps />
    </group>
  );
});
