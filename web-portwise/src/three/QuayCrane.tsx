import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { QuayCrane as QuayCraneT } from "@/data/types";
import { COLORS, CONTAINER_COLORS, CRANE_LANE_Z, LAND_RAIL_Z, SEA_RAIL_Z, SHIP_Z, WATER_Y } from "@/data/layout";
import { VESSELS } from "@/data/port";
import { CRANE_CYCLE, CRANE_DROP_AT, craneOffset, craneStatusAt, sceneRegistry, sim, simT, useSimTick } from "@/sim/simStore";
import { Beam, Part, Selectable, mat, unitBox } from "./parts";
import { Chip3D } from "./Chip3D";
import { DECK_Y } from "./Vessel";
import { Glow, LIGHT, LightCone, Pool, litMat } from "./nightLights";
import { usePort } from "@/state/PortProvider";

const ORANGE = COLORS.signal;
const BOOM_Y = 16.8;
const TROLLEY_UP = 13.6;
const CYCLE = CRANE_CYCLE;
const BOX_PALETTE = [CONTAINER_COLORS.orange, CONTAINER_COLORS.navy, CONTAINER_COLORS.brick, CONTAINER_COLORS.moss, CONTAINER_COLORS.sand, CONTAINER_COLORS.steel];

const ease = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const seg = (t: number, a: number, b: number): number => ease(Math.max(0, Math.min(1, (t - a) / (b - a))));

function CraneLabel({ crane }: { crane: QuayCraneT }) {
  useSimTick();
  const { selection, view, open } = usePort();
  const selected = selection?.kind === "crane" && selection.id === crane.id;
  const servingSelectedVessel = selection?.kind === "vessel" && selection.id === crane.vesselId;
  const st = craneStatusAt(crane, simT());
  const active = sim.craneActive[crane.id];
  const paused = st.state === "paused";
  const show = selected || servingSelectedVessel || (view === "overview" && (paused || crane.id === "STS-03"));
  if (!show) return null;
  const text = active ? `${crane.id} · ${crane.movesPerHour || 28} moves/h` : `${crane.id} · ${st.reason ?? "Idle"}`;
  return (
    <Chip3D position={[0, 27.5, 15]} tone={paused ? "brick" : active ? "signal" : "amber"} pulse={paused} active={selected} onClick={() => open({ kind: "crane", id: crane.id })}>
      <span className="font-mono">{text}</span>
    </Chip3D>
  );
}

