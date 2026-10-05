import { memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Outlines, Text } from "@react-three/drei";
import type { Vessel } from "@/data/types";
import { COLORS, CONTAINER_COLORS, SHIP_Z, WATER_Y, berthX } from "@/data/layout";
import { mulberry32 } from "@/data/containers";
import { fmtClock, sceneRegistry, sim, simT, useSimTick } from "@/sim/simStore";
import { aisFix, newFix } from "@/sim/ais/tracker";
import { TRANSITS, VISIBLE_X, portCall } from "@/sim/ais/portCalls";
import type { Transit } from "@/sim/ais/portCalls";
import { bearingToRotY } from "@/sim/ais/geo";
import { Part, Selectable, mat, unitBox, unitCyl, useHighlight } from "./parts";
import { Chip3D } from "./Chip3D";
import type { ChipTone } from "./Chip3D";
import { FONT_URL } from "./Terrain";
import { Glow, LIGHT, Pool, litMat } from "./nightLights";
import { usePort } from "@/state/PortProvider";
import { seaState } from "@/sim/weatherFx";

const BEAM = 7.6;
const HULL_H = 4.2;
const DRAFT = 1.8;
export const DECK_Y = HULL_H - DRAFT;

function hullGeometry(length: number, depth: number): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  const h = BEAM / 2;
  const bowStart = length / 2 - 7;
  s.moveTo(-length / 2, -h + 0.4);
  s.quadraticCurveTo(-length / 2, -h, -length / 2 + 0.6, -h);
  s.lineTo(bowStart, -h);
  s.quadraticCurveTo(length / 2 - 1.2, -h + 0.2, length / 2, 0);
  s.quadraticCurveTo(length / 2 - 1.2, h - 0.2, bowStart, h);
  s.lineTo(-length / 2 + 0.6, h);
  s.quadraticCurveTo(-length / 2, h, -length / 2, h - 0.4);
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 10 });
}

interface DeckSlot {
  x: number;
  y: number;
  z: number;
  color: THREE.Color;
}

function deckSlots(length: number, seed: number): DeckSlot[] {
  const r = mulberry32(seed);
  const palette = [CONTAINER_COLORS.orange, CONTAINER_COLORS.navy, CONTAINER_COLORS.brick, CONTAINER_COLORS.moss, CONTAINER_COLORS.sand, CONTAINER_COLORS.steel, CONTAINER_COLORS.orange];
  const bays = Math.floor((length - 14) / 3.15);
  const startX = -length / 2 + 7.6;
  const slots: DeckSlot[] = [];
  for (let b = 0; b < bays; b++) {
    for (let row = 0; row < 5; row++) {
      const maxTier = b === 0 || b === bays - 1 ? 3 : 4;
      for (let t = 0; t < maxTier; t++) {
        slots.push({
          x: startX + b * 3.15 + 1.5,
          y: DECK_Y + 0.65 + t * 1.3,
          z: -2.64 + row * 1.32,
          color: new THREE.Color(palette[Math.floor(r() * palette.length)]),
        });
      }
    }
  }
  return slots.sort((a, b) => a.y - b.y);
}

interface ShipModelProps {
  length: number;
  hull: string;
  name: string;
  seed: number;
  /** Returns fraction (0..1) of deck slots to show. */
  fill: () => number;
}

