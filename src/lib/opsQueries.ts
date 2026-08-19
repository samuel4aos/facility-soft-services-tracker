import { and, asc, desc, eq, gte, isNull, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { photos, taskLogs, taskOccurrences, taskTemplates, users } from "@/db/schema";

export type OccurrenceRow = {
  id: number;
  dueDate: string;
  windowStart: string;
  windowEnd: string;
  status: "pending" | "completed" | "overdue" | "missed" | "cancelled";
  templateId: number;
  name: string;
  location: string | null;
  criticality: "standard" | "critical";
  recurrenceType: string;
  requiresPhoto: boolean;
  logId: number | null;
  completedAt: string | null;
  notes: string | null;
  gpsLat: number | null;
  gpsLng: number | null;
  janitorName: string | null;
  photoUrls: string[];
};

export type OccurrenceFilters = {
  facilityId?: number | null;
  from?: string;
  to?: string;
  templateId?: number;
  janitorId?: number;
  status?: string;
  limit?: number;
  order?: "asc" | "desc";
};

export async function queryOccurrences(f: OccurrenceFilters): Promise<OccurrenceRow[]> {
  const conds: (SQL | undefined)[] = [
    isNull(taskTemplates.deletedAt),
    f.facilityId ? eq(taskOccurrences.facilityId, f.facilityId) : undefined,
    f.from ? gte(taskOccurrences.dueDate, f.from) : undefined,
    f.to ? lte(taskOccurrences.dueDate, f.to) : undefined,
    f.templateId ? eq(taskOccurrences.taskTemplateId, f.templateId) : undefined,
    f.janitorId ? eq(taskLogs.janitorId, f.janitorId) : undefined,
    f.status && f.status !== "all"
      ? sql`${taskOccurrences.status}::text = ${f.status}`
      : undefined,
  ];

  const rows = await db
    .select({
      id: taskOccurrences.id,
      dueDate: taskOccurrences.dueDate,
      windowStart: taskOccurrences.windowStart,
      windowEnd: taskOccurrences.windowEnd,
      status: taskOccurrences.status,
      templateId: taskTemplates.id,
      name: taskTemplates.name,
      location: taskTemplates.location,
      criticality: taskTemplates.criticality,
      recurrenceType: taskTemplates.recurrenceType,
      requiresPhoto: taskTemplates.requiresPhoto,
      logId: taskLogs.id,
      completedAt: sql<string | null>`${taskLogs.completedAt}`,
      notes: taskLogs.notes,
      gpsLat: taskLogs.gpsLat,
      gpsLng: taskLogs.gpsLng,
      janitorName: users.name,
      photoUrls: sql<
        string[]
      >`coalesce(array_agg(${photos.url}) filter (where ${photos.url} is not null), '{}')`,
    })
    .from(taskOccurrences)
    .innerJoin(taskTemplates, eq(taskTemplates.id, taskOccurrences.taskTemplateId))
    .leftJoin(
      taskLogs,
      and(eq(taskLogs.taskOccurrenceId, taskOccurrences.id), isNull(taskLogs.deletedAt)),
    )
    .leftJoin(users, eq(users.id, taskLogs.janitorId))
    .leftJoin(photos, eq(photos.taskLogId, taskLogs.id))
    .where(and(...conds.filter(Boolean)))
    .groupBy(
      taskOccurrences.id,
      taskTemplates.id,
      taskLogs.id,
      users.name,
    )
    .orderBy(
      f.order === "asc" ? asc(taskOccurrences.dueDate) : desc(taskOccurrences.dueDate),
    )
    .limit(Math.min(2000, f.limit ?? 500));

  return rows as OccurrenceRow[];
}

export function toCsv(rows: OccurrenceRow[]): string {
  const header = [
    "occurrence_id",
    "task",
    "location",
    "recurrence",
    "criticality",
    "due_date",
    "window_end",
    "status",
    "completed_at",
    "janitor",
    "notes",
    "gps",
    "photos",
  ];
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((r) =>
    [
      r.id,
      r.name,
      r.location ?? "",
      r.recurrenceType,
      r.criticality,
      r.dueDate,
      r.windowEnd,
      r.status,
      r.completedAt ?? "",
      r.janitorName ?? "",
      r.notes ?? "",
      r.gpsLat && r.gpsLng ? `${r.gpsLat},${r.gpsLng}` : "",
      (r.photoUrls ?? []).join(" | "),
    ]
      .map(esc)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}
