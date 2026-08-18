"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fileToCompressedDataUrl } from "@/lib/offline";
import NotificationBellMobile from "@/components/NotificationPanel";

type MyJob = {
  id: number;
  source: "scheduled" | "adhoc";
  name: string;
  area: string | null;
  instructions: string | null;
  dueDate: string | null;
  windowEnd: string | null;
  priority: string;
  requiresPhoto: boolean;
  completed: boolean;
  completedAt: string | null;
  completionNotes: string | null;
  createdAt: string;
  createdByName: string | null;
  dueTime: string | null;
  dueHour: number | null;
};

type CompletionMetadata = {
  areas?: string[];
  workDone?: string[];
  timeSpent?: number;
};

type HistoryLog = {
  id: number;
  completedAt: string;
  notes: string | null;
  dueDate: string;
  name: string;
  location: string | null;
  photoUrls: string[];
  completionMetadata: CompletionMetadata | null;
};

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
  createdAt: string;
  updatedAt: string;
  photos: IncidentPhoto[];
};

const GARDENING_AREAS = [
  "Lawn", "Hedges", "Flower beds", "Walkways", "Trees", "Drainage areas", "Perimeter",
];
const GARDENING_WORK = [
  "Mowing", "Trimming", "Watering", "Pruning", "Weeding", "Fertilizing", "Debris removal",
];

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function JanitorApp({
  user,
  today,
}: {
  user: { id: number; name: string };
  today: string;
}) {
  const [tab, setTab] = useState<"jobs" | "issues" | "history">("jobs");
  const [scheduled, setScheduled] = useState<MyJob[]>([]);
  const [adhoc, setAdhoc] = useState<MyJob[]>([]);
  const [history, setHistory] = useState<HistoryLog[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingIncidents, setLoadingIncidents] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/janitor/my-jobs", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as {
          scheduled: MyJob[];
          adhoc: MyJob[];
        };
        setScheduled(data.scheduled ?? []);
        setAdhoc(data.adhoc ?? []);
      }
    } catch {
      /* keep existing */
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    if (tab !== "history") return;
    setLoadingHistory(true);
    fetch("/api/janitor/history", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { logs: [] }))
      .then((d: { logs: HistoryLog[] }) => setHistory(d.logs))
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [tab]);

  useEffect(() => {
    if (tab !== "issues") return;
    setLoadingIncidents(true);
    fetch("/api/janitor/incidents", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { incidents: [] }))
      .then((d: { incidents: Incident[] }) => setIncidents(d.incidents))
      .catch(() => {})
      .finally(() => setLoadingIncidents(false));
  }, [tab]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  async function completeScheduledJob(
    id: number,
    notes: string,
    photoDataUrl: string | null,
    completionMetadata?: { areas?: string[]; workDone?: string[]; timeSpent?: number } | null,
  ) {
    try {
      const res = await fetch("/api/janitor/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occurrenceId: id,
          notes: notes || undefined,
          photos: photoDataUrl ? [photoDataUrl] : [],
          completedAt: new Date().toISOString(),
          completionMetadata: completionMetadata ?? null,
        }),
      });
      if (res.ok) {
        setScheduled((prev) =>
          prev.map((j) =>
            j.id === id
              ? { ...j, completed: true, completedAt: new Date().toISOString() }
              : j,
          ),
        );
        setToast("Task completed");
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to complete task");
      }
    } catch {
      setToast("Failed to complete task");
    }
  }

  async function completeAdhocJob(
    id: number,
    notes: string,
    photoDataUrl: string | null,
    completionMetadata?: { areas?: string[]; workDone?: string[]; timeSpent?: number } | null,
  ) {
    try {
      const res = await fetch(`/api/janitor/assigned/${id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: notes || undefined,
          photos: photoDataUrl ? [photoDataUrl] : [],
          completionMetadata: completionMetadata ?? null,
        }),
      });
      if (res.ok) {
        setAdhoc((prev) => prev.filter((j) => j.id !== id));
        setToast("Task completed");
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to complete task");
      }
    } catch {
      setToast("Failed to complete task");
    }
  }

  const allJobs = [...scheduled, ...adhoc];
  const pendingJobs = allJobs.filter((j) => !j.completed);
  const doneJobs = allJobs.filter((j) => j.completed);

  return (
    <div className="min-h-dvh bg-slate-950 pb-28 text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-900/95 px-4 pb-3 pt-5 backdrop-blur">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Soft services</p>
            <h1 className="text-xl font-semibold">Hi, {user.name.split(" ")[0]}</h1>
            <p className="text-xs text-slate-400">
              {new Date(`${today}T00:00:00`).toLocaleDateString(undefined, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBellMobile />
            <form onSubmit={(e) => {
              e.preventDefault();
              fetch("/api/auth/logout", { method: "POST" }).then(() => {
                window.location.href = "/login";
              });
            }}>
              <button className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300">
                Sign out
              </button>
            </form>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat label="To do" value={pendingJobs.length} tone="sky" />
          <Stat label="Overdue" value={pendingJobs.filter((j) => j.dueDate && j.dueDate < today).length} tone="rose" />
          <Stat label="Done" value={doneJobs.length} tone="emerald" />
        </div>
      </header>

      <nav className="z-10 flex gap-2 bg-slate-950/95 px-4 py-3">
        {(["jobs", "issues", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium capitalize ${
              tab === t ? "bg-sky-500 text-white" : "bg-slate-900 text-slate-300"
            }`}
          >
            {t === "jobs" ? "My Jobs" : t === "issues" ? "Issues" : "History"}
          </button>
        ))}
      </nav>

      <main className="space-y-6 px-4">
        {tab === "jobs" ? (
          loadingJobs ? (
            <p className="py-16 text-center text-slate-500">Loading tasks...</p>
          ) : allJobs.length === 0 ? (
            <p className="py-16 text-center text-slate-500">
              No tasks assigned to you right now.
            </p>
          ) : (
            <>
              {pendingJobs.length > 0 && (
                <section>
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    To Do ({pendingJobs.length})
                  </h2>
                  <div className="space-y-3">
                    {pendingJobs.map((job) => (
                      <JobCard
                        key={`${job.source}-${job.id}`}
                        job={job}
                        today={today}
                        onComplete={
                          job.source === "scheduled"
                            ? completeScheduledJob
                            : completeAdhocJob
                        }
                      />
                    ))}
                  </div>
                </section>
              )}
              {doneJobs.length > 0 && (
                <section>
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Completed ({doneJobs.length})
                  </h2>
                  <div className="space-y-3">
                    {doneJobs.map((job) => (
                      <JobCard
                        key={`${job.source}-${job.id}`}
                        job={job}
                        today={today}
                        onComplete={
                          job.source === "scheduled"
                            ? completeScheduledJob
                            : completeAdhocJob
                        }
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )
        ) : tab === "issues" ? (
          loadingIncidents ? (
            <p className="py-16 text-center text-slate-500">Loading issues...</p>
          ) : incidents.length === 0 ? (
            <p className="py-16 text-center text-slate-500">
              No issues assigned to you right now.
            </p>
          ) : (
            <div className="space-y-3">
              {incidents.map((inc) => (
                <IncidentCard
                  key={inc.id}
                  incident={inc}
                  onResolved={(id) => {
                    setIncidents((prev) => prev.filter((i) => i.id !== id));
                    setToast("Issue resolved");
                  }}
                  onError={setError}
                />
              ))}
            </div>
          )
        ) : (
          <div className="space-y-3">
            {loadingHistory ? (
              <p className="py-16 text-center text-slate-500">Loading history...</p>
            ) : history.length === 0 ? (
              <p className="py-16 text-center text-slate-500">No submissions yet.</p>
            ) : (
              history.map((log) => (
                <div key={log.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                  <div className="flex justify-between gap-3">
                    <p className="font-medium">{log.name}</p>
                    <p className="shrink-0 text-xs text-slate-400">{fmtTime(log.completedAt)}</p>
                  </div>
                  <p className="text-xs text-slate-400">{log.location}</p>
                  {log.completionMetadata && (log.completionMetadata.areas?.length || log.completionMetadata.workDone?.length || log.completionMetadata.timeSpent) && (
                    <p className="mt-2 rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-300">
                      {log.completionMetadata.areas && log.completionMetadata.areas.length > 0 && (
                        <span><span className="font-medium text-slate-200">Areas:</span> {log.completionMetadata.areas.join(", ")}</span>
                      )}
                      {log.completionMetadata.workDone && log.completionMetadata.workDone.length > 0 && (
                        <span className="block"><span className="font-medium text-slate-200">Work:</span> {log.completionMetadata.workDone.join(", ")}</span>
                      )}
                      {log.completionMetadata.timeSpent != null && (
                        <span className="block"><span className="font-medium text-slate-200">Time:</span> {log.completionMetadata.timeSpent} min</span>
                      )}
                    </p>
                  )}
                  {log.notes && <p className="mt-2 text-sm text-slate-300">&ldquo;{log.notes}&rdquo;</p>}
                  {log.photoUrls?.length > 0 && (
                    <div className="mt-3 flex gap-2 overflow-x-auto">
                      {log.photoUrls.map((u) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={u} src={u} alt="proof" className="h-20 w-20 rounded-lg object-cover" />
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {toast && (
        <div className="fixed inset-x-4 bottom-6 z-40 rounded-xl bg-emerald-500 px-4 py-3 text-center text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      {error && (
        <div
          className="fixed inset-x-4 bottom-6 z-40 rounded-xl bg-rose-500 px-4 py-3 text-center text-sm font-medium text-white shadow-lg cursor-pointer"
          onClick={() => setError(null)}
        >
          {error}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  const tones: Record<string, string> = {
    sky: "bg-sky-500/15 text-sky-300",
    rose: "bg-rose-500/15 text-rose-300",
    emerald: "bg-emerald-500/15 text-emerald-300",
  };
  return (
    <div className={`rounded-xl px-2 py-2 ${tones[tone]}`}>
      <p className="text-lg font-semibold leading-none">{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-wide opacity-80">{label}</p>
    </div>
  );
}

function JobCard({
  job,
  today,
  onComplete,
}: {
  job: MyJob;
  today: string;
  onComplete: (
    id: number,
    notes: string,
    photo: string | null,
    completionMetadata?: { areas?: string[]; workDone?: string[]; timeSpent?: number } | null,
  ) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isGardening = job.name.toLowerCase().includes("garden");
  const [areas, setAreas] = useState<string[]>([]);
  const [workDone, setWorkDone] = useState<string[]>([]);
  const [timeSpent, setTimeSpent] = useState<number>(30);

  async function handleFile(files: FileList | null) {
    if (!files?.length) return;
    const dataUrl = await fileToCompressedDataUrl(files[0]);
    setPhoto(dataUrl);
  }

  async function submit() {
    setBusy(true);
    const metadata = isGardening ? { areas, workDone, timeSpent } : null;
    await onComplete(job.id, notes, photo, metadata);
    setBusy(false);
    setOpen(false);
    setNotes("");
    setPhoto(null);
    setAreas([]);
    setWorkDone([]);
    setTimeSpent(30);
  }

  function close() {
    setOpen(false);
    setNotes("");
    setPhoto(null);
    setAreas([]);
    setWorkDone([]);
    setTimeSpent(30);
  }

  const isOverdue = job.dueDate && job.dueDate < today;
  const isDone = job.completed;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`w-full rounded-2xl border-2 ${
          isDone
            ? "border-emerald-600/40"
            : isOverdue
              ? "border-rose-500"
              : "border-slate-800"
        } bg-slate-900 p-4 text-left active:scale-[0.99]`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">{job.name}</p>
            <p className="truncate text-xs text-slate-400">{job.area}</p>
            <p className="mt-1 text-[11px] text-slate-500">
              {job.dueDate
                ? isOverdue
                  ? `Was due ${job.dueDate}`
                  : `Due ${job.dueDate === today ? "today" : job.dueDate}`
                : "No due date"}
              {job.dueTime && (
                <span className="ml-1 text-sky-400">by {job.dueTime}</span>
              )}
              {job.dueHour != null && (
                <span className="ml-1 text-sky-400">
                  {String(job.dueHour).padStart(2, "0")}:00
                </span>
              )}
              {(job.priority === "urgent" || job.priority === "critical") && (
                <span className="ml-2 rounded bg-rose-500/20 px-1.5 py-0.5 text-rose-300">
                  {job.priority}
                </span>
              )}
            </p>
          </div>
          {isDone ? (
            <span className="shrink-0 rounded-full bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-300">
              Done
            </span>
          ) : (
            <span className="shrink-0 rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white">
              Complete
            </span>
          )}
        </div>
      </button>

      {open && (
        <div className="fixed inset-0 z-30 flex items-end bg-black/60" onClick={close}>
          <div
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-slate-900 p-5 pb-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-700" />
            <h2 className="text-lg font-semibold">{job.name}</h2>
            <p className="text-sm text-slate-400">{job.area}</p>
            {job.dueDate && (
              <p className="mt-1 text-xs text-slate-500">
                Due {job.dueDate}
                {job.dueHour != null && ` at ${String(job.dueHour).padStart(2, "0")}:00`}
                {job.dueTime && !job.dueHour && ` by ${job.dueTime}`}
                {job.windowEnd && ` · window ends ${job.windowEnd}`}
              </p>
            )}
            {job.instructions && (
              <div className="mt-4 rounded-xl bg-slate-800/70 p-3 text-sm text-slate-200">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  What to do
                </p>
                {job.instructions}
              </div>
            )}

            {isGardening && (
              <div className="mt-5 space-y-5">
                <div>
                  <p className="mb-2 text-sm font-medium">Areas maintained</p>
                  <div className="flex flex-wrap gap-2">
                    {GARDENING_AREAS.map((area) => {
                      const active = areas.includes(area);
                      return (
                        <button
                          key={area}
                          type="button"
                          onClick={() =>
                            setAreas((prev) =>
                              active ? prev.filter((a) => a !== area) : [...prev, area],
                            )
                          }
                          className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                            active
                              ? "border-sky-500 bg-sky-500/20 text-sky-300"
                              : "border-slate-700 bg-slate-800 text-slate-400"
                          }`}
                        >
                          {area}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium">Work done</p>
                  <div className="flex flex-wrap gap-2">
                    {GARDENING_WORK.map((work) => {
                      const active = workDone.includes(work);
                      return (
                        <button
                          key={work}
                          type="button"
                          onClick={() =>
                            setWorkDone((prev) =>
                              active ? prev.filter((w) => w !== work) : [...prev, work],
                            )
                          }
                          className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                            active
                              ? "border-sky-500 bg-sky-500/20 text-sky-300"
                              : "border-slate-700 bg-slate-800 text-slate-400"
                          }`}
                        >
                          {work}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium">Time spent</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={480}
                      value={timeSpent}
                      onChange={(e) => setTimeSpent(Number(e.target.value) || 0)}
                      className="w-24 rounded-xl border border-slate-700 bg-slate-800 p-3 text-sm text-white"
                    />
                    <span className="text-sm text-slate-400">minutes</span>
                  </div>
                </div>
              </div>
            )}

            {isDone ? (
              <div className="mt-6 rounded-xl bg-emerald-500/15 p-4 text-center text-emerald-300">
                Already completed {job.completedAt ? fmtTime(job.completedAt) : "today"}
              </div>
            ) : (
              <>
                <div className="mt-5">
                  <p className="mb-2 text-sm font-medium">Photo (optional)</p>
                  <div className="flex flex-wrap gap-2">
                    {photo && (
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo} alt="proof" className="h-24 w-24 rounded-xl object-cover" />
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
                        className="flex h-24 w-24 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-600 text-xs text-slate-400"
                      >
                        <span className="text-2xl">+</span>
                        Add photo
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

                <label className="mt-5 block text-sm font-medium">
                  Comment
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Add a note about this task..."
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-sm text-white placeholder:text-slate-500"
                  />
                </label>

                <button
                  onClick={submit}
                  disabled={busy}
                  className="mt-5 w-full rounded-2xl bg-emerald-500 py-4 text-base font-semibold text-white disabled:opacity-60"
                >
                  {busy ? "Saving..." : "Mark complete"}
                </button>
                <p className="mt-2 text-center text-[11px] text-slate-500">
                  Time is recorded automatically.
                </p>
                <button onClick={close} className="mt-4 w-full py-3 text-sm text-slate-400">
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function IncidentCard({
  incident,
  onResolved,
  onError,
}: {
  incident: Incident;
  onResolved: (id: number) => void;
  onError: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [afterPhoto, setAfterPhoto] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const beforePhoto = incident.photos.find((p) => p.photoType === "before");
  const isCritical = incident.priority === "critical";

  async function handleFile(files: FileList | null) {
    if (!files?.length) return;
    const dataUrl = await fileToCompressedDataUrl(files[0]);
    setAfterPhoto(dataUrl);
  }

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch(`/api/janitor/incidents/${incident.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: notes || undefined,
          afterPhoto: afterPhoto || undefined,
        }),
      });
      if (res.ok) {
        onResolved(incident.id);
        setOpen(false);
      } else {
        const data = await res.json();
        onError(data.error ?? "Failed to resolve");
      }
    } catch {
      onError("Failed to resolve issue");
    }
    setBusy(false);
  }

  function close() {
    setOpen(false);
    setAfterPhoto(null);
    setNotes("");
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border-2 border-amber-500/50 bg-slate-900 p-4 text-left active:scale-[0.99]"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-3">
            {beforePhoto && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={beforePhoto.url}
                alt="Issue"
                className="h-14 w-14 shrink-0 rounded-lg object-cover"
              />
            )}
            <div>
              <p className="font-semibold">{incident.area}</p>
              {incident.description && (
                <p className="truncate text-xs text-slate-400 max-w-[200px]">
                  {incident.description}
                </p>
              )}
              <p className="mt-1 text-[11px] text-slate-500">
                Reported by {incident.reportedByName}
                {isCritical && (
                  <span className="ml-2 rounded bg-rose-500/20 px-1.5 py-0.5 text-rose-300">
                    critical
                  </span>
                )}
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white">
            Fix
          </span>
        </div>
      </button>

      {open && (
        <div className="fixed inset-0 z-30 flex items-end bg-black/60" onClick={close}>
          <div
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-slate-900 p-5 pb-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-700" />
            <h2 className="text-lg font-semibold">{incident.area}</h2>
            {incident.description && (
              <p className="text-sm text-slate-400">{incident.description}</p>
            )}

            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase text-slate-400">
                Before Photo
              </p>
              {beforePhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={beforePhoto.url}
                  alt="Before"
                  className="w-full rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-32 items-center justify-center rounded-xl bg-slate-800 text-sm text-slate-500">
                  No photo provided
                </div>
              )}
            </div>

            <div className="mt-5">
              <p className="mb-2 text-sm font-medium">After Photo *</p>
              <div className="flex flex-wrap gap-2">
                {afterPhoto && (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={afterPhoto}
                      alt="After"
                      className="h-24 w-24 rounded-xl object-cover"
                    />
                    <button
                      onClick={() => setAfterPhoto(null)}
                      className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-rose-600 text-xs text-white"
                    >
                      x
                    </button>
                  </div>
                )}
                {!afterPhoto && (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex h-24 w-24 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-600 text-xs text-slate-400"
                  >
                    <span className="text-2xl">+</span>
                    After photo
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

            <label className="mt-5 block text-sm font-medium">
              Resolution Notes
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Describe what was done..."
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-sm text-white placeholder:text-slate-500"
              />
            </label>

            <button
              onClick={submit}
              disabled={busy || !afterPhoto}
              className="mt-5 w-full rounded-2xl bg-emerald-500 py-4 text-base font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Saving..." : "Mark Resolved"}
            </button>
            <button onClick={close} className="mt-4 w-full py-3 text-sm text-slate-400">
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
