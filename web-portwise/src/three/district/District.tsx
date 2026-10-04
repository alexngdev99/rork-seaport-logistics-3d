import { memo } from "react";
import { Roads } from "./Roads";
import { Facilities } from "./Facilities";
import { HighwayTraffic, ScanTruck, Smoke } from "./Movers";

/** The logistics district behind Pasir Panjang Terminal: expressway, rail ICD, warehousing, customs, industry and energy. */
export const District = memo(function District() {
  return (
    <group>
      <Roads />
      <Facilities />
      <HighwayTraffic />
      <ScanTruck />
      <Smoke />
    </group>
  );
});
