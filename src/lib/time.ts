export function formatHour(hour: number): string {
  const normalized = ((hour % 24) + 24) % 24;
  const whole = Math.floor(normalized);
  const minutes = Math.round((normalized - whole) * 60);
  const suffix = whole >= 12 && whole < 24 ? "pm" : "am";
  const twelve = whole % 12 === 0 ? 12 : whole % 12;
  return minutes === 0
    ? `${twelve}${suffix}`
    : `${twelve}:${String(minutes).padStart(2, "0")}${suffix}`;
}

export function formatRange(start: number, end: number): string {
  return `${formatHour(start)}-${formatHour(end)}`;
}

// Convert a decimal hour (e.g. 9, 17.5, 24) to an HH:MM string.
// 24 (midnight end-of-day) maps to "00:00" so <input type="time"> accepts it.
export function hourToTimeString(hour: number): string {
  const wrapped = ((hour % 24) + 24) % 24;
  const h = Math.floor(wrapped);
  const m = Math.round((wrapped - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Parse "HH:MM" into a decimal hour (0..24).
export function timeStringToHour(str: string): number {
  const [h, m] = str.split(":").map((n) => Number(n) || 0);
  return h + m / 60;
}
