import type { Shift, Staff } from "./types";

// Industry-generic award rules. Covers the "Big 5" in spirit — the shape is
// what matters here, not the exact Fair Work figures.
export type AwardRules = {
  name: string;
  penalty: {
    saturday: number;
    sunday: number;
    publicHoliday: number;
    nightHoursStart: number; // inclusive — night starts at this hour
    nightHoursEnd: number; // exclusive — night ends before this hour (next morning)
    nightLoading: number;
  };
  casualLoading: number;
};

export const HOSPITALITY_AWARD: AwardRules = {
  name: "Restaurant Industry Award",
  penalty: {
    saturday: 1.25,
    sunday: 1.5,
    publicHoliday: 2.5,
    nightHoursStart: 19, // 7pm
    nightHoursEnd: 7, // 7am
    nightLoading: 1.15,
  },
  casualLoading: 1.25,
};

export type CostBreakdown = {
  hours: number;
  breakHours: number;
  paidHours: number;
  gross: number;
  cost: number;
  perHour: number;
};

export type PenaltyLevel = "standard" | "elevated" | "high";

export type LineItem = {
  label: string;
  detail: string;
  amount: number;
};

export type ItemizedBreakdown = {
  hours: number;
  paidHours: number;
  breakMinutes: number;
  baseRate: number;
  base: number;
  weekendPremium: number;
  nightPremium: number;
  casualPremium: number;
  total: number;
  level: PenaltyLevel;
  lines: LineItem[];
};

// Break rules: <5h none, 5-9h → 30m, ≥9h → 60m.
export function breakMinutes(hours: number): number {
  if (hours < 5) return 0;
  if (hours < 9) return 30;
  return 60;
}

function isWeekend(day: number): "saturday" | "sunday" | null {
  // 0 = Monday ... 6 = Sunday
  if (day === 5) return "saturday";
  if (day === 6) return "sunday";
  return null;
}

function isNightHour(hour: number, rules: AwardRules): boolean {
  // Hour slot [hour, hour+1). Night window wraps midnight.
  const { nightHoursStart, nightHoursEnd } = rules.penalty;
  return hour >= nightHoursStart || hour < nightHoursEnd;
}

export function calculateShiftCost(
  shift: Shift,
  staff: Staff,
  rules: AwardRules = HOSPITALITY_AWARD,
): CostBreakdown {
  const hours = Math.max(0, shift.endHour - shift.startHour);
  if (hours === 0) {
    return {
      hours: 0,
      breakHours: 0,
      paidHours: 0,
      gross: 0,
      cost: 0,
      perHour: 0,
    };
  }

  const weekend = isWeekend(shift.day);
  const weekendMult =
    weekend === "saturday"
      ? rules.penalty.saturday
      : weekend === "sunday"
        ? rules.penalty.sunday
        : 1;
  const casualMult =
    staff.employmentType === "casual" ? rules.casualLoading : 1;

  // Walk the shift in 15-min slices so night/day transitions are accurate.
  const sliceHours = 0.25;
  let gross = 0;
  for (let t = shift.startHour; t < shift.endHour - 1e-9; t += sliceHours) {
    const slice = Math.min(sliceHours, shift.endHour - t);
    const hourOfDay = Math.floor(t);
    const nightMult = isNightHour(hourOfDay, rules)
      ? rules.penalty.nightLoading
      : 1;
    const rate = staff.baseRate * weekendMult * nightMult * casualMult;
    gross += rate * slice;
  }

  const breakH = breakMinutes(hours) / 60;
  const paidHours = Math.max(0, hours - breakH);
  const cost = gross * (paidHours / hours);

  return {
    hours,
    breakHours: breakH,
    paidHours,
    gross: Math.round(gross * 100) / 100,
    cost: Math.round(cost),
    perHour: Math.round((cost / Math.max(paidHours, 0.0001)) * 100) / 100,
  };
}

