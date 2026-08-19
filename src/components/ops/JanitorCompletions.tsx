"use client";

import { useCallback, useEffect, useState } from "react";

type Completions = {
  date: string;
  totalCompleted: number;
  janitors: {
    id: number;
    name: string;
    total: number;
    tasks: {
      logId: number;
      name: string;
      location: string | null;
      areaGroup: string | null;
      completedAt: string;
      notes: string | null;
      photoCount: number;
    }[];
  }[];
};

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function fmtTime(isoStr: string) {
  return new Date(isoStr).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function JanitorCompletions() {
  const [date, setDate] = useState(iso(new Date()));
  const [data, setData] = useState<Completions | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/ops/janitor-completions?date=${date}`, {
      cache: "no-store",
    });
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">
            Completed jobs per janitor
          </h2>
          <p className="text-xs text-slate-500">
            Daily record of tasks completed by each janitor — for record keeping
            and supervision.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input"
          />
          <button
            onClick={load}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-slate-500">Loading…</p>
      ) : !data || data.janitors.length === 0 ? (
        <p className="py-10 text-center text-slate-400">
          No completed jobs recorded for {date}.
        </p>
      ) : (
        <>
          <p className="mt-3 text-sm text-slate-500">
            <span className="font-semibold text-slate-800">
              {data.totalCompleted}
            </span>{" "}
            job(s) completed on {data.date}
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {data.janitors.map((j) => {
              const open = expanded === j.id;
              return (
                <div
                  key={j.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <button
                    onClick={() => setExpanded(open ? null : j.id)}
                    className="flex w-full items-center justify-between gap-2 text-left"
                  >
                    <div>
                      <p className="font-medium text-slate-800">{j.name}</p>
                      <p className="text-xs text-slate-500">
                        {j.total} task(s) completed
                      </p>
                    </div>
                    <svg
                      className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                  {open && (
                    <div className="mt-3 space-y-2">
                      {j.tasks.map((t) => (
                        <div
                          key={t.logId}
                          className="rounded-lg border border-slate-200 bg-white p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-slate-800">
                              {t.name}
                            </p>
                            <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                              {fmtTime(t.completedAt)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {t.location ?? "—"}
                            {t.areaGroup ? ` · ${t.areaGroup}` : ""}
                            {t.photoCount > 0
                              ? ` · 📷 ${t.photoCount} photo${t.photoCount > 1 ? "s" : ""}`
                              : ""}
                          </p>
                          {t.notes && (
                            <p className="mt-1 text-xs italic text-slate-500">
                              “{t.notes}”
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}