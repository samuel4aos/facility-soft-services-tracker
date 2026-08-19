import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, users } from "@/db/schema";
import { forbidden, getSession, hashSecret, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === "janitor") return forbidden();

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      phone: users.phone,
      email: users.email,
      active: users.active,
      facilityId: users.facilityId,
    })
    .from(users)
    .where(
      session.role === "super_admin" || !session.facilityId
        ? undefined
        : and(eq(users.facilityId, session.facilityId)),
    )
    .orderBy(users.name);

  return Response.json({ users: rows });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === "janitor") return forbidden();

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  const role = String(body.role ?? "janitor");

  if (!name) return Response.json({ error: "Name is required" }, { status: 400 });
  if (!["janitor", "gardener", "ops_admin", "super_admin"].includes(role)) {
    return Response.json({ error: "Invalid role" }, { status: 400 });
  }

  if (["super_admin"].includes(role) && session.role !== "super_admin") {
    return forbidden();
  }

  const facilityId = body.facilityId ? Number(body.facilityId) : session.facilityId;

  const phone = String(body.phone ?? "").trim() || null;
  const email = String(body.email ?? "").trim().toLowerCase() || null;
  const pin = String(body.pin ?? "").trim();
  const password = String(body.password ?? "").trim();

  if (["janitor", "gardener"].includes(role) && !pin) {
    return Response.json({ error: "PIN is required for janitors and gardeners" }, { status: 400 });
  }
  if (["ops_admin", "super_admin"].includes(role) && !password) {
    return Response.json({ error: "Password is required for ops/super admins" }, { status: 400 });
  }

  const [created] = await db
    .insert(users)
    .values({
      facilityId,
      name,
      role: role as "janitor" | "gardener" | "ops_admin" | "super_admin",
      phone,
      email,
      pinHash: pin ? hashSecret(pin) : null,
      passwordHash: password ? hashSecret(password) : null,
    })
    .returning();

  await db.insert(auditEvents).values({
    actorId: session.id,
    action: "user.created",
    entity: "user",
    entityId: String(created.id),
    meta: { name, role },
  });

  return Response.json({
    user: {
      id: created.id,
      name: created.name,
      role: created.role,
      phone: created.phone,
      email: created.email,
      active: created.active,
      facilityId: created.facilityId,
    },
  }, { status: 201 });
}
