import { memo, useMemo } from "react";
import type { ReactNode } from "react";
import { Text } from "@react-three/drei";
import { COLORS, CONTAINER_COLORS } from "@/data/layout";
import { mulberry32 } from "@/data/containers";
import { AVE_X, CROSS_X, facilityById } from "@/data/facilities";
import type { ChipTone } from "../Chip3D";
import { Chip3D } from "../Chip3D";
import { Part, Selectable, mat, unitBox, unitCyl } from "../parts";
import { Glow, LIGHT, litMat } from "../nightLights";
import { FONT_URL, Fence, Flat, GroundLabel, InstMesh, Lot, Mast, Office, Shed, coneGeo, truckParts } from "./kit";
import type { Inst } from "./kit";
import { usePort } from "@/state/PortProvider";
import { RailIcd } from "./RailIcd";
import { SCAN } from "@/sim/logistics";

const KIND_TONE: Record<string, ChipTone> = {
  rail: "harbor",
  cfs: "signal",
  bonded: "ink",
  cold: "harbor",
  customs: "amber",
  staging: "amber",
  service: "moss",
  dc: "signal",
  mnr: "moss",
  factory: "ink",
  fuel: "brick",
};

/** Makes a facility hoverable/clickable and pins its name chip (always on the Logistics page). */
function FacilityShell({ id, children }: { id: string; children: ReactNode }) {
  const f = facilityById(id);
  const { selection, hovered, view, open } = usePort();
  if (!f) return null;
  const selected = selection?.kind === "facility" && selection.id === id;
  const hot = hovered?.kind === "facility" && hovered.id === id;
  const show = selected || hot || view === "logistics";
  return (
    <group>
      <Selectable sel={{ kind: "facility", id }}>{children}</Selectable>
      {show ? (
        <Chip3D position={[f.x, f.h + 3, f.z]} tone={KIND_TONE[f.kind] ?? "ink"} active={selected} onClick={() => open({ kind: "facility", id })}>
          {f.short}
        </Chip3D>
      ) : null}
    </group>
  );
}

const PAL = Object.values(CONTAINER_COLORS);

const Cfs = memo(function Cfs() {
  return (
    <group>
      <Lot x={-58} z={-137.5} w={56} d={37} />
      <Shed x={-58} z={-142.5} w={50} d={22} h={9} kind="gable" doors={10} canopy roof="#B9C6CC" band={COLORS.signal} label="SEASTAR CFS" />
      <Office x={-80} z={-125} w={7} d={6} h={6.4} stripe={COLORS.signal} />
      <GroundLabel x={-85} z={-120.6} text="CFS · LCL" size={1.6} />
    </group>
  );
});

const Bonded = memo(function Bonded() {
  return (
    <group>
      <Lot x={4} z={-137.5} w={50} d={37} />
      <Fence x={4} z={-137.5} w={49} d={36} open h={1.6} color="#8F8878" />
      <Shed x={4} z={-143} w={44} d={22} h={10} kind="flat" roof="#AFBDC4" doors={8} canopy band="#2C6FB0" label="FTZ WAREHOUSE" />
      <mesh geometry={unitBox} material={mat(COLORS.ink)} position={[-16, 1.2, -120.2]} scale={[3, 2.4, 2.4]} castShadow />
      <mesh geometry={unitBox} material={mat(COLORS.amber)} position={[-12, 1, -119.4]} scale={[6, 0.16, 0.16]} />
    </group>
  );
});

const ColdHub = memo(function ColdHub() {
  const reefers = useMemo(() => {
    const out: Inst[] = [];
    for (let i = 0; i < 6; i++) out.push({ p: [44 + i * 1.6, 0.65, -150], s: [1.3, 1.25, 3.0], c: CONTAINER_COLORS.reefer });
    return out;
  }, []);
  return (
    <group>
      <Lot x={60} z={-137.5} w={40} d={37} />
      <Shed x={60} z={-143} w={36} d={22} h={12} kind="flat" wall="#F6F8F8" roof="#D5DDE0" doors={6} canopy band="#2C6FB0" units={4} label="COLD CHAIN HUB" labelColor="#2C6FB0" />
      <InstMesh items={reefers} />
      <mesh geometry={unitBox} material={mat("#8C8578")} position={[52, 2.2, -152]} scale={[12, 0.3, 0.5]} />
      <Glow position={[73, 6, -131]} color="#8CC4FF" size={2.6} />
    </group>
  );
});

