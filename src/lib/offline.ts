"use client";

export type QueuedCompletion = {
  clientLogId: string;
  occurrenceId: number;
  taskName: string;
  notes?: string;
  photos: string[];
  gpsLat?: number | null;
  gpsLng?: number | null;
  completedAt: string;
};

const DB_NAME = "soft-services-tracker";
const STORE = "completion-queue";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "clientLogId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueue(item: QueuedCompletion) {
  await tx("readwrite", (s) => s.put(item));
}

export async function listQueue(): Promise<QueuedCompletion[]> {
  try {
    return (await tx<QueuedCompletion[]>("readonly", (s) => s.getAll())) ?? [];
  } catch {
    return [];
  }
}

export async function dequeue(clientLogId: string) {
  await tx("readwrite", (s) => s.delete(clientLogId));
}

export async function submitCompletion(
  item: QueuedCompletion,
): Promise<{ ok: boolean; queued: boolean; error?: string }> {
  try {
    const res = await fetch("/api/janitor/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    if (res.ok) return { ok: true, queued: false };
    if (res.status >= 400 && res.status < 500) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, queued: false, error: data.error ?? "Could not save" };
    }
    throw new Error("server error");
  } catch {
    await enqueue(item);
    return { ok: true, queued: true };
  }
}

/** Replay everything sitting in the offline queue. Returns synced count. */
export async function flushQueue(): Promise<number> {
  const items = await listQueue();
  let synced = 0;
  for (const item of items) {
    try {
      const res = await fetch("/api/janitor/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        await dequeue(item.clientLogId);
        synced += 1;
      }
    } catch {
      break; // still offline
    }
  }
  return synced;
}

export function newClientLogId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `log-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Downscale a captured photo so it survives a weak mobile connection. */
export function fileToCompressedDataUrl(file: File, maxDim = 1024, quality = 0.7) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(String(reader.result));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => resolve(String(reader.result));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function getPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    const timer = setTimeout(() => resolve(null), 6000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: false, timeout: 5000 },
    );
  });
}
