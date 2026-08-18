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

type RestockRequest = {
  id: number;
  consumableId: number;
  consumableName: string;
  consumableUnit: string;
  quantity: number;
  supplier: string | null;
  notes: string | null;
  status: string;
  requestedByName: string | null;
  createdAt: string;
};

type UsageReportItem = {
  consumableId: number;
  name: string;
  unit: string;
  totalUsed: number;
  cost: number | null;
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

type MainTab = "inventory" | "restock" | "report";

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
  const [mainTab, setMainTab] = useState<MainTab>("inventory");

  const [restockRequests, setRestockRequests] = useState<RestockRequest[]>([]);
  const [report, setReport] = useState<UsageReportItem[]>([]);
  const [reportDays, setReportDays] = useState(7);
  const [reportTotals, setReportTotals] = useState({ itemsUsed: 0, cost: 0 });
  const [adjustModal, setAdjustModal] = useState<Consumable | null>(null);
  const [adjustStock, setAdjustStock] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/ops/consumables", { cache: "no-store" });
    const data = (await res.json()) as { consumables: Consumable[] };
    setItems(data.consumables ?? []);
  }, []);

  const loadRestock = useCallback(async () => {
    const res = await fetch("/api/ops/restock-requests", { cache: "no-store" });
    const data = (await res.json()) as { requests: RestockRequest[] };
    setRestockRequests(data.requests ?? []);
  }, []);

  const loadReport = useCallback(async () => {
    const res = await fetch(`/api/ops/consumables/usage-report?days=${reportDays}`, { cache: "no-store" });
    const data = (await res.json()) as {
      report: UsageReportItem[];
      totals: { itemsUsed: number; cost: number };
    };
    setReport(data.report ?? []);
    setReportTotals(data.totals ?? { itemsUsed: 0, cost: 0 });
  }, [reportDays]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (mainTab === "restock") loadRestock();
    if (mainTab === "report") loadReport();
  }, [mainTab, loadRestock, loadReport]);

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

  async function submitAdjust() {
    if (!adjustModal) return;
    const newStock = Number(adjustStock);
    if (!Number.isInteger(newStock) || newStock < 0) {
      setError("Stock must be a non-negative whole number");
      return;
    }
    if (!adjustReason.trim()) {
      setError("Reason is required");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/ops/consumables/${adjustModal.id}/adjust`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newStock, reason: adjustReason.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setError(d.error ?? "Adjustment failed");
      return;
    }
    setMsg("Stock adjusted.");
    setAdjustModal(null);
    setAdjustStock("");
    setAdjustReason("");
    load();
  }

  async function updateRestockStatus(id: number, status: string) {
    setBusy(true);
    const res = await fetch("/api/ops/restock-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setError(d.error ?? "Update failed");
      return;
    }
    setMsg("Request updated.");
    loadRestock();
  }

  const STATUS_COLORS: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-blue-100 text-blue-800",
    ordered: "bg-purple-100 text-purple-800",
    received: "bg-green-100 text-green-800",
    cancelled: "bg-gray-100 text-gray-500",
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-slate-200">
        {([
          { key: "inventory" as MainTab, label: "Inventory" },
          { key: "restock" as MainTab, label: `Restock (${restockRequests.length})` },
          { key: "report" as MainTab, label: "Weekly Report" },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setMainTab(t.key)}
            className={`px-4 py-2 text-sm font-medium ${
              mainTab === t.key
                ? "border-b-2 border-sky-600 text-sky-700"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {msg && (
        <p className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">{msg}</p>
      )}
      {error && (
        <p className="rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{error}</p>
      )}

      {mainTab === "inventory" && (
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
                            setAdjustModal(c);
                            setAdjustStock(String(c.currentStock));
                            setAdjustReason("");
                            setError(null);
                          }}
                          className="text-amber-600 hover:underline"
                        >
                          Adjust
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            editItem(c);
                          }}
                          className="ml-2 text-sky-600 hover:underline"
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
      )}

      {mainTab === "restock" && (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="px-4 py-3">
            <h2 className="font-semibold text-slate-900">Pending Restock Requests</h2>
          </div>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Item</th>
                <th className="px-4 py-2">Qty</th>
                <th className="px-4 py-2">Supplier</th>
                <th className="px-4 py-2">Requested by</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {restockRequests.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 font-medium text-slate-800">
                    {r.consumableName}
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    {r.quantity} {r.consumableUnit}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{r.supplier || "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{r.requestedByName || "—"}</td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 space-x-2">
                    {r.status === "pending" && (
                      <>
                        <button
                          onClick={() => updateRestockStatus(r.id, "approved")}
                          disabled={busy}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateRestockStatus(r.id, "cancelled")}
                          disabled={busy}
                          className="text-xs text-rose-600 hover:underline"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    {r.status === "approved" && (
                      <button
                        onClick={() => updateRestockStatus(r.id, "ordered")}
                        disabled={busy}
                        className="text-xs text-purple-600 hover:underline"
                      >
                        Mark Ordered
                      </button>
                    )}
                    {r.status === "ordered" && (
                      <button
                        onClick={() => updateRestockStatus(r.id, "received")}
                        disabled={busy}
                        className="text-xs text-emerald-600 hover:underline"
                      >
                        Mark Received
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {restockRequests.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                    No pending restock requests.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {mainTab === "report" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Usage Report</h2>
            <select
              className="input"
              value={reportDays}
              onChange={(e) => setReportDays(Number(e.target.value))}
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
            </select>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-slate-50 p-3 text-center">
              <p className="text-xs uppercase text-slate-500">Total items used</p>
              <p className="text-2xl font-bold text-slate-900">{reportTotals.itemsUsed}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-center">
              <p className="text-xs uppercase text-slate-500">Total cost</p>
              <p className="text-2xl font-bold text-slate-900">
                ₦{reportTotals.cost.toLocaleString()}
              </p>
            </div>
          </div>
          <table className="mt-4 min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Item</th>
                <th className="px-4 py-2">Used ({reportDays}d)</th>
                <th className="px-4 py-2">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.map((r) => (
                <tr key={r.consumableId}>
                  <td className="px-4 py-2 font-medium text-slate-800">
                    {r.name}
                    <span className="ml-1 text-xs text-slate-400">({r.unit})</span>
                  </td>
                  <td className="px-4 py-2 text-slate-700">{r.totalUsed}</td>
                  <td className="px-4 py-2 text-slate-700">
                    {r.cost != null ? `₦${r.cost.toLocaleString()}` : "—"}
                  </td>
                </tr>
              ))}
              {report.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-400">
                    No usage in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {adjustModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
            <h3 className="font-semibold text-slate-900">
              Adjust Stock — {adjustModal.name}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Current stock: {adjustModal.currentStock} {adjustModal.unit}
            </p>
            <div className="mt-4 space-y-3">
              <L label={`New stock (${adjustModal.unit})`}>
                <input
                  type="number"
                  className="input w-full"
                  value={adjustStock}
                  onChange={(e) => setAdjustStock(e.target.value)}
                  min={0}
                />
              </L>
              {adjustStock !== "" && (
                <p className={`text-sm font-medium ${Number(adjustStock) >= adjustModal.currentStock ? "text-emerald-600" : "text-rose-600"}`}>
                  {Number(adjustStock) >= adjustModal.currentStock ? "+" : ""}
                  {Number(adjustStock) - adjustModal.currentStock} {adjustModal.unit}
                </p>
              )}
              <L label="Reason (required)">
                <textarea
                  className="input w-full"
                  rows={3}
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. 5 items damaged, Counted wrong, Expired"
                />
              </L>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={submitAdjust}
                  disabled={busy}
                  className="flex-1 rounded-xl bg-sky-600 py-2 font-medium text-white disabled:opacity-60"
                >
                  {busy ? "Saving…" : "Confirm"}
                </button>
                <button
                  onClick={() => setAdjustModal(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2"
                >
                  Cancel
                </button>
              </div>
            </div>
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
