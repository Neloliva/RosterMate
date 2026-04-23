"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { staff, staffRequests } from "@/db/schema";

const MAX_NOTE_LENGTH = 500;

async function resolveStaff(token: string) {
  if (!token) throw new Error("Missing token");
  const rows = await db
    .select()
    .from(staff)
    .where(eq(staff.viewToken, token));
  if (rows.length === 0) throw new Error("Invalid staff link");
  const row = rows[0];
  if (row.isActive === false) {
    throw new Error("This staff account has been removed");
  }
  return row;
}

function requestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function submitSwapRequest(input: {
  token: string;
  shiftId: string;
  note?: string;
}) {
  const s = await resolveStaff(input.token);
  const note = (input.note ?? "").slice(0, MAX_NOTE_LENGTH).trim() || null;
  await db.insert(staffRequests).values({
    id: requestId(),
    staffId: s.id,
    type: "swap",
    shiftId: input.shiftId,
    note,
    status: "pending",
    createdAt: new Date().toISOString(),
  });
  revalidatePath("/");
  revalidatePath(`/staff/${input.token}`);
}

export async function submitUnavailable(input: {
  token: string;
  weekStart: string;
  day: number;
  note?: string;
}) {
  const s = await resolveStaff(input.token);
  if (!Number.isInteger(input.day) || input.day < 0 || input.day > 6) {
    throw new Error("Invalid day");
  }
  const note = (input.note ?? "").slice(0, MAX_NOTE_LENGTH).trim() || null;
  await db.insert(staffRequests).values({
    id: requestId(),
    staffId: s.id,
    type: "unavailable",
    weekStart: input.weekStart,
    day: input.day,
    note,
    status: "pending",
    createdAt: new Date().toISOString(),
  });
  revalidatePath("/");
  revalidatePath(`/staff/${input.token}`);
}

