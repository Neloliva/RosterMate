import { calculateShiftCost } from "./award";
import type { Shift, Staff } from "./types";

export function computeShiftCost(shift: Shift, staff: Staff): number {
  return calculateShiftCost(shift, staff).cost;
}
