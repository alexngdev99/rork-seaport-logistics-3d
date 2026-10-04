/** World layout constants. Water lies at z > QUAY_Z, land at z < QUAY_Z. +x points right on screen. */
export const QUAY_Z = 20;
export const WATER_Y = -1.4;
export const LAND_RAIL_Z = 12;
export const SEA_RAIL_Z = 18;
export const CRANE_LANE_Z = 15;
export const APRON_Z = 8;
export const SHIP_Z = 25.2;

export const BERTH_SPACING = 50;
export const berthX = (berth: number): number => -175 + (berth - 1) * BERTH_SPACING;

/** Quay extent along x. */
export const QUAY_MIN_X = -212;
export const QUAY_MAX_X = 212;

export const CONTAINER_L = 3.0;
export const CONTAINER_W = 1.3;
export const CONTAINER_H = 1.3;

export const BLOCK_BAYS = 8;
export const BLOCK_ROWS = 6;
export const BLOCK_TIERS = 4;
export const BAY_PITCH = 3.2;
export const ROW_PITCH = 1.45;
export const BLOCK_HALF_X = (BLOCK_BAYS * BAY_PITCH) / 2;
export const BLOCK_HALF_Z = (BLOCK_ROWS * ROW_PITCH) / 2;

/** Ten block columns, 32 m apart; vertical roads run between them at x = -160 + 32k. */
export const BLOCK_COL_X = Array.from({ length: 10 }, (_, i) => -144 + i * 32);
export const BLOCK_ROW_Z: Record<string, number> = { A: 0, B: -14, C: -28, D: -42 };
export const ROW_ROADS_Z = [-7, -21, -35, -49];
export const COL_ROADS_X = Array.from({ length: 11 }, (_, k) => -160 + k * 32);

/** Main north–south spine linking the gate plaza to every yard lane. */
export const SPINE_X = 176;
export const GATE_X = 200;
/** Gate plaza road runs east to the far kerb of the port avenue (see facilities.ts AVE_X). */
export const ROAD_END_X = 326;

export const COLORS = {
  ink: "#12233F",
  paper: "#FFFDF8",
  canvas: "#F3EFE6",
  land: "#EAE4D6",
  pavement: "#D9D3C6",
  road: "#C9C2B3",
  pad: "#E3DCCD",
  quay: "#D4CDBE",
  quayWall: "#BDB5A4",
  signal: "#F2622E",
  moss: "#2F8F6B",
  amber: "#E8A317",
  brick: "#C8423B",
  slate: "#6B7280",
  steelDark: "#2B3442",
  white: "#F6F3EC",
  tree: "#6E9B6B",
  treeDark: "#4E7A5A",
} as const;

export const CONTAINER_COLORS = {
  orange: "#F2622E",
  navy: "#1E3A66",
  brick: "#B5463A",
  moss: "#4E7A5A",
  sand: "#D9B26A",
  steel: "#4F6D8F",
  reefer: "#EDEBE4",
} as const;
