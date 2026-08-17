import { getSession } from "@/lib/auth";
import { runScheduler } from "@/lib/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Scheduler entrypoint. Called by the in-process hourly cron
 * (see src/instrumentation.ts) or by an external scheduler with
 * `Authorization: Bearer $CRON_SECRET`.
 */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const session = await getSession();
  const allowed =
    (secret && auth === `Bearer ${secret}`) ||
    (session && session.role !== "janitor") ||
    !secret;
  if (!allowed) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const result = await runScheduler(true);
  return Response.json(result);
}

export const GET = handle;
export const POST = handle;
