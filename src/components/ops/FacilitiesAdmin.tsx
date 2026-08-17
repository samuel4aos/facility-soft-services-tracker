"use client";

import { useCallback, useEffect, useState } from "react";

type Facility = {
  id: number;
  name: string;
  address: string | null;
  timezone: string;
  userCount: number;
  createdAt: string;
};

type FormState = {
  id?: number;
  name: string;
  address: string;
  timezone: string;
};

const EMPTY: FormState = { name: "", address: "", timezone: "Africa/Lagos" };

const TIMEZONES = [
  "Africa/Lagos",
  "Africa/Accra",
  "Africa/Nairobi",
  "Africa/Johannesburg",
  "Africa/Cairo",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "UTC",
];

export default function FacilitiesAdmin() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/ops/facilities", { cache: "no-store" });
    const data = (await res.json()) as { facilities: Facility[] };
    setFacilities(data.facilities ?? []);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!form) return;
    setBusy(true);
    setError(null);

    const payload = { name: form.name, address: form.address, timezone: form.timezone };
    const res = await fetch(
      form.id ? `/api/ops/facilities/${form.id}` : "/api/ops/facilities",
      {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    setBusy(false);

    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setError(d.error ?? "Save failed");
      return;
    }
    setMsg(form.id ? "Facility updated." : "Facility created.");
    setForm(null);
    load();
  }

  async function remove(id: number) {
    if (!confirm("Delete this facility? This cannot be undone.")) return;
    await fetch(`/api/ops/facilities/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="font-semibold text-slate-900">Facilities ({facilities.length})</h2>
          <button
            onClick={() => { setForm({ ...EMPTY }); setMsg(null); setError(null); }}
            className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white"
          >
            + New facility
          </button>
        </div>
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Address</th>
              <th className="px-4 py-2">Timezone</th>
              <th className="px-4 py-2">Users</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {facilities.map((f) => (
              <tr key={f.id}>
                <td className="px-4 py-2 font-medium text-slate-800">{f.name}</td>
                <td className="px-4 py-2 text-slate-500">{f.address ?? "—"}</td>
                <td className="px-4 py-2 text-slate-500 text-xs">{f.timezone}</td>
                <td className="px-4 py-2 text-slate-500">{f.userCount}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => { setForm({ id: f.id, name: f.name, address: f.address ?? "", timezone: f.timezone }); setMsg(null); setError(null); }} className="text-sky-600 hover:underline">
                    Edit
                  </button>
                  <button onClick={() => remove(f.id)} className="ml-3 text-rose-600 hover:underline">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        {msg && <p className="mb-3 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">{msg}</p>}
        {error && <p className="mb-3 rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{error}</p>}
        {!form ? (
          <p className="text-sm text-slate-500">
            Select a facility to edit, or create a new one.
          </p>
        ) : (
          <div className="space-y-3">
            <h2 className="font-semibold text-slate-900">
              {form.id ? "Edit facility" : "New facility"}
            </h2>
            <L label="Name">
              <input className="input w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </L>
            <L label="Address">
              <input className="input w-full" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </L>
            <L label="Timezone">
              <select className="input w-full" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </L>
            <div className="flex gap-2 pt-2">
              <button onClick={save} disabled={busy} className="flex-1 rounded-xl bg-sky-600 py-2 font-medium text-white disabled:opacity-60">
                {busy ? "Saving…" : "Save facility"}
              </button>
              <button onClick={() => setForm(null)} className="rounded-xl border border-slate-300 px-4 py-2">
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
