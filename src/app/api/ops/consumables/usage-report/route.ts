import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { consumables, consumableUsage } from "@/db/schema";
import { forbidden, getSession, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === "janitor") return forbidden();

  const { searchParams } = new URL(request.url);
  const days = Number(searchParams.get("days")) || 7;

  const since = new Date();
  since.setDate(since.getDate() - days);

  const facilityCond =
    session.role === "super_admin" || !session.facilityId
      ? undefined
      : eq(consumables.facilityId, session.facilityId);

  const rows = await db
    .select({
      consumableId: consumableUsage.consumableId,
      name: consumables.name,
      unit: consumables.unit,
      unitCost: consumables.unitCost,
      totalUsed: sql<number>`sum(${consumableUsage.quantity})`,
    })
    .from(consumableUsage)
    .innerJoin(consumables, eq(consumables.id, consumableUsage.consumableId))
    .where(
      facilityCond
        ? and(facilityCond, sql`${consumableUsage.usedAt} >= ${since}`)
        : sql`${consumableUsage.usedAt} >= ${since}`,
    )
    .groupBy(consumableUsage.consumableId, consumables.name, consumables.unit, consumables.unitCost)
    .orderBy(sql`sum(${consumableUsage.quantity}) desc`);

  const report = rows.map((r) => ({
    consumableId: r.consumableId,
    name: r.name,
    unit: r.unit,
    totalUsed: Number(r.totalUsed),
    cost: r.unitCost != null ? Number(r.unitCost) * Number(r.totalUsed) : null,
  }));

  const totalUsed = report.reduce((s, r) => s + r.totalUsed, 0);
  const totalCost = report.reduce((s, r) => s + (r.cost ?? 0), 0);

  return Response.json({
    days,
    report,
    totals: { itemsUsed: totalUsed, cost: totalCost },
  });
}
