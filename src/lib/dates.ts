/** Pure date helpers working on `YYYY-MM-DD` strings in UTC to avoid TZ drift. */

export type ISODate = string;

export function parseISO(d: ISODate): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, day ?? 1));
}

export function toISO(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: ISODate, n: number): ISODate {
  const date = parseISO(d);
  date.setUTCDate(date.getUTCDate() + n);
  return toISO(date);
}

export function addMonths(d: ISODate, n: number): ISODate {
  const date = parseISO(d);
  date.setUTCMonth(date.getUTCMonth() + n);
  return toISO(date);
}

/** 0 = Sunday ... 6 = Saturday */
export function weekday(d: ISODate): number {
  return parseISO(d).getUTCDay();
}

/** ISO week starts Monday. */
export function startOfWeek(d: ISODate): ISODate {
  const wd = weekday(d);
  const delta = wd === 0 ? -6 : 1 - wd;
  return addDays(d, delta);
}

export function endOfWeek(d: ISODate): ISODate {
  return addDays(startOfWeek(d), 6);
}

export function startOfMonth(d: ISODate): ISODate {
  return `${d.slice(0, 7)}-01`;
}

export function endOfMonth(d: ISODate): ISODate {
  const date = parseISO(d);
  return toISO(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)));
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((parseISO(a).getTime() - parseISO(b).getTime()) / 86400000);
}

export function clampDayOfMonth(year: number, month1: number, day: number): ISODate {
  const max = daysInMonth(year, month1);
  const d = Math.min(Math.max(1, day), max);
  return `${year}-${String(month1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function todayISO(timezone = "Africa/Lagos"): ISODate {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const MONTH_NAMES = [
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

export function formatHuman(d: ISODate): string {
  const date = parseISO(d);
  return `${WEEKDAY_NAMES[date.getUTCDay()].slice(0, 3)} ${date.getUTCDate()} ${MONTH_NAMES[
    date.getUTCMonth()
  ].slice(0, 3)} ${date.getUTCFullYear()}`;
}
