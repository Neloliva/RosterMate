const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function mondayOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // JS: Sunday=0..Saturday=6. We want Monday=0.
  const jsDay = d.getDay();
  const offset = jsDay === 0 ? -6 : 1 - jsDay;
  d.setDate(d.getDate() + offset);
  return d;
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function startOfWeek(date: Date): string {
  return toIsoDate(mondayOf(date));
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return toIsoDate(dt);
}

export function formatWeekLabel(weekStartIso: string): string {
  const [y, m, d] = weekStartIso.split("-").map(Number);
  return `Week of ${MONTHS[m - 1]} ${d}, ${y}`;
}

export type DayCell = { name: string; date: string };

export function daysForWeek(weekStartIso: string): DayCell[] {
  const [y, m, d] = weekStartIso.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return {
      name: DAY_NAMES[i],
      date: `${MONTHS_SHORT[day.getMonth()]} ${day.getDate()}`,
    };
  });
}
