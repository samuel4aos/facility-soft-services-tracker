import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  facilities,
  taskLogs,
  taskOccurrences,
  taskTemplates,
  users,
} from "@/db/schema";
import { hashSecret } from "./auth";
import { addDays, todayISO } from "./dates";
import { materializeOccurrences, refreshStatuses, raiseMissedAlerts } from "./scheduler";
import type { RecurrenceConfig, RecurrenceType } from "./recurrence";

type SeedTemplate = {
  name: string;
  location: string;
  recurrenceType: RecurrenceType;
  recurrenceConfig: RecurrenceConfig;
  criticality?: "standard" | "critical";
  requiresPhoto?: boolean;
  instructions?: string;
};

const SEED_TEMPLATES: SeedTemplate[] = [
  {
    name: "MU1 Cleaning",
    location: "Make-Up Unit 1",
    recurrenceType: "weekly",
    recurrenceConfig: { weekday: 1 },
    instructions: "Sweep and mop floor, wipe down panels, clear filters area, check for leaks.",
  },
  {
    name: "MU2 Cleaning",
    location: "Make-Up Unit 2",
    recurrenceType: "biweekly",
    recurrenceConfig: { weekday: 5, intervalWeeks: 2, anchorDate: "2026-01-02" },
    instructions: "Full clean of MU2 room, remove debris, wipe equipment housings.",
  },
  {
    name: "Internal Staircase Cleaning",
    location: "Internal staircases (all floors)",
    recurrenceType: "biweekly",
    recurrenceConfig: { weekday: 3, intervalWeeks: 2, anchorDate: "2026-01-07" },
    instructions: "Sweep, mop, wipe handrails and landings.",
  },
  {
    name: "External Staircase Cleaning",
    location: "External staircases",
    recurrenceType: "biweekly",
    recurrenceConfig: { weekday: 4, intervalWeeks: 2, anchorDate: "2026-01-01" },
    instructions: "Sweep, wash down treads, clear drainage points.",
  },
  {
    name: "Oil Pump Room Cleaning",
    location: "Oil pump room",
    recurrenceType: "daily",
    recurrenceConfig: {},
    criticality: "critical",
    instructions: "Mop oil spills, check bund is dry, report leaks immediately.",
  },
  {
    name: "Water Treatment Room Cleaning",
    location: "Water treatment plant room",
    recurrenceType: "daily",
    recurrenceConfig: {},
    criticality: "critical",
    instructions: "Clean floor, wipe dosing units, confirm no chemical spillage.",
  },
  {
    name: "Fire Hydrant Room Cleaning",
    location: "Fire hydrant pump room",
    recurrenceType: "daily",
    recurrenceConfig: {},
    criticality: "critical",
    instructions: "Clear access routes, dust valves and gauges, report obstructions.",
  },
  {
    name: "Compound Cleaning",
    location: "Facility compound",
    recurrenceType: "daily",
    recurrenceConfig: {},
    instructions: "Sweep compound, empty bins, clear drains and walkways.",
  },
  {
    name: "Gardening / Grounds Maintenance",
    location: "Grounds & landscaping",
    recurrenceType: "weekly_multi",
    recurrenceConfig: { weekdays: [2, 5], graceDays: 0 },
    instructions: "Mow, trim hedges, water plants, clear cuttings.",
  },
  {
    name: "Fumigation",
    location: "Whole facility",
    recurrenceType: "quarterly",
    recurrenceConfig: { monthOfQuarter: 0, dayOfMonth: 15 },
    instructions: "Vendor-supervised fumigation. Attach certificate photo.",
  },
  {
    name: "Carpet Cleaning / Deep Cleaning",
    location: "Offices & control room",
    recurrenceType: "biannual",
    recurrenceConfig: { targetMonths: [3, 9], dayOfMonth: null },
    instructions: "Deep clean carpets, upholstery and blinds.",
  },
  {
    name: "Delivery of Consumables",
    location: "Store room",
    recurrenceType: "monthly",
    recurrenceConfig: { dayOfMonth: 1 },
    instructions: "Confirm delivery against checklist, photograph waybill.",
  },
  {
    name: "LAWMA Waste Evacuation",
    location: "Waste bay",
    recurrenceType: "monthly",
    recurrenceConfig: { dayOfMonth: null },
    instructions: "Ensure LAWMA truck evacuates all waste. Photograph empty bay.",
  },
];

