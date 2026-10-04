import { useMemo } from "react";
import { Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { SIM_START_SEC, fmtClock, simT, useSimTick } from "@/sim/simStore";
import { aisDef, aisFix, aisLog, aisReception, newFix } from "@/sim/ais/tracker";
import { NAV_STATUS_LABEL } from "@/sim/ais/nmea";
import { fmtLat, fmtLon, sceneToGeo } from "@/sim/ais/geo";
import { SHIP_TYPE_LABEL } from "@/sim/ais/static";
import { DefRow, StatusChip } from "./primitives";
import type { Tone } from "./primitives";

const statusTone = (s: number): Tone => (s === 0 || s === 8 ? "harbor" : s === 5 ? "moss" : s === 1 ? "amber" : s === 2 || s === 6 ? "brick" : "slate");

const fmtAge = (sec: number): string => (sec < 60 ? `${Math.round(sec)} s` : `${Math.floor(sec / 60)} min ${Math.round(sec % 60)} s`);

/** Live AIS readout for one vessel: decoded Class A report, link health and the raw !AIVDM feed. */
export function AisPanel({ vesselId }: { vesselId: string }) {
  useSimTick();
  const fix = useMemo(newFix, []);
  const def = aisDef(vesselId);
  if (!def) return <p className="py-3 text-[12.5px] text-slate">No AIS transponder on record for this vessel.</p>;

  const t = simT();
  const f = aisFix(vesselId, t, fix);
  const m = f.report?.msg;
  const st = def.static;
  const rx = aisReception(vesselId, t, 600);
  const total = rx.received + rx.missed;
  const log = aisLog(vesselId, t, 9);
  const pos = m ? { lat: m.Latitude, lon: m.Longitude } : sceneToGeo(f.x, f.z);
  const link = !m || f.lost ? { label: "Target lost", tone: "brick" as Tone } : f.stale ? { label: "Signal stale", tone: "amber" as Tone } : { label: "Receiving", tone: "moss" as Tone };

  return (
    <div className="pt-3">
      <div className="flex items-center justify-between gap-2">
        <StatusChip tone={m ? statusTone(m.NavigationalStatus) : "slate"}>{m ? NAV_STATUS_LABEL[m.NavigationalStatus] ?? "Not defined" : "No fix"}</StatusChip>
        <span className="flex items-center gap-1.5 text-[11.5px] text-slate">
          <Radio className={cn("h-3.5 w-3.5", link.tone === "moss" ? "text-moss" : link.tone === "amber" ? "text-amber" : "text-brick")} />
          {link.label} · {m ? `${fmtAge(f.age)} ago` : "—"}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {[
          ["SOG", m ? m.Sog.toFixed(1) : "—", "kn"],
          ["COG", m && m.Cog < 360 ? m.Cog.toFixed(1) : "—", "°"],
          ["HDG", m && m.TrueHeading !== 511 ? String(m.TrueHeading) : "—", "°"],
          ["ROT", f.rot !== null && m ? `${f.rot > 0 ? "+" : ""}${f.rot.toFixed(0)}` : "—", "°/min"],
        ].map(([label, value, unit]) => (
          <div key={label} className="rounded-[9px] bg-sand/70 px-2 py-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate">{label}</p>
            <p className="font-mono text-[15px] font-bold leading-tight text-ink tnum">
              {value}
              <span className="ml-0.5 font-sans text-[10px] font-medium text-slate">{unit}</span>
            </p>
          </div>
        ))}
      </div>

      <dl className="mt-2">
        <DefRow label="Position">
          {fmtLat(pos.lat)} {fmtLon(pos.lon)}
        </DefRow>
        <DefRow label="MMSI · Call sign">
          {st.mmsi} · {st.callSign}
        </DefRow>
        <DefRow label="Type · Draught">
          {SHIP_TYPE_LABEL(st.shipType)} ({st.shipType}) · {st.draught.toFixed(1)} m
        </DefRow>
        <DefRow label="Size (A+B × C+D)">
          {st.dimension.A + st.dimension.B} × {st.dimension.C + st.dimension.D} m
        </DefRow>
        <DefRow label="Destination">{st.destination}</DefRow>
        <DefRow label="Report interval">{f.expected >= 60 ? `${f.expected / 60} min` : `${Math.round(f.expected * 10) / 10} s`}</DefRow>
        <DefRow label="Reception (10 min)">
          {total ? `${Math.round((rx.received / total) * 100)}% · ${rx.received}/${total}` : "—"}
        </DefRow>
      </dl>

      <p className="eyebrow mt-3 pb-1.5">Raw feed · NMEA 0183</p>
      <ol className="space-y-[3px] rounded-[10px] bg-ink px-2.5 py-2">
        {log.map((r, i) => (
          <li key={r.seq} className={cn("flex gap-2 font-mono text-[10.5px] leading-[1.45]", i === 0 && "pw-rise")}>
            <span className="shrink-0 text-paper/45 tnum">{fmtClock(SIM_START_SEC + r.tFix, true)}</span>
            {r.received ? (
              <span className="min-w-0 truncate text-[#BFDCD6]" title={r.sentence}>
                {r.sentence}
              </span>
            ) : (
              <span className="text-[#F59C8F]">— slot missed (ch {r.channel})</span>
            )}
          </li>
        ))}
        {!log.length ? <li className="font-mono text-[10.5px] text-paper/50">Waiting for first report…</li> : null}
      </ol>
      <p className="mt-2 text-[11px] leading-snug text-slate">The 3D hull is drawn from these decoded reports only, dead-reckoned with SOG, COG and ROT between fixes.</p>
    </div>
  );
}
