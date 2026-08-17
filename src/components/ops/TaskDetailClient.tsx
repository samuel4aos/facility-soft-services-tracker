"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Photo = {
  id: number;
  url: string;
  uploadedAt: string;
  uploadedByName: string;
};

type Assignee = {
  userId: number;
  userName: string;
};

type Task = {
  id: number;
  name: string;
  area: string | null;
  instructions: string | null;
  dueDate: string | null;
  priority: string;
  status: string;
  requiresPhoto: boolean;
  completedAt: string | null;
  completionNotes: string | null;
  createdAt: string;
  createdByName: string | null;
};

function fmtDate(iso: string | null) {
  if (!iso) return "No due date";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TaskDetailClient({ taskId }: { taskId: number }) {
  const router = useRouter();
  const [task, setTask] = useState<Task | null>(null);
  const [assignedTo, setAssignedTo] = useState<Assignee[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/ops/tasks/${taskId}/detail`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setTask(data.task);
        setAssignedTo(data.assignedTo ?? []);
        setPhotos(data.photos ?? []);
      }
    } catch {
      /* keep */
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateStatus(status: string) {
    setBusy(true);
    await fetch(`/api/ops/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
    setBusy(false);
  }

  async function deleteTask() {
    if (!confirm("Delete this task?")) return;
    setBusy(true);
    await fetch(`/api/ops/tasks/${taskId}`, { method: "DELETE" });
    router.push("/dashboard/tasks");
  }

  if (loading) {
    return (
      <p className="py-12 text-center text-slate-400">Loading task...</p>
    );
  }
  if (!task) {
    return (
      <p className="py-12 text-center text-slate-400">Task not found</p>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{task.name}</h1>
          {task.area && (
            <p className="mt-1 text-sm text-slate-500">{task.area}</p>
          )}
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            task.status === "completed"
              ? "bg-emerald-100 text-emerald-800"
              : task.status === "cancelled"
                ? "bg-slate-100 text-slate-500"
                : task.status === "in_progress"
                  ? "bg-sky-100 text-sky-800"
                  : "bg-amber-100 text-amber-800"
          }`}
        >
          {task.status.replace("_", " ")}
        </span>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-400 uppercase">Due Date</p>
            <p className="font-medium text-slate-900">
              {fmtDate(task.dueDate)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase">Priority</p>
            <p
              className={`font-medium ${
                task.priority === "urgent"
                  ? "text-rose-600"
                  : "text-slate-900"
              }`}
            >
              {task.priority === "urgent" ? "Urgent" : "Standard"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase">Created By</p>
            <p className="font-medium text-slate-900">
              {task.createdByName}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase">Photo Required</p>
            <p className="font-medium text-slate-900">
              {task.requiresPhoto ? "Yes" : "No"}
            </p>
          </div>
        </div>

        {task.instructions && (
          <div>
            <p className="text-xs text-slate-400 uppercase mb-1">
              Instructions
            </p>
            <p className="text-sm text-slate-700">{task.instructions}</p>
          </div>
        )}

        <div>
          <p className="text-xs text-slate-400 uppercase mb-1">
            Assigned To
          </p>
          {assignedTo.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {assignedTo.map((a) => (
                <span
                  key={a.userId}
                  className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
                >
                  {a.userName}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">Unassigned</p>
          )}
        </div>
      </div>

      {task.status === "completed" && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 space-y-3">
          <h2 className="font-medium text-emerald-800">Completion Details</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-emerald-600 uppercase">Completed At</p>
              <p className="font-medium text-emerald-900">
                {fmtTime(task.completedAt)}
              </p>
            </div>
          </div>
          {task.completionNotes && (
            <div>
              <p className="text-xs text-emerald-600 uppercase">Notes</p>
              <p className="text-sm text-emerald-800">
                {task.completionNotes}
              </p>
            </div>
          )}
        </div>
      )}

      {photos.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-medium text-slate-900">
            Photo Evidence ({photos.length})
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((p) => (
              <div key={p.id} className="space-y-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt="Evidence"
                  className="h-32 w-full rounded-lg object-cover"
                />
                <p className="text-xs text-slate-400">
                  {p.uploadedByName} · {fmtTime(p.uploadedAt)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {task.status === "pending" && (
        <div className="flex gap-3">
          <button
            onClick={() => updateStatus("in_progress")}
            disabled={busy}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
          >
            Start Task
          </button>
          <button
            onClick={() => updateStatus("completed")}
            disabled={busy}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            Mark Complete
          </button>
          <button
            onClick={deleteTask}
            disabled={busy}
            className="rounded-lg border border-rose-200 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-60"
          >
            Delete
          </button>
        </div>
      )}

      {task.status === "in_progress" && (
        <div className="flex gap-3">
          <button
            onClick={() => updateStatus("completed")}
            disabled={busy}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            Mark Complete
          </button>
          <button
            onClick={() => updateStatus("pending")}
            disabled={busy}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            Back to Pending
          </button>
          <button
            onClick={() => updateStatus("cancelled")}
            disabled={busy}
            className="rounded-lg border border-rose-200 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      )}

      <button
        onClick={() => router.push("/dashboard/tasks")}
        className="text-sm text-slate-500 hover:text-slate-700"
      >
        &larr; Back to tasks
      </button>
    </div>
  );
}
