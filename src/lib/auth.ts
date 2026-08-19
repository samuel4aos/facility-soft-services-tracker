import crypto from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

const SECRET =
  process.env.JWT_SECRET ?? "dev-secret-soft-services-tracker-change-me";
export const SESSION_COOKIE = "sst_session";

export type Role = "janitor" | "gardener" | "ops_admin" | "super_admin";

export type SessionUser = {
  id: number;
  name: string;
  role: Role;
  facilityId: number | null;
};

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function signToken(payload: Record<string, unknown>, ttlSeconds = 60 * 60 * 24 * 30) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(
    JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds }),
  );
  const sig = b64url(
    crypto.createHmac("sha256", SECRET).update(`${header}.${body}`).digest(),
  );
  return `${header}.${body}.${sig}`;
}

export function verifyToken(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(`${header}.${body}`)
    .digest();
  const given = fromB64url(sig);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return null;
  }
  try {
    const payload = JSON.parse(fromB64url(body).toString()) as Record<string, unknown>;
    if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function hashSecret(secret: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(secret, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifySecret(secret: string, stored: string | null): boolean {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const computed = crypto.scryptSync(secret, salt, 32).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(computed, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function setSession(user: SessionUser) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, signToken({ ...user }), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload || typeof payload.id !== "number") return null;
  return {
    id: payload.id as number,
    name: String(payload.name ?? ""),
    role: payload.role as Role,
    facilityId: (payload.facilityId as number | null) ?? null,
  };
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const [row] = await db.select().from(users).where(eq(users.id, session.id)).limit(1);
  if (!row || !row.active) return null;
  return row;
}

export function requireRole(session: SessionUser | null, roles: Role[]): session is SessionUser {
  return !!session && roles.includes(session.role);
}

export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbidden() {
  return Response.json({ error: "Forbidden" }, { status: 403 });
}
