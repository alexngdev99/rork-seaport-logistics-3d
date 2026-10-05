import { memo, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { COLORS } from "@/data/layout";
import { simT } from "@/sim/simStore";
import { solarPosition } from "@/sim/sun";
import { weatherFx } from "@/sim/weatherFx";
import { craneHoldReason, env, productivityFactor } from "@/state/environment";
import { nightFx } from "@/state/nightMode";
import { updateNight } from "./nightLights";

const IS_LITE = typeof window !== "undefined" && (window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 1024);
const SHADOW_MAP = IS_LITE ? 2048 : 4096;
const noRay = (): null => null;

type Stop = readonly [number, THREE.Color];
const stops = (list: Array<[number, string]>): Stop[] => list.map(([e, c]) => [e, new THREE.Color(c)] as const);

/** Piecewise-linear colour ramp keyed by sun elevation (degrees). */
function sample(list: Stop[], e: number, out: THREE.Color): THREE.Color {
  if (e <= list[0][0]) return out.copy(list[0][1]);
  for (let i = 1; i < list.length; i++) {
    const [e1, c1] = list[i];
    if (e <= e1) {
      const [e0, c0] = list[i - 1];
      return out.copy(c0).lerp(c1, (e - e0) / (e1 - e0));
    }
  }
  return out.copy(list[list.length - 1][1]);
}

// Night navy → blue hour → coral sunrise → golden hour → chart-paper cream.
const SKY_BG = stops([
  [-12, "#0B1729"],
  [-6, "#1C2D4E"],
  [-2.5, "#4D5F82"],
  [0.5, "#D79A7C"],
  [4, "#F2C7A0"],
  [11, "#F6E4CC"],
  [22, COLORS.canvas],
]);
const HEMI_SKY = stops([
  [-10, "#5274AC"],
  [-1, "#8C93A8"],
  [3, "#F3C9A2"],
  [12, "#FFEBD2"],
  [24, "#FFF8EA"],
]);
const HEMI_GROUND = stops([
  [-10, "#151D2A"],
  [0, "#6E6559"],
  [14, "#C9BFA8"],
]);
const SUN_COL = stops([
  [-3, "#FF8448"],
  [3, "#FFAF6E"],
  [12, "#FFDDB4"],
  [28, "#FFF4E0"],
]);
const MOON_COL = new THREE.Color("#A9C2EE");
const HAZE_SUN = new THREE.Color("#FFC27E");
const FLASH = new THREE.Color("#DCE4F5");

/** Weather tints for the sky / fog, by day and by night. */
const WX = {
  cloud: [new THREE.Color("#E1DED7"), new THREE.Color("#121B2A")],
  rain: [new THREE.Color("#B8C0C4"), new THREE.Color("#0F1824")],
  storm: [new THREE.Color("#848E97"), new THREE.Color("#0A1019")],
  fog: [new THREE.Color("#E8E7E2"), new THREE.Color("#283244")],
  haze: [new THREE.Color("#E3CFA2"), new THREE.Color("#2B2519")],
} as const;

const smooth = (k: number): number => k * k * (3 - 2 * k);
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const smoothstep = (a: number, b: number, v: number): number => smooth(clamp01((v - a) / (b - a)));
const DEG = Math.PI / 180;

/** Pseudo-random 0…1 per integer slot (stable for replay). */
const hash = (n: number): number => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const STRIKE_SLOT = 5.5;

/** Lightning schedule as a pure function of sim time: which strike slot we are in and its flash envelope. */
export function strikeAt(t: number): { slot: number; env: number } {
  const slot = Math.floor(t / STRIKE_SLOT);
  if (hash(slot) < 0.3) return { slot, env: 0 };
  const at = slot * STRIKE_SLOT + hash(slot + 0.37) * (STRIKE_SLOT - 0.8);
  const d = t - at;
  if (d < 0 || d > 0.62) return { slot, env: 0 };
  const e = d < 0.07 ? 1 : d < 0.15 ? 0.2 : d < 0.23 ? 0.9 : d < 0.3 ? 0.35 : Math.max(0, 1 - (d - 0.3) / 0.32) * 0.55;
  return { slot, env: e };
}

const tmpA = new THREE.Color();
const tmpB = new THREE.Color();
const tmpC = new THREE.Color();
const sunDir = new THREE.Vector3();
const moonDir = new THREE.Vector3(Math.sin(232 * DEG) * Math.cos(50 * DEG), Math.sin(50 * DEG), -Math.cos(232 * DEG) * Math.cos(50 * DEG));

/**
 * Sun, moon, sky, fog and weather for the 3D port. The sun follows the real solar path over
 * Pasir Panjang (or the demo clock); weather values ease toward the live / demo conditions and
 * are published on `weatherFx` for the water, ships, smoke and the crane weather hold.
 */
export const SkyRig = memo(function SkyRig() {
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const scene = useThree((s) => s.scene);
  const dir = useRef<THREE.Vector3>(new THREE.Vector3(0.45, 0.7, 0.35).normalize());
  const elevE = useRef<number | null>(null);
  const windDir = useRef<THREE.Vector2>(new THREE.Vector2(0.6, -0.8));
  const isFirst = useRef<boolean>(true);

  useFrame(({ clock }, rawDt) => {
    // First frame snaps to the current sky + weather so a night visit never fades in from day.
    const dt = isFirst.current ? 1000 : Math.min(0.25, rawDt);
    isFirst.current = false;
    const w = env.weather();
    const sky = env.skyClock();
    const pos = solarPosition(sky.doy, sky.sec);
    weatherFx.sunElev = pos.elev;

    // Ease the sun so slider drags and time-lapse glide instead of snapping.
    if (elevE.current === null) elevE.current = pos.elev;
    elevE.current += (pos.elev - elevE.current) * Math.min(1, dt * 3);
    const elev = elevE.current;

    // Weather layers ease over a few seconds.
    const a = Math.min(1, dt * 0.7);
    weatherFx.cloud += (w.look.cloud - weatherFx.cloud) * a;
    weatherFx.rain += (w.look.rain - weatherFx.rain) * a;
    weatherFx.storm += (w.look.storm - weatherFx.storm) * a;
    weatherFx.fog += (w.look.fog - weatherFx.fog) * a;
    weatherFx.haze += (w.look.haze - weatherFx.haze) * a;
    weatherFx.windMs += (w.windMs - weatherFx.windMs) * a;
    const toRad = (w.windFromDeg + 180) * DEG;
    windDir.current.lerp(tmpV2.set(Math.sin(toRad), -Math.cos(toRad)), a).normalize();
    weatherFx.windToX = windDir.current.x;
    weatherFx.windToZ = windDir.current.y;
    const hold = craneHoldReason(w);
    if (hold) weatherFx.holdReason = hold;
    weatherFx.hold += ((hold ? 1 : 0) - weatherFx.hold) * Math.min(1, dt * 0.5);
    if (weatherFx.hold < 0.002 && !hold) weatherFx.hold = 0;
    weatherFx.productivity = productivityFactor(w);
    const { cloud, rain, storm, fog, haze } = weatherFx;

    // Lightning (storm only).
    const flash = storm > 0.05 ? strikeAt(simT()).env * storm : 0;
    weatherFx.flash = flash;

    // Night blend: sun elevation, plus gloom so lamps switch on under storm clouds.
    const nightK = smoothstep(6, -8, elev);
    const gloom = Math.max(storm * 0.55, rain * 0.32, fog * 0.38, cloud * 0.1, haze * 0.15);
    const target = Math.max(nightK, gloom);
    const m = nightFx.mix;
    nightFx.mix = Math.abs(target - m) < 0.003 ? target : m + (target - m) * Math.min(1, dt * 2.2);
    const k = smooth(nightFx.mix);

    // Light direction: real azimuth, elevation clamped to keep shadows readable; moon at night.
    const le = THREE.MathUtils.clamp(elev, 10, 62) * DEG;
    const az = pos.az * DEG;
    sunDir.set(Math.sin(az) * Math.cos(le), Math.sin(le), -Math.cos(az) * Math.cos(le));
    const want = tmpV3.copy(sunDir).lerp(moonDir, nightK).normalize();
    dir.current.lerp(want, Math.min(1, dt * 3)).normalize();

    const dayK = smoothstep(-3, 10, elev);
    const sunI = 2.1 * dayK * (1 - 0.62 * cloud) * (1 - 0.45 * fog) * (1 - 0.3 * haze) * (1 - 0.25 * rain);
    const moonI = 0.5 * nightK * (1 - 0.7 * cloud);
    if (sun.current) {
      sun.current.position.copy(dir.current).multiplyScalar(420);
      sample(SUN_COL, elev, sun.current.color).lerp(HAZE_SUN, haze * 0.45);
      sun.current.color.lerp(MOON_COL, moonI / (sunI + moonI + 1e-4));
      sun.current.intensity = sunI + moonI;
    }
    if (hemi.current) {
      sample(HEMI_SKY, elev, hemi.current.color).lerp(tmpA.copy(WX.storm[0]).lerp(WX.storm[1], nightK), Math.max(rain * 0.4, storm * 0.6));
      sample(HEMI_GROUND, elev, hemi.current.groundColor);
      hemi.current.intensity = THREE.MathUtils.lerp(1.15, 0.62, k) * (1 + cloud * 0.08 - storm * 0.12) + flash * 2.4;
    }

    // Sky + fog colour: base ramp, then each weather layer by day/night.
    sample(SKY_BG, elev, tmpB);
    tmpB.lerp(tmpC.copy(WX.cloud[0]).lerp(WX.cloud[1], nightK), cloud * 0.5);
    tmpB.lerp(tmpC.copy(WX.rain[0]).lerp(WX.rain[1], nightK), rain * 0.78);
    tmpB.lerp(tmpC.copy(WX.storm[0]).lerp(WX.storm[1], nightK), storm * 0.85);
    tmpB.lerp(tmpC.copy(WX.fog[0]).lerp(WX.fog[1], nightK), fog * 0.92);
    tmpB.lerp(tmpC.copy(WX.haze[0]).lerp(WX.haze[1], nightK), haze * 0.75);
    tmpB.lerp(FLASH, flash * 0.5);
    if (scene.background instanceof THREE.Color) scene.background.copy(tmpB);
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(tmpB);
      let near = 520;
      let far = 1250;
      near = THREE.MathUtils.lerp(near, 260, rain);
      far = THREE.MathUtils.lerp(far, 900, rain);
      near = THREE.MathUtils.lerp(near, 150, storm);
      far = THREE.MathUtils.lerp(far, 640, storm);
      near = THREE.MathUtils.lerp(near, 120, haze);
      far = THREE.MathUtils.lerp(far, 760, haze);
      near = THREE.MathUtils.lerp(near, 25, fog);
      far = THREE.MathUtils.lerp(far, 330, fog);
      scene.fog.near = near;
      scene.fog.far = far;
    }
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
        shadow-mapSize={[SHADOW_MAP, SHADOW_MAP]}
        shadow-camera-left={-540}
        shadow-camera-right={540}
        shadow-camera-top={540}
        shadow-camera-bottom={-540}
        shadow-camera-near={20}
        shadow-camera-far={1100}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
    </>
  );
});

const tmpV2 = new THREE.Vector2();
const tmpV3 = new THREE.Vector3();

/* ------------------------------------------------------------------ */
/* Rain                                                                */
/* ------------------------------------------------------------------ */

const RAIN_COUNT = IS_LITE ? 5000 : 12000;
const RAIN_W = 440;
const RAIN_H = 190;

const rainVertex = /* glsl */ `
  attribute vec4 aSeed;
  attribute float aEnd;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uLen;
  uniform float uDensity;
  uniform vec2 uWind;
  uniform vec3 uCenter;
  varying float vAlpha;
  const float W = ${RAIN_W.toFixed(1)};
  const float H = ${RAIN_H.toFixed(1)};
  void main() {
    float fall = uTime * uSpeed;
    float y = mod(aSeed.y * H - fall, H);
    vec2 drift = uWind * uTime;
    float x = mod(aSeed.x * W + drift.x - uCenter.x, W) + uCenter.x - W * 0.5;
    float z = mod(aSeed.z * W + drift.y - uCenter.z, W) + uCenter.z - W * 0.5;
    vec3 vel = normalize(vec3(uWind.x, -uSpeed, uWind.y));
    vec3 p = vec3(x, y, z) - vel * uLen * aEnd;
    float on = step(aSeed.w, uDensity);
    // Fade in from the top of the volume and toward its sides so the box never shows.
    float edge = 1.0 - smoothstep(0.32, 0.5, max(abs(x - uCenter.x), abs(z - uCenter.z)) / W);
    vAlpha = on * edge * smoothstep(H, H * 0.82, y) * (1.0 - aEnd * 0.85);
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;

const rainFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    if (vAlpha < 0.01) discard;
    gl_FragColor = vec4(uColor, vAlpha * uOpacity);
  }
`;

const RAIN_DAY = new THREE.Color("#5F7585");
const RAIN_NIGHT = new THREE.Color("#9FB6D0");

/** Wind-slanted rain streaks in a volume that follows the camera target (all motion from sim time). */
export function Rain() {
  const controlsTarget = useRef<THREE.Vector3>(new THREE.Vector3());
  const { geometry, material } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const seeds = new Float32Array(RAIN_COUNT * 2 * 4);
    const ends = new Float32Array(RAIN_COUNT * 2);
    const pos = new Float32Array(RAIN_COUNT * 2 * 3);
    let s = 1234567;
    const rnd = (): number => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
    for (let i = 0; i < RAIN_COUNT; i++) {
      const sx = rnd();
      const sy = rnd();
      const sz = rnd();
      const sw = rnd();
      for (let e = 0; e < 2; e++) {
        const j = i * 2 + e;
        seeds.set([sx, sy, sz, sw], j * 4);
        ends[j] = e;
      }
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 4));
    g.setAttribute("aEnd", new THREE.BufferAttribute(ends, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: rainVertex,
      fragmentShader: rainFragment,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: 62 },
        uLen: { value: 5 },
        uDensity: { value: 0 },
        uWind: { value: new THREE.Vector2() },
        uCenter: { value: new THREE.Vector3() },
        uColor: { value: RAIN_DAY.clone() },
        uOpacity: { value: 0.4 },
      },
    });
    return { geometry: g, material: mat };
  }, []);
  const lines = useRef<THREE.LineSegments>(null);
  const camera = useThree((st) => st.camera);

  useFrame(() => {
    const r = weatherFx.rain;
    if (lines.current) lines.current.visible = r > 0.01;
    if (r <= 0.01) return;
    const u = material.uniforms;
    u.uTime.value = simT() + 3600;
    u.uDensity.value = Math.min(1, r * (0.75 + weatherFx.storm * 0.25));
    const wind = Math.min(22, weatherFx.windMs) * 1.5;
    (u.uWind.value as THREE.Vector2).set(weatherFx.windToX * wind, weatherFx.windToZ * wind);
    u.uLen.value = 4.5 + weatherFx.storm * 3;
    u.uSpeed.value = 58 + weatherFx.storm * 18;
    // Centre the volume on the ground point the camera looks at.
    camera.getWorldDirection(tmpV3);
    const tHit = tmpV3.y < -0.05 ? -camera.position.y / tmpV3.y : 300;
    controlsTarget.current.copy(camera.position).addScaledVector(tmpV3, Math.min(tHit, 600));
    (u.uCenter.value as THREE.Vector3).set(controlsTarget.current.x, 0, controlsTarget.current.z);
    (u.uColor.value as THREE.Color).copy(RAIN_DAY).lerp(RAIN_NIGHT, nightFx.mix);
    u.uOpacity.value = 0.42 + weatherFx.flash * 0.4;
  });

  return <lineSegments ref={lines} geometry={geometry} material={material} frustumCulled={false} raycast={noRay} renderOrder={4} visible={false} />;
}