const L = SCAN.laneZ;

const Customs = memo(function Customs() {
  const parked = useMemo(() => {
    const out: Inst[] = [];
    const r = mulberry32(31);
    for (let i = 0; i < 7; i++) truckParts(out, 188 + i * 7, -147, -Math.PI / 2, i % 2 ? "#F6F3EC" : "#2C6FB0", PAL[Math.floor(r() * PAL.length)]);
    return out;
  }, []);
  return (
    <group>
      <Lot x={192} z={-137.5} w={110} d={37} />
      <Fence x={192} z={-137.5} w={109} d={36} open h={1.4} />
      <Flat x={192} z={L} w={100} d={6} color="#CFC8B9" y={0.022} />
      {[-5, 5].map((dz) => (
        <mesh key={dz} geometry={unitBox} material={mat("#CFC8BA")} position={[173, 1.6, L + dz]} scale={[12, 3.2, 1.6]} castShadow receiveShadow />
      ))}
      {[-3.4, 3.4].map((dz) => (
        <Part key={dz} position={[173, 3.4, L + dz]} scale={[1.2, 6.8, 1]} color="#F6F3EC" />
      ))}
      <Part position={[173, 7.2, L]} scale={[2.6, 1.2, 8]} color={COLORS.signal} />
      <mesh geometry={unitBox} material={mat(COLORS.ink)} position={[174.4, 7.2, L]} scale={[0.1, 0.5, 6]} />
      <Text font={FONT_URL} fontSize={0.7} color="#FFFFFF" position={[174.42, 7.2, L]} rotation={[0, Math.PI / 2, 0]} anchorX="center" anchorY="middle">
        X-RAY SCANNER
      </Text>
      <Glow position={[173, 8.1, L]} color={LIGHT.red} size={1.6} blink={1.4} />
      {[-5, 5].map((dx) =>
        [-3.6, 3.6].map((dz) => <Part key={`${dx}${dz}`} position={[208 + dx * 2, 3, L + dz]} scale={[0.4, 6, 0.4]} color="#C9C2B3" />),
      )}
      <Part position={[208, 6.2, L]} scale={[24, 0.4, 9]} color="#F6F3EC" />
      <mesh geometry={unitBox} material={litMat(COLORS.amber, LIGHT.sodium, 0.9)} position={[208, 5.9, L]} scale={[24.1, 0.25, 9.1]} />
      <Glow position={[208, 5.4, L]} color={LIGHT.white} size={3} />
      <Office x={150} z={-147} w={18} d={10} h={9.6} band={COLORS.ink} stripe={COLORS.amber} />
      <Text font={FONT_URL} fontSize={1.2} color={COLORS.ink} position={[150, 10.6, -141.9]} anchorX="center">
        ICA CHECKPOINT
      </Text>
      <InstMesh items={parked} />
      <GroundLabel x={140} z={-120.4} text="ICA SCAN LANE" size={1.4} color="#B8441A" />
      <Mast x={240} z={-135} h={14} />
    </group>
  );
});

const Staging = memo(function Staging() {
  const { trucks, stalls } = useMemo(() => {
    const r = mulberry32(88);
    const trucks: Inst[] = [];
    const stalls: Inst[] = [];
    const cabs = ["#F6F3EC", "#2C6FB0", "#1E3A66", "#4E7A5A", "#F2622E", "#B5463A"];
    for (const [z, face] of [
      [-126.5, -1],
      [-137.5, 1],
      [-143.5, -1],
      [-152, 1],
    ] as Array<[number, number]>) {
      for (let x = 336; x < 426; x += 3.1) {
        stalls.push({ p: [x - 1.55, 0.025, z], s: [0.14, 0.02, 5.4], c: "#F3EFE6" });
        if (r() < 0.78) truckParts(trucks, x, z + face * 0.4, face > 0 ? -Math.PI / 2 : Math.PI / 2, cabs[Math.floor(r() * cabs.length)], r() < 0.7 ? PAL[Math.floor(r() * PAL.length)] : null);
      }
    }
    return { trucks, stalls };
  }, []);
  return (
    <group>
      <Lot x={380} z={-137.5} w={98} d={37} color="#DCD5C6" />
      <InstMesh items={stalls} shadow={false} />
      <InstMesh items={trucks} />
      <Office x={334} z={-121} w={5} d={4} h={3.4} stripe={COLORS.amber} />
      <mesh geometry={unitBox} material={mat(COLORS.amber)} position={[328, 1, -124]} scale={[0.16, 0.16, 5]} />
      <GroundLabel x={340} z={-120.4} text="TRUCK STAGING · BOOKED SLOTS ONLY" size={1.5} />
      <Mast x={360} z={-140} h={14} />
      <Mast x={410} z={-140} h={14} />
    </group>
  );
});

