import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, facilities, users } from "@/db/schema";
import { forbidden, getSession, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === "janitor") return forbidden();

  const rows = await db
    .select({
      id: facilities.id,
      name: facilities.name,
      address: facilities.address,
      timezone: facilities.timezone,
      createdAt: facilities.createdAt,
    })
    .from(facilities)
    .orderBy(facilities.name);

  const facilityIds = rows.map((r) => r.id);
  const userCounts = facilityIds.length
    ? await db
        .select({
          facilityId: users.facilityId,
          count: db.$count(users, eq(users.active, true)),
        })
        .from(users)
        .where(eq(users.active, true))
        .groupBy(users.facilityId)
    : [];

  const countMap = new Map(userCounts.map((uc) => [uc.facilityId, uc.count]));

  return Response.json({
    facilities: rows.map((r) => ({
      ...r,
      userCount: countMap.get(r.id) ?? 0,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role !== "super_admin") return forbidden();

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  if (!name) return Response.json({ error: "Name is required" }, { status: 400 });

  const [created] = await db
    .insert(facilities)
    .values({
      name,
      address: (body.address as string) || null,
      timezone: (body.timezone as string) || "Africa/Lagos",
    })
    .returning();

  await db.insert(auditEvents).values({
    actorId: session.id,
    action: "facility.created",
    entity: "facility",
    entityId: String(created.id),
    meta: { name },
  });

  return Response.json({ facility: created }, { status: 201 });
}
