import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, users } from "@/db/schema";
import { forbidden, getSession, hashSecret, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === "janitor") return forbidden();

  const { id } = await ctx.params;
  const userId = Number(id);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!existing) return Response.json({ error: "User not found" }, { status: 404 });

  if (session.role === "ops_admin" && existing.facilityId !== session.facilityId) {
    return forbidden();
  }

  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) updates.name = String(body.name).trim();
  if (body.phone !== undefined) updates.phone = String(body.phone).trim() || null;
  if (body.email !== undefined) updates.email = String(body.email).trim().toLowerCase() || null;
  if (body.active !== undefined) updates.active = Boolean(body.active);
  if (body.facilityId !== undefined) {
    if (session.role === "super_admin") {
      updates.facilityId = Number(body.facilityId) || null;
    }
  }
  if (body.role !== undefined) {
    if (session.role === "super_admin") {
      updates.role = body.role;
    }
  }

  if (body.pin !== undefined && String(body.pin).trim()) {
    updates.pinHash = hashSecret(String(body.pin).trim());
  }
  if (body.password !== undefined && String(body.password).trim()) {
    updates.passwordHash = hashSecret(String(body.password).trim());
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No fields to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, userId))
    .returning();

  await db.insert(auditEvents).values({
    actorId: session.id,
    action: "user.updated",
    entity: "user",
    entityId: String(userId),
    meta: { fields: Object.keys(updates).filter((k) => k !== "pinHash" && k !== "passwordHash") },
  });

  return Response.json({
    user: {
      id: updated.id,
      name: updated.name,
      role: updated.role,
      phone: updated.phone,
      email: updated.email,
      active: updated.active,
      facilityId: updated.facilityId,
    },
  });
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === "janitor") return forbidden();

  const { id } = await ctx.params;
  const userId = Number(id);

  if (userId === session.id) {
    return Response.json({ error: "Cannot deactivate yourself" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!existing) return Response.json({ error: "User not found" }, { status: 404 });

  if (session.role === "ops_admin" && existing.facilityId !== session.facilityId) {
    return forbidden();
  }

  await db.update(users).set({ active: false }).where(eq(users.id, userId));

  await db.insert(auditEvents).values({
    actorId: session.id,
    action: "user.deactivated",
    entity: "user",
    entityId: String(userId),
    meta: { name: existing.name },
  });

  return Response.json({ ok: true });
}
