import type { Alert, BerthBooking, QuayCrane, RoutePoint, Truck, Vessel, YardBlock } from "./types";
import { BLOCK_COL_X, BLOCK_ROW_Z, GATE_X } from "./layout";
import { AVE_N, AVE_S } from "./facilities";
import { DRAYAGE_TRUCKS } from "./drayage";

export const PORT_NAME = "Pasir Panjang Terminal";
/** Port authority / city shown alongside the terminal name. */
export const PORT_CITY = "Port of Singapore";
export const BERTH_COUNT = 8;
export const CARRIER_NAME = "Seastar Lines";

export const VESSELS: Vessel[] = [
  {
    id: "seastar-07",
    name: "MV SEASTAR 07",
    short: "SEASTAR 07",
    imo: "9784512",
    line: "Seastar Lines",
    flag: "Singapore",
    voyage: "SS07-2441N",
    from: "Shanghai",
    to: "Port Klang",
    berth: 2,
    status: "discharging",
    dischargeTotal: 1310,
    discharged: 812,
    loadTotal: 940,
    loaded: 0,
    eta: "05:40",
    etb: "06:15",
    etd: "21:30",
    cranes: ["STS-02", "STS-03", "STS-04"],
    hull: "#1E3A66",
    length: 42,
    inScene: true,
  },
  {
    id: "merlion-star",
    name: "MV MERLION STAR",
    short: "MERLION STAR",
    imo: "9652207",
    line: "Seastar Lines",
    flag: "Singapore",
    voyage: "MK11-2440S",
    from: "Laem Chabang",
    to: "Kaohsiung",
    berth: 1,
    status: "loading",
    dischargeTotal: 620,
    discharged: 620,
    loadTotal: 580,
    loaded: 580,
    eta: "00:20",
    etb: "01:00",
    etd: "09:51",
    cranes: ["STS-01"],
    hull: "#2F5D4E",
    length: 34,
    inScene: true,
  },
  {
    id: "orient-lotus",
    name: "MV ORIENT LOTUS",
    short: "ORIENT LOTUS",
    imo: "9810344",
    line: "Orient Pacific",
    flag: "Panama",
    voyage: "OL03-2442W",
    from: "Hong Kong",
    to: "Jakarta",
    berth: 3,
    status: "arriving",
    dischargeTotal: 980,
    discharged: 0,
    loadTotal: 760,
    loaded: 0,
    eta: "08:45",
    etb: "09:50",
    etd: "23:40",
    cranes: ["STS-05"],
    hull: "#B5463A",
    length: 38,
    inScene: true,
    delayMin: 40,
  },
  {
    id: "jade-river",
    name: "MV JADE RIVER",
    short: "JADE RIVER",
    imo: "9725590",
    line: "Seastar Lines",
    flag: "Singapore",
    voyage: "JR04-2441S",
    from: "Ho Chi Minh",
    to: "Manila",
    berth: 5,
    status: "loading",
    dischargeTotal: 450,
    discharged: 450,
    loadTotal: 820,
    loaded: 388,
    eta: "03:10",
    etb: "03:45",
    etd: "14:00",
    cranes: ["STS-07", "STS-08"],
    hull: "#2C6FB0",
    length: 40,
    inScene: true,
  },
  {
    id: "pacific-harmony",
    name: "MV PACIFIC HARMONY",
    short: "PACIFIC HARMONY",
    imo: "9690212",
    line: "Asia Link",
    flag: "Singapore",
    voyage: "PH22-2441N",
    from: "Port Klang",
    to: "Busan",
    berth: 6,
    status: "discharging",
    dischargeTotal: 1140,
    discharged: 356,
    loadTotal: 900,
    loaded: 0,
    eta: "07:30",
    etb: "08:05",
    etd: "23:15",
    cranes: ["STS-09", "STS-10"],
    hull: "#4F6D8F",
    length: 42,
    inScene: true,
  },
  {
    id: "coral-bay",
    name: "MV CORAL BAY",
    short: "CORAL BAY",
    imo: "9758830",
    line: "Orient Pacific",
    flag: "Hong Kong",
    voyage: "CB09-2440E",
    from: "Shenzhen",
    to: "Bangkok",
    berth: 7,
    status: "discharging",
    dischargeTotal: 960,
    discharged: 702,
    loadTotal: 640,
    loaded: 0,
    eta: "02:00",
    etb: "02:40",
    etd: "16:20",
    cranes: ["STS-11", "STS-12"],
    hull: "#8A3B34",
    length: 38,
    inScene: true,
  },
  {
    id: "nordic-spirit",
    name: "MV NORDIC SPIRIT",
    short: "NORDIC SPIRIT",
    imo: "9601178",
    line: "Seastar Lines",
    flag: "Singapore",
    voyage: "NS15-2441W",
    from: "Tanjung Pelepas",
    to: "Colombo",
    berth: 8,
    status: "loading",
    dischargeTotal: 300,
    discharged: 300,
    loadTotal: 1020,
    loaded: 271,
    eta: "06:40",
    etb: "07:10",
    etd: "20:45",
    cranes: ["STS-13", "STS-14"],
    hull: "#1E3A66",
    length: 40,
    inScene: true,
  },
  {
    id: "blue-marlin",
    name: "MV BLUE MARLIN",
    short: "BLUE MARLIN",
    imo: "9533018",
    line: "Seastar Lines",
    flag: "Singapore",
    voyage: "BM08-2441N",
    from: "Bangkok",
    to: "Busan",
    berth: 1,
    status: "scheduled",
    dischargeTotal: 540,
    discharged: 0,
    loadTotal: 610,
    loaded: 0,
    eta: "09:53",
    etb: "13:30",
    etd: "22:00",
    cranes: ["STS-01"],
    hull: "#1E3A66",
    length: 32,
    inScene: true,
  },
  {
    id: "jakarta-express",
    name: "MV JAKARTA EXPRESS",
    short: "JAKARTA EXP.",
    imo: "9701425",
    line: "Seastar Lines",
    flag: "Singapore",
    voyage: "HP02-2441N",
    from: "Surabaya",
    to: "Jakarta",
    berth: 4,
    status: "scheduled",
    dischargeTotal: 420,
    discharged: 0,
    loadTotal: 380,
    loaded: 0,
    eta: "15:10",
    etb: "15:30",
    etd: "23:59",
    cranes: ["STS-06"],
    hull: "#1E3A66",
    length: 30,
    inScene: false,
  },
  {
    id: "asian-dawn",
    name: "MV ASIAN DAWN",
    short: "ASIAN DAWN",
    imo: "9466731",
    line: "Asia Link",
    flag: "Singapore",
    voyage: "AD15-2442E",
    from: "Port Klang",
    to: "Shanghai",
    berth: 5,
    status: "scheduled",
    dischargeTotal: 860,
    discharged: 0,
    loadTotal: 720,
    loaded: 0,
    eta: "19:50",
    etb: "20:10",
    etd: "08:00 (+1)",
    cranes: [],
    hull: "#4F6D8F",
    length: 38,
    inScene: false,
  },
];

