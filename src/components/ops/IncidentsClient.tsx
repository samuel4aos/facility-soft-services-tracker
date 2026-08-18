"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fileToCompressedDataUrl } from "@/lib/offline";

type IncidentPhoto = {
  id: number;
  url: string;
  photoType: string;
};

type Incident = {
  id: number;
  area: string;
  description: string | null;
  status: string;
  priority: string;
  reportedByName: string;
  assignedToName: string | null;
  assignedToId: number | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  createdAt: string;
  updatedAt: string;
  photos: IncidentPhoto[];
};

type Janitor = {
  id: number;
  name: string;
  role?: string;
};

const STATUS_TABS = ["open", "assigned", "in_progress", "resolved"] as const;

const STATUS_STYLES: Record<string, string> = {
  open: "bg-sky-100 text-sky-800",
  assigned: "bg-amber-100 text-amber-800",
  in_progress: "bg-orange-100 text-orange-800",
  resolved: "bg-emerald-100 text-emerald-800",
};

const PRIORITY_STYLES: Record<string, string> = {
  standard: "bg-slate-100 text-slate-600",
  critical: "bg-rose-100 text-rose-700 font-semibold",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function IncidentsClient() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [janitors, setJanitors] = useState<Janitor[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ops/incidents", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { incidents: Incident[] };
        setIncidents(data.incidents);
      }
    } catch {
      /* keep existing */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered =
    filter === "all"
      ? incidents
      : incidents.filter((i) => i.status === filter);

  const counts = {
    all: incidents.length,
    open: incidents.filter((i) => i.status === "open").length,
    assigned: incidents.filter((i) => i.status === "assigned").length,
    in_progress: incidents.filter((i) => i.status === "in_progress").length,
    resolved: incidents.filter((i) => i.status === "resolved").length,
  };

  async function loadJanitors() {
    try {
      const res = await fetch("/api/ops/users", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { users: Janitor[] };
        setJanitors(data.users.filter((u) => u.role === "janitor"));
      }
    } catch {
      /* ignore */
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Incidents</h1>
          <p className="text-sm text-slate-500">
            Track and resolve facility issues
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            loadJanitors();
          }}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
        >
          + Report Issue
        </button>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto">
        {(["all", ...STATUS_TABS] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm ${
              filter === f
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f === "all"
              ? "All"
              : f === "in_progress"
                ? "In Progress"
                : f.charAt(0).toUpperCase() + f.slice(1)}{" "}
            ({counts[f]})
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-12 text-center text-slate-400">Loading incidents...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center">
          <p className="text-sm text-slate-400">No incidents found</p>
          <button
            onClick={() => {
              setShowForm(true);
              loadJanitors();
            }}
            className="mt-3 text-sm text-sky-600 hover:text-sky-700"
          >
            Report an issue
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((incident) => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              onUpdated={load}
              setToast={setToast}
            />
          ))}
        </div>
      )}

      {showForm && (
        <ReportForm
          janitors={janitors}
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            load();
            setToast("Incident reported");
          }}
        />
      )}

      {toast && (
        <div className="fixed inset-x-4 bottom-6 z-40 rounded-xl bg-emerald-500 px-4 py-3 text-center text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function IncidentCard({
  incident,
  onUpdated,
  setToast,
}: {
  incident: Incident;
  onUpdated: () => void;
  setToast: (t: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const beforePhoto = incident.photos.find((p) => p.photoType === "before");

  return (
    <>
      <button
        onClick={() => setExpanded(true)}
        className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-sky-200 hover:shadow-sm"
      >
        <div className="flex items-start gap-3">
          {beforePhoto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={beforePhoto.url}
              alt="Before"
              className="h-16 w-16 shrink-0 rounded-lg object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium text-slate-900">{incident.area}</h3>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[incident.status] ?? ""}`}
              >
                {incident.status.replace("_", " ")}
              </span>
              {incident.priority === "critical" && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${PRIORITY_STYLES[incident.priority]}`}
                >
                  Critical
                </span>
              )}
            </div>
            {incident.description && (
              <p className="mt-1 truncate text-sm text-slate-500">
                {incident.description}
              </p>
            )}
            <div className="mt-2 flex items-center gap-3 text-xs text-slate-400 flex-wrap">
              <span>By {incident.reportedByName}</span>
              {incident.assignedToName && (
                <span>&rarr; {incident.assignedToName}</span>
              )}
              <span>{timeAgo(incident.createdAt)}</span>
            </div>
          </div>
          <span className="shrink-0 text-slate-300">&rsaquo;</span>
        </div>
      </button>

      {expanded && (
        <IncidentDetailSheet
          incident={incident}
          onClose={() => setExpanded(false)}
          onUpdated={onUpdated}
          setToast={setToast}
        />
      )}
    </>
  );
}