const TruckStop = memo(function TruckStop() {
  const trucks = useMemo(() => {
    const out: Inst[] = [];
    truckParts(out, 356, -82, Math.PI, "#F6F3EC", CONTAINER_COLORS.navy);
    truckParts(out, 368, -86, Math.PI, "#2C6FB0", null);
    return out;
  }, []);
  return (
    <group>
      <Flat x={366} z={-84} w={40} d={18} color="#DCD5C6" y={0.012} />
      <Flat x={336} z={-84} w={20} d={6} color={COLORS.road} y={0.02} />
      {[-9, 0, 9].map((dx) => [-3, 3].map((dz) => <Part key={`${dx}${dz}`} position={[362 + dx, 2.6, -84 + dz]} scale={[0.35, 5.2, 0.35]} color="#F6F3EC" />))}
      <Part position={[362, 5.5, -84]} scale={[24, 0.6, 10]} color="#F6F3EC" />
      <mesh geometry={unitBox} material={litMat("#1F5FA8", "#3B7FD0", 0.8)} position={[362, 5.5, -84]} scale={[24.1, 0.4, 10.1]} />
      {[-6, 0, 6].map((dx) => (
        <Part key={dx} position={[362 + dx, 0.8, -84]} scale={[0.8, 1.6, 0.6]} color={COLORS.signal} />
      ))}
      <Glow position={[362, 5, -84]} color={LIGHT.white} size={4} />
      <Office x={381} z={-84} w={8} d={10} h={4.2} stripe="#1F5FA8" />
      <mesh geometry={unitCyl} material={mat("#8C8578")} position={[349, 4, -76]} scale={[0.3, 8, 0.3]} />
      <mesh geometry={unitBox} material={litMat("#1F5FA8", "#3B7FD0", 0.8)} position={[349, 8.6, -76]} scale={[3.4, 1.6, 0.3]} castShadow />
      <Text font={FONT_URL} fontSize={0.6} color="#FFFFFF" position={[349, 8.6, -75.8]} anchorX="center" anchorY="middle">
        DIESEL · LNG
      </Text>
      <InstMesh items={trucks} />
    </group>
  );
});

const SeastarDc = memo(function SeastarDc() {
  const { panels, trailers } = useMemo(() => {
    const panels: Inst[] = [];
    for (let x = 160; x <= 280; x += 4.6) for (let z = -222; z <= -193; z += 3.4) panels.push({ p: [x, 14.75, z], s: [4.2, 0.12, 2.6], c: "#20406B", r: [-0.22, 0, 0] });
    const trailers: Inst[] = [];
    const r = mulberry32(12);
    for (let i = 0; i < 24; i++) {
      if (r() < 0.35 || Math.abs(162 + i * 5.2 - 236) < 6) continue;
      truckParts(trailers, 162 + i * 5.2, -184.6, -Math.PI / 2, r() > 0.5 ? COLORS.signal : "#F6F3EC", r() > 0.4 ? CONTAINER_COLORS.orange : CONTAINER_COLORS.navy);
    }
    return { panels, trailers };
  }, []);
  return (
    <group>
      <Lot x={220} z={-196.5} w={140} d={66} />
      <Shed x={220} z={-207} w={130} d={40} h={14} kind="flat" wall="#F2EEE6" roof="#C9D2D6" doors={24} canopy band={COLORS.signal} label="SEASTAR LOGISTICS · DISTRIBUTION CENTER" labelColor={COLORS.ink} />
      <InstMesh items={panels} shadow={false} rough={0.3} metal={0.4} />
      <InstMesh items={trailers} />
      <Office x={150} z={-176} w={10} d={8} h={9.6} band={COLORS.ink} stripe={COLORS.signal} />
      <Mast x={200} z={-172} h={14} />
      <Mast x={260} z={-172} h={14} />
    </group>
  );
});