// Attribution order: base → weekend → night → casual.
// Each premium is the marginal dollar impact of applying that multiplier on top
// of the previous layers, so the four components sum exactly to the total.
export function itemizeShiftCost(
  shift: Shift,
  staff: Staff,
  rules: AwardRules = HOSPITALITY_AWARD,
): ItemizedBreakdown {
  const hours = Math.max(0, shift.endHour - shift.startHour);
  if (hours === 0) {
    return {
      hours: 0,
      paidHours: 0,
      breakMinutes: 0,
      baseRate: staff.baseRate,
      base: 0,
      weekendPremium: 0,
      nightPremium: 0,
      casualPremium: 0,
      total: 0,
      level: "standard",
      lines: [],
    };
  }

  const weekend = isWeekend(shift.day);
  const weekendMult =
    weekend === "saturday"
      ? rules.penalty.saturday
      : weekend === "sunday"
        ? rules.penalty.sunday
        : 1;
  const casualMult =
    staff.employmentType === "casual" ? rules.casualLoading : 1;

  const sliceHours = 0.25;
  let baseGross = 0;
  let weekendGross = 0;
  let nightGross = 0;
  let casualGross = 0;
  let hasNightSlice = false;

  for (let t = shift.startHour; t < shift.endHour - 1e-9; t += sliceHours) {
    const slice = Math.min(sliceHours, shift.endHour - t);
    const hourOfDay = Math.floor(t);
    const nightMult = isNightHour(hourOfDay, rules)
      ? rules.penalty.nightLoading
      : 1;
    if (nightMult > 1) hasNightSlice = true;

    const br = staff.baseRate;
    baseGross += br * slice;
    weekendGross += br * (weekendMult - 1) * slice;
    nightGross += br * weekendMult * (nightMult - 1) * slice;
    casualGross +=
      br * weekendMult * nightMult * (casualMult - 1) * slice;
  }

  const totalGross = baseGross + weekendGross + nightGross + casualGross;
  const breakH = breakMinutes(hours) / 60;
  const paidHours = Math.max(0, hours - breakH);
  const paidRatio = paidHours / hours;

  const base = baseGross * paidRatio;
  const weekendPremium = weekendGross * paidRatio;
  const nightPremium = nightGross * paidRatio;
  const casualPremium = casualGross * paidRatio;
  const total = totalGross * paidRatio;

  const level: PenaltyLevel =
    weekend && hasNightSlice
      ? "high"
      : weekend || hasNightSlice
        ? "elevated"
        : "standard";

  const lines: LineItem[] = [];
  lines.push({
    label: "Base rate",
    detail: `$${staff.baseRate.toFixed(2)}/hr × ${formatHours(paidHours)}`,
    amount: round2(base),
  });
  if (weekendPremium > 0.5) {
    const pct = Math.round((weekendMult - 1) * 100);
    lines.push({
      label: weekend === "sunday" ? "Sunday penalty" : "Saturday penalty",
      detail: `+${pct}%`,
      amount: round2(weekendPremium),
    });
  }
  if (nightPremium > 0.5) {
    const pct = Math.round((rules.penalty.nightLoading - 1) * 100);
    lines.push({
      label: "Night loading",
      detail: `+${pct}% (7pm–7am)`,
      amount: round2(nightPremium),
    });
  }
  if (casualPremium > 0.5) {
    const pct = Math.round((rules.casualLoading - 1) * 100);
    lines.push({
      label: "Casual loading",
      detail: `+${pct}%`,
      amount: round2(casualPremium),
    });
  }

  return {
    hours,
    paidHours,
    breakMinutes: breakMinutes(hours),
    baseRate: staff.baseRate,
    base: round2(base),
    weekendPremium: round2(weekendPremium),
    nightPremium: round2(nightPremium),
    casualPremium: round2(casualPremium),
    total: Math.round(total),
    level,
    lines,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatHours(h: number): string {
  if (Math.abs(h - Math.round(h)) < 0.01) return `${Math.round(h)}h`;
  return `${h.toFixed(2)}h`;
}
