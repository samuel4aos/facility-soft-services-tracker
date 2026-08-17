import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, customTasks, taskAssignments } from "@/db/schema";
import { forbidden, getSession, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PatchBody = {
  name?: string;
  area?: string;
  instructions?: string;
  dueDate?: string;
  priority?: string;
  status?: string;
  requiresPhoto?: boolean;
  assignedTo?: number[];
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === "janitor") return forbidden();

  const { id: idStr } = await params;
  const taskId = Number(idStr);
  if (!taskId) {
    return Response.json({ error: "Invalid task ID" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(customTasks)
    .where(and(eq(customTasks.id, taskId), isNull(customTasks.deletedAt)))
    .limit(1);
  if (!existing) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  if (
    session.facilityId &&
    existing.facilityId !== session.facilityId
  ) {
    return forbidden();
  }

  const body = (await request.json().catch(() => ({}))) as PatchBody;
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) updates.name = String(body.name).trim();
  if (body.area !== undefined) updates.area = String(body.area).trim() || null;
  if (body.instructions !== undefined)
    updates.instructions = String(body.instructions).trim() || null;
  if (body.dueDate !== undefined)
    updates.dueDate = String(body.dueDate).trim() || null;
  if (body.priority !== undefined)
    updates.priority = ["standard", "urgent"].includes(String(body.priority))
      ? String(body.priority)
      : existing.priority;
  if (body.status !== undefined) {
    const valid = ["pending", "in_progress", "completed", "cancelled"];
    if (valid.includes(String(body.status))) {
      updates.status = String(body.status);
      if (body.status === "completed") {
        updates.completedAt = new Date();
        updates.completedBy = session.id;
      }
    }
  }
  if (body.requiresPhoto !== undefined)
    updates.requiresPhoto = body.requiresPhoto;

  if (Object.keys(updates).length > 0) {
    updates.updatedAt = new Date();
    await db
      .update(customTasks)
      .set(updates)
      .where(eq(customTasks.id, taskId));
  }

  if (Array.isArray(body.assignedTo)) {
    await db
      .delete(taskAssignments)
      .where(eq(taskAssignments.customTaskId, taskId));
    if (body.assignedTo.length > 0) {
      await db.insert(taskAssignments).values(
        body.assignedTo.map((userId) => ({
          customTaskId: taskId,
          userId,
        })),
      );
    }
  }

  await db.insert(auditEvents).values({
    actorId: session.id,
    action: "custom_task.updated",
    entity: "custom_task",
    entityId: String(taskId),
    meta: { updates, assignedTo: body.assignedTo },
  });

  return Response.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === "janitor") return forbidden();

  const { id: idStr } = await params;
  const taskId = Number(idStr);
  if (!taskId) {
    return Response.json({ error: "Invalid task ID" }, { status: 400 });
  }

  await db
    .update(customTasks)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(customTasks.id, taskId));

  await db.insert(auditEvents).values({
    actorId: session.id,
    action: "custom_task.deleted",
    entity: "custom_task",
    entityId: String(taskId),
    meta: {},
  });

  return Response.json({ ok: true });
}
