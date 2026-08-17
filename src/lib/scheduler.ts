import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  alerts,
  taskLogs,
  taskOccurrences,
  taskTemplates,
} from "@/db/schema";
import { addDays, todayISO } from "./dates";
import {
  generateOccurrences,
  type RecurrenceConfig,
  type RecurrenceType,
} from "./recurrence";

export type SchedulerResult = {
  ranAt: string;
  created: number;
  statusChanges: number;
  alertsCreated: number;
};

/**
 * Materialise occurrences for every active template into the future horizon,
 * plus a short look-back so newly created templates still get evaluated.
 */
export async function materializeOccurrences(
  horizonDays = 120,
  lookbackDays = 0,
): Promise<number> {
  const templates = await db
    .select()
    .from(taskTemplates)
    .where(and(eq(taskTemplates.active, true), isNull(taskTemplates.deletedAt)));

  const today = todayISO();
  const rangeStart = today;
  const rangeEnd = addDays(today, horizonDays);
  let created = 0;

  for (const template of templates) {
    const specs = generateOccurrences(
      template.recurrenceType as RecurrenceType,
      (template.recurrenceConfig ?? {}) as RecurrenceConfig,
      rangeStart,
      rangeEnd,
    );
    if (!specs.length) continue;
    const rows = specs.map((s) => ({
      taskTemplateId: template.id,
      facilityId: template.facilityId,
      dueDate: s.dueDate,
      dueHour: s.dueHour,
      windowStart: s.windowStart,
      windowEnd: s.windowEnd,
    }));
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const res = await db
        .insert(taskOccurrences)
        .values(chunk)
        .onConflictDoNothing()
        .returning({ id: taskOccurrences.id });
      created += res.length;
    }
  }
  return created;
}

/** Recompute pending/overdue/missed/completed for all non-final occurrences. */
export async function refreshStatuses(): Promise<number> {
  const today = todayISO();
  const result = await db.execute(sql`
    WITH computed AS (
      SELECT o.id,
             CASE
               WHEN l.id IS NOT NULL THEN 'completed'
               WHEN ${today}::date > o.window_end THEN 'missed'
               WHEN ${today}::date > o.due_date THEN 'overdue'
               ELSE 'pending'
             END::occurrence_status AS next_status
      FROM task_occurrences o
      LEFT JOIN LATERAL (
        SELECT tl.id FROM task_logs tl
        WHERE tl.task_occurrence_id = o.id AND tl.deleted_at IS NULL
        LIMIT 1
      ) l ON true
    )
    UPDATE task_occurrences o
    SET status = c.next_status, updated_at = now()
    FROM computed c
    WHERE o.id = c.id AND o.status IS DISTINCT FROM c.next_status
    RETURNING o.id
  `);
  return result.rowCount ?? 0;
}

/** Raise (idempotent) alerts for missed tasks — critical ones escalate. */
export async function raiseMissedAlerts(): Promise<number> {
  const missed = await db
    .select({
      id: taskOccurrences.id,
      facilityId: taskOccurrences.facilityId,
      dueDate: taskOccurrences.dueDate,
      name: taskTemplates.name,
      criticality: taskTemplates.criticality,
    })
    .from(taskOccurrences)
    .innerJoin(taskTemplates, eq(taskTemplates.id, taskOccurrences.taskTemplateId))
    .where(eq(taskOccurrences.status, "missed"))
    .limit(500);

  if (!missed.length) return 0;

  const existing = await db
    .select({ id: alerts.taskOccurrenceId })
    .from(alerts)
    .where(
      inArray(
        alerts.taskOccurrenceId,
        missed.map((m) => m.id),
      ),
    );
  const seen = new Set(existing.map((e) => e.id));
  const rows = missed
    .filter((m) => !seen.has(m.id))
    .map((m) => ({
      facilityId: m.facilityId,
      taskOccurrenceId: m.id,
      severity: m.criticality === "critical" ? "critical" : "warning",
      channel: m.criticality === "critical" ? "email" : "in_app",
      message: `${m.name} was MISSED (due ${m.dueDate}).${
        m.criticality === "critical" ? " Safety/compliance critical — escalate to ops." : ""
      }`,
    }));
  if (!rows.length) return 0;
  await db.insert(alerts).values(rows);

  const webhookUrl = process.env.NOTIFICATION_WEBHOOK_URL;
  if (webhookUrl) {
    for (const row of rows.filter((r) => r.severity === "critical")) {
      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            severity: "critical",
            message: row.message,
            facilityId: row.facilityId,
            taskOccurrenceId: row.taskOccurrenceId,
            timestamp: new Date().toISOString(),
          }),
        });
      } catch (err) {
        console.error("[notification] webhook failed:", err);
      }
    }
  }

  return rows.length;
}

let lastRun = 0;
let lastResult: SchedulerResult | null = null;

export async function runScheduler(force = false): Promise<SchedulerResult> {
  const now = Date.now();
  if (!force && lastResult && now - lastRun < 60_000) return lastResult;
  lastRun = now;
  const created = await materializeOccurrences();
  const statusChanges = await refreshStatuses();
  const alertsCreated = await raiseMissedAlerts();
  lastResult = {
    ranAt: new Date().toISOString(),
    created,
    statusChanges,
    alertsCreated,
  };
  return lastResult;
}

/** Convenience for read paths: keep data fresh without blocking too often. */
export async function ensureFresh() {
  try {
    await runScheduler(false);
  } catch (err) {
    console.error("scheduler failed", err);
  }
}

export async function hasLogFor(occurrenceId: number) {
  const [row] = await db
    .select({ id: taskLogs.id })
    .from(taskLogs)
    .where(and(eq(taskLogs.taskOccurrenceId, occurrenceId), isNull(taskLogs.deletedAt)))
    .limit(1);
  return !!row;
}
