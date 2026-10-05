import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { Outlines } from "@react-three/drei";
import { CONTAINERS, containerById } from "@/data/containers";
import { YARD_BLOCKS, blockById } from "@/data/port";
import { BLOCK_HALF_X, BLOCK_HALF_Z, COLORS, CONTAINER_COLORS } from "@/data/layout";
import { selKey, usePort } from "@/state/PortProvider";
import { sceneRegistry, simT } from "@/sim/simStore";
import { haptic } from "@/lib/haptics";
import { Part, Selectable, mat, unitBox } from "./parts";
import { Chip3D } from "./Chip3D";
import type { ChipTone } from "./Chip3D";
import { Glow, LIGHT } from "./nightLights";

const MUTED = new THREE.Color("#D8D2C4");

export const fillTone = (fill: number): ChipTone => (fill >= 0.85 ? "brick" : fill >= 0.6 ? "amber" : "moss");

/** All yard containers as a single instanced mesh; per-instance picking opens the container. */
export function YardContainers() {
  const { yardFilter, selection, hovered, setHovered, open, view } = usePort();
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    CONTAINERS.forEach((c, i) => {
      o.position.set(c.x, c.y, c.z);
      o.scale.set(3.0, 1.25, 1.3);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, []);

  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const col = new THREE.Color();
    CONTAINERS.forEach((c, i) => {
      const match = view !== "yard" || yardFilter === "all" || c.category === yardFilter;
      col.set(c.color);
      m.setColorAt(i, match ? col : MUTED);
    });
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [yardFilter, view]);

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.instanceId === undefined) return;
    const c = CONTAINERS[e.instanceId];
    if (c && selKey(hovered) !== `container:${c.id}`) setHovered({ kind: "container", id: c.id });
    document.body.style.cursor = "pointer";
  };
  const onOut = () => {
    setHovered(null);
    document.body.style.cursor = "";
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 6 || e.instanceId === undefined) return;
    const c = CONTAINERS[e.instanceId];
    if (!c) return;
    haptic("selection");
    open({ kind: "container", id: c.id });
  };

  const selected = selection?.kind === "container" ? containerById(selection.id) : undefined;
  const hover = hovered?.kind === "container" ? containerById(hovered.id) : undefined;

  return (
    <group>
      <instancedMesh ref={ref} args={[undefined, undefined, CONTAINERS.length]} geometry={unitBox} castShadow receiveShadow onPointerMove={onMove} onPointerOut={onOut} onClick={onClick}>
        <meshStandardMaterial roughness={0.82} />
      </instancedMesh>
      {hover && hover.id !== selected?.id ? (
        <mesh geometry={unitBox} position={[hover.x, hover.y, hover.z]} scale={[3.02, 1.27, 1.32]} raycast={() => null}>
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          <Outlines thickness={0.05} color={COLORS.signal} opacity={0.8} transparent />
        </mesh>
      ) : null}
      {selected ? <SelectedContainer x={selected.x} y={selected.y} z={selected.z} color={selected.color} /> : null}
    </group>
  );
}

function SelectedContainer({ x, y, z, color }: { x: number; y: number; z: number; color: string }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = y + 0.35 + Math.sin(clock.elapsedTime * 2.4) * 0.12;
  });
  return (
    <group ref={ref} position={[x, y + 0.35, z]}>
      <mesh geometry={unitBox} material={mat(color, { emissive: COLORS.signal, glow: 0.3 })} scale={[3.06, 1.3, 1.36]} castShadow raycast={() => null}>
        <Outlines thickness={0.07} color={COLORS.signal} />
      </mesh>
      <mesh position={[0, 2.2, 0]} raycast={() => null}>
        <coneGeometry args={[0.45, 0.9, 4]} />
        <meshStandardMaterial color={COLORS.signal} emissive={COLORS.signal} emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

/** Invisible pads that make each block clickable, outlined when hovered/selected, plus occupancy chips. */
export function YardBlocks() {
  const { selection, hovered, view, open, yardFilter } = usePort();
  const selectedBlock =
    selection?.kind === "block" ? selection.id : selection?.kind === "container" ? containerById(selection.id)?.blockId : undefined;

  return (
    <group>
      {YARD_BLOCKS.map((b) => {
        const isSel = selectedBlock === b.id;
        const isHover = hovered?.kind === "block" && hovered.id === b.id;
        const visibleChip = view === "yard" && (yardFilter === "all" || b.category === yardFilter);
        const w = BLOCK_HALF_X * 2 + 1.6;
        const d = BLOCK_HALF_Z * 2 + 1.2;
        return (
          <group key={b.id} position={[b.x, 0, b.z]}>
            <Selectable sel={{ kind: "block", id: b.id }}>
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
                <planeGeometry args={[w, d]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
            </Selectable>
            {isSel || isHover ? (
              <group position={[0, 0.07, 0]}>
                {[
                  [0, d / 2, w, 0.5],
                  [0, -d / 2, w, 0.5],
                  [w / 2, 0, 0.5, d],
                  [-w / 2, 0, 0.5, d],
                ].map(([x, z, ww, dd], i) => (
                  <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0, z]} raycast={() => null}>
                    <planeGeometry args={[ww, dd]} />
                    <meshBasicMaterial color={COLORS.signal} transparent opacity={isSel ? 1 : 0.55} />
                  </mesh>
                ))}
              </group>
            ) : null}
            {visibleChip || isSel ? (
              <Chip3D position={[0, 7.4, 0]} tone={fillTone(b.fill)} active={isSel} onClick={() => open({ kind: "block", id: b.id })}>
                <span className="font-mono">
                  {b.id} {Math.round(b.fill * 100)}%
                </span>
              </Chip3D>
            ) : null}
          </group>
        );
      })}
    </group>
  );
}

