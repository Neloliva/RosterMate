import type { ShiftPreference, StaffPreferences } from "./types";

const SHIFT_OPTIONS: ShiftPreference[] = ["morning", "evening", "any", ""];

export function emptyStaffPreferences(): StaffPreferences {
  return {
    agreedSchedule: "",
    preferredDaysOff: [],
    preferredShift: "",
    notes: "",
  };
}

export function parseStaffPreferences(
  raw: string | null | undefined,
): StaffPreferences {
  if (!raw) return emptyStaffPreferences();
  let obj: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw);
    obj =
      parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : {};
  } catch {
    return emptyStaffPreferences();
  }

  // Accept both the new "preferredDaysOff" key and the legacy "daysOff" key
  // so pre-migration rows keep their values.
  const daysRaw = Array.isArray(obj.preferredDaysOff)
    ? obj.preferredDaysOff
    : Array.isArray(obj.daysOff)
      ? obj.daysOff
      : [];
  const preferredDaysOff = Array.from(
    new Set(
      daysRaw.filter(
        (d): d is number =>
          typeof d === "number" && Number.isInteger(d) && d >= 0 && d <= 6,
      ),
    ),
  ).sort((a, b) => a - b);

  const shiftRaw = obj.preferredShift;
  const preferredShift: ShiftPreference =
    typeof shiftRaw === "string" &&
    (SHIFT_OPTIONS as string[]).includes(shiftRaw)
      ? (shiftRaw as ShiftPreference)
      : "";

  return {
    agreedSchedule:
      typeof obj.agreedSchedule === "string" ? obj.agreedSchedule : "",
    preferredDaysOff,
    preferredShift,
    notes: typeof obj.notes === "string" ? obj.notes : "",
    updatedAt:
      typeof obj.updatedAt === "string" ? obj.updatedAt : undefined,
  };
}

export function serializeStaffPreferences(
  prefs: StaffPreferences,
): string {
  const cleaned: StaffPreferences = {
    agreedSchedule: prefs.agreedSchedule.trim(),
    preferredDaysOff: Array.from(
      new Set(
        prefs.preferredDaysOff.filter(
          (d) => Number.isInteger(d) && d >= 0 && d <= 6,
        ),
      ),
    ).sort((a, b) => a - b),
    preferredShift: (SHIFT_OPTIONS as string[]).includes(prefs.preferredShift)
      ? prefs.preferredShift
      : "",
    notes: prefs.notes.slice(0, 500),
    updatedAt: new Date().toISOString(),
  };
  return JSON.stringify(cleaned);
}
