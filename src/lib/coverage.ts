import type { CoverageRules, Shift, Staff } from "./types";

export function emptyCoverageRules(): CoverageRules {
  return {
    perDay: [null, null, null, null, null, null, null],
    role: null,
    roleCount: null,
  };
}

export function parseCoverageRules(
  raw: string | null | undefined,
): CoverageRules {
  if (!raw) return emptyCoverageRules();
  let obj: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw);
    obj =
      parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : {};
  } catch {
    return emptyCoverageRules();
  }

  const rawPerDay = Array.isArray(obj.perDay) ? obj.perDay : [];
  const perDay: (number | null)[] = Array.from({ length: 7 }, (_, i) => {
    const v = rawPerDay[i];
    return typeof v === "number" && Number.isFinite(v) && v >= 0
      ? Math.floor(v)
      : null;
  });
  const role = typeof obj.role === "string" && obj.role.trim() ? obj.role : null;
  const rc = obj.roleCount;
  const roleCount =
    typeof rc === "number" && Number.isFinite(rc) && rc >= 1
      ? Math.floor(rc)
      : null;

  return { perDay, role, roleCount };
}

export function serializeCoverageRules(rules: CoverageRules): string {
  const perDay = Array.from({ length: 7 }, (_, i) => {
    const v = rules.perDay[i];
    return typeof v === "number" && Number.isFinite(v) && v >= 0
      ? Math.floor(v)
      : null;
  });
  const role = rules.role && rules.role.trim() ? rules.role.trim() : null;
  const roleCount =
    role && typeof rules.roleCount === "number" && rules.roleCount >= 1
      ? Math.floor(rules.roleCount)
      : null;
  return JSON.stringify({ perDay, role, roleCount });
}

export type DayCoverage = {
  day: number; // 0 = Mon ... 6 = Sun
  staffed: number;
  required: number | null;
  roleStaffed: number;
  roleRequired: number | null;
  roleName: string | null;
  met: boolean;
  // True when the manager configured any rule for this day.
  hasRule: boolean;
};

export function computeDayCoverage(args: {
  shifts: Shift[]; // shifts for the week being inspected
  staff: Staff[]; // must include role lookup; inactive filtered by caller
  rules: CoverageRules;
}): DayCoverage[] {
  const { shifts, staff, rules } = args;
  const roleById = new Map(staff.map((s) => [s.id, s.role]));
  const byDay = new Map<number, Set<string>>();
  for (let d = 0; d < 7; d++) byDay.set(d, new Set());
  for (const s of shifts) {
    const bucket = byDay.get(s.day);
    if (bucket) bucket.add(s.staffId);
  }

  return Array.from({ length: 7 }, (_, day) => {
    const ids = byDay.get(day) ?? new Set();
    const staffed = ids.size;
    const required = rules.perDay[day];

    let roleStaffed = 0;
    if (rules.role) {
      for (const id of ids) {
        if (roleById.get(id) === rules.role) roleStaffed++;
      }
    }
    const roleRequired = rules.role ? rules.roleCount : null;

    const staffOk = required === null || staffed >= required;
    const roleOk = roleRequired === null || roleStaffed >= roleRequired;
    const hasRule = required !== null || roleRequired !== null;

    return {
      day,
      staffed,
      required,
      roleStaffed,
      roleRequired,
      roleName: rules.role,
      met: !hasRule ? true : staffOk && roleOk,
      hasRule,
    };
  });
}

export function countDaysMet(coverage: DayCoverage[]): {
  met: number;
  checked: number;
} {
  let met = 0;
  let checked = 0;
  for (const d of coverage) {
    if (!d.hasRule) continue;
    checked++;
    if (d.met) met++;
  }
  return { met, checked };
}
