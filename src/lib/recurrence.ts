import {
  addDays,
  addMonths,
  clampDayOfMonth,
  diffDays,
  endOfMonth,
  endOfWeek,
  ISODate,
  MONTH_NAMES,
  parseISO,
  startOfMonth,
  startOfWeek,
  toISO,
  WEEKDAY_NAMES,
  weekday,
} from "./dates";

export const RECURRENCE_TYPES = [
  "daily",
  "hourly",
  "weekly",
  "weekly_multi",
  "biweekly",
  "monthly",
  "quarterly",
  "biannual",
] as const;

export type RecurrenceType = (typeof RECURRENCE_TYPES)[number];

export type RecurrenceConfig = {
  /** weekly: single weekday (0=Sun..6=Sat) */
  weekday?: number;
  /** weekly_multi: several weekdays per week */
  weekdays?: number[];
  /** biweekly: interval in weeks (default 2) + anchor date the cycle counts from */
  intervalWeeks?: number;
  anchorDate?: ISODate;
  /** monthly / quarterly / biannual: preferred day inside the target month */
  dayOfMonth?: number | null;
  /** quarterly: which month within the quarter (0,1,2) */
  monthOfQuarter?: number;
  /** biannual: the two target months (1-12) */
  targetMonths?: number[];
  /** extra days of grace added to the due window end */
  graceDays?: number;
  /** hourly: working hours range (24h) */
  startHour?: number;
  endHour?: number;
  /** hourly: how many hours between occurrences (default 1, range 1-6) */
  intervalHours?: number;
  /** daily / hourly: specific time of day the task is due, e.g. "14:00" */
  dueTime?: string;
};

export type OccurrenceSpec = {
  dueDate: ISODate;
  dueHour: number | null;
  windowStart: ISODate;
  windowEnd: ISODate;
};

export const RECURRENCE_META: Record<
  RecurrenceType,
  { label: string; windowLabel: string; fields: (keyof RecurrenceConfig)[] }
> = {
  daily: {
    label: "Daily",
    windowLabel: "Must be completed by end of day",
    fields: ["dueTime"],
  },
  hourly: {
    label: "Hourly",
    windowLabel: "Must be completed within the hour",
    fields: ["startHour", "endHour", "intervalHours", "dueTime"],
  },
  weekly: {
    label: "Weekly (one weekday)",
    windowLabel: "Must be completed within the target week",
    fields: ["weekday"],
  },
  weekly_multi: {
    label: "Multiple days per week",
    windowLabel: "Must be completed on/near each target day",
    fields: ["weekdays", "graceDays"],
  },
  biweekly: {
    label: "Every N weeks",
    windowLabel: "Must be completed within the target week",
    fields: ["weekday", "intervalWeeks", "anchorDate"],
  },
  monthly: {
    label: "Monthly",
    windowLabel: "Must be completed within the target month",
    fields: ["dayOfMonth"],
  },
  quarterly: {
    label: "Quarterly",
    windowLabel: "Must be completed within the target quarter",
    fields: ["monthOfQuarter", "dayOfMonth"],
  },
  biannual: {
    label: "Twice a year",
    windowLabel: "Must be completed within each target month",
    fields: ["targetMonths", "dayOfMonth"],
  },
};

export function defaultConfigFor(type: RecurrenceType): RecurrenceConfig {
  switch (type) {
    case "daily":
      return {};
    case "hourly":
      return { startHour: 8, endHour: 17 };
    case "weekly":
      return { weekday: 1 };
    case "weekly_multi":
      return { weekdays: [2, 5], graceDays: 0 };
    case "biweekly":
      return { weekday: 5, intervalWeeks: 2, anchorDate: undefined };
    case "monthly":
      return { dayOfMonth: null };
    case "quarterly":
      return { monthOfQuarter: 0, dayOfMonth: null };
    case "biannual":
      return { targetMonths: [3, 9], dayOfMonth: null };
  }
}

export function describeRecurrence(
  type: RecurrenceType,
  config: RecurrenceConfig,
): string {
  switch (type) {
    case "daily": {
      if (config.dueTime) {
        return `Every day by ${config.dueTime}`;
      }
      return "Every day";
    }
    case "hourly": {
      const interval = config.intervalHours ?? 1;
      const label =
        interval === 1
          ? "Every hour"
          : `Every ${interval} hours`;
      const timeStr = config.dueTime ? ` (due by ${config.dueTime})` : "";
      return `${label} from ${config.startHour ?? 8}:00 to ${config.endHour ?? 17}:00${timeStr}`;
    }
    case "weekly":
      return `Every ${WEEKDAY_NAMES[config.weekday ?? 1]}`;
    case "weekly_multi":
      return `Every ${(config.weekdays ?? []).map((w) => WEEKDAY_NAMES[w].slice(0, 3)).join(" & ")}`;
    case "biweekly":
      return `Every ${config.intervalWeeks ?? 2} weeks on ${WEEKDAY_NAMES[config.weekday ?? 1]}`;
    case "monthly":
      return config.dayOfMonth
        ? `Monthly on day ${config.dayOfMonth}`
        : "Once a month (any day)";
    case "quarterly":
      return `Quarterly (month ${(config.monthOfQuarter ?? 0) + 1} of each quarter)`;
    case "biannual":
      return `Twice a year (${(config.targetMonths ?? [])
        .map((m) => MONTH_NAMES[m - 1]?.slice(0, 3))
        .join(" & ")})`;
  }
}

