import { memo, useMemo } from "react";
import { Text } from "@react-three/drei";
import { COLORS } from "@/data/layout";
import { mulberry32 } from "@/data/containers";
import {
  AVE_MIN_Z,
  AVE_X,
  CROSS_X,
  FRONTAGE_MAX_X,
  FRONTAGE_MIN_X,
  FRONTAGE_Z,
  HWY_DECK_Y,
  HWY_MAX_X,
  HWY_MIN_X,
  HWY_Z,
  RING_Z,
} from "@/data/facilities";
import { mat, unitBox } from "../parts";
import { Glow, LIGHT, litMat } from "../nightLights";
import { FONT_URL, Flat, InstMesh, crownGeo } from "./kit";
import type { Inst } from "./kit";

const DECK_W = 14.4;
const DECK_T = 1.1;
const ROAD = COLORS.road;

/** Elevated four-lane AYE viaduct on T-piers (traffic keeps left), with barriers, lane paint, lamps and green overhead signs. */
const Expressway = memo(function Expressway() {
  const { piers, paint, lampPoles, lampHeads, lampXs } = useMemo(() => {
    const piers: Inst[] = [];
    for (let x = HWY_MIN_X + 20; x < HWY_MAX_X; x += 30) {
      piers.push({ p: [x, (HWY_DECK_Y - DECK_T) / 2, HWY_Z], s: [1.8, HWY_DECK_Y - DECK_T, 1.8], c: "#CFC8BA" });
      piers.push({ p: [x, HWY_DECK_Y - DECK_T - 0.5, HWY_Z], s: [2.2, 1, DECK_W - 1], c: "#C6BFB0" });
    }
    const paint: Inst[] = [];
    for (let x = HWY_MIN_X; x < HWY_MAX_X; x += 7) {
      paint.push({ p: [x, HWY_DECK_Y + 0.02, HWY_Z + 4], s: [3, 0.02, 0.2], c: "#F8F5EE" });
      paint.push({ p: [x, HWY_DECK_Y + 0.02, HWY_Z - 4], s: [3, 0.02, 0.2], c: "#F8F5EE" });
    }
    const lampPoles: Inst[] = [];
    const lampHeads: Inst[] = [];
    const lampXs: number[] = [];
    for (let x = -600; x <= 640; x += 40) {
      lampPoles.push({ p: [x, HWY_DECK_Y + 4, HWY_Z], s: [0.22, 8, 0.22], c: "#8C8578" });
      lampHeads.push({ p: [x, HWY_DECK_Y + 8, HWY_Z], s: [0.5, 0.25, 5], c: "#F6F3EC" });
      if (x >= -380 && x <= 460) lampXs.push(x);
    }
    return { piers, paint, lampPoles, lampHeads, lampXs };
  }, []);

  return (
    <group>
      <mesh geometry={unitBox} material={mat("#D3CCBE")} position={[0, HWY_DECK_Y - DECK_T / 2, HWY_Z]} scale={[HWY_MAX_X - HWY_MIN_X, DECK_T, DECK_W]} castShadow receiveShadow />
      <mesh geometry={unitBox} material={mat("#B9B2A4")} position={[0, HWY_DECK_Y + 0.005, HWY_Z]} scale={[HWY_MAX_X - HWY_MIN_X, 0.01, DECK_W - 0.6]} receiveShadow />
      {[HWY_Z + DECK_W / 2 - 0.2, HWY_Z - DECK_W / 2 + 0.2].map((z) => (
        <mesh key={z} geometry={unitBox} material={mat("#ECE7DC")} position={[0, HWY_DECK_Y + 0.5, z]} scale={[HWY_MAX_X - HWY_MIN_X, 1, 0.4]} castShadow />
      ))}
      <mesh geometry={unitBox} material={mat("#E3DDD0")} position={[0, HWY_DECK_Y + 0.4, HWY_Z]} scale={[HWY_MAX_X - HWY_MIN_X, 0.8, 0.5]} />
      {[HWY_Z + 6.4, HWY_Z + 1.4, HWY_Z - 1.4, HWY_Z - 6.4].map((z) => (
        <mesh key={`e${z}`} geometry={unitBox} material={mat(z === HWY_Z + 1.4 || z === HWY_Z - 1.4 ? COLORS.amber : "#F8F5EE")} position={[0, HWY_DECK_Y + 0.02, z]} scale={[HWY_MAX_X - HWY_MIN_X, 0.02, 0.18]} />
      ))}
      <InstMesh items={piers} />
      <InstMesh items={paint} shadow={false} />
      <InstMesh items={lampPoles} />
      <InstMesh items={lampHeads} shadow={false} material={litMat("#F6F3EC", LIGHT.sodium, 2)} />
      {lampXs.map((x) => (
        <group key={x}>
          <Glow position={[x, HWY_DECK_Y + 7.7, HWY_Z + 2.2]} color={LIGHT.sodium} size={3.2} />
          <Glow position={[x, HWY_DECK_Y + 7.7, HWY_Z - 2.2]} color={LIGHT.sodium} size={3.2} />
        </group>
      ))}
      <SignGantry x={262} z={HWY_Z + 3.6} title="PASIR PANJANG TERMINAL" sub="EXIT 7 · 500 m" />
      <SignGantry x={-80} z={HWY_Z - 3.6} title="TUAS · JURONG" sub="AYE · AYER RAJAH EXPWY" flip />
      <Text font={FONT_URL} fontSize={2.6} color="#9E9583" position={[-420, HWY_DECK_Y + 0.05, HWY_Z]} rotation={[-Math.PI / 2, 0, 0]} anchorX="center" anchorY="middle">
        AYE · AYER RAJAH EXPRESSWAY
      </Text>
    </group>
  );
});

