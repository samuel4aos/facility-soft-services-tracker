"use client";

import { useCallback, useEffect, useState } from "react";

type AuditRow = {
  id: number;
  actorId: number | null;
  actorName: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
};

const ACTION_LABELS: Record<string, string> = {
  "task.completed": "Task completed",
  "template.created": "Template created",
  "template.updated": "Template updated",
  "template.soft_deleted": "Template deleted",
  "user.created": "User created",
  "user.updated": "User updated",
  "user.deactivated": "User deactivated",
  "facility.created": "Facility created",
  "facility.updated": "Facility updated",
  "facility.deleted": "Facility deleted",
  "profile.updated": "Profile updated",
};

const ACTION_FILTERS = [
  "",
  "task.completed",
  "template.created",
  "template.updated",
  "user.created",
  "user.updated",
  "user.deactivated",
  "facility.created",
  "profile.updated",
];

export default function AuditViewer() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [days, setDays] = useState(30);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ days: String(days) });
    if (action) p.set("action", action);
    const res = await fetch(`/api/ops/audit?${p}`, { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { rows: AuditRow[] };
      setRows(data.rows ?? []);
    }
    setLoading(false);
  }, [action, days]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
          <span className="mb-1 block">Action</span>
          <select value={action} onChange={(e) => setAction(e.target.value)} className="input">
            <option value="">All actions</option>
            {ACTION_FILTERS.filter(Boolean).map((a) => (
              <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
          <span className="mb-1 block">Days</span>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="input">
            {[7, 14, 30, 60, 90, 180, 365].map((d) => (
              <option key={d} value={d}>{d} days</option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <p className="py-10 text-center text-slate-500">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Time</th>
                <th className="px-4 py-2">Actor</th>
                <th className="px-4 py-2">Action</th>
                <th className="px-4 py-2">Entity</th>
                <th className="px-4 py-2">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-500">
                    {r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-2 font-medium text-slate-700">{r.actorName ?? "System"}</td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {ACTION_LABELS[r.action] ?? r.action}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-500">
                    {r.entity}
                    {r.entityId && <span className="text-slate-400"> #{r.entityId}</span>}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-400 max-w-xs truncate">
                    {Object.keys(r.meta ?? {}).length > 0
                      ? JSON.stringify(r.meta)
                      : "—"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                    No audit events found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
