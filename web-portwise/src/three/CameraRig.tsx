import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CameraControls } from "@react-three/drei";
import type { Selection } from "@/data/types";
import { blockById, craneById, truckById, vesselById } from "@/data/port";
import { containerById, shipmentById } from "@/data/containers";
import { facilityById } from "@/data/facilities";
import { GATE_X, SHIP_Z, berthX } from "@/data/layout";
import { sceneRegistry } from "@/sim/simStore";
import type { CameraView } from "@/state/PortProvider";
import { selKey, usePort } from "@/state/PortProvider";

type V3 = [number, number, number];

interface Shot {
  target: V3;
  offset: V3;
  follow?: string;
}

const VIEWS: Record<CameraView, Shot> = {
  overview: { target: [-14, 0, -4], offset: [118, 178, 248] },
  vessels: { target: [-20, 0, 18], offset: [86, 120, 176] },
  yard: { target: [0, 0, -26], offset: [62, 150, 150] },
  gate: { target: [150, 0, -18], offset: [60, 84, 110] },
  logistics: { target: [30, 0, -150], offset: [120, 210, 250] },
};

/** Imperative camera API used by the HUD camera rail. */
export const cameraApi: { current: CameraControls | null } = { current: null };

const tmp = new THREE.Vector3();

function shotFor(sel: Selection): Shot | null {
  switch (sel.kind) {
    case "vessel": {
      const v = vesselById(sel.id);
      if (!v) return null;
      if (v.inScene) return { target: [berthX(v.berth), 3, SHIP_Z], offset: [40, 50, 78], follow: `vessel:${v.id}` };
      return { target: [berthX(v.berth), 0, SHIP_Z - 4], offset: [34, 44, 64] };
    }
    case "crane": {
      const c = craneById(sel.id);
      return c ? { target: [c.x, 10, 15], offset: [36, 32, 60] } : null;
    }
    case "block": {
      const b = blockById(sel.id);
      return b ? { target: [b.x, 2, b.z], offset: [28, 48, 56] } : null;
    }
    case "container": {
      const c = containerById(sel.id);
      return c ? { target: [c.x, c.y, c.z], offset: [22, 30, 40] } : null;
    }
    case "truck": {
      const t = truckById(sel.id);
      return t ? { target: [GATE_X - 30, 1, -12], offset: [20, 26, 38], follow: `truck:${t.id}` } : null;
    }
    case "facility": {
      const f = facilityById(sel.id);
      if (!f) return null;
      const s = Math.max(0.8, Math.min(2.2, Math.max(f.w, f.d) / 60));
      return { target: [f.x, 2, f.z], offset: [44 * s, 58 * s, 84 * s] };
    }
    case "shipment": {
      const s = shipmentById(sel.id);
      if (!s) return null;
      if (s.truckId) return { target: [GATE_X - 40, 1, -14], offset: [44, 58, 80], follow: `truck:${s.truckId}` };
      const c = containerById(s.containerIds[0]);
      if (s.current <= 1 && s.direction === "import") return shotFor({ kind: "vessel", id: s.vesselId });
      return c ? { target: [c.x, c.y, c.z], offset: [18, 26, 34] } : null;
    }
  }
  return null;
}

/** Flies the camera to the current selection (or the page's default view) and follows moving objects. */
export function CameraRig() {
  const ref = useRef<CameraControls>(null);
  const { selection, view, homeNonce } = usePort();
  const followKey = useRef<string | undefined>(undefined);
  const key = selKey(selection);

  useEffect(() => {
    cameraApi.current = ref.current;
    const c = ref.current;
    if (c) {
      const v = VIEWS.overview;
      c.setLookAt(v.target[0] + v.offset[0] * 1.5, v.offset[1] * 1.7, v.target[2] + v.offset[2] * 1.5, v.target[0], v.target[1], v.target[2], false);
    }
    return () => {
      cameraApi.current = null;
    };
  }, []);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const shot = (selection ? shotFor(selection) : null) ?? VIEWS[view];
    followKey.current = shot.follow;
    let target: V3 = shot.target;
    if (shot.follow) {
      const obj = sceneRegistry.get(shot.follow);
      if (obj) {
        obj.getWorldPosition(tmp);
        target = [tmp.x, shot.target[1], tmp.z];
      }
    }
    const [tx, ty, tz] = target;
    const [ox, oy, oz] = shot.offset;
    void c.setLookAt(tx + ox, ty + oy, tz + oz, tx, ty, tz, true);
  }, [key, view, homeNonce, selection]);

  useFrame(() => {
    const c = ref.current;
    const k = followKey.current;
    if (!c || !k) return;
    const obj = sceneRegistry.get(k);
    if (!obj || !obj.visible) return;
    obj.getWorldPosition(tmp);
    const cur = c.getTarget(new THREE.Vector3());
    if (cur.distanceToSquared(tmp.setY(cur.y)) > 0.04) void c.moveTo(tmp.x, cur.y, tmp.z, true);
  });

  return (
    <CameraControls
      ref={ref}
      makeDefault
      smoothTime={0.6}
      draggingSmoothTime={0.12}
      minDistance={14}
      maxDistance={820}
      minPolarAngle={0.25}
      maxPolarAngle={1.25}
      dollyToCursor
    />
  );
}
