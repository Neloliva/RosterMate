"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import {
  businessSettings,
  staff,
  staffRequestAttachments,
  staffRequests,
} from "@/db/schema";
import {
  normaliseCategoryInput,
  parseLeaveCategories,
} from "@/lib/leave-categories";

const MAX_NOTE_LENGTH = 500;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_ATTACHMENTS_PER_REQUEST = 3;
const MAX_FILENAME_LENGTH = 80;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
  "application/pdf",
]);

async function loadLeaveCategories(): Promise<string[]> {
  const rows = await db
    .select({ raw: businessSettings.leaveReasonCategories })
    .from(businessSettings)
    .where(eq(businessSettings.id, "default"));
  return parseLeaveCategories(rows[0]?.raw);
}

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
  // Intent split — a single action that records either flavour because the
  // staff portal surfaces them inside one dialog. If proposed hours are set
  // we treat it as a time-change; else it's a cover request.
  proposedStartHour?: number | null;
  proposedEndHour?: number | null;
  proposedSwapWithStaffId?: string | null;
}) {
  const s = await resolveStaff(input.token);
  const note = (input.note ?? "").slice(0, MAX_NOTE_LENGTH).trim() || null;

  const isTimeChange =
    typeof input.proposedStartHour === "number" &&
    typeof input.proposedEndHour === "number";

  // Validate time-change hours: sane range and end-after-start (overnight
  // shifts use end > 24 in the shift editor; we'll mirror that here by
  // letting end wrap if end < start).
  if (isTimeChange) {
    const s1 = input.proposedStartHour as number;
    const e1 = input.proposedEndHour as number;
    if (!Number.isFinite(s1) || !Number.isFinite(e1)) {
      throw new Error("Invalid proposed time");
    }
    if (s1 < 0 || s1 >= 24 || e1 < 0 || e1 > 24) {
      throw new Error("Times must be between 0:00 and 24:00");
    }
    if (s1 === e1) {
      throw new Error("Start and end times must differ");
    }
  }

  // Validate the proposed swap partner (if given) is a real, active staff
  // member and not the requester themselves.
  let proposedSwapWithStaffId: string | null = null;
  if (input.proposedSwapWithStaffId && !isTimeChange) {
    const partnerId = input.proposedSwapWithStaffId;
    if (partnerId === s.id) {
      throw new Error("Can't swap with yourself");
    }
    const partnerRows = await db
      .select({ id: staff.id, isActive: staff.isActive })
      .from(staff)
      .where(eq(staff.id, partnerId));
    const partner = partnerRows[0];
    if (!partner || partner.isActive === false) {
      throw new Error("Unknown staff member for swap");
    }
    proposedSwapWithStaffId = partnerId;
  }

  const partnerConfirmationStatus =
    !isTimeChange && proposedSwapWithStaffId ? "requested" : null;

  await db.insert(staffRequests).values({
    id: requestId(),
    staffId: s.id,
    type: isTimeChange ? "time_change" : "swap",
    shiftId: input.shiftId,
    note,
    proposedStartHour: isTimeChange
      ? (input.proposedStartHour as number)
      : null,
    proposedEndHour: isTimeChange ? (input.proposedEndHour as number) : null,
    proposedSwapWithStaffId,
    partnerConfirmationStatus,
    status: "pending",
    createdAt: new Date().toISOString(),
  });
  revalidatePath("/");
  revalidatePath(`/staff/${input.token}`);
  // If a partner was named, the partner's own portal needs to revalidate
  // so the "Awaiting your confirmation" section shows the new request.
  if (proposedSwapWithStaffId) {
    const partnerRows = await db
      .select({ token: staff.viewToken })
      .from(staff)
      .where(eq(staff.id, proposedSwapWithStaffId));
    const pt = partnerRows[0]?.token;
    if (pt) revalidatePath(`/staff/${pt}`);
  }
}