function SignGantry({ x, z, title, sub, flip }: { x: number; z: number; title: string; sub: string; flip?: boolean }) {
  const y = HWY_DECK_Y;
  const face = flip ? -1 : 1;
  return (
    <group position={[x, y, z]}>
      {[-3.6, 3.6].map((dz) => (
        <mesh key={dz} geometry={unitBox} material={mat("#8C8578")} position={[0, 4, dz]} scale={[0.35, 8, 0.35]} castShadow />
      ))}
      <mesh geometry={unitBox} material={mat("#8C8578")} position={[0, 7.8, 0]} scale={[0.4, 0.4, 7.6]} />
      <mesh geometry={unitBox} material={litMat("#1F6B48", "#3FA472", 0.5)} position={[0.3 * face, 6.6, 0]} scale={[0.15, 2.6, 6.8]} castShadow />
      <group position={[0.4 * face, 6.6, 0]} rotation={[0, (face * Math.PI) / 2, 0]}>
        <Text font={FONT_URL} fontSize={0.72} color="#FFFFFF" position={[0, 0.45, 0]} anchorX="center" anchorY="middle" maxWidth={6.4}>
          {title}
        </Text>
        <Text font={FONT_URL} fontSize={0.55} color="#DDF0E5" position={[0, -0.6, 0]} anchorX="center" anchorY="middle">
          {sub}
        </Text>
      </group>
    </group>
  );
}

/** Local road grid: frontage road under the expressway, ring road, port avenue and cross streets, with lane paint. */
const LocalRoads = memo(function LocalRoads() {
  const dashes = useMemo(() => {
    const out: Inst[] = [];
    for (let x = FRONTAGE_MIN_X + 4; x < FRONTAGE_MAX_X - 2; x += 6) {
      if (Math.abs(x - AVE_X) < 8) continue;
      out.push({ p: [x, 0.03, FRONTAGE_Z], s: [2.6, 0.02, 0.2], c: "#F8F5EE" });
      out.push({ p: [x, 0.03, RING_Z], s: [2.6, 0.02, 0.2], c: "#F8F5EE" });
    }
    for (let z = -26; z > AVE_MIN_Z + 2; z -= 6) {
      if (Math.abs(z - FRONTAGE_Z) < 6 || Math.abs(z - RING_Z) < 6) continue;
      out.push({ p: [AVE_X, 0.03, z], s: [0.22, 0.02, 2.6], c: COLORS.amber });
    }
    return out;
  }, []);
  const fw = FRONTAGE_MAX_X - FRONTAGE_MIN_X;
  const fx = (FRONTAGE_MAX_X + FRONTAGE_MIN_X) / 2;
  return (
    <group>
      <Flat x={fx} z={HWY_Z} w={fw + 40} d={DECK_W + 2} color="#D6CFC1" y={0.008} />
      <Flat x={fx} z={FRONTAGE_Z} w={fw} d={6} color={ROAD} y={0.02} />
      <Flat x={fx} z={RING_Z} w={fw} d={6} color={ROAD} y={0.02} />
      <Flat x={AVE_X} z={(AVE_MIN_Z + -23) / 2} w={12} d={-23 - AVE_MIN_Z} color={ROAD} y={0.021} />
      {CROSS_X.map((x) => (
        <Flat key={x} x={x} z={(FRONTAGE_Z + RING_Z) / 2} w={6} d={FRONTAGE_Z - RING_Z} color={ROAD} y={0.02} />
      ))}
      <Flat x={CROSS_X[0]} z={-94} w={6} d={40} color={ROAD} y={0.02} />
      {[FRONTAGE_Z - 3.4, FRONTAGE_Z + 3.4, RING_Z - 3.4, RING_Z + 3.4].map((z) => (
        <Flat key={z} x={fx} z={z} w={fw} d={0.8} color="#E9E4D8" y={0.015} />
      ))}
      <InstMesh items={dashes} shadow={false} />
    </group>
  );
});

