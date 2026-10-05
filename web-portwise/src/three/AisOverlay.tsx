import { useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { WATER_Y } from "@/data/layout";
import { simT } from "@/sim/simStore";
import { AIS_DEFS } from "@/sim/ais/tracks";
import { aisFix, aisReceived, newFix } from "@/sim/ais/tracker";
import { DEG, KN, M_PER_UNIT } from "@/sim/ais/geo";
import { nightFx } from "@/state/nightMode";
import { usePort } from "@/state/PortProvider";
import { useShowsClass } from "@/state/shipFilter";
import { shipClassOf } from "@/sim/ais/static";

const MAX_FIXES = 160;
const HISTORY_SEC = 900;
/** ECDIS-style speed vector: where the ship will be in this many seconds at reported SOG/COG. */
const VECTOR_SEC = 60;
const Y = WATER_Y + 0.14;

const DAY = { track: new THREE.Color("#2C6FB0"), vector: new THREE.Color("#F2622E") };
const NIGHT = { track: new THREE.Color("#8CC4FF"), vector: new THREE.Color("#FF8A4C") };

const fixGeo = new THREE.CylinderGeometry(1, 1, 0.12, 4);
const dummy = new THREE.Object3D();

function AisTrack({ id }: { id: string }) {
  const { selection, view } = usePort();
  const showsClass = useShowsClass(shipClassOf(id));
  const visible = showsClass && (view === "overview" || view === "vessels" || (selection?.kind === "vessel" && selection.id === id));
  const selected = selection?.kind === "vessel" && selection.id === id;

  const parts = useMemo(() => {
    const trackMat = new THREE.LineDashedMaterial({ color: DAY.track, dashSize: 2.2, gapSize: 1.6, transparent: true, opacity: 0.75, depthWrite: false });
    const trackGeo = new THREE.BufferGeometry();
    trackGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array((MAX_FIXES + 1) * 3), 3));
    const track = new THREE.Line(trackGeo, trackMat);
    track.frustumCulled = false;
    track.renderOrder = 2;

    const vecMat = new THREE.LineBasicMaterial({ color: DAY.vector, transparent: true, opacity: 0.95, depthWrite: false });
    const vecGeo = new THREE.BufferGeometry();
    vecGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    const vector = new THREE.Line(vecGeo, vecMat);
    vector.frustumCulled = false;
    vector.renderOrder = 3;

    const fixMat = new THREE.MeshBasicMaterial({ color: DAY.track, transparent: true, opacity: 0.9, depthWrite: false });
    const fixes = new THREE.InstancedMesh(fixGeo, fixMat, MAX_FIXES);
    fixes.frustumCulled = false;
    fixes.count = 0;
    fixes.renderOrder = 3;
    return { track, trackGeo, trackMat, vector, vecGeo, vecMat, fixes, fixMat, fix: newFix(), lastKey: "" };
  }, []);

  useFrame(() => {
    if (!visible) return;
    const t = simT();
    const p = parts;
    const k = nightFx.mix;
    p.trackMat.color.copy(DAY.track).lerp(NIGHT.track, k);
    p.fixMat.color.copy(p.trackMat.color);
    p.vecMat.color.copy(DAY.vector).lerp(NIGHT.vector, k);
    p.trackMat.opacity = selected ? 0.95 : 0.7;

    const f = aisFix(id, t, p.fix);
    const reps = aisReceived(id, t, HISTORY_SEC);
    let start = 0;
    for (let i = reps.length - 1; i > 0; i--) {
      if (reps[i].reset) {
        start = i;
        break;
      }
    }
    const list = reps.slice(Math.max(start, reps.length - MAX_FIXES));
    const pos = p.trackGeo.attributes.position as THREE.BufferAttribute;
    const key = list.length ? `${list[0].seq}:${list[list.length - 1].seq}:${selected}` : "";
    if (key !== p.lastKey) {
      p.lastKey = key;
      list.forEach((r, i) => {
        pos.setXYZ(i, r.x, Y, r.z);
        const age = (t - r.tFix) / HISTORY_SEC;
        const s = (selected ? 1.15 : 0.85) * (1 - age * 0.45);
        dummy.position.set(r.x, Y + 0.02, r.z);
        dummy.rotation.set(0, Math.PI / 4, 0);
        dummy.scale.set(s, 1, s);
        dummy.updateMatrix();
        p.fixes.setMatrixAt(i, dummy.matrix);
      });
      p.fixes.count = list.length;
      p.fixes.instanceMatrix.needsUpdate = true;
    }
    pos.setXYZ(list.length, f.x, Y, f.z);
    pos.needsUpdate = true;
    p.trackGeo.setDrawRange(0, list.length + 1);
    p.track.computeLineDistances();
    p.track.visible = list.length > 0;

    const moving = f.report !== null && f.sog >= 0.5 && !f.lost;
    p.vector.visible = moving;
    if (moving) {
      const len = (f.sog * KN * VECTOR_SEC) / M_PER_UNIT;
      const b = f.cog * DEG;
      const vp = p.vecGeo.attributes.position as THREE.BufferAttribute;
      vp.setXYZ(0, f.x, Y + 0.05, f.z);
      vp.setXYZ(1, f.x + Math.sin(b) * len, Y + 0.05, f.z - Math.cos(b) * len);
      vp.needsUpdate = true;
    }
  });

  return (
    <group visible={visible}>
      <primitive object={parts.track} />
      <primitive object={parts.fixes} />
      <primitive object={parts.vector} />
    </group>
  );
}

/** Past AIS fixes (diamonds on a dashed track) and a 1-minute COG/SOG vector for ships under way. */
export function AisOverlay() {
  return (
    <group>
      {AIS_DEFS.filter((d) => d.role === "call").map((d) => (
        <AisTrack key={d.id} id={d.id} />
      ))}
    </group>
  );
}
