import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, taskTemplates } from "@/db/schema";
import { forbidden, getSession, unauthorized } from "@/lib/auth";
import {
  normalizeConfig,
  RECURRENCE_TYPES,
  type RecurrenceType,
} from "@/lib/recurrence";
import { runScheduler } from "@/lib/scheduler";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === "janitor") return forbidden();

  const { id } = await ctx.params;
  const templateId = Number(id);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const [existing] = await db
    .select()
    .from(taskTemplates)
    .where(eq(taskTemplates.id, templateId))
    .limit(1);
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
  if (session.role === "ops_admin" && existing.facilityId !== session.facilityId) {
    return forbidden();
  }

  const recurrenceType = (body.recurrenceType as RecurrenceType) ?? existing.recurrenceType;
  if (!RECURRENCE_TYPES.includes(recurrenceType as RecurrenceType)) {
    return Response.json({ error: "Invalid recurrence type" }, { status: 400 });
  }

  const [updated] = await db
    .update(taskTemplates)
    .set({
      name: body.name !== undefined ? String(body.name) : existing.name,
      location:
        body.location !== undefined ? (body.location as string) || null : existing.location,
      recurrenceType: recurrenceType as RecurrenceType,
      recurrenceConfig:
        body.recurrenceConfig !== undefined || body.recurrenceType !== undefined
          ? normalizeConfig(
              recurrenceType as RecurrenceType,
              (body.recurrenceConfig ?? existing.recurrenceConfig ?? {}) as Record<
                string,
                unknown
              >,
            )
          : existing.recurrenceConfig,
      requiresPhoto:
        body.requiresPhoto !== undefined
          ? Boolean(body.requiresPhoto)
          : existing.requiresPhoto,
      instructions:
        body.instructions !== undefined
          ? (body.instructions as string) || null
          : existing.instructions,
      criticality:
        body.criticality !== undefined
          ? body.criticality === "critical"
            ? "critical"
            : "standard"
          : existing.criticality,
      assignedUserId:
        body.assignedUserId !== undefined
          ? body.assignedUserId
            ? Number(body.assignedUserId)
          : null
          : existing.assignedUserId,
      assignedUserIds: Array.isArray(body.assignedUserIds)
        ? body.assignedUserIds
        : body.assignedUserId !== undefined
          ? body.assignedUserId
            ? [Number(body.assignedUserId)]
          : existing.assignedUserIds ?? []
          : existing.assignedUserIds,
      maxAssignees:
        body.maxAssignees !== undefined
          ? Number(body.maxAssignees)
          : existing.maxAssignees ?? 3,
      active: body.active !== undefined ? Boolean(body.active) : existing.active,
      areaGroup:
        body.areaGroup !== undefined
          ? (body.areaGroup as string) || null
          : existing.areaGroup,
      timingType:
        body.timingType !== undefined
          ? (body.timingType as string) || null
          : existing.timingType,
    })
    .where(eq(taskTemplates.id, templateId))
    .returning();

  await db.insert(auditEvents).values({
    actorId: session.id,
    action: "template.updated",
    entity: "task_template",
    entityId: String(templateId),
    meta: body as Record<string, unknown>,
  });

  await runScheduler(true);
  return Response.json({ template: updated });
}

/** Soft delete only — audit trail must never lose history. */
export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === "janitor") return forbidden();
  const { id } = await ctx.params;

  await db
    .update(taskTemplates)
    .set({ active: false, deletedAt: new Date() })
    .where(eq(taskTemplates.id, Number(id)));

  await db.insert(auditEvents).values({
    actorId: session.id,
    action: "template.soft_deleted",
    entity: "task_template",
    entityId: id,
  });

  return Response.json({ ok: true });
}
