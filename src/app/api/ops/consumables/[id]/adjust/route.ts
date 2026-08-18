import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  auditEvents,
  consumables,
  stockAdjustments,
} from "@/db/schema";
import { forbidden, getSession, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

type PostBody = {
  newStock?: number;
  reason?: string;
};

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
  const newStock = Number(body.newStock);
  if (newStock < 0 || !Number.isInteger(newStock)) {
    return Response.json(
      { error: "New stock must be a non-negative integer" },
      { status: 400 },
    );
  }

  const reason = String(body.reason ?? "").trim();
  if (!reason) {
    return Response.json(
      { error: "Reason is required for stock adjustments" },
      { status: 400 },
    );
  }

  const adjustment = newStock - existing.currentStock;

  const [record] = await db
    .insert(stockAdjustments)
    .values({
      facilityId: existing.facilityId,
      consumableId,
      adjustedById: session.id,
      previousStock: existing.currentStock,
      newStock,
      adjustment,
      reason,
    })
    .returning();

  await db
    .update(consumables)
    .set({ currentStock: newStock, updatedAt: new Date() })
    .where(eq(consumables.id, consumableId));

  await db.insert(auditEvents).values({
    actorId: session.id,
    action: "consumable.stock_adjusted",
    entity: "consumable",
    entityId: String(consumableId),
    meta: { previousStock: existing.currentStock, newStock, adjustment, reason },
  });

  return Response.json({ adjustment: record }, { status: 201 });
}
