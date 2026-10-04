import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import type { Truck as TruckT, RoutePoint } from "@/data/types";
import { TRUCKS } from "@/data/port";
import { COLORS } from "@/data/layout";
import { sceneRegistry, simActions, simT } from "@/sim/simStore";
import { Part, Selectable, mat, unitBox } from "./parts";
import { Chip3D } from "./Chip3D";
import { Glow, LIGHT, Pool } from "./nightLights";
import { usePort } from "@/state/PortProvider";
import { nightFx } from "@/state/nightMode";

interface Leg {
  kind: "move" | "wait";
  t0: number;
  t1: number;
  from: [number, number];
  to: [number, number];
  load: boolean;
  status: string;
  hidden: boolean;
}

interface Timeline {
  legs: Leg[];
  total: number;
}

/** Turns a looping route into timed legs (driving + dwelling). Hidden legs are fast-forwarded. */
export function buildTimeline(route: RoutePoint[], speed: number): Timeline {
  const legs: Leg[] = [];
  let t = 0;
  let load = false;
  let status = route[0]?.status ?? "";
  let hidden = false;
  for (let i = 0; i < route.length; i++) {
    const a = route[i];
    const b = route[(i + 1) % route.length];
    if (a.load !== undefined) load = a.load;
    if (a.status) status = a.status;
    if (a.hidden !== undefined) hidden = a.hidden;
    else if (i > 0) hidden = false;
    if (a.wait) {
      legs.push({ kind: "wait", t0: t, t1: t + a.wait, from: a.p, to: a.p, load, status, hidden: false });
      t += a.wait;
    }
    const dist = Math.hypot(b.p[0] - a.p[0], b.p[1] - a.p[1]);
    const isHidden = a.hidden === true || (i === route.length - 1 && route[0].hidden === true);
    const dur = isHidden ? 2 : dist / speed;
    legs.push({ kind: "move", t0: t, t1: t + dur, from: a.p, to: b.p, load, status, hidden: isHidden });
    t += dur;
  }
  return { legs, total: t };
}

export interface Pose {
  leg: Leg;
  x: number;
  z: number;
}

/** Where a truck is on its looping timeline at absolute sim time `time`. */
export function poseAt(tl: Timeline, offset: number, time: number, out: Pose): Pose {
  const raw = (time + offset) % tl.total;
  const t = raw < 0 ? raw + tl.total : raw;
  const leg = tl.legs.find((l) => t >= l.t0 && t < l.t1) ?? tl.legs[0];
  const k = leg.t1 > leg.t0 ? (t - leg.t0) / (leg.t1 - leg.t0) : 0;
  out.leg = leg;
  out.x = leg.from[0] + (leg.to[0] - leg.from[0]) * k;
  out.z = leg.from[1] + (leg.to[1] - leg.from[1]) * k;
  return out;
}

interface TruckModelProps {
  cab: string;
  containerColor: string;
  itv: boolean;
}

export function TruckModel({ cab, containerColor, itv, boxRef }: TruckModelProps & { boxRef?: React.RefObject<THREE.Mesh> }) {
  return (
    <group>
      <Part position={[1.9, 1.05, 0]} scale={[1.5, itv ? 1.2 : 1.7, 1.35]} color={cab} />
      <mesh geometry={unitBox} material={mat(COLORS.ink)} position={[2.66, itv ? 1.3 : 1.45, 0]} scale={[0.04, 0.5, 1.1]} />
      <Part position={[-0.5, 0.55, 0]} scale={[3.6, 0.25, 1.2]} color="#2F343C" />
      {[2.0, 0.2, -1.6].map((x) =>
        [-0.6, 0.6].map((z) => (
          <mesh key={`${x}${z}`} geometry={unitBox} material={mat("#1B1D22")} position={[x, 0.35, z]} scale={[0.7, 0.7, 0.25]} />
        )),
      )}
      <mesh ref={boxRef} geometry={unitBox} material={mat(containerColor)} position={[-0.5, 1.32, 0]} scale={[3.0, 1.25, 1.26]} castShadow />
      {[0.45, -0.45].map((z) => (
        <group key={z}>
          <Glow position={[2.75, 0.85, z]} color={LIGHT.white} size={1.1} />
          <Glow position={[-2.35, 0.6, z * 1.1]} color={LIGHT.red} size={0.8} base={0.85} />
        </group>
      ))}
      <Pool position={[6.2, 0.06, 0]} radius={2.4} stretch={1.7} color={LIGHT.white} base={0.32} />
      {itv ? <Glow position={[1.9, 1.85, 0]} color={LIGHT.sodium} size={1} blink={1.1} /> : null}
    </group>
  );
}

