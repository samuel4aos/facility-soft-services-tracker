import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, users } from "@/db/schema";
import { getSession, hashSecret, unauthorized, verifySecret } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      phone: users.phone,
      email: users.email,
      facilityId: users.facilityId,
    })
    .from(users)
    .where(eq(users.id, session.id))
    .limit(1);

  return Response.json({ user });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) updates.name = String(body.name).trim();
  if (body.phone !== undefined) updates.phone = String(body.phone).trim() || null;
  if (body.email !== undefined) updates.email = String(body.email).trim().toLowerCase() || null;

  if (body.newPin !== undefined) {
    const currentPin = String(body.currentPin ?? "").trim();
    const [user] = await db
      .select({ pinHash: users.pinHash })
      .from(users)
      .where(eq(users.id, session.id))
      .limit(1);

    if (user?.pinHash && !verifySecret(currentPin, user.pinHash)) {
      return Response.json({ error: "Current PIN is incorrect" }, { status: 400 });
    }
    updates.pinHash = hashSecret(String(body.newPin).trim());
  }

  if (body.newPassword !== undefined) {
    const currentPassword = String(body.currentPassword ?? "").trim();
    const [user] = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, session.id))
      .limit(1);

    if (user?.passwordHash && !verifySecret(currentPassword, user.passwordHash)) {
      return Response.json({ error: "Current password is incorrect" }, { status: 400 });
    }
    const newPwd = String(body.newPassword).trim();
    if (newPwd.length < 6) {
      return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }
    updates.passwordHash = hashSecret(newPwd);
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No fields to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, session.id))
    .returning();

  await db.insert(auditEvents).values({
    actorId: session.id,
    action: "profile.updated",
    entity: "user",
    entityId: String(session.id),
    meta: { fields: Object.keys(updates).filter((k) => k !== "pinHash" && k !== "passwordHash") },
  });

  return Response.json({
    user: {
      id: updated.id,
      name: updated.name,
      role: updated.role,
      phone: updated.phone,
      email: updated.email,
    },
  });
}
