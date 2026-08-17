import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, facilities } from "@/db/schema";
import { forbidden, getSession, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role !== "super_admin") return forbidden();

  const { id } = await ctx.params;
  const facilityId = Number(id);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const [existing] = await db
    .select()
    .from(facilities)
    .where(eq(facilities.id, facilityId))
    .limit(1);
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  const [updated] = await db
    .update(facilities)
    .set({
      name: body.name !== undefined ? String(body.name).trim() : existing.name,
      address: body.address !== undefined ? ((body.address as string) || null) : existing.address,
      timezone: body.timezone !== undefined ? String(body.timezone) : existing.timezone,
    })
    .where(eq(facilities.id, facilityId))
    .returning();

  await db.insert(auditEvents).values({
    actorId: session.id,
    action: "facility.updated",
    entity: "facility",
    entityId: String(facilityId),
    meta: body as Record<string, unknown>,
  });

  return Response.json({ facility: updated });
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role !== "super_admin") return forbidden();

  const { id } = await ctx.params;
  const facilityId = Number(id);

  await db.delete(facilities).where(eq(facilities.id, facilityId));

  await db.insert(auditEvents).values({
    actorId: session.id,
    action: "facility.deleted",
    entity: "facility",
    entityId: String(facilityId),
  });

  return Response.json({ ok: true });
}
