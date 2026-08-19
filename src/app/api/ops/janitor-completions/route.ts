import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  photos,
  taskLogs,
  taskOccurrences,
  taskTemplates,
  users,
} from "@/db/schema";
import { forbidden, getSession, unauthorized } from "@/lib/auth";
import { todayISO } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === "janitor") return forbidden();

  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? todayISO();
  const facilityId = session.role === "super_admin" ? null : session.facilityId;

  const rows = await db
    .select({
      logId: taskLogs.id,
      janitorId: users.id,
      janitorName: users.name,
      taskName: taskTemplates.name,
      location: taskTemplates.location,
      areaGroup: taskTemplates.areaGroup,
      completedAt: taskLogs.completedAt,
      notes: taskLogs.notes,
      photoUrls: sql<string[]>`coalesce(array_agg(${photos.url}) filter (where ${photos.url} is not null), '{}')`,
    })
    .from(taskLogs)
    .innerJoin(taskOccurrences, eq(taskOccurrences.id, taskLogs.taskOccurrenceId))
    .innerJoin(taskTemplates, eq(taskTemplates.id, taskOccurrences.taskTemplateId))
    .innerJoin(users, eq(users.id, taskLogs.janitorId))
    .leftJoin(photos, eq(photos.taskLogId, taskLogs.id))
    .where(
      and(
        isNull(taskLogs.deletedAt),
        facilityId ? eq(taskOccurrences.facilityId, facilityId) : undefined,
        sql`${taskLogs.completedAt}::date = ${date}::date`,
      ),
    )
    .groupBy(
      taskLogs.id,
      users.id,
      users.name,
      taskTemplates.name,
      taskTemplates.location,
      taskTemplates.areaGroup,
    )
    .orderBy(desc(taskLogs.completedAt));

  // Group per janitor for a per-janitor daily summary.
  const byJanitor = new Map<
    number,
    {
      id: number;
      name: string;
      total: number;
      tasks: {
        logId: number;
        name: string;
        location: string | null;
        areaGroup: string | null;
        completedAt: string;
        notes: string | null;
        photoCount: number;
      }[];
    }
  >();

  for (const r of rows) {
    const entry = byJanitor.get(r.janitorId) ?? {
      id: r.janitorId,
      name: r.janitorName,
      total: 0,
      tasks: [],
    };
    entry.total += 1;
    entry.tasks.push({
      logId: r.logId,
      name: r.taskName,
      location: r.location,
      areaGroup: r.areaGroup,
      completedAt: r.completedAt as unknown as string,
      notes: r.notes,
      photoCount: r.photoUrls?.length ?? 0,
    });
    byJanitor.set(r.janitorId, entry);
  }

  return Response.json({
    date,
    janitors: [...byJanitor.values()],
    totalCompleted: rows.length,
  });
}