export const vesselById = (id: string): Vessel | undefined => VESSELS.find((v) => v.id === id);

export const BERTH_SCHEDULE: BerthBooking[] = [
  { berth: 1, label: "MERLION STAR", vesselId: "merlion-star", start: 1, end: 9.85, kind: "active" },
  { berth: 1, label: "BLUE MARLIN", vesselId: "blue-marlin", start: 13.5, end: 22, kind: "planned" },
  { berth: 2, label: "SEASTAR 07", vesselId: "seastar-07", start: 6.25, end: 21.5, kind: "active" },
  { berth: 3, label: "ORIENT LOTUS", vesselId: "orient-lotus", start: 9.83, end: 23.67, kind: "late", plannedStart: 9.17 },
  { berth: 3, label: "WAN HAI 316", start: 0, end: 4.5, kind: "done" },
  { berth: 4, label: "Fender repair", start: 8, end: 13, kind: "maintenance" },
  { berth: 4, label: "KOTA LAYANG", start: 0, end: 7.2, kind: "done" },
  { berth: 4, label: "JAKARTA EXP.", vesselId: "jakarta-express", start: 15.5, end: 24, kind: "planned" },
  { berth: 5, label: "JADE RIVER", vesselId: "jade-river", start: 3.75, end: 14, kind: "active" },
  { berth: 5, label: "ASIAN DAWN", vesselId: "asian-dawn", start: 20.17, end: 24, kind: "planned" },
  { berth: 6, label: "PACIFIC HARMONY", vesselId: "pacific-harmony", start: 8.08, end: 23.25, kind: "active" },
  { berth: 6, label: "SITC HAKATA", start: 0, end: 6.5, kind: "done" },
  { berth: 7, label: "CORAL BAY", vesselId: "coral-bay", start: 2.67, end: 16.33, kind: "active" },
  { berth: 7, label: "EVER GLORY", start: 18, end: 24, kind: "planned" },
  { berth: 8, label: "NORDIC SPIRIT", vesselId: "nordic-spirit", start: 7.17, end: 20.75, kind: "active" },
];