/** Low-poly container ship facing +x. Origin is at the waterline. */
export const ShipModel = memo(function ShipModel({ length, hull, name, seed, fill }: ShipModelProps) {
  const hl = useHighlight();
  const hullGeo = useMemo(() => hullGeometry(length, HULL_H), [length]);
  const bootGeo = useMemo(() => hullGeometry(length, 2.1), [length]);
  const sheerGeo = useMemo(() => hullGeometry(length, 0.35), [length]);
  const slots = useMemo(() => deckSlots(length, seed), [length, seed]);
  const inst = useRef<THREE.InstancedMesh>(null);
  const lastCount = useRef<number>(-1);

  useLayoutEffect(() => {
    const m = inst.current;
    if (!m) return;
    const o = new THREE.Object3D();
    slots.forEach((s, i) => {
      o.position.set(s.x, s.y, s.z);
      o.scale.set(3.0, 1.25, 1.26);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, s.color);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [slots]);

  useFrame(() => {
    const m = inst.current;
    if (!m) return;
    const count = Math.round(slots.length * Math.max(0, Math.min(1, fill())));
    if (count !== lastCount.current) {
      m.count = count;
      lastCount.current = count;
    }
  });

  const sx = -length / 2;
  return (
    <group>
      <mesh geometry={hullGeo} material={mat(hull, { rough: 0.6 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, -DRAFT, 0]} castShadow receiveShadow>
        {hl > 0 ? <Outlines thickness={hl === 2 ? 0.35 : 0.2} color={COLORS.signal} opacity={hl === 2 ? 1 : 0.6} transparent={hl !== 2} /> : null}
      </mesh>
      <mesh geometry={bootGeo} material={mat("#B23A33", { rough: 0.7 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, -DRAFT - 0.05, 0]} scale={[1.004, 1.012, 1]} />
      <mesh geometry={sheerGeo} material={mat("#F4F1EA")} rotation={[-Math.PI / 2, 0, 0]} position={[0, DECK_Y - 0.36, 0]} scale={[1.003, 1.01, 1]} />
      <mesh geometry={unitBox} material={mat("#5B6470")} position={[0.6, DECK_Y + 0.05, 0]} scale={[length - 9, 0.1, BEAM - 0.6]} receiveShadow />
      <instancedMesh ref={inst} args={[undefined, undefined, slots.length]} geometry={unitBox} castShadow receiveShadow>
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
      {/* Accommodation block */}
      <Part position={[sx + 3.4, DECK_Y + 3.3, 0]} scale={[4, 6.6, 6.4]} color="#F4F1EA" />
      {[1.6, 3.4, 5.2].map((y) => (
        <mesh key={y} geometry={unitBox} material={litMat("#24344F", LIGHT.window, 1.25)} position={[sx + 3.4, DECK_Y + y, 0]} scale={[4.04, 0.45, 6.44]} />
      ))}
      <Part position={[sx + 3.6, DECK_Y + 6.9, 0]} scale={[3.4, 0.7, 8.6]} color="#F4F1EA" />
      <mesh geometry={unitBox} material={litMat("#24344F", LIGHT.window, 1.6)} position={[sx + 3.6, DECK_Y + 6.9, 0]} scale={[3.44, 0.32, 8.64]} />
      <ShipLights length={length} />
      <Part position={[sx + 1.0, DECK_Y + 5.6, 0]} scale={[1.4, 3.2, 1.8]} color={hull} />
      <mesh geometry={unitBox} material={mat(COLORS.signal)} position={[sx + 1.0, DECK_Y + 6.4, 0]} scale={[1.44, 0.5, 1.84]} />
      <Part position={[length / 2 - 3.2, DECK_Y + 2.5, 0]} scale={[0.25, 5, 0.25]} color="#F4F1EA" cylinder />
      <Part position={[length / 2 - 3.6, DECK_Y + 0.5, 0]} scale={[2.2, 1, BEAM - 2]} color="#F4F1EA" />
      {[1, -1].map((side) => (
        <Text
          key={side}
          font={FONT_URL}
          fontSize={1.05}
          color="#F4F1EA"
          position={[length / 2 - 9, 0.4, side * (BEAM / 2 + 0.02)]}
          rotation={[0, side === 1 ? 0 : Math.PI, 0]}
          anchorX={side === 1 ? "right" : "left"}
          letterSpacing={0.08}
        >
          {name}
        </Text>
      ))}
    </group>
  );
});

/** Navigation lights (masthead, port red, starboard green, stern), deck floods and their glow on the water. */
const ShipLights = memo(function ShipLights({ length }: { length: number }) {
  const sx = -length / 2;
  const floods = useMemo(() => {
    const out: number[] = [];
    for (let x = sx + 12; x < length / 2 - 6; x += 14) out.push(x);
    return out;
  }, [length, sx]);
  return (
    <group>
      <Glow position={[length / 2 - 3.2, DECK_Y + 5.3, 0]} color={LIGHT.white} size={1.8} />
      <Glow position={[sx + 3.6, DECK_Y + 7.6, 0]} color={LIGHT.white} size={1.5} />
      <Glow position={[sx + 3.6, DECK_Y + 7.1, 4.5]} color={LIGHT.green} size={1.6} />
      <Glow position={[sx + 3.6, DECK_Y + 7.1, -4.5]} color={LIGHT.red} size={1.6} />
      <Glow position={[sx - 0.1, DECK_Y + 1.2, 0]} color={LIGHT.white} size={1.2} base={0.8} />
      <Glow position={[sx + 5.6, DECK_Y + 6.4, 0]} color={LIGHT.sodium} size={3.4} base={0.8} />
      {floods.map((x) => (
        <group key={x}>
          <Glow position={[x, DECK_Y + 6.2, 3.9]} color={LIGHT.sodium} size={2} base={0.75} />
          <Glow position={[x, DECK_Y + 6.2, -3.9]} color={LIGHT.sodium} size={2} base={0.75} />
        </group>
      ))}
      {[1, -1].map((side) => (
        <Pool key={side} position={[0, 0.08, side * (BEAM / 2 + 2.6)]} radius={3.4} stretch={length / 7.5} color={LIGHT.sodium} base={0.2} />
      ))}
    </group>
  );
});

/** Soft V-shaped wake trailing a moving hull. */
function Wake({ length, strength }: { length: number; strength: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.MeshBasicMaterial>(null);
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-length / 2, -3.6);
    s.lineTo(-length / 2 - 26, -11);
    s.lineTo(-length / 2 - 26, 11);
    s.lineTo(-length / 2, 3.6);
    s.closePath();
    return new THREE.ShapeGeometry(s);
  }, [length]);
  useFrame(() => {
    if (ref.current) ref.current.opacity = 0.32 * strength.current;
  });
  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
      <meshBasicMaterial ref={ref} color="#F4FBF9" transparent opacity={0.3} depthWrite={false} />
    </mesh>
  );
}

function Tug({ color = "#2F5D4E" }: { color?: string }) {
  return (
    <group>
      <mesh geometry={unitBox} material={mat(color)} position={[0, 0.2, 0]} scale={[5, 1.4, 2.2]} castShadow />
      <mesh geometry={unitBox} material={mat("#1D1F24")} position={[0, -0.3, 0]} scale={[5.1, 0.4, 2.3]} />
      <mesh geometry={unitBox} material={mat("#F4F1EA")} position={[0.3, 1.5, 0]} scale={[2, 1.4, 1.6]} castShadow />
      <mesh geometry={unitBox} material={litMat(COLORS.ink, LIGHT.window, 1.4)} position={[0.3, 1.8, 0]} scale={[2.04, 0.4, 1.64]} />
      <mesh geometry={unitCyl} material={mat(COLORS.signal)} position={[-0.6, 2.6, 0]} scale={[0.4, 1, 0.4]} />
      <Glow position={[0.3, 3.0, 0]} color={LIGHT.white} size={1.1} />
      <Glow position={[2.6, 0.9, 0]} color={LIGHT.warm} size={1.3} base={0.8} />
    </group>
  );
}

const fmtKn = (kn: number): string => `${kn.toFixed(1)} kn`;

/** Floating label: cargo progress alongside, or the AIS movement state while the ship is on the move. */
function VesselLabel({ vessel, y }: { vessel: Vessel; y: number }) {
  useSimTick();
  const { selection, view, open } = usePort();
  const selected = selection?.kind === "vessel" && selection.id === vessel.id;
  if (!(selected || view === "overview" || view === "vessels")) return null;
  const live = sim.vessels[vessel.id];
  const call = sim.calls[vessel.id];
  let text = vessel.short;
  let tone: ChipTone = "signal";
  let pulse = false;
  const eta = call?.etaSec != null ? ` · ${call.etaLabel} ${fmtClock(call.etaSec)}` : "";
  if (call && call.phase !== "alongside") {
    if (call.phase === "sailed") return null;
    tone = call.lost ? "brick" : call.phase === "anchored" ? "amber" : "harbor";
    pulse = call.phase === "berthing" || call.phase === "unberthing";
    text =
      call.phase === "anchored"
        ? `${vessel.short} · At anchor${eta}`
        : call.phase === "berthing"
          ? `${vessel.short} · Berthing · tugs fast`
          : call.phase === "unberthing"
            ? `${vessel.short} · Unberthing · tugs fast`
            : call.phase === "outbound"
              ? `${vessel.short} · Outbound ${fmtKn(call.sog)}`
              : `${vessel.short} · ${fmtKn(call.sog)}${eta}`;
  } else if (call && vessel.id !== "orient-lotus") {
    tone = "moss";
    text = `${vessel.short} · Cargo complete${eta}`;
  } else if (vessel.status === "loading") {
    text = `${vessel.short} · Loading ${Math.round((live.loaded / vessel.loadTotal) * 100)}%`;
    tone = "moss";
  } else {
    text = `${vessel.short} · Discharging ${Math.round((live.discharged / vessel.dischargeTotal) * 100)}%`;
  }
  return (
    <Chip3D position={[0, y, 0]} tone={tone} pulse={pulse} active={selected} onClick={() => open({ kind: "vessel", id: vessel.id })}>
      <span className="font-mono">{text}</span>
    </Chip3D>
  );
}

/** A ship moored alongside its berth. */
export function BerthedVessel({ vessel }: { vessel: Vessel }) {
  const group = useRef<THREE.Group>(null);
  useEffect(() => {
    const g = group.current;
    if (g) sceneRegistry.set(`vessel:${vessel.id}`, g);
    return () => {
      sceneRegistry.delete(`vessel:${vessel.id}`);
    };
  }, [vessel.id]);
  const fill = useMemo(
    () => () => {
      const live = sim.vessels[vessel.id];
      if (vessel.status === "loading") return 0.25 + 0.75 * (live.loaded / vessel.loadTotal);
      return 0.3 + 0.7 * (1 - live.discharged / vessel.dischargeTotal);
    },
    [vessel],
  );
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const t = simT();
    const sea = seaState();
    g.position.y = WATER_Y + Math.sin(t * 0.6 + vessel.berth) * 0.05 * sea;
    // Moored hulls only roll a touch, even in a squall.
    g.rotation.x = Math.sin(t * 0.45 + vessel.berth * 1.7) * 0.002 * (sea - 1);
  });
  return (
    <group ref={group} position={[berthX(vessel.berth), WATER_Y, SHIP_Z]}>
      <Selectable sel={{ kind: "vessel", id: vessel.id }}>
        <ShipModel length={vessel.length} hull={vessel.hull} name={vessel.short} seed={vessel.berth * 31} fill={fill} />
      </Selectable>
      <VesselLabel vessel={vessel} y={DECK_Y + 9.5} />
    </group>
  );
}

