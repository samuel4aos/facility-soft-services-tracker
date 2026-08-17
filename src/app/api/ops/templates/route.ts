import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, taskTemplates, users } from "@/db/schema";
import { forbidden, getSession, unauthorized } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import {
  describeRecurrence,
  nextDueAfter,
  normalizeConfig,
  RECURRENCE_TYPES,
  type RecurrenceConfig,
  type RecurrenceType,
} from "@/lib/recurrence";
import { runScheduler } from "@/lib/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === "janitor") return forbidden();

  const rows = await db
    .select({
      id: taskTemplates.id,
      name: taskTemplates.name,
      location: taskTemplates.location,
      recurrenceType: taskTemplates.recurrenceType,
      recurrenceConfig: taskTemplates.recurrenceConfig,
      requiresPhoto: taskTemplates.requiresPhoto,
      instructions: taskTemplates.instructions,
      criticality: taskTemplates.criticality,
      active: taskTemplates.active,
      assignedUserId: taskTemplates.assignedUserId,
      assignedName: users.name,
      facilityId: taskTemplates.facilityId,
    })
    .from(taskTemplates)
    .leftJoin(users, eq(users.id, taskTemplates.assignedUserId))
    .where(
      and(
        isNull(taskTemplates.deletedAt),
        session.role === "super_admin" || !session.facilityId
          ? undefined
          : eq(taskTemplates.facilityId, session.facilityId),
      ),
    )
    .orderBy(taskTemplates.name);

  const today = todayISO();
  return Response.json({
    templates: rows.map((r) => ({
      ...r,
      summary: describeRecurrence(
        r.recurrenceType as RecurrenceType,
        (r.recurrenceConfig ?? {}) as RecurrenceConfig,
      ),
      nextDue: r.active
        ? nextDueAfter(
            r.recurrenceType as RecurrenceType,
            (r.recurrenceConfig ?? {}) as RecurrenceConfig,
            today,
          )
        : null,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === "janitor") return forbidden();

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  const recurrenceType = String(body.recurrenceType ?? "") as RecurrenceType;
  if (!name) return Response.json({ error: "Name is required" }, { status: 400 });
  if (!RECURRENCE_TYPES.includes(recurrenceType)) {
    return Response.json({ error: "Invalid recurrence type" }, { status: 400 });
  }

  const facilityId =
    Number(body.facilityId ?? session.facilityId ?? 0) ||
    (await db.execute(sql`select id from facilities order by id limit 1`)).rows[0]
      ?.id as number;

  const [created] = await db
    .insert(taskTemplates)
    .values({
      facilityId,
      name,
      location: (body.location as string) || null,
      recurrenceType,
      recurrenceConfig: normalizeConfig(
        recurrenceType,
        (body.recurrenceConfig ?? {}) as Record<string, unknown>,
      ),
      requiresPhoto: body.requiresPhoto !== false,
      instructions: (body.instructions as string) || null,
      criticality: body.criticality === "critical" ? "critical" : "standard",
      assignedUserId: body.assignedUserId ? Number(body.assignedUserId) : null,
      active: body.active !== false,
    })
    .returning();

  await db.insert(auditEvents).values({
    actorId: session.id,
    action: "template.created",
    entity: "task_template",
    entityId: String(created.id),
    meta: { name },
  });

  await runScheduler(true);
  return Response.json({ template: created }, { status: 201 });
}