function withinRange(d: ISODate, start: ISODate, end: ISODate) {
  return d >= start && d <= end;
}

/**
 * The recurrence engine. Given a template's recurrence type + config it
 * materialises every occurrence (with its compliance due-window) that falls
 * inside [rangeStart, rangeEnd].
 */
export function generateOccurrences(
  type: RecurrenceType,
  rawConfig: RecurrenceConfig | null | undefined,
  rangeStart: ISODate,
  rangeEnd: ISODate,
): OccurrenceSpec[] {
  const config = { ...defaultConfigFor(type), ...(rawConfig ?? {}) };
  const out: OccurrenceSpec[] = [];
  if (rangeEnd < rangeStart) return out;

  switch (type) {
    case "daily": {
      for (let d = rangeStart; d <= rangeEnd; d = addDays(d, 1)) {
        out.push({ dueDate: d, dueHour: null, windowStart: d, windowEnd: d });
      }
      break;
    }
    case "hourly": {
      const startH = Math.max(0, Math.min(23, config.startHour ?? 8));
      const endH = Math.max(startH, Math.min(23, config.endHour ?? 17));
      const step = Math.max(1, Math.min(6, config.intervalHours ?? 1));
      for (let d = rangeStart; d <= rangeEnd; d = addDays(d, 1)) {
        for (let h = startH; h <= endH; h += step) {
          out.push({ dueDate: d, dueHour: h, windowStart: d, windowEnd: d });
        }
      }
      break;
    }
    case "weekly": {
      const target = config.weekday ?? 1;
      for (let d = rangeStart; d <= rangeEnd; d = addDays(d, 1)) {
        if (weekday(d) === target) {
          out.push({
            dueDate: d,
            dueHour: null,
            windowStart: d,
            windowEnd: addDays(endOfWeek(d), config.graceDays ?? 0),
          });
        }
      }
      break;
    }
    case "weekly_multi": {
      const targets = new Set(config.weekdays ?? []);
      for (let d = rangeStart; d <= rangeEnd; d = addDays(d, 1)) {
        if (targets.has(weekday(d))) {
          out.push({
            dueDate: d,
            dueHour: null,
            windowStart: d,
            windowEnd: addDays(d, config.graceDays ?? 0),
          });
        }
      }
      break;
    }
    case "biweekly": {
      const target = config.weekday ?? 1;
      const interval = Math.max(1, config.intervalWeeks ?? 2);
      // Anchor to the ISO week of the anchor date (defaults to the epoch-ish
      // Monday 2024-01-01 so results are deterministic without config).
      const anchorWeek = startOfWeek(config.anchorDate ?? "2024-01-01");
      for (let d = rangeStart; d <= rangeEnd; d = addDays(d, 1)) {
        if (weekday(d) !== target) continue;
        const weeksSinceAnchor = Math.round(diffDays(startOfWeek(d), anchorWeek) / 7);
        if (((weeksSinceAnchor % interval) + interval) % interval !== 0) continue;
        out.push({
          dueDate: d,
          dueHour: null,
          windowStart: d,
          windowEnd: addDays(endOfWeek(d), config.graceDays ?? 0),
        });
      }
      break;
    }
    case "monthly": {
      let cursor = startOfMonth(rangeStart);
      while (cursor <= rangeEnd) {
        const y = parseISO(cursor).getUTCFullYear();
        const m = parseISO(cursor).getUTCMonth() + 1;
        const windowStart = startOfMonth(cursor);
        const windowEnd = endOfMonth(cursor);
        const dueDate = config.dayOfMonth
          ? clampDayOfMonth(y, m, config.dayOfMonth)
          : windowEnd;
        if (withinRange(dueDate, rangeStart, rangeEnd) || withinRange(windowEnd, rangeStart, rangeEnd)) {
          out.push({ dueDate, dueHour: null, windowStart, windowEnd });
        }
        cursor = addMonths(cursor, 1);
      }
      break;
    }
    case "quarterly": {
      const monthOfQuarter = Math.min(2, Math.max(0, config.monthOfQuarter ?? 0));
      const startYear = parseISO(rangeStart).getUTCFullYear();
      const endYear = parseISO(rangeEnd).getUTCFullYear();
      for (let y = startYear; y <= endYear; y++) {
        for (let q = 0; q < 4; q++) {
          const quarterStart = `${y}-${String(q * 3 + 1).padStart(2, "0")}-01`;
          const quarterEnd = endOfMonth(`${y}-${String(q * 3 + 3).padStart(2, "0")}-01`);
          if (quarterEnd < rangeStart || quarterStart > rangeEnd) continue;
          const targetMonth = q * 3 + 1 + monthOfQuarter;
          const dueDate = config.dayOfMonth
            ? clampDayOfMonth(y, targetMonth, config.dayOfMonth)
            : endOfMonth(`${y}-${String(targetMonth).padStart(2, "0")}-01`);
          out.push({ dueDate, dueHour: null, windowStart: quarterStart, windowEnd: quarterEnd });
        }
      }
      break;
    }
    case "biannual": {
      const months = (config.targetMonths ?? [3, 9]).slice(0, 2);
      const startYear = parseISO(rangeStart).getUTCFullYear();
      const endYear = parseISO(rangeEnd).getUTCFullYear();
      for (let y = startYear; y <= endYear; y++) {
        for (const m of months) {
          const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
          const monthEnd = endOfMonth(monthStart);
          if (monthEnd < rangeStart || monthStart > rangeEnd) continue;
          const dueDate = config.dayOfMonth
            ? clampDayOfMonth(y, m, config.dayOfMonth)
            : monthEnd;
          out.push({ dueDate, dueHour: null, windowStart: monthStart, windowEnd: monthEnd });
        }
      }
      break;
    }
  }

  return out.filter(
    (o) => o.windowEnd >= rangeStart && o.dueDate <= addDays(rangeEnd, 31),
  );
}

