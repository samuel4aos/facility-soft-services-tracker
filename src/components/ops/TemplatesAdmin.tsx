"use client";

import { useCallback, useEffect, useState } from "react";

type Template = {
  id: number;
  name: string;
  location: string | null;
  recurrenceType: string;
  recurrenceConfig: Record<string, unknown>;
  requiresPhoto: boolean;
  instructions: string | null;
  criticality: string;
  active: boolean;
  assignedUserId: number | null;
  assignedName: string | null;
  summary: string;
  nextDue: string | null;
  areaGroup: string | null;
  sortOrder: number;
  timingType: string | null;
};

const AREA_GROUPS = [
  "Reception & Common Areas",
  "Restrooms",
  "Kitchen / Breakroom",
  "Carpark & Security",
  "Office Areas",
  "Pump Rooms",
  "Weekly Deep Clean",
  "Monthly Specialist",
  "Ad-hoc Tasks",
];

const TIMING_OPTIONS: [string, string][] = [
  ["", "(none)"],
  ["before_resumption", "Before Staff Resumption"],
  ["morning_close", "Morning + Close of Work"],
  ["hourly", "Every Hour"],
  ["daily", "Once Daily"],
  ["weekly", "Weekly"],
  ["monthly", "Monthly"],
];

const TIMING_COLORS: Record<string, string> = {
  before_resumption: "bg-amber-100 text-amber-700",
  morning_close: "bg-blue-100 text-blue-700",
  hourly: "bg-purple-100 text-purple-700",
  daily: "bg-sky-100 text-sky-700",
  weekly: "bg-emerald-100 text-emerald-700",
  monthly: "bg-slate-200 text-slate-600",
};

type UserRow = { id: number; name: string; role: string };

const TYPES = [
  ["daily", "Daily"],
  ["hourly", "Hourly"],
  ["weekly", "Weekly (one weekday)"],
  ["weekly_multi", "Multiple days per week"],
  ["biweekly", "Every N weeks"],
  ["monthly", "Monthly"],
  ["quarterly", "Quarterly"],
  ["biannual", "Twice a year"],
] as const;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

type FormState = {
  id?: number;
  name: string;
  location: string;
  recurrenceType: string;
  requiresPhoto: boolean;
  criticality: string;
  instructions: string;
  assignedUserId: string;
  active: boolean;
  weekday: number;
  weekdays: number[];
  intervalWeeks: number;
  anchorDate: string;
  dayOfMonth: string;
  monthOfQuarter: number;
  targetMonths: number[];
  graceDays: number;
  startHour: number;
  endHour: number;
  intervalHours: number;
  dueTime: string;
  areaGroup: string;
  timingType: string;
};

const EMPTY: FormState = {
  name: "",
  location: "",
  recurrenceType: "daily",
  requiresPhoto: true,
  criticality: "standard",
  instructions: "",
  assignedUserId: "",
  active: true,
  weekday: 1,
  weekdays: [2, 5],
  intervalWeeks: 2,
  anchorDate: "",
  dayOfMonth: "",
  monthOfQuarter: 0,
  targetMonths: [3, 9],
  graceDays: 0,
  startHour: 8,
  endHour: 17,
  intervalHours: 1,
  dueTime: "",
  areaGroup: "",
  timingType: "",
};

