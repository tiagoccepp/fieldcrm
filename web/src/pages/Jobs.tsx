import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, money, nextStep, statusLabel, type JobRow, type JobStatus, type Me } from "../lib/api";
import { enqueue } from "../lib/outbox";
import { Badge, Button, Card, Empty } from "../components/ui";

const COLS: JobStatus[] = ["scheduled", "en_route", "on_site", "done"];

export function JobsPage({ me, refreshKey }: { me: Me; refreshKey: number }) {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pulsed, setPulsed] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setJobs(await api<JobRow[]>("/api/jobs"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function advance(job: JobRow): Promise<void> {
    const step = nextStep(job.status);
    if (!step) return;
    // Offline-first: direct PATCH when online, durable queue when not.
    if (!navigator.onLine) {
      enqueue(`${step.verb}: ${job.title}`, "PATCH", `/api/jobs/${job.id}/status`, { status: step.to });
      return;
    }
    try {
      await api(`/api/jobs/${job.id}/status`, { method: "PATCH", json: { status: step.to } });
      setPulsed(job.id);
      setTimeout(() => setPulsed((p) => (p === job.id ? null : p)), 700);
      await load();
    } catch {
      enqueue(`${step.verb}: ${job.title}`, "PATCH", `/api/jobs/${job.id}/status`, { status: step.to });
    }
  }

  if (loading) return <p className="text-muted">Loading jobs…</p>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Jobs</h1>
        {(me.role === "owner" || me.role === "dispatcher") && (
          <Link to="/jobs/new">
            <Button>New job</Button>
          </Link>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLS.map((col) => {
          const items = jobs.filter((j) => j.status === col);
          return (
            <section key={col} aria-label={statusLabel(col)} className="rounded-lg border border-line bg-paper p-3">
              <header className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wide">{statusLabel(col)}</h2>
                <Badge tone="neutral">
                  <span className="tnum">{items.length}</span>
                </Badge>
              </header>
              <div className="grid gap-2">
                {items.length === 0 && <Empty>No jobs</Empty>}
                {items.map((j) => {
                  const step = nextStep(j.status);
                  return (
                    <Card key={j.id} className={`p-3 ${pulsed === j.id ? "pulse-card" : ""}`}>
                      <Link to={`/jobs/${j.id}`} className="font-semibold hover:underline">
                        {j.title}
                      </Link>
                      <p className="text-sm text-muted">{j.customerName}</p>
                      <p className="mono mt-1 text-xs text-muted">
                        <span className="tnum">{money(j.priceCents)}</span>
                        {j.paid ? " · paid ✓" : " · unpaid"}
                      </p>
                      {step && (
                        <div className="mt-2">
                          <Button variant="outline" onClick={() => void advance(j)}>
                            {step.verb}
                          </Button>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
