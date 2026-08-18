import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditEvents,
  consumableUsage,
  consumables,
  users,
} from "@/db/schema";
import { forbidden, getSession, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

type PostBody = {
  quantity?: number;
  usedById?: number;
  area?: string;
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
      id: consumableUsage.id,
      quantity: consumableUsage.quantity,
      area: consumableUsage.area,
      notes: consumableUsage.notes,
      usedAt: consumableUsage.usedAt,
      usedByName: users.name,
    })
    .from(consumableUsage)
    .leftJoin(users, eq(users.id, consumableUsage.usedById))
    .where(eq(consumableUsage.consumableId, consumableId))
    .orderBy(sql`${consumableUsage.usedAt} desc`);

  return Response.json({ usageRecords: rows });
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

  if (existing.currentStock < quantity) {
    return Response.json(
      { error: `Insufficient stock. Available: ${existing.currentStock}` },
      { status: 400 },
    );
  }

  const area = String(body.area ?? "").trim() || null;
  const notes = String(body.notes ?? "").trim() || null;

  const [usage] = await db
    .insert(consumableUsage)
    .values({
      consumableId,
      usedById: session.id,
      quantity,
      area,
      notes,
    })
    .returning();

  const newStock = existing.currentStock - quantity;
  await db
    .update(consumables)
    .set({ currentStock: newStock, updatedAt: new Date() })
    .where(eq(consumables.id, consumableId));

  await db.insert(auditEvents).values({
    actorId: session.id,
    action: "consumable.usage",
    entity: "consumable",
    entityId: String(consumableId),
    meta: { quantity, area, newStock },
  });

  return Response.json({ usage }, { status: 201 });
}
