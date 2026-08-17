import { forbidden, getSession, unauthorized } from "@/lib/auth";
import { queryOccurrences, toCsv } from "@/lib/opsQueries";
import { ensureFresh } from "@/lib/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === "janitor") return forbidden();
  await ensureFresh();

  const p = new URL(request.url).searchParams;
  const num = (k: string) => (p.get(k) ? Number(p.get(k)) : undefined);

  const rows = await queryOccurrences({
    facilityId: session.role === "super_admin" ? num("facilityId") ?? null : session.facilityId,
    from: p.get("from") ?? undefined,
    to: p.get("to") ?? undefined,
    templateId: num("templateId"),
    janitorId: num("janitorId"),
    status: p.get("status") ?? undefined,
    limit: num("limit") ?? 500,
    order: (p.get("order") as "asc" | "desc") ?? "desc",
  });

  if (p.get("format") === "csv") {
    return new Response(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="soft-services-logs-${p.get("from") ?? "all"}_${p.get("to") ?? "all"}.csv"`,
      },
    });
  }

  return Response.json({ rows });
}