/** Ship-to-shore gantry crane with animated trolley, spreader and container cycle. */
export function QuayCrane({ crane, index }: { crane: QuayCraneT; index: number }) {
  const root = useRef<THREE.Group>(null);
  const outreach = useRef<THREE.Group>(null);
  const trolley = useRef<THREE.Group>(null);
  const spreader = useRef<THREE.Group>(null);
  const cable = useRef<THREE.Mesh>(null);
  const carried = useRef<THREE.Mesh>(null);
  const landBox = useRef<THREE.Mesh>(null);
  const beacon = useRef<THREE.MeshStandardMaterial>(null);
  const forestays = useRef<THREE.Group>(null);
  const lastCycle = useRef<number>(-1);
  const boomAngle = useRef<number>(crane.mode === "paused" || crane.mode === "idle" ? -1.32 : 0);
  const vessel = VESSELS.find((v) => v.id === crane.vesselId);
  const loading = vessel?.status === "loading";
  const offset = craneOffset(index);
  const shipZBase = SHIP_Z;
  const vesselX = useMemo(() => crane.x, [crane.x]);

  useEffect(() => {
    const g = root.current;
    if (g) sceneRegistry.set(`crane:${crane.id}`, g);
    return () => {
      sceneRegistry.delete(`crane:${crane.id}`);
    };
  }, [crane.id]);

  useFrame(({ clock }) => {
    const now = simT();
    const st = craneStatusAt(crane, now);
    const active = st.state === "active";
    boomAngle.current = -1.32 * st.boom;
    if (outreach.current) outreach.current.rotation.x = boomAngle.current;
    if (forestays.current) forestays.current.visible = boomAngle.current > -0.05;
    if (beacon.current) {
      const on = st.state === "paused" ? Math.sin(clock.elapsedTime * 6) > 0 : false;
      beacon.current.emissiveIntensity = on ? 1.4 : 0.1;
    }

    const tr = trolley.current;
    const sp = spreader.current;
    if (!tr || !sp || !cable.current || !carried.current || !landBox.current) return;

    if (!active || boomAngle.current < -0.05) {
      tr.position.z = 8;
      sp.position.y = TROLLEY_UP;
      carried.current.visible = false;
      landBox.current.visible = false;
      cable.current.scale.y = 0.6;
      cable.current.position.y = BOOM_Y - 0.9;
      return;
    }

    const time = now + offset;
    const cycle = Math.floor(time / CYCLE);
    const t = time - cycle * CYCLE;
    const row = ((cycle * 7 + index) % 5) - 2;
    const shipZ = shipZBase + row * 1.32;
    const tier = 3 - ((cycle + index) % 3);
    const shipY = WATER_Y + DECK_Y + 0.65 + tier * 1.3 + 0.75;
    const landY = 0.65 + 0.75;
    const pickZ = loading ? CRANE_LANE_Z : shipZ;
    const dropZ = loading ? shipZ : CRANE_LANE_Z;
    const pickY = loading ? landY : shipY;
    const dropY = loading ? shipY : landY;

    let z = pickZ;
    let y = TROLLEY_UP;
    let carrying = false;
    if (t < 2.2) {
      y = THREE.MathUtils.lerp(TROLLEY_UP, pickY, seg(t, 0, 2.2));
    } else if (t < 2.8) {
      y = pickY;
      carrying = true;
    } else if (t < 5) {
      y = THREE.MathUtils.lerp(pickY, TROLLEY_UP, seg(t, 2.8, 5));
      carrying = true;
    } else if (t < 7.6) {
      z = THREE.MathUtils.lerp(pickZ, dropZ, seg(t, 5, 7.6));
      carrying = true;
    } else if (t < 9.6) {
      z = dropZ;
      y = THREE.MathUtils.lerp(TROLLEY_UP, dropY, seg(t, 7.6, 9.6));
      carrying = true;
    } else if (t < 10.2) {
      z = dropZ;
      y = dropY;
      carrying = true;
    } else if (t < 11.6) {
      z = dropZ;
      y = THREE.MathUtils.lerp(dropY, TROLLEY_UP, seg(t, 10.2, 11.6));
    } else {
      z = THREE.MathUtils.lerp(dropZ, pickZ, seg(t, 11.6, CYCLE));
    }

    const pi = (n: number): number => ((n % BOX_PALETTE.length) + BOX_PALETTE.length) % BOX_PALETTE.length;
    const landCycle = t >= CRANE_DROP_AT ? cycle : cycle - 1;
    if (lastCycle.current !== landCycle) {
      lastCycle.current = landCycle;
      (landBox.current.material as THREE.MeshStandardMaterial) = mat(BOX_PALETTE[pi(landCycle + index)]);
      (carried.current.material as THREE.MeshStandardMaterial) = mat(BOX_PALETTE[pi(cycle + index + 1)]);
    }

    tr.position.z = z;
    sp.position.y = y;
    const len = BOOM_Y - 0.9 - (y + 0.3);
    cable.current.scale.y = Math.max(0.1, len);
    cable.current.position.y = y + 0.3 + len / 2;
    carried.current.visible = carrying;
    // Land-side box: discharge leaves a box on the apron, loading waits for pickup.
    landBox.current.visible = loading ? !(t >= 2.2 && t < 11.6) : !(carrying && t > 7.6 && t < CRANE_DROP_AT);
  });

  const legX = 4.2;
  return (
    <group ref={root} position={[vesselX, 0, 0]}>
      <Selectable sel={{ kind: "crane", id: crane.id }}>
        {/* Legs + bogies */}
        {[LAND_RAIL_Z, SEA_RAIL_Z].map((z) =>
          [-legX, legX].map((x) => (
            <group key={`${x}-${z}`}>
              <Part position={[x, 7.6, z]} scale={[0.85, 15.2, 0.85]} color={ORANGE} />
              <Part position={[x, 0.45, z]} scale={[2.6, 0.9, 1.1]} color={COLORS.steelDark} />
            </group>
          )),
        )}
        {[-legX, legX].map((x) => (
          <group key={`p${x}`}>
            <Part position={[x, 15.2, 15]} scale={[0.95, 0.95, SEA_RAIL_Z - LAND_RAIL_Z + 0.9]} color={ORANGE} />
            <Beam from={[x, 1.2, LAND_RAIL_Z]} to={[x, 10, SEA_RAIL_Z]} size={0.32} color={ORANGE} />
          </group>
        ))}
        {[LAND_RAIL_Z, SEA_RAIL_Z].map((z) => (
          <Part key={`s${z}`} position={[0, 10.2, z]} scale={[legX * 2 + 0.8, 0.7, 0.7]} color={ORANGE} />
        ))}
        {/* Apex */}
        {[-3, 3].map((x) => (
          <Part key={`a${x}`} position={[x, 21.2, 15]} scale={[0.6, 12, 0.6]} color={ORANGE} />
        ))}
        <Part position={[0, 27, 15]} scale={[6.6, 0.6, 0.8]} color={ORANGE} />
        <Beam from={[-1.4, 27, 15]} to={[-1.4, BOOM_Y + 0.4, 1.5]} size={0.22} color={ORANGE} />
        <Beam from={[1.4, 27, 15]} to={[1.4, BOOM_Y + 0.4, 1.5]} size={0.22} color={ORANGE} />
        <group ref={forestays}>
          <Beam from={[-1.4, 27, 15]} to={[-1.4, BOOM_Y + 0.4, 33]} size={0.2} color={ORANGE} />
          <Beam from={[1.4, 27, 15]} to={[1.4, BOOM_Y + 0.4, 33]} size={0.2} color={ORANGE} />
        </group>
        {/* Backreach boom + machinery house */}
        {[-1.4, 1.4].map((x) => (
          <Part key={`b${x}`} position={[x, BOOM_Y, 9.75]} scale={[0.55, 1.3, 16.5]} color={ORANGE} />
        ))}
        <Part position={[0, BOOM_Y + 1.4, 4.4]} scale={[4.2, 2.2, 5]} color="#F4F1EA" />
        <mesh geometry={unitBox} material={litMat(COLORS.ink, LIGHT.window, 1.1)} position={[0, BOOM_Y + 1.9, 4.4]} scale={[4.24, 0.4, 5.04]} />
        {/* Outreach boom (hinged at the sea rail) */}
        <group ref={outreach} position={[0, BOOM_Y, SEA_RAIL_Z]}>
          {[-1.4, 1.4].map((x) => (
            <Part key={`o${x}`} position={[x, 0, 8]} scale={[0.55, 1.3, 16]} color={ORANGE} />
          ))}
          {[3, 7, 11, 15].map((z) => (
            <Part key={`c${z}`} position={[0, 0.5, z]} scale={[3.2, 0.3, 0.3]} color={ORANGE} />
          ))}
          {/* Night: boom floodlights + tip marker */}
          <Glow position={[-1.4, -0.95, 5]} color={LIGHT.white} size={3.2} />
          <Glow position={[1.4, -0.95, 11]} color={LIGHT.white} size={3.2} />
          <Glow position={[0, 1, 16.2]} color={LIGHT.red} size={1.6} />
        </group>
        {/* Night: backreach floods, portal lights, aviation beacon */}
        <Glow position={[0, BOOM_Y - 0.9, 13.5]} color={LIGHT.white} size={3.2} />
        {[-legX, legX].map((x) => (
          <Glow key={`pl${x}`} position={[x, 14.4, 15]} color={LIGHT.sodium} size={2.4} base={0.85} />
        ))}
        <Glow position={[0, 28.4, 15]} color={LIGHT.red} size={2.2} blink={1.8} phase={index * 0.41} />
        <Pool position={[0, 0.09, CRANE_LANE_Z - 1]} radius={9} color={LIGHT.warm} base={0.34} stretch={1.2} />
        <Pool position={[0, WATER_Y + 0.06, SEA_RAIL_Z + 14]} radius={7} color={LIGHT.warm} base={0.14} />
        <mesh position={[0, 27.6, 15]}>
          <sphereGeometry args={[0.45, 12, 12]} />
          <meshStandardMaterial ref={beacon} color={COLORS.brick} emissive={COLORS.brick} emissiveIntensity={0.1} />
        </mesh>
      </Selectable>
      {/* Trolley + cab */}
      <group ref={trolley} position={[0, 0, 8]}>
        <mesh geometry={unitBox} material={mat(COLORS.steelDark)} position={[0, BOOM_Y - 0.6, 0]} scale={[3.4, 0.6, 2]} castShadow />
        <mesh geometry={unitBox} material={mat("#F4F1EA")} position={[-2.3, BOOM_Y - 1.6, 0]} scale={[1.2, 1.4, 1.4]} castShadow />
        <mesh geometry={unitBox} material={litMat(COLORS.ink, LIGHT.window, 1.6)} position={[-2.3, BOOM_Y - 1.5, 0.71]} scale={[1.0, 0.6, 0.04]} />
        <Glow position={[0, BOOM_Y - 1.05, 0]} color={LIGHT.white} size={2.6} />
        <LightCone position={[0, BOOM_Y - 1.1, 0]} height={12.5} radius={3.2} color={LIGHT.white} base={0.11} />
        <mesh ref={cable} geometry={unitBox} material={mat("#3A3F47")} position={[0, 12, 0]} scale={[0.12, 1, 0.12]} />
        <group ref={spreader} position={[0, TROLLEY_UP, 0]}>
          <mesh geometry={unitBox} material={mat(COLORS.amber)} position={[0, 0, 0]} scale={[3.1, 0.3, 1.35]} castShadow />
          <mesh ref={carried} geometry={unitBox} material={mat(CONTAINER_COLORS.orange)} position={[0, -0.8, 0]} scale={[3.0, 1.25, 1.26]} castShadow visible={false} />
        </group>
      </group>
      <mesh ref={landBox} geometry={unitBox} material={mat(CONTAINER_COLORS.navy)} position={[0, 0.65, CRANE_LANE_Z]} scale={[3.0, 1.25, 1.26]} castShadow visible={false} />
      <CraneLabel crane={crane} />
    </group>
  );
}
