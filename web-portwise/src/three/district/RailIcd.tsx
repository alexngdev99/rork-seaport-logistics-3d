import { memo, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { COLORS, CONTAINER_COLORS } from "@/data/layout";
import { mulberry32 } from "@/data/containers";
import { simT } from "@/sim/simStore";
import { HALF, TRAIN, halfK, slotState, slotX, trainAt } from "@/sim/logistics";
import type { TrainState } from "@/sim/logistics";
import { Part, mat, unitBox } from "../parts";
import { Glow, LIGHT, litMat } from "../nightLights";
import { Flat, GroundLabel, InstMesh, Lot, Mast, Office } from "./kit";
import type { Inst } from "./kit";

const TRACK2_Z = TRAIN.trackZ - 5;
const RAIL_X0 = -1180;
const RAIL_X1 = -124;
const LEG_N = -120.5;
const LEG_S = -155;
const SPAN_C = (LEG_N + LEG_S) / 2;
const SPAN = LEG_N - LEG_S;
const RMG_H = 15;
/** Transfer lane between track 2 and the stacks, where the RMGs set boxes down for yard trucks. */
const STACK_Z = -134;
const PARK_X = [-132, -300];

const IMPORT_COLS = [CONTAINER_COLORS.navy, CONTAINER_COLORS.steel, CONTAINER_COLORS.brick, CONTAINER_COLORS.moss, CONTAINER_COLORS.sand, CONTAINER_COLORS.orange];
const EXPORT_COLS = [CONTAINER_COLORS.orange, CONTAINER_COLORS.sand, CONTAINER_COLORS.navy, CONTAINER_COLORS.reefer, CONTAINER_COLORS.brick, CONTAINER_COLORS.steel];
const importColor = (i: number): string => IMPORT_COLS[(i * 7 + 3) % IMPORT_COLS.length];
const exportColor = (i: number): string => EXPORT_COLS[(i * 5 + 1) % EXPORT_COLS.length];

/** Ballast, sleepers, rails, container stacks and the parked wagon set on track 2. */
const RailStatic = memo(function RailStatic() {
  const { sleepers, stacks, wagons } = useMemo(() => {
    const sleepers: Inst[] = [];
    for (const z of [TRAIN.trackZ, TRACK2_Z]) for (let x = RAIL_X0; x < RAIL_X1; x += 1.7) sleepers.push({ p: [x, 0.1, z], s: [0.36, 0.14, 2.7], c: "#7A6A58" });
    const r = mulberry32(2024);
    const pal = Object.values(CONTAINER_COLORS);
    const stacks: Inst[] = [];
    for (let x = -318; x < -132; x += 3.3) {
      for (let row = 0; row < 12; row++) {
        const z = -136.3 - row * 1.45 - (row >= 6 ? 1.6 : 0);
        const h = Math.floor(r() * 4.6);
        for (let t = 0; t < h; t++) stacks.push({ p: [x, 0.65 + t * 1.3, z], s: [3.0, 1.25, 1.3], c: pal[Math.floor(r() * pal.length)] });
      }
    }
    const wagons: Inst[] = [];
    for (let c = 0; c < 12; c++) {
      const xc = -300 + c * 7.2;
      wagons.push({ p: [xc, 1.0, TRACK2_Z], s: [7.0, 0.3, 2.4], c: "#3A3F48" });
      wagons.push({ p: [xc, 0.55, TRACK2_Z], s: [6.2, 0.6, 1.6], c: "#1B1D22" });
      for (const dx of [1.6, -1.6]) if (r() > 0.25) wagons.push({ p: [xc + dx, 1.8, TRACK2_Z], s: [3.0, 1.25, 1.3], c: pal[Math.floor(r() * pal.length)] });
    }
    return { sleepers, stacks, wagons };
  }, []);
  const len = RAIL_X1 - RAIL_X0;
  const cx = (RAIL_X1 + RAIL_X0) / 2;
  return (
    <group>
      <Lot x={-225} z={-137.5} w={212} d={37} color="#DCD5C6" />
      {[TRAIN.trackZ, TRACK2_Z].map((z) => (
        <group key={z}>
          <Flat x={cx} z={z} w={len} d={3.8} color="#B8AF9E" y={0.03} />
          {[-0.72, 0.72].map((dz) => (
            <mesh key={dz} geometry={unitBox} material={mat("#6B6358", { metal: 0.5, rough: 0.4 })} position={[cx, 0.24, z + dz]} scale={[len, 0.12, 0.14]} />
          ))}
          <mesh geometry={unitBox} material={mat(COLORS.ink)} position={[RAIL_X1 + 0.6, 0.6, z]} scale={[0.6, 1.2, 2.8]} castShadow />
          <mesh geometry={unitBox} material={litMat(COLORS.brick, LIGHT.red, 1.4)} position={[RAIL_X1 + 0.6, 1.3, z]} scale={[0.65, 0.3, 2.9]} />
        </group>
      ))}
      <InstMesh items={sleepers} shadow={false} />
      <InstMesh items={stacks} />
      <InstMesh items={wagons} />
      <Office x={-326} z={-146} w={8} d={14} h={9.6} band={COLORS.ink} stripe={COLORS.signal} />
      <Mast x={-230} z={-133} h={18} />
      <Mast x={-150} z={-133} h={18} />
      <GroundLabel x={-322} z={-121.3} text="TUAS ITH RAIL TERMINAL" size={2.2} color="#8C836F" />
      <LevelCrossing />
    </group>
  );
});

/** Barriers on the cross street at x = −350 that drop and flash while a train passes. */
function LevelCrossing() {
  const arms = useRef<Array<THREE.Group | null>>([]);
  const flash = useRef<THREE.Group>(null);
  const st = useRef<TrainState | null>(null);
  useFrame(() => {
    st.current = trainAt(simT(), st.current ?? undefined);
    const s = st.current;
    const tail = s.headX - (7.5 + 16 * 7.2);
    const closed = s.phase !== "away" && s.headX > -400 && tail < -300;
    arms.current.forEach((g) => {
      if (!g) return;
      const target = closed ? 0 : -1.35;
      g.rotation.z += (target - g.rotation.z) * 0.08;
    });
    if (flash.current) flash.current.visible = closed && Math.floor(simT() * 2) % 2 === 0;
  });
  const x = -350;
  return (
    <group>
      {[
        [TRAIN.trackZ + 4, 1],
        [TRACK2_Z - 4, -1],
      ].map(([z, s], i) => (
        <group key={z} position={[x + 3.4 * s, 0, z]}>
          <mesh geometry={unitBox} material={mat("#F6F3EC")} position={[0, 0.9, 0]} scale={[0.4, 1.8, 0.4]} castShadow />
          <group
            ref={(g) => {
              arms.current[i] = g;
            }}
            position={[0, 1.6, 0]}
            rotation={[0, 0, -1.35]}
          >
            <mesh geometry={unitBox} material={mat(COLORS.brick)} position={[-3.3 * s, 0, 0]} scale={[6.6, 0.18, 0.18]} castShadow />
          </group>
        </group>
      ))}
      <group ref={flash} visible={false}>
        <Glow position={[x + 3.4, 2.4, TRAIN.trackZ + 4]} color={LIGHT.red} size={2.4} base={1} />
        <Glow position={[x - 3.4, 2.4, TRACK2_Z - 4]} color={LIGHT.red} size={2.4} base={1} />
        <mesh geometry={unitBox} material={mat(COLORS.brick, { emissive: "#FF3B2E", glow: 1 })} position={[x + 3.4, 2.4, TRAIN.trackZ + 4]} scale={[0.5, 0.5, 0.5]} />
        <mesh geometry={unitBox} material={mat(COLORS.brick, { emissive: "#FF3B2E", glow: 1 })} position={[x - 3.4, 2.4, TRACK2_Z - 4]} scale={[0.5, 0.5, 0.5]} />
      </group>
    </group>
  );
}

/** Shuttle train: locomotive + 16 flatcars carrying 32 twenty-foot boxes, driven by the sim clock. */
function Train() {
  const root = useRef<THREE.Group>(null);
  const boxes = useRef<Array<THREE.Mesh | null>>([]);
  const st = useRef<TrainState | null>(null);
  const mats = useMemo(
    () => ({
      imp: Array.from({ length: TRAIN.slots }, (_, i) => mat(importColor(i))),
      exp: Array.from({ length: TRAIN.slots }, (_, i) => mat(exportColor(i))),
    }),
    [],
  );
  useFrame(() => {
    const g = root.current;
    if (!g) return;
    st.current = trainAt(simT(), st.current ?? undefined);
    const s = st.current;
    g.visible = s.phase !== "away";
    g.position.x = s.headX;
    boxes.current.forEach((m, i) => {
      if (!m) return;
      const k = slotState(i, s);
      m.visible = k !== 0;
      if (k !== 0) m.material = k === 1 ? mats.imp[i] : mats.exp[i];
    });
  });
  return (
    <group ref={root} position={[TRAIN.farX, 0, TRAIN.trackZ]}>
      <Part position={[-3.75, 2.0, 0]} scale={[7.5, 2.9, 2.6]} color={COLORS.signal} />
      <Part position={[-3.75, 0.6, 0]} scale={[6.6, 0.8, 2.0]} color="#1B1D22" outline={false} />
      <mesh geometry={unitBox} material={mat(COLORS.ink)} position={[-3.75, 2.3, 0]} scale={[7.55, 0.5, 2.65]} />
      <mesh geometry={unitBox} material={litMat("#1B2A44", LIGHT.window, 1.2)} position={[-0.9, 2.9, 0]} scale={[1.2, 0.8, 2.66]} />
      <mesh geometry={unitBox} material={mat("#F6F3EC")} position={[-3.75, 3.55, 0]} scale={[7.2, 0.2, 2.4]} />
      <Glow position={[0.05, 1.9, 0]} color={LIGHT.white} size={2.4} />
      {Array.from({ length: 16 }, (_, c) => {
        const xc = -7.5 - 3.6 - c * 7.2;
        return (
          <group key={c}>
            <mesh geometry={unitBox} material={mat("#3A3F48")} position={[xc, 1.0, 0]} scale={[7.0, 0.3, 2.4]} castShadow />
            <mesh geometry={unitBox} material={mat("#1B1D22")} position={[xc, 0.55, 0]} scale={[6.2, 0.6, 1.6]} />
          </group>
        );
      })}
      {Array.from({ length: TRAIN.slots }, (_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            boxes.current[i] = m;
          }}
          geometry={unitBox}
          material={mats.imp[i]}
          position={[slotX(i, 0), 1.8, 0]}
          scale={[3.0, 1.25, 1.3]}
          castShadow
        />
      ))}
      <Glow position={[-7.5 - 16 * 7.2, 1.2, 0]} color={LIGHT.red} size={1.4} blink={1.2} />
    </group>
  );
}

