import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { getSession, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubBody = {
  endpoint?: string;
  p256dh?: string;
  auth?: string;
};

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = (await request.json().catch(() => ({}))) as SubBody;
  const endpoint = String(body.endpoint ?? "").trim();
  const p256dh = String(body.p256dh ?? "").trim();
  const auth = String(body.auth ?? "").trim();

  if (!endpoint || !p256dh || !auth) {
    return Response.json(
      { error: "endpoint, p256dh, and auth are required" },
      { status: 400 },
    );
  }

  const [existing] = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint))
    .limit(1);

  if (existing) {
    await db
      .update(pushSubscriptions)
      .set({ p256dh, auth, userId: session.id })
      .where(eq(pushSubscriptions.id, existing.id));
  } else {
    await db.insert(pushSubscriptions).values({
      userId: session.id,
      endpoint,
      p256dh,
      auth,
    });
  }

  return Response.json({ ok: true });
}

type DeleteBody = {
  endpoint?: string;
};

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = (await request.json().catch(() => ({}))) as DeleteBody;
  const endpoint = String(body.endpoint ?? "").trim();

  if (!endpoint) {
    return Response.json({ error: "endpoint is required" }, { status: 400 });
  }

  await db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint));

  return Response.json({ ok: true });
}
