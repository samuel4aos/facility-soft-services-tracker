"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type AssignedUser = { userId: number; userName: string };

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
  assignedTo: AssignedUser[];
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  in_progress: "bg-sky-100 text-sky-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-slate-100 text-slate-500",
};

const PRIORITY_STYLES: Record<string, string> = {
  standard: "text-slate-500",
  urgent: "text-rose-600 font-semibold",
};

function fmtDate(iso: string | null) {
  if (!iso) return "No due date";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function TasksListClient() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ops/tasks", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { tasks: Task[] };
        setTasks(data.tasks);
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

  const filtered =
    filter === "all" ? tasks : tasks.filter((t) => t.status === filter);

  const counts = {
    all: tasks.length,
    pending: tasks.filter((t) => t.status === "pending").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    completed: tasks.filter((t) => t.status === "completed").length,
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Assigned Tasks
          </h1>
          <p className="text-sm text-slate-500">
            Create and manage tasks for your team
          </p>
        </div>
        <Link
          href="/dashboard/tasks/new"
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
        >
          + Create Task
        </Link>
      </div>

      <div className="mb-4 flex gap-2">
        {(["all", "pending", "in_progress", "completed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
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
        <p className="py-12 text-center text-slate-400">Loading tasks...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center">
          <p className="text-sm text-slate-400">No tasks found</p>
          <Link
            href="/dashboard/tasks/new"
            className="mt-3 inline-block text-sm text-sky-600 hover:text-sky-700"
          >
            Create your first task
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((task) => (
            <Link
              key={task.id}
              href={`/dashboard/tasks/${task.id}`}
              className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-sky-200 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-slate-900">{task.name}</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[task.status] ?? ""}`}
                    >
                      {task.status.replace("_", " ")}
                    </span>
                    {task.priority === "urgent" && (
                      <span className="text-xs text-rose-600 font-semibold">
                        URGENT
                      </span>
                    )}
                  </div>
                  {task.area && (
                    <p className="mt-1 text-sm text-slate-500">{task.area}</p>
                  )}
                  <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
                    <span>Due: {fmtDate(task.dueDate)}</span>
                    <span>
                      Assigned:{" "}
                      {task.assignedTo.length > 0
                        ? task.assignedTo.map((a) => a.userName).join(", ")
                        : "Unassigned"}
                    </span>
                    <span>By: {task.createdByName}</span>
                  </div>
                </div>
                <span className="shrink-0 text-slate-300">&rsaquo;</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
