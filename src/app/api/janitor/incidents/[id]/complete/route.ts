import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, incidentPhotos, incidents } from "@/db/schema";
import { getSession, unauthorized } from "@/lib/auth";
import { parseDataUrl, putObject } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  notes?: string;
  afterPhoto?: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id: idStr } = await params;
  const incidentId = Number(idStr);
  if (!incidentId) {
    return Response.json({ error: "Invalid incident ID" }, { status: 400 });
  }

  const [incident] = await db
    .select()
    .from(incidents)
    .where(eq(incidents.id, incidentId))
    .limit(1);

  if (!incident) {
    return Response.json({ error: "Incident not found" }, { status: 404 });
  }

  if (incident.assignedToId !== session.id) {
    return Response.json({ error: "Not assigned to you" }, { status: 403 });
  }

  if (!["assigned", "in_progress"].includes(incident.status)) {
    return Response.json(
      { error: "Incident is not in a completable state" },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const notes = String(body.notes ?? "").trim() || null;

  await db
    .update(incidents)
    .set({
      status: "in_progress",
      updatedAt: new Date(),
    })
    .where(eq(incidents.id, incidentId));

  if (body.afterPhoto) {
    const parsed = parseDataUrl(body.afterPhoto);
    if (parsed) {
      const stored = await putObject(parsed.buffer, parsed.mime, "incident-photos");
      await db.insert(incidentPhotos).values({
        incidentId,
        uploadedBy: session.id,
        photoType: "after",
        url: stored.url,
        storageKey: stored.key,
      });
    }
  }

  await db
    .update(incidents)
    .set({
      status: "resolved",
      resolvedAt: new Date(),
      resolutionNotes: notes,
      updatedAt: new Date(),
    })
    .where(eq(incidents.id, incidentId));

  await db.insert(auditEvents).values({
    actorId: session.id,
    action: "incident.resolved",
    entity: "incident",
    entityId: String(incidentId),
    meta: { notes, hasAfterPhoto: !!body.afterPhoto },
  });

  return Response.json({ ok: true });
}