/** Trees in the district gaps and along the avenue, plus far-field parks, HDB estates and city blocks for scale. */
const Hinterland = memo(function Hinterland() {
  const { crowns, trunks, fields, blocks, bands, houses, roofs } = useMemo(() => {
    const r = mulberry32(9090);
    const crowns: Inst[] = [];
    const trunks: Inst[] = [];
    const tree = (x: number, z: number, s = 0.8 + r() * 0.6) => {
      if (x < -340 && Math.abs(z + 127.5) < 7) return;
      crowns.push({ p: [x, 2.6 * s + 1.2, z], s: [s * 2.2, s * 2.2, s * 2.2], c: r() > 0.5 ? COLORS.tree : COLORS.treeDark });
      trunks.push({ p: [x, 1.1 * s, z], s: [0.35, 2.2 * s, 0.35], c: "#8A6E52" });
    };
    for (let z = -28; z > AVE_MIN_Z; z -= 6.5) {
      if (Math.abs(z - FRONTAGE_Z) < 8 || Math.abs(z - RING_Z) < 8 || Math.abs(z - HWY_Z) < 9) continue;
      tree(AVE_X - 9 + r(), z + r());
      tree(AVE_X + 9 + r(), z + r());
    }
    const gaps: Array<[number, number]> = [
      [-286, -270],
      [-186, -168],
      [-112, -106],
      [-98, -91],
      [-33, -13],
      [53, 106],
      [114, 149],
      [291, 312],
      [328, 339],
    ];
    for (const [a, b] of gaps) for (let i = 0; i < Math.ceil((b - a) / 1.5); i++) tree(a + 1 + r() * (b - a - 2), -167 - r() * 60);
    for (let i = 0; i < 10; i++) tree(84 + r() * 19, -121 - r() * 34);
    for (let i = 0; i < 10; i++) tree(117 + r() * 17, -121 - r() * 34);
    for (let i = 0; i < 12; i++) tree(252 + r() * 56, -121 - r() * 34);
    for (let i = 0; i < 6; i++) tree(-116 + r() * 10, -121 - r() * 34);
    for (let x = -360; x < 440; x += 7) tree(x + r() * 2, -236 - r() * 3);
    for (let i = 0; i < 26; i++) tree(-372 - r() * 20, -80 - r() * 150);

    const fields: Inst[] = [];
    const fieldCols = ["#CFDCC0", "#C6D6B6", "#D6E0C8", "#C9D8BA", "#DCE3CF"];
    for (let x = -900; x < 900; x += 90) {
      for (let z = -250; z > -760; z -= 70) {
        if (r() < 0.35) continue;
        fields.push({ p: [x + 45, 0.004, z - 35], s: [86, 0.01, 66], c: fieldCols[Math.floor(r() * fieldCols.length)] });
      }
    }
    for (let x = -900; x < -380; x += 80) for (let z = -90; z > -240; z -= 60) if (r() > 0.3) fields.push({ p: [x + 40, 0.004, z - 30], s: [76, 0.01, 56], c: fieldCols[Math.floor(r() * fieldCols.length)] });

    const blocks: Inst[] = [];
    const bands: Inst[] = [];
    const houses: Inst[] = [];
    const roofs: Inst[] = [];
    const hdbWalls = ["#F4F1EA", "#EFEBE2", "#F1EDE6", "#E9E6DF"];
    const hdbAccents = ["#C2634B", "#2C6FB0", "#4E7A5A", "#E8A317", "#B5463A", "#4F6D8F"];
    /** HDB slab block: white walls, floor bands, a coloured crown and lift-core accent. */
    const hdb = (x: number, z: number, ry: number) => {
      const w = 5.5 + r() * 1.6;
      const d = 14 + r() * 9;
      const h = 12 + r() * 6;
      const accent = hdbAccents[Math.floor(r() * hdbAccents.length)];
      houses.push({ p: [x, h / 2, z], s: [w, h, d], c: hdbWalls[Math.floor(r() * hdbWalls.length)], r: [0, ry, 0] });
      roofs.push({ p: [x, h + 0.5, z], s: [w + 0.3, 1, d + 0.3], c: accent, r: [0, ry, 0] });
      roofs.push({ p: [x, h / 2, z], s: [w + 0.5, h, 2.2], c: accent, r: [0, ry, 0] });
      for (let y = 1.8; y < h - 0.6; y += 2) bands.push({ p: [x, y, z], s: [w + 0.06, 0.5, d + 0.06], c: "#2A3B57", r: [0, ry, 0] });
    };
    // Kent Ridge / Clementi estates north of the industrial estate.
    for (let gx = -340; gx < 600; gx += 34) {
      for (let gz = -284; gz > -480; gz -= 38) {
        if (r() < 0.22) continue;
        hdb(gx + r() * 8, gz - r() * 8, r() > 0.5 ? 0 : Math.PI / 2);
      }
    }
    // Jurong West estates beyond the bunker terminal.
    for (let gx = -430; gx > -880; gx -= 32) {
      for (let gz = -20; gz > -250; gz -= 36) {
        const z = gz - r() * 6;
        if (Math.abs(z - HWY_Z) < 18 || Math.abs(z + 127.5) < 12 || r() < 0.25) continue;
        hdb(gx - r() * 6, z, r() > 0.5 ? 0 : Math.PI / 2);
      }
    }
    // Downtown Core skyline to the east.
    const glass = ["#BFCBD3", "#C9D3D8", "#AEBCC6", "#D5DCE0", "#E2DCCF"];
    for (let i = 0; i < 46; i++) {
      const x = 640 + r() * 260;
      const z = -150 - r() * 260;
      if (Math.abs(x - 760) < 26 && Math.abs(z + 280) < 40) continue;
      const h = 26 + r() * 52;
      const w = 7 + r() * 8;
      const d = 7 + r() * 8;
      blocks.push({ p: [x, h / 2, z], s: [w, h, d], c: glass[Math.floor(r() * glass.length)] });
      for (let y = 3; y < h - 2; y += 4) bands.push({ p: [x, y, z], s: [w + 0.06, 0.7, d + 0.06], c: "#2A3B57" });
    }
    return { crowns, trunks, fields, blocks, bands, houses, roofs };
  }, []);

  return (
    <group>
      <InstMesh items={fields} shadow={false} rough={1} />
      <InstMesh items={crowns} geo={crownGeo} flat rough={0.9} />
      <InstMesh items={trunks} cyl />
      <InstMesh items={blocks} />
      <InstMesh items={bands} shadow={false} material={litMat("#2A3B57", LIGHT.window, 0.8)} />
      <InstMesh items={houses} />
      <InstMesh items={roofs} />
      <MarinaBaySands />
    </group>
  );
});

