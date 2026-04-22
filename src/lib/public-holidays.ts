// Australian NATIONAL public holidays only (7 per year). State-specific
// holidays (Labour Day, King's Birthday, Melbourne Cup, show days, etc.) are
// NOT modelled because the app has no state setting — see DEFERRED.md.
//
// Currently display-only: holidays appear on the calendar and in the shift
// editor, but the award engine does NOT yet auto-apply the public-holiday
// multiplier to shift costs. See DEFERRED.md for the planned wire-through.

export type AustralianHoliday = { date: string; name: string };

// Gauss/Meeus algorithm — returns Easter Sunday for the given year.
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const L = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * L) / 451);
  const month = Math.floor((h + L - 7 * m + 114) / 31);
  const day = ((h + L - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function isoOf(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysDate(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

// If the date falls on a Saturday or Sunday, shift to the following Monday.
function substituteIfWeekend(d: Date): Date {
  const dow = d.getDay();
  if (dow === 6) return addDaysDate(d, 2); // Sat → Mon
  if (dow === 0) return addDaysDate(d, 1); // Sun → Mon
  return d;
}

export function australianNationalHolidays(year: number): AustralianHoliday[] {
  const easter = easterSunday(year);
  const goodFriday = addDaysDate(easter, -2);
  const easterMonday = addDaysDate(easter, 1);

  const xmas = new Date(year, 11, 25);
  const boxing = new Date(year, 11, 26);
  const xmasObs = substituteIfWeekend(xmas);
  let boxingObs = substituteIfWeekend(boxing);
  // When both Xmas and Boxing Day substitute to the same Monday, push
  // Boxing Day one more day (Fair Work standard: Xmas Mon, Boxing Tue).
  if (isoOf(xmasObs) === isoOf(boxingObs)) {
    boxingObs = addDaysDate(xmasObs, 1);
  }

  return [
    {
      date: isoOf(substituteIfWeekend(new Date(year, 0, 1))),
      name: "New Year's Day",
    },
    {
      date: isoOf(substituteIfWeekend(new Date(year, 0, 26))),
      name: "Australia Day",
    },
    { date: isoOf(goodFriday), name: "Good Friday" },
    { date: isoOf(easterMonday), name: "Easter Monday" },
    // ANZAC Day is traditionally observed on the actual day (25 April) — not
    // substituted in most states. Matches national Fair Work convention.
    { date: isoOf(new Date(year, 3, 25)), name: "ANZAC Day" },
    { date: isoOf(xmasObs), name: "Christmas Day" },
    { date: isoOf(boxingObs), name: "Boxing Day" },
  ].sort((a, b) => a.date.localeCompare(b.date));
}

export function holidaysByDate(years: number[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const y of years) {
    for (const h of australianNationalHolidays(y)) {
      map.set(h.date, h.name);
    }
  }
  return map;
}

// Computes a holiday lookup for every year any of these weekStarts (or their
// 7-day span) could touch. Adds year+1 defensively to cover Dec → Jan wrap.
export function holidaysForWeekStarts(
  weekStarts: string[],
): Map<string, string> {
  const years = new Set<number>();
  for (const ws of weekStarts) {
    const y = Number(ws.slice(0, 4));
    if (!Number.isNaN(y)) {
      years.add(y);
      years.add(y + 1);
    }
  }
  return holidaysByDate([...years]);
}
