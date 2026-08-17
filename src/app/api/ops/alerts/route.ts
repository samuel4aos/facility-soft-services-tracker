import { eq } from "drizzle-orm";
import { db } from "@/db";
import { alerts } from "@/db/schema";
import { forbidden, getSession, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === "janitor") return forbidden();
  const body = (await request.json().catch(() => ({}))) as { id?: number };
  if (!body.id) return Response.json({ error: "id required" }, { status: 400 });
  await db
    .update(alerts)
    .set({ acknowledgedAt: new Date() })
    .where(eq(alerts.id, Number(body.id)));
  return Response.json({ ok: true });
}
