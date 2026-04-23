import { breakMinutes, calculateShiftCost } from "./award";
import { computeDayCoverage } from "./coverage";
import { computeSuggestions } from "./optimize";
import type { CoverageRules, Shift, Staff } from "./types";

export type InsightTone = "info" | "warning" | "success";

export type Insight = {
  id: string;
  title: string;
  detail: string;
  tone: InsightTone;
};

const DEFAULT_OVERTIME_HOURS = 38;
const PENALTY_CONCENTRATION_THRESHOLD = 0.2;

export type InsightOptions = {
  overtimeHours?: number;
  coverageRules?: CoverageRules;
};
const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];
const ALL_DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function paidHoursOf(shift: Shift): number {
  const h = Math.max(0, shift.endHour - shift.startHour);
  return Math.max(0, h - breakMinutes(h) / 60);
}

export function computeInsights(
  shifts: Shift[],
  staff: Staff[],
  options: InsightOptions = {},
): Insight[] {
  const OVERTIME_HOURS = options.overtimeHours ?? DEFAULT_OVERTIME_HOURS;
  const out: Insight[] = [];
  const staffById = new Map(staff.map((s) => [s.id, s]));

  // Overtime risk — staff over the standard 38h full-time week.
  const hoursPerStaff = new Map<string, number>();
  for (const shift of shifts) {
    hoursPerStaff.set(
      shift.staffId,
      (hoursPerStaff.get(shift.staffId) ?? 0) + paidHoursOf(shift),
    );
  }
  let overtime: { staff: Staff; hours: number } | null = null;
  for (const [staffId, hours] of hoursPerStaff) {
    if (hours > OVERTIME_HOURS) {
      const person = staffById.get(staffId);
      if (person && (!overtime || hours > overtime.hours)) {
        overtime = { staff: person, hours };
      }
    }
  }
  if (overtime) {
    out.push({
      id: "overtime",
      title: "Overtime risk",
      detail: `${overtime.staff.name} scheduled for ${overtime.hours.toFixed(1)}h — exceeds the standard ${OVERTIME_HOURS}h full-time week.`,
      tone: "warning",
    });
  }

  // Biggest cost optimization — reuse the suggestions engine.
  const suggestions = computeSuggestions(shifts, staff);
  if (suggestions.length > 0) {
    const top = suggestions[0];
    out.push({
      id: "savings",
      title: "Cost optimization",
      detail: `${top.staffName}: ${top.headline.toLowerCase()} — save $${Math.round(top.savings)}.`,
      tone: "info",
    });
  }

  // Penalty concentration — how much of the week's cost is non-base loading.
  let totalCost = 0;
  let basePay = 0;
  for (const shift of shifts) {
    const person = staffById.get(shift.staffId);
    if (!person) continue;
    totalCost += calculateShiftCost(shift, person).cost;
    basePay += person.baseRate * paidHoursOf(shift);
  }
  const penaltyPremium = Math.max(0, totalCost - basePay);
  const penaltyPct = totalCost > 0 ? penaltyPremium / totalCost : 0;
  if (totalCost > 0 && penaltyPct > PENALTY_CONCENTRATION_THRESHOLD) {
    out.push({
      id: "penalty",
      title: "Penalty loading high",
      detail: `${Math.round(penaltyPct * 100)}% of this week's $${Math.round(totalCost).toLocaleString()} cost is weekend, night, or casual loading.`,
      tone: "warning",
    });
  }

  // Minimum-staffing breach — when the manager has set a coverage rule and
  // a day this week is below it. Takes priority over the softer thin-coverage
  // heuristic below because it reflects the manager's own declared minimum.
  if (options.coverageRules) {
    const perDay = computeDayCoverage({
      shifts,
      staff,
      rules: options.coverageRules,
    });
    const breaches = perDay.filter((d) => d.hasRule && !d.met);
    if (breaches.length > 0) {
      const labels = breaches.map((d) => {
        const parts: string[] = [];
        if (d.required !== null) {
          parts.push(`${d.staffed}/${d.required} staff`);
        }
        if (d.roleRequired !== null && d.roleName) {
          parts.push(`${d.roleStaffed}/${d.roleRequired} ${d.roleName}`);
        }
        return `${ALL_DAY_NAMES[d.day]} (${parts.join(", ")})`;
      });
      out.push({
        id: "coverage-below-minimum",
        title: "Below minimum coverage",
        detail: `${labels.join("; ")} — below your configured minimum.`,
        tone: "warning",
      });
    }
  }

  // Thin coverage (fallback heuristic) — any weekday with a single scheduled
  // shift when no explicit minimum rule is set.
  if (!options.coverageRules?.perDay.some((v) => v !== null)) {
    const shiftsPerDay = Array.from({ length: 7 }, () => 0);
    for (const shift of shifts) shiftsPerDay[shift.day] += 1;
    const thin: string[] = [];
    for (let d = 0; d < 5; d++) {
      if (shiftsPerDay[d] === 1) thin.push(WEEKDAY_NAMES[d]);
    }
    if (thin.length > 0) {
      out.push({
        id: "coverage",
        title: "Thin coverage",
        detail: `${thin.join(", ")} ${thin.length === 1 ? "has" : "have"} only one shift scheduled — consider adding support.`,
        tone: "warning",
      });
    }
  }

  if (out.length === 0) {
    out.push({
      id: "ok",
      title: "Schedule looks good",
      detail:
        "No overtime, coverage, or penalty concerns flagged for this week.",
      tone: "success",
    });
  }

  return out;
}