const Mnr = memo(function Mnr() {
  const stacks = useMemo(() => {
    const r = mulberry32(606);
    const out: Inst[] = [];
    for (let x = 344; x < 398; x += 3.3) {
      for (let row = 0; row < 22; row++) {
        const z = -186 - row * 1.45 - (row >= 11 ? 2 : 0);
        const h = 1 + Math.floor(r() * 5.5);
        for (let t = 0; t < h; t++) out.push({ p: [x, 0.65 + t * 1.3, z], s: [3.0, 1.25, 1.3], c: PAL[Math.floor(r() * PAL.length)] });
      }
    }
    return out;
  }, []);
  return (
    <group>
      <Lot x={385} z={-196.5} w={90} d={66} color="#DCD5C6" />
      <InstMesh items={stacks} />
      <Shed x={416} z={-212} w={22} d={28} h={9} kind="gable" doors={3} band={COLORS.moss} />
      <Part position={[416, 4, -190]} scale={[18, 0.4, 8]} color="#F6F3EC" />
      {[-8, 8].map((dx) => [-3.5, 3.5].map((dz) => <Part key={`${dx}${dz}`} position={[416 + dx, 2, -190 + dz]} scale={[0.35, 4, 0.35]} color="#C9C2B3" />))}
      <Flat x={416} z={-190} w={16} d={7} color="#A9C7D6" y={0.03} />
      <GroundLabel x={402} z={-180.5} text="WASH · PTI" size={1.3} />
      <Text font={FONT_URL} fontSize={1.6} color={COLORS.ink} position={[416, 7.6, -197.9]} anchorX="center">
        M&R DEPOT
      </Text>
      <Mast x={372} z={-205} h={16} />
    </group>
  );
});

function SawFactory({ x, w, label, office, band }: { x: number; w: number; label: string; office: number; band: string }) {
  return (
    <group>
      <Lot x={x} z={-196.5} w={w} d={66} color="#E3DCCD" />
      <Shed x={x} z={-210} w={w - 8} d={36} h={9} kind="saw" roof="#B9C6CC" doors={Math.round(w / 9)} band={band} label={label} />
      <Office x={office} z={-181} w={14} d={8} h={9.6} band={COLORS.ink} stripe={band} />
      <Flat x={x} z={-170} w={w - 6} d={6} color="#D8D2C5" y={0.015} />
    </group>
  );
}

const Electronics = memo(function Electronics() {
  return <SawFactory x={20} w={64} label="MERLION MICRO" office={2} band="#2C6FB0" />;
});

const Garments = memo(function Garments() {
  return <SawFactory x={-62} w={56} label="STRAITS PHARMA" office={-78} band={COLORS.moss} />;
});

const Seafood = memo(function Seafood() {
  const reefers = useMemo(() => {
    const out: Inst[] = [];
    for (let i = 0; i < 7; i++) out.push({ p: [-160 + i * 1.6, 0.65, -176], s: [1.3, 1.25, 3.0], c: CONTAINER_COLORS.reefer });
    return out;
  }, []);
  return (
    <group>
      <Lot x={-140} z={-196.5} w={54} d={66} color="#E3DCCD" />
      <Shed x={-140} z={-208} w={46} d={34} h={10} kind="flat" wall="#F4F6F6" roof="#D5DDE0" doors={5} canopy band="#2C6FB0" units={5} label="LION CITY FOODS" labelColor="#2C6FB0" />
      {[-121, -114].map((x) => (
        <group key={x}>
          <Part position={[x, 4, -178]} scale={[5, 8, 5]} color="#E6E1D6" cylinder />
          <mesh geometry={unitCyl} material={mat("#3A4250")} position={[x, 8.05, -178]} scale={[3.4, 0.1, 3.4]} />
        </group>
      ))}
      <InstMesh items={reefers} />
    </group>
  );
});

