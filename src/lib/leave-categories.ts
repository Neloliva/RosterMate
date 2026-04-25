// Helpers for the admin-curated list of leave reason categories that drive
// the dropdown on the staff portal's time-off dialog. Stored as JSON in
// business_settings.leave_reason_categories.

const MAX_LABEL_LENGTH = 40;
const MAX_CATEGORIES = 12;

export const DEFAULT_LEAVE_CATEGORIES: string[] = [
  "Medical",
  "Family",
  "Vacation",
  "Personal",
  "Other",
];

export function parseLeaveCategories(
  raw: string | null | undefined,
): string[] {
  if (raw === null || raw === undefined) {
    // First-run default. An explicit empty array means the admin deliberately
    // cleared the list — respect that and return empty.
    return [...DEFAULT_LEAVE_CATEGORIES];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const entry of parsed) {
      if (typeof entry !== "string") continue;
      const trimmed = entry.trim().slice(0, MAX_LABEL_LENGTH);
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(trimmed);
      if (out.length >= MAX_CATEGORIES) break;
    }
    return out;
  } catch {
    return [];
  }
}

export function serializeLeaveCategories(categories: string[]): string {
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const raw of categories) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim().slice(0, MAX_LABEL_LENGTH);
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(trimmed);
    if (cleaned.length >= MAX_CATEGORIES) break;
  }
  return JSON.stringify(cleaned);
}

export function normaliseCategoryInput(
  raw: string | null | undefined,
  allowed: string[],
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Case-insensitive match against the admin list so clients can't silently
  // save a custom category label that won't show up in reports.
  const match = allowed.find(
    (c) => c.toLowerCase() === trimmed.toLowerCase(),
  );
  return match ?? null;
}
