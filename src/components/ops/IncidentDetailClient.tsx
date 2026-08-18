"use client";

import { useCallback, useEffect, useState } from "react";

type IncidentPhoto = {
  id: number;
  incidentId: number;
  uploadedBy: number;
  photoType: string;
  url: string;
  storageKey: string;
  uploadedAt: string;
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

const STATUS_STYLES: Record<string, string> = {
  open: "bg-sky-100 text-sky-800",
  assigned: "bg-amber-100 text-amber-800",
  in_progress: "bg-orange-100 text-orange-800",
  resolved: "bg-emerald-100 text-emerald-800",
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

export default function IncidentDetailClient({ id }: { id: number }) {
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/ops/incidents/${id}`, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { incident: Incident };
        setIncident(data.incident);
      }
    } catch {
      /* keep existing */
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p className="py-12 text-center text-slate-400">Loading...</p>;
  }

  if (!incident) {
    return <p className="py-12 text-center text-slate-400">Incident not found</p>;
  }

  const beforePhoto = incident.photos.find((p) => p.photoType === "before");
  const afterPhoto = incident.photos.find((p) => p.photoType === "after");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">{incident.area}</h1>
        <div className="mt-2 flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[incident.status] ?? ""}`}
          >
            {incident.status.replace("_", " ")}
          </span>
          {incident.priority === "critical" && (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
              Critical
            </span>
          )}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-slate-400">
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
            <div className="flex h-40 items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-400">
              No photo
            </div>
          )}
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-slate-400">
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
            <div className="flex h-40 items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-400">
              Pending resolution
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3 rounded-xl bg-white p-4 text-sm shadow-sm">
        {incident.description && (
          <div>
            <p className="text-xs font-semibold uppercase text-slate-400">
              Description
            </p>
            <p className="mt-1 text-slate-700">{incident.description}</p>
          </div>
        )}
        <div className="flex justify-between border-t border-slate-100 pt-3">
          <span className="text-slate-500">Reported by</span>
          <span className="font-medium text-slate-900">
            {incident.reportedByName}
          </span>
        </div>
        <div className="flex justify-between border-t border-slate-100 pt-3">
          <span className="text-slate-500">Assigned to</span>
          <span className="font-medium text-slate-900">
            {incident.assignedToName ?? "Unassigned"}
          </span>
        </div>
        <div className="flex justify-between border-t border-slate-100 pt-3">
          <span className="text-slate-500">Reported</span>
          <span className="font-medium text-slate-900">
            {timeAgo(incident.createdAt)}
          </span>
        </div>
        {incident.resolvedAt && (
          <div className="flex justify-between border-t border-slate-100 pt-3">
            <span className="text-slate-500">Resolved</span>
            <span className="font-medium text-slate-900">
              {timeAgo(incident.resolvedAt)}
            </span>
          </div>
        )}
        {incident.resolutionNotes && (
          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold uppercase text-slate-400">
              Resolution Notes
            </p>
            <p className="mt-1 text-slate-700">{incident.resolutionNotes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
