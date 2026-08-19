"use client";

import { useEffect, useState } from "react";

type Profile = {
  id: number;
  name: string;
  role: string;
  phone: string | null;
  email: string | null;
};

export default function SettingsClient() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/profile", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { user: Profile }) => {
        setProfile(d.user);
        setName(d.user.name);
        setPhone(d.user.phone ?? "");
        setEmail(d.user.email ?? "");
      })
      .catch(() => {});
  }, []);

  async function saveProfile() {
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, email }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setError(d.error ?? "Update failed");
      return;
    }
    setMsg("Profile updated.");
  }

  async function changePin() {
    if (!newPin || !/^\d{4}$/.test(newPin)) {
      setError("PIN must be exactly 4 digits.");
      return;
    }
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPin, newPin }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setError(d.error ?? "PIN change failed");
      return;
    }
    setMsg("PIN changed successfully.");
    setCurrentPin("");
    setNewPin("");
  }

  async function changePassword() {
    if (!newPassword || newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setError(d.error ?? "Password change failed");
      return;
    }
    setMsg("Password changed successfully.");
    setCurrentPassword("");
    setNewPassword("");
  }

  if (!profile) {
    return <p className="text-slate-500">Loading profile…</p>;
  }

  const isJanitorOrGardener = profile.role === "janitor" || profile.role === "gardener";

  return (
    <div className="space-y-6 max-w-xl">
      {msg && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</p>}
      {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Profile</h2>
        <p className="text-xs text-slate-500 mt-1">Role: <span className="uppercase tracking-wide font-medium">{profile.role.replace("_", " ")}</span></p>
        <div className="mt-4 space-y-3">
          <L label="Name">
            <input className="input w-full" value={name} onChange={(e) => setName(e.target.value)} />
          </L>
          {isJanitorOrGardener ? (
            <L label="Phone">
              <input className="input w-full" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </L>
          ) : (
            <L label="Email">
              <input type="email" className="input w-full" value={email} onChange={(e) => setEmail(e.target.value)} />
            </L>
          )}
          <button onClick={saveProfile} disabled={busy} className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {busy ? "Saving…" : "Save profile"}
          </button>
        </div>
      </div>

      {isJanitorOrGardener ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Change PIN</h2>
          <div className="mt-4 space-y-3">
            <L label="Current PIN">
              <input className="input w-full" type="password" maxLength={4} value={currentPin} onChange={(e) => setCurrentPin(e.target.value)} />
            </L>
            <L label="New PIN (4 digits)">
              <input className="input w-full" maxLength={4} value={newPin} onChange={(e) => setNewPin(e.target.value)} />
            </L>
            <button onClick={changePin} disabled={busy} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              Change PIN
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Change Password</h2>
          <div className="mt-4 space-y-3">
            <L label="Current password">
              <input type="password" className="input w-full" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </L>
            <L label="New password (min 6 chars)">
              <input type="password" className="input w-full" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </L>
            <button onClick={changePassword} disabled={busy} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              Change password
            </button>
          </div>
        </div>
      )}
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