const smooth = (u: number): number => u * u * (3 - 2 * u);
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** 0 → no tugs, 1 → tugs made fast; tugs steam in over 90 s and cast off over 60 s. */
function tugPresence(windows: Array<[number, number]>, t: number): number {
  let p = 0;
  for (const [a, b] of windows) p = Math.max(p, Math.min(smooth(clamp01((t - a) / 90)), smooth(clamp01((b - t) / 60))));
  return p;
}

/**
 * A ship making a port movement (arrival, departure or anchorage call). Her pose comes only from decoded
 * AIS position reports, dead-reckoned between fixes. Tugs join for every berthing and unberthing.
 */
export function PortCallVessel({ vessel }: { vessel: Vessel }) {
  const group = useRef<THREE.Group>(null);
  const tugA = useRef<THREE.Group>(null);
  const tugB = useRef<THREE.Group>(null);
  const wake = useRef<number>(0);
  const fix = useMemo(newFix, []);
  const call = useMemo(() => portCall(vessel.id), [vessel.id]);
  const fill = useMemo(
    () => () => {
      const live = sim.vessels[vessel.id];
      if (vessel.status === "loading") return 0.25 + 0.75 * (live.loaded / vessel.loadTotal);
      return 0.3 + 0.7 * (1 - live.discharged / vessel.dischargeTotal);
    },
    [vessel],
  );

  useEffect(() => {
    const g = group.current;
    if (g) sceneRegistry.set(`vessel:${vessel.id}`, g);
    return () => {
      sceneRegistry.delete(`vessel:${vessel.id}`);
    };
  }, [vessel.id]);

  useFrame(() => {
    const g = group.current;
    if (!g || !call) return;
    const now = simT();
    const f = aisFix(vessel.id, now, fix);
    g.visible = Math.abs(f.x) < VISIBLE_X && f.z < 700;
    if (!g.visible) return;
    const sea = seaState();
    g.position.set(f.x, WATER_Y + Math.sin(now * 0.7 + vessel.berth) * 0.06 * sea, f.z);
    g.rotation.y = bearingToRotY(f.heading);
    g.rotation.x = Math.sin(now * 0.5 + vessel.berth) * 0.004 * (sea - 1);
    wake.current = f.status === 0 ? Math.min(1, f.sog / 6) : 0;

    const presence = tugPresence(call.voyage.tugWindows, now);
    const leg = call.voyage.legAt(now);
    const pushing = leg.kind === "push" ? 1 : leg.kind === "moored" ? 1 : 0;
    // Offshore side of the hull in ship-local coordinates: tugs push from the seaward side.
    const side = Math.cos(g.rotation.y) >= 0 ? 1 : -1;
    const away = (1 - presence) * 38;
    const half = vessel.length / 2;
    const ta = tugA.current;
    const tb = tugB.current;
    if (ta) {
      ta.visible = presence > 0.01;
      ta.position.set(THREE.MathUtils.lerp(half + 7, half * 0.55, pushing), 0.3 + Math.sin(now * 1.3) * 0.1, side * (THREE.MathUtils.lerp(1.5, BEAM / 2 + 1.4, pushing) + away));
      ta.rotation.y = pushing ? side * (Math.PI / 2) : 0;
    }
    if (tb) {
      tb.visible = presence > 0.01;
      tb.position.set(THREE.MathUtils.lerp(-half - 7, -half * 0.55, pushing), 0.3 + Math.sin(now * 1.1 + 1) * 0.1, side * (THREE.MathUtils.lerp(-1.5, BEAM / 2 + 1.4, pushing) + away));
      tb.rotation.y = pushing ? side * (Math.PI / 2) : Math.PI;
    }
  });

  return (
    <group ref={group}>
      <Wake length={vessel.length} strength={wake} />
      <Selectable sel={{ kind: "vessel", id: vessel.id }}>
        <ShipModel length={vessel.length} hull={vessel.hull} name={vessel.short} seed={vessel.berth * 31 + vessel.length} fill={fill} />
      </Selectable>
      <group ref={tugA} visible={false}>
        <Tug />
      </group>
      <group ref={tugB} visible={false}>
        <Tug color="#1E3A66" />
      </group>
      <VesselLabel vessel={vessel} y={DECK_Y + 9.5} />
    </group>
  );
}

