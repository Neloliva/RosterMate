export type Role = string;

export const COMMON_ROLES: Role[] = [
  "Supervisor",
  "Barista",
  "Server",
  "Kitchen Hand",
  "Cook",
  "Cleaner",
];

export type AvailabilityStatus = "available" | "limited" | "unavailable";

export type EmploymentType =
  | "casual"
  | "part_time"
  | "full_time"
  | "fixed_term"
  | "apprentice"
  | "trainee";

export type Staff = {
  id: string;
  name: string;
  role: Role;
  initials: string;
  hoursThisWeek: number;
  availability: AvailabilityStatus;
  baseRate: number; // award base hourly rate
  employmentType: EmploymentType;
  age?: number | null;
  isJunior?: boolean;
  qualifications?: string[];
  registrationNumber?: string | null;
};

export type Shift = {
  id: string;
  staffId: string;
  day: number; // 0 = Monday ... 6 = Sunday
  startHour: number; // 0..24 (float allowed)
  endHour: number; // 0..24, 24 = midnight end-of-day
  cost: number;
};

export type TrendDirection = "up" | "down" | "flat";

export type Kpi = {
  id: string;
  label: string;
  value: string;
  delta: string;
  trend: TrendDirection;
  sensitive?: boolean;
};

export type Insight = {
  title: string;
  detail: string;
};

export type BusinessSettings = {
  businessName: string;
  businessType: string;
  penaltyTargetPct: number;
  overtimeHours: number;
  defaultView: "week" | "month";
};
