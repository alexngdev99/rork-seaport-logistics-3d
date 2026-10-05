import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { CameraControls, CameraControlsImpl } from "@react-three/drei";
import { hudInset } from "@/state/hudInset";
import type { Selection } from "@/data/types";
import { blockById, craneById, truckById, vesselById } from "@/data/port";
import { containerById, shipmentById } from "@/data/containers";
import { facilityById } from "@/data/facilities";
import { GATE_X, SHIP_Z, berthX } from "@/data/layout";
import { sceneRegistry } from "@/sim/simStore";
import type { CameraView } from "@/state/PortProvider";
import { selKey, usePort } from "@/state/PortProvider";
import { useBootRevealed } from "@/state/boot";

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
const tmpTarget = new THREE.Vector3();

/**
 * Portrait screens see far less of the port horizontally at the same FOV, so shots pull back.
 * Bucketed so small viewport changes (mobile toolbars collapsing) never re-fly the camera.
 */
const fitFor = (aspect: number): number => (aspect >= 1.25 ? 1 : aspect >= 0.85 ? 1.3 : 1.75);

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
  const isRevealed = useBootRevealed();
  const fit = useThree((s) => fitFor(s.size.width / Math.max(1, s.size.height)));
  const viewOff = useRef<{ x: number; y: number; w: number; h: number }>({ x: 0, y: 0, w: 0, h: 0 });
  const fitRef = useRef<number>(fit);

  useEffect(() => {
    cameraApi.current = ref.current;
    const c = ref.current;
    if (c) {
      // Map-style touch: one finger pans along the ground, two fingers pinch-zoom and rotate/tilt, three truck.
      c.touches.one = CameraControlsImpl.ACTION.TOUCH_SCREEN_PAN;
      c.touches.two = CameraControlsImpl.ACTION.TOUCH_DOLLY_ROTATE;
      c.touches.three = CameraControlsImpl.ACTION.TOUCH_TRUCK;
      const v = VIEWS.overview;
      c.setLookAt(v.target[0] + v.offset[0] * 1.5, v.offset[1] * 1.7, v.target[2] + v.offset[2] * 1.5, v.target[0], v.target[1], v.target[2], false);
    }
    return () => {
      cameraApi.current = null;
    };
  }, []);

  useEffect(() => {
    const c = ref.current;
    // Hold the wide establishing shot under the boot screen; the fly-in plays as it lifts.
    if (!c || !isRevealed) return;
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
    // Close-ups pull back less than page-wide establishing shots.
    const f = fitRef.current;
    const k = selection ? 1 + (f - 1) * 0.6 : f;
    const [ox, oy, oz] = shot.offset.map((o) => o * k);
    void c.setLookAt(tx + ox, ty + oy, tz + oz, tx, ty, tz, true);
  }, [key, view, homeNonce, selection, isRevealed]);

  // Rotation (portrait <-> landscape): keep the user's current framing and only ease the zoom so the same
  // part of the port stays in view, instead of re-flying the page shot and throwing away their pan/rotate.
  useEffect(() => {
    const prev = fitRef.current;
    fitRef.current = fit;
    const c = ref.current;
    if (!c || prev === fit || !isRevealed) return;
    const ratio = selection ? (1 + (fit - 1) * 0.6) / (1 + (prev - 1) * 0.6) : fit / prev;
    void c.dollyTo(THREE.MathUtils.clamp(c.distance * ratio, 14, 820), true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a fit change should trigger this.
  }, [fit]);

  useFrame((state, dt) => {
    // Shift the projection so the camera target sits in the middle of the map area the HUD leaves visible.
    const cam = state.camera as THREE.PerspectiveCamera;
    const { left, bottom } = hudInset.get();
    const o = viewOff.current;
    const w = state.size.width;
    const h = state.size.height;
    const goalX = -left / 2;
    const goalY = bottom / 2;
    const ease = Math.min(1, dt * 6);
    const nx = Math.abs(goalX - o.x) < 0.5 ? goalX : o.x + (goalX - o.x) * ease;
    const ny = Math.abs(goalY - o.y) < 0.5 ? goalY : o.y + (goalY - o.y) * ease;
    if (nx !== o.x || ny !== o.y || w !== o.w || h !== o.h) {
      o.x = nx;
      o.y = ny;
      o.w = w;
      o.h = h;
      if (nx === 0 && ny === 0) cam.clearViewOffset();
      else cam.setViewOffset(w, h, nx, ny, w, h);
    }

    const c = ref.current;
    const k = followKey.current;
    if (!c || !k) return;
    const obj = sceneRegistry.get(k);
    if (!obj || !obj.visible) return;
    obj.getWorldPosition(tmp);
    const cur = c.getTarget(tmpTarget);
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
