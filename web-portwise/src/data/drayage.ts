import type { RoutePoint, Truck } from "./types";
import { GATE_X } from "./layout";
import { AVE_N, AVE_S, FRONT_E, FRONT_W, RING_E, RING_W, facilityById } from "./facilities";

/** Gate A lanes used by drayage: out of the terminal on z = −8, back in on z = −3. */
const OUT_Z = -8;
const IN_Z = -3;

interface DraySpec {
  plate: string;
  carrier: string;
  driver: string;
  facility: string;
  dockX: number;
  dockZ: number;
  /** true = delivers a box to the facility; false = collects an export box there. */
  delivers: boolean;
  cab: string;
  box: string;
  offset: number;
}

/** Terminal gate → port avenue → frontage or ring road → facility dock → back through Gate A. */
function drayRoute(s: DraySpec): RoutePoint[] {
  const f = facilityById(s.facility);
  const name = f?.short ?? s.facility;
  const front = s.dockZ > -150;
  const east = s.dockX > AVE_N;
  const goZ = front ? FRONT_W : east ? RING_E : RING_W;
  const backZ = front ? FRONT_E : east ? RING_W : RING_E;
  return [
    { p: [GATE_X, OUT_Z], hidden: true, load: s.delivers, status: `To ${name}` },
    { p: [GATE_X + 8, OUT_Z] },
    { p: [AVE_N, OUT_Z] },
    { p: [AVE_N, goZ] },
    { p: [s.dockX, goZ] },
    { p: [s.dockX, s.dockZ], wait: 14, load: !s.delivers, status: s.delivers ? `Unloading at ${name}` : `Loading at ${name}` },
    { p: [s.dockX, backZ], status: "Back to terminal" },
    { p: [AVE_S, backZ] },
    { p: [AVE_S, IN_Z] },
    { p: [GATE_X, IN_Z], wait: 3, status: "Entering Gate A" },
  ];
}

const SPECS: DraySpec[] = [
  { plate: "XD2154A", carrier: "Seastar Logistics", driver: "Kelvin Ng", facility: "cfs", dockX: -64, dockZ: -128.5, delivers: true, cab: "#F2622E", box: "#1E3A66", offset: 0 },
  { plate: "XE6620R", carrier: "PSA Distripark", driver: "Rahman Ali", facility: "bonded", dockX: 10, dockZ: -128.5, delivers: true, cab: "#F6F3EC", box: "#B5463A", offset: 47 },
  { plate: "XB4092C", carrier: "Jurong Cold Chain", driver: "Tan Boon Huat", facility: "cold-hub", dockX: 66, dockZ: -128.5, delivers: true, cab: "#2C6FB0", box: "#EDEBE4", offset: 95 },
  { plate: "XD7339L", carrier: "Seastar Logistics", driver: "Hazwan Rosli", facility: "seastar-dc", dockX: 236, dockZ: -184, delivers: true, cab: "#F2622E", box: "#F2622E", offset: 22 },
  { plate: "XE1185D", carrier: "Merlion Microelectronics", driver: "Ong Swee Lan", facility: "electronics", dockX: 34, dockZ: -184, delivers: true, cab: "#F6F3EC", box: "#4F6D8F", offset: 70 },
  { plate: "XD9041E", carrier: "Straits Pharma", driver: "Prakash Das", facility: "garments", dockX: -66, dockZ: -184, delivers: false, cab: "#4E7A5A", box: "#D9B26A", offset: 118 },
  { plate: "XB3507U", carrier: "Lion City Foods", driver: "Low Kah Wai", facility: "seafood", dockX: -134, dockZ: -184, delivers: false, cab: "#1E3A66", box: "#EDEBE4", offset: 140 },
  { plate: "XD2876Z", carrier: "Seastar Equipment", driver: "Zulkifli Omar", facility: "mnr", dockX: 372, dockZ: -184, delivers: true, cab: "#E8A317", box: "#4F6D8F", offset: 160 },
];

/** Inland drayage trucks shuttling between the terminal and the logistics district. */
export const DRAYAGE_TRUCKS: Truck[] = SPECS.map((s) => ({
  id: s.plate,
  plate: s.plate,
  carrier: s.carrier,
  kind: "drayage",
  trip: `Terminal ⇄ ${facilityById(s.facility)?.name ?? s.facility}`,
  facilityId: s.facility,
  cab: s.cab,
  gate: "Gate A",
  driver: s.driver,
  containerColor: s.box,
  speed: 9.5,
  offset: s.offset,
  route: drayRoute(s),
}));