/** Compliance status derived from the due window and whether a log exists. */
export function deriveStatus(
  spec: { dueDate: ISODate; windowEnd: ISODate },
  today: ISODate,
  hasLog: boolean,
): "pending" | "completed" | "overdue" | "missed" {
  if (hasLog) return "completed";
  if (today > spec.windowEnd) return "missed";
  if (today > spec.dueDate) return "overdue";
  return "pending";
}

export function normalizeConfig(
  type: RecurrenceType,
  input: Record<string, unknown>,
): RecurrenceConfig {
  const cfg: RecurrenceConfig = {};
  const num = (v: unknown) =>
    v === "" || v === null || v === undefined ? undefined : Number(v);
  switch (type) {
    case "weekly":
      cfg.weekday = num(input.weekday) ?? 1;
      break;
    case "weekly_multi":
      cfg.weekdays = Array.isArray(input.weekdays)
        ? (input.weekdays as unknown[]).map(Number).filter((n) => n >= 0 && n <= 6)
        : [2, 5];
      cfg.graceDays = num(input.graceDays) ?? 0;
      break;
    case "biweekly":
      cfg.weekday = num(input.weekday) ?? 1;
      cfg.intervalWeeks = num(input.intervalWeeks) ?? 2;
      cfg.anchorDate =
        typeof input.anchorDate === "string" && input.anchorDate
          ? input.anchorDate
          : undefined;
      break;
    case "monthly":
      cfg.dayOfMonth = num(input.dayOfMonth) ?? null;
      break;
    case "quarterly":
      cfg.monthOfQuarter = num(input.monthOfQuarter) ?? 0;
      cfg.dayOfMonth = num(input.dayOfMonth) ?? null;
      break;
    case "biannual":
      cfg.targetMonths = Array.isArray(input.targetMonths)
        ? (input.targetMonths as unknown[]).map(Number).filter((n) => n >= 1 && n <= 12)
        : [3, 9];
      cfg.dayOfMonth = num(input.dayOfMonth) ?? null;
      break;
    case "daily": {
      cfg.dueTime = typeof input.dueTime === "string" ? input.dueTime : undefined;
      break;
    }
    case "hourly": {
      cfg.startHour = num(input.startHour) ?? 8;
      cfg.endHour = num(input.endHour) ?? 17;
      cfg.intervalHours = Math.max(1, Math.min(6, num(input.intervalHours) ?? 1));
      cfg.dueTime = typeof input.dueTime === "string" ? input.dueTime : undefined;
      break;
    }
  }
  return cfg;
}

export function nextDueAfter(
  type: RecurrenceType,
  config: RecurrenceConfig | null | undefined,
  from: ISODate,
): ISODate | null {
  const horizon = toISO(
    new Date(parseISO(from).getTime() + 400 * 86400000),
  );
  const specs = generateOccurrences(type, config, from, horizon);
  const next = specs.find((s) => s.dueDate >= from);
  return next?.dueDate ?? null;
}
