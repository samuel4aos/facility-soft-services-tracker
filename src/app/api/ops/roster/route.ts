import { and, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { dutyRoster, taskOccurrences, taskTemplates, users } from "@/db/schema";
import { forbidden, getSession, unauthorized } from "@/lib/auth";
import { addDays, todayISO } from "@/lib/dates";
import {
  generateOccurrences,
  type RecurrenceConfig,
  type RecurrenceType,
} from "@/lib/recurrence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/ops/roster?month=YYYY-MM — monthly roster for all janitors */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === "janitor") return forbidden();

  const p = new URL(request.url).searchParams;
  const monthStr = p.get("month") ?? todayISO().slice(0, 7); // default current month YYYY-MM

  // Parse month boundaries
  const [year, month] = monthStr.split("-").map(Number);
  const monthStart = `${monthStr}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${monthStr}-${String(lastDay).padStart(2, "0")}`;

  // Get all janitors + gardeners (everyone who can be assigned tasks)
  const janitors = await db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(inArray(users.role, ["janitor", "gardener"]))
    .orderBy(users.name);

  // Get roster entries for this month
  const rosterRows = await db
    .select({ userId: dutyRoster.userId, date: dutyRoster.date, onDuty: dutyRoster.onDuty })
    .from(dutyRoster)
    .where(
      and(
        gte(dutyRoster.date, monthStart),
        lte(dutyRoster.date, monthEnd),
      ),
    );

  // Build a map: userId -> Set of off-duty dates
  const offDutyMap = new Map<number, Set<string>>();
  for (const row of rosterRows) {
    if (!row.onDuty) {
      const dates = offDutyMap.get(row.userId) ?? new Set<string>();
      dates.add(row.date);
      offDutyMap.set(row.userId, dates);
    }
  }

  // Get templates assigned to each janitor (to determine which days they have scheduled tasks)
  const templates = await db
    .select({
      id: taskTemplates.id,
      assignedUserId: taskTemplates.assignedUserId,
      assignedUserIds: taskTemplates.assignedUserIds,
      recurrenceType: taskTemplates.recurrenceType,
      recurrenceConfig: taskTemplates.recurrenceConfig,
      active: taskTemplates.active,
    })
    .from(taskTemplates)
    .where(and(eq(taskTemplates.active, true), isNull(taskTemplates.deletedAt)));

  // For each janitor, determine which days of the month have scheduled tasks
  const scheduledMap = new Map<number, Set<string>>();
  for (const template of templates) {
    const assignedIds: number[] = [];
    if (template.assignedUserId) assignedIds.push(template.assignedUserId);
    if (Array.isArray(template.assignedUserIds)) {
      for (const id of template.assignedUserIds) {
        if (!assignedIds.includes(id)) assignedIds.push(id);
      }
    }
    if (!assignedIds.length) continue;

    const specs = generateOccurrences(
      template.recurrenceType as RecurrenceType,
      (template.recurrenceConfig ?? {}) as RecurrenceConfig,
      monthStart,
      monthEnd,
    );
    for (const spec of specs) {
      for (const uid of assignedIds) {
        const dates = scheduledMap.get(uid) ?? new Set<string>();
        dates.add(spec.dueDate);
        scheduledMap.set(uid, dates);
      }
    }
  }

  // Build response
  const daysInMonth = Array.from({ length: lastDay }, (_, i) => {
    return `${monthStr}-${String(i + 1).padStart(2, "0")}`;
  });

  const result = janitors.map((j) => {
    const offDutyDates = offDutyMap.get(j.id) ?? new Set<string>();
    const scheduledDates = scheduledMap.get(j.id) ?? new Set<string>();
    return {
      id: j.id,
      name: j.name,
      role: j.role,
      days: daysInMonth.map((d) => ({
        date: d,
        scheduled: scheduledDates.has(d),
        onDuty: !offDutyDates.has(d),
      })),
    };
  });

  return Response.json({ month: monthStr, daysInMonth, janitors: result });
}

/** PUT /api/ops/roster — save roster entries */
export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === "janitor") return forbidden();

  const body = await request.json();
  const entries = body.entries as { userId: number; date: string; onDuty: boolean }[];

  if (!Array.isArray(entries) || entries.length === 0) {
    return Response.json({ error: "entries array required" }, { status: 400 });
  }

  // Upsert each entry
  for (const entry of entries) {
    await db
      .insert(dutyRoster)
      .values({
        userId: entry.userId,
        date: entry.date,
        onDuty: entry.onDuty,
      })
      .onConflictDoUpdate({
        target: [dutyRoster.userId, dutyRoster.date],
        set: { onDuty: entry.onDuty, updatedAt: new Date() },
      });
  }

  // Sync occurrences: for off-duty entries, cancel pending occurrences; for on-duty, restore
  const today = todayISO();
  for (const entry of entries) {
    if (entry.date < today) continue; // skip past dates

    // Get templates assigned to this janitor
    const templates = await db
      .select({
        id: taskTemplates.id,
        assignedUserId: taskTemplates.assignedUserId,
        assignedUserIds: taskTemplates.assignedUserIds,
      })
      .from(taskTemplates)
      .where(and(eq(taskTemplates.active, true), isNull(taskTemplates.deletedAt)));

    for (const template of templates) {
      const assignedIds: number[] = [];
      if (template.assignedUserId) assignedIds.push(template.assignedUserId);
      if (Array.isArray(template.assignedUserIds)) {
        for (const id of template.assignedUserIds) {
          if (!assignedIds.includes(id)) assignedIds.push(id);
        }
      }
      if (!assignedIds.includes(entry.userId)) continue;

      if (!entry.onDuty) {
        // Cancel pending occurrences for this template on this date
        await db
          .update(taskOccurrences)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(
            and(
              eq(taskOccurrences.taskTemplateId, template.id),
              eq(taskOccurrences.dueDate, entry.date),
              eq(taskOccurrences.status, "pending"),
            ),
          );
      } else {
        // Delete cancelled occurrences for this template on this date
        // (scheduler will regenerate them on next materializeOccurrences run)
        await db
          .delete(taskOccurrences)
          .where(
            and(
              eq(taskOccurrences.taskTemplateId, template.id),
              eq(taskOccurrences.dueDate, entry.date),
              eq(taskOccurrences.status, "cancelled"),
            ),
          );
      }
    }
  }

  return Response.json({ ok: true });
}
