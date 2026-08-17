import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, customTasks, taskAssignments, users } from "@/db/schema";
import { forbidden, getSession, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  name?: string;
  area?: string;
  instructions?: string;
  dueDate?: string;
  priority?: string;
  requiresPhoto?: boolean;
  assignedTo?: number[];
};

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === "janitor") return forbidden();

  const body = (await request.json().catch(() => ({}))) as Body;
  const name = String(body.name ?? "").trim();
  if (!name) {
    return Response.json({ error: "Task name is required" }, { status: 400 });
  }

  const area = String(body.area ?? "").trim() || null;
  const instructions = String(body.instructions ?? "").trim() || null;
  const dueDate = String(body.dueDate ?? "").trim() || null;
  const priority = ["standard", "urgent"].includes(String(body.priority))
    ? String(body.priority)
    : "standard";
  const requiresPhoto = body.requiresPhoto !== false;
  const assignedTo = Array.isArray(body.assignedTo)
    ? body.assignedTo.map(Number).filter((n) => n > 0)
    : [];

  const facilityId = session.facilityId;
  if (!facilityId) {
    return Response.json({ error: "No facility assigned" }, { status: 400 });
  }

  const [task] = await db
    .insert(customTasks)
    .values({
      facilityId,
      createdById: session.id,
      name,
      area,
      instructions,
      dueDate,
      priority,
      requiresPhoto,
    })
    .returning();

  if (assignedTo.length > 0) {
    await db.insert(taskAssignments).values(
      assignedTo.map((userId) => ({
        customTaskId: task.id,
        userId,
      })),
    );
  }

  await db.insert(auditEvents).values({
    actorId: session.id,
    action: "custom_task.created",
    entity: "custom_task",
    entityId: String(task.id),
    meta: { name, area, assignedTo, priority },
  });

  return Response.json(
    {
      task: {
        id: task.id,
        name: task.name,
        area: task.area,
        instructions: task.instructions,
        dueDate: task.dueDate,
        priority: task.priority,
        status: task.status,
        requiresPhoto: task.requiresPhoto,
        createdAt: task.createdAt,
      },
    },
    { status: 201 },
  );
}

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === "janitor") return forbidden();

  const facilityId = session.facilityId;
  if (!facilityId) {
    return Response.json({ tasks: [] });
  }

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
    .leftJoin(users, eq(users.id, customTasks.createdById))
    .where(
      and(
        eq(customTasks.facilityId, facilityId),
        isNull(customTasks.deletedAt),
      ),
    )
    .orderBy(customTasks.createdAt);

  const taskIds = rows.map((r) => r.id);
  const assignments =
    taskIds.length > 0
      ? await db
          .select({
            customTaskId: taskAssignments.customTaskId,
            userId: taskAssignments.userId,
            userName: users.name,
          })
          .from(taskAssignments)
          .innerJoin(users, eq(users.id, taskAssignments.userId))
          .where(
            taskIds.length === 1
              ? eq(taskAssignments.customTaskId, taskIds[0])
              : undefined,
          )
      : [];

  const assignMap = new Map<number, { userId: number; userName: string }[]>();
  for (const a of assignments) {
    const list = assignMap.get(a.customTaskId) ?? [];
    list.push({ userId: a.userId, userName: a.userName });
    assignMap.set(a.customTaskId, list);
  }

  const tasks = rows.map((r) => ({
    ...r,
    assignedTo: assignMap.get(r.id) ?? [],
  }));

  return Response.json({ tasks });
}
