import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  auditEvents,
  customTasks,
  customTaskPhotos,
  taskAssignments,
} from "@/db/schema";
import { getSession, unauthorized } from "@/lib/auth";
import { parseDataUrl, putObject } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  notes?: string;
  photos?: string[];
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id: idStr } = await params;
  const taskId = Number(idStr);
  if (!taskId) {
    return Response.json({ error: "Invalid task ID" }, { status: 400 });
  }

  const [task] = await db
    .select()
    .from(customTasks)
    .where(and(eq(customTasks.id, taskId), isNull(customTasks.deletedAt)))
    .limit(1);
  if (!task) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  if (task.status !== "pending") {
    return Response.json({ error: "Task is not pending" }, { status: 400 });
  }

  const isAssigned = await db
    .select({ id: taskAssignments.id })
    .from(taskAssignments)
    .where(
      and(
        eq(taskAssignments.customTaskId, taskId),
        eq(taskAssignments.userId, session.id),
      ),
    )
    .limit(1);
  if (isAssigned.length === 0 && task.createdById !== session.id) {
    return Response.json({ error: "Not assigned to you" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const incomingPhotos = (body.photos ?? []).filter(Boolean).slice(0, 5);
  if (task.requiresPhoto && incomingPhotos.length === 0) {
    return Response.json(
      { error: "A photo is required for this task" },
      { status: 400 },
    );
  }

  await db
    .update(customTasks)
    .set({
      status: "completed",
      completedAt: new Date(),
      completedBy: session.id,
      completionNotes: body.notes?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(customTasks.id, taskId));

  for (const dataUrl of incomingPhotos) {
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) continue;
    const stored = await putObject(parsed.buffer, parsed.mime, "custom-photos");
    await db.insert(customTaskPhotos).values({
      customTaskId: taskId,
      uploadedBy: session.id,
      url: stored.url,
      storageKey: stored.key,
    });
  }

  await db.insert(auditEvents).values({
    actorId: session.id,
    action: "custom_task.completed",
    entity: "custom_task",
    entityId: String(taskId),
    meta: { task: task.name, notes: body.notes },
  });

  return Response.json({ ok: true });
}
