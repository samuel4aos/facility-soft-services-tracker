import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, users } from "@/db/schema";
import { forbidden, getSession, unauthorized } from "@/lib/auth";
import { addDays, todayISO } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === "janitor") return forbidden();

  const p = new URL(request.url).searchParams;
  const action = p.get("action") || undefined;
  const days = Number(p.get("days") ?? 30);
  const since = addDays(todayISO(), -Math.min(365, Math.max(1, days)));

  const conds = [
    gte(auditEvents.createdAt, sql`${since}::date`),
    action ? eq(auditEvents.action, action) : undefined,
  ];

  const rows = await db
    .select({
      id: auditEvents.id,
      actorId: auditEvents.actorId,
      actorName: users.name,
      action: auditEvents.action,
      entity: auditEvents.entity,
      entityId: auditEvents.entityId,
      meta: auditEvents.meta,
      createdAt: auditEvents.createdAt,
    })
    .from(auditEvents)
    .leftJoin(users, eq(users.id, auditEvents.actorId))
    .where(and(...conds.filter(Boolean)))
    .orderBy(desc(auditEvents.createdAt))
    .limit(500);

  return Response.json({ rows });
}
