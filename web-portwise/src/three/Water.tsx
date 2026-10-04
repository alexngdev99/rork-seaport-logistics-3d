import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { QUAY_Z, WATER_Y } from "@/data/layout";
import { simT } from "@/sim/simStore";
import { nightFx } from "@/state/nightMode";

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
  varying vec2 vWorld;
  #include <fog_pars_fragment>
  void main() {
    float d = vWorld.y - uShore;
    vec3 col = mix(uShallow, uDeep, smoothstep(4.0, 160.0, d));
    // soft swell bands
    float swell = sin(vWorld.x * 0.05 + vWorld.y * 0.09 + uTime * 0.35) * 0.5 + 0.5;
    col = mix(col, uDeep, swell * 0.08);
    // chart-like ripple strokes
    float w = sin(vWorld.x * 0.21 + uTime * 0.55 + sin(vWorld.y * 0.13 + uTime * 0.25) * 2.4)
            * sin(vWorld.y * 0.42 - uTime * 0.45 + vWorld.x * 0.03);
    float line = smoothstep(0.93, 0.985, w);
    col = mix(col, uLine, line * 0.6);
    // foam along the quay wall
    float foam = 1.0 - smoothstep(0.0, 1.6, d);
    foam *= 0.6 + 0.4 * sin(vWorld.x * 0.8 + uTime * 1.6);
    col = mix(col, uLine, clamp(foam, 0.0, 1.0) * 0.7);
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
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, WATER_Y, QUAY_Z + 350]} material={material}>
      <planeGeometry args={[2400, 700, 1, 1]} />
    </mesh>
  );
}
