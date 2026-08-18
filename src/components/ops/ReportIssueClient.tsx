"use client";

import { useRef, useState } from "react";
import { fileToCompressedDataUrl } from "@/lib/offline";
import type { SessionUser } from "@/lib/auth";

const AREAS = [
  "Male Restroom",
  "Female Restroom",
  "Server Room",
  "Kitchen/Break Room",
  "Reception",
  "Compound",
  "Garden/Grounds",
  "Parking Lot",
  "Staircase",
  "Generator Room",
  "UPS Room",
  "AC Plant Room",
  "Other",
] as const;

const AREA_ICONS: Record<string, string> = {
  "Male Restroom": "🚻",
  "Female Restroom": "🚺",
  "Server Room": "🖥️",
  "Kitchen/Break Room": "🍳",
  Reception: "🏢",
  Compound: "🏗️",
  "Garden/Grounds": "🌿",
  "Parking Lot": "🅿️",
  Staircase: "🪜",
  "Generator Room": "⚡",
  "UPS Room": "🔋",
  "AC Plant Room": "❄️",
  Other: "📝",
};

export default function ReportIssueClient({ user }: { user: SessionUser }) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [customArea, setCustomArea] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"standard" | "critical">("standard");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const effectiveArea =
    selectedArea === "Other" ? customArea.trim() : selectedArea;

  async function handleFile(files: FileList | null) {
    if (!files?.length) return;
    const dataUrl = await fileToCompressedDataUrl(files[0]);
    setPhoto(dataUrl);
  }

  async function submit() {
    if (!effectiveArea) {
      setError("Please select an area");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ops/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          area: effectiveArea,
          description: description.trim() || undefined,
          priority,
          photos: photo ? [photo] : [],
        }),
      });
      if (res.ok) {
        setToast("Issue reported, janitor notified");
        resetForm();
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to report issue");
      }
    } catch {
      setError("Failed to report issue. Check your connection.");
    }
    setBusy(false);
  }

  function resetForm() {
    setPhoto(null);
    setSelectedArea(null);
    setCustomArea("");
    setDescription("");
    setPriority("standard");
  }

  return (
    <div className="min-h-dvh bg-slate-950 pb-28 text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-900/95 px-4 pb-3 pt-5 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Super Admin
            </p>
            <h1 className="text-xl font-semibold">Report Untidy Area</h1>
          </div>
          <a
            href="/dashboard"
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300"
          >
            Back
          </a>
        </div>
      </header>

      <main className="space-y-6 px-4 pt-6">
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            1. Photo
          </p>
          {photo ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo}
                alt="Captured"
                className="w-full rounded-2xl object-cover"
                style={{ maxHeight: "50dvh" }}
              />
              <button
                onClick={() => setPhoto(null)}
                className="absolute right-3 top-3 rounded-full bg-black/60 px-4 py-2 text-sm font-medium text-white backdrop-blur"
              >
                Retake
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900 py-16 text-slate-400 active:bg-slate-800"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-12 w-12"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"
                />
              </svg>
              <span className="text-sm font-medium">Tap to take photo</span>
              <span className="text-xs text-slate-500">
                Optional but recommended
              </span>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFile(e.target.files)}
          />
        </section>

        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            2. Area *
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {AREAS.map((area) => {
              const active = selectedArea === area;
              return (
                <button
                  key={area}
                  onClick={() => setSelectedArea(area)}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-3 text-center text-xs font-medium transition-colors ${
                    active
                      ? "border-sky-500 bg-sky-500/15 text-sky-300"
                      : "border-slate-800 bg-slate-900 text-slate-400"
                  }`}
                >
                  <span className="text-lg">{AREA_ICONS[area]}</span>
                  <span className="leading-tight">{area}</span>
                </button>
              );
            })}
          </div>
          {selectedArea === "Other" && (
            <input
              type="text"
              value={customArea}
              onChange={(e) => setCustomArea(e.target.value)}
              placeholder="Specify area..."
              className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-sm text-white placeholder:text-slate-500"
              autoFocus
            />
          )}
        </section>

        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            3. Note (optional)
          </p>
          <div className="relative">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="What needs attention?"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-sm text-white placeholder:text-slate-500"
            />
            <span className="absolute bottom-2 right-3 text-[11px] text-slate-500">
              {description.length}/500
            </span>
          </div>
        </section>

        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            4. Priority
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPriority("standard")}
              className={`flex-1 rounded-xl border-2 py-3 text-sm font-medium transition-colors ${
                priority === "standard"
                  ? "border-sky-500 bg-sky-500/15 text-sky-300"
                  : "border-slate-800 bg-slate-900 text-slate-400"
              }`}
            >
              Standard
            </button>
            <button
              onClick={() => setPriority("critical")}
              className={`flex-1 rounded-xl border-2 py-3 text-sm font-medium transition-colors ${
                priority === "critical"
                  ? "border-rose-500 bg-rose-500/15 text-rose-300"
                  : "border-slate-800 bg-slate-900 text-slate-400"
              }`}
            >
              Critical
            </button>
          </div>
        </section>

        {error && (
          <div className="rounded-xl bg-rose-500/15 p-3 text-sm text-rose-300">
            {error}
          </div>
        )}

        <button
          onClick={submit}
          disabled={busy || !effectiveArea}
          className="w-full rounded-2xl bg-emerald-500 py-4 text-base font-semibold text-white active:bg-emerald-600 disabled:opacity-40"
        >
          {busy ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="h-5 w-5 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Submitting...
            </span>
          ) : (
            "Report Issue"
          )}
        </button>
      </main>

      {toast && (
        <div className="fixed inset-x-4 bottom-6 z-40 rounded-xl bg-emerald-500 px-4 py-3 text-center text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