const Steel = memo(function Steel() {
  const coils = useMemo(() => {
    const out: Inst[] = [];
    for (let i = 0; i < 9; i++) for (let j = 0; j < 3; j++) out.push({ p: [-262 + i * 3, 1.0, -176 - j * 2.6], s: [2, 1.2, 2], c: j === 1 ? "#7E8792" : "#8F98A3", r: [Math.PI / 2, 0, 0] });
    return out;
  }, []);
  return (
    <group>
      <Lot x={-228} z={-196.5} w={82} d={66} color="#DCD5C6" />
      <Shed x={-226} z={-212} w={72} d={32} h={17} kind="gable" wall="#E2DED5" roof="#8FA1AA" doors={4} band="#4F6D8F" label="JURONG STEEL WORKS" />
      {[-256, -246].map((x) => (
        <group key={x}>
          <Part position={[x, 16, -190]} scale={[3, 32, 3]} color="#D9D3C6" cylinder />
          {[24, 28].map((y) => (
            <mesh key={y} geometry={unitCyl} material={mat(COLORS.brick)} position={[x, y, -190]} scale={[3.1, 1.2, 3.1]} />
          ))}
          <Glow position={[x, 32.6, -190]} color={LIGHT.red} size={2} blink={1.8} phase={x} />
        </group>
      ))}
      <InstMesh items={coils} cyl />
      <mesh geometry={unitBox} material={litMat("#3A2A22", "#FF8A3D", 1.6)} position={[-200, 3, -195.9]} scale={[8, 6, 0.1]} />
    </group>
  );
});

const Grain = memo(function Grain() {
  const silos: Array<[number, number]> = [];
  for (const z of [-202, -212]) for (const x of [-329, -320, -311, -302]) silos.push([x, z]);
  return (
    <group>
      <Lot x={-312} z={-196.5} w={50} d={66} color="#E3DCCD" />
      {silos.map(([x, z]) => (
        <group key={`${x}${z}`}>
          <Part position={[x, 11, z]} scale={[8.4, 22, 8.4]} color="#ECE7DD" cylinder />
          <mesh geometry={coneGeo} material={mat("#B9C6CC")} position={[x, 23.5, z]} scale={[8.8, 3, 8.8]} castShadow />
        </group>
      ))}
      <Part position={[-292, 15, -196]} scale={[5, 30, 5]} color="#D9D3C6" />
      <Part position={[-292, 30.6, -196]} scale={[6, 1.4, 6]} color={COLORS.amber} />
      <Part position={[-310, 26.5, -207]} scale={[34, 1, 1.6]} color="#C9C2B3" />
      <Part position={[-296, 28, -201]} scale={[1.4, 1, 10]} color="#C9C2B3" />
      <Glow position={[-292, 31.8, -196]} color={LIGHT.red} size={1.8} blink={2.4} />
      <Office x={-326} z={-178} w={12} d={7} h={6.4} stripe={COLORS.amber} />
      <Text font={FONT_URL} fontSize={1.5} color={COLORS.ink} position={[-292, 22, -193.4]} anchorX="center">
        STRAITS FLOUR
      </Text>
    </group>
  );
});

