import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  api,
  money,
  nextStep,
  statusLabel,
  type AnalyticsSummary,
  type Followup,
  type JobRow,
} from "../lib/api";
import { enqueue } from "../lib/outbox";
import { Badge, Button, Card, Empty } from "../components/ui";

interface CrewMember {
  id: string;
  name: string;
  role: string;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function fmtDay(iso: string | null): string {
  if (!iso) return "Unscheduled";
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" });
}

function toneFor(status: JobRow["status"]): "neutral" | "ok" | "warn" | "bad" | "info" {
  switch (status) {
    case "done": return "ok";
    case "on_site": return "info";
    case "en_route": return "warn";
    default: return "neutral";
  }
}

export function DashboardPage({ refreshKey }: { refreshKey: number }) {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [stats, setStats] = useState<AnalyticsSummary | null>(null);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [j, s, f, c] = await Promise.all([
        api<JobRow[]>("/api/jobs"),
        api<AnalyticsSummary>("/api/analytics/summary"),
        api<Followup[]>("/api/followups?open=1").catch(() => [] as Followup[]),
        api<CrewMember[]>("/api/users").catch(() => [] as CrewMember[]),
      ]);
      setJobs(j);
      setStats(s);
      setFollowups(f);
      setCrew(c);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const crewName = useMemo(() => {
    const m = new Map(crew.map((u) => [u.id, u.name]));
    return (id: string | null) => (id ? (m.get(id) ?? "Crew") : "Unassigned");
  }, [crew]);

  async function advance(job: JobRow): Promise<void> {
    const step = nextStep(job.status);
    if (!step) return;
    if (!navigator.onLine) {
      enqueue(`${step.verb}: ${job.title}`, "PATCH", `/api/jobs/${job.id}/status`, { status: step.to });
      return;
    }
    try {
      await api(`/api/jobs/${job.id}/status`, { method: "PATCH", json: { status: step.to } });
      await load();
    } catch {
      enqueue(`${step.verb}: ${job.title}`, "PATCH", `/api/jobs/${job.id}/status`, { status: step.to });
    }
  }

  const now = new Date();
  const todayJobs = jobs.filter(
    (j) =>
      j.status === "en_route" ||
      j.status === "on_site" ||
      (j.scheduledFor !== null && sameDay(new Date(j.scheduledFor), now) && j.status !== "done" && j.status !== "canceled"),
  );
  const upcoming = jobs
    .filter(
      (j) =>
        j.status === "scheduled" &&
        j.scheduledFor !== null &&
        new Date(j.scheduledFor).getTime() > now.getTime() &&
        !sameDay(new Date(j.scheduledFor), now),
    )
    .sort((a, b) => new Date(a.scheduledFor!).getTime() - new Date(b.scheduledFor!).getTime())
    .slice(0, 6);
  const overdue = followups.filter((f) => !f.done && f.dueAt !== null && new Date(f.dueAt).getTime() < now.getTime());
  const unassigned = jobs.filter((j) => j.status === "scheduled" && j.assignedTo === null);
  const outstanding = jobs.filter((j) => j.status === "done" && !j.paid).reduce((a, j) => a + j.priceCents, 0);
  const pipelineValue = jobs
    .filter((j) => j.status === "scheduled" || j.status === "en_route" || j.status === "on_site")
    .reduce((a, j) => a + j.priceCents, 0);

  if (loading) return <p className="text-muted">Loading dashboard…</p>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Today</h1>
          <p className="text-sm text-muted">
            {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} ·{" "}
            <span className="tnum font-semibold text-ink">{todayJobs.length}</span> jobs on the board
          </p>
        </div>
        <Link to="/jobs/new">
          <Button>New job</Button>
        </Link>
      </div>

      {/* Revenue at a glance */}
      <div className="mb-4 grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Collected</p>
          <p className="tnum mt-1 text-3xl font-bold text-ok">{money(stats?.revenueCents.total ?? 0)}</p>
          <p className="mt-1 text-xs text-muted">paid jobs, all time</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Outstanding</p>
          <p className="tnum mt-1 text-3xl font-bold text-warn">{money(outstanding)}</p>
          <p className="mt-1 text-xs text-muted">done, awaiting payment</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Pipeline value</p>
          <p className="tnum mt-1 text-3xl font-bold">{money(pipelineValue)}</p>
          <p className="mt-1 text-xs text-muted">scheduled + active jobs</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Today's jobs */}
        <Card className="min-w-0 p-4 lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Today&apos;s jobs</h2>
            <Link to="/jobs" className="text-sm font-semibold text-accent hover:underline">
              Open board
            </Link>
          </div>
          {todayJobs.length === 0 ? (
            <Empty>No jobs on today — enjoy the quiet.</Empty>
          ) : (
            <ul className="grid grid-cols-1 gap-2">
              {todayJobs.map((j) => {
                const step = nextStep(j.status);
                return (
                  <li key={j.id} className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-paper p-3">
                    <Badge tone={toneFor(j.status)}>{statusLabel(j.status)}</Badge>
                    <div className="min-w-0 flex-1">
                      <Link to={`/jobs/${j.id}`} className="block truncate font-semibold hover:underline">
                        {j.title}
                      </Link>
                      <p className="truncate text-sm text-muted">
                        {j.customerName} · {crewName(j.assignedTo)} ·{" "}
                        <span className="tnum">{money(j.priceCents)}</span>
                      </p>
                    </div>
                    {step && (
                      <Button variant="outline" onClick={() => void advance(j)}>
                        {step.verb}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Upcoming + attention */}
        <div className="grid min-w-0 grid-cols-1 gap-4 lg:col-span-2">
          <Card className="min-w-0 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Upcoming visits</h2>
              <Link to="/jobs" className="text-sm font-semibold text-accent hover:underline">
                All jobs
              </Link>
            </div>
            {upcoming.length === 0 ? (
              <Empty>Nothing scheduled ahead.</Empty>
            ) : (
              <ul className="grid grid-cols-1 gap-2">
                {upcoming.map((j) => (
                  <li key={j.id} className="flex items-center justify-between gap-2 border-b border-line pb-2 text-sm last:border-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <Link to={`/jobs/${j.id}`} className="block truncate font-semibold hover:underline">
                        {j.title}
                      </Link>
                      <p className="truncate text-muted">
                        {j.customerName} · {crewName(j.assignedTo)}
                      </p>
                    </div>
                    <span className="tnum shrink-0 text-xs font-semibold text-muted">{fmtDay(j.scheduledFor)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="min-w-0 p-4">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Needs attention</h2>
            {overdue.length === 0 && unassigned.length === 0 ? (
              <Empty>All clear — nothing overdue or unassigned.</Empty>
            ) : (
              <ul className="grid grid-cols-1 gap-2 text-sm">
                {overdue.slice(0, 3).map((f) => (
                  <li key={f.id} className="flex items-center gap-2">
                    <Badge tone="bad">Overdue</Badge>
                    <Link to="/followups" className="min-w-0 truncate hover:underline">
                      {f.title} · {f.customerName}
                    </Link>
                  </li>
                ))}
                {unassigned.slice(0, 3).map((j) => (
                  <li key={j.id} className="flex items-center gap-2">
                    <Badge tone="warn">No crew</Badge>
                    <Link to={`/jobs/${j.id}`} className="min-w-0 truncate hover:underline">
                      {j.title} · {fmtDay(j.scheduledFor)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
