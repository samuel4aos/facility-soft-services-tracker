import { and, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  customTasks,
  taskAssignments,
  taskLogs,
  taskOccurrences,
  taskTemplates,
} from "@/db/schema";
import { getSession, unauthorized } from "@/lib/auth";
import { currentHour, todayISO } from "@/lib/dates";
import { ensureFresh } from "@/lib/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  await ensureFresh();

  const facilityId = session.facilityId;
  const date = todayISO();
  const hour = currentHour();

  // 1. Scheduled occurrences where this janitor is assigned via template
  const scheduledRows = await db
    .select({
      id: taskOccurrences.id,
      source: sql<string>`'scheduled'`,
      name: taskTemplates.name,
      area: taskTemplates.location,
      areaGroup: taskTemplates.areaGroup,
      sortOrder: taskTemplates.sortOrder,
      timingType: taskTemplates.timingType,
      instructions: taskTemplates.instructions,
      dueDate: taskOccurrences.dueDate,
      windowEnd: taskOccurrences.windowEnd,
      priority: taskTemplates.criticality,
      requiresPhoto: taskTemplates.requiresPhoto,
      completed: sql<boolean>`CASE WHEN ${taskLogs.id} IS NOT NULL THEN true ELSE false END`,
      completedAt: taskLogs.completedAt,
      completionNotes: taskLogs.notes,
      createdAt: taskTemplates.createdAt,
      createdByName: sql<string>`null`,
      dueTime: sql<string>`(${taskTemplates.recurrenceConfig}->>'dueTime')`,
      dueHour: taskOccurrences.dueHour,
    })
    .from(taskOccurrences)
    .innerJoin(taskTemplates, eq(taskTemplates.id, taskOccurrences.taskTemplateId))
    .leftJoin(
      taskLogs,
      and(eq(taskLogs.taskOccurrenceId, taskOccurrences.id), isNull(taskLogs.deletedAt)),
    )
    .where(
      and(
        or(
          eq(taskTemplates.assignedUserId, session.id),
          sql`jsonb_exists(${taskTemplates.assignedUserIds}, ${`$ ? (@ == ${session.id})`})`,
        ),
        eq(taskTemplates.facilityId, facilityId ?? -1),
        eq(taskTemplates.active, true),
        isNull(taskTemplates.deletedAt),
        eq(taskOccurrences.status, "pending"),
        sql`${taskOccurrences.dueDate} = ${date}::date`,
        // Hourly tasks surface progressively: the current hour's slot is
        // prompted when its hour arrives, and any earlier pending slot stays
        // visible so nothing is silently lost. Future hours are hidden.
        or(
          isNull(taskOccurrences.dueHour),
          sql`${taskOccurrences.dueHour} <= ${hour}`,
        ),
      ),
    )
    .orderBy(taskOccurrences.dueDate, taskOccurrences.dueHour);

  // 2. Custom ad-hoc tasks assigned to this janitor
  const customRows = await db
    .select({
      id: customTasks.id,
      source: sql<string>`'adhoc'`,
      name: customTasks.name,
      area: customTasks.area,
      areaGroup: sql<string>`'Ad-hoc Tasks'`,
      sortOrder: sql<number>`999`,
      timingType: sql<string>`null`,
      instructions: customTasks.instructions,
      dueDate: customTasks.dueDate,
      windowEnd: sql<string>`null`,
      priority: customTasks.priority,
      requiresPhoto: customTasks.requiresPhoto,
      completed: sql<boolean>`CASE WHEN ${customTasks.status} = 'completed' THEN true ELSE false END`,
      completedAt: customTasks.completedAt,
      completionNotes: customTasks.completionNotes,
      createdAt: customTasks.createdAt,
      createdByName: sql<string>`null`,
    })
    .from(customTasks)
    .innerJoin(taskAssignments, eq(taskAssignments.customTaskId, customTasks.id))
    .where(
      and(
        eq(taskAssignments.userId, session.id),
        isNull(customTasks.deletedAt),
        eq(customTasks.status, "pending"),
        sql`${customTasks.dueDate} = ${date}::date`,
      ),
    )
    .orderBy(customTasks.dueDate);

  return Response.json({
    scheduled: scheduledRows,
    adhoc: customRows,
    total: scheduledRows.length + customRows.length,
  });
}