export const QUAY_CRANES: QuayCrane[] = [
  { id: "STS-01", x: -175, berth: 1, vesselId: "merlion-star", mode: "load", movesPerHour: 29, movesToday: 236, model: "ZPMC 65t", operator: "Ahmad Rahman" },
  { id: "STS-02", x: -137, berth: 2, vesselId: "seastar-07", mode: "discharge", movesPerHour: 32, movesToday: 198, model: "ZPMC 65t", operator: "Tan Wei Ming" },
  { id: "STS-03", x: -125, berth: 2, vesselId: "seastar-07", mode: "discharge", movesPerHour: 34, movesToday: 214, model: "Liebherr STS 70t", operator: "Priya Nair" },
  { id: "STS-04", x: -113, berth: 2, vesselId: "seastar-07", mode: "paused", movesPerHour: 0, movesToday: 88, model: "ZPMC 65t", operator: "Lim Jun Hao", reason: "Squall stop" },
  { id: "STS-05", x: -75, berth: 3, vesselId: "orient-lotus", mode: "idle", movesPerHour: 0, movesToday: 0, model: "Liebherr STS 70t", operator: "Hafiz Ismail", reason: "Awaiting vessel" },
  { id: "STS-06", x: -25, berth: 4, mode: "idle", movesPerHour: 0, movesToday: 64, model: "ZPMC 65t", operator: "Chen Jia Hui", reason: "Berth maintenance" },
  { id: "STS-07", x: 19, berth: 5, vesselId: "jade-river", mode: "load", movesPerHour: 30, movesToday: 221, model: "ZPMC 65t", operator: "Muthu Raman" },
  { id: "STS-08", x: 31, berth: 5, vesselId: "jade-river", mode: "load", movesPerHour: 27, movesToday: 190, model: "Konecranes 60t", operator: "Ong Kai Wen" },
  { id: "STS-09", x: 69, berth: 6, vesselId: "pacific-harmony", mode: "discharge", movesPerHour: 33, movesToday: 142, model: "Liebherr STS 70t", operator: "Siti Aminah" },
  { id: "STS-10", x: 81, berth: 6, vesselId: "pacific-harmony", mode: "discharge", movesPerHour: 31, movesToday: 128, model: "ZPMC 65t", operator: "Goh Boon Keat" },
  { id: "STS-11", x: 119, berth: 7, vesselId: "coral-bay", mode: "discharge", movesPerHour: 30, movesToday: 245, model: "ZPMC 65t", operator: "Ravi Kumar" },
  { id: "STS-12", x: 131, berth: 7, vesselId: "coral-bay", mode: "discharge", movesPerHour: 28, movesToday: 231, model: "Konecranes 60t", operator: "Ng Li Ting" },
  { id: "STS-13", x: 169, berth: 8, vesselId: "nordic-spirit", mode: "load", movesPerHour: 29, movesToday: 117, model: "Liebherr STS 70t", operator: "Faizal Osman" },
  { id: "STS-14", x: 181, berth: 8, vesselId: "nordic-spirit", mode: "load", movesPerHour: 26, movesToday: 104, model: "ZPMC 65t", operator: "Teo Shu Min" },
];

export const craneById = (id: string): QuayCrane | undefined => QUAY_CRANES.find((c) => c.id === id);

