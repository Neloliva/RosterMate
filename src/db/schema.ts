import {
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
});

export type StaffRow = typeof staff.$inferSelect;
export type ShiftRow = typeof shifts.$inferSelect;
export type BusinessSettingsRow = typeof businessSettings.$inferSelect;
