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
      <div className="pointer-events-none -translate-x-1/2 -translate-y-full pb-1.5">
        <button
          type="button"
          onClick={onClick}
          className={cn(
            "pointer-events-auto flex items-center gap-1.5 whitespace-nowrap rounded-full border bg-paper/95 font-semibold leading-none text-ink shadow-[0_1px_3px_rgba(18,35,63,0.14)] transition-[transform,padding,font-size] hover:-translate-y-0.5",
            active
              ? "border-signal px-2.5 py-[5px] text-[11.5px] ring-2 ring-signal/25"
              : "border-hairline px-2 py-[3px] text-[10px]",
          )}
        >
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT[tone], pulse && "pw-blink")} />
          {children}
        </button>
        <div className="mx-auto h-1.5 w-px bg-ink/30" />
      </div>
    </Html>
  );
}