function TransitLabel({ name, id }: { name: string; id: string }) {
  useSimTick();
  const { view } = usePort();
  const fix = useMemo(newFix, []);
  if (view !== "vessels") return null;
  const f = aisFix(id, simT(), fix);
  if (Math.abs(f.x) > 360) return null;
  return (
    <Chip3D position={[0, DECK_Y + 8, 0]} tone="ink">
      <span className="font-mono text-slate">
        {name} · {fmtKn(f.sog)} {f.cog > 180 ? "← westbound" : "→ eastbound"}
      </span>
    </Chip3D>
  );
}

/** A ship transiting the Singapore Strait past the terminal, driven by its AIS reports. */
function TransitShip({ tr }: { tr: Transit }) {
  const ref = useRef<THREE.Group>(null);
  const wake = useRef<number>(0);
  const fix = useMemo(newFix, []);
  const fill = useMemo(() => () => 0.55 + ((tr.length * 7) % 10) / 25, [tr.length]);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const t = simT();
    const f = aisFix(tr.id, t, fix);
    g.visible = Math.abs(f.x) < VISIBLE_X;
    if (!g.visible) return;
    const sea = seaState();
    g.position.set(f.x, WATER_Y + Math.sin(t * 0.8 + tr.length) * 0.05 * sea, f.z);
    g.rotation.y = bearingToRotY(f.heading);
    // Under-way ships pitch and roll in the swell.
    g.rotation.x = Math.sin(t * 0.55 + tr.length) * 0.006 * (sea - 1);
    g.rotation.z = Math.sin(t * 0.37 + tr.length * 0.3) * 0.004 * (sea - 1);
    wake.current = Math.min(1, f.sog / 6);
  });
  return (
    <group ref={ref} visible={false}>
      <Wake length={tr.length} strength={wake} />
      <ShipModel length={tr.length} hull={tr.hull} name={tr.name} seed={tr.length * 13} fill={fill} />
      <TransitLabel name={tr.name} id={tr.id} />
    </group>
  );
}