const FuelTerminal = memo(function FuelTerminal() {
  const tanks: Array<[number, number, number, number]> = [];
  for (const x of [-342, -318, -294]) for (const z of [-60, -38, -16]) tanks.push([x, z, 8.6, 10 + ((x + z) % 3 === 0 ? 3 : 0)]);
  tanks.push([-272, -38, 5.5, 8], [-272, -18, 5.5, 8]);
  return (
    <group>
      <Lot x={-310} z={-40} w={100} d={70} color="#DED7C8" />
      <Flat x={-309} z={-78} w={88} d={6} color={COLORS.road} y={0.02} />
      <Fence x={-318} z={-38} w={74} d={66} h={1.1} t={0.6} color="#CFC8BA" />
      {tanks.map(([x, z, r, h]) => (
        <group key={`${x}${z}`}>
          <Part position={[x, h / 2, z]} scale={[r * 2, h, r * 2]} color="#F1EEE6" cylinder />
          <mesh geometry={unitCyl} material={mat("#C8423B")} position={[x, h * 0.72, z]} scale={[r * 2 + 0.06, 0.7, r * 2 + 0.06]} />
          <mesh geometry={unitCyl} material={mat("#D5D0C5")} position={[x, h + 0.15, z]} scale={[r * 2 - 0.4, 0.3, r * 2 - 0.4]} />
        </group>
      ))}
      <Part position={[-270, 2.4, 2]} scale={[1.2, 0.6, 36]} color="#8C8578" />
      {[-12, -2, 8, 16].map((z) => (
        <Part key={z} position={[-270, 1.2, z]} scale={[0.3, 2.4, 0.3]} color="#8C8578" />
      ))}
      <Part position={[-300, 0.3, 28]} scale={[3, 0.6, 16]} color="#CFC8BA" />
      <Part position={[-300, 0.4, 37]} scale={[16, 0.8, 5]} color="#CFC8BA" />
      <Part position={[-286, 0.3, 20.4]} scale={[28, 0.6, 2]} color="#8C8578" />
      {[-305, -295].map((x) => (
        <Part key={x} position={[x, 3, 38]} scale={[0.5, 5, 0.5]} color={COLORS.amber} />
      ))}
      <group position={[-300, 0, 45]}>
        <Part position={[0, -0.4, 0]} scale={[52, 3.2, 8.6]} color="#8E2F2A" />
        <Part position={[0, 1.3, 0]} scale={[51, 0.3, 8.2]} color="#B7B0A2" />
        <Part position={[-21, 4.2, 0]} scale={[7, 5.6, 7.6]} color="#F6F3EC" />
        <mesh geometry={unitBox} material={litMat("#1B2A44", LIGHT.window, 1)} position={[-21, 5.6, 0]} scale={[7.05, 0.7, 7.65]} />
        <Part position={[-23.5, 8, 0]} scale={[1.6, 3, 1.6]} color={COLORS.ink} />
        <Part position={[4, 2, 0]} scale={[30, 1.2, 1.2]} color="#C8423B" />
        <Glow position={[25.5, 3, 0]} color={LIGHT.white} size={1.6} />
        <Glow position={[-21, 11, 0]} color={LIGHT.white} size={1.6} />
        <Text font={FONT_URL} fontSize={1.3} color="#F6F3EC" position={[6, 0.4, -4.35]} rotation={[0, Math.PI, 0]} anchorX="center">
          STRAITS SPIRIT
        </Text>
      </group>
      <Part position={[-272, 5, -66]} scale={[14, 0.5, 8]} color="#F6F3EC" />
      {[-6, 6].map((dx) => [-3.5, 3.5].map((dz) => <Part key={`${dx}${dz}`} position={[-272 + dx, 2.5, -66 + dz]} scale={[0.35, 5, 0.35]} color="#C9C2B3" />))}
      {[-275, -269].map((x) => (
        <group key={x} position={[x, 0, -66]}>
          <mesh geometry={unitBox} material={mat("#F6F3EC")} position={[0, 1.05, 2.4]} scale={[1.35, 1.7, 1.5]} castShadow />
          <mesh geometry={unitCyl} material={mat("#E9EEF0")} position={[0, 1.4, -0.6]} rotation={[Math.PI / 2, 0, 0]} scale={[1.4, 4.2, 1.4]} castShadow />
        </group>
      ))}
      <Glow position={[-272, 4.6, -66]} color={LIGHT.white} size={3.6} />
      <Text font={FONT_URL} fontSize={2} color="#9E9583" position={[-358, 0.06, -6]} rotation={[-Math.PI / 2, 0, 0]} anchorX="left">
        PASIR PANJANG BUNKER TERMINAL
      </Text>
    </group>
  );
});

/** Every logistics facility in the district behind the terminal. */
export const Facilities = memo(function Facilities() {
  return (
    <group>
      <FacilityShell id="rail-icd">
        <RailIcd />
      </FacilityShell>
      <FacilityShell id="cfs">
        <Cfs />
      </FacilityShell>
      <FacilityShell id="bonded">
        <Bonded />
      </FacilityShell>
      <FacilityShell id="cold-hub">
        <ColdHub />
      </FacilityShell>
      <FacilityShell id="customs">
        <Customs />
      </FacilityShell>
      <FacilityShell id="staging">
        <Staging />
      </FacilityShell>
      <FacilityShell id="truck-stop">
        <TruckStop />
      </FacilityShell>
      <FacilityShell id="seastar-dc">
        <SeastarDc />
      </FacilityShell>
      <FacilityShell id="mnr">
        <Mnr />
      </FacilityShell>
      <FacilityShell id="electronics">
        <Electronics />
      </FacilityShell>
      <FacilityShell id="garments">
        <Garments />
      </FacilityShell>
      <FacilityShell id="seafood">
        <Seafood />
      </FacilityShell>
      <FacilityShell id="steel">
        <Steel />
      </FacilityShell>
      <FacilityShell id="grain">
        <Grain />
      </FacilityShell>
      <FacilityShell id="fuel">
        <FuelTerminal />
      </FacilityShell>
      <GroundLabel x={AVE_X + 8} z={-30} text="PSA AVENUE" size={1.6} />
      <GroundLabel x={CROSS_X[1] - 2} z={-170} text="JURONG INDUSTRIAL ESTATE" size={2.4} color="#8C836F" />
    </group>
  );
});
