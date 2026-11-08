import { discard, flush, getOutbox, subscribeOutbox } from "../lib/outbox";
import { useEffect, useState } from "react";
import { Button } from "./ui";

// Sync drawer: every pending offline mutation with state + retry/discard.
// Opened from the topbar badge; aria-live announces queue changes.
export function SyncDrawer({ open, onClose, onSync }: { open: boolean; onClose: () => void; onSync: () => void }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!open) return;
    return subscribeOutbox(() => setTick((t) => t + 1));
  }, [open ]);

  if (!open) return null;
  const q = getOutbox();

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-side/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Offline sync queue"
    >
      <div className="h-full w-full max-w-sm overflow-y-auto bg-paper p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Sync queue</h2>
          <button onClick={onClose} aria-label="Close sync queue" className="rounded px-2 py-1 text-muted hover:bg-card">
            ✕
          </button>
        </div>
        <div aria-live="polite">
          {q.length === 0 ? (
            <p className="text-sm text-muted">Queue empty — everything is synced.</p>
          ) : (
            <ol className="grid gap-2">
              {q.map((m) => (
                <li key={m.id} className="rounded-md border border-line bg-card p-3 text-sm">
                  <p className="font-semibold">{m.label}</p>
                  <p className="mono mt-1 text-xs text-muted">
                    {m.status} · attempts {m.attempts}
                    {m.lastError ? ` · ${m.lastError}` : ""}
                  </p>
                  {m.status === "failed" && (
                    <div className="mt-2">
                      <Button variant="outline" onClick={() => discard(m.id)}>
                        Discard
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
        {q.length > 0 && (
          <div className="mt-4">
            <Button
              onClick={() => {
                void flush().then(() => onSync());
              }}
            >
              Sync now
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