// Called by the proposed swap partner (James) on their own portal to
// accept or reject being paired. Token-auth ensures only James (not Emma,
// not anyone else) can resolve the partner handshake for this request.
async function loadPartnerPendingRequest(token: string, requestId: string) {
  const s = await resolveStaff(token);
  const rows = await db
    .select()
    .from(staffRequests)
    .where(
      and(
        eq(staffRequests.id, requestId),
        eq(staffRequests.proposedSwapWithStaffId, s.id),
        eq(staffRequests.status, "pending"),
      ),
    );
  const row = rows[0];
  if (!row) throw new Error("Request not found or no longer awaiting you");
  return { partner: s, request: row };
}

export async function confirmSwapAsPartner(input: {
  token: string;
  requestId: string;
}) {
  const { request } = await loadPartnerPendingRequest(
    input.token,
    input.requestId,
  );
  await db
    .update(staffRequests)
    .set({
      partnerConfirmationStatus: "agreed",
      partnerConfirmationAt: new Date().toISOString(),
    })
    .where(eq(staffRequests.id, input.requestId));
  // Manager dashboard + original requester's portal both need to refresh.
  revalidatePath("/");
  revalidatePath(`/staff/${input.token}`);
  const requesterRows = await db
    .select({ token: staff.viewToken })
    .from(staff)
    .where(eq(staff.id, request.staffId));
  const rt = requesterRows[0]?.token;
  if (rt) revalidatePath(`/staff/${rt}`);
}

export async function declineSwapAsPartner(input: {
  token: string;
  requestId: string;
}) {
  const { request } = await loadPartnerPendingRequest(
    input.token,
    input.requestId,
  );
  await db
    .update(staffRequests)
    .set({
      partnerConfirmationStatus: "declined",
      partnerConfirmationAt: new Date().toISOString(),
    })
    .where(eq(staffRequests.id, input.requestId));
  revalidatePath("/");
  revalidatePath(`/staff/${input.token}`);
  const requesterRows = await db
    .select({ token: staff.viewToken })
    .from(staff)
    .where(eq(staff.id, request.staffId));
  const rt = requesterRows[0]?.token;
  if (rt) revalidatePath(`/staff/${rt}`);
}

export async function submitUnavailable(input: {
  token: string;
  weekStart: string;
  day: number;
  note?: string;
  reasonCategory?: string | null;
}): Promise<{ id: string }> {
  const s = await resolveStaff(input.token);
  if (!Number.isInteger(input.day) || input.day < 0 || input.day > 6) {
    throw new Error("Invalid day");
  }
  const note = (input.note ?? "").slice(0, MAX_NOTE_LENGTH).trim() || null;
  // Validate the category against the admin's current list so clients can't
  // silently save an off-list label that won't show up in BI reports.
  const categories = await loadLeaveCategories();
  const reasonCategory = normaliseCategoryInput(
    input.reasonCategory ?? null,
    categories,
  );
  const id = requestId();
  await db.insert(staffRequests).values({
    id,
    staffId: s.id,
    type: "unavailable",
    weekStart: input.weekStart,
    day: input.day,
    note,
    reasonCategory,
    status: "pending",
    createdAt: new Date().toISOString(),
  });
  revalidatePath("/");
  revalidatePath(`/staff/${input.token}`);
  // Returned so callers that collect attachments in the same dialog can
  // chain uploadRequestAttachment calls without a round-trip to the DB.
  return { id };
}

// Staff-side CRUD: edit the note on a pending request, or cancel it outright.
// Both are restricted to requests owned by the token's staff and still in
// "pending" status — approved/declined requests are frozen history.

async function loadOwnPendingRequest(token: string, requestId: string) {
  const s = await resolveStaff(token);
  const rows = await db
    .select()
    .from(staffRequests)
    .where(
      and(
        eq(staffRequests.id, requestId),
        eq(staffRequests.staffId, s.id),
      ),
    );
  const row = rows[0];
  if (!row) throw new Error("Request not found");
  if (row.status !== "pending") {
    throw new Error("This request has already been resolved");
  }
  return { staff: s, request: row };
}

