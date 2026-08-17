import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  customTasks,
  customTaskPhotos,
  taskAssignments,
  users,
} from "@/db/schema";
import { getSession, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
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
    .select({
      id: customTasks.id,
      name: customTasks.name,
      area: customTasks.area,
      instructions: customTasks.instructions,
      dueDate: customTasks.dueDate,
      priority: customTasks.priority,
      status: customTasks.status,
      requiresPhoto: customTasks.requiresPhoto,
      completedAt: customTasks.completedAt,
      completionNotes: customTasks.completionNotes,
      createdAt: customTasks.createdAt,
      createdByName: users.name,
    })
    .from(customTasks)
    .leftJoin(users, eq(users.id, customTasks.createdById))
    .where(and(eq(customTasks.id, taskId), isNull(customTasks.deletedAt)))
    .limit(1);

  if (!task) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  const assignedTo = await db
    .select({
      userId: taskAssignments.userId,
      userName: users.name,
    })
    .from(taskAssignments)
    .innerJoin(users, eq(users.id, taskAssignments.userId))
    .where(eq(taskAssignments.customTaskId, taskId));

  const photos = await db
    .select({
      id: customTaskPhotos.id,
      url: customTaskPhotos.url,
      uploadedAt: customTaskPhotos.uploadedAt,
      uploadedByName: users.name,
    })
    .from(customTaskPhotos)
    .innerJoin(users, eq(users.id, customTaskPhotos.uploadedBy))
    .where(eq(customTaskPhotos.customTaskId, taskId));

  return Response.json({ task, assignedTo, photos });
}
