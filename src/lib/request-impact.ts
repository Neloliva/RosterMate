import { formatRange } from "./time";
import type {
  CoverageRules,
  Shift,
  Staff,
  StaffRequestCoverageDelta,
  StaffRequestImpact,
  StaffRequestImpactPerson,
} from "./types";

export function computeRequestImpact(args: {
  requesterId: string;
  requestType: "swap" | "unavailable";
  weekStart: string | null;
  day: number | null;
  shiftId: string | null;
  shifts: Shift[]; // shifts for requester's week
  activeStaff: Staff[];
  coverageRules: CoverageRules;
}): StaffRequestImpact {
  const {
    requesterId,
    requestType,
    weekStart,
    day,
    shiftId,
    shifts,
    activeStaff,
    coverageRules,
  } = args;

  const requester = activeStaff.find((s) => s.id === requesterId);
  const requesterRole = requester?.role ?? null;

  // Locate the at-risk shift so we can show a time range + know the role.
  let atRiskShift: Shift | null = null;
  if (shiftId) {
    atRiskShift = shifts.find((s) => s.id === shiftId) ?? null;
  } else if (weekStart !== null && day !== null) {
    atRiskShift =
      shifts.find(
        (s) => s.staffId === requesterId && s.day === day,
      ) ?? null;
  }

  // Without a concrete day we can't compute coverage. Return a minimal shape.
  const targetDay = atRiskShift?.day ?? day;
  if (targetDay === null) {
    return {
      shiftLabel: null,
      requesterRole,
      othersWorking: [],
      couldCover: [],
      coverageIfApproved: null,
    };
  }

  const shiftLabel = atRiskShift
    ? formatRange(atRiskShift.startHour, atRiskShift.endHour)
    : null;

  const staffById = new Map(activeStaff.map((s) => [s.id, s]));
  const dayShifts = shifts.filter((s) => s.day === targetDay);
  const busyStaffIds = new Set(dayShifts.map((s) => s.staffId));

  const othersWorking = dayShifts
    .filter((s) => s.staffId !== requesterId)
    .map((s) => {
      const person = staffById.get(s.staffId);
      return {
        firstName: person ? firstNameOf(person.name) : "—",
        role: person?.role ?? "",
        startHour: s.startHour,
        endHour: s.endHour,
      };
    })
    .sort((a, b) => a.startHour - b.startHour);

  // Hours-this-week for each candidate so manager can see overtime risk.
  const hoursById = new Map<string, number>();
  for (const s of shifts) {
    const dur = Math.max(0, s.endHour - s.startHour);
    hoursById.set(s.staffId, (hoursById.get(s.staffId) ?? 0) + dur);
  }

  const couldCover: StaffRequestImpactPerson[] = activeStaff
    .filter(
      (s) =>
        s.id !== requesterId &&
        s.isActive !== false &&
        !busyStaffIds.has(s.id),
    )
    .map((s) => ({
      staffId: s.id,
      firstName: firstNameOf(s.name),
      role: s.role,
      sameRole: requesterRole ? s.role === requesterRole : false,
      prefersDayOff:
        s.preferences?.preferredDaysOff.includes(targetDay) ?? false,
      hoursThisWeek: round1(hoursById.get(s.id) ?? 0),
    }))
    // Same-role first, then those who don't prefer the day off, then by name.
    .sort((a, b) => {
      if (a.sameRole !== b.sameRole) return a.sameRole ? -1 : 1;
      if (a.prefersDayOff !== b.prefersDayOff)
        return a.prefersDayOff ? 1 : -1;
      return a.firstName.localeCompare(b.firstName);
    });

  // Coverage delta: only meaningful when approval would actually remove a
  // shift (unavailable + we found a concrete shift on this day). Swap
  // approvals don't change staffing.
  let coverageIfApproved: StaffRequestCoverageDelta | null = null;
  const wouldDropShift =
    requestType === "unavailable" && atRiskShift !== null;
  const hasRule =
    coverageRules.perDay[targetDay] !== null ||
    (coverageRules.role !== null && coverageRules.roleCount !== null);
  if (wouldDropShift && hasRule) {
    const currentStaff = busyStaffIds.size;
    const afterStaff = busyStaffIds.has(requesterId)
      ? currentStaff - 1
      : currentStaff;
    const roleCurrent = coverageRules.role
      ? [...busyStaffIds].filter(
          (id) => staffById.get(id)?.role === coverageRules.role,
        ).length
      : 0;
    const roleAfter =
      coverageRules.role && requester?.role === coverageRules.role
        ? roleCurrent - 1
        : roleCurrent;
    coverageIfApproved = {
      required: coverageRules.perDay[targetDay],
      currentStaff,
      afterStaff,
      roleName: coverageRules.role,
      roleRequired: coverageRules.role ? coverageRules.roleCount : null,
      roleCurrent,
      roleAfter,
    };
  }

  return {
    shiftLabel,
    requesterRole,
    othersWorking,
    couldCover,
    coverageIfApproved,
  };
}

function firstNameOf(full: string): string {
  return full.split(/\s+/)[0] ?? full;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
