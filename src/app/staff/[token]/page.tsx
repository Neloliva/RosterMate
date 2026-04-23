import { and, eq, gte, lte } from "drizzle-orm";
import { notFound } from "next/navigation";
import { StaffPageClient } from "@/components/StaffPageClient";
import { db } from "@/db/client";
import {
  businessSettings as settingsTable,
  shifts as shiftsTable,
  staff as staffTable,
  staffRequests as staffRequestsTable,
} from "@/db/schema";
import { addDays, daysForWeek, startOfWeek } from "@/lib/date";
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

  // Declined requests surface on the staff portal for a short window so the
  // person sees why a day they asked off wasn't granted. 48h feels right:
  // long enough for a weekend shift lifecycle, short enough to avoid clutter.
  const declinedSince = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const [
    allStaffRows,
    shiftRows,
    settingsRows,
    myPendingRows,
    myDeclinedRows,
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
          eq(staffRequestsTable.status, "declined"),
          gte(staffRequestsTable.resolvedAt, declinedSince),
        ),
      ),
  ]);

  const businessName = settingsRows[0]?.businessName ?? "Your Business";
  const contactPhone = settingsRows[0]?.contactPhone ?? null;
  const contactEmail = settingsRows[0]?.contactEmail ?? null;

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

  // Recently-declined requests: one per (weekStart:day) so the staff portal
  // can tag the affected row with a "Declined" chip and show the manager's
  // optional reason. Swap declines key off the shift's cell via shiftRows.
  const shiftRowById = new Map(shiftRows.map((r) => [r.id, r]));
  const declinedByKey: Record<
    string,
    { type: "swap" | "unavailable"; reason: string | null; resolvedAt: string }
  > = {};
  for (const r of myDeclinedRows) {
    if (!r.resolvedAt) continue;
    let key: string | null = null;
    if (r.type === "unavailable" && r.weekStart && typeof r.day === "number") {
      key = `${r.weekStart}:${r.day}`;
    } else if (r.type === "swap" && r.shiftId) {
      const sh = shiftRowById.get(r.shiftId);
      if (sh) key = `${sh.weekStart}:${sh.day}`;
    }
    if (!key) continue;
    // Keep the most recently resolved entry if multiple exist for the cell.
    const prev = declinedByKey[key];
    if (!prev || r.resolvedAt > prev.resolvedAt) {
      declinedByKey[key] = {
        type: r.type === "swap" ? "swap" : "unavailable",
        reason: r.resolutionNote ?? null,
        resolvedAt: r.resolvedAt,
      };
    }
  }

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
