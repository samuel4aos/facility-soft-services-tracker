import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditEvents,
  consumableDeliveries,
  consumables,
  users,
} from "@/db/schema";
import { forbidden, getSession, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

type PostBody = {
  quantity?: number;
  supplier?: string;
  waybillNumber?: string;
  notes?: string;
  receivedById?: number;
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
      id: consumableDeliveries.id,
      quantity: consumableDeliveries.quantity,
      supplier: consumableDeliveries.supplier,
      waybillNumber: consumableDeliveries.waybillNumber,
      notes: consumableDeliveries.notes,
      receivedAt: consumableDeliveries.receivedAt,
      receivedByName: users.name,
    })
    .from(consumableDeliveries)
    .leftJoin(users, eq(users.id, consumableDeliveries.receivedById))
    .where(eq(consumableDeliveries.consumableId, consumableId))
    .orderBy(sql`${consumableDeliveries.receivedAt} desc`);

  return Response.json({ deliveries: rows });
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
  const waybillNumber = String(body.waybillNumber ?? "").trim() || null;
  const notes = String(body.notes ?? "").trim() || null;

  const [delivery] = await db
    .insert(consumableDeliveries)
    .values({
      consumableId,
      receivedById: session.id,
      quantity,
      supplier,
      waybillNumber,
      notes,
    })
    .returning();

  await db
    .update(consumables)
    .set({
      currentStock: existing.currentStock + quantity,
      updatedAt: new Date(),
    })
    .where(eq(consumables.id, consumableId));

  await db.insert(auditEvents).values({
    actorId: session.id,
    action: "consumable.delivery",
    entity: "consumable",
    entityId: String(consumableId),
    meta: { quantity, supplier, waybillNumber, newStock: existing.currentStock + quantity },
  });

  return Response.json({ delivery }, { status: 201 });
}
