import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Tone = "signal" | "moss" | "amber" | "brick" | "harbor" | "ink" | "slate";

const CHIP: Record<Tone, string> = {
  signal: "bg-signal-soft text-[#B8441A]",
  moss: "bg-moss-soft text-moss",
  amber: "bg-amber-soft text-[#9A6A08]",
  brick: "bg-brick-soft text-brick",
  harbor: "bg-harbor-soft text-harbor",
  ink: "bg-ink text-paper",
  slate: "bg-sand text-slate",
};

const DOT: Record<Tone, string> = {
  signal: "bg-signal",
  moss: "bg-moss",
  amber: "bg-amber",
  brick: "bg-brick",
  harbor: "bg-harbor",
  ink: "bg-paper",
  slate: "bg-slate",
};

export function StatusChip({ tone, children, dot = true, pulse, className }: { tone: Tone; children: ReactNode; dot?: boolean; pulse?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11.5px] font-semibold", CHIP[tone], className)}>
      {dot ? <span className={cn("h-1.5 w-1.5 rounded-full", DOT[tone], pulse && "pw-blink")} /> : null}
      {children}
    </span>
  );
}

export function Panel({ children, className, as: As = "section", ...rest }: { children: ReactNode; className?: string; as?: "section" | "div" | "aside" | "nav"; "aria-label"?: string }) {
  return (
    <As className={cn("panel pointer-events-auto pw-rise", className)} {...rest}>
      {children}
    </As>
  );
}

const BAR: Record<Tone, string> = {
  signal: "bg-signal",
  moss: "bg-moss",
  amber: "bg-amber",
  brick: "bg-brick",
  harbor: "bg-harbor",
  ink: "bg-ink",
  slate: "bg-slate",
};

export function ProgressBar({ value, tone = "signal", live, className, height = "h-2" }: { value: number; tone?: Tone; live?: boolean; className?: string; height?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={cn("w-full overflow-hidden rounded-full bg-sand", height, className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-[width] duration-700 ease-out", BAR[tone], live && "pw-stripes")} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function DefRow({ label, children, mono = true }: { label: ReactNode; children: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-hairline/70 py-2 text-[13px] last:border-b-0">
      <dt className="text-slate">{label}</dt>
      <dd className={cn("text-right font-semibold text-ink", mono && "font-mono tnum text-[12.5px]")}>{children}</dd>
    </div>
  );
}

export function IconButton({ label, onClick, children, className }: { label: string; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn("grid h-10 w-10 place-items-center rounded-[10px] border border-hairline bg-paper text-ink transition-colors hover:bg-sand active:scale-95 lg:h-9 lg:w-9", className)}
    >
      {children}
    </button>
  );
}

/** Stylised ship-to-shore crane glyph (brand mark). */
export function CraneGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <path d="M8 29V9M16 29V9" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M3 9h27" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M12 3l-4 6M12 3l4 6M12 3l15 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 17h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M25 9v6" stroke="currentColor" strokeWidth="1.6" />
      <rect x="21.5" y="15" width="7" height="4.6" rx="0.8" fill="#F2622E" />
    </svg>
  );
}

export function PanelHeader({ title, eyebrow, right, icon }: { title: ReactNode; eyebrow?: ReactNode; right?: ReactNode; icon?: ReactNode }) {
  return (
    <header className="flex items-start gap-3">
      {icon ? <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-sand text-ink">{icon}</div> : null}
      <div className="min-w-0 flex-1">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2 className="truncate text-[17px] font-bold leading-tight text-ink">{title}</h2>
      </div>
      {right}
    </header>
  );
}
