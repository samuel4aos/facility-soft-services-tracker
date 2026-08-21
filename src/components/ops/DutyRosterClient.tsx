"use client";

import { useCallback, useEffect, useState } from "react";

type DayInfo = { date: string; scheduled: boolean; onDuty: boolean };
type JanitorRow = {
  id: number;
  name: string;
  role: string;
  days: DayInfo[];
};
type RosterData = {
  month: string;
  daysInMonth: string[];
  janitors: JanitorRow[];
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getWeekday(dateStr: string): number {
  return (new Date(dateStr + "T00:00:00").getDay() + 6) % 7; // Mon=0..Sun=6
}

function formatDay(d: string): string {
  return String(new Date(d + "T00:00:00").getDate());
}

export default function DutyRosterClient() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<RosterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [localOverrides, setLocalOverrides] = useState<
    Map<string, Map<number, boolean>>
  >(new Map());
  const [toast, setToast] = useState<string | null>(null);

  const monthStr = `${year}-${String(month).padStart(2, "0")}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ops/roster?month=${monthStr}`, {
        cache: "no-store",
      });
      const json = await res.json();
      setData(json);
      setLocalOverrides(new Map());
      setDirty(false);
    } finally {
      setLoading(false);
    }
  }, [monthStr]);

  useEffect(() => {
    load();
  }, [load]);

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const toggle = (janitorId: number, date: string, currentOnDuty: boolean) => {
    setLocalOverrides((prev) => {
      const next = new Map(prev);
      const userMap = next.get(date) ?? new Map<number, boolean>();
      userMap.set(janitorId, !currentOnDuty);
      next.set(date, userMap);
      return next;
    });
    setDirty(true);
  };

  const getOnDuty = (janitorId: number, day: DayInfo): boolean => {
    const overrides = localOverrides.get(day.date);
    if (overrides?.has(janitorId)) return overrides.get(janitorId)!;
    return day.onDuty;
  };

  const save = async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      const entries: { userId: number; date: string; onDuty: boolean }[] = [];
      for (const [date, userMap] of localOverrides) {
        for (const [userId, onDuty] of userMap) {
          entries.push({ userId, date, onDuty });
        }
      }
      const res = await fetch("/api/ops/roster", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      if (res.ok) {
        setDirty(false);
        setLocalOverrides(new Map());
        setToast("Roster saved");
        setTimeout(() => setToast(null), 3000);
        await load();
      } else {
        setToast("Save failed");
        setTimeout(() => setToast(null), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  // Compute stats
  const onDutyCount = data
    ? data.janitors.filter((j) => {
        // Count as on duty if no override or override says on duty
        const todayStr = new Date().toISOString().slice(0, 10);
        const dayData = j.days.find((d) => d.date === todayStr);
        if (!dayData) return true;
        return getOnDuty(j.id, dayData);
      }).length
    : 0;
  const offDutyCount = data ? data.janitors.length - onDutyCount : 0;

  const monthName = new Date(year, month - 1).toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Duty Roster</h1>
          <p className="text-sm text-slate-500">
            Manage which janitors are on duty each day
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            &larr; Prev
          </button>
          <span className="text-sm font-medium text-slate-700 min-w-[140px] text-center">
            {monthName}
          </span>
          <button
            onClick={nextMonth}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Next &rarr;
          </button>
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="rounded-lg bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-40"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-emerald-500" /> On
          duty
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-rose-500" /> Off
          duty
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-slate-200" /> Not
          scheduled
        </span>
        <span className="ml-auto text-slate-400">
          Click a cell to toggle on/off duty
        </span>
      </div>

      {/* Stats */}
      {data && (
        <div className="flex gap-4 text-sm">
          <span className="text-slate-600">
            <span className="font-medium text-slate-900">
              {data.janitors.length}
            </span>{" "}
            total staff
          </span>
          <span className="text-emerald-600">
            <span className="font-medium">{onDutyCount}</span> on duty today
          </span>
          <span className="text-rose-600">
            <span className="font-medium">{offDutyCount}</span> off duty today
          </span>
        </div>
      )}

      {/* Grid */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading roster...</div>
        ) : !data || data.janitors.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            No janitors found
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="sticky left-0 z-10 bg-white px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500 min-w-[160px]">
                  Name
                </th>
                {data.daysInMonth.map((d) => {
                  const wd = getWeekday(d);
                  const isWeekend = wd >= 5;
                  return (
                    <th
                      key={d}
                      className={`px-1 py-2 text-center text-xs font-medium min-w-[36px] ${
                        isWeekend ? "text-slate-300" : "text-slate-500"
                      }`}
                    >
                      <div className="text-[10px] leading-tight">
                        {WEEKDAYS[wd]}
                      </div>
                      <div>{formatDay(d)}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.janitors.map((j) => (
                <tr key={j.id} className="hover:bg-slate-50/50">
                  <td className="sticky left-0 z-10 bg-white px-4 py-2 font-medium text-slate-800 whitespace-nowrap">
                    <span>{j.name}</span>
                    {j.role === "gardener" && (
                      <span className="ml-1.5 text-[10px] text-emerald-500 font-normal">
                        gardener
                      </span>
                    )}
                  </td>
                  {data.daysInMonth.map((d, di) => {
                    const dayData = j.days[di];
                    if (!dayData || !dayData.scheduled) {
                      return (
                        <td key={d} className="px-1 py-2 text-center">
                          <span className="inline-block h-5 w-5 rounded bg-slate-100" />
                        </td>
                      );
                    }
                    const onDuty = getOnDuty(j.id, dayData);
                    return (
                      <td key={d} className="px-1 py-2 text-center">
                        <button
                          onClick={() => toggle(j.id, d, onDuty)}
                          title={`${j.name}: ${onDuty ? "On duty" : "Off duty"} — click to toggle`}
                          className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white transition-colors ${
                            onDuty
                              ? "bg-emerald-500 hover:bg-emerald-600"
                              : "bg-rose-500 hover:bg-rose-600"
                          }`}
                        >
                          {onDuty ? "✓" : "✕"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