/* ------------------------------------------------------------------ */
/* Lightning                                                           */
/* ------------------------------------------------------------------ */

const BOLT_SEGS = 12;
const boltGeo = new THREE.BoxGeometry(1, 1, 1);
const up = new THREE.Vector3(0, 0, 1);

/** A jagged bolt over the Strait (or behind the city) on every strike, rebuilt per strike slot. */
export function Lightning() {
  const group = useRef<THREE.Group>(null);
  const lastSlot = useRef<number>(-1);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#F4F6FF", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }),
    [],
  );
  const segs = useMemo(() => Array.from({ length: BOLT_SEGS }, (_, i) => i), []);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    if (weatherFx.storm < 0.05) {
      g.visible = false;
      return;
    }
    const { slot, env: e } = strikeAt(simT());
    g.visible = e > 0.01;
    material.opacity = e * weatherFx.storm;
    if (slot === lastSlot.current || !g.visible) return;
    lastSlot.current = slot;
    const overSea = hash(slot + 1.1) > 0.3;
    const x0 = -620 + hash(slot + 2.2) * 1240;
    const z0 = overSea ? 330 + hash(slot + 3.3) * 380 : -380 - hash(slot + 3.3) * 300;
    let px = x0;
    let py = 300;
    let pz = z0;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    g.children.forEach((child, i) => {
      const ny = 300 - ((i + 1) / BOLT_SEGS) * 300;
      const nx = px + (hash(slot * 13 + i) - 0.5) * 46;
      const nz = pz + (hash(slot * 17 + i) - 0.5) * 30;
      a.set(px, py, pz);
      b.set(nx, ny, nz);
      const mesh = child as THREE.Mesh;
      mesh.position.copy(a).add(b).multiplyScalar(0.5);
      const len = a.distanceTo(b);
      mesh.quaternion.setFromUnitVectors(up, b.sub(a).normalize());
      const w = 2.6 - (i / BOLT_SEGS) * 1.2;
      mesh.scale.set(w, w, len + 1);
      px = nx;
      py = ny;
      pz = nz;
    });
  });

  return (
    <group ref={group} visible={false}>
      {segs.map((i) => (
        <mesh key={i} geometry={boltGeo} material={material} raycast={noRay} renderOrder={5} />
      ))}
    </group>
  );
}
