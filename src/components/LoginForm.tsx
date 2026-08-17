"use client";

import { useState } from "react";

type Candidate = { id: number; name: string; role: string };

export default function LoginForm({ initialMode }: { initialMode: "pin" | "password" }) {
  const [mode, setMode] = useState<"pin" | "password">(initialMode);
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);

  async function loginWithPin(pinValue: string) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "pin", pin: pinValue }),
    });
    setBusy(false);

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Login failed");
      setPin("");
      return;
    }

    const data = (await res.json()) as {
      user?: { role: string };
      candidates?: Candidate[];
    };

    if (data.candidates) {
      setCandidates(data.candidates);
      return;
    }

    window.location.href = data.user!.role === "janitor" ? "/app" : "/dashboard";
  }

  async function pickUser(userId: number) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "pin", pin, userId }),
    });
    setBusy(false);

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Login failed");
      setCandidates(null);
      setPin("");
      return;
    }

    const data = (await res.json()) as { user: { role: string } };
    window.location.href = data.user.role === "janitor" ? "/app" : "/dashboard";
  }

  function press(d: string) {
    setError(null);
    if (d === "del") return setPin((p) => p.slice(0, -1));
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      loginWithPin(next);
    }
  }

  async function loginWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "password", email, password }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Login failed");
      return;
    }
    const data = (await res.json()) as { user: { role: string } };
    window.location.href = data.user.role === "janitor" ? "/app" : "/dashboard";
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-4 py-10 text-slate-100">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-bold">Soft Services Tracker</h1>
        <p className="mt-1 text-center text-sm text-slate-400">
          {mode === "pin" ? "Enter your PIN to sign in" : "Operations team sign in"}
        </p>

        <div className="mt-6 flex rounded-xl bg-slate-900 p-1">
          {(["pin", "password"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError(null);
                setCandidates(null);
                setPin("");
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-medium ${
                mode === m ? "bg-sky-500 text-white" : "text-slate-400"
              }`}
            >
              {m === "pin" ? "Janitor" : "Ops team"}
            </button>
          ))}
        </div>

        {mode === "pin" ? (
          <div className="mt-6">
            {candidates ? (
              <>
                <p className="mb-4 text-center text-sm text-slate-300">
                  Who are you?
                </p>
                <div className="space-y-3">
                  {candidates.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => pickUser(c.id)}
                      disabled={busy}
                      className="w-full rounded-2xl border-2 border-slate-700 bg-slate-900 py-4 text-lg font-semibold active:scale-[0.98] disabled:opacity-60"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => {
                    setCandidates(null);
                    setPin("");
                  }}
                  className="mt-4 w-full py-3 text-sm text-slate-400"
                >
                  Back
                </button>
              </>
            ) : (
              <>
                <div className="flex justify-center gap-3">
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={`h-4 w-4 rounded-full ${
                        pin.length > i ? "bg-sky-400" : "bg-slate-700"
                      }`}
                    />
                  ))}
                </div>
                <div className="mt-6 grid grid-cols-3 gap-3">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map(
                    (d, i) =>
                      d === "" ? (
                        <span key={i} />
                      ) : (
                        <button
                          key={i}
                          onClick={() => press(d)}
                          disabled={busy}
                          className="rounded-2xl bg-slate-900 py-5 text-xl font-semibold active:bg-slate-800 disabled:opacity-50"
                        >
                          {d === "del" ? "⌫" : d}
                        </button>
                      ),
                  )}
                </div>
                <p className="mt-4 text-center text-xs text-slate-500">
                  Enter your 4-digit PIN. Contact your administrator if you don&apos;t have one.
                </p>
              </>
            )}
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={loginWithPassword}>
            <label className="block text-sm text-slate-300">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3"
              />
            </label>
            <label className="block text-sm text-slate-300">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3"
              />
            </label>
            <button
              disabled={busy}
              className="w-full rounded-xl bg-sky-500 py-3 font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <p className="text-center text-xs text-slate-500">
              Contact your administrator for login credentials.
            </p>
          </form>
        )}

        {error && <p className="mt-4 text-center text-sm text-rose-400">{error}</p>}
      </div>
    </main>
  );
}
