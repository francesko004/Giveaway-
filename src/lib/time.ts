/**
 * Timezone helpers. All instants are stored in UTC; campaign times entered by admins are
 * interpreted in the configured display timezone (default Europe/Tirane).
 */

function partsInZone(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const out: Record<string, number> = {};
  for (const p of fmt.formatToParts(date)) if (p.type !== "literal") out[p.type] = Number(p.value);
  return out as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** Offset (ms) of `timeZone` from UTC at the given instant. */
export function zoneOffsetMs(date: Date, timeZone: string): number {
  const p = partsInZone(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** "2026-07-01T18:00" (wall-clock time in `timeZone`) → UTC Date. Handles DST transitions. */
export function zonedLocalToUtc(local: string, timeZone: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local);
  if (!m) throw new Error("Invalid local date-time");
  const [, y, mo, d, h, mi, s] = m.map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, mi, s || 0);
  let guess = naive - zoneOffsetMs(new Date(naive), timeZone);
  guess = naive - zoneOffsetMs(new Date(guess), timeZone);
  return new Date(guess);
}

/** UTC Date → "YYYY-MM-DDTHH:mm" in `timeZone` (for <input type="datetime-local">). */
export function utcToZonedLocal(date: Date, timeZone: string): string {
  const p = partsInZone(date, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Start of the calendar day containing `date` in `timeZone`, as a UTC Date. */
export function startOfDayInZone(date: Date, timeZone: string): Date {
  const p = partsInZone(date, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return zonedLocalToUtc(`${p.year}-${pad(p.month)}-${pad(p.day)}T00:00`, timeZone);
}

export function dayKeyInZone(date: Date, timeZone: string): string {
  return utcToZonedLocal(date, timeZone).slice(0, 10);
}

export function formatDateTime(date: Date | string, locale: string, timeZone: string, opts?: Intl.DateTimeFormatOptions) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale === "sq" ? "sq-AL" : "en-GB", {
    timeZone,
    dateStyle: "long",
    timeStyle: "short",
    ...opts,
  }).format(d);
}

export function formatDate(date: Date | string, locale: string, timeZone: string) {
  return formatDateTime(date, locale, timeZone, { dateStyle: "long", timeStyle: undefined });
}

/** Remaining time split for the countdown. Never negative. */
export function remaining(targetMs: number, nowMs: number) {
  const total = Math.max(0, targetMs - nowMs);
  const s = Math.floor(total / 1000);
  return {
    total,
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}
