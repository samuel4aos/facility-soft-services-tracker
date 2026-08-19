"use client";

import { useCallback, useEffect, useState } from "react";

type User = {
  id: number;
  name: string;
  role: string;
  phone: string | null;
  email: string | null;
  active: boolean;
  facilityId: number | null;
};

type Facility = { id: number; name: string };

type FormState = {
  id?: number;
  name: string;
  role: string;
  phone: string;
  email: string;
  pin: string;
  password: string;
  facilityId: string;
  active: boolean;
};

const EMPTY: FormState = {
  name: "",
  role: "janitor",
  phone: "",
  email: "",
  pin: "",
  password: "",
  facilityId: "",
  active: true,
};

const ROLES = [
  ["janitor", "Janitor"],
  ["gardener", "Gardener"],
  ["ops_admin", "Ops Admin"],
  ["super_admin", "Super Admin"],
] as const;

export default function UsersAdmin() {
  const [users, setUsers] = useState<User[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/ops/users", { cache: "no-store" });
    const data = (await res.json()) as { users: User[] };
    setUsers(data.users ?? []);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    load();
    fetch("/api/ops/facilities")
      .then((r) => r.json())
      .then((d: { facilities: Facility[] }) => setFacilities(d.facilities ?? []))
      .catch(() => {});
  }, [load]);

  function editUser(u: User) {
    setForm({
      id: u.id,
      name: u.name,
      role: u.role,
      phone: u.phone ?? "",
      email: u.email ?? "",
      pin: "",
      password: "",
      facilityId: u.facilityId ? String(u.facilityId) : "",
      active: u.active,
    });
    setMsg(null);
    setError(null);
  }

  async function save() {
    if (!form) return;
    setBusy(true);
    setError(null);

    const payload: Record<string, unknown> = {
      name: form.name,
      role: form.role,
      phone: form.phone || null,
      email: form.email || null,
      active: form.active,
      facilityId: form.facilityId ? Number(form.facilityId) : null,
    };

    if (form.pin) payload.pin = form.pin;
    if (form.password) payload.password = form.password;

    const res = await fetch(
      form.id ? `/api/ops/users/${form.id}` : "/api/ops/users",
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

    setMsg(form.id ? "User updated." : "User created.");
    setForm(null);
    load();
  }

  async function deactivate(id: number) {
    if (!confirm("Deactivate this user? They will no longer be able to log in.")) return;
    await fetch(`/api/ops/users/${id}`, { method: "DELETE" });
    load();
  }

  async function resetPin(id: number) {
    const pin = prompt("Enter new 4-digit PIN:");
    if (!pin || !/^\d{4}$/.test(pin)) {
      alert("PIN must be exactly 4 digits.");
      return;
    }
    const res = await fetch(`/api/ops/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (res.ok) alert("PIN reset successfully.");
    else alert("Failed to reset PIN.");
  }

  async function resetPassword(id: number) {
    const pwd = prompt("Enter new password (min 6 characters):");
    if (!pwd || pwd.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }
    const res = await fetch(`/api/ops/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pwd }),
    });
    if (res.ok) alert("Password reset successfully.");
    else alert("Failed to reset password.");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="font-semibold text-slate-900">Users ({users.length})</h2>
          <button
            onClick={() => { setForm({ ...EMPTY }); setMsg(null); setError(null); }}
            className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white"
          >
            + New user
          </button>
        </div>
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Contact</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className={u.active ? "" : "opacity-50"}>
                <td className="px-4 py-2 font-medium text-slate-800">{u.name}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    u.role === "super_admin"
                      ? "bg-violet-100 text-violet-700"
                      : u.role === "ops_admin"
                        ? "bg-sky-100 text-sky-700"
                        : u.role === "gardener"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                  }`}>
                    {u.role.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-2 text-xs text-slate-500">
                  {u.phone && <span>{u.phone}</span>}
                  {u.phone && u.email && <span> · </span>}
                  {u.email && <span>{u.email}</span>}
                  {!u.phone && !u.email && <span>—</span>}
                </td>
                <td className="px-4 py-2">
                  <span className={`text-xs font-medium ${u.active ? "text-emerald-600" : "text-rose-600"}`}>
                    {u.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => editUser(u)} className="text-sky-600 hover:underline">
                    Edit
                  </button>
                  {u.role === "janitor" || u.role === "gardener" ? (
                    <button onClick={() => resetPin(u.id)} className="ml-2 text-amber-600 hover:underline">
                      Reset PIN
                    </button>
                  ) : (
                    <button onClick={() => resetPassword(u.id)} className="ml-2 text-amber-600 hover:underline">
                      Reset Pwd
                    </button>
                  )}
                  <button onClick={() => deactivate(u.id)} className="ml-2 text-rose-600 hover:underline">
                    Deactivate
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
            Select a user to edit, or create a new one.
          </p>
        ) : (
          <div className="space-y-3">
            <h2 className="font-semibold text-slate-900">
              {form.id ? "Edit user" : "New user"}
            </h2>
            <L label="Full name">
              <input className="input w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </L>
            <L label="Role">
              <select className="input w-full" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </L>
            {form.role === "janitor" || form.role === "gardener" ? (
              <L label="Phone number">
                <input className="input w-full" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="e.g. 08012345678" />
              </L>
            ) : (
              <L label="Email">
                <input type="email" className="input w-full" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </L>
            )}
            <L label={form.id ? "New PIN (leave blank to keep)" : "PIN (4 digits)"}>
              <input className="input w-full" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} maxLength={4} placeholder={form.id ? "••••" : "4 digits"} />
            </L>
            <L label={form.id ? "New password (leave blank to keep)" : "Password"}>
              <input type="password" className="input w-full" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={form.id ? 0 : 6} placeholder={form.id ? "Min 6 chars" : "Min 6 chars"} />
            </L>
            {facilities.length > 0 && (
              <L label="Facility">
                <select className="input w-full" value={form.facilityId} onChange={(e) => setForm({ ...form, facilityId: e.target.value })}>
                  <option value="">None</option>
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </L>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Active
            </label>
            <div className="flex gap-2 pt-2">
              <button onClick={save} disabled={busy} className="flex-1 rounded-xl bg-sky-600 py-2 font-medium text-white disabled:opacity-60">
                {busy ? "Saving…" : "Save user"}
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
