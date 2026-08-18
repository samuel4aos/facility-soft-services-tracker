import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, incidentPhotos, incidents, users } from "@/db/schema";
import { forbidden, getSession, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PatchBody = {
  status?: string;
  assignedToId?: number | null;
  resolutionNotes?: string;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id: idStr } = await params;
  const incidentId = Number(idStr);
  if (!incidentId) {
    return Response.json({ error: "Invalid ID" }, { status: 400 });
  }

  const [incident] = await db
    .select({
      id: incidents.id,
      facilityId: incidents.facilityId,
      reportedById: incidents.reportedById,
      assignedToId: incidents.assignedToId,
      area: incidents.area,
      description: incidents.description,
      status: incidents.status,
      priority: incidents.priority,
      resolvedAt: incidents.resolvedAt,
      resolutionNotes: incidents.resolutionNotes,
      createdAt: incidents.createdAt,
      updatedAt: incidents.updatedAt,
      reportedByName: users.name,
    })
    .from(incidents)
    .leftJoin(users, eq(users.id, incidents.reportedById))
    .where(eq(incidents.id, incidentId))
    .limit(1);

  if (!incident) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const [assignedUser] = incident.assignedToId
    ? await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(eq(users.id, incident.assignedToId))
        .limit(1)
    : [];

  const photos = await db
    .select()
    .from(incidentPhotos)
    .where(eq(incidentPhotos.incidentId, incidentId));

  return Response.json({
    incident: {
      ...incident,
      assignedToName: assignedUser?.name ?? null,
      photos,
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === "janitor") return forbidden();

  const { id: idStr } = await params;
  const incidentId = Number(idStr);
  if (!incidentId) {
    return Response.json({ error: "Invalid ID" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as PatchBody;

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (body.status && ["open", "assigned", "in_progress", "resolved"].includes(body.status)) {
    updates.status = body.status;
    if (body.status === "resolved") {
      updates.resolvedAt = new Date();
    }
  }

  if (body.assignedToId !== undefined) {
    updates.assignedToId = body.assignedToId;
    if (body.assignedToId && body.status === undefined) {
      const [current] = await db
        .select({ status: incidents.status })
        .from(incidents)
        .where(eq(incidents.id, incidentId))
        .limit(1);
      if (current && current.status === "open") {
        updates.status = "assigned";
      }
    }
  }

  if (body.resolutionNotes !== undefined) {
    updates.resolutionNotes = body.resolutionNotes;
  }

  await db.update(incidents).set(updates).where(eq(incidents.id, incidentId));

  await db.insert(auditEvents).values({
    actorId: session.id,
    action: "incident.updated",
    entity: "incident",
    entityId: String(incidentId),
    meta: body,
  });

  return Response.json({ ok: true });
}
