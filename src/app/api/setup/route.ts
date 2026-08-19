import { db } from "@/db";
import { facilities, users } from "@/db/schema";
import { facilityCount } from "@/lib/seed";
import { hashSecret, setSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_TEAM = [
  { name: "Osunkoya Modupe", role: "ops_admin" as const, phone: "08010000001" },
  { name: "Nweke Ebuka", role: "janitor" as const, phone: "08010000002" },
  { name: "Okon Paul", role: "janitor" as const, phone: "08010000003" },
  { name: "Andrew Suleiman", role: "janitor" as const, phone: "08010000004" },
  { name: "Chigozie Precious", role: "janitor" as const, phone: "08010000005" },
  { name: "Omirin Sunday", role: "gardener" as const, phone: "08010000006" },
];

export async function GET() {
  const count = await facilityCount();
  return Response.json({ needsSetup: count === 0 });
}

export async function POST(request: Request) {
  const count = await facilityCount();
  if (count > 0) {
    return Response.json({ error: "Setup already completed" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const facilityName = String(body.facilityName ?? "").trim();
  const facilityAddress = String(body.facilityAddress ?? "").trim();
  const adminName = String(body.adminName ?? "").trim();
  const adminEmail = String(body.adminEmail ?? "").trim().toLowerCase();
  const adminPassword = String(body.adminPassword ?? "").trim();

  if (!facilityName) return Response.json({ error: "Facility name is required" }, { status: 400 });
  if (!adminName) return Response.json({ error: "Admin name is required" }, { status: 400 });
  if (!adminEmail) return Response.json({ error: "Admin email is required" }, { status: 400 });
  if (!adminPassword || adminPassword.length < 6) {
    return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const [facility] = await db
    .insert(facilities)
    .values({
      name: facilityName,
      address: facilityAddress || null,
      timezone: "Africa/Lagos",
    })
    .returning();

  const [admin] = await db
    .insert(users)
    .values({
      facilityId: facility.id,
      name: adminName,
      role: "super_admin",
      email: adminEmail,
      passwordHash: hashSecret(adminPassword),
    })
    .returning();

  await db.insert(users).values(
    DEFAULT_TEAM.map((m) => ({
      facilityId: facility.id,
      name: m.name,
      role: m.role,
      phone: m.phone,
      pinHash: hashSecret("1234"),
    })),
  );

  await setSession({
    id: admin.id,
    name: admin.name,
    role: admin.role,
    facilityId: admin.facilityId,
  });

  return Response.json({
    ok: true,
    facility: { id: facility.id, name: facility.name },
    user: { id: admin.id, name: admin.name, role: admin.role },
    teamCreated: DEFAULT_TEAM.length,
  });
}
