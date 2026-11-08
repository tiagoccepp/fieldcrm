import { useEffect, useState } from "react";
import { api, money, type AnalyticsSummary } from "../lib/api";
import { Card } from "../components/ui";

function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="tnum font-semibold">{money(value)}</span>
      </div>
      <svg viewBox="0 0 100 8" className="mt-1 h-2 w-full" role="img" aria-label={`${label} ${money(value)}`}>
        <rect x="0" y="0" width="100" height="8" rx="2" fill="#e2dccb" />
        <rect x="0" y="0" width={pct} height="8" rx="2" fill="#1e2e2a" />
      </svg>
    </div>
  );
}

export function StatsPage() {
  const [s, setS] = useState<AnalyticsSummary | null>(null);

  useEffect(() => {
    api<AnalyticsSummary>("/api/analytics/summary").then(setS).catch(() => {});
  }, []);

  if (!s) return <p className="text-muted">Loading stats…</p>;

  const maxRev = Math.max(1, ...s.revenueCents.byTech.map((t) => t.cents));

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Stats</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">This week</h2>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-muted">Jobs created</dt>
              <dd className="tnum text-3xl font-bold">{s.jobsThisWeek}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Jobs done</dt>
              <dd className="tnum text-3xl font-bold">{s.doneThisWeek}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">On-time</dt>
              <dd className="tnum text-3xl font-bold">{s.onTimePct === null ? "—" : `${s.onTimePct}%`}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Overdue follow-ups</dt>
              <dd className="tnum text-3xl font-bold">{s.overdueFollowups}</dd>
            </div>
          </dl>
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Pipeline</h2>
          <dl className="grid gap-2">
            {(Object.entries(s.pipeline) as [string, number][]).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between border-b border-line pb-2 text-sm">
                <dt className="capitalize">{k.replace("_", " ")}</dt>
                <dd className="tnum font-bold">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card className="p-5 md:col-span-2">
          <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-muted">Collected revenue by tech</h2>
          <p className="tnum mb-4 text-2xl font-bold">{money(s.revenueCents.total)}</p>
          {s.revenueCents.byTech.length === 0 ? (
            <p className="text-sm text-muted">No paid jobs yet.</p>
          ) : (
            <div className="grid gap-3">
              {s.revenueCents.byTech.map((t) => (
                <Bar key={t.name} value={t.cents} max={maxRev} label={t.name} />
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
