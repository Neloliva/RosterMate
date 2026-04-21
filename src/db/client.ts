import "server-only";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { computeShiftCost } from "@/lib/cost";
import { toIsoDate } from "@/lib/date";
import { STAFF } from "@/lib/mock-data";
import {
  SEED_RANGE_END,
  SEED_RANGE_START,
  templateFor,
} from "@/lib/seed-templates";
import * as schema from "./schema";

const DB_PATH = process.env.DB_PATH ?? "data/rostermate.db";

// Legacy anchor date from the original mockup that used a Tuesday as "Monday".
const LEGACY_WEEK = "2026-03-24";

function listWeeks(startIso: string, endIso: string): string[] {
  const [sy, sm, sd] = startIso.split("-").map(Number);
  const [ey, em, ed] = endIso.split("-").map(Number);
  const cursor = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  const out: string[] = [];
  while (cursor <= end) {
    out.push(toIsoDate(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  return out;
}

function initDb() {
  const dir = dirname(DB_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      initials TEXT NOT NULL,
      base_rate REAL NOT NULL,
      employment_type TEXT NOT NULL,
      hours_this_week INTEGER NOT NULL DEFAULT 0,
      availability TEXT NOT NULL DEFAULT 'available'
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id TEXT PRIMARY KEY,
      week_start TEXT NOT NULL,
      staff_id TEXT NOT NULL REFERENCES staff(id),
      day INTEGER NOT NULL,
      start_hour REAL NOT NULL,
      end_hour REAL NOT NULL,
      cost REAL NOT NULL DEFAULT 0
    );

    CREATE UNIQUE INDEX IF NOT EXISTS shifts_cell_unique
      ON shifts(week_start, staff_id, day);

    CREATE TABLE IF NOT EXISTS business_settings (
      id TEXT PRIMARY KEY,
      business_name TEXT NOT NULL,
      business_type TEXT NOT NULL,
      penalty_target_pct REAL NOT NULL,
      overtime_hours INTEGER NOT NULL,
      default_view TEXT NOT NULL
    );
  `);

  // Singleton settings row — insert defaults on first run.
  sqlite
    .prepare(
      "INSERT OR IGNORE INTO business_settings (id, business_name, business_type, penalty_target_pct, overtime_hours, default_view) VALUES ('default', 'My Business', 'cafe', 15, 38, 'week')",
    )
    .run();

  // Legacy cleanup — original seed used a Tuesday as the "Monday" anchor.
  sqlite
    .prepare("DELETE FROM shifts WHERE week_start = ?")
    .run(LEGACY_WEEK);

  // Idempotent column migrations — add fields introduced after the initial
  // schema so existing dev DBs upgrade in place.
  const staffCols = sqlite
    .prepare("PRAGMA table_info(staff)")
    .all() as { name: string }[];
  const existing = new Set(staffCols.map((c) => c.name));
  if (!existing.has("business_type")) {
    sqlite.exec("ALTER TABLE staff ADD COLUMN business_type TEXT");
  }
  if (!existing.has("age")) {
    sqlite.exec("ALTER TABLE staff ADD COLUMN age INTEGER");
  }
  if (!existing.has("is_junior")) {
    sqlite.exec(
      "ALTER TABLE staff ADD COLUMN is_junior INTEGER NOT NULL DEFAULT 0",
    );
  }
  if (!existing.has("qualifications")) {
    sqlite.exec(
      "ALTER TABLE staff ADD COLUMN qualifications TEXT NOT NULL DEFAULT '[]'",
    );
  }
  if (!existing.has("registration_number")) {
    sqlite.exec("ALTER TABLE staff ADD COLUMN registration_number TEXT");
  }

  // Seed staff on first run.
  const staffCount = sqlite
    .prepare("SELECT COUNT(*) as c FROM staff")
    .get() as { c: number };

  if (staffCount.c === 0) {
    const insertStaff = sqlite.prepare(
      "INSERT INTO staff (id, name, role, initials, base_rate, employment_type, hours_this_week, availability) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    );
    const tx = sqlite.transaction(() => {
      for (const s of STAFF) {
        insertStaff.run(
          s.id,
          s.name,
          s.role,
          s.initials,
          s.baseRate,
          s.employmentType,
          s.hoursThisWeek,
          s.availability,
        );
      }
    });
    tx();
  }

  // Seed any missing weeks across the full 2026 range. Weeks already in the
  // DB are left alone so manual edits survive.
  const weeks = listWeeks(SEED_RANGE_START, SEED_RANGE_END);

  const hasWeekStmt = sqlite.prepare(
    "SELECT 1 FROM shifts WHERE week_start = ? LIMIT 1",
  );
  const insertShift = sqlite.prepare(
    "INSERT INTO shifts (id, week_start, staff_id, day, start_hour, end_hour, cost) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const staffById = new Map(STAFF.map((s) => [s.id, s]));

  const seedTx = sqlite.transaction(() => {
    for (let i = 0; i < weeks.length; i++) {
      const weekStart = weeks[i];
      if (hasWeekStmt.get(weekStart)) continue;
      const template = templateFor(i);
      for (let j = 0; j < template.length; j++) {
        const sh = template[j];
        const person = staffById.get(sh.staffId);
        if (!person) continue;
        const cost = computeShiftCost(
          {
            id: "preview",
            staffId: sh.staffId,
            day: sh.day,
            startHour: sh.startHour,
            endHour: sh.endHour,
            cost: 0,
          },
          person,
        );
        insertShift.run(
          `sh_${weekStart}_${j}`,
          weekStart,
          sh.staffId,
          sh.day,
          sh.startHour,
          sh.endHour,
          cost,
        );
      }
    }
  });
  seedTx();

  return drizzle(sqlite, { schema });
}

declare global {
  // eslint-disable-next-line no-var
  var __rostermate_db: ReturnType<typeof initDb> | undefined;
}

export const db = globalThis.__rostermate_db ?? initDb();
if (!globalThis.__rostermate_db) globalThis.__rostermate_db = db;
