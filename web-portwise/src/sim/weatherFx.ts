/**
 * Eased weather + sky values, advanced every frame by the scene's atmosphere rig and read by
 * the 3D scene (water, smoke, ships) and the sim (crane weather holds, productivity).
 * Lives in /sim with no imports so both sides can read it without import cycles.
 */
export const weatherFx = {
  /** 0 … 1 blends toward each weather look. */
  cloud: 0,
  rain: 0,
  storm: 0,
  fog: 0,
  haze: 0,
  /** Eased wind speed (m/s) and the unit vector the wind blows toward, in scene axes (+x east, −z north). */
  windMs: 3,
  windToX: 0.6,
  windToZ: -0.8,
  /** 0 … 1 eased crane weather hold (booms rise as it grows). */
  hold: 0,
  holdReason: "",
  /** Multiplier on live crane productivity (rain slows lashing, a hold stops it). */
  productivity: 1,
  /** Lightning flash envelope 0 … 1. */
  flash: 0,
  /** Sun elevation in degrees at the current sky time. */
  sunElev: 45,
};

/** Swell multiplier for floating hulls: calm 1, squall ~5. */
export const seaState = (): number => 1 + weatherFx.rain * 1.2 + weatherFx.storm * 3.6 + Math.min(1.5, weatherFx.windMs / 9);
