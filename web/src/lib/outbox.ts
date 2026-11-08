// Inline offline outbox: field-tech writes (status advance, step toggles)
// enqueue durably and flush when online. Minimal by design — the extracted,
// fully-tested library version lives in the companion repo offline-outbox-js.
import { useSyncExternalStore } from "react";

export type MutationStatus = "pending" | "sending" | "failed";

export interface Mutation {
  id: string;
  label: string;
  method: string;
  path: string;
  body: unknown;
  status: MutationStatus;
  attempts: number;
  enqueuedAt: number;
  lastError?: string;
}

const KEY = "fieldcrm.outbox.v1";

function load(): Mutation[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Mutation[];
    return arr.map((m) => ({ ...m, status: "pending" as MutationStatus }));
  } catch {
    return [];
  }
}

function save(q: Mutation[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(q));
  } catch {
    // Private mode: queue stays in memory for the session.
  }
}

let queue: Mutation[] = load();
const listeners = new Set<() => void>();
function emit(): void {
  save(queue);
  for (const l of listeners) l();
}

export function subscribeOutbox(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function getOutbox(): Mutation[] {
  return queue;
}

export function enqueue(label: string, method: string, path: string, body: unknown): Mutation {
  const m: Mutation = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    label,
    method,
    path,
    body,
    status: "pending",
    attempts: 0,
    enqueuedAt: Date.now(),
  };
  queue = [...queue, m];
  emit();
  void flush();
  return m;
}

export function discard(id: string): void {
  queue = queue.filter((m) => m.id !== id);
  emit();
}

let flushing = false;

export async function flush(onAck?: (m: Mutation) => void): Promise<void> {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  try {
    for (const m of queue) {
      if (m.status === "sending") continue;
      m.status = "sending";
      emit();
      try {
        const res = await fetch(m.path, {
          method: m.method,
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(m.body),
        });
        if (!res.ok) {
          // 4xx = the write is invalid (stale state, locked job): park as
          // failed with the server message instead of retrying forever.
          const data = (await res.json().catch(() => null)) as { error?: string; hint?: string } | null;
          m.status = "failed";
          m.lastError = data?.error || `HTTP ${res.status}`;
          m.attempts += 1;
          emit();
          continue;
        }
        queue = queue.filter((x) => x.id !== m.id);
        emit();
        onAck?.(m);
      } catch {
        m.status = "pending";
        m.attempts += 1;
        m.lastError = "Network unreachable";
        emit();
        break; // stay queued; retry on next online event
      }
    }
  } finally {
    flushing = false;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => void flush());
}

export function useOutbox(): Mutation[] {
  return useSyncExternalStore(subscribeOutbox, getOutbox, getOutbox);
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    (l) => {
      window.addEventListener("online", l);
      window.addEventListener("offline", l);
      return () => {
        window.removeEventListener("online", l);
        window.removeEventListener("offline", l);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}
