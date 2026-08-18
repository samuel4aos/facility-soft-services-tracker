import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications, users } from "@/db/schema";
import { getSession, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, session.id))
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  const [unread] = await db
    .select({ value: count() })
    .from(notifications)
    .where(
      and(eq(notifications.userId, session.id), eq(notifications.read, false)),
    );

  return Response.json({ notifications: rows, unreadCount: unread?.value ?? 0 });
}

type PostBody = {
  userId?: number;
  type?: string;
  title?: string;
  message?: string;
  entityType?: string;
  entityId?: number;
};

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === "janitor") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as PostBody;
  const userId = Number(body.userId);
  const type = String(body.type ?? "").trim();
  const title = String(body.title ?? "").trim();
  const message = String(body.message ?? "").trim();

  if (!userId || !type || !title || !message) {
    return Response.json(
      { error: "userId, type, title, and message are required" },
      { status: 400 },
    );
  }

  const [row] = await db
    .insert(notifications)
    .values({
      userId,
      type,
      title,
      message,
      entityType: body.entityType ?? null,
      entityId: body.entityId ?? null,
    })
    .returning();

  return Response.json({ notification: row }, { status: 201 });
}
