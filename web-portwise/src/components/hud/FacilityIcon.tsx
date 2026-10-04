import { Droplets, Factory, Fuel, Lock, PackageOpen, ScanLine, Snowflake, SquareParking, TrainFront, Warehouse, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { FacilityKind } from "@/data/facilities";

const ICONS: Record<FacilityKind, LucideIcon> = {
  rail: TrainFront,
  cfs: PackageOpen,
  bonded: Lock,
  cold: Snowflake,
  customs: ScanLine,
  staging: SquareParking,
  service: Fuel,
  dc: Warehouse,
  mnr: Wrench,
  factory: Factory,
  fuel: Droplets,
};

/** Lucide glyph for a logistics facility kind. */
export function FacilityIcon({ kind, className }: { kind: FacilityKind; className?: string }) {
  const Icon = ICONS[kind];
  return <Icon className={className} />;
}
