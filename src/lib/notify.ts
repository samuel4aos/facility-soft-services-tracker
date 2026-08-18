import { eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";

export async function createNotification(
  userId: number,
  type: string,
  title: string,
  message: string,
  entityType?: string,
  entityId?: number,
) {
  const [row] = await db
    .insert(notifications)
    .values({
      userId,
      type,
      title,
      message,
      entityType: entityType ?? null,
      entityId: entityId ?? null,
    })
    .returning();
  return row;
}

export async function createNotifications(
  userIds: number[],
  type: string,
  title: string,
  message: string,
  entityType?: string,
  entityId?: number,
) {
  if (userIds.length === 0) return [];
  return db
    .insert(notifications)
    .values(
      userIds.map((userId) => ({
        userId,
        type,
        title,
        message,
        entityType: entityType ?? null,
        entityId: entityId ?? null,
      })),
    )
    .returning();
}
