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

export type ShiftPreference = "morning" | "evening" | "any" | "";

export type StaffPreferences = {
  agreedSchedule: string;
  preferredDaysOff: number[]; // 0 = Monday ... 6 = Sunday
  preferredShift: ShiftPreference;
  notes: string;
  updatedAt?: string;
};

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
  isActive?: boolean;
  viewToken?: string | null;
  preferences?: StaffPreferences;
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

export type CoverageRules = {
  // Minimum distinct staff scheduled per weekday (0 = Mon ... 6 = Sun).
  // null = no minimum for that day.
  perDay: (number | null)[];
  // Optional role-specific floor — e.g. at least 1 Supervisor on duty.
  role: string | null;
  roleCount: number | null;
};

export type BusinessSettings = {
  businessName: string;
  businessType: string;
  penaltyTargetPct: number;
  overtimeHours: number;
  defaultView: "week" | "month";
  contactPhone?: string | null;
  contactEmail?: string | null;
  coverageRules: CoverageRules;
};

export type StaffRequestStatus = "pending" | "approved" | "declined";

export type StaffRequestImpactPerson = {
  staffId: string;
  firstName: string;
  role: string;
  sameRole: boolean;
  prefersDayOff: boolean;
  hoursThisWeek: number;
};

export type StaffRequestCoverageDelta = {
  required: number | null;
  currentStaff: number;
  afterStaff: number;
  roleName: string | null;
  roleRequired: number | null;
  roleCurrent: number;
  roleAfter: number;
};

export type StaffRequestImpact = {
  shiftLabel: string | null; // "9am-5pm" for the at-risk shift, if any
  requesterRole: string | null;
  othersWorking: {
    firstName: string;
    role: string;
    startHour: number;
    endHour: number;
  }[];
  couldCover: StaffRequestImpactPerson[];
  // Populated only when the request is "unavailable" and approving would
  // actually remove a shift. Null when no rules apply or no shift at risk.
  coverageIfApproved: StaffRequestCoverageDelta | null;
};

export type StaffRequest = {
  id: string;
  staffId: string;
  staffName: string;
  type: "swap" | "unavailable";
  shiftId?: string | null;
  shiftLabel?: string | null;
  weekStart?: string | null;
  day?: number | null;
  note?: string | null;
  createdAt: string;
  status?: StaffRequestStatus;
  resolvedAt?: string | null;
  impact?: StaffRequestImpact;
};