type WeekBundle = { weekStart: string; shifts: Shift[] };

function shortDateOf(iso: string): string {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const [, m, d] = iso.split("-").map(Number);
  return `${months[m - 1]} ${d}`;
}

export function computeMonthlyInsights(
  weeks: WeekBundle[],
  staff: Staff[],
  options: InsightOptions = {},
): Insight[] {
  const OVERTIME_HOURS = options.overtimeHours ?? DEFAULT_OVERTIME_HOURS;
  const out: Insight[] = [];
  const staffById = new Map(staff.map((s) => [s.id, s]));

  // Overtime: find which weeks push any staff over 38h. Report the worst
  // offender across all weeks, and name each week they exceed.
  const overtimeHits: Map<
    string,
    { staff: Staff; maxHours: number; weeks: string[] }
  > = new Map();
  for (const week of weeks) {
    const hoursPerStaff = new Map<string, number>();
    for (const shift of week.shifts) {
      hoursPerStaff.set(
        shift.staffId,
        (hoursPerStaff.get(shift.staffId) ?? 0) + paidHoursOf(shift),
      );
    }
    for (const [staffId, hours] of hoursPerStaff) {
      if (hours > OVERTIME_HOURS) {
        const person = staffById.get(staffId);
        if (!person) continue;
        const existing = overtimeHits.get(staffId);
        if (existing) {
          existing.maxHours = Math.max(existing.maxHours, hours);
          existing.weeks.push(week.weekStart);
        } else {
          overtimeHits.set(staffId, {
            staff: person,
            maxHours: hours,
            weeks: [week.weekStart],
          });
        }
      }
    }
  }
  if (overtimeHits.size > 0) {
    const worst = [...overtimeHits.values()].sort(
      (a, b) => b.maxHours - a.maxHours,
    )[0];
    const weekList = worst.weeks.slice(0, 3).map(shortDateOf).join(", ");
    const more = worst.weeks.length > 3
      ? ` and ${worst.weeks.length - 3} more`
      : "";
    out.push({
      id: "overtime-month",
      title: "Overtime risk",
      detail: `${worst.staff.name} peaks at ${worst.maxHours.toFixed(1)}h — exceeds ${OVERTIME_HOURS}h in week${worst.weeks.length === 1 ? "" : "s"} of ${weekList}${more}.`,
      tone: "warning",
    });
  }

  // Cost optimization: sum top-savings-per-week across all weeks and flag
  // the week with the biggest single opportunity.
  let totalTopSavings = 0;
  let bestWeek: { weekStart: string; savings: number } | null = null;
  for (const week of weeks) {
    const weekSuggestions = computeSuggestions(week.shifts, staff);
    const topSavings = weekSuggestions.reduce((s, x) => s + x.savings, 0);
    totalTopSavings += topSavings;
    if (topSavings > 0 && (!bestWeek || topSavings > bestWeek.savings)) {
      bestWeek = { weekStart: week.weekStart, savings: topSavings };
    }
  }
  if (totalTopSavings > 0 && bestWeek) {
    out.push({
      id: "savings-month",
      title: "Cost optimization",
      detail: `Up to $${Math.round(totalTopSavings).toLocaleString()} of savings across these ${weeks.length} weeks — biggest single week is ${shortDateOf(bestWeek.weekStart)} ($${Math.round(bestWeek.savings)}).`,
      tone: "info",
    });
  }

  // Penalty concentration across all weeks.
  let totalCost = 0;
  let basePay = 0;
  for (const week of weeks) {
    for (const shift of week.shifts) {
      const person = staffById.get(shift.staffId);
      if (!person) continue;
      totalCost += calculateShiftCost(shift, person).cost;
      basePay += person.baseRate * paidHoursOf(shift);
    }
  }
  const penaltyPremium = Math.max(0, totalCost - basePay);
  const penaltyPct = totalCost > 0 ? penaltyPremium / totalCost : 0;
  if (totalCost > 0 && penaltyPct > PENALTY_CONCENTRATION_THRESHOLD) {
    out.push({
      id: "penalty-month",
      title: "Penalty loading high",
      detail: `${Math.round(penaltyPct * 100)}% of $${Math.round(totalCost).toLocaleString()} total cost across these ${weeks.length} weeks is weekend, night, or casual loading.`,
      tone: "warning",
    });
  }

  // Thin coverage: collect weeks that have any weekday with only one shift.
  const thinWeeks: string[] = [];
  for (const week of weeks) {
    const shiftsPerDay = Array.from({ length: 7 }, () => 0);
    for (const shift of week.shifts) shiftsPerDay[shift.day] += 1;
    let hasThin = false;
    for (let d = 0; d < 5; d++) {
      if (shiftsPerDay[d] === 1) {
        hasThin = true;
        break;
      }
    }
    if (hasThin) thinWeeks.push(week.weekStart);
  }
  if (thinWeeks.length > 0) {
    const label = thinWeeks.slice(0, 3).map(shortDateOf).join(", ");
    const more = thinWeeks.length > 3 ? ` +${thinWeeks.length - 3} more` : "";
    out.push({
      id: "coverage-month",
      title: "Thin coverage",
      detail: `${thinWeeks.length} week${thinWeeks.length === 1 ? "" : "s"} with a weekday at only one shift — ${label}${more}.`,
      tone: "warning",
    });
  }

  if (out.length === 0) {
    out.push({
      id: "ok-month",
      title: "Schedule looks good",
      detail: `No overtime, coverage, or penalty concerns flagged across these ${weeks.length} weeks.`,
      tone: "success",
    });
  }

  return out;
}
