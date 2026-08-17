import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { facilityCount } from "@/lib/seed";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  if (session) redirect(session.role === "janitor" ? "/app" : "/dashboard");

  const count = await facilityCount();
  if (count === 0) redirect("/setup");

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
          Facility operations
        </p>
        <h1 className="mt-2 text-4xl font-bold text-slate-900">
          Soft Services Daily Tracker
        </h1>
        <p className="mt-3 text-slate-600">
          Recurrence-driven cleaning &amp; maintenance compliance for data centre
          facilities. Janitors log proof from their phone; ops sees compliance in
          real time.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/login?mode=pin"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-sky-400"
        >
          <h2 className="mt-2 font-semibold text-slate-900">Janitor app</h2>
          <p className="mt-1 text-sm text-slate-600">
            Phone + PIN login, today&apos;s tasks, photo proof, works offline.
          </p>
          <p className="mt-3 text-xs text-slate-400">Phone + PIN authentication</p>
        </Link>
        <Link
          href="/login?mode=password"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-sky-400"
        >
          <h2 className="mt-2 font-semibold text-slate-900">Ops dashboard</h2>
          <p className="mt-1 text-sm text-slate-600">
            Compliance snapshot, calendar, alerts, schedule admin, CSV export.
          </p>
          <p className="mt-3 text-xs text-slate-400">Email + password authentication</p>
        </Link>
      </div>
    </main>
  );
}
