import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { customTasks, taskAssignments, users } from "@/db/schema";
import { getSession, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const rows = await db
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
    .innerJoin(taskAssignments, eq(taskAssignments.customTaskId, customTasks.id))
    .leftJoin(users, eq(users.id, customTasks.createdById))
    .where(
      and(
        eq(taskAssignments.userId, session.id),
        isNull(customTasks.deletedAt),
        eq(customTasks.status, "pending"),
      ),
    )
    .orderBy(customTasks.dueDate);

  return Response.json({
    assignedToMe: rows,
    createdByMe: [],
  });
}