const smooth = (u: number): number => {
  const k = Math.max(0, Math.min(1, u));
  return k * k * (3 - 2 * k);
};

/** Rail-mounted gantry crane. Crane 0 works the front half of the train, crane 1 the rear half. */
function Rmg({ index }: { index: number }) {
  const root = useRef<THREE.Group>(null);
  const trolley = useRef<THREE.Group>(null);
  const hook = useRef<THREE.Group>(null);
  const cable = useRef<THREE.Mesh>(null);
  const box = useRef<THREE.Mesh>(null);
  const st = useRef<TrainState | null>(null);
  const mats = useMemo(() => ({ imp: Array.from({ length: TRAIN.slots }, (_, i) => mat(importColor(i))), exp: Array.from({ length: TRAIN.slots }, (_, i) => mat(exportColor(i))) }), []);

  useFrame((_, dt) => {
    const g = root.current;
    if (!g || !trolley.current || !hook.current || !cable.current || !box.current) return;
    st.current = trainAt(simT(), st.current ?? undefined);
    const s = st.current;
    const working = s.phase === "unloading" || s.phase === "loading";
    let z = SPAN_C;
    let drop = 0;
    let carry = false;
    if (working) {
      const f = halfK(s) * HALF;
      const j = Math.min(HALF - 1, Math.floor(f));
      const u = Math.min(1, f - j);
      const slot = index * HALF + j;
      const xa = slotX(slot, TRAIN.stopX);
      const xb = slotX(Math.min(index * HALF + HALF - 1, slot + 1), TRAIN.stopX);
      g.position.x = xa + (xb - xa) * smooth((u - 0.85) / 0.15);
      const out = s.phase === "unloading";
      const A = out ? TRAIN.trackZ : STACK_Z;
      const B = out ? STACK_Z : TRAIN.trackZ;
      if (u < 0.15) {
        z = A;
        drop = Math.sin((Math.PI * u) / 0.15);
        carry = u > 0.075;
      } else if (u < 0.5) {
        z = A + (B - A) * smooth((u - 0.15) / 0.35);
        carry = true;
      } else if (u < 0.65) {
        z = B;
        drop = Math.sin((Math.PI * (u - 0.5)) / 0.15);
        carry = u < 0.575;
      } else {
        z = B + (A - B) * smooth((u - 0.65) / 0.35);
      }
      if (carry) box.current.material = out ? mats.imp[slot] : mats.exp[slot];
    } else {
      g.position.x += (PARK_X[index] - g.position.x) * Math.min(1, dt * 0.8);
    }
    trolley.current.position.z = z - SPAN_C;
    const d = drop * (RMG_H - 4.2);
    hook.current.position.y = RMG_H - 1.6 - d;
    cable.current.scale.y = d + 0.8;
    cable.current.position.y = RMG_H - 0.8 - (d + 0.8) / 2;
    box.current.visible = carry;
  });

  return (
    <group ref={root} position={[PARK_X[index], 0, SPAN_C]}>
      {[-3.2, 3.2].map((x) =>
        [-SPAN / 2, SPAN / 2].map((z) => (
          <group key={`${x}${z}`}>
            <Part position={[x, RMG_H / 2, z]} scale={[0.7, RMG_H, 0.7]} color={COLORS.amber} />
            <Part position={[x, 0.5, z]} scale={[1.4, 1, 0.9]} color="#1D1F24" outline={false} />
          </group>
        )),
      )}
      {[-3.2, 3.2].map((x) => (
        <Part key={x} position={[x, RMG_H + 0.6, 0]} scale={[0.9, 1.3, SPAN + 2]} color={COLORS.amber} />
      ))}
      {[-SPAN / 2, SPAN / 2].map((z) => (
        <Part key={`b${z}`} position={[0, RMG_H + 0.6, z]} scale={[7.3, 1.1, 0.8]} color={COLORS.amber} />
      ))}
      <Part position={[0, 1.2, -SPAN / 2]} scale={[6.4, 0.5, 0.6]} color={COLORS.amber} />
      <Part position={[0, 1.2, SPAN / 2]} scale={[6.4, 0.5, 0.6]} color={COLORS.amber} />
      <Part position={[3.9, RMG_H - 2.2, SPAN / 2 - 3]} scale={[1.4, 1.8, 2]} color="#F6F3EC" />
      <Glow position={[0, RMG_H + 1.6, -SPAN / 2]} color={LIGHT.red} size={1.4} blink={2} phase={index} />
      <group ref={trolley}>
        <Part position={[0, RMG_H + 1.5, 0]} scale={[6, 0.7, 2.4]} color="#F6F3EC" />
        <mesh ref={cable} geometry={unitBox} material={mat("#2B3442")} position={[0, RMG_H - 1, 0]} scale={[0.1, 1, 0.1]} />
        <group ref={hook} position={[0, RMG_H - 1.6, 0]}>
          <mesh geometry={unitBox} material={mat(COLORS.amber)} scale={[3.1, 0.25, 1.4]} />
          <mesh ref={box} geometry={unitBox} material={mats.imp[0]} position={[0, -0.75, 0]} scale={[3.0, 1.25, 1.3]} castShadow visible={false} />
        </group>
        <Glow position={[0, RMG_H + 0.9, 0]} color={LIGHT.white} size={3} />
      </group>
    </group>
  );
}

export function RailIcd() {
  return (
    <group>
      <RailStatic />
      <Train />
      <Rmg index={0} />
      <Rmg index={1} />
    </group>
  );
}