export async function seedIfEmpty(): Promise<{ seeded: boolean }> {
  const [existing] = await db.select({ id: facilities.id }).from(facilities).limit(1);
  if (existing) {
    await materializeOccurrences();
    await refreshStatuses();
    await raiseMissedAlerts();
    return { seeded: false };
  }

  const [facility] = await db
    .insert(facilities)
    .values({
      name: "Lagos Data Centre — Ikeja Campus",
      address: "12 Kudirat Abiola Way, Ikeja, Lagos",
      timezone: "Africa/Lagos",
    })
    .returning();

  const [supervisor, ...janitors] = await db
    .insert(users)
    .values([
      {
        facilityId: facility.id,
        name: "Osunkoya Modupe",
        role: "ops_admin",
        phone: "08010000001",
        pinHash: hashSecret("1234"),
      },
      {
        facilityId: facility.id,
        name: "Nweke Ebuka",
        role: "janitor",
        phone: "08010000002",
        pinHash: hashSecret("1234"),
      },
      {
        facilityId: facility.id,
        name: "Okon Paul",
        role: "janitor",
        phone: "08010000003",
        pinHash: hashSecret("1234"),
      },
      {
        facilityId: facility.id,
        name: "Andrew Suleiman",
        role: "janitor",
        phone: "08010000004",
        pinHash: hashSecret("1234"),
      },
      {
        facilityId: facility.id,
        name: "Chigozie Precious",
        role: "janitor",
        phone: "08010000005",
        pinHash: hashSecret("1234"),
      },
    ])
    .returning();

  await db.insert(taskTemplates).values(
    SEED_TEMPLATES.map((t, idx) => ({
      facilityId: facility.id,
      name: t.name,
      location: t.location,
      recurrenceType: t.recurrenceType,
      recurrenceConfig: t.recurrenceConfig,
      requiresPhoto: t.requiresPhoto ?? true,
      instructions: t.instructions ?? null,
      criticality: t.criticality ?? "standard",
      assignedUserId: janitors[idx % janitors.length]?.id ?? janitors[0]?.id ?? supervisor.id,
    })),
  );

  await materializeOccurrences();

  const today = todayISO();
  const past = await db
    .select({
      id: taskOccurrences.id,
      dueDate: taskOccurrences.dueDate,
      windowEnd: taskOccurrences.windowEnd,
    })
    .from(taskOccurrences)
    .where(
      and(
        gte(taskOccurrences.dueDate, addDays(today, -28)),
        lte(taskOccurrences.dueDate, addDays(today, -1)),
      ),
    );

  const allJanitorIds = [supervisor.id, ...janitors.map((j) => j.id)];
  const logs = past
    .filter((_, idx) => idx % 7 !== 3)
    .map((o, idx) => ({
      taskOccurrenceId: o.id,
      janitorId: allJanitorIds[idx % allJanitorIds.length],
      completedAt: sql`(${o.dueDate}::date + time '09:30')`,
      notes: null,
      statusAtLogTime: "completed" as const,
      clientLogId: `seed-${o.id}`,
    }));

  for (let i = 0; i < logs.length; i += 200) {
    await db
      .insert(taskLogs)
      .values(logs.slice(i, i + 200))
      .onConflictDoNothing();
  }

  await refreshStatuses();
  await raiseMissedAlerts();
  return { seeded: true };
}

export async function resetDemoData() {
  await db.execute(sql`TRUNCATE alerts, photos, task_logs, task_occurrences, task_templates, users, facilities RESTART IDENTITY CASCADE`);
  return seedIfEmpty();
}

export const DEMO_TEMPLATE_COUNT = SEED_TEMPLATES.length;

export async function facilityCount() {
  const [row] = await db.select({ c: sql<number>`count(*)::int` }).from(facilities);
  return row?.c ?? 0;
}

export async function findFacility(id: number) {
  const [row] = await db.select().from(facilities).where(eq(facilities.id, id)).limit(1);
  return row ?? null;
}
