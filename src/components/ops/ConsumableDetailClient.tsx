"use client";

import { useCallback, useEffect, useState } from "react";

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
  createdAt: string;
  updatedAt: string;
};

type Delivery = {
  id: number;
  quantity: number;
  supplier: string | null;
  waybillNumber: string | null;
  notes: string | null;
  receivedAt: string;
  receivedByName: string | null;
};

type UsageRecord = {
  id: number;
  quantity: number;
  area: string | null;
  notes: string | null;
  usedAt: string;
  usedByName: string | null;
};

type RestockReq = {
  id: number;
  quantity: number;
  supplier: string | null;
  notes: string | null;
  status: string;
  requestedByName: string | null;
  approvedAt: string | null;
  orderedAt: string | null;
  receivedAt: string | null;
  createdAt: string;
};

type Tab = "info" | "deliveries" | "usage" | "restock";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-blue-800",
  ordered: "bg-purple-100 text-purple-800",
  received: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-500",
};

export default function ConsumableDetailClient({
  consumableId,
}: {
  consumableId: number;
}) {
  const [item, setItem] = useState<Consumable | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [usageRecords, setUsageRecords] = useState<UsageRecord[]>([]);
  const [restockRequests, setRestockRequests] = useState<RestockReq[]>([]);
  const [tab, setTab] = useState<Tab>("info");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustStock, setAdjustStock] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  const [showRestock, setShowRestock] = useState(false);
  const [restockQty, setRestockQty] = useState("");
  const [restockSupplier, setRestockSupplier] = useState("");
  const [restockNotes, setRestockNotes] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/ops/consumables/${consumableId}`, {
      cache: "no-store",
    });
    if (!res.ok) return;
    const data = (await res.json()) as {
      consumable: Consumable;
      deliveries: Delivery[];
      usageRecords: UsageRecord[];
    };
    setItem(data.consumable);
    setDeliveries(data.deliveries);
    setUsageRecords(data.usageRecords);

    const rrRes = await fetch(`/api/ops/consumables/${consumableId}/restock`, {
      cache: "no-store",
    });
    if (rrRes.ok) {
      const rrData = (await rrRes.json()) as { requests: RestockReq[] };
      setRestockRequests(rrData.requests ?? []);
    }
  }, [consumableId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!item)
    return <p className="text-sm text-slate-500">Loading consumable…</p>;

  const c = item;

  function stockPct() {
    if (c.maxStock <= 0) return 0;
    return Math.min(100, Math.round((c.currentStock / c.maxStock) * 100));
  }

  function stockColor() {
    if (c.currentStock <= c.minStock) return "bg-rose-500";
    if (c.currentStock <= c.minStock * 1.5) return "bg-amber-500";
    return "bg-emerald-500";
  }

  function stockLabel() {
    if (c.currentStock <= c.minStock) return "Low stock";
    if (c.currentStock >= c.maxStock * 0.9) return "Full";
    return "OK";
  }

  async function addDelivery(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const quantity = Number(fd.get("quantity"));
    if (!quantity || quantity <= 0) {
      setError("Quantity must be positive");
      setBusy(false);
      return;
    }
    const res = await fetch(`/api/ops/consumables/${consumableId}/deliveries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quantity,
        supplier: String(fd.get("supplier") || "").trim() || null,
        waybillNumber: String(fd.get("waybillNumber") || "").trim() || null,
        notes: String(fd.get("notes") || "").trim() || null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setError(d.error ?? "Failed to record delivery");
      return;
    }
    setMsg(`Received ${quantity} ${c.unit}.`);
    (e.target as HTMLFormElement).reset();
    load();
  }

  async function recordUsage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const quantity = Number(fd.get("quantity"));
    if (!quantity || quantity <= 0) {
      setError("Quantity must be positive");
      setBusy(false);
      return;
    }
    const res = await fetch(`/api/ops/consumables/${consumableId}/usage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quantity,
        area: String(fd.get("area") || "").trim() || null,
        notes: String(fd.get("notes") || "").trim() || null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setError(d.error ?? "Failed to record usage");
      return;
    }
    setMsg(`Logged ${quantity} ${c.unit} used.`);
    (e.target as HTMLFormElement).reset();
    load();
  }

  async function submitAdjust() {
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
    setError(null);
    const res = await fetch(`/api/ops/consumables/${consumableId}/adjust`, {
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
    setShowAdjust(false);
    setAdjustStock("");
    setAdjustReason("");
    load();
  }

  async function submitRestock(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const quantity = Number(restockQty);
    if (!quantity || quantity <= 0) {
      setError("Quantity must be positive");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/ops/consumables/${consumableId}/restock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quantity,
        supplier: restockSupplier.trim() || null,
        notes: restockNotes.trim() || null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setError(d.error ?? "Failed to create restock request");
      return;
    }
    setMsg("Restock request submitted.");
    setShowRestock(false);
    setRestockQty("");
    setRestockSupplier("");
    setRestockNotes("");
    load();
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "info", label: "Info & Stock" },
    { key: "deliveries", label: `Deliveries (${deliveries.length})` },
    { key: "usage", label: `Usage (${usageRecords.length})` },
    { key: "restock", label: `Restock (${restockRequests.length})` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <a
          href="/dashboard/consumables"
          className="text-sm text-sky-600 hover:underline"
        >
          &larr; Back to inventory
        </a>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            c.active
              ? "bg-emerald-100 text-emerald-700"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {c.active ? "Active" : "Inactive"}
        </span>
      </div>

      {msg && (
        <p className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">{msg}</p>
      )}
      {error && (
        <p className="rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{error}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{c.name}</h2>
                <p className="text-sm text-slate-500">
                  {c.category} · {c.unit}
                  {c.location && ` · ${c.location}`}
                </p>
              </div>
              {c.unitCost != null && (
                <span className="text-sm text-slate-500">
                  ₦{c.unitCost.toLocaleString()} / {c.unit}
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Current stock
              </p>
              <p className="mt-1 text-3xl font-bold text-slate-900">
                {c.currentStock}
                <span className="text-sm font-normal text-slate-400">
                  {" "}
                  {c.unit}
                </span>
              </p>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full ${stockColor()}`}
                  style={{ width: `${stockPct()}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Min: {c.minStock} · Max: {c.maxStock}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Status
              </p>
              <p
                className={`mt-1 text-2xl font-bold ${
                  c.currentStock <= c.minStock
                    ? "text-rose-600"
                    : c.currentStock >= c.maxStock * 0.9
                      ? "text-emerald-600"
                      : "text-amber-600"
                }`}
              >
                {stockLabel()}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {c.currentStock <= c.minStock
                  ? "Reorder needed"
                  : c.currentStock >= c.maxStock * 0.9
                    ? "Well stocked"
                    : "Within range"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Stock value
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {c.unitCost != null
                  ? `₦${(c.currentStock * c.unitCost).toLocaleString()}`
                  : "—"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {c.currentStock} × {c.unitCost != null ? `₦${c.unitCost.toLocaleString()}` : "N/A"}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowAdjust(true);
                setAdjustStock(String(c.currentStock));
                setAdjustReason("");
                setError(null);
              }}
              className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100"
            >
              Adjust Stock
            </button>
            <button
              onClick={() => {
                setShowRestock(true);
                setRestockQty("");
                setRestockSupplier("");
                setRestockNotes("");
                setError(null);
              }}
              className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
            >
              Request Restock
            </button>
          </div>

          <div className="border-b border-slate-200">
            <nav className="flex gap-1">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
                    tab === t.key
                      ? "border-b-2 border-sky-600 bg-white text-sky-700"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>

          {tab === "info" && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="font-semibold text-slate-900">Details</h3>
              <dl className="mt-3 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs uppercase text-slate-500">Category</dt>
                  <dd className="font-medium text-slate-800">
                    {c.category}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">Unit</dt>
                  <dd className="font-medium text-slate-800">{c.unit}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">Location</dt>
                  <dd className="font-medium text-slate-800">
                    {c.location || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">Unit cost</dt>
                  <dd className="font-medium text-slate-800">
                    {c.unitCost != null
                      ? `₦${c.unitCost.toLocaleString()}`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">Created</dt>
                  <dd className="font-medium text-slate-800">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">Updated</dt>
                  <dd className="font-medium text-slate-800">
                    {new Date(c.updatedAt).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {tab === "deliveries" && (
            <div className="rounded-2xl border border-slate-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Qty</th>
                    <th className="px-4 py-2">Supplier</th>
                    <th className="px-4 py-2">Waybill</th>
                    <th className="px-4 py-2">Received by</th>
                    <th className="px-4 py-2">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deliveries.map((d) => (
                    <tr key={d.id}>
                      <td className="px-4 py-2 text-slate-600">
                        {new Date(d.receivedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 font-medium text-slate-800">
                        +{d.quantity} {c.unit}
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {d.supplier || "—"}
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {d.waybillNumber || "—"}
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {d.receivedByName || "—"}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-500">
                        {d.notes || "—"}
                      </td>
                    </tr>
                  ))}
                  {deliveries.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-sm text-slate-400"
                      >
                        No deliveries recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === "usage" && (
            <div className="rounded-2xl border border-slate-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Qty</th>
                    <th className="px-4 py-2">Area</th>
                    <th className="px-4 py-2">Used by</th>
                    <th className="px-4 py-2">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usageRecords.map((u) => (
                    <tr key={u.id}>
                      <td className="px-4 py-2 text-slate-600">
                        {new Date(u.usedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 font-medium text-rose-600">
                        -{u.quantity} {c.unit}
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {u.area || "—"}
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {u.usedByName || "—"}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-500">
                        {u.notes || "—"}
                      </td>
                    </tr>
                  ))}
                  {usageRecords.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-sm text-slate-400"
                      >
                        No usage recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === "restock" && (
            <div className="rounded-2xl border border-slate-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Qty</th>
                    <th className="px-4 py-2">Supplier</th>
                    <th className="px-4 py-2">Requested by</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {restockRequests.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2 text-slate-600">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 font-medium text-slate-800">
                        {r.quantity} {c.unit}
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {r.supplier || "—"}
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {r.requestedByName || "—"}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-500">
                        {r.notes || "—"}
                      </td>
                    </tr>
                  ))}
                  {restockRequests.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-sm text-slate-400"
                      >
                        No restock requests.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="font-semibold text-slate-900">Record delivery</h3>
            <form onSubmit={addDelivery} className="mt-3 space-y-3">
              <L label={`Quantity (${c.unit})`}>
                <input
                  name="quantity"
                  type="number"
                  min={1}
                  required
                  className="input w-full"
                />
              </L>
              <L label="Supplier">
                <input
                  name="supplier"
                  className="input w-full"
                  placeholder="Optional"
                />
              </L>
              <L label="Waybill number">
                <input
                  name="waybillNumber"
                  className="input w-full"
                  placeholder="Optional"
                />
              </L>
              <L label="Notes">
                <input
                  name="notes"
                  className="input w-full"
                  placeholder="Optional"
                />
              </L>
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-emerald-600 py-2 font-medium text-white disabled:opacity-60"
              >
                {busy ? "Saving…" : "Record delivery"}
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="font-semibold text-slate-900">Record usage</h3>
            <p className="text-xs text-slate-500">
              Available: {c.currentStock} {c.unit}
            </p>
            <form onSubmit={recordUsage} className="mt-3 space-y-3">
              <L label={`Quantity (${c.unit})`}>
                <input
                  name="quantity"
                  type="number"
                  min={1}
                  max={c.currentStock}
                  required
                  className="input w-full"
                />
              </L>
              <L label="Area / Zone">
                <input
                  name="area"
                  className="input w-full"
                  placeholder="e.g. Floor 3, Lobby"
                />
              </L>
              <L label="Notes">
                <input
                  name="notes"
                  className="input w-full"
                  placeholder="Optional"
                />
              </L>
              <button
                type="submit"
                disabled={busy || c.currentStock === 0}
                className="w-full rounded-xl bg-amber-600 py-2 font-medium text-white disabled:opacity-60"
              >
                {busy ? "Saving…" : "Record usage"}
              </button>
            </form>
          </div>
        </div>
      </div>

      {showAdjust && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
            <h3 className="font-semibold text-slate-900">Adjust Stock</h3>
            <p className="mt-1 text-sm text-slate-500">
              Current stock: {c.currentStock} {c.unit}
            </p>
            <div className="mt-4 space-y-3">
              <L label={`New stock (${c.unit})`}>
                <input
                  type="number"
                  className="input w-full"
                  value={adjustStock}
                  onChange={(e) => setAdjustStock(e.target.value)}
                  min={0}
                />
              </L>
              {adjustStock !== "" && (
                <p className={`text-sm font-medium ${Number(adjustStock) >= c.currentStock ? "text-emerald-600" : "text-rose-600"}`}>
                  {Number(adjustStock) >= c.currentStock ? "+" : ""}
                  {Number(adjustStock) - c.currentStock} {c.unit}
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
                  onClick={() => setShowAdjust(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRestock && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
            <h3 className="font-semibold text-slate-900">Request Restock</h3>
            <form onSubmit={submitRestock} className="mt-4 space-y-3">
              <L label={`Quantity to order (${c.unit})`}>
                <input
                  type="number"
                  className="input w-full"
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  min={1}
                  required
                />
              </L>
              <L label="Supplier name">
                <input
                  className="input w-full"
                  value={restockSupplier}
                  onChange={(e) => setRestockSupplier(e.target.value)}
                  placeholder="Optional"
                />
              </L>
              <L label="Notes">
                <textarea
                  className="input w-full"
                  rows={3}
                  value={restockNotes}
                  onChange={(e) => setRestockNotes(e.target.value)}
                  placeholder="Optional"
                />
              </L>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 rounded-xl bg-emerald-600 py-2 font-medium text-white disabled:opacity-60"
                >
                  {busy ? "Submitting…" : "Submit Request"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRestock(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2"
                >
                  Cancel
                </button>
              </div>
            </form>
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
