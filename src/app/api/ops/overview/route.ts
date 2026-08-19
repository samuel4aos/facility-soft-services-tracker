import { and, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { alerts, consumables, taskLogs, taskOccurrences, taskTemplates, users } from "@/db/schema";
import { forbidden, getSession, unauthorized } from "@/lib/auth";
import { addDays, todayISO } from "@/lib/dates";
import { queryOccurrences } from "@/lib/opsQueries";
import { ensureFresh } from "@/lib/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === "janitor") return forbidden();
  await ensureFresh();

  const facilityId = session.role === "super_admin" ? null : session.facilityId;
  const today = todayISO();
  const facilityCond = facilityId
    ? eq(taskOccurrences.facilityId, facilityId)
    : undefined;

  const [todayStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where ${taskOccurrences.status} = 'completed')::int`,
      overdue: sql<number>`count(*) filter (where ${taskOccurrences.status} = 'overdue')::int`,
      pending: sql<number>`count(*) filter (where ${taskOccurrences.status} = 'pending')::int`,
    })
    .from(taskOccurrences)
    .where(
      and(
        facilityCond,
        lte(taskOccurrences.windowStart, today),
        gte(taskOccurrences.windowEnd, today),
      ),
    );

  const [missedStats] = await db
    .select({ missed: sql<number>`count(*)::int` })
    .from(taskOccurrences)
    .where(
      and(
        facilityCond,
        eq(taskOccurrences.status, "missed"),
        gte(taskOccurrences.dueDate, addDays(today, -30)),
      ),
    );

  const trend = await db
    .select({
      bucket: sql<string>`to_char(date_trunc('week', ${taskOccurrences.dueDate}::date), 'YYYY-MM-DD')`,
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where ${taskOccurrences.status} = 'completed')::int`,
    })
    .from(taskOccurrences)
    .where(
      and(
        facilityCond,
        gte(taskOccurrences.dueDate, addDays(today, -77)),
        lte(taskOccurrences.dueDate, today),
      ),
    )
    .groupBy(sql`date_trunc('week', ${taskOccurrences.dueDate}::date)`)
    .orderBy(sql`date_trunc('week', ${taskOccurrences.dueDate}::date)`);

  const byTask = await db
    .select({
      templateId: taskTemplates.id,
      name: taskTemplates.name,
      criticality: taskTemplates.criticality,
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where ${taskOccurrences.status} = 'completed')::int`,
      missed: sql<number>`count(*) filter (where ${taskOccurrences.status} = 'missed')::int`,
    })
    .from(taskOccurrences)
    .innerJoin(taskTemplates, eq(taskTemplates.id, taskOccurrences.taskTemplateId))
    .where(
      and(
        facilityCond,
        isNull(taskTemplates.deletedAt),
        gte(taskOccurrences.dueDate, addDays(today, -30)),
        lte(taskOccurrences.dueDate, today),
      ),
    )
    .groupBy(taskTemplates.id, taskTemplates.name, taskTemplates.criticality)
    .orderBy(taskTemplates.name);

  const alertRows = await db
    .select({
      id: alerts.id,
      severity: alerts.severity,
      message: alerts.message,
      createdAt: alerts.createdAt,
      acknowledgedAt: alerts.acknowledgedAt,
      dueDate: taskOccurrences.dueDate,
      name: taskTemplates.name,
      status: taskOccurrences.status,
    })
    .from(alerts)
    .leftJoin(taskOccurrences, eq(taskOccurrences.id, alerts.taskOccurrenceId))
    .leftJoin(taskTemplates, eq(taskTemplates.id, taskOccurrences.taskTemplateId))
    .where(facilityId ? eq(alerts.facilityId, facilityId) : undefined)
    .orderBy(sql`${taskOccurrences.dueDate} asc nulls last`)
    .limit(40);

  const upcoming = await queryOccurrences({
    facilityId,
    from: today,
    to: addDays(today, 120),
    status: "pending",
    order: "asc",
    limit: 400,
  });

  const attention = await queryOccurrences({
    facilityId,
    from: addDays(today, -30),
    to: today,
    order: "asc",
    limit: 300,
  });

  const janitors = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.role, "janitor")));

  const janitorIds = janitors.map((u) => u.id);
  const assignedRows =
    janitorIds.length > 0
      ? await db
          .select({
            janitorId: taskTemplates.assignedUserId,
            count: sql<number>`count(distinct ${taskOccurrences.id})::int`,
          })
          .from(taskOccurrences)
          .innerJoin(taskTemplates, eq(taskTemplates.id, taskOccurrences.taskTemplateId))
          .where(
            and(
              facilityId ? eq(taskOccurrences.facilityId, facilityId) : undefined,
              eq(taskTemplates.active, true),
              isNull(taskTemplates.deletedAt),
              gte(taskOccurrences.dueDate, addDays(today, -30)),
              lte(taskOccurrences.dueDate, today),
              inArray(taskTemplates.assignedUserId, janitorIds),
            ),
          )
          .groupBy(taskTemplates.assignedUserId)
      : [];

  const completedRows =
    janitorIds.length > 0
      ? await db
          .select({
            janitorId: taskLogs.janitorId,
            count: sql<number>`count(*)::int`,
          })
          .from(taskLogs)
          .innerJoin(taskOccurrences, eq(taskOccurrences.id, taskLogs.taskOccurrenceId))
          .where(
            and(
              facilityId ? eq(taskOccurrences.facilityId, facilityId) : undefined,
              isNull(taskLogs.deletedAt),
              gte(taskOccurrences.dueDate, addDays(today, -30)),
              lte(taskOccurrences.dueDate, today),
              inArray(taskLogs.janitorId, janitorIds),
            ),
          )
          .groupBy(taskLogs.janitorId)
      : [];

  const completedMap = new Map(completedRows.map((r) => [r.janitorId, r.count]));
  const janitorStats = janitors
    .map((u) => {
      const total = assignedRows.find((r) => r.janitorId === u.id)?.count ?? 0;
      const completed = completedMap.get(u.id) ?? 0;
      return {
        id: u.id,
        name: u.name,
        total,
        completed,
        rate: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    })
    .filter((s) => s.total > 0 || s.completed > 0)
    .sort((a, b) => b.rate - a.rate);

  const lowStockConsumables = await db
    .select({
      id: consumables.id,
      name: consumables.name,
      currentStock: consumables.currentStock,
      minStock: consumables.minStock,
      unit: consumables.unit,
      location: consumables.location,
    })
    .from(consumables)
    .where(
      and(
        eq(consumables.active, true),
        lte(consumables.currentStock, consumables.minStock),
        facilityId ? eq(consumables.facilityId, facilityId) : undefined,
      ),
    )
    .orderBy(consumables.currentStock);

  return Response.json({
    today,
    todayStats: { ...todayStats, missed: missedStats?.missed ?? 0 },
    trend,
    byTask,
    alerts: alertRows,
    upcoming: upcoming.filter((u) =>
      ["monthly", "quarterly", "biannual", "biweekly"].includes(u.recurrenceType),
    ),
    attention: attention.filter((a) => a.status === "missed" || a.status === "overdue"),
    janitorStats,
    lowStockConsumables,
  });
}
