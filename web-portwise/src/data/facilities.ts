/** Logistics district behind the terminal: inland roads, rail, warehousing, customs, industry. */

export const HWY_Z = -104;
/** Singapore keeps left: westbound (driving −x) on the near side, eastbound (driving +x) on the far side. Outer (slow) lane first. */
export const HWY_LANES_W = [-98.6, -101.4];
export const HWY_LANES_E = [-109.4, -106.6];
export const HWY_MIN_X = -900;
export const HWY_MAX_X = 900;
/** Connector from the gate plaza to the highway and on into the district. */
export const AVE_X = 320;
/** Southbound (toward the gate) and northbound lanes of the port avenue — keep left, so southbound runs on the east side. */
export const AVE_S = 323;
export const AVE_N = 317;
export const RING_Z = -160;
export const FRONTAGE_Z = -116;
export const FRONTAGE_MIN_X = -353;
export const FRONTAGE_MAX_X = 432;
/** Two-lane local roads, keep left: eastbound on the north side, westbound on the south side. */
export const FRONT_E = FRONTAGE_Z - 1.4;
export const FRONT_W = FRONTAGE_Z + 1.4;
export const RING_E = RING_Z - 1.4;
export const RING_W = RING_Z + 1.4;
export const AVE_MIN_Z = -232;
export const HWY_DECK_Y = 6;
export const DISTRICT_MIN_X = -360;
export const DISTRICT_MAX_X = 440;

export type FacilityKind = "rail" | "staging" | "cfs" | "bonded" | "cold" | "customs" | "dc" | "factory" | "fuel" | "mnr" | "service";
export type FacilityGroup = "Intermodal" | "Warehousing" | "Customs & services" | "Industry & energy";

export interface Facility {
  id: string;
  name: string;
  short: string;
  kind: FacilityKind;
  group: FacilityGroup;
  operator: string;
  x: number;
  z: number;
  w: number;
  d: number;
  /** Label anchor height. */
  h: number;
  summary: string;
  stats: Array<[string, string]>;
  /** 0..1 current utilization. */
  util: number;
  utilLabel: string;
  /** Rough road distance from Gate B, km. */
  fromGateKm: number;
}

