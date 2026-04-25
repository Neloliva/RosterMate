import { eq, inArray } from "drizzle-orm";
import { RosterWorkspace } from "@/components/RosterWorkspace";
import { db } from "@/db/client";
import {
  businessSettings as settingsTable,
  shifts as shiftsTable,
  staff as staffTable,
  staffRequestAttachments as attachmentsTable,
  staffRequests as staffRequestsTable,
} from "@/db/schema";
import { calculateShiftCost } from "@/lib/award";
import { addDays, startOfWeek } from "@/lib/date";
import { emptyCoverageRules, parseCoverageRules } from "@/lib/coverage";
import {
  DEFAULT_LEAVE_CATEGORIES,
  parseLeaveCategories,
} from "@/lib/leave-categories";
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
  leaveReasonCategories: [...DEFAULT_LEAVE_CATEGORIES],
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
        leaveReasonCategories: parseLeaveCategories(
          settingsRow.leaveReasonCategories,
        ),
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
  // request is for a week outside the visible window. We gather them two
  // ways so shifts referenced by requests always resolve:
  //   (1) requests with an explicit weekStart — fetch that week
  //   (2) requests with a shiftId — fetch that specific shift row directly,
  //       since the shift's week may be outside any requestWeeks we derived
  const requestShiftRowById = new Map(shiftRows.map((r) => [r.id, r]));
  const requestWeeks = new Set<string>();
  const missingShiftIds = new Set<string>();
  for (const r of pendingRequestRows) {
    if (r.weekStart) requestWeeks.add(r.weekStart);
    if (r.shiftId) {
      const sh = requestShiftRowById.get(r.shiftId);
      if (sh) {
        requestWeeks.add(sh.weekStart);
      } else {
        missingShiftIds.add(r.shiftId);
      }
    }
  }
  const missingWeeks = [...requestWeeks].filter(
    (w) => !allWeekStarts.includes(w),
  );
  const [extraWeekShiftRows, extraShiftByIdRows] = await Promise.all([
    missingWeeks.length
      ? db
          .select()
          .from(shiftsTable)
          .where(inArray(shiftsTable.weekStart, missingWeeks))
      : Promise.resolve([]),
    missingShiftIds.size
      ? db
          .select()
          .from(shiftsTable)
          .where(inArray(shiftsTable.id, [...missingShiftIds]))
      : Promise.resolve([]),
  ]);
  // Dedupe any overlap between the two extra queries.
  const extraSeen = new Set<string>();
  const extraShiftRows: typeof shiftRows = [];
  for (const r of [...extraWeekShiftRows, ...extraShiftByIdRows]) {
    if (extraSeen.has(r.id)) continue;
    extraSeen.add(r.id);
    extraShiftRows.push(r);
  }

  const shiftsByWeek: Record<string, Shift[]> = {};
  for (const ws of allWeekStarts) shiftsByWeek[ws] = [];
  for (const ws of missingWeeks) shiftsByWeek[ws] = [];
  // A shift fetched by ID might sit in a week we didn't pre-seed; make sure
  // the bucket exists so impact/coverage computation works for it.
  for (const r of extraShiftRows) {
    if (!shiftsByWeek[r.weekStart]) shiftsByWeek[r.weekStart] = [];
  }
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

  // Also load the full week's shifts for any shift we fetched by ID — we
  // need the whole day's schedule to tell whether the proposed swap
  // partner is already rostered that day. Without this the "free that day"
  // flag wouldn't work for requests on weeks outside our visible window.
  const partnerWeeksToLoad = new Set<string>();
  for (const r of extraShiftByIdRows) {
    const bucket = shiftsByWeek[r.weekStart] ?? [];
    // If we only have one entry in the bucket (the one we fetched by ID),
    // that's a sign the whole-week query was skipped — queue it.
    if (bucket.length <= 1) partnerWeeksToLoad.add(r.weekStart);
  }
  if (partnerWeeksToLoad.size) {
    const more = await db
      .select()
      .from(shiftsTable)
      .where(inArray(shiftsTable.weekStart, [...partnerWeeksToLoad]));
    for (const r of more) {
      if (extraSeen.has(r.id)) continue;
      extraSeen.add(r.id);
      const shift: Shift = {
        id: r.id,
        staffId: r.staffId,
        day: r.day,
        startHour: r.startHour,
        endHour: r.endHour,
        cost: r.cost,
      };
      (shiftsByWeek[r.weekStart] ??= []).push(shift);
      extraShiftRows.push(r);
    }
  }
  const shifts = shiftsByWeek[weekStart] ?? [];

  const staffNameById = new Map(staff.map((s) => [s.id, s.name]));
  const shiftRowById = new Map(
    [...shiftRows, ...extraShiftRows].map((r) => [r.id, r]),
  );
  const activeStaff = staff.filter((s) => s.isActive !== false);

  // Attachments metadata for all pending requests (just summaries — the
  // actual BLOBs are streamed on demand via the /api route).
  const pendingRequestIds = pendingRequestRows.map((r) => r.id);
  const attachmentRows = pendingRequestIds.length
    ? await db
        .select({
          id: attachmentsTable.id,
          requestId: attachmentsTable.requestId,
          filename: attachmentsTable.filename,
          mimeType: attachmentsTable.mimeType,
          sizeBytes: attachmentsTable.sizeBytes,
        })
        .from(attachmentsTable)
        .where(inArray(attachmentsTable.requestId, pendingRequestIds))
    : [];
  const attachmentsByRequest = new Map<
    string,
    { id: string; filename: string; mimeType: string; sizeBytes: number }[]
  >();
  for (const att of attachmentRows) {
    const list = attachmentsByRequest.get(att.requestId) ?? [];
    list.push({
      id: att.id,
      filename: att.filename,
      mimeType: att.mimeType,
      sizeBytes: att.sizeBytes,
    });
    attachmentsByRequest.set(att.requestId, list);
  }
  const pendingRequests: StaffRequest[] = pendingRequestRows
    .map((row) => {
      const shiftRow = row.shiftId ? shiftRowById.get(row.shiftId) : null;
      const shiftLabel = shiftRow
        ? formatRange(shiftRow.startHour, shiftRow.endHour)
        : null;
      // The week that matters for coverage: prefer the request's explicit
      // weekStart, fall back to the shift's week (swap/time_change requests
      // carry a shiftId but no explicit weekStart).
      const impactWeek = row.weekStart ?? shiftRow?.weekStart ?? null;
      // Coverage impact only applies to approvals that actually remove a
      // shift (unavailable) or hand it off (swap). A time_change keeps the
      // same person on the same day, so coverage is unchanged.
      const impact =
        impactWeek && row.type !== "time_change"
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

      // Swap-partner lookup — always resolve the name (staffNameById covers
      // every staff row regardless of shift availability) and compute the
      // "free that day" flag only when we have the shift loaded.
      let proposedSwapWithName: string | null = null;
      let proposedSwapWithIsFreeThatDay = false;
      if (row.proposedSwapWithStaffId) {
        proposedSwapWithName =
          staffNameById.get(row.proposedSwapWithStaffId) ?? "Unknown";
        if (shiftRow) {
          const theirShifts = shiftsByWeek[shiftRow.weekStart] ?? [];
          proposedSwapWithIsFreeThatDay = !theirShifts.some(
            (s) =>
              s.staffId === row.proposedSwapWithStaffId &&
              s.day === shiftRow.day,
          );
        }
      }

      const reqType: StaffRequest["type"] =
        row.type === "swap"
          ? "swap"
          : row.type === "time_change"
            ? "time_change"
            : "unavailable";

      // Cost + hour deltas for time_change so the manager sees the impact
      // before approving. currentStart/End comes from the shift; proposed*
      // comes from the request.
      let currentCost: number | null = null;
      let proposedCost: number | null = null;
      if (shiftRow) {
        currentCost = shiftRow.cost;
      }
      if (
        row.type === "time_change" &&
        shiftRow &&
        typeof row.proposedStartHour === "number" &&
        typeof row.proposedEndHour === "number"
      ) {
        const person = activeStaff.find((s) => s.id === shiftRow.staffId);
        if (person) {
          const preview = calculateShiftCost(
            {
              id: "preview",
              staffId: shiftRow.staffId,
              day: shiftRow.day,
              startHour: row.proposedStartHour,
              endHour: row.proposedEndHour,
              cost: 0,
            },
            person,
          );
          proposedCost = preview.cost;
        }
      }

      return {
        id: row.id,
        staffId: row.staffId,
        staffName: staffNameById.get(row.staffId) ?? "Former staff",
        type: reqType,
        shiftId: row.shiftId,
        shiftLabel,
        // Fall back to shiftRow's week/day when the request didn't store
        // them explicitly (swap + time_change carry shiftId instead).
        weekStart: row.weekStart ?? shiftRow?.weekStart ?? null,
        day: row.day ?? shiftRow?.day ?? null,
        note: row.note,
        reasonCategory: row.reasonCategory ?? null,
        proposedStartHour: row.proposedStartHour ?? null,
        proposedEndHour: row.proposedEndHour ?? null,
        currentStartHour: shiftRow?.startHour ?? null,
        currentEndHour: shiftRow?.endHour ?? null,
        currentCost,
        proposedCost,
        proposedSwapWithStaffId: row.proposedSwapWithStaffId ?? null,
        proposedSwapWithName,
        proposedSwapWithIsFreeThatDay,
        partnerConfirmationStatus:
          (row.partnerConfirmationStatus ?? null) as
            | "requested"
            | "agreed"
            | "declined"
            | null,
        createdAt: row.createdAt,
        status: "pending",
        impact,
        attachments: attachmentsByRequest.get(row.id) ?? [],
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