type Cat = YardBlock["category"];
const ROW_DEFS: Record<string, Array<[Cat, number]>> = {
  A: [["export", 0.81], ["export", 0.66], ["import", 0.58], ["export", 0.73], ["import", 0.62], ["export", 0.78], ["export", 0.69], ["import", 0.54], ["export", 0.71], ["export", 0.84]],
  B: [["import", 0.68], ["import", 0.74], ["import", 0.77], ["export", 0.55], ["import", 0.92], ["import", 0.63], ["export", 0.6], ["import", 0.71], ["import", 0.8], ["export", 0.5]],
  C: [["import", 0.47], ["import", 0.83], ["export", 0.52], ["import", 0.86], ["export", 0.44], ["import", 0.59], ["import", 0.76], ["export", 0.65], ["import", 0.7], ["reefer", 0.61]],
  D: [["import", 0.42], ["export", 0.57], ["import", 0.64], ["reefer", 0.72], ["reefer", 0.55], ["export", 0.49], ["import", 0.67], ["export", 0.58], ["reefer", 0.66], ["reefer", 0.79]],
};

export const YARD_BLOCKS: YardBlock[] = Object.entries(ROW_DEFS).flatMap(([row, defs]) =>
  defs.map(([category, fill], col) => ({ id: `${row}${col + 1}`, category, fill, capacity: 1600, x: BLOCK_COL_X[col], z: BLOCK_ROW_Z[row] })),
);

export const blockById = (id: string): YardBlock | undefined => YARD_BLOCKS.find((b) => b.id === id);

export const CATEGORY_LABEL: Record<YardBlock["category"], string> = {
  import: "Import",
  export: "Export",
  reefer: "Reefer",
};

export const ALERTS: Alert[] = [
  {
    id: "al-wind",
    severity: "danger",
    title: "Sumatra squall 14 m/s – STS-04 stopped",
    detail: "A Sumatra squall is crossing the Strait with gusts above the 13 m/s safety limit. STS-04 has raised its boom and is waiting for the wind to drop.",
    time: "09:32",
    target: { kind: "crane", id: "STS-04" },
  },
  {
    id: "al-gate",
    severity: "warning",
    title: "Gate B congestion · 18 min wait",
    detail: "3 trucks queued in the Gate B inbound lane. Suggest diverting to Gate A.",
    time: "09:18",
    target: { kind: "truck", id: "XD3390H" },
  },
  {
    id: "al-late",
    severity: "danger",
    title: "MV ORIENT LOTUS running 40 min late",
    detail: "Vessel is waiting at the Western Anchorage, new ETB 09:50. Berth 3 and STS-05 are standing by.",
    time: "08:50",
    target: { kind: "vessel", id: "orient-lotus" },
  },
  {
    id: "al-block",
    severity: "warning",
    title: "Block B5 nearly full · 92%",
    detail: "Suggest routing SEASTAR 07 import boxes to block C1.",
    time: "08:31",
    target: { kind: "block", id: "B5" },
  },
  {
    id: "al-maint",
    severity: "info",
    title: "Berth 4 fender repair until 13:00",
    detail: "STS-06 parked. JAKARTA EXPRESS keeps its 15:30 berthing window.",
    time: "08:05",
    target: { kind: "crane", id: "STS-06" },
  },
  {
    id: "al-merlion",
    severity: "success",
    title: "MERLION STAR discharge complete",
    detail: "620/620 TEU discharged. Loading exports, expected to sail 09:51.",
    time: "07:55",
    target: { kind: "vessel", id: "merlion-star" },
  },
];

const IN_LANE_X = 174;
const OUT_LANE_X = 179;

interface ExternalSpec {
  gate: "A" | "B";
  blockX: number;
  rowZ: number;
  load: boolean;
  queue?: number;
  queueX?: number;
}