export async function updateStaffRequestNote(input: {
  token: string;
  requestId: string;
  note: string;
  reasonCategory?: string | null;
}) {
  const { request } = await loadOwnPendingRequest(
    input.token,
    input.requestId,
  );
  const note = (input.note ?? "").slice(0, MAX_NOTE_LENGTH).trim() || null;
  const patch: Record<string, unknown> = { note };
  // Category only applies to time-off requests and is only updated when the
  // caller passed one — undefined = leave unchanged, null = explicitly clear.
  if (request.type === "unavailable" && input.reasonCategory !== undefined) {
    const categories = await loadLeaveCategories();
    patch.reasonCategory = normaliseCategoryInput(
      input.reasonCategory,
      categories,
    );
  }
  await db
    .update(staffRequests)
    .set(patch)
    .where(eq(staffRequests.id, input.requestId));
  revalidatePath("/");
  revalidatePath(`/staff/${input.token}`);
}

export async function cancelStaffRequest(input: {
  token: string;
  requestId: string;
}) {
  await loadOwnPendingRequest(input.token, input.requestId);
  // Soft-cancel: preserves the row for future BI (cancellation rates) but
  // removes it from both the manager's notification queue and the staff's
  // My requests list. Attachments are cleaned up (no point holding sensitive
  // medical docs for cancelled rows).
  await db
    .delete(staffRequestAttachments)
    .where(eq(staffRequestAttachments.requestId, input.requestId));
  await db
    .update(staffRequests)
    .set({
      status: "cancelled",
      resolvedAt: new Date().toISOString(),
    })
    .where(eq(staffRequests.id, input.requestId));
  revalidatePath("/");
  revalidatePath(`/staff/${input.token}`);
}

function sanitiseFilename(raw: string): string {
  // Strip path separators and control chars, clamp to a sane length. Keep
  // extension because the manager often needs to recognise it.
  const clean = raw
    .replace(/[\/\\]/g, "_")
    .replace(/[\x00-\x1f]/g, "")
    .trim();
  return clean.slice(0, MAX_FILENAME_LENGTH) || "attachment";
}

function attachmentId() {
  return `att_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function uploadRequestAttachment(
  formData: FormData,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const token = String(formData.get("token") ?? "");
  const requestId = String(formData.get("requestId") ?? "");
  const file = formData.get("file");

  if (!(file instanceof Blob)) {
    return { ok: false, error: "No file selected" };
  }
  if (file.size === 0) {
    return { ok: false, error: "File is empty" };
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return {
      ok: false,
      error: `File exceeds the 5 MB limit (got ${Math.round(file.size / 1024)} KB)`,
    };
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return {
      ok: false,
      error: "Unsupported file type — use JPG, PNG, HEIC, WebP, or PDF",
    };
  }

  // Token auth + ownership check — only the request's own staff can attach.
  const { request } = await loadOwnPendingRequest(token, requestId);

  const existing = await db
    .select({ id: staffRequestAttachments.id })
    .from(staffRequestAttachments)
    .where(eq(staffRequestAttachments.requestId, request.id));
  if (existing.length >= MAX_ATTACHMENTS_PER_REQUEST) {
    return {
      ok: false,
      error: `At most ${MAX_ATTACHMENTS_PER_REQUEST} attachments per request`,
    };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const id = attachmentId();
  const rawName =
    (file as unknown as { name?: string }).name ?? "attachment";
  await db.insert(staffRequestAttachments).values({
    id,
    requestId: request.id,
    filename: sanitiseFilename(rawName),
    mimeType: file.type,
    sizeBytes: bytes.length,
    data: bytes,
    uploadedAt: new Date().toISOString(),
  });
  revalidatePath("/");
  revalidatePath(`/staff/${token}`);
  return { ok: true, id };
}

export async function deleteRequestAttachment(input: {
  token: string;
  attachmentId: string;
}) {
  const attRows = await db
    .select({
      id: staffRequestAttachments.id,
      requestId: staffRequestAttachments.requestId,
    })
    .from(staffRequestAttachments)
    .where(eq(staffRequestAttachments.id, input.attachmentId));
  const att = attRows[0];
  if (!att) throw new Error("Attachment not found");
  // Reuses the pending + ownership check, so only the owning staff on a
  // still-pending request can delete their own attachments.
  await loadOwnPendingRequest(input.token, att.requestId);
  await db
    .delete(staffRequestAttachments)
    .where(eq(staffRequestAttachments.id, input.attachmentId));
  revalidatePath("/");
  revalidatePath(`/staff/${input.token}`);
}
