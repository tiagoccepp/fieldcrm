import { useCallback, useEffect, useState } from "react";
import { api, type Followup, type Me } from "../lib/api";
import { Badge, Button, Card, Empty } from "../components/ui";

export function FollowupsPage({ me }: { me: Me }) {
  const [rows, setRows] = useState<Followup[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const canDraft = me.role === "owner" || me.role === "dispatcher";

  const load = useCallback(async () => {
    setRows(await api<Followup[]>("/api/followups?open=1").catch(() => []));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function draft(id: string): Promise<void> {
    setBusy(id);
    try {
      await api(`/api/followups/${id}/draft`, { method: "POST", json: {} });
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function close(id: string): Promise<void> {
    await api(`/api/followups/${id}`, { method: "PATCH", json: { done: true } });
    await load();
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Follow-ups</h1>
      <p className="mb-4 text-sm text-muted">Open client follow-ups. Drafts are AI-written SMS, mock unless a provider key is set.</p>
      {rows.length === 0 ? (
        <Empty>All caught up — nothing open.</Empty>
      ) : (
        <div className="grid gap-3">
          {rows.map((f) => {
            const overdue = f.dueAt ? new Date(f.dueAt).getTime() < Date.now() : false;
            return (
              <Card key={f.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{f.title}</span>
                  {overdue && <Badge tone="bad">Overdue</Badge>}
                  {f.draft && <Badge tone="ok">Draft ready</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted">
                  {f.customerName}
                  {f.jobTitle ? ` · ${f.jobTitle}` : ""}
                  {f.dueAt ? ` · due ${new Date(f.dueAt).toLocaleDateString("en-US")}` : ""}
                </p>
                {f.draft && (
                  <blockquote className="mt-3 border-l-2 border-accent bg-paper p-3 text-sm">
                    {f.draft}
                  </blockquote>
                )}
                <div className="mt-3 flex gap-2">
                  {canDraft && (
                    <Button variant="outline" disabled={busy === f.id} onClick={() => void draft(f.id)}>
                      {busy === f.id ? "Drafting…" : f.draft ? "Regenerate draft" : "Draft SMS"}
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => void close(f.id)}>
                    Mark done
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
