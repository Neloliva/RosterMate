"use server";

import { and, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { shifts, staff } from "@/db/schema";
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
}) {
  const name = input.name.trim();
  if (!name) throw new Error("Name is required");
  if (!(input.baseRate > 0)) throw new Error("Base rate must be positive");

  await db.insert(staff).values({
    id: newId("st"),
    name,
    role: input.role.trim() || "Staff",
    initials: initialsOf(name),
    baseRate: input.baseRate,
    employmentType: input.employmentType,
    hoursThisWeek: 0,
    availability: "available",
  });

  revalidatePath("/");
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
