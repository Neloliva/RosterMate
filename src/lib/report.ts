import { breakMinutes, calculateShiftCost } from "./award";
import { daysForWeek } from "./date";
import { formatHour, hourToTimeString } from "./time";
import type { Shift, Staff } from "./types";

export type StaffLine = {
  staffId: string;
  name: string;
  role: string;
  shifts: number;
  hours: number;
  cost: number;
  avgPerHour: number;
};

export type DayLine = {
  day: number;
  dayName: string;
  dateLabel: string;
  shifts: number;
  hours: number;
  cost: number;
};

export type ReportData = {
  weekStarts: string[];
  numWeeks: number;
  totalCost: number;
  totalHours: number;
  totalShifts: number;
  staffScheduled: number;
  basePay: number;
  penaltyPremium: number;
  byStaff: StaffLine[];
  byDay: DayLine[];
};

function paidHoursOf(shift: Shift): number {
  const h = Math.max(0, shift.endHour - shift.startHour);
  return Math.max(0, h - breakMinutes(h) / 60);
}

const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export function buildReport(
  shiftsByWeek: Record<string, Shift[]>,
  staff: Staff[],
): ReportData {
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const weekStarts = Object.keys(shiftsByWeek).sort();
  const multiWeek = weekStarts.length !== 1;

  let totalCost = 0;
  let totalHours = 0;
  let basePay = 0;
  let totalShifts = 0;

  const byStaffMap = new Map<string, StaffLine>();
  const byDayMap = new Map<number, DayLine>();

  for (const weekStart of weekStarts) {
    const shiftsInWeek = shiftsByWeek[weekStart] ?? [];
    const dayCells = daysForWeek(weekStart);
    totalShifts += shiftsInWeek.length;

    for (const shift of shiftsInWeek) {
      const person = staffById.get(shift.staffId);
      if (!person) continue;
      const paidHours = paidHoursOf(shift);
      const cost = calculateShiftCost(shift, person).cost;
      const base = person.baseRate * paidHours;

      totalCost += cost;
      totalHours += paidHours;
      basePay += base;

      const line =
        byStaffMap.get(person.id) ??
        ({
          staffId: person.id,
          name: person.name,
          role: person.role,
          shifts: 0,
          hours: 0,
          cost: 0,
          avgPerHour: 0,
        } as StaffLine);
      line.shifts += 1;
      line.hours += paidHours;
      line.cost += cost;
      byStaffMap.set(person.id, line);

      const dayCell = dayCells[shift.day];
      const dayLine =
        byDayMap.get(shift.day) ??
        ({
          day: shift.day,
          dayName:
            dayCell?.name ?? WEEKDAY_NAMES[shift.day] ?? `Day ${shift.day + 1}`,
          dateLabel: multiWeek ? "" : (dayCell?.date ?? ""),
          shifts: 0,
          hours: 0,
          cost: 0,
        } as DayLine);
      dayLine.shifts += 1;
      dayLine.hours += paidHours;
      dayLine.cost += cost;
      byDayMap.set(shift.day, dayLine);
    }
  }

  const byStaff = [...byStaffMap.values()]
    .map((line) => ({
      ...line,
      hours: Math.round(line.hours * 10) / 10,
      cost: Math.round(line.cost),
      avgPerHour:
        line.hours > 0 ? Math.round((line.cost / line.hours) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.cost - a.cost);

  const byDay = [...byDayMap.values()]
    .map((line) => ({
      ...line,
      hours: Math.round(line.hours * 10) / 10,
      cost: Math.round(line.cost),
    }))
    .sort((a, b) => a.day - b.day);

  return {
    weekStarts,
    numWeeks: weekStarts.length,
    totalCost: Math.round(totalCost),
    totalHours: Math.round(totalHours * 10) / 10,
    totalShifts,
    staffScheduled: byStaff.length,
    basePay: Math.round(basePay),
    penaltyPremium: Math.max(0, Math.round(totalCost - basePay)),
    byStaff,
    byDay,
  };
}

function csvEscape(value: string | number): string {
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(
  shiftsByWeek: Record<string, Shift[]>,
  staff: Staff[],
): string {
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const rows: string[] = [];
  rows.push(
    [
      "Week",
      "Day",
      "Date",
      "Staff",
      "Role",
      "Start",
      "End",
      "Hours",
      "Break (min)",
      "Base Rate",
      "Cost",
    ]
      .map(csvEscape)
      .join(","),
  );
  const weekStarts = Object.keys(shiftsByWeek).sort();
  for (const weekStart of weekStarts) {
    const shiftsInWeek = [...(shiftsByWeek[weekStart] ?? [])].sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      return a.startHour - b.startHour;
    });
    const dayCells = daysForWeek(weekStart);
    for (const s of shiftsInWeek) {
      const person = staffById.get(s.staffId);
      if (!person) continue;
      const hours = Math.max(0, s.endHour - s.startHour);
      const cost = calculateShiftCost(s, person).cost;
      const day = dayCells[s.day];
      rows.push(
        [
          weekStart,
          day?.name ?? `Day ${s.day + 1}`,
          day?.date ?? "",
          person.name,
          person.role,
          hourToTimeString(s.startHour),
          hourToTimeString(s.endHour),
          hours,
          breakMinutes(hours),
          person.baseRate.toFixed(2),
          cost,
        ]
          .map(csvEscape)
          .join(","),
      );
    }
  }
  return rows.join("\n");
}

export function formatCurrency(value: number): string {
  return `$${value.toLocaleString()}`;
}

// Used when formatting a decimal-hour range for display in a report summary.
export function formatShiftRange(start: number, end: number): string {
  return `${formatHour(start)}-${formatHour(end)}`;
}

export type OvertimeWeek = { weekStart: string; hours: number };
export type OvertimeOffender = {
  name: string;
  maxHours: number;
  weeks: OvertimeWeek[];
};

export type ComplianceStats = {
  totalShifts: number;
  numWeeks: number;
  shiftsTriggeringBreak: number;
  overtimeStaff: OvertimeOffender[];
  weekendShifts: number;
  nightShifts: number;
  casualShifts: number;
  casualStaffCount: number;
  compliant: boolean;
};

// Night shift detection: start before 7am or any portion runs past 7pm.
function shiftHitsNight(shift: Shift): boolean {
  return shift.startHour < 7 || shift.endHour > 19;
}

export type ComplianceOptions = { overtimeHours?: number };

export function complianceStats(
  shiftsByWeek: Record<string, Shift[]>,
  staff: Staff[],
  options: ComplianceOptions = {},
): ComplianceStats {
  const OVERTIME_HOURS = options.overtimeHours ?? 38;
  const staffById = new Map(staff.map((s) => [s.id, s]));
  let shiftsTriggeringBreak = 0;
  let weekendShifts = 0;
  let nightShifts = 0;
  let casualShifts = 0;
  let totalShifts = 0;
  const casualStaffIds = new Set<string>();
  const overtimeBy = new Map<string, OvertimeWeek[]>();

  const weekStarts = Object.keys(shiftsByWeek);
  for (const weekStart of weekStarts) {
    const shiftsInWeek = shiftsByWeek[weekStart] ?? [];
    totalShifts += shiftsInWeek.length;
    const hoursPerStaff = new Map<string, number>();

    for (const shift of shiftsInWeek) {
      const hours = Math.max(0, shift.endHour - shift.startHour);
      if (hours >= 5) shiftsTriggeringBreak++;
      if (shift.day === 5 || shift.day === 6) weekendShifts++;
      if (shiftHitsNight(shift)) nightShifts++;

      const person = staffById.get(shift.staffId);
      if (person?.employmentType === "casual") {
        casualShifts++;
        casualStaffIds.add(person.id);
      }

      hoursPerStaff.set(
        shift.staffId,
        (hoursPerStaff.get(shift.staffId) ?? 0) + paidHoursOf(shift),
      );
    }

    for (const [id, hours] of hoursPerStaff) {
      if (hours > OVERTIME_HOURS) {
        const entry = overtimeBy.get(id) ?? [];
        entry.push({ weekStart, hours: Math.round(hours * 10) / 10 });
        overtimeBy.set(id, entry);
      }
    }
  }

  const overtimeStaff: OvertimeOffender[] = [];
  for (const [id, weeks] of overtimeBy) {
    const person = staffById.get(id);
    if (!person) continue;
    weeks.sort((a, b) => b.hours - a.hours);
    overtimeStaff.push({
      name: person.name,
      maxHours: weeks[0].hours,
      weeks,
    });
  }
  overtimeStaff.sort((a, b) => b.maxHours - a.maxHours);

  return {
    totalShifts,
    numWeeks: weekStarts.length,
    shiftsTriggeringBreak,
    overtimeStaff,
    weekendShifts,
    nightShifts,
    casualShifts,
    casualStaffCount: casualStaffIds.size,
    compliant: overtimeStaff.length === 0,
  };
}

export type EfficiencyLevel = "good" | "medium" | "watch";
export type ScoredStaffLine = StaffLine & { level: EfficiencyLevel };

export function scoreStaffEfficiency(
  byStaff: StaffLine[],
): ScoredStaffLine[] {
  if (byStaff.length === 0) return [];
  const rates = byStaff
    .filter((s) => s.hours > 0)
    .map((s) => s.avgPerHour)
    .sort((a, b) => a - b);
  if (rates.length === 0) {
    return byStaff.map((s) => ({ ...s, level: "good" as const }));
  }
  const median = rates[Math.floor(rates.length / 2)];
  return byStaff.map((s) => {
    const r = s.avgPerHour;
    let level: EfficiencyLevel;
    if (r === 0 || r <= median * 1.03) level = "good";
    else if (r <= median * 1.1) level = "medium";
    else level = "watch";
    return { ...s, level };
  });
}

export type Trend = {
  delta: number;
  pct: number;
  direction: "up" | "down" | "flat";
  priorHasData: boolean;
};

export function trendOf(
  current: number,
  prior: number,
  priorHasData: boolean,
  tolerance = 0.5,
): Trend {
  if (!priorHasData) {
    return { delta: 0, pct: 0, direction: "flat", priorHasData: false };
  }
  const delta = current - prior;
  if (Math.abs(delta) < tolerance) {
    return { delta: 0, pct: 0, direction: "flat", priorHasData: true };
  }
  const pct = prior > 0 ? (delta / prior) * 100 : 0;
  return {
    delta,
    pct: Math.round(pct * 10) / 10,
    direction: delta > 0 ? "up" : "down",
    priorHasData: true,
  };
}
