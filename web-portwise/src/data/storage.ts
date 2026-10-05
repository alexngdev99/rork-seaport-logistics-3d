/**
 * Base quantities are the stock at the start of the replay buffer (sim t = MIN_T); cargo and zone bases
 * always sum to the same total.
 */
/** Storage profiles for the warehouses and storage sites in the logistics district (cargo on hand, capacity, zones). */

export interface CargoLine {
  id: string;
  label: string;
  detail: string;
  /** Quantity on hand at sim t = 0, in the profile's unit. */
  base: number;
  color: string;
  /** Overrides the profile's movement size and routes for this cargo. */
  lot?: [number, number];
  inVia?: string[];
  outVia?: string[];
}

export interface StorageZone {
  id: string;
  name: string;
  /** Setpoint, product or role shown under the name. */
  note?: string;
  capacity: number;
  base: number;
  /** Colours a tank/silo gauge with the cargo it holds. */
  cargoId?: string;
  /** Temperature setpoint (°C) for refrigerated chambers. */
  setC?: number;
  /** Cargo ids this zone is reserved for (otherwise any cargo can be put away here). */
  holds?: string[];
}

export interface StorageProfile {
  facilityId: string;
  /** racks = warehouse floor (capacity map of bays); tanks = tanks/silos drawn as fill gauges. */
  layout: "racks" | "tanks";
  unit: string;
  capacity: number;
  inPerHour: number;
  outPerHour: number;
  dwell: string;
  zoneLabel: string;
  /** Where the live count comes from. */
  source: string;
  /** Size range of one inbound/outbound movement, in the profile's unit. */
  lot: [number, number];
  inVia: string[];
  outVia: string[];
  cargo: CargoLine[];
  zones: StorageZone[];
}

const C = {
  signal: "#F2622E",
  navy: "#1E3A66",
  brick: "#B5463A",
  moss: "#4E7A5A",
  sand: "#D9B26A",
  steel: "#4F6D8F",
  harbor: "#2C6FB0",
  amber: "#E8A317",
  teal: "#3E9A8C",
  rose: "#D9867A",
  ice: "#8FB8D9",
  slate: "#8A93A3",
} as const;

