import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, consumables } from "@/db/schema";
import { forbidden, getSession, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PostBody = {
  name?: string;
  category?: string;
  unit?: string;
  currentStock?: number;
  minStock?: number;
  maxStock?: number;
  unitCost?: number | null;
  location?: string;
  facilityId?: number;
};

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
      unitCost: consumables.unitCost,
      location: consumables.location,
      active: consumables.active,
      createdAt: consumables.createdAt,
      updatedAt: consumables.updatedAt,
      lowStock: sql<boolean>`(${consumables.currentStock} <= ${consumables.minStock})`,
    })
    .from(consumables)
    .where(facilityCond)
    .orderBy(consumables.name);

  return Response.json({ consumables: rows });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === "janitor") return forbidden();

  const body = (await request.json().catch(() => ({}))) as PostBody;
  const name = String(body.name ?? "").trim();
  if (!name) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }

  const facilityId = body.facilityId ?? session.facilityId;
  if (!facilityId) {
    return Response.json({ error: "No facility assigned" }, { status: 400 });
  }

  const category = String(body.category ?? "general").trim();
  const unit = String(body.unit ?? "pcs").trim();
  const currentStock = Number(body.currentStock ?? 0);
  const minStock = Number(body.minStock ?? 10);
  const maxStock = Number(body.maxStock ?? 100);
  const unitCost = body.unitCost != null ? Number(body.unitCost) : null;
  const location = String(body.location ?? "").trim() || null;

  const [created] = await db
    .insert(consumables)
    .values({
      facilityId,
      name,
      category,
      unit,
      currentStock,
      minStock,
      maxStock,
      unitCost,
      location,
    })
    .returning();

  await db.insert(auditEvents).values({
    actorId: session.id,
    action: "consumable.created",
    entity: "consumable",
    entityId: String(created.id),
    meta: { name, category, currentStock },
  });

  return Response.json({ consumable: created }, { status: 201 });
}
