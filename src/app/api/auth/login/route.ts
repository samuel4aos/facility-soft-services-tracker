import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { setSession, verifySecret, type Role } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const { allowed, retryAfterMs } = checkRateLimit(`login:${ip}`);
  if (!allowed) {
    return Response.json(
      { error: `Too many attempts. Try again in ${Math.ceil(retryAfterMs / 1000)} seconds.` },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    mode?: "pin" | "password";
    phone?: string;
    pin?: string;
    userId?: number;
    email?: string;
    password?: string;
  };

  if (body.mode === "pin") {
    const pin = (body.pin ?? "").trim();
    if (!pin) {
      return Response.json({ error: "PIN is required" }, { status: 400 });
    }

    // Find all active janitors/ops_admin with matching PIN
    const candidates = await db
      .select({ id: users.id, name: users.name, role: users.role, facilityId: users.facilityId })
      .from(users)
      .where(and(eq(users.active, true)))
      .orderBy(users.name);

    const matches = candidates.filter((u) => verifySecret(pin, null));
    // Actually verify PIN properly
    const allActive = await db
      .select()
      .from(users)
      .where(eq(users.active, true));
    const verified = allActive.filter((u) => verifySecret(pin, u.pinHash));

    // If a specific userId is provided (name picker step), log in directly
    if (body.userId) {
      const user = verified.find((u) => u.id === body.userId);
      if (!user) {
        return Response.json({ error: "Invalid selection" }, { status: 401 });
      }
      const session = {
        id: user.id,
        name: user.name,
        role: user.role as Role,
        facilityId: user.facilityId,
      };
      await setSession(session);
      return Response.json({ user: session });
    }

    // No matches
    if (verified.length === 0) {
      return Response.json({ error: "Wrong PIN" }, { status: 401 });
    }

    // Exactly one match — log in directly
    if (verified.length === 1) {
      const user = verified[0];
      const session = {
        id: user.id,
        name: user.name,
        role: user.role as Role,
        facilityId: user.facilityId,
      };
      await setSession(session);
      return Response.json({ user: session });
    }

    // Multiple matches — return candidates for name picker
    return Response.json({
      candidates: verified.map((u) => ({
        id: u.id,
        name: u.name,
        role: u.role,
      })),
    });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), eq(users.active, true)))
    .limit(1);
  if (!user || !verifySecret(body.password ?? "", user.passwordHash)) {
    return Response.json({ error: "Invalid email or password" }, { status: 401 });
  }
  const session = {
    id: user.id,
    name: user.name,
    role: user.role as Role,
    facilityId: user.facilityId,
  };
  await setSession(session);
  return Response.json({ user: session });
}
