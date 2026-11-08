import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, money, statusLabel, type JobDetail } from "../lib/api";
import { enqueue } from "../lib/outbox";
import { Badge, Card } from "../components/ui";

export function JobDetailPage({ refreshKey }: { refreshKey: number }) {
  const { id } = useParams();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setJob(await api<JobDetail>(`/api/jobs/${id}`));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function toggleStep(stepId: string, done: boolean): Promise<void> {
    if (!job) return;
    const target = !done;
    // Optimistic + durable: flip locally, persist via API or outbox.
    setJob({ ...job, steps: job.steps.map((s) => (s.id === stepId ? { ...s, done: target } : s)) });
    if (!navigator.onLine) {
      enqueue(`Step ${target ? "done" : "reopened"}: ${job.title}`, "PATCH", `/api/jobs/${job.id}/steps/${stepId}`, { done: target });
      return;
    }
    try {
      await api(`/api/jobs/${job.id}/steps/${stepId}`, { method: "PATCH", json: { done: target } });
    } catch {
      enqueue(`Step ${target ? "done" : "reopened"}: ${job.title}`, "PATCH", `/api/jobs/${job.id}/steps/${stepId}`, { done: target });
    }
  }

  if (error) return <p role="alert" className="font-semibold text-bad">{error}</p>;
  if (!job) return <p className="text-muted">Loading job…</p>;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <p className="mono text-xs uppercase tracking-widest text-muted">{job.customerName}</p>
        <h1 className="mt-1 text-2xl font-bold">{job.title}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge tone={job.status === "done" ? "ok" : job.status === "canceled" ? "bad" : "info"}>
            {statusLabel(job.status)}
          </Badge>
          <Badge tone={job.paid ? "ok" : "warn"}>{job.paid ? "Paid" : "Unpaid"}</Badge>
          <Badge tone="neutral">
            <span className="tnum">{money(job.priceCents)}</span>
          </Badge>
        </div>
        {job.description && <p className="mt-4 max-w-prose">{job.description}</p>}

        <h2 className="mb-2 mt-6 font-bold">Checklist</h2>
        <Card className="divide-y divide-line">
          {job.steps.length === 0 && <p className="p-4 text-muted">No steps on this job.</p>}
          {job.steps.map((s) => (
            <label key={s.id} className="flex cursor-pointer items-center gap-3 p-3 hover:bg-paper">
              <input
                type="checkbox"
                checked={s.done}
                onChange={() => void toggleStep(s.id, s.done)}
                className="h-5 w-5 accent-[#2f6b4f]"
              />
              <span className={s.done ? "text-muted line-through" : ""}>{s.label}</span>
            </label>
          ))}
        </Card>
      </div>
      <aside>
        <h2 className="mb-2 font-bold">Activity</h2>
        <Card className="p-4">
          <ol className="grid gap-3">
            {job.activities.map((a) => (
              <li key={a.id} className="text-sm">
                <p>{a.body}</p>
                <p className="mono text-xs text-muted">
                  {a.kind} · {new Date(a.createdAt).toLocaleString("en-US")}
                </p>
              </li>
            ))}
          </ol>
        </Card>
      </aside>
    </div>
  );
}