function TruckLabel({ truck }: { truck: TruckT }) {
  const { selection, view, open } = usePort();
  const selected = selection?.kind === "truck" && selection.id === truck.id;
  const shipmentFocus = selection?.kind === "shipment" && selection.id === truck.shipmentId;
  const gateHot = view === "overview" && truck.id === "XD3390H";
  if (!selected && !shipmentFocus && !gateHot) return null;
  const text = shipmentFocus || selected ? `TRUCK ${truck.plate} · ${truck.gate ? `via ${truck.gate}` : truck.carrier}` : `${truck.plate} · Queued 18 min`;
  return (
    <Chip3D position={[0, 4.6, 0]} tone={gateHot && !selected ? "amber" : "signal"} active={selected || shipmentFocus} onClick={() => open({ kind: "truck", id: truck.id })}>
      <span className="font-mono text-[12px]">{text}</span>
    </Chip3D>
  );
}

function Truck({ truck }: { truck: TruckT }) {
  const group = useRef<THREE.Group>(null);
  const box = useRef<THREE.Mesh>(null);
  const timeline = useMemo(() => buildTimeline(truck.route, truck.speed), [truck]);
  const heading = useRef<number>(0);
  const pose = useRef<Pose>({ leg: timeline.legs[0], x: 0, z: 0 });

  useEffect(() => {
    const g = group.current;
    if (g) sceneRegistry.set(`truck:${truck.id}`, g);
    return () => {
      sceneRegistry.delete(`truck:${truck.id}`);
    };
  }, [truck.id]);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const { leg, x, z } = poseAt(timeline, truck.offset, simT(), pose.current);
    g.position.set(x, 0, z);
    g.visible = !leg.hidden;
    if (leg.kind === "move" && (leg.to[0] !== leg.from[0] || leg.to[1] !== leg.from[1])) {
      const target = Math.atan2(-(leg.to[1] - leg.from[1]), leg.to[0] - leg.from[0]);
      let diff = target - heading.current;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      heading.current += diff * 0.18;
    }
    g.rotation.y = heading.current;
    if (box.current) box.current.visible = leg.load;
    simActions.setTruckStatus(truck.id, leg.status);
  });

  return (
    <group ref={group}>
      <Selectable sel={{ kind: "truck", id: truck.id }}>
        <TruckModel cab={truck.cab} containerColor={truck.containerColor} itv={truck.kind === "itv"} boxRef={box} />
      </Selectable>
      <TruckLabel truck={truck} />
    </group>
  );
}

const TRAIL_SEGS = 18;
/** Sim seconds between trail samples; 18 × 0.14s ≈ 22 m of road at truck speed. */
const TRAIL_DT = 0.14;
/** Start the trail just behind the trailer rather than under the cab. */
const TRAIL_LEAD = 0.26;
const TRAIL_Y = 0.13;
const TRAIL_HEAD_W = 1.05;
const TRAIL_TAIL_W = 0.18;

const trailVert = /* glsl */ `
  attribute float aAlpha;
  attribute float aSide;
  attribute float aSel;
  varying float vAlpha;
  varying float vSide;
  varying float vSel;
  void main() {
    vAlpha = aAlpha;
    vSide = aSide;
    vSel = aSel;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const trailFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uSelColor;
  uniform float uOpacity;
  uniform float uSelBoost;
  varying float vAlpha;
  varying float vSide;
  varying float vSel;
  void main() {
    float edge = 1.0 - smoothstep(0.35, 1.0, abs(vSide));
    float a = vAlpha * edge * uOpacity * mix(1.0, uSelBoost, vSel);
    if (a < 0.003) discard;
    gl_FragColor = vec4(mix(uColor, uSelColor, vSel), a);
  }
`;

function trailMaterial(color: string, selColor: string, selBoost: number, additive: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: trailVert,
    fragmentShader: trailFrag,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uSelColor: { value: new THREE.Color(selColor) },
      uOpacity: { value: 0 },
      uSelBoost: { value: selBoost },
    },
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    toneMapped: false,
  });
}

/**
 * Comet-shaped ribbons behind every moving truck: wide and bright at the trailer, tapering away,
 * so direction of travel reads at a glance. Sampled from the same timeline as the trucks, so the
 * trail stays exact while paused or replaying, and drains into the truck when it stops.
 * Harbor blue by day, tail-light red streaks at night; the selected truck's trail is signal orange.
 */
