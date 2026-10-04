/**
 * AIS position reports (ITU-R M.1371-5, messages 1/2/3) and their NMEA 0183 `!AIVDM` armoring.
 * Field names follow the AISStream.io JSON schema so a live feed can be swapped in later.
 */

/** Navigational status, message 1/2/3 bits 38–41. */
export type NavStatus = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 15;

export const NAV_STATUS_LABEL: Record<number, string> = {
  0: "Under way using engine",
  1: "At anchor",
  2: "Not under command",
  3: "Restricted manoeuvrability",
  4: "Constrained by draught",
  5: "Moored",
  6: "Aground",
  7: "Engaged in fishing",
  8: "Under way sailing",
  15: "Not defined",
};

/** Decoded Class A position report. Units are the decoded (human) units, quantised like the wire format. */
export interface PositionReport {
  MessageID: 1 | 2 | 3;
  RepeatIndicator: number;
  /** MMSI */
  UserID: number;
  NavigationalStatus: NavStatus;
  /** Raw ROT_AIS (−126…126, ±127 turning without TI, −128 not available). */
  RateOfTurn: number;
  /** Knots, 0.1 kn resolution, 102.3 = not available. */
  Sog: number;
  PositionAccuracy: boolean;
  /** Degrees, 1/10 000 minute resolution, 181 = not available. */
  Longitude: number;
  /** Degrees, 1/10 000 minute resolution, 91 = not available. */
  Latitude: number;
  /** Degrees, 0.1° resolution, 360 = not available. */
  Cog: number;
  /** Whole degrees, 511 = not available. */
  TrueHeading: number;
  /** UTC second of the fix, 60 = not available. */
  Timestamp: number;
  SpecialManoeuvreIndicator: number;
  Raim: boolean;
  CommunicationState: number;
  /** Checksum verified on decode. */
  Valid: boolean;
}

export type AisChannel = "A" | "B";

/** ROT_AIS = 4.733 · √(ROT °/min), signed. */
export function encodeRot(degPerMin: number | null): number {
  if (degPerMin === null || !Number.isFinite(degPerMin)) return -128;
  const raw = Math.round(4.733 * Math.sqrt(Math.abs(degPerMin)));
  return Math.sign(degPerMin) * Math.min(126, raw);
}

/** Inverse of {@link encodeRot}; returns null when ROT is not available or only a direction is known. */
export function rotDegPerMin(raw: number): number | null {
  if (raw === -128 || Math.abs(raw) >= 127) return null;
  const v = raw / 4.733;
  return Math.sign(raw) * v * v;
}

class BitWriter {
  readonly bits: number[] = [];

  put(value: number, width: number): void {
    const range = 2 ** width;
    let v = Math.round(value);
    if (v < 0) v += range;
    v = ((v % range) + range) % range;
    for (let i = width - 1; i >= 0; i--) this.bits.push(Math.floor(v / 2 ** i) % 2);
  }
}

const armorChar = (v: number): string => String.fromCharCode(v < 40 ? v + 48 : v + 56);

function dearmor(payload: string): number[] {
  const bits: number[] = [];
  for (let i = 0; i < payload.length; i++) {
    let v = payload.charCodeAt(i) - 48;
    if (v > 40) v -= 8;
    for (let b = 5; b >= 0; b--) bits.push((v >> b) & 1);
  }
  return bits;
}

function readU(bits: number[], start: number, len: number): number {
  let v = 0;
  for (let i = 0; i < len; i++) v = v * 2 + (bits[start + i] ?? 0);
  return v;
}

function readS(bits: number[], start: number, len: number): number {
  const u = readU(bits, start, len);
  return u >= 2 ** (len - 1) ? u - 2 ** len : u;
}

/** NMEA 0183 checksum: XOR of every character between `!` and `*`, as two hex digits. */
export function nmeaChecksum(body: string): string {
  let cs = 0;
  for (let i = 0; i < body.length; i++) cs ^= body.charCodeAt(i);
  return cs.toString(16).toUpperCase().padStart(2, "0");
}

/** Encodes a position report into a single-fragment `!AIVDM` sentence (168 bits → 28 armored chars). */
export function encodePositionReport(r: Omit<PositionReport, "Valid">, channel: AisChannel): string {
  const w = new BitWriter();
  w.put(r.MessageID, 6);
  w.put(r.RepeatIndicator, 2);
  w.put(r.UserID, 30);
  w.put(r.NavigationalStatus, 4);
  w.put(r.RateOfTurn, 8);
  w.put(Math.min(1023, Math.round(r.Sog * 10)), 10);
  w.put(r.PositionAccuracy ? 1 : 0, 1);
  w.put(Math.round(r.Longitude * 600000), 28);
  w.put(Math.round(r.Latitude * 600000), 27);
  w.put(Math.round(r.Cog * 10) % 3601, 12);
  w.put(r.TrueHeading, 9);
  w.put(r.Timestamp, 6);
  w.put(r.SpecialManoeuvreIndicator, 2);
  w.put(0, 3);
  w.put(r.Raim ? 1 : 0, 1);
  w.put(r.CommunicationState, 19);
  let payload = "";
  for (let i = 0; i < w.bits.length; i += 6) payload += armorChar(readU(w.bits, i, 6));
  const body = `AIVDM,1,1,,${channel},${payload},0`;
  return `!${body}*${nmeaChecksum(body)}`;
}

/** Decodes a single-fragment `!AIVDM` type 1/2/3 sentence; returns null for anything else. */
export function decodeAivdm(sentence: string): PositionReport | null {
  const star = sentence.lastIndexOf("*");
  if (!sentence.startsWith("!") || star < 0) return null;
  const body = sentence.slice(1, star);
  const valid = nmeaChecksum(body) === sentence.slice(star + 1, star + 3).toUpperCase();
  const f = body.split(",");
  if (f.length < 7 || f[1] !== "1") return null;
  const bits = dearmor(f[5]);
  const type = readU(bits, 0, 6);
  if (type < 1 || type > 3 || bits.length < 168) return null;
  return {
    MessageID: type as 1 | 2 | 3,
    RepeatIndicator: readU(bits, 6, 2),
    UserID: readU(bits, 8, 30),
    NavigationalStatus: readU(bits, 38, 4) as NavStatus,
    RateOfTurn: readS(bits, 42, 8),
    Sog: readU(bits, 50, 10) / 10,
    PositionAccuracy: readU(bits, 60, 1) === 1,
    Longitude: readS(bits, 61, 28) / 600000,
    Latitude: readS(bits, 89, 27) / 600000,
    Cog: readU(bits, 116, 12) / 10,
    TrueHeading: readU(bits, 128, 9),
    Timestamp: readU(bits, 137, 6),
    SpecialManoeuvreIndicator: readU(bits, 143, 2),
    Raim: readU(bits, 148, 1) === 1,
    CommunicationState: readU(bits, 149, 19),
    Valid: valid,
  };
}

/**
 * Reporting interval for a Class A transponder (ITU-R M.1371-5, Table 1).
 * "Changing course" is taken as a rate of turn above 5°/min.
 */
export function classAInterval(status: number, sogKn: number, rotDegMin: number): number {
  if ((status === 1 || status === 5) && sogKn <= 3) return 180;
  const turning = Math.abs(rotDegMin) > 5;
  if (sogKn <= 14) return turning ? 10 / 3 : 10;
  if (sogKn <= 23) return turning ? 2 : 6;
  return 2;
}