/** Staging area → port avenue → gate → spine → yard lane → block → back out under the expressway. */
function externalRoute({ gate, blockX, rowZ, load, queue, queueX = 224 }: ExternalSpec): RoutePoint[] {
  const inZ = gate === "A" ? -3 : -15;
  const outZ = gate === "A" ? -8 : -20;
  const returnZ = rowZ === -49 ? -35 : rowZ - 14;
  const sideX = blockX - 16;
  const startStatus = queue ? "Queued" : "Called from staging";
  const route: RoutePoint[] = [
    { p: [AVE_S + 8, -124], hidden: true, load: !load, status: startStatus },
    { p: [AVE_S, -124] },
    { p: [AVE_S, inZ], status: queue ? "Queued" : "Arriving" },
  ];
  if (queue) route.push({ p: [queueX, inZ], wait: queue, status: "Queued" });
  else route.push({ p: [GATE_X + 34, inZ], status: "Arriving" });
  route.push(
    { p: [GATE_X, inZ], wait: 3, status: "Entering" },
    { p: [IN_LANE_X, inZ], status: "Entering" },
    { p: [IN_LANE_X, rowZ] },
    { p: [blockX, rowZ], wait: 7, load, status: "Handling" },
    { p: [sideX, rowZ], status: "Exiting" },
    { p: [sideX, returnZ] },
    { p: [OUT_LANE_X, returnZ] },
    { p: [OUT_LANE_X, outZ] },
    { p: [GATE_X, outZ], wait: 3, status: "Exiting" },
    { p: [AVE_N, outZ], status: "Departed" },
    { p: [AVE_N, -104], status: "Departed" },
  );
  return route;
}

interface ItvSpec {
  craneId: string;
  blockId: string;
  loading: boolean;
}

/** Quay crane ⇄ yard block shuttle along the apron and yard lanes. */
function itvRoute({ craneId, blockId, loading }: ItvSpec): RoutePoint[] {
  const crane = craneById(craneId);
  const block = blockById(blockId);
  if (!crane || !block) return [{ p: [0, 8] }, { p: [10, 8] }];
  const cx = crane.x;
  const bx = block.x;
  const rowZ = block.z - 7;
  const near = cx < bx ? bx - 16 : bx + 16;
  const far = cx < bx ? bx + 16 : bx - 16;
  if (!loading) {
    return [
      { p: [cx, 15], wait: 7, load: true, status: `Loading at ${craneId}` },
      { p: [near, 15], status: "To yard" },
      { p: [near, rowZ] },
      { p: [bx, rowZ], wait: 6, load: false, status: `Grounding at ${blockId}` },
      { p: [far, rowZ], status: "Back to crane" },
      { p: [far, 8] },
      { p: [cx, 8] },
    ];
  }
  return [
    { p: [bx, rowZ], wait: 6, load: true, status: `Picking at ${blockId}` },
    { p: [far, rowZ], status: `To ${craneId}` },
    { p: [far, 8] },
    { p: [cx, 8] },
    { p: [cx, 15], wait: 7, load: false, status: `Delivering to ${craneId}` },
    { p: [near, 15], status: "Back to yard" },
    { p: [near, rowZ] },
  ];
}

const bx = (id: string): number => blockById(id)?.x ?? 0;

