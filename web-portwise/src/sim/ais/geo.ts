/**
 * Local tangent-plane projection between WGS-84 lat/lon (what AIS reports) and scene units.
 * The scene is a north-up chart of Pasir Panjang Terminal, Singapore: +x = east, −z = north, 1 unit = 3 m
 * (a 38-unit hull is a 114 m feeder with a 23 m beam).
 */
export const M_PER_UNIT = 3;
export const GEO_ORIGIN = { lat: 1.2735, lon: 103.7695 } as const;
/** Metres per second in one knot. */
export const KN = 0.514444;
export const DEG = Math.PI / 180;

const M_PER_DEG_LAT = 111_320;
const M_PER_DEG_LON = M_PER_DEG_LAT * Math.cos(GEO_ORIGIN.lat * DEG);

export interface LatLon {
  lat: number;
  lon: number;
}

export function sceneToGeo(x: number, z: number): LatLon {
  return { lat: GEO_ORIGIN.lat - (z * M_PER_UNIT) / M_PER_DEG_LAT, lon: GEO_ORIGIN.lon + (x * M_PER_UNIT) / M_PER_DEG_LON };
}

export function geoToScene(lat: number, lon: number, out: { x: number; z: number }): { x: number; z: number } {
  out.x = ((lon - GEO_ORIGIN.lon) * M_PER_DEG_LON) / M_PER_UNIT;
  out.z = -((lat - GEO_ORIGIN.lat) * M_PER_DEG_LAT) / M_PER_UNIT;
  return out;
}

/** Offset in metres (east, north) → scene units. */
export const metresToUnits = (m: number): number => m / M_PER_UNIT;

/** Compass bearing (0 = north, clockwise) of a scene-space direction. */
export const bearingOf = (dx: number, dz: number): number => ((Math.atan2(dx, -dz) / DEG) % 360 + 360) % 360;

/** three.js rotation.y for a model whose bow points along local +x. */
export const bearingToRotY = (deg: number): number => Math.PI / 2 - deg * DEG;

export const wrap360 = (d: number): number => ((d % 360) + 360) % 360;

/** Signed shortest difference b − a in degrees (−180…180]. */
export const angleDiff = (a: number, b: number): number => {
  const d = wrap360(b - a);
  return d > 180 ? d - 360 : d;
};

export const lerpAngle = (a: number, b: number, k: number): number => wrap360(a + angleDiff(a, b) * k);

function dm(v: number, pos: string, neg: string, degDigits: number): string {
  const a = Math.abs(v);
  const d = Math.floor(a);
  const m = (a - d) * 60;
  return `${String(d).padStart(degDigits, "0")}°${m.toFixed(3).padStart(6, "0")}′${v >= 0 ? pos : neg}`;
}

/** 01°16.410′N */
export const fmtLat = (lat: number): string => dm(lat, "N", "S", 2);
/** 103°46.170′E */
export const fmtLon = (lon: number): string => dm(lon, "E", "W", 3);
