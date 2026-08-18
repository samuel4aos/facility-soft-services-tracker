import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  auditEvents,
  photos,
  taskLogs,
  taskOccurrences,
  taskTemplates,
} from "@/db/schema";
import { getSession, unauthorized } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { deriveStatus } from "@/lib/recurrence";
import { parseDataUrl, putObject } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  occurrenceId?: number;
  notes?: string;
  gpsLat?: number | null;
  gpsLng?: number | null;
  clientLogId?: string;
  photos?: string[];
  completedAt?: string;
  completionMetadata?: {
    areas?: string[];
    workDone?: string[];
    timeSpent?: number;
  } | null;
};

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = (await request.json().catch(() => ({}))) as Body;
  const occurrenceId = Number(body.occurrenceId);
  if (!occurrenceId) {
    return Response.json({ error: "occurrenceId is required" }, { status: 400 });
  }

  // Offline queue replays may retry — dedupe on the client-generated id.
  if (body.clientLogId) {
    const [dupe] = await db
      .select({ id: taskLogs.id })
      .from(taskLogs)
      .where(eq(taskLogs.clientLogId, body.clientLogId))
      .limit(1);
    if (dupe) return Response.json({ ok: true, logId: dupe.id, deduped: true });
  }

  const [occurrence] = await db
    .select({
      id: taskOccurrences.id,
      dueDate: taskOccurrences.dueDate,
      windowEnd: taskOccurrences.windowEnd,
      facilityId: taskOccurrences.facilityId,
      requiresPhoto: taskTemplates.requiresPhoto,
      assignedUserId: taskTemplates.assignedUserId,
      name: taskTemplates.name,
    })
    .from(taskOccurrences)
    .innerJoin(taskTemplates, eq(taskTemplates.id, taskOccurrences.taskTemplateId))
    .where(eq(taskOccurrences.id, occurrenceId))
    .limit(1);

  if (!occurrence) return Response.json({ error: "Task not found" }, { status: 404 });

  if (
    session.role === "janitor" &&
    (occurrence.facilityId !== session.facilityId ||
      (occurrence.assignedUserId !== null && occurrence.assignedUserId !== session.id))
  ) {
    return Response.json({ error: "Not your task" }, { status: 403 });
  }

  const [existing] = await db
    .select({ id: taskLogs.id })
    .from(taskLogs)
    .where(and(eq(taskLogs.taskOccurrenceId, occurrenceId), isNull(taskLogs.deletedAt)))
    .limit(1);
  if (existing) {
    return Response.json({ ok: true, logId: existing.id, alreadyLogged: true });
  }

  const incomingPhotos = (body.photos ?? []).filter(Boolean).slice(0, 5);
  if (occurrence.requiresPhoto && incomingPhotos.length === 0) {
    return Response.json({ error: "A photo is required for this task" }, { status: 400 });
  }

  const today = todayISO();
  const statusAtLogTime = deriveStatus(occurrence, today, false);

  const [log] = await db
    .insert(taskLogs)
    .values({
      taskOccurrenceId: occurrenceId,
      janitorId: session.id,
      notes: body.notes?.trim() || null,
      gpsLat: body.gpsLat ?? null,
      gpsLng: body.gpsLng ?? null,
      statusAtLogTime,
      completionMetadata: body.completionMetadata ?? null,
      clientLogId: body.clientLogId ?? null,
      syncedOffline: !!body.completedAt,
      completedAt: body.completedAt ? new Date(body.completedAt) : new Date(),
    })
    .returning();

  for (const dataUrl of incomingPhotos) {
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) continue;
    const stored = await putObject(parsed.buffer, parsed.mime);
    await db.insert(photos).values({
      taskLogId: log.id,
      url: stored.url,
      storageKey: stored.key,
    });
  }

  await db
    .update(taskOccurrences)
    .set({ status: "completed", updatedAt: new Date() })
    .where(eq(taskOccurrences.id, occurrenceId));

  await db.insert(auditEvents).values({
    actorId: session.id,
    action: "task.completed",
    entity: "task_log",
    entityId: String(log.id),
    meta: { occurrenceId, task: occurrence.name, statusAtLogTime },
  });

  return Response.json({ ok: true, logId: log.id });
}
