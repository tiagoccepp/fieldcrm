import { Router } from "express";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { getDb } from "../lib/db.js";
import { followups, jobs, users } from "../schema.js";
import { currentUser, requireAuth } from "../scope.js";
import type { AnalyticsSummary, JobStatus } from "fieldcrm-shared";

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

function weekStart(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday
  return x;
}

analyticsRouter.get("/summary", async (req, res) => {
  const me = currentUser(req)!;
  const db = getDb();
  const ws = weekStart();

  const pipelineRows = await db
    .select({ status: jobs.status, n: sql<number>`count(*)::int` })
    .from(jobs)
    .where(eq(jobs.orgId, me.orgId))
    .groupBy(jobs.status);
  const pipeline = {
    scheduled: 0,
    en_route: 0,
    on_site: 0,
    done: 0,
    canceled: 0,
  } as Record<JobStatus, number>;
  for (const r of pipelineRows) pipeline[r.status as JobStatus] = r.n;

  const createdRows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(jobs)
    .where(and(eq(jobs.orgId, me.orgId), gte(jobs.createdAt, ws)));
  const doneRows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(jobs)
    .where(
      and(
        eq(jobs.orgId, me.orgId),
        eq(jobs.status, "done"),
        gte(jobs.completedAt, ws),
      ),
    );

  const revRows = await db
    .select({
      tech: users.name,
      cents: sql<number>`coalesce(sum(${jobs.priceCents}),0)::int`,
    })
    .from(jobs)
    .leftJoin(users, eq(jobs.assignedTo, users.id))
    .where(and(eq(jobs.orgId, me.orgId), eq(jobs.status, "done"), eq(jobs.paid, true)))
    .groupBy(users.name);
  const byTech = revRows.map((r) => ({ name: r.tech ?? "Unassigned", cents: r.cents ?? 0 }));
  const total = byTech.reduce((a, b) => a + b.cents, 0);

  // On-time: done jobs whose completedAt <= scheduledFor (when scheduled).
  const onTimeRows = await db
    .select({
      total: sql<number>`count(*)::int`,
      onTime: sql<number>`count(*) filter (where ${jobs.completedAt} <= ${jobs.scheduledFor})::int`,
    })
    .from(jobs)
    .where(
      and(
        eq(jobs.orgId, me.orgId),
        eq(jobs.status, "done"),
        sql`${jobs.scheduledFor} is not null`,
      ),
    );
  const ot = onTimeRows[0];
  const onTimePct = ot && ot.total > 0 ? Math.round((ot.onTime / ot.total) * 100) : null;

  const overdueRows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(followups)
    .where(
      and(
        eq(followups.orgId, me.orgId),
        eq(followups.done, false),
        lte(followups.dueAt, new Date()),
      ),
    );

  const out: AnalyticsSummary = {
    pipeline,
    jobsThisWeek: createdRows[0]?.n ?? 0,
    doneThisWeek: doneRows[0]?.n ?? 0,
    revenueCents: { total, byTech },
    onTimePct,
    overdueFollowups: overdueRows[0]?.n ?? 0,
  };
  res.json(out);
});
