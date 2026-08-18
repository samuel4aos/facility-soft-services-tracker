import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditEvents,
  incidentPhotos,
  incidents,
  users,
} from "@/db/schema";
import { forbidden, getSession, unauthorized } from "@/lib/auth";
import { createNotification } from "@/lib/notify";
import { parseDataUrl, putObject } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  area?: string;
  description?: string;
  priority?: string;
  assignedToId?: number;
  photos?: string[];
};

const AREA_KEYWORDS: Record<string, string[]> = {
  restroom: ["restroom", "toilet", "bathroom", "lavatory", "washroom"],
  garden: ["garden", "lawn", "landscape", "outdoor", "hedge", "plant"],
  server: ["server", "it room", "data centre", "datacenter", "network"],
  kitchen: ["kitchen", "pantry", "cafeteria", "canteen", "food"],
  lobby: ["lobby", "reception", "front desk", "entrance", "foyer"],
  office: ["office", "workspace", "desk", "cubicle"],
};

const AREA_NAME_JANITOR: Record<string, string> = {
  "male restroom": "Nweke Ebuka",
  "female restroom": "Okon Paul",
  "server room": "Chigozie Precious",
  "kitchen/break room": "Andrew Suleiman",
  "kitchen": "Andrew Suleiman",
  "garden/grounds": "Omirin Sunday",
  "garden": "Omirin Sunday",
  "compound": "Omirin Sunday",
};

function matchAreaKeyword(area: string): string | null {
  const lower = area.toLowerCase();
  for (const [key, keywords] of Object.entries(AREA_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return key;
  }
  return null;
}

async function autoAssignJanitor(
  facilityId: number,
  area: string,
): Promise<number | null> {
  const janitors = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(
      and(
        eq(users.facilityId, facilityId),
        eq(users.role, "janitor"),
        eq(users.active, true),
      ),
    );

  if (janitors.length === 0) return null;

  const areaLower = area.toLowerCase().trim();
  const targetName = AREA_NAME_JANITOR[areaLower];
  if (targetName) {
    const match = janitors.find(
      (j) => j.name.toLowerCase() === targetName.toLowerCase(),
    );
    if (match) return match.id;
  }

  const areaKey = matchAreaKeyword(area);

  const openCounts = await db
    .select({
      userId: incidents.assignedToId,
      count: sql<number>`count(*)::int`,
    })
    .from(incidents)
    .where(
      and(
        eq(incidents.facilityId, facilityId),
        inArray(incidents.status, ["open", "assigned", "in_progress"]),
      ),
    )
    .groupBy(incidents.assignedToId);

  const countMap = new Map<number, number>();
  for (const row of openCounts) {
    if (row.userId != null) countMap.set(row.userId, row.count);
  }

  if (areaKey) {
    const matching = janitors.filter((j) => {
      const nameLower = j.name.toLowerCase();
      if (areaKey === "restroom") {
        return nameLower.includes("female") || nameLower.includes("male") || nameLower.includes("restroom");
      }
      if (areaKey === "garden") return nameLower.includes("garden");
      if (areaKey === "server") return nameLower.includes("it") || nameLower.includes("tech");
      return false;
    });
    if (matching.length > 0) {
      return matching.reduce((best, j) => {
        const bc = countMap.get(best.id) ?? 0;
        const jc = countMap.get(j.id) ?? 0;
        return jc < bc ? j : best;
      }, matching[0]).id;
    }
  }

  return janitors.reduce((best, j) => {
    const bc = countMap.get(best.id) ?? 0;
    const jc = countMap.get(j.id) ?? 0;
    return jc < bc ? j : best;
  }, janitors[0]).id;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === "janitor") return forbidden();

  const facilityId = session.facilityId;
  if (!facilityId) {
    return Response.json({ incidents: [] });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const assignedTo = url.searchParams.get("assigned_to");

  const conditions = [
    eq(incidents.facilityId, facilityId),
    isNull(incidents.deletedAt),
  ];
  if (status && ["open", "assigned", "in_progress", "resolved"].includes(status)) {
    conditions.push(eq(incidents.status, status as "open" | "assigned" | "in_progress" | "resolved"));
  }
  if (assignedTo) {
    conditions.push(eq(incidents.assignedToId, Number(assignedTo)));
  }

  const rows = await db
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
      assignedToName: sql<string | null>`assigned_user.name`,
    })
    .from(incidents)
    .leftJoin(users, eq(users.id, incidents.reportedById))
    .leftJoin(
      sql`${users} AS assigned_user`,
      sql`assigned_user.id = ${incidents.assignedToId}`,
    )
    .where(and(...conditions))
    .orderBy(asc(incidents.createdAt));

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
          .where(inArray(incidentPhotos.incidentId, incidentIds))
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

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === "janitor") return forbidden();

  const body = (await request.json().catch(() => ({}))) as Body;
  const area = String(body.area ?? "").trim();
  if (!area) {
    return Response.json({ error: "Area is required" }, { status: 400 });
  }

  const facilityId = session.facilityId;
  if (!facilityId) {
    return Response.json({ error: "No facility assigned" }, { status: 400 });
  }

  const description = String(body.description ?? "").trim() || null;
  const priority = ["standard", "critical"].includes(String(body.priority))
    ? String(body.priority)
    : "standard";
  const incomingPhotos = (body.photos ?? []).filter(Boolean).slice(0, 5);

  let assignedToId = body.assignedToId && body.assignedToId > 0 ? body.assignedToId : null;
  if (!assignedToId) {
    assignedToId = await autoAssignJanitor(facilityId, area);
  }

  const status = assignedToId ? "assigned" : "open";

  const [incident] = await db
    .insert(incidents)
    .values({
      facilityId,
      reportedById: session.id,
      assignedToId,
      area,
      description,
      priority,
      status: status as "open" | "assigned",
    })
    .returning();

  for (const dataUrl of incomingPhotos) {
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) continue;
    const stored = await putObject(parsed.buffer, parsed.mime, "incident-photos");
    await db.insert(incidentPhotos).values({
      incidentId: incident.id,
      uploadedBy: session.id,
      photoType: "before",
      url: stored.url,
      storageKey: stored.key,
    });
  }

  await db.insert(auditEvents).values({
    actorId: session.id,
    action: "incident.created",
    entity: "incident",
    entityId: String(incident.id),
    meta: { area, priority, assignedToId, photoCount: incomingPhotos.length },
  });

  if (assignedToId) {
    await createNotification(
      assignedToId,
      "incident_assigned",
      "Untidy area reported",
      `Photo reported in ${area}. Please clean and upload after photo.`,
      "incident",
      incident.id,
    ).catch(() => {});
  }

  return Response.json(
    {
      incident: {
        id: incident.id,
        area: incident.area,
        description: incident.description,
        status: incident.status,
        priority: incident.priority,
        assignedToId: incident.assignedToId,
        createdAt: incident.createdAt,
      },
    },
    { status: 201 },
  );
}
