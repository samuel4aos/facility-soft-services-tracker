import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  auditEvents,
  consumableDeliveries,
  consumableUsage,
  consumables,
  users,
} from "@/db/schema";
import { forbidden, getSession, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

type PatchBody = {
  name?: string;
  category?: string;
  unit?: string;
  currentStock?: number;
  minStock?: number;
  maxStock?: number;
  unitCost?: number | null;
  location?: string;
  active?: boolean;
};

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === "janitor") return forbidden();

  const { id } = await ctx.params;
  const itemId = Number(id);
  if (!itemId) {
    return Response.json({ error: "Invalid ID" }, { status: 400 });
  }

  const [item] = await db
    .select()
    .from(consumables)
    .where(eq(consumables.id, itemId))
    .limit(1);
  if (!item) {
    return Response.json({ error: "Consumable not found" }, { status: 404 });
  }

  if (
    session.role === "ops_admin" &&
    session.facilityId &&
    item.facilityId !== session.facilityId
  ) {
    return forbidden();
  }

  const deliveries = await db
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
    .where(eq(consumableDeliveries.consumableId, itemId))
    .orderBy(consumableDeliveries.receivedAt);

  const usageRecords = await db
    .select({
      id: consumableUsage.id,
      quantity: consumableUsage.quantity,
      area: consumableUsage.area,
      notes: consumableUsage.notes,
      usedAt: consumableUsage.usedAt,
      usedByName: users.name,
    })
    .from(consumableUsage)
    .leftJoin(users, eq(users.id, consumableUsage.usedById))
    .where(eq(consumableUsage.consumableId, itemId))
    .orderBy(consumableUsage.usedAt);

  return Response.json({ consumable: item, deliveries, usageRecords });
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === "janitor") return forbidden();

  const { id } = await ctx.params;
  const itemId = Number(id);
  if (!itemId) {
    return Response.json({ error: "Invalid ID" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(consumables)
    .where(eq(consumables.id, itemId))
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

  const body = (await request.json().catch(() => ({}))) as PatchBody;
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) updates.name = String(body.name).trim();
  if (body.category !== undefined)
    updates.category = String(body.category).trim() || "general";
  if (body.unit !== undefined) updates.unit = String(body.unit).trim() || "pcs";
  if (body.currentStock !== undefined)
    updates.currentStock = Number(body.currentStock);
  if (body.minStock !== undefined) updates.minStock = Number(body.minStock);
  if (body.maxStock !== undefined) updates.maxStock = Number(body.maxStock);
  if (body.unitCost !== undefined)
    updates.unitCost = body.unitCost != null ? Number(body.unitCost) : null;
  if (body.location !== undefined)
    updates.location = String(body.location).trim() || null;
  if (body.active !== undefined) updates.active = Boolean(body.active);

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No fields to update" }, { status: 400 });
  }

  updates.updatedAt = new Date();

  await db
    .update(consumables)
    .set(updates)
    .where(eq(consumables.id, itemId));

  await db.insert(auditEvents).values({
    actorId: session.id,
    action: "consumable.updated",
    entity: "consumable",
    entityId: String(itemId),
    meta: { fields: Object.keys(updates).filter((k) => k !== "updatedAt") },
  });

  return Response.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === "janitor") return forbidden();

  const { id } = await ctx.params;
  const itemId = Number(id);
  if (!itemId) {
    return Response.json({ error: "Invalid ID" }, { status: 400 });
  }

  await db
    .update(consumables)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(consumables.id, itemId));

  await db.insert(auditEvents).values({
    actorId: session.id,
    action: "consumable.deactivated",
    entity: "consumable",
    entityId: String(itemId),
    meta: {},
  });

  return Response.json({ ok: true });
}
