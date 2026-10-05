import * as THREE from "three";
import type { CameraControls } from "@react-three/drei";
import { DEG, M_PER_UNIT, geoToScene, sceneToGeo, wrap360 } from "@/sim/ais/geo";

/**
 * Shareable camera views. A view is stored in the `cam` query parameter as real-world numbers:
 * `cam=lat,lon,alt,range,heading,pitch`. Lat/lon (WGS-84) and alt (m) give the point the camera orbits,
 * range is the distance to it in metres, heading is the compass direction the camera looks (0 = north)
 * and pitch is how far it looks down from the horizon, in degrees.
 *
 * Range is stored as the landscape-desktop distance: portrait screens pull every shot back by their fit
 * factor (see CameraRig), so a view shared from a phone frames the same area when opened on a laptop.
 */
export const VIEW_PARAM = "cam";

export interface SharedView {
  lat: number;
  lon: number;
  alt: number;
  range: number;
  heading: number;
  pitch: number;
}

/** Same limits as the CameraControls in CameraRig, so a link can never place the camera out of bounds. */
const MIN_DIST = 14;
const MAX_DIST = 820;
const MIN_POLAR = 0.25;
const MAX_POLAR = 1.25;

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const tmpTarget = new THREE.Vector3();
const tmpSph = new THREE.Spherical();
const tmpPos = new THREE.Vector3();

/** Reads the camera's resting view (the end of any fly-in in progress). */
export function readView(c: CameraControls, fit = 1): SharedView {
  c.getTarget(tmpTarget, true);
  c.getSpherical(tmpSph, true);
  const g = sceneToGeo(tmpTarget.x, tmpTarget.z);
  return {
    lat: g.lat,
    lon: g.lon,
    alt: tmpTarget.y * M_PER_UNIT,
    range: (tmpSph.radius / fit) * M_PER_UNIT,
    heading: wrap360(-tmpSph.theta / DEG),
    pitch: 90 - tmpSph.phi / DEG,
  };
}

/** Moves the camera to a shared view, optionally with the usual smooth flight. */
export function applyView(c: CameraControls, v: SharedView, animate: boolean, fit = 1): void {
  const t = geoToScene(v.lat, v.lon, { x: 0, z: 0 });
  tmpTarget.set(t.x, v.alt / M_PER_UNIT, t.z);
  tmpSph.set(clamp((v.range * fit) / M_PER_UNIT, MIN_DIST, MAX_DIST), clamp((90 - v.pitch) * DEG, MIN_POLAR, MAX_POLAR), -v.heading * DEG);
  tmpPos.setFromSpherical(tmpSph).add(tmpTarget);
  void c.setLookAt(tmpPos.x, tmpPos.y, tmpPos.z, tmpTarget.x, tmpTarget.y, tmpTarget.z, animate);
}

const num = (v: number, digits: number): string => String(Number(v.toFixed(digits)));

export function encodeView(v: SharedView): string {
  return [num(v.lat, 5), num(v.lon, 5), num(v.alt, 1), num(v.range, 0), num(v.heading, 1), num(v.pitch, 1)].join(",");
}

/** Parses a `cam` value; returns null for anything malformed or far outside the Pasir Panjang chart. */
export function decodeView(raw: string | null): SharedView | null {
  if (!raw) return null;
  const parts = raw.split(",").map((p) => Number(p.trim()));
  if (parts.length !== 6 || parts.some((p) => !Number.isFinite(p))) return null;
  const [lat, lon, alt, range, heading, pitch] = parts;
  if (lat < 1.1 || lat > 1.45 || lon < 103.55 || lon > 104.0) return null;
  return {
    lat,
    lon,
    alt: clamp(alt, -10, 120),
    range: clamp(range, MIN_DIST * M_PER_UNIT, MAX_DIST * M_PER_UNIT),
    heading: wrap360(heading),
    pitch: clamp(pitch, 90 - MAX_POLAR / DEG, 90 - MIN_POLAR / DEG),
  };
}

/** The current page URL (path and other params kept) with the view attached. */
export function shareUrl(v: SharedView, href: string = window.location.href): string {
  const u = new URL(href);
  u.searchParams.set(VIEW_PARAM, encodeView(v));
  u.hash = "";
  return u.toString();
}

/** The view carried by the page's own URL, if any (read once when the scene starts). */
export function viewFromLocation(): SharedView | null {
  if (typeof window === "undefined") return null;
  return decodeView(new URLSearchParams(window.location.search).get(VIEW_PARAM));
}

const POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
export const compassPoint = (deg: number): string => POINTS[Math.round(wrap360(deg) / 45) % 8];

export const fmtLat = (lat: number): string => `${Math.abs(lat).toFixed(5)}° ${lat >= 0 ? "N" : "S"}`;
export const fmtLon = (lon: number): string => `${Math.abs(lon).toFixed(5)}° ${lon >= 0 ? "E" : "W"}`;

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtRange = (m: number): string => (m < 1000 ? `${nf0.format(m)} m` : `${nf2.format(m / 1000)} km`);
export const fmtHeading = (deg: number): string => `${Math.round(wrap360(deg)) % 360}° ${compassPoint(deg)}`;