/** IALA region A marks along the Strait TSS: red on the separation-zone side of the westbound lane, green on the shore side. */
const BUOYS: Array<[number, number, string]> = [
  [-300, 206, COLORS.brick],
  [-100, 208, COLORS.brick],
  [100, 207, COLORS.brick],
  [640, 206, COLORS.brick],
  [-200, 128, COLORS.moss],
  [0, 127, COLORS.moss],
  [200, 128, COLORS.moss],
  [420, 136, COLORS.moss],
];

/** Singapore Strait traffic in the TSS lanes (each ship driven by its own AIS reports) plus the lane buoys. */
export function ChannelTraffic() {
  const buoys = useRef<THREE.Group>(null);
  useFrame(() => {
    const t = simT();
    buoys.current?.children.forEach((c, i) => {
      c.position.y = WATER_Y + 0.2 + Math.sin(t * 1.4 + i) * 0.18;
      c.rotation.z = Math.sin(t * 1.1 + i) * 0.08;
    });
  });
  return (
    <group>
      {TRANSITS.map((tr) => (
        <TransitShip key={tr.id} tr={tr} />
      ))}
      <group ref={buoys}>
        {BUOYS.map(([x, z, c]) => (
          <group key={`${x}-${z}`} position={[x, WATER_Y, z]}>
            <mesh geometry={unitCyl} material={mat(c)} scale={[1.1, 1.2, 1.1]} castShadow />
            <mesh geometry={unitCyl} material={mat(c)} position={[0, 1.4, 0]} scale={[0.25, 1.8, 0.25]} />
            <mesh geometry={unitBox} material={mat("#F4F1EA")} position={[0, 0.2, 0]} scale={[1.16, 0.3, 1.16]} />
            <Glow position={[0, 2.6, 0]} color={c === COLORS.moss ? LIGHT.green : LIGHT.red} size={2.4} blink={2.6} phase={(Math.abs(x) * 0.013) % 2.6} />
          </group>
        ))}
      </group>
    </group>
  );
}
