import { Router } from "express";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../lib/db.js";
import { activities, customers, jobSteps, jobs } from "../schema.js";
import { currentUser, requireAuth, requireRole } from "../scope.js";
import { canTransition, JOB_STATUSES, type JobStatus } from "fieldcrm-shared";

export const jobsRouter = Router();
jobsRouter.use(requireAuth);

function isStatus(v: unknown): v is JobStatus {
  return typeof v === "string" && (JOB_STATUSES as readonly string[]).includes(v);
}

// Techs see only jobs assigned to them; dispatchers/owners see the org board.
async function visibleJobIds(orgId: string, me: { id: string; role: string }) {
  if (me.role !== "tech") return null;
  const rows = await getDb()
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.orgId, orgId), eq(jobs.assignedTo, me.id)));
  return rows.map((r) => r.id);
}

jobsRouter.get("/", async (req, res) => {
  const me = currentUser(req)!;
  const db = getDb();
  const conds = [eq(jobs.orgId, me.orgId)];
  const status = req.query.status;
  if (status !== undefined) {
    if (!isStatus(status)) {
      res.status(400).json({ error: "Invalid status filter" });
      return;
    }
    conds.push(eq(jobs.status, status));
  }
  if (me.role === "tech") conds.push(eq(jobs.assignedTo, me.id));
  const rows = await db
    .select({
      id: jobs.id,
      customerId: jobs.customerId,
      customerName: customers.name,
      title: jobs.title,
      description: jobs.description,
      status: jobs.status,
      priceCents: jobs.priceCents,
      scheduledFor: jobs.scheduledFor,
      completedAt: jobs.completedAt,
      assignedTo: jobs.assignedTo,
      paid: jobs.paid,
      updatedAt: jobs.updatedAt,
    })
    .from(jobs)
    .innerJoin(customers, eq(jobs.customerId, customers.id))
    .where(and(...conds))
    .orderBy(desc(jobs.updatedAt))
    .limit(200);
  res.json(rows);
});

jobsRouter.post("/", requireRole("owner", "dispatcher"), async (req, res) => {
  const me = currentUser(req)!;
  const b = (req.body ?? {}) as Record<string, unknown>;
  const title = typeof b.title === "string" ? b.title.trim().slice(0, 160) : "";
  const customerId = typeof b.customerId === "string" ? b.customerId : "";
  if (!title || !customerId) {
    res.status(400).json({ error: "title and customerId required" });
    return;
  }
  const db = getDb();
  const cust = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.orgId, me.orgId), eq(customers.id, customerId)))
    .limit(1);
  if (cust.length === 0) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  const steps = Array.isArray(b.steps)
    ? b.steps.filter((s): s is string => typeof s === "string" && s.trim().length > 0).slice(0, 20)
    : [];
  const [job] = await db
    .insert(jobs)
    .values({
      orgId: me.orgId,
      customerId,
      title,
      description: typeof b.description === "string" ? b.description.slice(0, 2000) : null,
      priceCents: Number.isInteger(b.priceCents) && (b.priceCents as number) >= 0 ? (b.priceCents as number) : 0,
      scheduledFor: typeof b.scheduledFor === "string" ? new Date(b.scheduledFor) : null,
      assignedTo: typeof b.assignedTo === "string" ? b.assignedTo : null,
    })
    .returning();
  if (steps.length > 0) {
    await db.insert(jobSteps).values(
      steps.map((label, i) => ({ jobId: job.id, label: label.trim().slice(0, 200), position: i })),
    );
  }
  await db.insert(activities).values({
    orgId: me.orgId,
    jobId: job.id,
    kind: "created",
    body: `${me.name} created the job`,
  });
  res.status(201).json(job);
});

jobsRouter.get("/:id", async (req, res) => {
  const me = currentUser(req)!;
  const db = getDb();
  const jobRows = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.orgId, me.orgId), eq(jobs.id, req.params.id as string)))
    .limit(1);
  const job = jobRows[0];
  if (!job || (me.role === "tech" && job.assignedTo !== me.id)) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  const steps = await db
    .select()
    .from(jobSteps)
    .where(eq(jobSteps.jobId, job.id))
    .orderBy(asc(jobSteps.position));
  const trail = await db
    .select()
    .from(activities)
    .where(and(eq(activities.orgId, me.orgId), eq(activities.jobId, job.id)))
    .orderBy(desc(activities.createdAt))
    .limit(50);
  res.json({ ...job, steps, activities: trail });
});

// Status advance (the kanban action). Techs may advance only their own jobs;
// cancel requires dispatcher+. Invalid transitions return 409 with the fix.
jobsRouter.patch("/:id/status", async (req, res) => {
  const me = currentUser(req)!;
  const to = (req.body as { status?: unknown })?.status;
  if (!isStatus(to)) {
    res.status(400).json({ error: "Valid status required" });
    return;
  }
  if (to === "canceled" && me.role === "tech") {
    res.status(403).json({ error: "Only dispatchers cancel jobs" });
    return;
  }
  const db = getDb();
  const rows = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.orgId, me.orgId), eq(jobs.id, req.params.id as string)))
    .limit(1);
  const job = rows[0];
  if (!job || (me.role === "tech" && job.assignedTo !== me.id)) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  if (!canTransition(job.status as JobStatus, to)) {
    res.status(409).json({
      error: `Cannot move job from ${job.status} to ${to}`,
      hint: job.status === "done" ? "Done jobs are terminal" : "Follow the pipeline order",
    });
    return;
  }
  const [updated] = await db
    .update(jobs)
    .set({
      status: to,
      updatedAt: new Date(),
      completedAt: to === "done" ? new Date() : job.completedAt,
    })
    .where(eq(jobs.id, job.id))
    .returning();
  await db.insert(activities).values({
    orgId: me.orgId,
    jobId: job.id,
    kind: "status",
    body: `${me.name} moved ${job.status} → ${to}`,
  });
  res.json(updated);
});

// Step toggle (offline-capable from the client outbox). Idempotent by design:
// callers send the desired state, not a flip.
jobsRouter.patch("/:id/steps/:stepId", async (req, res) => {
  const me = currentUser(req)!;
  const done = (req.body as { done?: unknown })?.done;
  if (typeof done !== "boolean") {
    res.status(400).json({ error: "done (boolean) required" });
    return;
  }
  const db = getDb();
  const jobRows = await db
    .select({ id: jobs.id, assignedTo: jobs.assignedTo, status: jobs.status })
    .from(jobs)
    .where(and(eq(jobs.orgId, me.orgId), eq(jobs.id, req.params.id as string)))
    .limit(1);
  const job = jobRows[0];
  if (!job || (me.role === "tech" && job.assignedTo !== me.id)) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  if (job.status === "done" || job.status === "canceled") {
    res.status(409).json({ error: `Job is ${job.status}`, hint: "Steps lock on done/canceled" });
    return;
  }
  const updated = await db
    .update(jobSteps)
    .set({ done })
    .where(and(eq(jobSteps.id, req.params.stepId as string), eq(jobSteps.jobId, job.id)))
    .returning();
  if (updated.length === 0) {
    res.status(404).json({ error: "Step not found" });
    return;
  }
  res.json(updated[0]);
});

export { visibleJobIds, inArray };