export default function TemplatesAdmin() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const grouped = (() => {
    const map = new Map<string, Template[]>();
    for (const t of templates) {
      const key = t.areaGroup || "Uncategorised";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    for (const [, arr] of map) arr.sort((a, b) => a.sortOrder - b.sortOrder);
    return map;
  })();

  const load = useCallback(async () => {
    const res = await fetch("/api/ops/templates", { cache: "no-store" });
    const data = (await res.json()) as { templates: Template[] };
    setTemplates(data.templates ?? []);
  }, []);

  useEffect(() => {
    load();
    fetch("/api/ops/users")
      .then((r) => r.json())
      .then((d: { users: UserRow[] }) => setUsers((d.users ?? []).filter((u) => u.role === "janitor")))
      .catch(() => {});
  }, [load]);

  function edit(t: Template) {
    const cfg = (t.recurrenceConfig ?? {}) as Record<string, unknown>;
    setForm({
      ...EMPTY,
      id: t.id,
      name: t.name,
      location: t.location ?? "",
      recurrenceType: t.recurrenceType,
      requiresPhoto: t.requiresPhoto,
      criticality: t.criticality,
      instructions: t.instructions ?? "",
      assignedUserId: t.assignedUserId ? String(t.assignedUserId) : "",
      active: t.active,
      weekday: Number(cfg.weekday ?? 1),
      weekdays: (cfg.weekdays as number[]) ?? [2, 5],
      intervalWeeks: Number(cfg.intervalWeeks ?? 2),
      anchorDate: (cfg.anchorDate as string) ?? "",
      dayOfMonth: cfg.dayOfMonth ? String(cfg.dayOfMonth) : "",
      monthOfQuarter: Number(cfg.monthOfQuarter ?? 0),
      targetMonths: (cfg.targetMonths as number[]) ?? [3, 9],
      graceDays: Number(cfg.graceDays ?? 0),
      startHour: Number(cfg.startHour ?? 8),
      endHour: Number(cfg.endHour ?? 17),
      intervalHours: Number(cfg.intervalHours ?? 1),
      dueTime: (cfg.dueTime as string) ?? "",
      areaGroup: t.areaGroup ?? "",
      timingType: t.timingType ?? "",
    });
    setMsg(null);
  }

  async function save() {
    if (!form) return;
    setBusy(true);
    const payload = {
      name: form.name,
      location: form.location,
      recurrenceType: form.recurrenceType,
      requiresPhoto: form.requiresPhoto,
      criticality: form.criticality,
      instructions: form.instructions,
      assignedUserId: form.assignedUserId || null,
      active: form.active,
      areaGroup: form.areaGroup || null,
      timingType: form.timingType || null,
      recurrenceConfig: {
        weekday: form.weekday,
        weekdays: form.weekdays,
        intervalWeeks: form.intervalWeeks,
        anchorDate: form.anchorDate || undefined,
        dayOfMonth: form.dayOfMonth,
        monthOfQuarter: form.monthOfQuarter,
        targetMonths: form.targetMonths,
        graceDays: form.graceDays,
        startHour: form.startHour,
        endHour: form.endHour,
        intervalHours: form.intervalHours,
        dueTime: form.dueTime || undefined,
      },
    };
    const res = await fetch(
      form.id ? `/api/ops/templates/${form.id}` : "/api/ops/templates",
      {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    setBusy(false);
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setMsg(d.error ?? "Save failed");
      return;
    }
    setMsg("Saved — occurrences regenerated from the recurrence engine.");
    setForm(null);
    load();
  }

  async function softDelete(id: number) {
    if (!confirm("Deactivate & soft-delete this task template? Logs are preserved.")) return;
    await fetch(`/api/ops/templates/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="font-semibold text-slate-900">Task templates</h2>
          <button
            onClick={() => setForm({ ...EMPTY })}
            className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white"
          >
            + New task
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
          {[...grouped.entries()].map(([group, items]) => (
            <div key={group}>
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {group}
              </div>
              <ul className="divide-y divide-slate-100">
                {items.map((t) => (
                  <li
                    key={t.id}
                    className={`flex items-center justify-between px-4 py-2.5 ${t.active ? "" : "opacity-50"}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-slate-800">{t.name}</p>
                        {t.timingType && (
                          <span
                            className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none ${TIMING_COLORS[t.timingType] ?? "bg-slate-100 text-slate-500"}`}
                          >
                            {TIMING_OPTIONS.find(([v]) => v === t.timingType)?.[1] ?? t.timingType}
                          </span>
                        )}
                        {t.criticality === "critical" && (
                          <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] uppercase text-rose-700">
                            critical
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {t.summary}
                        {t.assignedName && <span className="ml-2">· {t.assignedName}</span>}
                        {!t.active && <span className="ml-2 text-slate-400">(inactive)</span>}
                      </p>
                    </div>
                    <div className="ml-3 shrink-0 text-right text-xs">
                      <button onClick={() => edit(t)} className="text-sky-600 hover:underline">
                        Edit
                      </button>
                      <button
                        onClick={() => softDelete(t.id)}
                        className="ml-2 text-rose-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        {msg && <p className="mb-3 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">{msg}</p>}
        {!form ? (
          <p className="text-sm text-slate-500">
            Select a task to edit, or create a new one. Changing a schedule immediately
            re-materialises future occurrences through the recurrence engine — no code
            changes required.
          </p>
        ) : (
          <div className="space-y-3">
            <h2 className="font-semibold text-slate-900">
              {form.id ? "Edit task template" : "New task template"}
            </h2>
            <L label="Task name">
              <input
                className="input w-full"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </L>
            <L label="Location / room">
              <input
                className="input w-full"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </L>
            <L label="Area group">
              <select
                className="input w-full"
                value={form.areaGroup}
                onChange={(e) => setForm({ ...form, areaGroup: e.target.value })}
              >
                <option value="">(none)</option>
                {AREA_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </L>
            <L label="Timing type">
              <select
                className="input w-full"
                value={form.timingType}
                onChange={(e) => setForm({ ...form, timingType: e.target.value })}
              >
                {TIMING_OPTIONS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </L>
            <L label="Recurrence type">
              <select
                className="input w-full"
                value={form.recurrenceType}
                onChange={(e) => setForm({ ...form, recurrenceType: e.target.value })}
              >
                {TYPES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </L>

            {form.recurrenceType === "hourly" && (
              <>
                <L label="Start hour (24h)">
                  <input
                    type="number"
                    min={0}
                    max={23}
                    className="input w-full"
                    value={form.startHour}
                    onChange={(e) => setForm({ ...form, startHour: Number(e.target.value) })}
                  />
                </L>
                <L label="End hour (24h)">
                  <input
                    type="number"
                    min={0}
                    max={23}
                    className="input w-full"
                    value={form.endHour}
                    onChange={(e) => setForm({ ...form, endHour: Number(e.target.value) })}
                  />
                </L>
                <L label="Every N hours (1-6)">
                  <input
                    type="number"
                    min={1}
                    max={6}
                    className="input w-full"
                    value={form.intervalHours}
                    onChange={(e) => setForm({ ...form, intervalHours: Number(e.target.value) })}
                  />
                </L>
              </>
            )}
            {(form.recurrenceType === "daily" || form.recurrenceType === "hourly") && (
              <L label="Due time (optional, e.g. 14:00)">
                <input
                  type="time"
                  className="input w-full"
                  value={form.dueTime}
                  onChange={(e) => setForm({ ...form, dueTime: e.target.value })}
                />
              </L>
            )}

            {(form.recurrenceType === "weekly" || form.recurrenceType === "biweekly") && (
              <L label="Weekday">
                <select
                  className="input w-full"
                  value={form.weekday}
                  onChange={(e) => setForm({ ...form, weekday: Number(e.target.value) })}
                >
                  {WEEKDAYS.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
              </L>
            )}
            {form.recurrenceType === "biweekly" && (
              <>
                <L label="Interval (weeks)">
                  <input
                    type="number"
                    min={1}
                    className="input w-full"
                    value={form.intervalWeeks}
                    onChange={(e) => setForm({ ...form, intervalWeeks: Number(e.target.value) })}
                  />
                </L>
                <L label="Anchor date (cycle start)">
                  <input
                    type="date"
                    className="input w-full"
                    value={form.anchorDate}
                    onChange={(e) => setForm({ ...form, anchorDate: e.target.value })}
                  />
                </L>
              </>
            )}
            {form.recurrenceType === "weekly_multi" && (
              <L label="Days of week">
                <div className="flex flex-wrap gap-1">
                  {WEEKDAYS.map((d, i) => (
                    <button
                      key={d}
                      onClick={() =>
                        setForm({
                          ...form,
                          weekdays: form.weekdays.includes(i)
                            ? form.weekdays.filter((w) => w !== i)
                            : [...form.weekdays, i].sort(),
                        })
                      }
                      className={`rounded-lg px-2 py-1 text-xs ${
                        form.weekdays.includes(i) ? "bg-sky-600 text-white" : "bg-slate-100"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </L>
            )}
            {form.recurrenceType === "quarterly" && (
              <L label="Month within quarter">
                <select
                  className="input w-full"
                  value={form.monthOfQuarter}
                  onChange={(e) => setForm({ ...form, monthOfQuarter: Number(e.target.value) })}
                >
                  {[0, 1, 2].map((m) => (
                    <option key={m} value={m}>
                      Month {m + 1}
                    </option>
                  ))}
                </select>
              </L>
            )}
            {form.recurrenceType === "biannual" && (
              <L label="Target months (pick 2)">
                <div className="flex flex-wrap gap-1">
                  {MONTHS.map((m, i) => {
                    const month = i + 1;
                    const on = form.targetMonths.includes(month);
                    return (
                      <button
                        key={m}
                        onClick={() =>
                          setForm({
                            ...form,
                            targetMonths: on
                              ? form.targetMonths.filter((x) => x !== month)
                              : [...form.targetMonths, month].slice(-2).sort((a, b) => a - b),
                          })
                        }
                        className={`rounded-lg px-2 py-1 text-xs ${on ? "bg-sky-600 text-white" : "bg-slate-100"}`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </L>
            )}
            {["monthly", "quarterly", "biannual"].includes(form.recurrenceType) && (
              <L label="Target day of month (blank = any day in the window)">
                <input
                  type="number"
                  min={1}
                  max={31}
                  className="input w-full"
                  value={form.dayOfMonth}
                  onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value })}
                />
              </L>
            )}

            <L label="Assigned janitor">
              <select
                className="input w-full"
                value={form.assignedUserId}
                onChange={(e) => setForm({ ...form, assignedUserId: e.target.value })}
              >
                <option value="">Any janitor at facility</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </L>
            <L label="Instructions / checklist">
              <textarea
                rows={3}
                className="input w-full"
                value={form.instructions}
                onChange={(e) => setForm({ ...form, instructions: e.target.value })}
              />
            </L>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.requiresPhoto}
                  onChange={(e) => setForm({ ...form, requiresPhoto: e.target.checked })}
                />
                Photo required
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.criticality === "critical"}
                  onChange={(e) =>
                    setForm({ ...form, criticality: e.target.checked ? "critical" : "standard" })
                  }
                />
                Safety critical (escalate)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                Active
              </label>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={save}
                disabled={busy}
                className="flex-1 rounded-xl bg-sky-600 py-2 font-medium text-white disabled:opacity-60"
              >
                {busy ? "Saving…" : "Save template"}
              </button>
              <button
                onClick={() => setForm(null)}
                className="rounded-xl border border-slate-300 px-4 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}
