import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
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
import { boot } from "@/state/boot";
import { SceneReady } from "./SceneReady";
import { Lightning, Rain, SkyRig } from "./Atmosphere";

/** Phones and tablets: lighter pixel ratio and shadow map to keep frame rate and battery in check. */
const IS_LITE = typeof window !== "undefined" && (window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 1024);
const DPR: [number, number] = IS_LITE ? [1, 1.5] : [1, 1.75];

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
      <Rain />
      <Lightning />
    </>
  );
}

/** Full-bleed live 3D terminal. Rendered once and kept alive across routes. */
export default function PortScene() {
  return (
    <Canvas
      shadows
      dpr={DPR}
      camera={{ fov: 30, near: 1, far: 2400, position: [220, 280, 380] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={() => boot.mark("engine")}
      onPointerMissed={() => {
        document.body.style.cursor = "";
      }}
    >
      <color attach="background" args={[COLORS.canvas]} />
      <fog attach="fog" args={[COLORS.canvas, 520, 1250]} />
      <SkyRig />
      <Suspense fallback={null}>
        <World />
        <SceneReady />
      </Suspense>
      <CameraRig />
      <AdaptiveDpr pixelated={false} />
    </Canvas>
  );
}
