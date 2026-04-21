"use server";

import { and, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { businessSettings, shifts, staff } from "@/db/schema";
import { calculateShiftCost } from "@/lib/award";
import { addDays } from "@/lib/date";
import { initialsOf } from "@/lib/initials";
import type { EmploymentType, Shift } from "@/lib/types";

function newId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function loadStaff(staffId: string) {
  const rows = await db.select().from(staff).where(eq(staff.id, staffId));
  if (rows.length === 0) throw new Error(`Unknown staff ${staffId}`);
  const s = rows[0];
  return {
    id: s.id,
    name: s.name,
    role: s.role as never,
    initials: s.initials,
    hoursThisWeek: s.hoursThisWeek,
    availability: s.availability as never,
    baseRate: s.baseRate,
    employmentType: s.employmentType as EmploymentType,
  };
}

function costFor(
  person: Awaited<ReturnType<typeof loadStaff>>,
  day: number,
  startHour: number,
  endHour: number,
) {
  return calculateShiftCost(
    {
      id: "preview",
      staffId: person.id,
      day,
      startHour,
      endHour,
      cost: 0,
    },
    person,
  ).cost;
}

export async function upsertShift(input: {
  id?: string;
  weekStart: string;
  staffId: string;
  day: number;
  startHour: number;
  endHour: number;
}) {
  const person = await loadStaff(input.staffId);
  const cost = costFor(person, input.day, input.startHour, input.endHour);

  // Clear any other shift already occupying the target cell.
  const cellConflict = and(
    eq(shifts.weekStart, input.weekStart),
    eq(shifts.staffId, input.staffId),
    eq(shifts.day, input.day),
  );
  await db
    .delete(shifts)
    .where(input.id ? and(cellConflict, ne(shifts.id, input.id)) : cellConflict);

  if (input.id) {
    await db
      .update(shifts)
      .set({
        weekStart: input.weekStart,
        staffId: input.staffId,
        day: input.day,
        startHour: input.startHour,
        endHour: input.endHour,
        cost,
      })
      .where(eq(shifts.id, input.id));
  } else {
    await db.insert(shifts).values({
      id: newId("sh"),
      weekStart: input.weekStart,
      staffId: input.staffId,
      day: input.day,
      startHour: input.startHour,
      endHour: input.endHour,
      cost,
    });
  }

  revalidatePath("/");
}

export async function moveShift(input: {
  id: string;
  weekStart: string;
  toStaffId: string;
  toDay: number;
}) {
  const rows = await db.select().from(shifts).where(eq(shifts.id, input.id));
  if (rows.length === 0) return;
  const shift = rows[0];
  const person = await loadStaff(input.toStaffId);
  const cost = costFor(person, input.toDay, shift.startHour, shift.endHour);

  // Clear any existing shift at the destination.
  await db
    .delete(shifts)
    .where(
      and(
        eq(shifts.weekStart, input.weekStart),
        eq(shifts.staffId, input.toStaffId),
        eq(shifts.day, input.toDay),
      ),
    );

  await db
    .update(shifts)
    .set({
      staffId: input.toStaffId,
      day: input.toDay,
      cost,
    })
    .where(eq(shifts.id, input.id));

  revalidatePath("/");
}

export async function deleteShift(id: string) {
  await db.delete(shifts).where(eq(shifts.id, id));
  revalidatePath("/");
}

export async function copyLastWeek(currentWeekStart: string): Promise<{
  copied: number;
  available: number;
}> {
  const lastWeekStart = addDays(currentWeekStart, -7);

  const [lastWeekRows, currentWeekRows] = await Promise.all([
    db.select().from(shifts).where(eq(shifts.weekStart, lastWeekStart)),
    db.select().from(shifts).where(eq(shifts.weekStart, currentWeekStart)),
  ]);

  if (lastWeekRows.length === 0) {
    return { copied: 0, available: 0 };
  }

  const occupied = new Set(
    currentWeekRows.map((s) => `${s.staffId}:${s.day}`),
  );
  const toInsert = lastWeekRows.filter(
    (s) => !occupied.has(`${s.staffId}:${s.day}`),
  );

  if (toInsert.length > 0) {
    await db.insert(shifts).values(
      toInsert.map((s) => ({
        id: newId("sh"),
        weekStart: currentWeekStart,
        staffId: s.staffId,
        day: s.day,
        startHour: s.startHour,
        endHour: s.endHour,
        cost: s.cost,
      })),
    );
    revalidatePath("/");
  }

  return { copied: toInsert.length, available: lastWeekRows.length };
}

export async function addStaff(input: {
  name: string;
  role: string;
  employmentType: EmploymentType;
  baseRate: number;
  businessType?: string;
  age?: number | null;
  isJunior?: boolean;
  qualifications?: string[];
  registrationNumber?: string | null;
}) {
  const name = input.name.trim();
  if (!name) throw new Error("Name is required");
  if (!(input.baseRate > 0)) throw new Error("Base rate must be positive");

  const quals = Array.isArray(input.qualifications)
    ? input.qualifications.filter((q): q is string => typeof q === "string")
    : [];
  const reg = (input.registrationNumber ?? "").trim() || null;

  await db.insert(staff).values({
    id: newId("st"),
    name,
    role: input.role.trim() || "Staff",
    initials: initialsOf(name),
    baseRate: input.baseRate,
    employmentType: input.employmentType,
    hoursThisWeek: 0,
    availability: "available",
    businessType: input.businessType ?? null,
    age: input.age ?? null,
    isJunior: Boolean(input.isJunior),
    qualifications: JSON.stringify(quals),
    registrationNumber: reg,
  });

  revalidatePath("/");
}

export async function updateBusinessSettings(input: {
  businessName: string;
  businessType: string;
  penaltyTargetPct: number;
  overtimeHours: number;
  defaultView: "week" | "month";
}) {
  const name = input.businessName.trim();
  if (!name) throw new Error("Business name is required");
  if (!(input.penaltyTargetPct >= 0 && input.penaltyTargetPct <= 100)) {
    throw new Error("Penalty target must be between 0 and 100");
  }
  if (!Number.isInteger(input.overtimeHours) || input.overtimeHours < 1) {
    throw new Error("Overtime threshold must be a positive whole number");
  }
  if (input.defaultView !== "week" && input.defaultView !== "month") {
    throw new Error("Default view must be week or month");
  }

  await db
    .update(businessSettings)
    .set({
      businessName: name,
      businessType: input.businessType,
      penaltyTargetPct: input.penaltyTargetPct,
      overtimeHours: input.overtimeHours,
      defaultView: input.defaultView,
    })
    .where(eq(businessSettings.id, "default"));

  revalidatePath("/");
}

export async function copyLastMonth(currentWeekStart: string): Promise<{
  copied: number;
  available: number;
}> {
  // Take the 4 weeks prior and map them onto the current week plus the next
  // three, in order. Same "fill empties only" rule as copyLastWeek.
  const targetWeeks = [0, 1, 2, 3].map((i) => addDays(currentWeekStart, i * 7));
  const sourceWeeks = targetWeeks.map((ws) => addDays(ws, -28));
  const allWeeks = [...sourceWeeks, ...targetWeeks];

  const rows = await db
    .select()
    .from(shifts)
    .where(inArray(shifts.weekStart, allWeeks));

  const bySource = new Map<string, typeof rows>();
  const byTarget = new Map<string, typeof rows>();
  for (const ws of sourceWeeks) bySource.set(ws, []);
  for (const ws of targetWeeks) byTarget.set(ws, []);
  for (const r of rows) {
    if (bySource.has(r.weekStart)) bySource.get(r.weekStart)!.push(r);
    if (byTarget.has(r.weekStart)) byTarget.get(r.weekStart)!.push(r);
  }

  let available = 0;
  const inserts: {
    id: string;
    weekStart: string;
    staffId: string;
    day: number;
    startHour: number;
    endHour: number;
    cost: number;
  }[] = [];

  for (let i = 0; i < targetWeeks.length; i++) {
    const src = bySource.get(sourceWeeks[i]) ?? [];
    const tgt = byTarget.get(targetWeeks[i]) ?? [];
    available += src.length;
    const occupied = new Set(tgt.map((s) => `${s.staffId}:${s.day}`));
    for (const s of src) {
      if (!occupied.has(`${s.staffId}:${s.day}`)) {
        inserts.push({
          id: newId("sh"),
          weekStart: targetWeeks[i],
          staffId: s.staffId,
          day: s.day,
          startHour: s.startHour,
          endHour: s.endHour,
          cost: s.cost,
        });
      }
    }
  }

  if (inserts.length > 0) {
    await db.insert(shifts).values(inserts);
    revalidatePath("/");
  }

  return { copied: inserts.length, available };
}

export async function fetchRangeShifts(
  weekStarts: string[],
): Promise<Record<string, Shift[]>> {
  const out: Record<string, Shift[]> = {};
  for (const ws of weekStarts) out[ws] = [];
  if (weekStarts.length === 0) return out;
  const rows = await db
    .select()
    .from(shifts)
    .where(inArray(shifts.weekStart, weekStarts));
  for (const r of rows) {
    if (!out[r.weekStart]) out[r.weekStart] = [];
    out[r.weekStart].push({
      id: r.id,
      staffId: r.staffId,
      day: r.day,
      startHour: r.startHour,
      endHour: r.endHour,
      cost: r.cost,
    });
  }
  return out;
}
