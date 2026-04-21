import { calculateShiftCost, HOSPITALITY_AWARD } from "./award";
import type { Shift, Staff } from "./types";

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export type Suggestion = {
  id: string;
  shiftId: string;
  staffName: string;
  kind: "trim-night" | "move-weekday";
  headline: string;
  current: { day: number; startHour: number; endHour: number; cost: number };
  proposed: { day: number; startHour: number; endHour: number; cost: number };
  savings: number;
};

function costOf(
  staff: Staff,
  day: number,
  startHour: number,
  endHour: number,
): number {
  return calculateShiftCost(
    { id: "preview", staffId: staff.id, day, startHour, endHour, cost: 0 },
    staff,
  ).cost;
}

function trimNightSuggestion(
  shift: Shift,
  staff: Staff,
): Suggestion | null {
  const nightStart = HOSPITALITY_AWARD.penalty.nightHoursStart; // 19
  // Trimming only helps when the shift straddles the night boundary.
  if (shift.startHour >= nightStart) return null;
  if (shift.endHour <= nightStart) return null;
  // Leave at least two paid hours after trimming.
  if (nightStart - shift.startHour < 2) return null;

  const current = costOf(staff, shift.day, shift.startHour, shift.endHour);
  const proposed = costOf(staff, shift.day, shift.startHour, nightStart);
  const savings = current - proposed;
  if (savings < 5) return null;

  return {
    id: `trim:${shift.id}`,
    shiftId: shift.id,
    staffName: staff.name,
    kind: "trim-night",
    headline: `End at 7:00PM instead of ${fmtHour(shift.endHour)} to skip night loading`,
    current: {
      day: shift.day,
      startHour: shift.startHour,
      endHour: shift.endHour,
      cost: current,
    },
    proposed: {
      day: shift.day,
      startHour: shift.startHour,
      endHour: nightStart,
      cost: proposed,
    },
    savings,
  };
}

function moveWeekdaySuggestion(
  shift: Shift,
  staff: Staff,
  allShifts: Shift[],
): Suggestion | null {
  // Only weekend shifts (Sat=5, Sun=6).
  if (shift.day < 5) return null;

  const takenDays = new Set(
    allShifts
      .filter((s) => s.staffId === staff.id && s.id !== shift.id)
      .map((s) => s.day),
  );
  const weekdayOptions = [0, 1, 2, 3, 4].filter((d) => !takenDays.has(d));
  if (weekdayOptions.length === 0) return null;

  const current = costOf(staff, shift.day, shift.startHour, shift.endHour);
  let best: { day: number; cost: number } | null = null;
  for (const d of weekdayOptions) {
    const c = costOf(staff, d, shift.startHour, shift.endHour);
    if (!best || c < best.cost) best = { day: d, cost: c };
  }
  if (!best) return null;
  const savings = current - best.cost;
  if (savings < 5) return null;

  return {
    id: `move:${shift.id}`,
    shiftId: shift.id,
    staffName: staff.name,
    kind: "move-weekday",
    headline: `Move ${DAY_NAMES[shift.day]} shift to ${DAY_NAMES[best.day]} to avoid weekend penalty`,
    current: {
      day: shift.day,
      startHour: shift.startHour,
      endHour: shift.endHour,
      cost: current,
    },
    proposed: {
      day: best.day,
      startHour: shift.startHour,
      endHour: shift.endHour,
      cost: best.cost,
    },
    savings,
  };
}

function fmtHour(hour: number): string {
  const wrapped = ((hour % 24) + 24) % 24;
  const h = Math.floor(wrapped);
  const suffix = h >= 12 ? "PM" : "AM";
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}:00${suffix}`;
}

export function computeSuggestions(
  shifts: Shift[],
  staffList: Staff[],
): Suggestion[] {
  const staffById = new Map(staffList.map((s) => [s.id, s]));
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const shift of shifts) {
    const staff = staffById.get(shift.staffId);
    if (!staff) continue;
    // Offer at most one suggestion per shift — the largest saving wins.
    const candidates = [
      trimNightSuggestion(shift, staff),
      moveWeekdaySuggestion(shift, staff, shifts),
    ].filter((s): s is Suggestion => s !== null);
    if (candidates.length === 0) continue;
    candidates.sort((a, b) => b.savings - a.savings);
    const pick = candidates[0];
    if (seen.has(pick.shiftId)) continue;
    seen.add(pick.shiftId);
    out.push(pick);
  }
  out.sort((a, b) => b.savings - a.savings);
  return out;
}
