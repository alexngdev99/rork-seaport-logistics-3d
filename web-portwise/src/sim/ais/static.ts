/** AIS message 5 (static & voyage related data) for each vessel, keyed by vessel id. */
export interface ShipStaticData {
  mmsi: number;
  callSign: string;
  /** AIS ship type code; 70–79 = cargo. */
  shipType: number;
  /** Antenna reference: A = to bow, B = to stern, C = to port, D = to starboard (metres). */
  dimension: { A: number; B: number; C: number; D: number };
  /** Metres, 0.1 m resolution. */
  draught: number;
  /** Free text, usually a UN/LOCODE. */
  destination: string;
}

const dims = (lengthM: number, beamM = 23): ShipStaticData["dimension"] => {
  const A = Math.round(lengthM * 0.84);
  const C = Math.floor(beamM / 2);
  return { A, B: lengthM - A, C, D: beamM - C };
};

export const AIS_STATIC: Record<string, ShipStaticData> = {
  "seastar-07": { mmsi: 563001270, callSign: "9VSS7", shipType: 70, dimension: dims(126), draught: 8.6, destination: "MYPKG" },
  "merlion-star": { mmsi: 563003180, callSign: "9VMK4", shipType: 70, dimension: dims(102, 20), draught: 7.9, destination: "TWKHH" },
  "orient-lotus": { mmsi: 352986140, callSign: "3FOL8", shipType: 70, dimension: dims(114), draught: 8.2, destination: "SGSIN" },
  "jade-river": { mmsi: 563009420, callSign: "9VJR2", shipType: 70, dimension: dims(120), draught: 8.4, destination: "PHMNL" },
  "pacific-harmony": { mmsi: 563112870, callSign: "9V2841", shipType: 70, dimension: dims(126), draught: 9.1, destination: "KRPUS" },
  "coral-bay": { mmsi: 477305900, callSign: "VRMX4", shipType: 70, dimension: dims(114), draught: 8.0, destination: "THBKK" },
  "nordic-spirit": { mmsi: 563011560, callSign: "9VNS6", shipType: 70, dimension: dims(120), draught: 8.7, destination: "LKCMB" },
  "blue-marlin": { mmsi: 563002930, callSign: "9VBM1", shipType: 70, dimension: dims(96, 20), draught: 7.4, destination: "SGSIN" },
  "jakarta-express": { mmsi: 563014110, callSign: "9VHE9", shipType: 70, dimension: dims(90, 18), draught: 6.8, destination: "SGSIN" },
  "asian-dawn": { mmsi: 564381000, callSign: "9V7731", shipType: 70, dimension: dims(114), draught: 8.5, destination: "SGSIN" },
  "sinar-bintan": { mmsi: 563088210, callSign: "9VTC8", shipType: 70, dimension: dims(72, 14), draught: 4.6, destination: "MYPGU" },
  "kota-ria": { mmsi: 533071330, callSign: "9VPL3", shipType: 70, dimension: dims(72, 13), draught: 4.2, destination: "IDBTM" },
  "batam-link": { mmsi: 525002680, callSign: "9VVF6", shipType: 70, dimension: dims(78, 14), draught: 5.0, destination: "MYTPP" },
  "jurong-08": { mmsi: 563090680, callSign: "9VMT8", shipType: 79, dimension: dims(60, 11), draught: 3.8, destination: "MYPGU" },
  "straits-03": { mmsi: 563093090, callSign: "9VSH9", shipType: 79, dimension: dims(60, 11), draught: 3.6, destination: "IDJKT" },
  "ocean-grace": { mmsi: 563004470, callSign: "9VHB2", shipType: 70, dimension: dims(84, 15), draught: 5.6, destination: "SGSIN" },
  "johor-pride": { mmsi: 533085050, callSign: "9VTH5", shipType: 70, dimension: dims(66, 12), draught: 4.0, destination: "MYPKG" },
  "pacific-21": { mmsi: 563077210, callSign: "9VPC1", shipType: 70, dimension: dims(72, 13), draught: 4.4, destination: "MYTPP" },
};

export const SHIP_TYPE_LABEL = (code: number): string => (code >= 70 && code <= 79 ? "Cargo" : code >= 80 && code <= 89 ? "Tanker" : code === 52 ? "Tug" : "Other");
