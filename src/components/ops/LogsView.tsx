"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Row = {
  id: number;
  dueDate: string;
  windowStart: string;
  windowEnd: string;
  status: "pending" | "completed" | "overdue" | "missed";
  templateId: number;
  name: string;
  location: string | null;
  criticality: string;
  recurrenceType: string;
  logId: number | null;
  completedAt: string | null;
  notes: string | null;
  gpsLat: number | null;
  gpsLng: number | null;
  janitorName: string | null;
  photoUrls: string[];
};

type Template = { id: number; name: string };
type UserRow = { id: number; name: string; role: string };

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-emerald-100 text-emerald-700",
  pending: "bg-slate-100 text-slate-600",
  overdue: "bg-amber-100 text-amber-700",
  missed: "bg-rose-100 text-rose-700",
};

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function LogsView() {
  const today = useMemo(() => iso(new Date()), []);
  const monthStart = today.slice(0, 8) + "01";
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [status, setStatus] = useState("all");
  const [templateId, setTemplateId] = useState("");
  const [janitorId, setJanitorId] = useState("");
  const [view, setView] = useState<"table" | "calendar">("table");
  const [rows, setRows] = useState<Row[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Row | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams({ from, to, order: "desc", limit: "1000" });
    if (status !== "all") p.set("status", status);
    if (templateId) p.set("templateId", templateId);
    if (janitorId) p.set("janitorId", janitorId);
    return p.toString();
  }, [from, to, status, templateId, janitorId]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/ops/logs?${query}`, { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { rows: Row[] };
      setRows(data.rows);
    }
    setLoading(false);
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/ops/templates")
      .then((r) => r.json())
      .then((d: { templates: Template[] }) => setTemplates(d.templates ?? []))
      .catch(() => {});
    fetch("/api/ops/users")
      .then((r) => r.json())
      .then((d: { users: UserRow[] }) => setUsers((d.users ?? []).filter((u) => u.role === "janitor")))
      .catch(() => {});
  }, []);

  function shiftMonth(delta: number) {
    const base = new Date(`${from}T00:00:00Z`);
    const first = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + delta, 1));
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
    setFrom(iso(first));
    setTo(iso(last));
  }

  const byDate = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      const list = map.get(r.dueDate) ?? [];
      list.push(r);
      map.set(r.dueDate, list);
    }
    return map;
  }, [rows]);

  const calendarDays = useMemo(() => {
    const first = new Date(`${from.slice(0, 8)}01T00:00:00Z`);
    const startPad = (first.getUTCDay() + 6) % 7;
    const daysInMonth = new Date(
      Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
    ).getUTCDate();
    const cells: (string | null)[] = Array.from({ length: startPad }, () => null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(
        `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      );
    }
    return cells;
  }, [from]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <Field label="From">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" />
        </Field>
        <Field label="To">
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" />
        </Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
            {["all", "completed", "pending", "overdue", "missed"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Task">
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="input">
            <option value="">All tasks</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Janitor">
          <select value={janitorId} onChange={(e) => setJanitorId(e.target.value)} className="input">
            <option value="">Anyone</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="ml-auto flex gap-2">
          <div className="flex rounded-lg bg-slate-100 p-1 text-sm">
            {(["table", "calendar"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-md px-3 py-1.5 capitalize ${view === v ? "bg-white shadow-sm" : "text-slate-500"}`}
              >
                {v}
              </button>
            ))}
          </div>
          <a
            href={`/api/ops/logs?${query}&format=csv`}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
          >
            Export CSV
          </a>
          <button
            onClick={() => window.print()}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            Print / PDF
          </button>
        </div>
      </div>

      {view === "calendar" && (
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-2">
          <button onClick={() => shiftMonth(-1)} className="rounded-lg border px-3 py-1 text-sm">
            ← Prev
          </button>
          <p className="font-medium text-slate-800">
            {new Date(`${from.slice(0, 8)}01T00:00:00Z`).toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            })}
          </p>
          <button onClick={() => shiftMonth(1)} className="rounded-lg border px-3 py-1 text-sm">
            Next →
          </button>
        </div>
      )}

      {loading ? (
        <p className="py-10 text-center text-slate-500">Loading…</p>
      ) : view === "table" ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Task</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Completed</th>
                <th className="px-4 py-3">Janitor</th>
                <th className="px-4 py-3">Proof</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className="cursor-pointer hover:bg-slate-50"
                >
                  <td className="whitespace-nowrap px-4 py-2 text-slate-600">{r.dueDate}</td>
                  <td className="px-4 py-2 font-medium text-slate-800">
                    {r.name}
                    {r.criticality === "critical" && (
                      <span className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] uppercase text-rose-700">
                        critical
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-500">{r.location}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status]}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-600">
                    {r.completedAt ? new Date(r.completedAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{r.janitorName ?? "—"}</td>
                  <td className="px-4 py-2">{r.photoUrls?.length ? `📷 ${r.photoUrls.length}` : "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    No records for these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase text-slate-400">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-2">
            {calendarDays.map((day, i) =>
              day === null ? (
                <div key={`pad-${i}`} />
              ) : (
                <div
                  key={day}
                  className={`min-h-24 rounded-xl border p-2 text-left ${
                    day === today ? "border-sky-400 bg-sky-50" : "border-slate-200"
                  }`}
                >
                  <p className="text-xs font-semibold text-slate-500">{Number(day.slice(-2))}</p>
                  <div className="mt-1 space-y-1">
                    {(byDate.get(day) ?? []).slice(0, 4).map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setSelected(r)}
                        className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] ${STATUS_STYLES[r.status]}`}
                        title={`${r.name} — ${r.status}`}
                      >
                        {r.name}
                      </button>
                    ))}
                    {(byDate.get(day) ?? []).length > 4 && (
                      <p className="text-[10px] text-slate-400">
                        +{(byDate.get(day) ?? []).length - 4} more
                      </p>
                    )}
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{selected.name}</h3>
                <p className="text-sm text-slate-500">{selected.location}</p>
              </div>
              <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[selected.status]}`}>
                {selected.status}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Detail label="Due date" value={selected.dueDate} />
              <Detail label="Window" value={`${selected.windowStart} → ${selected.windowEnd}`} />
              <Detail label="Recurrence" value={selected.recurrenceType} />
              <Detail
                label="Completed at"
                value={selected.completedAt ? new Date(selected.completedAt).toLocaleString() : "—"}
              />
              <Detail label="Janitor" value={selected.janitorName ?? "—"} />
              <Detail
                label="GPS"
                value={
                  selected.gpsLat && selected.gpsLng
                    ? `${selected.gpsLat.toFixed(5)}, ${selected.gpsLng.toFixed(5)}`
                    : "not captured"
                }
              />
            </dl>
            {selected.notes && (
              <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                “{selected.notes}”
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              {selected.photoUrls?.map((u) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={u} src={u} alt="proof" className="h-40 w-40 rounded-xl object-cover" />
              ))}
              {(!selected.photoUrls || selected.photoUrls.length === 0) && (
                <p className="text-sm text-slate-400">No photos attached.</p>
              )}
            </div>
            <button
              onClick={() => setSelected(null)}
              className="mt-6 w-full rounded-xl bg-slate-900 py-2 text-sm font-medium text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-slate-800">{value}</dd>
    </div>
  );
}
