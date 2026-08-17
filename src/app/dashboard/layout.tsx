import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSession } from "@/lib/auth";
import LogoutButton from "@/components/ops/LogoutButton";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login?mode=password");
  if (session.role === "janitor") redirect("/app");

  const isSuperAdmin = session.role === "super_admin";

  return (
    <div className="min-h-dvh bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-6 py-3">
          <Link href="/dashboard" className="font-semibold text-slate-900">
            Soft Services Ops
          </Link>
          <nav className="flex gap-1 text-sm">
            {[
              { href: "/dashboard", label: "Overview" },
              { href: "/dashboard/tasks", label: "Tasks" },
              { href: "/dashboard/logs", label: "Logs" },
              { href: "/dashboard/templates", label: "Schedules" },
              { href: "/dashboard/users", label: "Users" },
              ...(isSuperAdmin ? [{ href: "/dashboard/facilities", label: "Facilities" }] : []),
              { href: "/dashboard/audit", label: "Audit" },
              { href: "/dashboard/settings", label: "Settings" },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm text-slate-500">
            <span>
              {session.name} · <span className="uppercase tracking-wide">{session.role.replace("_", " ")}</span>
            </span>
            <Link href="/app" className="rounded-lg border border-slate-200 px-3 py-1.5">
              Janitor view
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </div>
  );
}
