"use client";

import { useEffect, useState } from "react";

type Overview = {
  today: string;
  todayStats: { total: number; completed: number; overdue: number; pending: number; missed: number };
  trend: { bucket: string; total: number; completed: number }[];
  byTask: { templateId: number; name: string; criticality: string; total: number; completed: number; missed: number }[];
  alerts: {
    id: number;
    severity: string;
    message: string;
    createdAt: string;
    acknowledgedAt: string | null;
    dueDate: string | null;
    name: string | null;
    status: string | null;
  }[];
  upcoming: { id: number; name: string; dueDate: string; recurrenceType: string; status: string }[];
  attention: {
    id: number;
    name: string;
    dueDate: string;
    windowEnd: string;
    status: string;
    criticality: string;
    location: string | null;
  }[];
  janitorStats: { id: number; name: string; total: number; completed: number; rate: number }[];
};

function daysAgo(from: string, today: string) {
  return Math.round(
    (new Date(`${today}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86400000,
  );
}

export default function OverviewClient() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    fetch("/api/ops/overview", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load"))))
      .then(setData)
      .catch((e: Error) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  if (error) return <p className="text-rose-600">{error}</p>;
  if (!data) return <p className="text-slate-500">Loading dashboard…</p>;

  const s = data.todayStats;
  const rate = s.total ? Math.round((s.completed / s.total) * 100) : 100;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Today's compliance" value={`${rate}%`} sub={`${s.completed}/${s.total} tasks`} tone="sky" />
        <Kpi label="Completed" value={s.completed} tone="emerald" />
        <Kpi label="Pending in window" value={s.pending} tone="slate" />
        <Kpi label="Overdue" value={s.overdue} tone="amber" />
        <Kpi label="Missed (30d)" value={s.missed} tone="rose" />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <h2 className="font-semibold text-slate-900">Weekly compliance rate</h2>
          <p className="text-xs text-slate-500">
            Share of scheduled occurrences completed, by ISO week (last 11 weeks)
          </p>
          <TrendChart trend={data.trend} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Alerts</h2>
          <p className="text-xs text-slate-500">Missed tasks — critical items escalate to ops</p>
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
            {data.alerts.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">No alerts. 🎉</p>
            )}
            {data.alerts.map((a) => (
              <div
                key={a.id}
                className={`rounded-xl border p-3 text-sm ${
                  a.severity === "critical"
                    ? "border-rose-200 bg-rose-50 text-rose-800"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{a.name ?? "Task"}</span>
                  <span className="text-xs">{a.dueDate}</span>
                </div>
                <p className="mt-1 text-xs">{a.message}</p>
                {!a.acknowledgedAt && (
                  <button
                    onClick={async () => {
                      await fetch("/api/ops/alerts", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: a.id }),
                      });
                      load();
                    }}
                    className="mt-2 rounded-lg bg-white px-2 py-1 text-xs font-medium shadow-sm"
                  >
                    Acknowledge
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Needs attention now</h2>
          <p className="text-xs text-slate-500">Overdue &amp; missed, most overdue first</p>
          <div className="mt-3 divide-y divide-slate-100">
            {data.attention.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">Nothing outstanding.</p>
            )}
            {data.attention.slice(0, 12).map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-slate-800">
                    {a.name}
                    {a.criticality === "critical" && (
                      <span className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-rose-700">
                        critical
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">{a.location}</p>
                </div>
                <div className="text-right">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      a.status === "missed"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {a.status}
                  </span>
                  <p className="text-xs text-slate-500">
                    {daysAgo(a.dueDate, data.today)}d past due
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Coming due (low-frequency)</h2>
          <p className="text-xs text-slate-500">
            Fumigation, deep cleaning, LAWMA, consumables &amp; bi-weekly items
          </p>
          <div className="mt-3 divide-y divide-slate-100">
            {data.upcoming.slice(0, 12).map((u) => (
              <div key={u.id} className="flex justify-between py-2 text-sm">
                <span className="text-slate-800">{u.name}</span>
                <span className="text-slate-500">
                  {u.dueDate} · {u.recurrenceType}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Compliance by task (last 30 days)</h2>
        <div className="mt-4 space-y-2">
          {data.byTask.map((t) => {
            const pct = t.total ? Math.round((t.completed / t.total) * 100) : 0;
            return (
              <div key={t.templateId} className="flex items-center gap-3 text-sm">
                <span className="w-64 shrink-0 truncate text-slate-700">{t.name}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full ${pct >= 90 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-500" : "bg-rose-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-28 shrink-0 text-right text-xs text-slate-500">
                  {t.completed}/{t.total} · {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {data.janitorStats && data.janitorStats.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Janitor performance (last 30 days)</h2>
          <p className="text-xs text-slate-500">Completion rate per assigned janitor</p>
          <div className="mt-4 space-y-3">
            {data.janitorStats.map((j) => (
              <div key={j.id} className="flex items-center gap-3 text-sm">
                <span className="w-48 shrink-0 font-medium text-slate-700">{j.name}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full ${j.rate >= 90 ? "bg-emerald-500" : j.rate >= 70 ? "bg-amber-500" : "bg-rose-500"}`}
                    style={{ width: `${j.rate}%` }}
                  />
                </div>
                <span className="w-28 shrink-0 text-right text-xs text-slate-500">
                  {j.completed}/{j.total} · {j.rate}%
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone: "sky" | "emerald" | "amber" | "rose" | "slate";
}) {
  const tones = {
    sky: "text-sky-700 bg-sky-50 border-sky-100",
    emerald: "text-emerald-700 bg-emerald-50 border-emerald-100",
    amber: "text-amber-700 bg-amber-50 border-amber-100",
    rose: "text-rose-700 bg-rose-50 border-rose-100",
    slate: "text-slate-700 bg-white border-slate-200",
  }[tone];
  return (
    <div className={`rounded-2xl border p-4 ${tones}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
      {sub && <p className="text-xs opacity-70">{sub}</p>}
    </div>
  );
}

function TrendChart({ trend }: { trend: { bucket: string; total: number; completed: number }[] }) {
  const points = trend.slice(-11).map((t) => ({
    label: t.bucket.slice(5),
    pct: t.total ? Math.round((t.completed / t.total) * 100) : 0,
  }));
  if (points.length === 0) return <p className="py-10 text-sm text-slate-400">No data yet.</p>;

  const w = 640;
  const h = 200;
  const pad = 28;
  const step = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const y = (pct: number) => h - pad - (pct / 100) * (h - pad * 2);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${pad + i * step} ${y(p.pct)}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-4 w-full">
      {[0, 50, 100].map((g) => (
        <g key={g}>
          <line x1={pad} x2={w - pad} y1={y(g)} y2={y(g)} stroke="#e2e8f0" strokeWidth={1} />
          <text x={4} y={y(g) + 4} fontSize={10} fill="#94a3b8">
            {g}%
          </text>
        </g>
      ))}
      <path d={path} fill="none" stroke="#0284c7" strokeWidth={2.5} />
      {points.map((p, i) => (
        <g key={p.label}>
          <circle cx={pad + i * step} cy={y(p.pct)} r={4} fill="#0284c7" />
          <text
            x={pad + i * step}
            y={h - 8}
            fontSize={9}
            fill="#94a3b8"
            textAnchor="middle"
          >
            {p.label}
          </text>
          <text
            x={pad + i * step}
            y={y(p.pct) - 10}
            fontSize={9}
            fill="#0f172a"
            textAnchor="middle"
          >
            {p.pct}
          </text>
        </g>
      ))}
    </svg>
  );
}
