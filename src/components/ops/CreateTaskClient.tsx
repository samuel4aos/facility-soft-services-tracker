"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Janitor = {
  id: number;
  name: string;
  phone: string | null;
  role: string;
};

export default function CreateTaskClient() {
  const router = useRouter();
  const [janitors, setJanitors] = useState<Janitor[]>([]);
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("standard");
  const [requiresPhoto, setRequiresPhoto] = useState(true);
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ops/users")
      .then((r) => r.json())
      .then((d: { users?: Janitor[] }) =>
        setJanitors(
          (d.users ?? []).filter(
            (u) => u.role === "janitor",
          ),
        ),
      )
      .catch(() => {});
  }, []);

  const toggle = useCallback((id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Task name is required");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/ops/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          area: area.trim() || undefined,
          instructions: instructions.trim() || undefined,
          dueDate: dueDate || undefined,
          priority,
          requiresPhoto,
          assignedTo: selected,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to create task");
        return;
      }
      router.push("/dashboard/tasks");
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <div>
        <label className="block text-sm font-medium text-slate-700">
          Task Name *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Deep clean reception area"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">
          Area / Location
        </label>
        <input
          type="text"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          placeholder="e.g. Ground floor reception"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">
          Instructions
        </label>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={3}
          placeholder="What needs to be done..."
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Due Date
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Priority
          </label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none"
          >
            <option value="standard">Standard</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="requiresPhoto"
          checked={requiresPhoto}
          onChange={(e) => setRequiresPhoto(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
        />
        <label htmlFor="requiresPhoto" className="text-sm text-slate-700">
          Requires photo proof
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Assign to Janitors ({selected.length} selected)
        </label>
        <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
          {janitors.map((j) => (
            <label
              key={j.id}
              className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 ${
                selected.includes(j.id) ? "bg-sky-50" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={selected.includes(j.id)}
                onChange={() => toggle(j.id)}
                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <div>
                <p className="text-sm font-medium text-slate-900">{j.name}</p>
                {j.phone && (
                  <p className="text-xs text-slate-500">{j.phone}</p>
                )}
              </div>
            </label>
          ))}
          {janitors.length === 0 && (
            <p className="px-3 py-4 text-center text-sm text-slate-400">
              No janitors found
            </p>
          )}
        </div>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => setSelected(janitors.map((j) => j.id))}
            className="text-xs text-sky-600 hover:text-sky-700"
          >
            Select all
          </button>
          <span className="text-slate-300">|</span>
          <button
            type="button"
            onClick={() => setSelected([])}
            className="text-xs text-slate-500 hover:text-slate-600"
          >
            Clear
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
        >
          {busy ? "Creating..." : "Create Task"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
