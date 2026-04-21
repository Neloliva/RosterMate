import type { Shift } from "./types";

export type ShiftSeed = Omit<Shift, "id" | "cost">;

// Each template is a full-week schedule for the 4 seed staff. They cycle
// across weeks to create varied optimization opportunities week-to-week.
// day 0 = Monday, 5 = Saturday, 6 = Sunday.

// Template A — Weekend rush. Many shifts pushed to Sat/Sun so Optimize All
// can move them to weekdays for big savings.
const WEEKEND_RUSH: ShiftSeed[] = [
  { staffId: "sarah", day: 2, startHour: 9, endHour: 17 },
  { staffId: "sarah", day: 3, startHour: 9, endHour: 17 },
  { staffId: "sarah", day: 5, startHour: 10, endHour: 18 },
  { staffId: "sarah", day: 6, startHour: 10, endHour: 18 },

  { staffId: "mike", day: 0, startHour: 7, endHour: 15 },
  { staffId: "mike", day: 1, startHour: 7, endHour: 15 },
  { staffId: "mike", day: 2, startHour: 7, endHour: 15 },
  { staffId: "mike", day: 5, startHour: 8, endHour: 16 },
  { staffId: "mike", day: 6, startHour: 8, endHour: 16 },

  { staffId: "emma", day: 3, startHour: 11, endHour: 19 },
  { staffId: "emma", day: 4, startHour: 11, endHour: 19 },
  { staffId: "emma", day: 5, startHour: 12, endHour: 20 },
  { staffId: "emma", day: 6, startHour: 12, endHour: 20 },

  { staffId: "james", day: 4, startHour: 17, endHour: 23 },
  { staffId: "james", day: 5, startHour: 18, endHour: 24 },
  { staffId: "james", day: 6, startHour: 18, endHour: 24 },
];

// Template B — Night closers. Shifts end past 7pm to trigger night loading,
// with room to trim the last hours.
const NIGHT_CLOSERS: ShiftSeed[] = [
  { staffId: "sarah", day: 0, startHour: 13, endHour: 21 },
  { staffId: "sarah", day: 1, startHour: 13, endHour: 21 },
  { staffId: "sarah", day: 2, startHour: 13, endHour: 21 },
  { staffId: "sarah", day: 3, startHour: 13, endHour: 21 },
  { staffId: "sarah", day: 4, startHour: 13, endHour: 21 },

  { staffId: "mike", day: 0, startHour: 14, endHour: 22 },
  { staffId: "mike", day: 1, startHour: 14, endHour: 22 },
  { staffId: "mike", day: 2, startHour: 14, endHour: 22 },
  { staffId: "mike", day: 4, startHour: 14, endHour: 22 },

  { staffId: "emma", day: 2, startHour: 16, endHour: 24 },
  { staffId: "emma", day: 3, startHour: 16, endHour: 24 },
  { staffId: "emma", day: 4, startHour: 16, endHour: 24 },

  { staffId: "james", day: 0, startHour: 17, endHour: 23 },
  { staffId: "james", day: 1, startHour: 17, endHour: 23 },
  { staffId: "james", day: 2, startHour: 17, endHour: 23 },
  { staffId: "james", day: 3, startHour: 17, endHour: 23 },
  { staffId: "james", day: 4, startHour: 17, endHour: 23 },
];

// Template C — Standard weekday (the original mockup). Mostly weekday shifts
// with some weekend coverage. Moderate optimization potential.
const STANDARD_WEEKDAY: ShiftSeed[] = [
  { staffId: "sarah", day: 0, startHour: 9, endHour: 17 },
  { staffId: "sarah", day: 2, startHour: 9, endHour: 17 },
  { staffId: "sarah", day: 3, startHour: 9, endHour: 15 },
  { staffId: "sarah", day: 4, startHour: 9, endHour: 17 },
  { staffId: "sarah", day: 5, startHour: 10, endHour: 16 },

  { staffId: "mike", day: 0, startHour: 7, endHour: 15 },
  { staffId: "mike", day: 1, startHour: 7, endHour: 15 },
  { staffId: "mike", day: 2, startHour: 7, endHour: 15 },
  { staffId: "mike", day: 4, startHour: 7, endHour: 15 },
  { staffId: "mike", day: 5, startHour: 8, endHour: 16 },

  { staffId: "emma", day: 1, startHour: 11, endHour: 19 },
  { staffId: "emma", day: 3, startHour: 11, endHour: 19 },
  { staffId: "emma", day: 4, startHour: 11, endHour: 19 },
  { staffId: "emma", day: 5, startHour: 12, endHour: 20 },
  { staffId: "emma", day: 6, startHour: 12, endHour: 18 },

  { staffId: "james", day: 0, startHour: 17, endHour: 23 },
  { staffId: "james", day: 2, startHour: 17, endHour: 23 },
  { staffId: "james", day: 3, startHour: 17, endHour: 23 },
  { staffId: "james", day: 4, startHour: 17, endHour: 23 },
  { staffId: "james", day: 5, startHour: 18, endHour: 24 },
  { staffId: "james", day: 6, startHour: 18, endHour: 24 },
];

