import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getSession, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getSession();
  if (!session) return unauthorized();

  await db
    .update(notifications)
    .set({ read: true })
    .where(
      and(eq(notifications.userId, session.id), eq(notifications.read, false)),
    );

  return Response.json({ ok: true });
}