export const TRUCKS: Truck[] = [
  {
    id: "XD4821K",
    plate: "XD4821K",
    carrier: "Seastar Logistics",
    kind: "external",
    cab: "#F6F3EC",
    gate: "Gate B",
    driver: "Rizal Hamid",
    containerColor: "#F2622E",
    speed: 9,
    offset: 40,
    shipmentId: "SHP-20931",
    baseWait: 3,
    route: externalRoute({ gate: "B", blockX: bx("B5"), rowZ: -7, load: true }),
  },
  {
    id: "XE1204M",
    plate: "XE1204M",
    carrier: "Straits Haulage",
    kind: "external",
    cab: "#2C6FB0",
    gate: "Gate A",
    driver: "Koh Wee Liang",
    containerColor: "#1E3A66",
    speed: 9,
    offset: 10,
    baseWait: 1,
    route: externalRoute({ gate: "A", blockX: bx("B7"), rowZ: -21, load: false }),
  },
  {
    id: "XD3390H",
    plate: "XD3390H",
    carrier: "Maersk",
    kind: "external",
    cab: "#4F6D8F",
    gate: "Gate B",
    driver: "Suresh Pillai",
    containerColor: "#4F6D8F",
    speed: 8.5,
    offset: 0,
    baseWait: 18,
    route: externalRoute({ gate: "B", blockX: bx("C5"), rowZ: -35, load: false, queue: 26, queueX: 216 }),
  },
  {
    id: "XB7715S",
    plate: "XB7715S",
    carrier: "Hapag-Lloyd",
    kind: "external",
    cab: "#F6F3EC",
    gate: "Gate A",
    driver: "Lee Mei Ling",
    containerColor: "#B5463A",
    speed: 9,
    offset: 38,
    baseWait: 2,
    route: externalRoute({ gate: "A", blockX: bx("A9"), rowZ: -7, load: false }),
  },
  {
    id: "XE4531P",
    plate: "XE4531P",
    carrier: "Evergreen",
    kind: "external",
    cab: "#4E7A5A",
    gate: "Gate B",
    driver: "Azman Yusof",
    containerColor: "#4E7A5A",
    speed: 8.5,
    offset: 22,
    baseWait: 11,
    route: externalRoute({ gate: "B", blockX: bx("D8"), rowZ: -49, load: false, queue: 22, queueX: 226 }),
  },
  {
    id: "XD9076T",
    plate: "XD9076T",
    carrier: "Seastar Logistics",
    kind: "external",
    cab: "#F2622E",
    gate: "Gate A",
    driver: "Wong Chee Keong",
    containerColor: "#D9B26A",
    speed: 9,
    offset: 64,
    baseWait: 4,
    route: externalRoute({ gate: "A", blockX: bx("B3"), rowZ: -21, load: true }),
  },
  {
    id: "XB2140G",
    plate: "XB2140G",
    carrier: "CMA CGM",
    kind: "external",
    cab: "#1E3A66",
    gate: "Gate A",
    driver: "Vijay Menon",
    containerColor: "#1E3A66",
    speed: 9,
    offset: 92,
    baseWait: 2,
    route: externalRoute({ gate: "A", blockX: bx("C4"), rowZ: -35, load: true }),
  },
  {
    id: "XE3882J",
    plate: "XE3882J",
    carrier: "ONE",
    kind: "external",
    cab: "#F6F3EC",
    gate: "Gate B",
    driver: "Chua Hui Min",
    containerColor: "#EDEBE4",
    speed: 9,
    offset: 120,
    baseWait: 5,
    route: externalRoute({ gate: "B", blockX: bx("D9"), rowZ: -49, load: true }),
  },
];

const ITV_SPECS: Array<[string, string, string, boolean, number]> = [
  ["ITV-07", "STS-02", "B1", false, 0],
  ["ITV-12", "STS-03", "C2", false, 9],
  ["ITV-15", "STS-01", "A1", true, 4],
  ["ITV-21", "STS-07", "A6", true, 15],
  ["ITV-24", "STS-08", "A7", true, 3],
  ["ITV-28", "STS-09", "B8", false, 11],
  ["ITV-30", "STS-10", "C7", false, 6],
  ["ITV-33", "STS-11", "B9", false, 2],
  ["ITV-36", "STS-12", "C9", false, 13],
  ["ITV-41", "STS-13", "A10", true, 8],
  ["ITV-44", "STS-14", "A9", true, 17],
];

const ITV_DRIVERS = ["Luc Ngo", "Ravi Kumar", "Vinh Dinh", "Truong Mai", "Hai Lam", "Kiet Vo", "Nhan Ho", "Tin Le", "Bao Ha", "Thinh Ly", "An Trinh"];
const ITV_BOXES = ["#F2622E", "#1E3A66", "#D9B26A", "#4E7A5A", "#B5463A", "#4F6D8F"];

TRUCKS.push(
  ...ITV_SPECS.map(([id, craneId, blockId, loading, offset], i): Truck => ({
    id,
    plate: id,
    carrier: "Pasir Panjang terminal fleet",
    kind: "itv",
    cab: "#E8A317",
    driver: ITV_DRIVERS[i % ITV_DRIVERS.length],
    containerColor: ITV_BOXES[i % ITV_BOXES.length],
    speed: 10,
    offset,
    route: itvRoute({ craneId, blockId, loading }),
  })),
);

TRUCKS.push(...DRAYAGE_TRUCKS);

export const truckById = (id: string): Truck | undefined => TRUCKS.find((t) => t.id === id);

export const GATE_TRUCK_IDS = TRUCKS.filter((t) => t.kind === "external").map((t) => t.id);
