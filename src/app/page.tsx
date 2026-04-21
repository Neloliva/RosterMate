import { inArray } from "drizzle-orm";
import { RosterWorkspace } from "@/components/RosterWorkspace";
import { db } from "@/db/client";
import { shifts as shiftsTable, staff as staffTable } from "@/db/schema";
import { addDays, startOfWeek } from "@/lib/date";
import type {
  AvailabilityStatus,
  EmploymentType,
  Role,
  Shift,
  Staff,
} from "@/lib/types";

export const MONTH_WEEK_COUNT = 4;

type ViewMode = "week" | "month";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ weekStart?: string; view?: string }>;
}) {
  const params = await searchParams;
  const weekStart = params.weekStart ?? startOfWeek(new Date());
  const view: ViewMode = params.view === "month" ? "month" : "week";
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

  const [staffRows, shiftRows] = await Promise.all([
    db.select().from(staffTable),
    db
      .select()
      .from(shiftsTable)
      .where(inArray(shiftsTable.weekStart, allWeekStarts)),
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
    };
  });

  const shiftsByWeek: Record<string, Shift[]> = {};
  for (const ws of allWeekStarts) shiftsByWeek[ws] = [];
  for (const r of shiftRows) {
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

  return (
    <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-6">
      <RosterWorkspace
        view={view}
        weekStart={weekStart}
        staff={staff}
        shifts={shifts}
        shiftsByWeek={shiftsByWeek}
        priorWeekStarts={priorWeekStarts}
      />
    </main>
  );
}
