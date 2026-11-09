import { TOURNAMENT_TIMEZONE } from "~/server/db/schema";

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Calendar fields of `date` as seen on a wall clock in `timeZone` (month is 1-12). */
function wallClockIn(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

/** Offset (ms) of `timeZone` from UTC at instant `date`. */
function zoneOffsetMs(date: Date, timeZone: string): number {
  const w = wallClockIn(date, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute);
  return asUtc - Math.floor(date.getTime() / 60_000) * 60_000;
}

/** Convert a wall-clock time in `timeZone` to a UTC instant (DST-aware). */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string = TOURNAMENT_TIMEZONE,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  let result = guess - zoneOffsetMs(new Date(guess), timeZone);
  // Re-check offset at the candidate instant in case we crossed a DST boundary.
  result = guess - zoneOffsetMs(new Date(result), timeZone);
  return new Date(result);
}

export function parseStartTime(startTime: string): {
  hour: number;
  minute: number;
} {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(startTime);
  if (!match)
    throw new Error(`Invalid start time "${startTime}" (expected HH:mm)`);
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

/**
 * Next instant strictly after `after` that falls on `dayOfWeek` at `startTime`
 * wall-clock in `timeZone`.
 */
export function nextOccurrence(
  dayOfWeek: number,
  startTime: string,
  after: Date,
  timeZone: string = TOURNAMENT_TIMEZONE,
): Date {
  const { hour, minute } = parseStartTime(startTime);
  const today = wallClockIn(after, timeZone);
  // Walk calendar days (in UTC date arithmetic on the local date) up to 8 days out.
  for (let offset = 0; offset <= 7; offset++) {
    const local = new Date(
      Date.UTC(today.year, today.month - 1, today.day + offset),
    );
    if (local.getUTCDay() !== dayOfWeek) continue;
    const candidate = zonedTimeToUtc(
      local.getUTCFullYear(),
      local.getUTCMonth() + 1,
      local.getUTCDate(),
      hour,
      minute,
      timeZone,
    );
    if (candidate.getTime() > after.getTime()) return candidate;
  }
  throw new Error("Failed to compute next occurrence");
}

export function formatStartTime(startTime: string): string {
  const { hour, minute } = parseStartTime(startTime);
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const suffix = hour < 12 ? "AM" : "PM";
  return `${h12}:${minute.toString().padStart(2, "0")} ${suffix}`;
}

/** e.g. "Sun, Nov 15, 3:00 PM EST" */
export function formatTournamentTime(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TOURNAMENT_TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(date));
}

/** "YYYY-MM-DDTHH:mm" in Eastern time, for <input type="datetime-local">. */
export function toEasternInputValue(date: Date | string): string {
  const w = wallClockIn(new Date(date), TOURNAMENT_TIMEZONE);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${w.year}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}`;
}

/** Parse "YYYY-MM-DDTHH:mm" interpreted as Eastern time. */
export function fromEasternInputValue(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Invalid date/time");
  return zonedTimeToUtc(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
  );
}
