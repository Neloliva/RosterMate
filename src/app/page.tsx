import { eq, inArray } from "drizzle-orm";
import { RosterWorkspace } from "@/components/RosterWorkspace";
import { db } from "@/db/client";
import {
  businessSettings as settingsTable,
  shifts as shiftsTable,
  staff as staffTable,
  staffRequests as staffRequestsTable,
} from "@/db/schema";
import { addDays, startOfWeek } from "@/lib/date";
import { emptyCoverageRules, parseCoverageRules } from "@/lib/coverage";
import { computeRequestImpact } from "@/lib/request-impact";
import { formatRange } from "@/lib/time";
import { parseStaffPreferences } from "@/lib/staff-preferences";
import type {
  AvailabilityStatus,
  BusinessSettings,
  EmploymentType,
  Role,
  Shift,
  Staff,
  StaffRequest,
} from "@/lib/types";

export const MONTH_WEEK_COUNT = 4;

type ViewMode = "week" | "month";

const DEFAULT_SETTINGS: BusinessSettings = {
  businessName: "My Business",
  businessType: "cafe",
  penaltyTargetPct: 15,
  overtimeHours: 38,
  defaultView: "week",
  contactPhone: null,
  contactEmail: null,
  coverageRules: emptyCoverageRules(),
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ weekStart?: string; view?: string }>;
}) {
  const params = await searchParams;

  const settingsRows = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.id, "default"));
  const settingsRow = settingsRows[0];
  const settings: BusinessSettings = settingsRow
    ? {
        businessName: settingsRow.businessName,
        businessType: settingsRow.businessType,
        penaltyTargetPct: settingsRow.penaltyTargetPct,
        overtimeHours: settingsRow.overtimeHours,
        defaultView:
          settingsRow.defaultView === "month" ? "month" : "week",
        contactPhone: settingsRow.contactPhone ?? null,
        contactEmail: settingsRow.contactEmail ?? null,
        coverageRules: parseCoverageRules(settingsRow.coverageRules),
      }
    : DEFAULT_SETTINGS;

  const weekStart = params.weekStart ?? startOfWeek(new Date());
  const view: ViewMode =
    params.view === "month"
      ? "month"
      : params.view === "week"
        ? "week"
        : settings.defaultView;
  const scopeWeeks = view === "month" ? MONTH_WEEK_COUNT : 1;

  // Current scope: 1 week (week view) or 4 weeks (month view).
  const currentWeekStarts = Array.from({ length: scopeWeeks }, (_, i) =>
    addDays(weekStart, i * 7),
  );
  // Prior scope: equal-length window immediately preceding the current one.
  const priorAnchor = addDays(weekStart, -scopeWeeks * 7);
  const priorWeekStarts = Array.from({ length: scopeWeeks }, (_, i) =>
    addDays(priorAnchor, i * 7),
  );
  const allWeekStarts = [...currentWeekStarts, ...priorWeekStarts];

  const [staffRows, shiftRows, pendingRequestRows] = await Promise.all([
    db.select().from(staffTable),
    db
      .select()
      .from(shiftsTable)
      .where(inArray(shiftsTable.weekStart, allWeekStarts)),
    db
      .select()
      .from(staffRequestsTable)
      .where(eq(staffRequestsTable.status, "pending")),
  ]);

  const staff: Staff[] = staffRows.map((r) => {
    let qualifications: string[] = [];
    try {
      const parsed = JSON.parse(r.qualifications ?? "[]");
      if (Array.isArray(parsed))
        qualifications = parsed.filter((x): x is string => typeof x === "string");
    } catch {
      // ignore malformed
    }
    return {
      id: r.id,
      name: r.name,
      role: r.role as Role,
      initials: r.initials,
      hoursThisWeek: r.hoursThisWeek,
      availability: r.availability as AvailabilityStatus,
      baseRate: r.baseRate,
      employmentType: r.employmentType as EmploymentType,
      age: r.age ?? null,
      isJunior: Boolean(r.isJunior),
      qualifications,
      registrationNumber: r.registrationNumber ?? null,
      isActive: Boolean(r.isActive ?? true),
      viewToken: r.viewToken ?? null,
      preferences: parseStaffPreferences(r.availabilityPreferences),
    };
  });

  // Gather any weeks referenced by pending requests that aren't already in
  // scope, so the impact panel can show accurate coverage even when the
  // request is for a week outside the visible window.
  const requestShiftRowById = new Map(shiftRows.map((r) => [r.id, r]));
  const requestWeeks = new Set<string>();
  for (const r of pendingRequestRows) {
    if (r.weekStart) requestWeeks.add(r.weekStart);
    if (r.shiftId) {
      const sh = requestShiftRowById.get(r.shiftId);
      if (sh) requestWeeks.add(sh.weekStart);
    }
  }
  const missingWeeks = [...requestWeeks].filter(
    (w) => !allWeekStarts.includes(w),
  );
  const extraShiftRows = missingWeeks.length
    ? await db
        .select()
        .from(shiftsTable)
        .where(inArray(shiftsTable.weekStart, missingWeeks))
    : [];

  const shiftsByWeek: Record<string, Shift[]> = {};
  for (const ws of allWeekStarts) shiftsByWeek[ws] = [];
  for (const ws of missingWeeks) shiftsByWeek[ws] = [];
  for (const r of [...shiftRows, ...extraShiftRows]) {
    const shift: Shift = {
      id: r.id,
      staffId: r.staffId,
      day: r.day,
      startHour: r.startHour,
      endHour: r.endHour,
      cost: r.cost,
    };
    if (shiftsByWeek[r.weekStart]) {
      shiftsByWeek[r.weekStart].push(shift);
    }
  }
  const shifts = shiftsByWeek[weekStart] ?? [];

  const staffNameById = new Map(staff.map((s) => [s.id, s.name]));
  const shiftRowById = new Map(
    [...shiftRows, ...extraShiftRows].map((r) => [r.id, r]),
  );
  const activeStaff = staff.filter((s) => s.isActive !== false);
  const pendingRequests: StaffRequest[] = pendingRequestRows
    .map((row) => {
      const shiftRow = row.shiftId ? shiftRowById.get(row.shiftId) : null;
      const shiftLabel = shiftRow
        ? formatRange(shiftRow.startHour, shiftRow.endHour)
        : null;
      // The week that matters for coverage: prefer the request's explicit
      // weekStart, fall back to the shift's week (swap requests carry a
      // shiftId but no weekStart).
      const impactWeek = row.weekStart ?? shiftRow?.weekStart ?? null;
      const impact = impactWeek
        ? computeRequestImpact({
            requesterId: row.staffId,
            requestType: row.type === "swap" ? "swap" : "unavailable",
            weekStart: impactWeek,
            day: row.day ?? shiftRow?.day ?? null,
            shiftId: row.shiftId ?? null,
            shifts: shiftsByWeek[impactWeek] ?? [],
            activeStaff,
            coverageRules: settings.coverageRules,
          })
        : undefined;
      return {
        id: row.id,
        staffId: row.staffId,
        staffName: staffNameById.get(row.staffId) ?? "Former staff",
        type: row.type === "swap" ? "swap" : "unavailable",
        shiftId: row.shiftId,
        shiftLabel,
        weekStart: row.weekStart,
        day: row.day,
        note: row.note,
        createdAt: row.createdAt,
        status: "pending",
        impact,
      } satisfies StaffRequest;
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-6">
      <RosterWorkspace
        view={view}
        weekStart={weekStart}
        staff={staff}
        shifts={shifts}
        shiftsByWeek={shiftsByWeek}
        priorWeekStarts={priorWeekStarts}
        settings={settings}
        pendingRequests={pendingRequests}
      />
    </main>
  );
}
