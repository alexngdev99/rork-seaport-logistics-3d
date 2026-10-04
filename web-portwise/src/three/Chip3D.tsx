import { Html } from "@react-three/drei";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ChipTone = "signal" | "moss" | "amber" | "brick" | "harbor" | "ink";

const DOT: Record<ChipTone, string> = {
  signal: "bg-signal",
  moss: "bg-moss",
  amber: "bg-amber",
  brick: "bg-brick",
  harbor: "bg-harbor",
  ink: "bg-ink",
};

interface Chip3DProps {
  position: [number, number, number];
  tone?: ChipTone;
  active?: boolean;
  pulse?: boolean;
  onClick?: () => void;
  children: ReactNode;
}

/** Floating label pinned to a 3D point; sits below HUD panels in z-order. */
export function Chip3D({ position, tone = "signal", active, pulse, onClick, children }: Chip3DProps) {
  return (
    <Html position={position} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
      <div className="pointer-events-none -translate-x-1/2 -translate-y-full pb-2">
        <button
          type="button"
          onClick={onClick}
          className={cn(
            "pointer-events-auto flex items-center gap-2 whitespace-nowrap rounded-full border bg-paper px-3 py-1.5 text-[12.5px] font-semibold text-ink shadow-panel transition-transform hover:-translate-y-0.5",
            active ? "border-signal ring-2 ring-signal/25" : "border-hairline",
          )}
        >
          <span className={cn("h-2 w-2 shrink-0 rounded-full", DOT[tone], pulse && "pw-blink")} />
          {children}
        </button>
        <div className="mx-auto h-2 w-px bg-ink/30" />
      </div>
    </Html>
  );
}
