import type { EmploymentType, Insight, Kpi, Staff } from "./types";

export const SEED_WEEK_START = "2026-03-24"; // matches the dashboard mockup

// Eight business presets. Rates below are plausible demo values, NOT live
// Fair Work award rates. See DEFERRED.md for what genuine award coverage
// would require.
export const BUSINESS_TYPES = [
  { id: "cafe", label: "Cafe / Restaurant" },
  { id: "retail", label: "Retail Store" },
  { id: "beauty", label: "Hair / Beauty Salon" },
  { id: "medical", label: "Medical Practice" },
  { id: "aged_care", label: "Aged Care Facility" },
  { id: "manufacturing", label: "Manufacturing" },
  { id: "fast_food", label: "Fast Food" },
  { id: "cleaning", label: "Cleaning Services" },
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number]["id"];

export const BUSINESS_TYPE: BusinessType = "cafe";

export type RoleOption = { role: string; baseRate: number };

export const ROLE_CATALOG: Record<BusinessType, RoleOption[]> = {
  cafe: [
    { role: "Barista", baseRate: 21.98 },
    { role: "Kitchen Hand", baseRate: 21.38 },
    { role: "Food & Beverage Attendant L1", baseRate: 21.38 },
    { role: "Food & Beverage Attendant L2", baseRate: 21.98 },
    { role: "Cook Grade 1", baseRate: 22.13 },
    { role: "Cook Grade 2", baseRate: 22.44 },
    { role: "Supervisor", baseRate: 23.15 },
  ],
  retail: [
    { role: "Sales Assistant", baseRate: 22.56 },
    { role: "Cashier", baseRate: 22.56 },
    { role: "Stock Hand", baseRate: 22.0 },
    { role: "Department Supervisor", baseRate: 24.0 },
    { role: "Store Manager", baseRate: 27.5 },
  ],
  beauty: [
    { role: "Hairdresser", baseRate: 22.47 },
    { role: "Beauty Therapist", baseRate: 22.47 },
    { role: "Apprentice (1st year)", baseRate: 11.22 },
    { role: "Apprentice (3rd year)", baseRate: 17.0 },
    { role: "Apprentice (4th year)", baseRate: 20.0 },
    { role: "Salon Manager", baseRate: 26.0 },
  ],
  medical: [
    { role: "Receptionist", baseRate: 23.0 },
    { role: "Medical Assistant", baseRate: 24.0 },
    { role: "Practice Nurse", baseRate: 33.0 },
    { role: "Registered Nurse", baseRate: 35.0 },
    { role: "Practice Manager", baseRate: 32.0 },
  ],
  aged_care: [
    { role: "Care Worker", baseRate: 24.02 },
    { role: "Senior Care Worker", baseRate: 25.5 },
    { role: "Enrolled Nurse", baseRate: 28.0 },
    { role: "Registered Nurse", baseRate: 35.0 },
    { role: "Cleaner", baseRate: 22.0 },
  ],
  manufacturing: [
    { role: "Production Worker", baseRate: 23.0 },
    { role: "Forklift Operator", baseRate: 24.5 },
    { role: "Machine Operator", baseRate: 24.0 },
    { role: "Warehouse Attendant", baseRate: 23.0 },
    { role: "Team Leader", baseRate: 27.0 },
  ],
  fast_food: [
    { role: "Crew Member", baseRate: 21.0 },
    { role: "Cook", baseRate: 22.0 },
    { role: "Cashier", baseRate: 21.0 },
    { role: "Shift Supervisor", baseRate: 23.5 },
    { role: "Assistant Manager", baseRate: 26.0 },
  ],
  cleaning: [
    { role: "Cleaner (Level 1)", baseRate: 22.0 },
    { role: "Cleaner (Level 2)", baseRate: 23.5 },
    { role: "Window Cleaner", baseRate: 24.0 },
    { role: "Supervisor", baseRate: 25.0 },
  ],
};

export const STAFF_DEFAULTS: Record<
  BusinessType,
  { role: string; employmentType: EmploymentType; baseRate: number }
> = {
  cafe: { role: "Barista", employmentType: "casual", baseRate: 21.98 },
  retail: { role: "Sales Assistant", employmentType: "part_time", baseRate: 22.56 },
  beauty: { role: "Hairdresser", employmentType: "part_time", baseRate: 22.47 },
  medical: { role: "Receptionist", employmentType: "part_time", baseRate: 23.0 },
  aged_care: { role: "Care Worker", employmentType: "part_time", baseRate: 24.02 },
  manufacturing: { role: "Production Worker", employmentType: "full_time", baseRate: 23.0 },
  fast_food: { role: "Crew Member", employmentType: "casual", baseRate: 21.0 },
  cleaning: { role: "Cleaner (Level 1)", employmentType: "casual", baseRate: 22.0 },
};

export const EMPLOYMENT_TYPE_OPTIONS: Array<{
  value: EmploymentType;
  label: string;
}> = [
  { value: "casual", label: "Casual" },
  { value: "part_time", label: "Part-time" },
  { value: "full_time", label: "Full-time" },
  { value: "fixed_term", label: "Fixed-term" },
  { value: "apprentice", label: "Apprentice" },
  { value: "trainee", label: "Trainee" },
];

export const QUALIFICATIONS: Array<{ id: string; label: string }> = [
  { id: "rsa", label: "Responsible Service of Alcohol" },
  { id: "food_safety", label: "Food Safety Certificate" },
  { id: "first_aid", label: "First Aid" },
  { id: "forklift", label: "Forklift License" },
  { id: "wwcc", label: "Working With Children Check" },
];

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
