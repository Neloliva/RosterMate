import {
  blob,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const staff = sqliteTable("staff", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  initials: text("initials").notNull(),
  baseRate: real("base_rate").notNull(),
  employmentType: text("employment_type").notNull(),
  hoursThisWeek: integer("hours_this_week").notNull().default(0),
  availability: text("availability").notNull().default("available"),
  businessType: text("business_type"),
  age: integer("age"),
  isJunior: integer("is_junior", { mode: "boolean" }).default(false),
  qualifications: text("qualifications").default("[]"),
  registrationNumber: text("registration_number"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  viewToken: text("view_token"),
  availabilityPreferences: text("availability_preferences").default("{}"),
});

export const staffRequests = sqliteTable("staff_requests", {
  id: text("id").primaryKey(),
  staffId: text("staff_id")
    .notNull()
    .references(() => staff.id),
  // "swap" | "unavailable" | "time_change"
  //   swap         — someone else takes the shift
  //   unavailable  — take me off the roster that day (time-off request)
  //   time_change  — keep me on the shift, edit the hours
  type: text("type").notNull(),
  shiftId: text("shift_id"),
  weekStart: text("week_start"),
  day: integer("day"),
  note: text("note"),
  // Admin-configurable bucket for BI (e.g. Medical / Family / Vacation /
  // Personal / Other). Only set on time-off requests; swap requests stay
  // free-text because swap reasons are situational.
  reasonCategory: text("reason_category"),
  // Proposed new shift hours when type = "time_change". Approving the
  // request updates the underlying shift's start/end to these values.
  proposedStartHour: real("proposed_start_hour"),
  proposedEndHour: real("proposed_end_hour"),
  // Pre-arranged swap partner when type = "swap". The manager still
  // reassigns the shift manually after approving — but the approve-and-move
  // shortcut is gated on the partner having confirmed in-system.
  proposedSwapWithStaffId: text("proposed_swap_with_staff_id").references(
    () => staff.id,
  ),
  // Confirmation handshake with the proposed swap partner.
  //   null         — no partner, nothing to confirm
  //   "requested"  — partner has been named and needs to confirm
  //   "agreed"     — partner confirmed in their portal
  //   "declined"   — partner declined; manager sees this and decides
  partnerConfirmationStatus: text("partner_confirmation_status"),
  partnerConfirmationAt: text("partner_confirmation_at"),
  // "pending" | "approved" | "declined" | "cancelled"
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull(),
  resolvedAt: text("resolved_at"),
  resolutionNote: text("resolution_note"),
});

export const shifts = sqliteTable(
  "shifts",
  {
    id: text("id").primaryKey(),
    weekStart: text("week_start").notNull(),
    staffId: text("staff_id")
      .notNull()
      .references(() => staff.id),
    day: integer("day").notNull(),
    startHour: real("start_hour").notNull(),
    endHour: real("end_hour").notNull(),
    cost: real("cost").notNull().default(0),
    updatedAt: text("updated_at"),
  },
  (t) => ({
    cellUnique: uniqueIndex("shifts_cell_unique").on(
      t.weekStart,
      t.staffId,
      t.day,
    ),
  }),
);

export const businessSettings = sqliteTable("business_settings", {
  id: text("id").primaryKey(),
  businessName: text("business_name").notNull(),
  businessType: text("business_type").notNull(),
  penaltyTargetPct: real("penalty_target_pct").notNull(),
  overtimeHours: integer("overtime_hours").notNull(),
  defaultView: text("default_view").notNull(),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  coverageRules: text("coverage_rules"),
  // JSON array of strings. Drives the dropdown on the staff portal's
  // time-off dialog and groups requests for business-intelligence reports.
  leaveReasonCategories: text("leave_reason_categories"),
  // scrypt-hashed password for the dashboard gate. NULL on first run —
  // manager is prompted to set one. When set, middleware enforces a valid
  // session cookie on / and server-action POSTs.
  managerPasswordHash: text("manager_password_hash"),
});

// Attachments for staff requests (medical certs, supporting docs, etc).
// Stored as BLOBs inline with the DB for simplicity — fine for the scale we
// target (single-site SMBs, ~5MB cap per file, max 3 per request). When we
// move to a cloud deployment, swap `data` for an object-storage URL and
// migrate existing rows.
export const staffRequestAttachments = sqliteTable(
  "staff_request_attachments",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id")
      .notNull()
      .references(() => staffRequests.id),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    data: blob("data").notNull(),
    uploadedAt: text("uploaded_at").notNull(),
  },
);

export const managerSessions = sqliteTable("manager_sessions", {
  // Opaque random token (base64url, 32 bytes). Stored as the cookie value
  // AND the primary key — no hashing step because these are short-lived
  // and the DB is local.
  token: text("token").primaryKey(),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
});

export type StaffRow = typeof staff.$inferSelect;
export type ShiftRow = typeof shifts.$inferSelect;
export type BusinessSettingsRow = typeof businessSettings.$inferSelect;
