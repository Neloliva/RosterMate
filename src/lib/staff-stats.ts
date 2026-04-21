import { breakMinutes } from "./award";
import type { AvailabilityStatus, Shift, Staff } from "./types";

const DEFAULT_OVERTIME = 38;
const MIN_ENGAGEMENT = 8;

export type StaffStatsOptions = { overtimeHours?: number };

function paidHoursOf(shift: Shift): number {
  const h = Math.max(0, shift.endHour - shift.startHour);
  return Math.max(0, h - breakMinutes(h) / 60);
}

export type StaffStats = Staff & {
  weeklyHours: number;
  status: AvailabilityStatus;
  statusLabel: string;
};

function statusFor(
  weeklyHours: number,
  overtime: number,
): { status: AvailabilityStatus; label: string } {
  const approaching = overtime * 0.85;
  if (weeklyHours > overtime) {
    return {
      status: "unavailable",
      label: `Over ${overtime}h — overtime risk`,
    };
  }
  if (weeklyHours < 1) {
    return { status: "unavailable", label: "Not scheduled this period" };
  }
  if (weeklyHours > approaching) {
    return {
      status: "limited",
      label: `Approaching ${overtime}h cap`,
    };
  }
  if (weeklyHours < MIN_ENGAGEMENT) {
    return {
      status: "limited",
      label: "Light load — fewer than 8 hours scheduled",
    };
  }
  return { status: "available", label: "Healthy load" };
}

export function computeStaffStats(
  staff: Staff[],
  shifts: Shift[],
  numWeeks = 1,
  options: StaffStatsOptions = {},
): StaffStats[] {
  const overtime = options.overtimeHours ?? DEFAULT_OVERTIME;
  const totals = new Map<string, number>();
  for (const shift of shifts) {
    totals.set(
      shift.staffId,
      (totals.get(shift.staffId) ?? 0) + paidHoursOf(shift),
    );
  }
  const weeks = Math.max(1, numWeeks);
  return staff.map((person) => {
    const total = totals.get(person.id) ?? 0;
    const weeklyHours = total / weeks;
    const { status, label } = statusFor(weeklyHours, overtime);
    return {
      ...person,
      weeklyHours: Math.round(weeklyHours * 10) / 10,
      status,
      statusLabel: label,
    };
  });
}