export const STORAGE: StorageProfile[] = [
  {
    facilityId: "cfs",
    layout: "racks",
    unit: "pallets",
    capacity: 4200,
    inPerHour: 64,
    outPerHour: 58,
    dwell: "2.4 days",
    zoneLabel: "Zones",
    source: "WMS",
    lot: [10, 26],
    inVia: ["Import box TGHU 482117-3", "Import box SSLU 230984-6", "Import box MSKU 771502-0", "Truck XD4821K"],
    outVia: ["Export box SSLU 640218-2", "Truck XE7718C", "Truck XB4566Y"],
    cargo: [
      { id: "electronics", label: "Consumer electronics", detail: "LCL imports · Shenzhen, Busan", base: 820, color: C.navy },
      { id: "apparel", label: "Apparel & footwear", detail: "Vietnam, Bangladesh", base: 690, color: C.signal },
      { id: "auto", label: "Auto parts", detail: "Thailand, Japan", base: 540, color: C.steel },
      { id: "furniture", label: "Furniture & homeware", detail: "Malaysia · flat-pack", base: 470, color: C.sand },
      { id: "cosmetics", label: "Cosmetics & personal care", detail: "Korea · for consolidation", base: 410, color: C.rose },
      { id: "parcels", label: "E-commerce parcels", detail: "Export consolidation", base: 346, color: C.moss },
    ],
    zones: [
      { id: "strip", name: "Import stripping", note: "Doors 1–6", capacity: 1900, base: 1620 },
      { id: "consol", name: "Export consolidation", note: "Doors 7–12", capacity: 1900, base: 1330 },
      { id: "hold", name: "Hold & inspection", note: "Customs flagged", capacity: 400, base: 326 },
    ],
  },
  {
    facilityId: "bonded",
    layout: "racks",
    unit: "pallets",
    capacity: 9600,
    inPerHour: 46,
    outPerHour: 53,
    dwell: "11 days",
    zoneLabel: "Zones",
    source: "WMS · Customs ledger",
    lot: [8, 24],
    inVia: ["Truck XD3370W", "Import box SSLU 518220-4", "Truck XB1187N"],
    outVia: ["Re-export truck XE9024F", "Duty-paid release", "Transship box SSLU 902211-7"],
    cargo: [
      { id: "wine", label: "Wines & spirits", detail: "Duty and GST suspended", base: 1860, color: C.brick },
      { id: "machinery", label: "Machinery spare parts", detail: "Re-export to Indonesia", base: 1600, color: C.steel },
      { id: "semi", label: "Semiconductor equipment", detail: "Lithography and test tools", base: 1520, color: C.navy },
      { id: "fragrance", label: "Cosmetics & fragrance", detail: "Regional hub stock", base: 1140, color: C.rose },
      { id: "tobacco", label: "Cigarettes & tobacco", detail: "Excise bonded", base: 640, color: C.sand },
      { id: "luxury", label: "Watches & jewellery", detail: "High-value cage", base: 380, color: C.amber },
    ],
    zones: [
      { id: "a", name: "Bonded racks A", note: "Ambient", capacity: 4800, base: 3720 },
      { id: "b", name: "Bonded racks B", note: "Ambient", capacity: 3600, base: 2640 },
      { id: "cage", holds: ["luxury"], name: "High-value cage", note: "CCTV · dual key", capacity: 400, base: 380 },
      { id: "hold", name: "Customs hold", note: "Pending release", capacity: 800, base: 400 },
    ],
  },
  {
    facilityId: "cold-hub",
    layout: "racks",
    unit: "pallets",
    capacity: 5600,
    inPerHour: 38,
    outPerHour: 31,
    dwell: "6.8 days",
    zoneLabel: "Chambers",
    source: "WMS · temp loggers",
    lot: [12, 22],
    inVia: ["Reefer SSLU 811402-9", "Reefer TRIU 506118-2", "Reefer SZLU 900314-5"],
    outVia: ["Truck XD6041B · NTUC", "Truck XE3150A · Sheng Siong", "Truck XB7702L · hospitals"],
    cargo: [
      { id: "seafood", label: "Frozen seafood", detail: "Norway, Indonesia · −25 °C", base: 1240, color: C.harbor },
      { id: "beef", label: "Australian beef & lamb", detail: "Frozen · −22 °C", base: 920, color: C.brick },
      { id: "fruit", label: "Fresh fruit", detail: "Australia, South Africa · +2 °C", base: 760, color: C.moss },
      { id: "dairy", label: "Dairy & chilled", detail: "New Zealand · +4 °C", base: 480, color: C.sand },
      { id: "dessert", label: "Ice cream & desserts", detail: "Frozen · −25 °C", base: 300, color: C.ice },
      { id: "vaccines", label: "Vaccines & biologics", detail: "GDP pharma · +2 to +8 °C", base: 180, color: C.signal },
    ],
    zones: [
      { id: "c1", holds: ["seafood", "dessert"], setC: -25, name: "Chamber 1", note: "Deep freeze · −25 °C", capacity: 1200, base: 820 },
      { id: "c2", holds: ["seafood", "dessert"], setC: -25, name: "Chamber 2", note: "Deep freeze · −25 °C", capacity: 1200, base: 720 },
      { id: "c3", holds: ["beef"], setC: -22, name: "Chamber 3", note: "Frozen · −22 °C", capacity: 1000, base: 920 },
      { id: "c4", holds: ["fruit"], setC: 2, name: "Chamber 4", note: "Chilled · +2 °C", capacity: 900, base: 760 },
      { id: "c5", holds: ["dairy"], setC: 4, name: "Chamber 5", note: "Chilled · +4 °C", capacity: 900, base: 480 },
      { id: "c6", holds: ["vaccines"], setC: 5, name: "Chamber 6", note: "Pharma · +2 to +8 °C", capacity: 400, base: 180 },
    ],
  },
  {
    facilityId: "seastar-dc",
    layout: "racks",
    unit: "pallet spaces",
    capacity: 48000,
    inPerHour: 420,
    outPerHour: 455,
    dwell: "4.1 days",
    zoneLabel: "Zones",
    source: "WMS",
    lot: [40, 140],
    inVia: ["Import box SSLU 334871-0", "Import box SSLU 129904-3", "Truck XD9915R"],
    outVia: ["Van fleet · wave 14", "Truck XE2281M", "Truck XB6620T"],
    cargo: [
      { id: "ecom", label: "E-commerce fulfilment", detail: "Lazada, Shopee sellers", base: 12600, color: C.signal },
      { id: "electronics", label: "Consumer electronics", detail: "Phones, laptops, accessories", base: 8200, color: C.navy },
      { id: "fmcg", label: "FMCG & groceries", detail: "Supermarket replenishment", base: 7400, color: C.moss },
      { id: "home", label: "Home & furniture", detail: "Bulky goods", base: 5100, color: C.sand },
      { id: "beauty", label: "Health & beauty", detail: "Pharmacy chains", base: 3900, color: C.rose },
      { id: "returns", label: "Returns", detail: "Reverse logistics · grading", base: 2640, color: C.slate },
    ],
    zones: [
      { id: "highbay", name: "High-bay racks", note: "12 m · VNA trucks", capacity: 30000, base: 25800 },
      { id: "pick", name: "Pick-face mezzanine", note: "Each picking", capacity: 10000, base: 8240 },
      { id: "xdock", name: "Cross-dock floor", note: "Same-day out", capacity: 6000, base: 4620 },
      { id: "returns", name: "Returns cage", note: "Grading", capacity: 2000, base: 1180 },
    ],
  },
  {
    facilityId: "mnr",
    layout: "racks",
    unit: "TEU",
    capacity: 4880,
    inPerHour: 34,
    outPerHour: 41,
    dwell: "5.6 days",
    zoneLabel: "Areas",
    source: "Depot system",
    lot: [1, 2],
    inVia: ["Empty return XD4821K", "Empty return XE7718C", "Damaged box via Gate A"],
    outVia: ["Empty release · SEASTAR 07", "Empty release · export stuffing", "Reefer PTI passed"],
    cargo: [
      { id: "hc40", label: "40' high cube dry", detail: "Empty · sound", base: 1280, color: C.signal },
      { id: "dry20", label: "20' dry", detail: "Empty · sound", base: 760, color: C.navy },
      { id: "reefer", label: "40' reefer", detail: "Awaiting pre-trip inspection", base: 420, color: "#C9C5BA" },
      { id: "damaged", label: "Damaged", detail: "Awaiting repair", base: 290, color: C.brick },
      { id: "special", label: "Flat rack & open top", detail: "Out-of-gauge cargo", base: 110, color: C.moss },
      { id: "tank", label: "Tank containers", detail: "Cleaned · ISO tanks", base: 80, color: C.steel },
    ],
    zones: [
      { id: "a", name: "Empty stack A", note: "Reach stackers · 6 high", capacity: 2400, base: 1400 },
      { id: "b", name: "Empty stack B", note: "Reach stackers · 6 high", capacity: 1600, base: 830 },
      { id: "pti", holds: ["reefer"], name: "Reefer PTI row", note: "Plugged in", capacity: 480, base: 420 },
      { id: "shop", holds: ["damaged"], name: "Repair shop", note: "Welding · painting", capacity: 400, base: 290 },
    ],
  },
  {
    facilityId: "grain",
    layout: "tanks",
    unit: "t",
    capacity: 40000,
    inPerHour: 60,
    outPerHour: 105,
    dwell: "18 days",
    zoneLabel: "Silos",
    source: "Silo level radar",
    lot: [26, 34],
    inVia: ["Bulk truck XD5520G · wheat", "Bulk truck XE4108H · wheat"],
    outVia: ["Flour truck XB8813K", "Box stuffing · 40 bags", "Feed truck XD2097P"],
    cargo: [
      { id: "aphw", label: "Australian hard wheat", detail: "Bread flour", base: 12800, color: C.sand },
      { id: "cwrs", label: "Canadian western red spring", detail: "High protein", base: 7600, color: C.brick },
      { id: "usw", label: "US soft white wheat", detail: "Noodles & cakes", base: 4200, color: "#E6D3A3" },
      { id: "flour", label: "Bagged flour", detail: "Export · 25 kg bags", base: 3100, color: C.signal },
      { id: "bran", label: "Bran & by-products", detail: "Animal feed", base: 1700, color: C.moss },
    ],
    zones: [
      { id: "s1", name: "S1", note: "Hard wheat", capacity: 5000, base: 4900, cargoId: "aphw" },
      { id: "s2", name: "S2", note: "Hard wheat", capacity: 5000, base: 4650, cargoId: "aphw" },
      { id: "s3", name: "S3", note: "Hard wheat", capacity: 5000, base: 3250, cargoId: "aphw" },
      { id: "s4", name: "S4", note: "CWRS", capacity: 5000, base: 3950, cargoId: "cwrs" },
      { id: "s5", name: "S5", note: "CWRS", capacity: 5000, base: 3650, cargoId: "cwrs" },
      { id: "s6", name: "S6", note: "Soft white", capacity: 5000, base: 4200, cargoId: "usw" },
      { id: "s7", name: "S7", note: "Flour", capacity: 5000, base: 3100, cargoId: "flour" },
      { id: "s8", name: "S8", note: "Bran", capacity: 5000, base: 1700, cargoId: "bran" },
    ],
  },
  {
    facilityId: "fuel",
    layout: "tanks",
    unit: "m³",
    capacity: 186000,
    inPerHour: 900,
    outPerHour: 1150,
    dwell: "9 days",
    zoneLabel: "Tanks",
    source: "Radar tank gauging",
    lot: [300, 900],
    inVia: ["Pipeline from Jurong Island", "Coastal tanker discharge"],
    outVia: ["Bunker tanker STRAITS SPIRIT", "Bunker tanker via jetty"],
    cargo: [
      { id: "vlsfo", label: "VLSFO 0.5% S", detail: "Very low sulphur marine fuel", base: 52400, color: C.navy },
      { id: "hsfo", label: "HSFO 3.5% S", detail: "For ships with scrubbers", base: 21800, color: "#3B3F4A" },
      { id: "mgo", label: "Marine gasoil", detail: "MGO · DMA grade", base: 18600, color: C.amber },
      { id: "diesel", label: "Road diesel", detail: "Truck fleet · loading bays", base: 7020, color: C.steel, lot: [28, 38], inVia: ["Pipeline from Jurong Island"], outVia: ["Diesel truck · bay 3", "Diesel truck · bay 5", "Diesel truck · bay 6"] },
      { id: "b24", label: "B24 biofuel blend", detail: "24% FAME · MPA pilot", base: 6200, color: C.moss },
    ],
    zones: [
      { id: "t1", name: "T1", note: "VLSFO", capacity: 30000, base: 26100, cargoId: "vlsfo" },
      { id: "t2", name: "T2", note: "VLSFO", capacity: 30000, base: 26300, cargoId: "vlsfo" },
      { id: "t3", name: "T3", note: "HSFO", capacity: 30000, base: 21800, cargoId: "hsfo" },
      { id: "t4", name: "T4", note: "MGO", capacity: 24000, base: 12400, cargoId: "mgo" },
      { id: "t5", name: "T5", note: "MGO", capacity: 18000, base: 6200, cargoId: "mgo" },
      { id: "t6", name: "T6", note: "B24", capacity: 18000, base: 6200, cargoId: "b24" },
      { id: "t7", name: "T7", note: "Diesel", capacity: 18000, base: 7020, cargoId: "diesel" },
      { id: "t8", name: "T8", note: "Cleaning", capacity: 9000, base: 0 },
      { id: "t9", name: "T9", note: "Slops", capacity: 9000, base: 0 },
    ],
  },
];

export const storageProfile = (facilityId: string): StorageProfile | undefined => STORAGE.find((s) => s.facilityId === facilityId);
