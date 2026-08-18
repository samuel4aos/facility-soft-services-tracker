import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { photos, taskLogs, taskOccurrences, taskTemplates } from "@/db/schema";
import { getSession, unauthorized } from "@/lib/auth";
import { addDays, todayISO } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  const url = new URL(request.url);
  const days = Number(url.searchParams.get("days") ?? 45);
  const since = addDays(todayISO(), -Math.min(365, Math.max(1, days)));

  const rows = await db
    .select({
      id: taskLogs.id,
      completedAt: taskLogs.completedAt,
      notes: taskLogs.notes,
      statusAtLogTime: taskLogs.statusAtLogTime,
      dueDate: taskOccurrences.dueDate,
      completionMetadata: taskLogs.completionMetadata,
      name: taskTemplates.name,
      location: taskTemplates.location,
      photoUrls: sql<string[]>`coalesce(array_agg(${photos.url}) filter (where ${photos.url} is not null), '{}')`,
    })
    .from(taskLogs)
    .innerJoin(taskOccurrences, eq(taskOccurrences.id, taskLogs.taskOccurrenceId))
    .innerJoin(taskTemplates, eq(taskTemplates.id, taskOccurrences.taskTemplateId))
    .leftJoin(photos, eq(photos.taskLogId, taskLogs.id))
    .where(
      and(
        eq(taskLogs.janitorId, session.id),
        isNull(taskLogs.deletedAt),
        gte(sql`${taskLogs.completedAt}::date`, sql`${since}::date`),
      ),
    )
    .groupBy(
      taskLogs.id,
      taskOccurrences.dueDate,
      taskTemplates.name,
      taskTemplates.location,
    )
    .orderBy(desc(taskLogs.completedAt))
    .limit(300);

  return Response.json({ logs: rows });
}
