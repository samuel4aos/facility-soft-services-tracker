import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { taskLogs, taskOccurrences, taskTemplates, users } from "@/db/schema";
import { getSession, unauthorized } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { ensureFresh } from "@/lib/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  await ensureFresh();

  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? todayISO();
  const facilityId = session.facilityId;

  const mine = or(
    eq(taskTemplates.assignedUserId, session.id),
    isNull(taskTemplates.assignedUserId),
  );

  const scope =
    session.role === "janitor"
      ? and(eq(taskTemplates.facilityId, facilityId ?? -1), mine)
      : facilityId
        ? eq(taskTemplates.facilityId, facilityId)
        : undefined;

  const rows = await db
    .select({
      id: taskOccurrences.id,
      dueDate: taskOccurrences.dueDate,
      windowEnd: taskOccurrences.windowEnd,
      status: taskOccurrences.status,
      templateId: taskTemplates.id,
      name: taskTemplates.name,
      location: taskTemplates.location,
      instructions: taskTemplates.instructions,
      requiresPhoto: taskTemplates.requiresPhoto,
      criticality: taskTemplates.criticality,
      recurrenceType: taskTemplates.recurrenceType,
      logId: taskLogs.id,
      completedAt: taskLogs.completedAt,
      notes: taskLogs.notes,
      janitorName: users.name,
    })
    .from(taskOccurrences)
    .innerJoin(taskTemplates, eq(taskTemplates.id, taskOccurrences.taskTemplateId))
    .leftJoin(
      taskLogs,
      and(eq(taskLogs.taskOccurrenceId, taskOccurrences.id), isNull(taskLogs.deletedAt)),
    )
    .leftJoin(users, eq(users.id, taskLogs.janitorId))
    .where(
      and(
        scope,
        eq(taskTemplates.active, true),
        isNull(taskTemplates.deletedAt),
        sql`${taskOccurrences.windowStart} <= ${date}::date`,
        sql`${taskOccurrences.windowEnd} >= ${date}::date`,
      ),
    )
    .orderBy(taskOccurrences.dueDate);

  // "Last completed" per template for the detail screen.
  const templateIds = [...new Set(rows.map((r) => r.templateId))];
  const lastCompleted = templateIds.length
    ? await db
        .select({
          templateId: taskOccurrences.taskTemplateId,
          completedAt: sql<string>`max(${taskLogs.completedAt})`,
        })
        .from(taskLogs)
        .innerJoin(taskOccurrences, eq(taskOccurrences.id, taskLogs.taskOccurrenceId))
        .where(
          and(
            inArray(taskOccurrences.taskTemplateId, templateIds),
            isNull(taskLogs.deletedAt),
          ),
        )
        .groupBy(taskOccurrences.taskTemplateId)
    : [];
  const lastMap = new Map(lastCompleted.map((l) => [l.templateId, l.completedAt]));

  const tasks = rows.map((r) => ({
    ...r,
    lastCompletedAt: lastMap.get(r.templateId) ?? null,
    completed: !!r.logId,
  }));

  return Response.json({
    date,
    tasks,
    summary: {
      total: tasks.length,
      completed: tasks.filter((t) => t.completed).length,
      overdue: tasks.filter((t) => !t.completed && t.dueDate < date).length,
      pending: tasks.filter((t) => !t.completed && t.dueDate >= date).length,
    },
  });
}