export const FACILITIES: Facility[] = [
  {
    id: "rail-icd",
    name: "Tuas ITH Rail Terminal",
    short: "Rail ITH",
    kind: "rail",
    group: "Intermodal",
    operator: "PSA Inter-Terminal Haulage",
    x: -225,
    z: -137.5,
    w: 212,
    d: 37,
    h: 18,
    summary: "Inter-terminal haulage by rail: shuttle trains run to Tuas Mega Port every 12 minutes, moving transshipment boxes between terminals without touching public roads.",
    stats: [
      ["Tracks", "2 × 450 m"],
      ["Shuttle", "Every 12 min"],
      ["Trains today", "41"],
      ["ITH TEU today", "1,312"],
      ["Stacking", "RMG · 4 high"],
    ],
    util: 0.64,
    utilLabel: "Stack fill",
    fromGateKm: 1.6,
  },
  {
    id: "cfs",
    name: "Seastar CFS",
    short: "CFS",
    kind: "cfs",
    group: "Warehousing",
    operator: "Seastar Logistics",
    x: -58,
    z: -137.5,
    w: 56,
    d: 37,
    h: 12,
    summary: "Container freight station for LCL cargo: stripping imports, consolidating exports, palletizing and labeling.",
    stats: [
      ["Dock doors", "12"],
      ["Stripped today", "46 boxes"],
      ["Stuffed today", "31 boxes"],
      ["Floor area", "12,300 m²"],
      ["Avg dwell", "2.4 days"],
    ],
    util: 0.78,
    utilLabel: "Floor in use",
    fromGateKm: 1.1,
  },
  {
    id: "bonded",
    name: "Pasir Panjang FTZ Warehouse",
    short: "FTZ warehouse",
    kind: "bonded",
    group: "Warehousing",
    operator: "PSA Distripark",
    x: 4,
    z: -137.5,
    w: 50,
    d: 37,
    h: 12,
    summary: "Free Trade Zone storage: goods stay GST- and duty-suspended until they are imported into Singapore, re-exported or transshipped.",
    stats: [
      ["Pallet positions", "9,600"],
      ["In FTZ", "7,140 pallets"],
      ["Released today", "212 pallets"],
      ["Singapore Customs", "On site"],
    ],
    util: 0.74,
    utilLabel: "Pallets occupied",
    fromGateKm: 0.9,
  },
  {
    id: "cold-hub",
    name: "Jurong Cold Chain Hub",
    short: "Cold hub",
    kind: "cold",
    group: "Warehousing",
    operator: "Jurong Cold Chain Pte Ltd",
    x: 60,
    z: -137.5,
    w: 40,
    d: 37,
    h: 15,
    summary: "Temperature-controlled hub for seafood, Australian beef, fruit and vaccines. Reefer boxes are stripped straight into −25 °C chambers.",
    stats: [
      ["Chambers", "6 · −25 °C to +4 °C"],
      ["Reefer plugs", "240"],
      ["Pallets frozen", "3,880"],
      ["Temp alarms", "0"],
    ],
    util: 0.69,
    utilLabel: "Chamber fill",
    fromGateKm: 0.8,
  },
  {
    id: "customs",
    name: "ICA Cargo Inspection Center",
    short: "Customs",
    kind: "customs",
    group: "Customs & services",
    operator: "ICA · Pasir Panjang Checkpoint",
    x: 192,
    z: -137.5,
    w: 110,
    d: 37,
    h: 12,
    summary: "Drive-through X-ray scanner and inspection shed run by the Immigration & Checkpoints Authority. Flagged boxes are scanned, then opened for physical checks if needed.",
    stats: [
      ["Scanner", "Drive-through · 6 MeV"],
      ["Scanned today", "184 boxes"],
      ["Physical checks", "17"],
      ["Avg clearance", "6 min"],
    ],
    util: 0.58,
    utilLabel: "Lane capacity",
    fromGateKm: 0.7,
  },
  {
    id: "staging",
    name: "Truck staging area",
    short: "Staging",
    kind: "staging",
    group: "Customs & services",
    operator: "Pasir Panjang Terminal",
    x: 380,
    z: -137.5,
    w: 98,
    d: 37,
    h: 6,
    summary: "Off-road waiting area. Trucks with a booked gate slot are called forward to the gate so they never queue on the highway.",
    stats: [
      ["Bays", "120"],
      ["Avg wait", "18 min"],
      ["Called to gate", "Every 2 min"],
      ["Slot booking", "Portnet · mandatory"],
    ],
    util: 0.7,
    utilLabel: "Bays occupied",
    fromGateKm: 0.5,
  },
  {
    id: "truck-stop",
    name: "Truck service station",
    short: "Fuel & service",
    kind: "service",
    group: "Customs & services",
    operator: "SPC",
    x: 366,
    z: -84,
    w: 40,
    d: 18,
    h: 7,
    summary: "Diesel, tire service and a driver rest area right on the terminal approach.",
    stats: [
      ["Pumps", "8 diesel · 2 LNG"],
      ["Trucks served today", "286"],
      ["Rest area", "48 beds"],
    ],
    util: 0.46,
    utilLabel: "Pumps busy",
    fromGateKm: 0.3,
  },
  {
    id: "seastar-dc",
    name: "Seastar Distribution Center",
    short: "Seastar DC",
    kind: "dc",
    group: "Warehousing",
    operator: "Seastar Logistics",
    x: 220,
    z: -196.5,
    w: 140,
    d: 66,
    h: 16,
    summary: "Regional cross-dock and e-commerce fulfillment center. Imports are broken down here and leave the same day on local trucks.",
    stats: [
      ["Dock doors", "28"],
      ["Floor area", "72,800 m²"],
      ["Orders shipped today", "18,420"],
      ["Cross-dock time", "5.2 h"],
      ["Rooftop solar", "2.4 MWp"],
    ],
    util: 0.83,
    utilLabel: "Racks in use",
    fromGateKm: 2.2,
  },
  {
    id: "mnr",
    name: "Container M&R Depot",
    short: "M&R depot",
    kind: "mnr",
    group: "Customs & services",
    operator: "Seastar Equipment",
    x: 385,
    z: -196.5,
    w: 90,
    d: 66,
    h: 10,
    summary: "Empty container depot with maintenance & repair, washing and reefer pre-trip inspections before boxes go back into service.",
    stats: [
      ["Empties stored", "2,940 TEU"],
      ["Repairs today", "38"],
      ["Reefer PTI", "22"],
      ["Wash bays", "4"],
    ],
    util: 0.61,
    utilLabel: "Depot fill",
    fromGateKm: 2.5,
  },
  {
    id: "electronics",
    name: "Merlion Microelectronics",
    short: "Semiconductor plant",
    kind: "factory",
    group: "Industry & energy",
    operator: "Merlion Microelectronics Pte Ltd",
    x: 20,
    z: -196.5,
    w: 64,
    d: 66,
    h: 13,
    summary: "Chip packaging and board assembly from imported components. A Seastar customer: inbound boxes arrive just-in-time from the terminal.",
    stats: [
      ["Shifts", "3 × 8 h"],
      ["Inbound boxes today", "14"],
      ["Outbound boxes", "9"],
      ["Line uptime", "97.8%"],
    ],
    util: 0.88,
    utilLabel: "Line utilization",
    fromGateKm: 2.4,
  },
  {
    id: "garments",
    name: "Straits Pharma",
    short: "Pharma plant",
    kind: "factory",
    group: "Industry & energy",
    operator: "Straits Pharma Pte Ltd",
    x: -62,
    z: -196.5,
    w: 56,
    d: 66,
    h: 12,
    summary: "Packs vaccines and active ingredients for export to Europe and the US in temperature-controlled 40' boxes.",
    stats: [
      ["Staff", "1,400"],
      ["Export boxes this week", "62"],
      ["Next cut-off", "SEASTAR 07 · 14:00"],
    ],
    util: 0.76,
    utilLabel: "Capacity used",
    fromGateKm: 2.6,
  },
  {
    id: "seafood",
    name: "Lion City Foods",
    short: "Food plant",
    kind: "factory",
    group: "Industry & energy",
    operator: "Lion City Foods Pte Ltd",
    x: -140,
    z: -196.5,
    w: 54,
    d: 66,
    h: 14,
    summary: "Frozen seafood and ready-meal plant. Output moves through the cold chain hub into reefer containers.",
    stats: [
      ["Raw intake today", "86 t"],
      ["Reefer boxes out", "11"],
      ["Freezer temp", "−28 °C"],
    ],
    util: 0.71,
    utilLabel: "Plant load",
    fromGateKm: 2.9,
  },
  {
    id: "steel",
    name: "Jurong Steel Works",
    short: "Steel mill",
    kind: "factory",
    group: "Industry & energy",
    operator: "Jurong Steel Pte Ltd",
    x: -228,
    z: -196.5,
    w: 82,
    d: 66,
    h: 30,
    summary: "Rolling mill producing coils and rebar. Heavy outbound flow by truck and barge; two stacks run around the clock.",
    stats: [
      ["Output today", "1,240 t"],
      ["Furnace", "Running · 1,580 °C"],
      ["Emissions", "Within permit"],
    ],
    util: 0.82,
    utilLabel: "Mill load",
    fromGateKm: 3.3,
  },
  {
    id: "grain",
    name: "Straits Flour Mills",
    short: "Flour mill",
    kind: "factory",
    group: "Industry & energy",
    operator: "Straits Flour Mills Pte Ltd",
    x: -312,
    z: -196.5,
    w: 50,
    d: 66,
    h: 30,
    summary: "Wheat silos and flour mill. Bagged flour is stuffed into containers for export across Southeast Asia.",
    stats: [
      ["Silos", "8 × 5,000 t"],
      ["Stored", "29,400 t"],
      ["Milling line", "Running"],
    ],
    util: 0.73,
    utilLabel: "Silo fill",
    fromGateKm: 3.6,
  },
  {
    id: "fuel",
    name: "Pasir Panjang Bunker Terminal",
    short: "Bunker terminal",
    kind: "fuel",
    group: "Industry & energy",
    operator: "Straits Bunkering",
    x: -310,
    z: -40,
    w: 100,
    d: 70,
    h: 16,
    summary: "Waterfront tank farm with its own jetty in the world's busiest bunkering port. Supplies marine fuel to bunker tankers and diesel to the truck fleet.",
    stats: [
      ["Tanks", "9 · 186,000 m³"],
      ["Jetty", "1 · up to 10,000 DWT"],
      ["Bunker tankers today", "6"],
      ["Truck loading bays", "6"],
    ],
    util: 0.57,
    utilLabel: "Tank fill",
    fromGateKm: 1.9,
  },
];

/** Cross streets linking the frontage road and the ring road (two lanes, 6 wide). */
export const CROSS_X = [-350, -102, 110];

export const facilityById = (id: string): Facility | undefined => FACILITIES.find((f) => f.id === id);

export const FACILITY_GROUPS: FacilityGroup[] = ["Intermodal", "Warehousing", "Customs & services", "Industry & energy"];
