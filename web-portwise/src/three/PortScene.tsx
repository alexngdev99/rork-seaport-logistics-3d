import { Suspense, memo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { AdaptiveDpr } from "@react-three/drei";
import { VESSELS, QUAY_CRANES } from "@/data/port";
import { COLORS } from "@/data/layout";
import { Water } from "./Water";
import { Terrain } from "./Terrain";
import { BerthedVessel, ChannelTraffic, PortCallVessel } from "./Vessel";
import { portCall } from "@/sim/ais/portCalls";
import { AisOverlay } from "./AisOverlay";
import { QuayCrane } from "./QuayCrane";
import { YardBlocks, YardContainers, YardCrane } from "./Yard";
import { Trucks } from "./Trucks";
import { District } from "./district/District";
import { CameraRig } from "./CameraRig";
import { updateNight } from "./nightLights";
import { nightFx, nightMode } from "@/state/nightMode";

const DAY = {
  bg: new THREE.Color(COLORS.canvas),
  sky: new THREE.Color("#FFF8EA"),
  ground: new THREE.Color("#C9BFA8"),
  sun: new THREE.Color("#FFF4E0"),
};
const NIGHT = {
  bg: new THREE.Color("#0B1729"),
  sky: new THREE.Color("#5274AC"),
  ground: new THREE.Color("#151D2A"),
  sun: new THREE.Color("#A9C2EE"),
};
const smooth = (k: number): number => k * k * (3 - 2 * k);

const YARD_CRANES: Array<[string, number]> = [
  ["B5", 0],
  ["A1", 1.7],
  ["C2", 3.1],
  ["A6", 0.9],
  ["B8", 2.4],
  ["C9", 4.2],
  ["D4", 1.2],
  ["A10", 3.6],
  ["D8", 5.1],
];

/** Sun by day, moon by night: eases every light, the sky, fog and night lamps between the two. */
const Lights = memo(function Lights() {
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const scene = useThree((s) => s.scene);

  useFrame(({ clock }, dt) => {
    const target = nightMode.get() ? 1 : 0;
    const m = nightFx.mix;
    nightFx.mix = Math.abs(target - m) < 0.003 ? target : m + (target - m) * Math.min(1, dt * 2.2);
    const k = smooth(nightFx.mix);
    if (hemi.current) {
      hemi.current.color.copy(DAY.sky).lerp(NIGHT.sky, k);
      hemi.current.groundColor.copy(DAY.ground).lerp(NIGHT.ground, k);
      hemi.current.intensity = THREE.MathUtils.lerp(1.15, 0.62, k);
    }
    if (sun.current) {
      sun.current.color.copy(DAY.sun).lerp(NIGHT.sun, k);
      sun.current.intensity = THREE.MathUtils.lerp(2.1, 0.5, k);
    }
    if (scene.background instanceof THREE.Color) scene.background.copy(DAY.bg).lerp(NIGHT.bg, k);
    if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(DAY.bg).lerp(NIGHT.bg, k);
    updateNight(k, clock.elapsedTime);
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={["#FFF8EA", "#C9BFA8", 1.15]} />
      <directionalLight
        ref={sun}
        position={[130, 200, 100]}
        intensity={2.1}
        color="#FFF4E0"
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-left={-470}
        shadow-camera-right={470}
        shadow-camera-top={250}
        shadow-camera-bottom={-250}
        shadow-camera-near={20}
        shadow-camera-far={800}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
    </>
  );
});

function World() {
  return (
    <>
      <Terrain />
      <District />
      <Water />
      <ChannelTraffic />
      <AisOverlay />
      {VESSELS.filter((v) => v.inScene && !portCall(v.id)).map((v) => (
        <BerthedVessel key={v.id} vessel={v} />
      ))}
      {VESSELS.filter((v) => v.inScene && portCall(v.id)).map((v) => (
        <PortCallVessel key={v.id} vessel={v} />
      ))}
      {QUAY_CRANES.map((c, i) => (
        <QuayCrane key={c.id} crane={c} index={i} />
      ))}
      <YardContainers />
      <YardBlocks />
      {YARD_CRANES.map(([id, phase]) => (
        <YardCrane key={id} blockId={id} phase={phase} />
      ))}
      <Trucks />
    </>
  );
}

/** Full-bleed live 3D terminal. Rendered once and kept alive across routes. */
export default function PortScene() {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ fov: 30, near: 1, far: 2400, position: [220, 280, 380] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onPointerMissed={() => {
        document.body.style.cursor = "";
      }}
    >
      <color attach="background" args={[COLORS.canvas]} />
      <fog attach="fog" args={[COLORS.canvas, 520, 1250]} />
      <Lights />
      <Suspense fallback={null}>
        <World />
      </Suspense>
      <CameraRig />
      <AdaptiveDpr pixelated={false} />
    </Canvas>
  );
}
