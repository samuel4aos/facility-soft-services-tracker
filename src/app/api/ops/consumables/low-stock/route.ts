import { and, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import { consumables } from "@/db/schema";
import { forbidden, getSession, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === "janitor") return forbidden();

  const facilityCond =
    session.role === "super_admin" || !session.facilityId
      ? undefined
      : eq(consumables.facilityId, session.facilityId);

  const rows = await db
    .select({
      id: consumables.id,
      facilityId: consumables.facilityId,
      name: consumables.name,
      category: consumables.category,
      unit: consumables.unit,
      currentStock: consumables.currentStock,
      minStock: consumables.minStock,
      maxStock: consumables.maxStock,
      location: consumables.location,
    })
    .from(consumables)
    .where(
      and(
        eq(consumables.active, true),
        lte(consumables.currentStock, consumables.minStock),
        facilityCond,
      ),
    )
    .orderBy(consumables.currentStock);

  return Response.json({ lowStock: rows, count: rows.length });
}
