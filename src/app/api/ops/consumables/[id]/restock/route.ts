import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditEvents,
  consumables,
  restockRequests,
  users,
} from "@/db/schema";
import { forbidden, getSession, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

type PostBody = {
  quantity?: number;
  supplier?: string;
  notes?: string;
};

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === "janitor") return forbidden();

  const { id } = await ctx.params;
  const consumableId = Number(id);
  if (!consumableId) {
    return Response.json({ error: "Invalid ID" }, { status: 400 });
  }

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
      requestedByName: users.name,
      approvedAt: restockRequests.approvedAt,
      orderedAt: restockRequests.orderedAt,
      receivedAt: restockRequests.receivedAt,
      createdAt: restockRequests.createdAt,
    })
    .from(restockRequests)
    .innerJoin(consumables, eq(consumables.id, restockRequests.consumableId))
    .leftJoin(users, eq(users.id, restockRequests.requestedById))
    .where(eq(restockRequests.consumableId, consumableId))
    .orderBy(sql`${restockRequests.createdAt} desc`);

  return Response.json({ requests: rows });
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === "janitor") return forbidden();

  const { id } = await ctx.params;
  const consumableId = Number(id);
  if (!consumableId) {
    return Response.json({ error: "Invalid ID" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(consumables)
    .where(eq(consumables.id, consumableId))
    .limit(1);
  if (!existing) {
    return Response.json({ error: "Consumable not found" }, { status: 404 });
  }

  if (
    session.role === "ops_admin" &&
    session.facilityId &&
    existing.facilityId !== session.facilityId
  ) {
    return forbidden();
  }

  const body = (await request.json().catch(() => ({}))) as PostBody;
  const quantity = Number(body.quantity);
  if (!quantity || quantity <= 0) {
    return Response.json(
      { error: "Quantity must be a positive number" },
      { status: 400 },
    );
  }

  const supplier = String(body.supplier ?? "").trim() || null;
  const notes = String(body.notes ?? "").trim() || null;

  const [created] = await db
    .insert(restockRequests)
    .values({
      facilityId: existing.facilityId,
      consumableId,
      requestedById: session.id,
      quantity,
      supplier,
      notes,
    })
    .returning();

  await db.insert(auditEvents).values({
    actorId: session.id,
    action: "restock_request.created",
    entity: "restock_request",
    entityId: String(created.id),
    meta: { consumableId, quantity, supplier },
  });

  return Response.json({ request: created }, { status: 201 });
}
