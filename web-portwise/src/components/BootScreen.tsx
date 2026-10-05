import { memo, useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { BOOT_STAGES, boot, preloadUiFonts, useBoot } from "@/state/boot";
import type { BootSnapshot } from "@/state/boot";
import { PORT_CITY, PORT_NAME } from "@/data/port";

const BOX_COLORS = ["#1E3A66", "#F2622E", "#4E7A5A", "#B5463A", "#4F6D8F", "#D9B26A", "#1E3A66", "#B5463A", "#F2622E", "#4F6D8F", "#4E7A5A", "#D9B26A"];
const COLS = 4;
const TIERS = 3;
const BOX_W = 40;
const BOX_H = 18;
const STACK_X = 168;
const GROUND_Y = 186;
const BOOM_Y = 34;
/** Never keep the user waiting forever if a stage stalls (e.g. a blocked font CDN). */
const BOOT_TIMEOUT_MS = 30000;

const slotX = (i: number): number => STACK_X + (i % COLS) * (BOX_W + 4);
const slotY = (i: number): number => GROUND_Y - (Math.floor(i / COLS) + 1) * BOX_H - Math.floor(i / COLS) * 1.5;

/** Weighted progress: finished stages count fully, the first open stage creeps toward its share. */
function targetProgress(s: BootSnapshot, now: number): number {
  let total = 0;
  let prevAt = 0;
  let isCreeping = false;
  const lastDone = Math.max(0, ...Object.values(s.done).map((v) => v ?? 0));
  for (const st of BOOT_STAGES) {
    const w = st.at - prevAt;
    prevAt = st.at;
    if (s.done[st.id] !== undefined) {
      total += w;
    } else if (!isCreeping) {
      isCreeping = true;
      const t = Math.max(0, now - lastDone);
      total += w * 0.88 * (1 - Math.exp(-t / 1600));
    }
  }
  return Math.min(1, total);
}

/** Eased, monotonic progress value driven by rAF. */
function useDisplayProgress(s: BootSnapshot): number {
  const [value, setValue] = useState<number>(0);
  const snapRef = useRef<BootSnapshot>(s);
  snapRef.current = s;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let shown = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const target = boot.isComplete(snapRef.current) ? 1 : targetProgress(snapRef.current, now - snapRef.current.startedAt);
      shown = Math.max(shown, shown + (target - shown) * Math.min(1, dt * 5));
      if (target - shown < 0.0015) shown = target;
      setValue(shown);
      if (shown < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return value;
}

/** Quay crane stacking one container per ~8% of progress. */
const CraneStack = memo(function CraneStack({ progress, isDone }: { progress: number; isDone: boolean }) {
  const placed = Math.min(BOX_COLORS.length, Math.floor(progress * (BOX_COLORS.length + 0.6)));
  const next = placed < BOX_COLORS.length ? placed : -1;
  const trolleyX = next >= 0 ? slotX(next) + BOX_W / 2 : 58;
  const hangY = next >= 0 ? Math.max(64, slotY(next) - 42) : 104;

  return (
    <div className="relative mx-auto h-[236px] w-[360px]" aria-hidden="true">
      <svg viewBox="0 0 360 236" className="absolute inset-0 h-full w-full">
        <defs>
          <pattern id="pw-boot-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="3" height="6" fill="#12233F" opacity="0.07" />
          </pattern>
        </defs>
        {/* quay apron + edge */}
        <rect x="96" y={GROUND_Y} width="264" height="10" fill="#E6E0D2" />
        <rect x="96" y={GROUND_Y} width="264" height="10" fill="url(#pw-boot-hatch)" />
        <line x1="96" y1={GROUND_Y} x2="360" y2={GROUND_Y} stroke="#12233F" strokeWidth="1.5" />
        {/* crane rails */}
        <line x1="112" y1={GROUND_Y + 0.5} x2="152" y2={GROUND_Y + 0.5} stroke="#E8A317" strokeWidth="2" />
        {/* portal legs */}
        <g stroke="#F2622E" strokeWidth="5" strokeLinecap="square">
          <line x1="116" y1={GROUND_Y} x2="116" y2={BOOM_Y + 6} />
          <line x1="148" y1={GROUND_Y} x2="148" y2={BOOM_Y + 6} />
        </g>
        <g stroke="#F2622E" strokeWidth="2.2">
          <line x1="116" y1="120" x2="148" y2="120" />
          <line x1="116" y1="120" x2="148" y2="78" />
          <line x1="116" y1="78" x2="148" y2="78" />
        </g>
        {/* machinery house */}
        <rect x="110" y={BOOM_Y - 14} width="44" height="13" rx="1.5" fill="#12233F" />
        <rect x="114" y={BOOM_Y - 10} width="8" height="4" fill="#FFC56A" opacity="0.9" />
        <rect x="126" y={BOOM_Y - 10} width="8" height="4" fill="#FFC56A" opacity="0.9" />
        {/* apex + forestays */}
        <g stroke="#12233F" strokeWidth="1.6" fill="none">
          <line x1="132" y1={BOOM_Y - 14} x2="132" y2="2" />
          <line x1="132" y1="2" x2="8" y2={BOOM_Y} />
          <line x1="132" y1="2" x2="352" y2={BOOM_Y} />
          <line x1="132" y1="2" x2="72" y2={BOOM_Y} opacity="0.5" />
        </g>
        {/* boom (over water on the left, backreach over the yard) */}
        <rect x="6" y={BOOM_Y} width="348" height="6" fill="#F2622E" />
        <rect x="6" y={BOOM_Y + 6} width="348" height="1.5" fill="#B8441A" />
        <circle cx="132" cy="2" r="2.4" fill="#FF3B2E" className="pw-blink" />
      </svg>

      {/* water with drifting chart ripples */}
      <div className="absolute bottom-0 left-0 h-[50px] w-[96px] overflow-hidden rounded-bl-[10px] bg-[#BFDCD6]">
        <div
          className="pw-drift absolute inset-y-0 -left-0 w-[200%]"
          style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent 0 14px, rgba(232,244,241,0.95) 14px 26px, transparent 26px 40px)", backgroundSize: "40px 4px", backgroundRepeat: "repeat-x", backgroundPosition: "0 14px" }}
        />
        <div
          className="pw-drift absolute inset-y-0 left-0 w-[200%] opacity-70"
          style={{ animationDuration: "5s", backgroundImage: "repeating-linear-gradient(90deg, transparent 0 8px, rgba(232,244,241,0.9) 8px 18px, transparent 18px 40px)", backgroundSize: "40px 3px", backgroundRepeat: "repeat-x", backgroundPosition: "0 32px" }}
        />
      </div>
      <div className="absolute left-0 right-0 bg-[#BFDCD6]" style={{ top: GROUND_Y + 10, height: 236 - GROUND_Y - 10 }} />
      <div className="absolute left-[96px] w-[264px] bg-[#9CC8C2]" style={{ top: GROUND_Y + 10, height: 2 }} />

      {/* stacked containers */}
      {BOX_COLORS.slice(0, placed).map((c, i) => (
        <div
          key={i}
          className="pw-drop absolute rounded-[2px]"
          style={{
            left: slotX(i),
            top: slotY(i),
            width: BOX_W,
            height: BOX_H,
            backgroundColor: c,
            backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,0.16) 0 1.5px, transparent 1.5px 5px)",
            boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.14)",
          }}
        />
      ))}

      {/* trolley, cable and the box on the hook */}
      <div className="absolute transition-[left] duration-500 ease-[cubic-bezier(0.5,0,0.3,1)]" style={{ left: trolleyX - 9, top: BOOM_Y - 3 }}>
        <div className="h-[11px] w-[18px] rounded-[2px] bg-ink" />
        <div className="absolute left-1/2 top-[11px] origin-top" style={{ height: hangY - BOOM_Y - 8 }}>
          <div className={cn("relative h-full", !isDone && "pw-sway")} style={{ transformOrigin: "50% 0" }}>
            <div className="absolute left-[-1px] top-0 h-full w-[2px] bg-ink/70" />
            <div className="absolute -left-[12px] bottom-0 h-[3px] w-[24px] rounded-[1px] bg-[#E8A317]" />
            {next >= 0 ? (
              <div
                className="absolute -left-[20px] top-full rounded-[2px]"
                style={{ width: BOX_W, height: BOX_H, backgroundColor: BOX_COLORS[next], backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,0.16) 0 1.5px, transparent 1.5px 5px)" }}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
});

function StageRow({ label, active, doneAt }: { label: string; active: boolean; doneAt?: number }) {
  const isDone = doneAt !== undefined;
  return (
    <li className="flex items-center gap-2.5 py-[5px]">
      <span
        className={cn(
          "grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full transition-colors duration-300",
          isDone ? "bg-moss text-paper" : active ? "border-2 border-signal/25 border-t-signal pw-spin" : "border border-hairline bg-paper",
        )}
      >
        {isDone ? <Check className="h-3 w-3" strokeWidth={3.2} /> : null}
      </span>
      <span className={cn("flex-1 text-[13px] transition-colors duration-300", isDone ? "text-ink" : active ? "font-semibold text-ink" : "text-slate")}>{label}</span>
      <span className="font-mono text-[11.5px] font-semibold text-slate tnum">{isDone ? `${(doneAt / 1000).toFixed(1)} s` : active ? "…" : ""}</span>
    </li>
  );
}

/**
 * Full-screen boot screen. Holds the app behind a nautical-chart cover until fonts, the 3D engine,
 * the whole scene, its shaders and the first frames are ready, then fades away into the live port.
 */
export function BootScreen() {
  const snap = useBoot();
  const isComplete = boot.isComplete(snap);
  const progress = useDisplayProgress(snap);
  const [phase, setPhase] = useState<"loading" | "leaving" | "gone">("loading");
  const active = BOOT_STAGES.find((s) => snap.done[s.id] === undefined);
  const isFull = isComplete && progress >= 1;

  useEffect(() => {
    void preloadUiFonts().then(() => boot.mark("fonts"));
    const t = window.setTimeout(() => {
      console.warn("[boot] timed out, revealing anyway");
      BOOT_STAGES.forEach((s) => boot.mark(s.id));
    }, BOOT_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!isFull || phase !== "loading") return;
    const t1 = window.setTimeout(() => {
      setPhase("leaving");
      boot.reveal();
    }, 520);
    return () => window.clearTimeout(t1);
  }, [isFull, phase]);

  useEffect(() => {
    if (phase !== "leaving") return;
    const t = window.setTimeout(() => setPhase("gone"), 950);
    return () => window.clearTimeout(t);
  }, [phase]);

  if (phase === "gone") return null;
  const pct = Math.round(progress * 100);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={!isFull}
      aria-label={isFull ? "Terminal ready" : `Loading Portwise, ${pct}%`}
      className={cn(
        "fixed inset-0 z-[100] flex flex-col overflow-hidden bg-canvas transition-[opacity,visibility] duration-[900ms] ease-out",
        phase === "leaving" && "invisible opacity-0",
      )}
    >
      {/* chart paper: grid, contour rings, vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(18,35,63,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(18,35,63,0.045) 1px, transparent 1px), linear-gradient(rgba(18,35,63,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(18,35,63,0.03) 1px, transparent 1px)",
          backgroundSize: "120px 120px, 120px 120px, 24px 24px, 24px 24px",
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-[30vh] -left-[20vw] h-[110vh] w-[110vh] rounded-full opacity-80"
        style={{ backgroundImage: "repeating-radial-gradient(circle, transparent 0 46px, rgba(44,111,176,0.10) 46px 47.5px)" }}
      />
      <div
        className="pointer-events-none absolute -right-[18vw] -top-[36vh] h-[90vh] w-[90vh] rounded-full opacity-70"
        style={{ backgroundImage: "repeating-radial-gradient(circle, transparent 0 38px, rgba(18,35,63,0.07) 38px 39px)" }}
      />
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 45%, rgba(255,253,248,0.9) 0%, rgba(243,239,230,0) 62%)" }} />

      {/* top strip */}
      <div className="relative flex items-center justify-between px-6 pt-[max(20px,var(--sat))] font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-slate md:px-10 md:pt-7">
        <span>Chart 4031 · Singapore Strait</span>
        <span className="hidden sm:inline">Seastar Lines · Operations</span>
      </div>

      <div className={cn("relative flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-6 transition-transform duration-[900ms] ease-out", phase === "leaving" && "scale-[1.04]")}>
        <div className="w-full max-w-[420px] py-4">
          {/* Scales down on narrow phones; hidden on short landscape screens so the progress stays in view. */}
          <div className="origin-top max-[399px]:-mb-[36px] max-[399px]:scale-[0.85] [@media(max-height:600px)]:hidden">
            <CraneStack progress={progress} isDone={isFull} />
          </div>

          <div className="mt-7 flex items-center gap-3 [@media(max-height:600px)]:mt-0">
            <img src="/icon.png" alt="" className="h-11 w-11 rounded-[12px] shadow-panel" />
            <div className="min-w-0">
              <p className="eyebrow truncate">
                {PORT_NAME} · {PORT_CITY}
              </p>
              <h1 className="text-[28px] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">Portwise</h1>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-baseline justify-between gap-3">
              <p className={cn("truncate text-[13.5px] font-semibold", isFull ? "text-moss" : "text-ink")}>{isFull ? "Terminal is live" : `${active?.active ?? "Preparing"}…`}</p>
              <p className="font-mono text-[22px] font-bold text-ink tnum">
                {pct}
                <span className="text-[13px] text-slate">%</span>
              </p>
            </div>
            <div className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-sand pw-hatch">
              <div
                className={cn("absolute inset-y-0 left-0 rounded-full transition-colors duration-500", isFull ? "bg-moss" : "bg-signal pw-stripes")}
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>

          <ul className="panel mt-5 px-4 py-2.5">
            {BOOT_STAGES.map((s) => (
              <StageRow key={s.id} label={s.label} active={active?.id === s.id} doneAt={snap.done[s.id]} />
            ))}
          </ul>
        </div>
      </div>

      <div className="relative flex items-center justify-between px-6 pb-[max(20px,var(--sab))] font-mono text-[11px] font-semibold text-slate md:px-10 md:pb-7">
        <span>01°16′25″N 103°46′10″E</span>
        <span>SGT · UTC+8</span>
      </div>
    </div>
  );
}
