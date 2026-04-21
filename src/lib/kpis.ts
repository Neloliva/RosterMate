import { breakMinutes } from "./award";
import type { Kpi, Shift } from "./types";

function paidHoursOf(shift: Shift): number {
  const h = Math.max(0, shift.endHour - shift.startHour);
  return Math.max(0, h - breakMinutes(h) / 60);
}

type Totals = {
  cost: number;
  hours: number;
  staffCount: number;
  avgCostPerHour: number;
};

function totalsOf(shifts: Shift[]): Totals {
  let cost = 0;
  let hours = 0;
  const ids = new Set<string>();
  for (const s of shifts) {
    cost += s.cost;
    hours += paidHoursOf(s);
    ids.add(s.staffId);
  }
  return {
    cost,
    hours,
    staffCount: ids.size,
    avgCostPerHour: hours > 0 ? cost / hours : 0,
  };
}

function delta(
  current: number,
  prior: number,
  priorHasData: boolean,
  format: (abs: number) => string,
  suffix: string,
  tolerance = 0.005,
): { delta: string; trend: Kpi["trend"] } {
  if (!priorHasData) return { delta: "No prior data", trend: "flat" };
  const diff = current - prior;
  if (Math.abs(diff) < tolerance) {
    // "vs last week" → "Same as last week"
    return {
      delta: `Same as ${suffix.replace(/^vs /, "")}`,
      trend: "flat",
    };
  }
  return {
    delta: `${format(Math.abs(diff))} ${suffix}`,
    trend: diff > 0 ? "up" : "down",
  };
}

export function computeKpis(
  currentShifts: Shift[],
  priorShifts: Shift[],
  suffix: string,
): Kpi[] {
  const c = totalsOf(currentShifts);
  const p = totalsOf(priorShifts);
  const priorHas = priorShifts.length > 0;

  const fmtDollars = (n: number) => `$${Math.round(n).toLocaleString()}`;
  const fmtCents = (n: number) => `$${n.toFixed(2)}`;
  const fmtHours = (n: number) => `${Math.round(n)}hrs`;
  const fmtCount = (n: number) => `${Math.round(n)}`;

  const costDelta = delta(c.cost, p.cost, priorHas, fmtDollars, suffix, 0.5);
  const hoursDelta = delta(c.hours, p.hours, priorHas, fmtHours, suffix, 0.5);
  const staffDelta = delta(
    c.staffCount,
    p.staffCount,
    priorHas,
    fmtCount,
    suffix,
    0.5,
  );
  const avgDelta = delta(
    c.avgCostPerHour,
    p.avgCostPerHour,
    priorHas,
    fmtCents,
    suffix,
  );

  return [
    {
      id: "total_labor_cost",
      label: "Total Labor Cost",
      value: fmtDollars(c.cost),
      delta: costDelta.delta,
      trend: costDelta.trend,
      sensitive: true,
    },
    {
      id: "staff_hours",
      label: "Staff Hours",
      value: `${Math.round(c.hours)}`,
      delta: hoursDelta.delta,
      trend: hoursDelta.trend,
    },
    {
      id: "staff_scheduled",
      label: "Staff Scheduled",
      value: `${c.staffCount}`,
      delta: staffDelta.delta,
      trend: staffDelta.trend,
    },
    {
      id: "avg_cost_per_hour",
      label: "Avg Cost/Hour",
      value: fmtCents(c.avgCostPerHour),
      delta: avgDelta.delta,
      trend: avgDelta.trend,
      sensitive: true,
    },
  ];
}
