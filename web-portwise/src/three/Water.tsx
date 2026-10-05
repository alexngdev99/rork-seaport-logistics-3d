import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { QUAY_Z, WATER_Y } from "@/data/layout";
import { simT } from "@/sim/simStore";
import { nightFx } from "@/state/nightMode";
import { weatherFx } from "@/sim/weatherFx";

const STORM_SEA = [new THREE.Color("#8FA6A8"), new THREE.Color("#0B1826")] as const;
const HAZE_SEA = [new THREE.Color("#C9C7A6"), new THREE.Color("#1D2230")] as const;
const tmp = new THREE.Color();

const PAL = {
  shallow: [new THREE.Color("#BFDCD6"), new THREE.Color("#16304A")],
  deep: [new THREE.Color("#93C3BD"), new THREE.Color("#0C1E33")],
  line: [new THREE.Color("#EEF8F5"), new THREE.Color("#3F6E8E")],
} as const;

const vertex = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec2 vWorld;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xz;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uShallow;
  uniform vec3 uDeep;
  uniform vec3 uLine;
  uniform float uShore;
  uniform float uRain;
  uniform float uChop;
  uniform vec2 uWind;
  uniform float uFlash;
  varying vec2 vWorld;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  #include <fog_pars_fragment>
  void main() {
    float d = vWorld.y - uShore;
    vec3 col = mix(uShallow, uDeep, smoothstep(4.0, 160.0, d));
    // soft swell bands
    float swell = sin(vWorld.x * 0.05 + vWorld.y * 0.09 + uTime * 0.35) * 0.5 + 0.5;
    col = mix(col, uDeep, swell * (0.08 + uChop * 0.1));
    // Wind chop: short whitecap streaks running downwind.
    vec2 wv = vWorld - uWind * uTime * 2.2;
    float chop = sin(dot(wv, normalize(uWind + vec2(0.0001))) * 0.9 + sin(wv.x * 0.31 + wv.y * 0.17) * 2.0)
               * sin(dot(wv, vec2(-uWind.y, uWind.x)) * 0.23);
    col = mix(col, uLine, smoothstep(0.82, 0.97, chop) * uChop * 0.55);
    // chart-like ripple strokes
    float w = sin(vWorld.x * 0.21 + uTime * 0.55 + sin(vWorld.y * 0.13 + uTime * 0.25) * 2.4)
            * sin(vWorld.y * 0.42 - uTime * 0.45 + vWorld.x * 0.03);
    float line = smoothstep(0.93, 0.985, w);
    col = mix(col, uLine, line * 0.6);
    // foam along the quay wall
    float foam = 1.0 - smoothstep(0.0, 1.6, d);
    foam *= 0.6 + 0.4 * sin(vWorld.x * 0.8 + uTime * 1.6);
    col = mix(col, uLine, clamp(foam, 0.0, 1.0) * (0.7 + uChop * 0.3));
    // Raindrop rings: expanding circles in a 2.4 m grid, each cell on its own phase.
    if (uRain > 0.01) {
      vec2 cell = floor(vWorld / 2.4);
      vec2 f = fract(vWorld / 2.4) - 0.5;
      float ph = hash(cell);
      float age = fract(uTime * 1.3 + ph);
      vec2 off = vec2(hash(cell + 7.1), hash(cell + 3.7)) - 0.5;
      float r = length(f - off * 0.5);
      float ring = smoothstep(0.05, 0.0, abs(r - age * 0.48)) * (1.0 - age);
      col = mix(col, uLine, ring * step(1.0 - uRain, ph) * 0.75);
    }
    col += vec3(uFlash * 0.35);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export function Water() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        fog: true,
        uniforms: THREE.UniformsUtils.merge([
          THREE.UniformsLib.fog,
          {
            uTime: { value: 0 },
            uShallow: { value: new THREE.Color("#BFDCD6") },
            uDeep: { value: new THREE.Color("#93C3BD") },
            uLine: { value: new THREE.Color("#EEF8F5") },
            uShore: { value: QUAY_Z },
            uRain: { value: 0 },
            uChop: { value: 0 },
            uWind: { value: new THREE.Vector2(0.6, -0.8) },
            uFlash: { value: 0 },
          },
        ]),
      }),
    [],
  );

  useFrame(() => {
    const u = material.uniforms;
    u.uTime.value = simT() + 3600;
    const k = nightFx.mix * nightFx.mix * (3 - 2 * nightFx.mix);
    (u.uShallow.value as THREE.Color).copy(PAL.shallow[0]).lerp(PAL.shallow[1], k);
    (u.uDeep.value as THREE.Color).copy(PAL.deep[0]).lerp(PAL.deep[1], k);
    (u.uLine.value as THREE.Color).copy(PAL.line[0]).lerp(PAL.line[1], k);
    // Grey, choppy sea in storms; olive-grey under haze.
    const grey = Math.max(weatherFx.storm * 0.55, weatherFx.rain * 0.3);
    tmp.copy(STORM_SEA[0]).lerp(STORM_SEA[1], k);
    (u.uShallow.value as THREE.Color).lerp(tmp, grey);
    (u.uDeep.value as THREE.Color).lerp(tmp, grey * 0.8);
    tmp.copy(HAZE_SEA[0]).lerp(HAZE_SEA[1], k);
    (u.uShallow.value as THREE.Color).lerp(tmp, weatherFx.haze * 0.35);
    u.uRain.value = weatherFx.rain;
    u.uChop.value = Math.min(1, Math.max(0, (weatherFx.windMs - 4) / 12) + weatherFx.storm * 0.4);
    (u.uWind.value as THREE.Vector2).set(weatherFx.windToX, weatherFx.windToZ);
    u.uFlash.value = weatherFx.flash;
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, WATER_Y, QUAY_Z + 350]} material={material}>
      <planeGeometry args={[2400, 700, 1, 1]} />
    </mesh>
  );
}
