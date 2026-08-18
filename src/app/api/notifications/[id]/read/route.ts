import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getSession, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id: idStr } = await params;
  const notifId = Number(idStr);
  if (!notifId) {
    return Response.json({ error: "Invalid notification ID" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.id, notifId),
        eq(notifications.userId, session.id),
      ),
    )
    .limit(1);

  if (!existing) {
    return Response.json({ error: "Notification not found" }, { status: 404 });
  }

  await db
    .update(notifications)
    .set({ read: true })
    .where(eq(notifications.id, notifId));

  return Response.json({ ok: true });
}