// Template D — Mike pushed into overtime. Six 10-hour shifts trigger the
// overtime insight; weekend + night shifts add penalty pressure.
const OVERTIME_MIKE: ShiftSeed[] = [
  { staffId: "sarah", day: 0, startHour: 9, endHour: 17 },
  { staffId: "sarah", day: 1, startHour: 9, endHour: 17 },
  { staffId: "sarah", day: 2, startHour: 9, endHour: 17 },
  { staffId: "sarah", day: 3, startHour: 9, endHour: 17 },

  { staffId: "mike", day: 0, startHour: 7, endHour: 17 },
  { staffId: "mike", day: 1, startHour: 7, endHour: 17 },
  { staffId: "mike", day: 2, startHour: 7, endHour: 17 },
  { staffId: "mike", day: 3, startHour: 7, endHour: 17 },
  { staffId: "mike", day: 4, startHour: 7, endHour: 17 },
  { staffId: "mike", day: 5, startHour: 8, endHour: 16 },

  { staffId: "emma", day: 2, startHour: 11, endHour: 19 },
  { staffId: "emma", day: 3, startHour: 11, endHour: 19 },
  { staffId: "emma", day: 4, startHour: 11, endHour: 19 },
  { staffId: "emma", day: 5, startHour: 12, endHour: 20 },

  { staffId: "james", day: 1, startHour: 17, endHour: 23 },
  { staffId: "james", day: 2, startHour: 17, endHour: 23 },
  { staffId: "james", day: 4, startHour: 17, endHour: 23 },
  { staffId: "james", day: 6, startHour: 18, endHour: 24 },
];

// Template E — Skeleton crew. Fewer shifts overall, thin weekday coverage,
// most shifts clustered on weekend nights for James.
const SKELETON_CREW: ShiftSeed[] = [
  { staffId: "sarah", day: 1, startHour: 9, endHour: 17 },
  { staffId: "sarah", day: 4, startHour: 9, endHour: 17 },

  { staffId: "mike", day: 0, startHour: 7, endHour: 15 },
  { staffId: "mike", day: 2, startHour: 7, endHour: 15 },
  { staffId: "mike", day: 4, startHour: 7, endHour: 15 },

  { staffId: "emma", day: 3, startHour: 11, endHour: 19 },
  { staffId: "emma", day: 4, startHour: 11, endHour: 19 },
  { staffId: "emma", day: 5, startHour: 12, endHour: 20 },

  { staffId: "james", day: 5, startHour: 18, endHour: 24 },
  { staffId: "james", day: 6, startHour: 18, endHour: 24 },
];

export const WEEK_TEMPLATES: ShiftSeed[][] = [
  STANDARD_WEEKDAY,
  WEEKEND_RUSH,
  NIGHT_CLOSERS,
  OVERTIME_MIKE,
  SKELETON_CREW,
];

export function templateFor(weekIndex: number): ShiftSeed[] {
  const i = ((weekIndex % WEEK_TEMPLATES.length) + WEEK_TEMPLATES.length) %
    WEEK_TEMPLATES.length;
  return WEEK_TEMPLATES[i];
}

// Date range (inclusive) we seed — first Monday covering Jan 1 2026 through
// last Monday of 2026.
export const SEED_RANGE_START = "2025-12-29";
export const SEED_RANGE_END = "2026-12-28";
