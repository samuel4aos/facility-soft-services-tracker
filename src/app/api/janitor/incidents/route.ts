import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { incidentPhotos, incidents, users } from "@/db/schema";
import { getSession, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const rows = await db
    .select({
      id: incidents.id,
      area: incidents.area,
      description: incidents.description,
      status: incidents.status,
      priority: incidents.priority,
      createdAt: incidents.createdAt,
      updatedAt: incidents.updatedAt,
      reportedByName: users.name,
    })
    .from(incidents)
    .leftJoin(users, eq(users.id, incidents.reportedById))
    .where(
      and(
        eq(incidents.assignedToId, session.id),
        inArray(incidents.status, ["assigned", "in_progress"]),
      ),
    )
    .orderBy(incidents.createdAt);

  const incidentIds = rows.map((r) => r.id);
  const photos =
    incidentIds.length > 0
      ? await db
          .select({
            incidentId: incidentPhotos.incidentId,
            id: incidentPhotos.id,
            url: incidentPhotos.url,
            photoType: incidentPhotos.photoType,
          })
          .from(incidentPhotos)
          .where(
            and(
              inArray(incidentPhotos.incidentId, incidentIds),
              eq(incidentPhotos.photoType, "before"),
            ),
          )
      : [];

  const photoMap = new Map<number, { id: number; url: string; photoType: string }[]>();
  for (const p of photos) {
    const list = photoMap.get(p.incidentId) ?? [];
    list.push({ id: p.id, url: p.url, photoType: p.photoType });
    photoMap.set(p.incidentId, list);
  }

  const result = rows.map((r) => ({
    ...r,
    photos: photoMap.get(r.id) ?? [],
  }));

  return Response.json({ incidents: result });
}