function IncidentDetailSheet({
  incident,
  onClose,
  onUpdated,
  setToast,
}: {
  incident: Incident;
  onClose: () => void;
  onUpdated: () => void;
  setToast: (t: string | null) => void;
}) {
  const [status, setStatus] = useState(incident.status);
  const [assignedToId, setAssignedToId] = useState<number | null>(
    incident.assignedToId,
  );
  const [resolutionNotes, setResolutionNotes] = useState(
    incident.resolutionNotes ?? "",
  );
  const [busy, setBusy] = useState(false);
  const beforePhoto = incident.photos.find((p) => p.photoType === "before");
  const afterPhoto = incident.photos.find((p) => p.photoType === "after");

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(`/api/ops/incidents/${incident.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, assignedToId, resolutionNotes }),
      });
      if (res.ok) {
        setToast("Updated");
        onUpdated();
        onClose();
      }
    } catch {
      setToast("Failed to update");
    }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/60" onClick={onClose}>
      <div
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-300" />

        <h2 className="text-lg font-semibold text-slate-900">{incident.area}</h2>
        {incident.description && (
          <p className="mt-1 text-sm text-slate-500">{incident.description}</p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-slate-400">
              Before
            </p>
            {beforePhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={beforePhoto.url}
                alt="Before"
                className="w-full rounded-xl object-cover"
              />
            ) : (
              <div className="flex h-32 items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-400">
                No photo
              </div>
            )}
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-slate-400">
              After
            </p>
            {afterPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={afterPhoto.url}
                alt="After"
                className="w-full rounded-xl object-cover"
              />
            ) : (
              <div className="flex h-32 items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-400">
                Pending
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Reported by</span>
            <span className="font-medium text-slate-900">
              {incident.reportedByName}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Assigned to</span>
            <span className="font-medium text-slate-900">
              {incident.assignedToName ?? "Unassigned"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Priority</span>
            <span className="font-medium text-slate-900 capitalize">
              {incident.priority}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Reported</span>
            <span className="font-medium text-slate-900">
              {timeAgo(incident.createdAt)}
            </span>
          </div>
          {incident.resolvedAt && (
            <div className="flex justify-between">
              <span className="text-slate-500">Resolved</span>
              <span className="font-medium text-slate-900">
                {timeAgo(incident.resolvedAt)}
              </span>
            </div>
          )}
          {incident.resolutionNotes && (
            <div>
              <span className="text-slate-500">Resolution notes</span>
              <p className="mt-1 font-medium text-slate-900">
                {incident.resolutionNotes}
              </p>
            </div>
          )}
        </div>

        <div className="mt-5 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"
            >
              <option value="open">Open</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Resolution Notes
            <textarea
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              rows={3}
              placeholder="Notes about resolution..."
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"
            />
          </label>
        </div>

        <button
          onClick={save}
          disabled={busy}
          className="mt-5 w-full rounded-2xl bg-sky-600 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Saving..." : "Save Changes"}
        </button>
        <button onClick={onClose} className="mt-3 w-full py-3 text-sm text-slate-400">
          Close
        </button>
      </div>
    </div>
  );
}

function ReportForm({
  janitors,
  onClose,
  onCreated,
}: {
  janitors: Janitor[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [area, setArea] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("standard");
  const [assignedToId, setAssignedToId] = useState<number | "">("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(files: FileList | null) {
    if (!files?.length) return;
    const dataUrl = await fileToCompressedDataUrl(files[0]);
    setPhoto(dataUrl);
  }

  async function submit() {
    if (!area.trim()) {
      setError("Area is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ops/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          area: area.trim(),
          description: description.trim() || undefined,
          priority,
          assignedToId: assignedToId || undefined,
          photos: photo ? [photo] : [],
        }),
      });
      if (res.ok) {
        onCreated();
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to create incident");
      }
    } catch {
      setError("Failed to create incident");
    }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/60" onClick={onClose}>
      <div
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-300" />
        <h2 className="text-lg font-semibold text-slate-900">Report Issue</h2>

        <div className="mt-4 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Area *
            <input
              type="text"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="e.g. 3rd Floor Restroom"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What needs to be fixed?"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-slate-700">
              Priority
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"
              >
                <option value="standard">Standard</option>
                <option value="critical">Critical</option>
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Assign to
              <select
                value={assignedToId}
                onChange={(e) =>
                  setAssignedToId(e.target.value ? Number(e.target.value) : "")
                }
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"
              >
                <option value="">Auto-assign</option>
                {janitors.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">
              Photo (optional)
            </p>
            <div className="flex flex-wrap gap-2">
              {photo && (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo}
                    alt="Preview"
                    className="h-24 w-24 rounded-xl object-cover"
                  />
                  <button
                    onClick={() => setPhoto(null)}
                    className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-rose-600 text-xs text-white"
                  >
                    x
                  </button>
                </div>
              )}
              {!photo && (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex h-24 w-24 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-xs text-slate-400"
                >
                  <span className="text-2xl">+</span>
                  Photo
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFile(e.target.files)}
            />
          </div>

          {error && (
            <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-600">
              {error}
            </p>
          )}
        </div>

        <button
          onClick={submit}
          disabled={busy}
          className="mt-5 w-full rounded-2xl bg-sky-600 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Submitting..." : "Report Issue"}
        </button>
        <button onClick={onClose} className="mt-3 w-full py-3 text-sm text-slate-400">
          Cancel
        </button>
      </div>
    </div>
  );
}
