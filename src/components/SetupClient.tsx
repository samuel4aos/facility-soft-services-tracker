"use client";

import { useEffect, useState } from "react";

type FormState = {
  facilityName: string;
  facilityAddress: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
};

export default function SetupClient() {
  const [checking, setChecking] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [form, setForm] = useState<FormState>({
    facilityName: "",
    facilityAddress: "",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/setup")
      .then((r) => r.json())
      .then((d: { needsSetup: boolean }) => {
        setNeedsSetup(d.needsSetup);
        setChecking(false);
      })
      .catch(() => {
        setNeedsSetup(true);
        setChecking(false);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Setup failed");
        setBusy(false);
        return;
      }
      window.location.href = "/dashboard";
    } catch {
      setError("Network error");
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-950 text-slate-100">
        <p className="text-slate-400">Checking system status…</p>
      </main>
    );
  }

  if (!needsSetup) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-950 text-slate-100">
        <div className="text-center">
          <p className="text-slate-400">System is already configured.</p>
          <a href="/login" className="mt-4 inline-block text-sky-400 hover:underline">
            Go to login
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-4 py-10 text-slate-100">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-500">
            First-time setup
          </p>
          <h1 className="mt-2 text-3xl font-bold">Welcome to Soft Services Tracker</h1>
          <p className="mt-2 text-sm text-slate-400">
            Create your facility and super admin account to get started.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-slate-900 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            Facility details
          </h2>
          <label className="block text-xs text-slate-400">
            Facility name *
            <input
              required
              value={form.facilityName}
              onChange={(e) => setForm({ ...form, facilityName: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white"
              placeholder="e.g. Lagos Data Centre — Ikeja Campus"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Address
            <input
              value={form.facilityAddress}
              onChange={(e) => setForm({ ...form, facilityAddress: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white"
              placeholder="e.g. 12 Kudirat Abiola Way, Ikeja, Lagos"
            />
          </label>

          <div className="border-t border-slate-800 pt-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
              Super admin account
            </h2>
          </div>
          <label className="block text-xs text-slate-400">
            Full name *
            <input
              required
              value={form.adminName}
              onChange={(e) => setForm({ ...form, adminName: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Email *
            <input
              required
              type="email"
              value={form.adminEmail}
              onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Password * (min 6 characters)
            <input
              required
              type="password"
              minLength={6}
              value={form.adminPassword}
              onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white"
            />
          </label>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-sky-500 py-3 font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Setting up…" : "Create facility & admin"}
          </button>
        </form>
      </div>
    </main>
  );
}