function TruckTrails() {
  const { selection } = usePort();
  const selectedId = useMemo<string | null>(() => {
    if (selection?.kind === "truck") return selection.id;
    if (selection?.kind === "shipment") return TRUCKS.find((t) => t.shipmentId === selection.id)?.id ?? null;
    return null;
  }, [selection]);
  const selRef = useRef<string | null>(selectedId);
  selRef.current = selectedId;

  const tracks = useMemo(() => TRUCKS.map((t) => ({ id: t.id, offset: t.offset, tl: buildTimeline(t.route, t.speed) })), []);

  const { geometry, dayMat, nightMat } = useMemo(() => {
    const per = (TRAIL_SEGS + 1) * 2;
    const count = tracks.length * per;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(count), 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aSel", new THREE.BufferAttribute(new Float32Array(count), 1).setUsage(THREE.DynamicDrawUsage));
    const side = new Float32Array(count);
    for (let i = 0; i < count; i++) side[i] = i % 2 === 0 ? -1 : 1;
    g.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
    const idx: number[] = [];
    for (let tr = 0; tr < tracks.length; tr++) {
      const b = tr * per;
      for (let s = 0; s < TRAIL_SEGS; s++) {
        const a = b + s * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    g.setIndex(idx);
    return {
      geometry: g,
      dayMat: trailMaterial("#2C6FB0", COLORS.signal, 1.6, false),
      nightMat: trailMaterial("#FF4A36", "#FF8A4C", 1.5, true),
    };
  }, [tracks]);

  useEffect(
    () => () => {
      geometry.dispose();
      dayMat.dispose();
      nightMat.dispose();
    },
    [geometry, dayMat, nightMat],
  );

  const scratch = useMemo(() => ({ pose: { leg: tracks[0].tl.legs[0], x: 0, z: 0 } as Pose, xs: new Float32Array(TRAIL_SEGS + 1), zs: new Float32Array(TRAIL_SEGS + 1) }), [tracks]);

  useFrame(() => {
    const mix = nightFx.mix;
    dayMat.uniforms.uOpacity.value = (1 - mix) * 0.42;
    nightMat.uniforms.uOpacity.value = mix * 0.62;

    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const alpha = geometry.attributes.aAlpha as THREE.BufferAttribute;
    const sel = geometry.attributes.aSel as THREE.BufferAttribute;
    const P = pos.array as Float32Array;
    const A = alpha.array as Float32Array;
    const S = sel.array as Float32Array;
    const now = simT();
    const { pose, xs, zs } = scratch;
    const per = (TRAIL_SEGS + 1) * 2;

    tracks.forEach((tr, ti) => {
      const isSel = tr.id === selRef.current ? 1 : 0;
      // Walk back in time; once the route jumps through a hidden leg, freeze the remaining samples.
      let alive = TRAIL_SEGS + 1;
      for (let i = 0; i <= TRAIL_SEGS; i++) {
        if (i >= alive) {
          xs[i] = xs[i - 1];
          zs[i] = zs[i - 1];
          continue;
        }
        poseAt(tr.tl, tr.offset, now - TRAIL_LEAD - i * TRAIL_DT, pose);
        if (pose.leg.hidden) {
          alive = i;
          xs[i] = i > 0 ? xs[i - 1] : pose.x;
          zs[i] = i > 0 ? zs[i - 1] : pose.z;
          continue;
        }
        xs[i] = pose.x;
        zs[i] = pose.z;
      }

      let px = 0;
      let pz = 0;
      const base = ti * per;
      for (let i = 0; i <= TRAIL_SEGS; i++) {
        const a = Math.max(0, i - 1);
        const b = Math.min(TRAIL_SEGS, i + 1);
        const dx = xs[a] - xs[b];
        const dz = zs[a] - zs[b];
        const len = Math.hypot(dx, dz);
        if (len > 1e-4) {
          px = -dz / len;
          pz = dx / len;
        }
        const u = i / TRAIL_SEGS;
        const w = (TRAIL_HEAD_W + (TRAIL_TAIL_W - TRAIL_HEAD_W) * u) * (isSel ? 1.25 : 1);
        const fade = i < alive ? Math.pow(1 - u, 1.5) : 0;
        const v = base + i * 2;
        P[v * 3] = xs[i] - px * w;
        P[v * 3 + 1] = TRAIL_Y;
        P[v * 3 + 2] = zs[i] - pz * w;
        P[v * 3 + 3] = xs[i] + px * w;
        P[v * 3 + 4] = TRAIL_Y;
        P[v * 3 + 5] = zs[i] + pz * w;
        A[v] = fade;
        A[v + 1] = fade;
        S[v] = isSel;
        S[v + 1] = isSel;
      }
    });
    pos.needsUpdate = true;
    alpha.needsUpdate = true;
    sel.needsUpdate = true;
  });

  const noRay = useMemo(() => () => null, []);
  return (
    <group>
      <mesh geometry={geometry} material={dayMat} frustumCulled={false} raycast={noRay} renderOrder={1} />
      <mesh geometry={geometry} material={nightMat} frustumCulled={false} raycast={noRay} renderOrder={1} />
    </group>
  );
}

/** Animated dashed route for the shipment's truck. */
function ShipmentRoute() {
  const { selection } = usePort();
  const truck = selection?.kind === "shipment" ? TRUCKS.find((t) => t.shipmentId === selection.id) : undefined;
  const points = useMemo(() => {
    if (!truck) return [];
    return truck.route.filter((p) => !p.hidden).map((p) => new THREE.Vector3(p.p[0], 0.25, p.p[1]));
  }, [truck]);
  const ref = useRef<{ material: { dashOffset: number } } | null>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.material.dashOffset -= dt * 4;
  });
  if (!truck || points.length < 2) return null;
  return (
    <group>
      <Line points={points} color="#FFFFFF" lineWidth={9} transparent opacity={0.85} />
      <Line ref={ref as never} points={points} color={COLORS.signal} lineWidth={5} dashed dashSize={2.2} gapSize={1.4} />
    </group>
  );
}

export function Trucks() {
  return (
    <group>
      <TruckTrails />
      {TRUCKS.map((t) => (
        <Truck key={t.id} truck={t} />
      ))}
      <ShipmentRoute />
    </group>
  );
}
