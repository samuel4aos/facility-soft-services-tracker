import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditEvents,
  consumables,
  restockRequests,
  users,
} from "@/db/schema";
import { forbidden, getSession, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PatchBody = {
  id?: number;
  status?: string;
};

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ["approved", "cancelled"],
  approved: ["ordered", "cancelled"],
  ordered: ["received", "cancelled"],
};

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === "janitor") return forbidden();

  const facilityCond =
    session.role === "super_admin" || !session.facilityId
      ? undefined
      : eq(restockRequests.facilityId, session.facilityId);

  const rows = await db
    .select({
      id: restockRequests.id,
      facilityId: restockRequests.facilityId,
      consumableId: restockRequests.consumableId,
      consumableName: consumables.name,
      consumableUnit: consumables.unit,
      quantity: restockRequests.quantity,
      supplier: restockRequests.supplier,
      notes: restockRequests.notes,
      status: restockRequests.status,
      requestedById: restockRequests.requestedById,
      requestedByName: users.name,
      approvedAt: restockRequests.approvedAt,
      orderedAt: restockRequests.orderedAt,
      receivedAt: restockRequests.receivedAt,
      createdAt: restockRequests.createdAt,
    })
    .from(restockRequests)
    .innerJoin(consumables, eq(consumables.id, restockRequests.consumableId))
    .leftJoin(users, eq(users.id, restockRequests.requestedById))
    .where(
      facilityCond
        ? and(facilityCond, eq(restockRequests.status, "pending"))
        : eq(restockRequests.status, "pending"),
    )
    .orderBy(sql`${restockRequests.createdAt} desc`);

  return Response.json({ requests: rows });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === "janitor") return forbidden();

  const body = (await request.json().catch(() => ({}))) as PatchBody;
  const requestId = Number(body.id);
  if (!requestId) {
    return Response.json({ error: "Request ID required" }, { status: 400 });
  }

  const newStatus = String(body.status ?? "").trim();
  if (!newStatus) {
    return Response.json({ error: "Status required" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(restockRequests)
    .where(eq(restockRequests.id, requestId))
    .limit(1);
  if (!existing) {
    return Response.json({ error: "Request not found" }, { status: 404 });
  }

  if (
    session.role === "ops_admin" &&
    session.facilityId &&
    existing.facilityId !== session.facilityId
  ) {
    return forbidden();
  }

  const allowed = VALID_TRANSITIONS[existing.status];
  if (!allowed || !allowed.includes(newStatus)) {
    return Response.json(
      { error: `Cannot transition from "${existing.status}" to "${newStatus}"` },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = {
    status: newStatus,
    updatedAt: new Date(),
  };

  if (newStatus === "approved") {
    updates.approvedById = session.id;
    updates.approvedAt = new Date();
  } else if (newStatus === "ordered") {
    updates.orderedAt = new Date();
  } else if (newStatus === "received") {
    updates.receivedAt = new Date();

    const [current] = await db
      .select({ currentStock: consumables.currentStock })
      .from(consumables)
      .where(eq(consumables.id, existing.consumableId))
      .limit(1);

    await db
      .update(consumables)
      .set({
        currentStock: (current?.currentStock ?? 0) + existing.quantity,
        updatedAt: new Date(),
      })
      .where(eq(consumables.id, existing.consumableId));
  }

  await db
    .update(restockRequests)
    .set(updates)
    .where(eq(restockRequests.id, requestId));

  await db.insert(auditEvents).values({
    actorId: session.id,
    action: `restock_request.${newStatus}`,
    entity: "restock_request",
    entityId: String(requestId),
    meta: { from: existing.status, to: newStatus, consumableId: existing.consumableId, quantity: existing.quantity },
  });

  return Response.json({ ok: true });
}
