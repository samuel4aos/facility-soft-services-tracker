"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Consumable = {
  id: number;
  facilityId: number;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  unitCost: number | null;
  location: string | null;
  active: boolean;
  lowStock: boolean;
  createdAt: string;
  updatedAt: string;
};

type FormState = {
  id?: number;
  name: string;
  category: string;
  unit: string;
  currentStock: string;
  minStock: string;
  maxStock: string;
  unitCost: string;
  location: string;
};

const EMPTY: FormState = {
  name: "",
  category: "general",
  unit: "pcs",
  currentStock: "0",
  minStock: "10",
  maxStock: "100",
  unitCost: "",
  location: "",
};

const CATEGORIES = [
  "general",
  "cleaning",
  "hygiene",
  "paper",
  "chemical",
  "safety",
  "maintenance",
];

export default function ConsumablesClient() {
  const router = useRouter();
  const [items, setItems] = useState<Consumable[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [showInactive, setShowInactive] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/ops/consumables", { cache: "no-store" });
    const data = (await res.json()) as { consumables: Consumable[] };
    setItems(data.consumables ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = items.filter((c) => {
    if (!showInactive && !c.active) return false;
    if (catFilter !== "all" && c.category !== catFilter) return false;
    if (
      search &&
      !c.name.toLowerCase().includes(search.toLowerCase()) &&
      !(c.location ?? "").toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  const lowStockItems = items.filter(
    (c) => c.active && c.currentStock <= c.minStock,
  );

  async function save() {
    if (!form) return;
    setBusy(true);
    setError(null);

    const payload: Record<string, unknown> = {
      name: form.name,
      category: form.category,
      unit: form.unit,
      currentStock: Number(form.currentStock) || 0,
      minStock: Number(form.minStock) || 0,
      maxStock: Number(form.maxStock) || 100,
      unitCost: form.unitCost ? Number(form.unitCost) : null,
      location: form.location || null,
    };

    const res = await fetch(
      form.id ? `/api/ops/consumables/${form.id}` : "/api/ops/consumables",
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

    setMsg(form.id ? "Item updated." : "Item created.");
    setForm(null);
    load();
  }

  async function deactivate(id: number) {
    if (!confirm("Deactivate this consumable?")) return;
    await fetch(`/api/ops/consumables/${id}`, { method: "DELETE" });
    load();
  }

  function editItem(c: Consumable) {
    setForm({
      id: c.id,
      name: c.name,
      category: c.category,
      unit: c.unit,
      currentStock: String(c.currentStock),
      minStock: String(c.minStock),
      maxStock: String(c.maxStock),
      unitCost: c.unitCost != null ? String(c.unitCost) : "",
      location: c.location ?? "",
    });
    setMsg(null);
    setError(null);
  }

  function stockPct(c: Consumable) {
    if (c.maxStock <= 0) return 0;
    return Math.min(100, Math.round((c.currentStock / c.maxStock) * 100));
  }

  function stockColor(c: Consumable) {
    if (c.currentStock <= c.minStock) return "bg-rose-500";
    if (c.currentStock <= c.minStock * 1.5) return "bg-amber-500";
    return "bg-emerald-500";
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-4">
        {lowStockItems.length > 0 && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <h3 className="text-sm font-semibold text-rose-800">
              Low Stock Alert — {lowStockItems.length} item{lowStockItems.length !== 1 && "s"}
            </h3>
            <div className="mt-2 space-y-1">
              {lowStockItems.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between text-sm text-rose-700"
                >
                  <span>
                    {c.name} — {c.currentStock} {c.unit} remaining
                  </span>
                  <span className="text-xs text-rose-500">
                    min: {c.minStock}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3">
            <h2 className="font-semibold text-slate-900">
              Inventory ({filtered.length})
            </h2>
            <input
              className="input w-48"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="input"
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
            >
              <option value="all">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-xs text-slate-500">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Show inactive
            </label>
            <button
              onClick={() => {
                setForm({ ...EMPTY });
                setMsg(null);
                setError(null);
              }}
              className="ml-auto rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white"
            >
              + New item
            </button>
          </div>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Stock</th>
                <th className="px-4 py-2">Location</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className={`${!c.active ? "opacity-50" : ""} ${
                    c.active && c.currentStock <= c.minStock
                      ? "bg-rose-50/50"
                      : ""
                  } cursor-pointer hover:bg-slate-50`}
                  onClick={() => router.push(`/dashboard/consumables/${c.id}`)}
                >
                  <td className="px-4 py-2">
                    <span className="font-medium text-slate-800">{c.name}</span>
                    <span className="ml-1 text-xs text-slate-400">
                      ({c.unit})
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {c.category}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full ${stockColor(c)}`}
                          style={{ width: `${stockPct(c)}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-600">
                        {c.currentStock}/{c.maxStock}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {c.location || "—"}
                  </td>
                  <td className="px-4 py-2">
                    {c.active ? (
                      c.currentStock <= c.minStock ? (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                          Low stock
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          OK
                        </span>
                      )
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        editItem(c);
                      }}
                      className="text-sky-600 hover:underline"
                    >
                      Edit
                    </button>
                    {c.active && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deactivate(c.id);
                        }}
                        className="ml-2 text-rose-600 hover:underline"
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-slate-400"
                  >
                    No consumables found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        {msg && (
          <p className="mb-3 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">
            {msg}
          </p>
        )}
        {error && (
          <p className="mb-3 rounded-lg bg-rose-50 p-2 text-sm text-rose-700">
            {error}
          </p>
        )}
        {!form ? (
          <p className="text-sm text-slate-500">
            Select an item to edit, or create a new one.
          </p>
        ) : (
          <div className="space-y-3">
            <h2 className="font-semibold text-slate-900">
              {form.id ? "Edit item" : "New item"}
            </h2>
            <L label="Name">
              <input
                className="input w-full"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </L>
            <L label="Category">
              <select
                className="input w-full"
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value })
                }
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </L>
            <L label="Unit">
              <input
                className="input w-full"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                placeholder="pcs, rolls, liters…"
              />
            </L>
            <div className="grid grid-cols-3 gap-3">
              <L label="Current stock">
                <input
                  type="number"
                  className="input w-full"
                  value={form.currentStock}
                  onChange={(e) =>
                    setForm({ ...form, currentStock: e.target.value })
                  }
                  min={0}
                />
              </L>
              <L label="Min stock">
                <input
                  type="number"
                  className="input w-full"
                  value={form.minStock}
                  onChange={(e) =>
                    setForm({ ...form, minStock: e.target.value })
                  }
                  min={0}
                />
              </L>
              <L label="Max stock">
                <input
                  type="number"
                  className="input w-full"
                  value={form.maxStock}
                  onChange={(e) =>
                    setForm({ ...form, maxStock: e.target.value })
                  }
                  min={0}
                />
              </L>
            </div>
            <L label="Unit cost (optional)">
              <input
                type="number"
                step="0.01"
                className="input w-full"
                value={form.unitCost}
                onChange={(e) =>
                  setForm({ ...form, unitCost: e.target.value })
                }
                placeholder="0.00"
              />
            </L>
            <L label="Location">
              <input
                className="input w-full"
                value={form.location}
                onChange={(e) =>
                  setForm({ ...form, location: e.target.value })
                }
                placeholder="e.g. Store room, Floor 2"
              />
            </L>
            <div className="flex gap-2 pt-2">
              <button
                onClick={save}
                disabled={busy}
                className="flex-1 rounded-xl bg-sky-600 py-2 font-medium text-white disabled:opacity-60"
              >
                {busy ? "Saving…" : "Save item"}
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
