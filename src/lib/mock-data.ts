import type { EmploymentType, Insight, Kpi, Staff } from "./types";

export const SEED_WEEK_START = "2026-03-24"; // matches the dashboard mockup

// Eventually sourced from business onboarding/settings.
export type BusinessType = "cafe" | "retail" | "hospitality" | "healthcare";

export const BUSINESS_TYPE: BusinessType = "cafe";

export const STAFF_DEFAULTS: Record<
  BusinessType,
  { role: string; employmentType: EmploymentType; baseRate: number }
> = {
  cafe: { role: "Barista", employmentType: "casual", baseRate: 21.98 },
  retail: {
    role: "Sales Assistant",
    employmentType: "part_time",
    baseRate: 22.56,
  },
  hospitality: {
    role: "Server",
    employmentType: "casual",
    baseRate: 21.38,
  },
  healthcare: {
    role: "Care Worker",
    employmentType: "part_time",
    baseRate: 24.02,
  },
};

export const KPIS: Kpi[] = [
  {
    id: "total_labor_cost",
    label: "Total Labor Cost",
    value: "$6,247",
    delta: "$234 vs last week",
    trend: "up",
    sensitive: true,
  },
  {
    id: "staff_hours",
    label: "Staff Hours",
    value: "287",
    delta: "12hrs vs last week",
    trend: "down",
  },
  {
    id: "staff_scheduled",
    label: "Staff Scheduled",
    value: "8",
    delta: "Same as last week",
    trend: "flat",
  },
  {
    id: "avg_cost_per_hour",
    label: "Avg Cost/Hour",
    value: "$21.78",
    delta: "$0.45 vs last week",
    trend: "down",
    sensitive: true,
  },
];

export const STAFF: Staff[] = [
  {
    id: "sarah",
    name: "Sarah Mitchell",
    role: "Supervisor",
    initials: "SM",
    hoursThisWeek: 38,
    availability: "available",
    baseRate: 25.4,
    employmentType: "full_time",
  },
  {
    id: "mike",
    name: "Mike Chen",
    role: "Barista",
    initials: "MC",
    hoursThisWeek: 32,
    availability: "available",
    baseRate: 21.98,
    employmentType: "casual",
  },
  {
    id: "emma",
    name: "Emma Rodriguez",
    role: "Server",
    initials: "ER",
    hoursThisWeek: 36,
    availability: "limited",
    baseRate: 21.38,
    employmentType: "casual",
  },
  {
    id: "james",
    name: "James Wilson",
    role: "Kitchen Hand",
    initials: "JW",
    hoursThisWeek: 30,
    availability: "available",
    baseRate: 22.13,
    employmentType: "casual",
  },
];

export const INSIGHTS: Insight[] = [
  {
    title: "Peak Hour Coverage",
    detail: "Friday 12-2pm needs one more server based on sales history",
  },
  {
    title: "Cost Optimization",
    detail:
      "Move Emma's Saturday shift 1 hour earlier to save $27 in penalties",
  },
  {
    title: "Staff Performance",
    detail: "Mike's morning shifts generate 15% higher coffee sales",
  },
];

export const SAVINGS = {
  amount: 189,
  opportunities: 3,
  shiftsToAdjust: 4,
};