/** Rubber-tyred gantry crane that shuttles along a yard block. */
export function YardCrane({ blockId, phase }: { blockId: string; phase: number }) {
  const block = blockById(blockId);
  const root = useRef<THREE.Group>(null);
  const trolley = useRef<THREE.Group>(null);
  const hook = useRef<THREE.Group>(null);
  const cable = useRef<THREE.Mesh>(null);
  const span = BLOCK_HALF_Z + 1.6;
  const H = 7.6;
  const color = useMemo(() => [CONTAINER_COLORS.navy, CONTAINER_COLORS.moss, CONTAINER_COLORS.brick][Math.floor(phase) % 3], [phase]);

  useEffect(() => {
    const g = root.current;
    if (g) sceneRegistry.set(`rtg:${blockId}`, g);
    return () => {
      sceneRegistry.delete(`rtg:${blockId}`);
    };
  }, [blockId]);

  useFrame(() => {
    if (!block || !root.current || !trolley.current || !hook.current || !cable.current) return;
    const t = simT() * 0.12 + phase;
    root.current.position.x = block.x + Math.sin(t) * (BLOCK_HALF_X - 3);
    trolley.current.position.z = Math.sin(t * 2.3) * (BLOCK_HALF_Z - 0.7);
    const drop = (Math.sin(t * 5.1) * 0.5 + 0.5) * 3.2;
    hook.current.position.y = H - 1.2 - drop;
    cable.current.scale.y = drop + 0.6;
    cable.current.position.y = H - 0.6 - (drop + 0.6) / 2;
  });

  if (!block) return null;
  return (
    <group ref={root} position={[block.x, 0, block.z]}>
      {[-1.6, 1.6].map((x) =>
        [-span, span].map((z) => (
          <group key={`${x}${z}`}>
            <Part position={[x, H / 2, z]} scale={[0.5, H, 0.5]} color={COLORS.signal} />
            <Part position={[x, 0.45, z]} scale={[0.9, 0.9, 0.6]} color="#1D1F24" outline={false} />
          </group>
        )),
      )}
      {[-1.6, 1.6].map((x) => (
        <Part key={`t${x}`} position={[x, H, 0]} scale={[0.6, 0.7, span * 2 + 0.6]} color={COLORS.signal} />
      ))}
      {[-span, span].map((z) => (
        <Part key={`s${z}`} position={[0, 1.2, z]} scale={[3.8, 0.5, 0.6]} color={COLORS.signal} />
      ))}
      <Part position={[2.3, 1.6, span]} scale={[1, 1.6, 1.2]} color="#F4F1EA" />
      {[-span, span].map((z) => (
        <Glow key={`f${z}`} position={[0, H - 0.5, z]} color={LIGHT.white} size={2.2} base={0.85} />
      ))}
      <Glow position={[2.3, 2.8, span]} color={LIGHT.sodium} size={1.4} blink={1.2} phase={phase} />
      <group ref={trolley}>
        <Glow position={[0, H + 0.05, 0]} color={LIGHT.white} size={1.8} />
        <mesh geometry={unitBox} material={mat(COLORS.steelDark)} position={[0, H + 0.5, 0]} scale={[3.6, 0.5, 1.6]} castShadow />
        <mesh ref={cable} geometry={unitBox} material={mat("#3A3F47")} scale={[0.1, 1, 0.1]} />
        <group ref={hook}>
          <mesh geometry={unitBox} material={mat(COLORS.amber)} scale={[3.1, 0.25, 1.3]} castShadow />
          <mesh geometry={unitBox} material={mat(color)} position={[0, -0.75, 0]} scale={[3.0, 1.25, 1.26]} castShadow />
        </group>
      </group>
    </group>
  );
}