/** Landmark on the eastern skyline: three hotel towers joined by the SkyPark deck. */
function MarinaBaySands() {
  const x = 760;
  const h = 66;
  return (
    <group position={[x, 0, -280]}>
      {[-22, 0, 22].map((dz) => (
        <group key={dz} position={[0, 0, dz]}>
          <mesh geometry={unitBox} material={mat("#D8DEE2")} position={[-2.2, h / 2, 0]} scale={[4.6, h, 9]} rotation={[0, 0, -0.035]} castShadow />
          <mesh geometry={unitBox} material={mat("#E6EAEC")} position={[2.2, h / 2, 0]} scale={[4.6, h, 9]} rotation={[0, 0, 0.035]} castShadow />
          <mesh geometry={unitBox} material={litMat("#9FB0BC", LIGHT.window, 0.9)} position={[0, h / 2, 0]} scale={[1.2, h - 2, 9.1]} />
        </group>
      ))}
      <mesh geometry={unitBox} material={mat("#F1F0EC")} position={[0, h + 1, -4]} scale={[11, 2, 74]} castShadow />
      <mesh geometry={unitBox} material={mat("#5C8F7A")} position={[0, h + 2.1, -4]} scale={[9, 0.3, 66]} />
      <Glow position={[0, h + 3, 30]} color={LIGHT.red} size={2.4} blink={2.4} />
      <Glow position={[0, h + 3, -40]} color={LIGHT.red} size={2.4} blink={2.4} phase={1.2} />
    </group>
  );
}

export function Roads() {
  return (
    <group>
      <Expressway />
      <LocalRoads />
      <Hinterland />
    </group>
  );
}
