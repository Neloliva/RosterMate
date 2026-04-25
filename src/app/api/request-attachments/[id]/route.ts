import { and, eq, gte } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";
import {
  managerSessions,
  staff,
  staffRequestAttachments,
  staffRequests,
} from "@/db/schema";

// Streams a request attachment. Auth has two paths:
//   (1) Manager session — any valid manager cookie can download any
//       attachment. This matches their dashboard access pattern.
//   (2) Staff token — the ?token=<viewToken> query param authorises the
//       staff that owns the request. Useful for letting staff view their
//       own uploaded files from the portal.
// Requests without either auth are rejected.

async function managerAuthorised(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return false;
  const rows = await db
    .select({ token: managerSessions.token })
    .from(managerSessions)
    .where(
      and(
        eq(managerSessions.token, token),
        gte(managerSessions.expiresAt, new Date().toISOString()),
      ),
    );
  return rows.length > 0;
}

async function staffAuthorisedForRequest(
  viewToken: string,
  requestId: string,
): Promise<boolean> {
  if (!viewToken) return false;
  const rows = await db
    .select({ staffId: staff.id, requestId: staffRequests.id })
    .from(staffRequests)
    .innerJoin(staff, eq(staff.id, staffRequests.staffId))
    .where(
      and(
        eq(staff.viewToken, viewToken),
        eq(staffRequests.id, requestId),
      ),
    );
  return rows.length > 0;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const viewToken = url.searchParams.get("token") ?? "";
  const inline = url.searchParams.get("inline") === "1";

  const rows = await db
    .select()
    .from(staffRequestAttachments)
    .where(eq(staffRequestAttachments.id, id));
  const att = rows[0];
  if (!att) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const hasManager = await managerAuthorised();
  const hasStaff = hasManager
    ? false
    : await staffAuthorisedForRequest(viewToken, att.requestId);

  if (!hasManager && !hasStaff) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = att.data as Buffer;
  // Content-Disposition: inline lets images render in the popover; a
  // download action on the manager side uses ?inline=0 to force a save.
  const disposition = inline ? "inline" : "attachment";
  const safeName = att.filename.replace(/"/g, "");
  return new NextResponse(new Uint8Array(data), {
    status: 200,
    headers: {
      "Content-Type": att.mimeType,
      "Content-Length": String(att.sizeBytes),
      "Content-Disposition": `${disposition}; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
