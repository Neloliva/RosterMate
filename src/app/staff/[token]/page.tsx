import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { notFound } from "next/navigation";
import { StaffPageClient } from "@/components/StaffPageClient";
import { db } from "@/db/client";
import {
  businessSettings as settingsTable,
  shifts as shiftsTable,
  staff as staffTable,
  staffRequestAttachments as attachmentsTable,
  staffRequests as staffRequestsTable,
} from "@/db/schema";
import { addDays, daysForWeek, startOfWeek } from "@/lib/date";
import { parseLeaveCategories } from "@/lib/leave-categories";
import { holidaysForWeekStarts } from "@/lib/public-holidays";
import type { Shift, Staff } from "@/lib/types";

const WEEKS_VISIBLE = 4;

export default async function StaffPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!token) notFound();

  const meRows = await db
    .select()
    .from(staffTable)
    .where(eq(staffTable.viewToken, token));
  const me = meRows[0];
  if (!me || me.isActive === false) notFound();

  // Anchor: this week + next 3. Use the system's today to find the Monday.
  const anchor = startOfWeek(new Date());
  const weekStarts = Array.from({ length: WEEKS_VISIBLE }, (_, i) =>
    addDays(anchor, i * 7),
  );
  const firstWeek = weekStarts[0];
  const lastWeek = weekStarts[weekStarts.length - 1];

  // Resolved requests (approved + declined) surface on the staff portal for
  // a short window: approved as a top-of-page acknowledgement, declined as
  // both an acknowledgement and a persistent row chip with the reason. 48h
  // is long enough for a weekend shift lifecycle, short enough to avoid clutter.
  const resolvedSince = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const [
    allStaffRows,
    shiftRows,
    settingsRows,
    myPendingRows,
    myResolvedRows,
    partnerAwaitingRows,
  ] = await Promise.all([
    db
      .select({
        id: staffTable.id,
        name: staffTable.name,
        initials: staffTable.initials,
        role: staffTable.role,
        isActive: staffTable.isActive,
      })
      .from(staffTable)
      .where(eq(staffTable.isActive, true)),
    db
      .select()
      .from(shiftsTable)
      .where(
        and(
          gte(shiftsTable.weekStart, firstWeek),
          lte(shiftsTable.weekStart, lastWeek),
        ),
      ),
    db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.id, "default")),
    db
      .select()
      .from(staffRequestsTable)
      .where(
        and(
          eq(staffRequestsTable.staffId, me.id),
          eq(staffRequestsTable.status, "pending"),
        ),
      ),
    db
      .select()
      .from(staffRequestsTable)
      .where(
        and(
          eq(staffRequestsTable.staffId, me.id),
          inArray(staffRequestsTable.status, ["approved", "declined"]),
          gte(staffRequestsTable.resolvedAt, resolvedSince),
        ),
      ),
    // Requests where this staff is the named swap partner and hasn't
    // responded yet. Drives the "Awaiting your confirmation" card.
    db
      .select()
      .from(staffRequestsTable)
      .where(
        and(
          eq(staffRequestsTable.proposedSwapWithStaffId, me.id),
          eq(staffRequestsTable.status, "pending"),
          eq(staffRequestsTable.partnerConfirmationStatus, "requested"),
        ),
      ),
  ]);

  const myDeclinedRows = myResolvedRows.filter(
    (r) => r.status === "declined",
  );

  const businessName = settingsRows[0]?.businessName ?? "Your Business";
  const contactPhone = settingsRows[0]?.contactPhone ?? null;
  const contactEmail = settingsRows[0]?.contactEmail ?? null;
  const leaveCategories = parseLeaveCategories(
    settingsRows[0]?.leaveReasonCategories,
  );

  // Strip to first name + role for the team view. Never expose last names,
  // pay, or full staff metadata via this surface.
  const teamById = new Map<
    string,
    { id: string; firstName: string; initials: string; role: string }
  >();
  for (const s of allStaffRows) {
    teamById.set(s.id, {
      id: s.id,
      firstName: s.name.split(/\s+/)[0] ?? s.name,
      initials: s.initials,
      role: s.role,
    });
  }

  const shiftsByWeek: Record<string, Shift[]> = {};
  for (const ws of weekStarts) shiftsByWeek[ws] = [];
  for (const r of shiftRows) {
    if (r.staffId !== me.id) continue;
    const bucket = shiftsByWeek[r.weekStart];
    if (!bucket) continue;
    bucket.push({
      id: r.id,
      staffId: r.staffId,
      day: r.day,
      startHour: r.startHour,
      endHour: r.endHour,
      cost: r.cost,
    });
  }

  // Today + tomorrow as (weekStart, dayIdx) pairs for the hero card.
  // The app treats day 0 of a weekStart as Monday regardless of JS day.
  const now = new Date();
  const jsDay = now.getDay();
  const todayDayIdx = jsDay === 0 ? 6 : jsDay - 1;
  const todayIso = now.toISOString().slice(0, 10);
  // Decimal hour-of-day (0..24) for past/current/future gating on the client,
  // computed once on the server so SSR and hydration agree.
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const tomorrowIso = addDays(todayIso, 1);
  const todayWeekStart = anchor;
  const tomorrowDayIdx = todayDayIdx === 6 ? 0 : todayDayIdx + 1;
  const tomorrowWeekStart =
    todayDayIdx === 6 ? addDays(anchor, 7) : anchor;

  function pickDayShifts(weekStart: string, dayIdx: number) {
    return shiftRows
      .filter((r) => r.weekStart === weekStart && r.day === dayIdx)
      .sort((a, b) => a.startHour - b.startHour);
  }

  function slotFromRows(
    rows: typeof shiftRows,
    weekStart: string,
    dayIdx: number,
    iso: string,
  ) {
    const mine = rows.find((r) => r.staffId === me.id) ?? null;
    const others = rows
      .filter((r) => r.staffId !== me.id)
      .map((r) => {
        const t = teamById.get(r.staffId);
        return {
          id: r.id,
          staffFirstName: t?.firstName ?? "—",
          startHour: r.startHour,
          endHour: r.endHour,
        };
      });
    return {
      weekStart,
      dayIdx,
      iso,
      mine: mine
        ? {
            id: mine.id,
            startHour: mine.startHour,
            endHour: mine.endHour,
          }
        : null,
      others,
    };
  }

  const todayRows = pickDayShifts(todayWeekStart, todayDayIdx);
  const tomorrowRows = pickDayShifts(tomorrowWeekStart, tomorrowDayIdx);
  const today = slotFromRows(todayRows, todayWeekStart, todayDayIdx, todayIso);
  const tomorrow = slotFromRows(
    tomorrowRows,
    tomorrowWeekStart,
    tomorrowDayIdx,
    tomorrowIso,
  );

  // Pending-request keys for row tinting.
  const pendingSwapShiftIds: string[] = [];
  const pendingUnavailableKeys: string[] = [];
  for (const r of myPendingRows) {
    if (r.type === "swap" && r.shiftId) {
      pendingSwapShiftIds.push(r.shiftId);
    } else if (
      r.type === "unavailable" &&
      r.weekStart &&
      typeof r.day === "number"
    ) {
      pendingUnavailableKeys.push(`${r.weekStart}:${r.day}`);
    }
  }

  // Shifts referenced by requests (mine + ones asking me to swap) may sit
  // outside the visible 4-week window. Fetch those by ID so the "Awaiting
  // your confirmation" card and the My requests rows always render the
  // correct shift time and day, not just the labelless fallback.
  const referencedShiftIds = new Set<string>();
  for (const r of [...myPendingRows, ...myResolvedRows, ...partnerAwaitingRows]) {
    if (r.shiftId) referencedShiftIds.add(r.shiftId);
  }
  const loadedShiftIds = new Set(shiftRows.map((r) => r.id));
  const missingShiftIds = [...referencedShiftIds].filter(
    (id) => !loadedShiftIds.has(id),
  );
  const extraShiftRows = missingShiftIds.length
    ? await db
        .select()
        .from(shiftsTable)
        .where(inArray(shiftsTable.id, missingShiftIds))
    : [];

  // Recently-declined requests: one per (weekStart:day) so the staff portal
  // can tag the affected row with a "Declined" chip and show the manager's
  // optional reason. Swap declines key off the shift's cell via shiftRows.
  const shiftRowById = new Map(
    [...shiftRows, ...extraShiftRows].map((r) => [r.id, r]),
  );
  const declinedByKey: Record<
    string,
    {
      type: "swap" | "unavailable" | "time_change";
      reason: string | null;
      resolvedAt: string;
    }
  > = {};
  for (const r of myDeclinedRows) {
    if (!r.resolvedAt) continue;
    let key: string | null = null;
    if (r.type === "unavailable" && r.weekStart && typeof r.day === "number") {
      key = `${r.weekStart}:${r.day}`;
    } else if ((r.type === "swap" || r.type === "time_change") && r.shiftId) {
      const sh = shiftRowById.get(r.shiftId);
      if (sh) key = `${sh.weekStart}:${sh.day}`;
    }
    if (!key) continue;
    // Keep the most recently resolved entry if multiple exist for the cell.
    const prev = declinedByKey[key];
    if (!prev || r.resolvedAt > prev.resolvedAt) {
      const chipType: "swap" | "unavailable" | "time_change" =
        r.type === "swap"
          ? "swap"
          : r.type === "time_change"
            ? "time_change"
            : "unavailable";
      declinedByKey[key] = {
        type: chipType,
        reason: r.resolutionNote ?? null,
        resolvedAt: r.resolvedAt,
      };
    }
  }

  // Recent resolutions (approved + declined in the 48h window) power the
  // dismissible "Recent updates" banner at the top of the portal. The client
  // filters these against a localStorage "seen" set so each shows once.
  const recentResolutions = myResolvedRows
    .filter((r) => !!r.resolvedAt)
    .map((r) => {
      const dayIdx = r.day;
      let resolvedWeekStart: string | null = r.weekStart;
      let resolvedDay: number | null =
        typeof dayIdx === "number" ? dayIdx : null;
      // Swap and time_change carry a shiftId, not explicit weekStart/day.
      // Recover them from the shift so the banner can show the date.
      if (
        (r.type === "swap" || r.type === "time_change") &&
        r.shiftId
      ) {
        const sh = shiftRowById.get(r.shiftId);
        if (sh) {
          resolvedWeekStart = sh.weekStart;
          resolvedDay = sh.day;
        }
      }
      const bannerType: "swap" | "unavailable" | "time_change" =
        r.type === "swap"
          ? "swap"
          : r.type === "time_change"
            ? "time_change"
            : "unavailable";
      return {
        id: r.id,
        type: bannerType,
        status:
          r.status === "approved" ? ("approved" as const) : ("declined" as const),
        weekStart: resolvedWeekStart,
        day: resolvedDay,
        reason: r.resolutionNote ?? null,
        resolvedAt: r.resolvedAt as string,
      };
    })
    .sort((a, b) => (a.resolvedAt < b.resolvedAt ? 1 : -1));

  // Attachment summaries for every request in scope — the actual BLOBs are
  // streamed on demand via the /api/request-attachments route.
  const myRequestIds = [
    ...myPendingRows.map((r) => r.id),
    ...myResolvedRows.map((r) => r.id),
  ];
  const attachmentRows = myRequestIds.length
    ? await db
        .select({
          id: attachmentsTable.id,
          requestId: attachmentsTable.requestId,
          filename: attachmentsTable.filename,
          mimeType: attachmentsTable.mimeType,
          sizeBytes: attachmentsTable.sizeBytes,
        })
        .from(attachmentsTable)
        .where(inArray(attachmentsTable.requestId, myRequestIds))
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

  // Combined "My requests" list (pending + recently-resolved in the same 48h
  // window). Powers the glanceable status card at the top of the portal so
  // staff don't have to scroll to the affected week to know where a request
  // stands — relevant when they filed something 3 or 4 weeks out.
  const staffNameById = new Map<string, string>();
  for (const s of allStaffRows) {
    staffNameById.set(s.id, s.name.split(/\s+/)[0] ?? s.name);
  }

  function normaliseRequest(r: (typeof myResolvedRows)[number]) {
    let weekStart: string | null = r.weekStart;
    let day: number | null = typeof r.day === "number" ? r.day : null;
    // Both swap and time_change carry a shiftId instead of weekStart/day.
    if ((r.type === "swap" || r.type === "time_change") && r.shiftId) {
      const sh = shiftRowById.get(r.shiftId);
      if (sh) {
        weekStart = sh.weekStart;
        day = sh.day;
      }
    }
    const reqType: "swap" | "unavailable" | "time_change" =
      r.type === "swap"
        ? "swap"
        : r.type === "time_change"
          ? "time_change"
          : "unavailable";
    return {
      id: r.id,
      type: reqType,
      status:
        r.status === "approved"
          ? ("approved" as const)
          : r.status === "declined"
            ? ("declined" as const)
            : ("pending" as const),
      weekStart,
      day,
      note: r.note ?? null,
      reasonCategory: r.reasonCategory ?? null,
      proposedStartHour: r.proposedStartHour ?? null,
      proposedEndHour: r.proposedEndHour ?? null,
      proposedSwapWithName: r.proposedSwapWithStaffId
        ? (staffNameById.get(r.proposedSwapWithStaffId) ?? null)
        : null,
      partnerConfirmationStatus: (r.partnerConfirmationStatus ?? null) as
        | "requested"
        | "agreed"
        | "declined"
        | null,
      reason: r.resolutionNote ?? null,
      createdAt: r.createdAt,
      resolvedAt: r.resolvedAt ?? null,
      attachments: attachmentsByRequest.get(r.id) ?? [],
    };
  }

  // Requests where the current staff is the named swap partner and hasn't
  // responded yet. Flatten to the shape the "Awaiting your confirmation"
  // card needs: who's asking, the shift on offer, and any note.
  const partnerAwaiting = partnerAwaitingRows
    .map((r) => {
      const sh = r.shiftId ? shiftRowById.get(r.shiftId) : null;
      if (!sh) return null;
      return {
        id: r.id,
        requesterName: staffNameById.get(r.staffId) ?? "A teammate",
        weekStart: sh.weekStart,
        day: sh.day,
        startHour: sh.startHour,
        endHour: sh.endHour,
        note: r.note ?? null,
        createdAt: r.createdAt,
      };
    })
    .filter(
      (x): x is NonNullable<typeof x> => x !== null,
    )
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const myRequests = [
    ...myPendingRows.map(normaliseRequest),
    ...myResolvedRows.map(normaliseRequest),
  ].sort((a, b) => {
    // Pending first, then by most recent activity (resolvedAt or createdAt).
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (b.status === "pending" && a.status !== "pending") return 1;
    const aTs = a.resolvedAt ?? a.createdAt;
    const bTs = b.resolvedAt ?? b.createdAt;
    return aTs < bTs ? 1 : -1;
  });

  const holidays = holidaysForWeekStarts(weekStarts);
  const daysByWeek: Record<string, ReturnType<typeof daysForWeek>> = {};
  for (const ws of weekStarts) daysByWeek[ws] = daysForWeek(ws);

  // Most recent update timestamp across my visible shifts. NULL for pre-
  // migration seed rows — UI falls back to "not recorded".
  let myLastUpdatedAt: string | null = null;
  for (const r of shiftRows) {
    if (r.staffId !== me.id) continue;
    if (!r.updatedAt) continue;
    if (!myLastUpdatedAt || r.updatedAt > myLastUpdatedAt) {
      myLastUpdatedAt = r.updatedAt;
    }
  }

  const meLite: Pick<Staff, "id" | "name" | "role" | "initials"> = {
    id: me.id,
    name: me.name,
    role: me.role,
    initials: me.initials,
  };

  // Coworker roster (first names + roles only — privacy-safe for the staff
  // portal) and a busy-staff lookup so the Request-swap dialog can default
  // the "who to swap with" dropdown to people who are actually free on the
  // shift's day.
  const coworkers = allStaffRows
    .filter((s) => s.id !== me.id)
    .map((s) => ({
      id: s.id,
      firstName: s.name.split(/\s+/)[0] ?? s.name,
      role: s.role,
    }));
  const busyStaffByKey: Record<string, string[]> = {};
  for (const r of shiftRows) {
    const k = `${r.weekStart}:${r.day}`;
    (busyStaffByKey[k] ??= []).push(r.staffId);
  }

  return (
    <StaffPortalPageShell businessName={businessName}>
      <StaffPageClient
        token={token}
        businessName={businessName}
        me={meLite}
        weekStarts={weekStarts}
        shiftsByWeek={shiftsByWeek}
        daysByWeek={daysByWeek}
        holidays={holidays}
        today={today}
        tomorrow={tomorrow}
        todayIso={todayIso}
        pendingSwapShiftIds={pendingSwapShiftIds}
        pendingUnavailableKeys={pendingUnavailableKeys}
        declinedByKey={declinedByKey}
        recentResolutions={recentResolutions}
        myRequests={myRequests}
        leaveCategories={leaveCategories}
        coworkers={coworkers}
        busyStaffByKey={busyStaffByKey}
        partnerAwaiting={partnerAwaiting}
        contactPhone={contactPhone}
        contactEmail={contactEmail}
        lastUpdatedAt={myLastUpdatedAt}
        nowHour={nowHour}
      />
    </StaffPortalPageShell>
  );
}

function StaffPortalPageShell({
  businessName,
  children,
}: {
  businessName: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6">
      <header className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500 text-base font-bold text-white shadow-sm">
          R
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-900">
            {businessName}
          </div>
          <div className="text-[11px] text-slate-500">Staff schedule</div>
        </div>
      </header>
      {children}
    </main>
  );
}
