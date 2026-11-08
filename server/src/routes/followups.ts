import { Router } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "../lib/db.js";
import { customers, followups, jobs } from "../schema.js";
import { currentUser, requireAuth, requireRole } from "../scope.js";
import { generateDraft } from "../lib/ai.js";

export const followupsRouter = Router();
followupsRouter.use(requireAuth);

followupsRouter.get("/", async (req, res) => {
  const me = currentUser(req)!;
  const onlyOpen = req.query.open === "1";
  const conds = [eq(followups.orgId, me.orgId)];
  if (onlyOpen) conds.push(eq(followups.done, false));
  const rows = await getDb()
    .select({
      id: followups.id,
      jobId: followups.jobId,
      jobTitle: jobs.title,
      customerId: followups.customerId,
      customerName: customers.name,
      title: followups.title,
      dueAt: followups.dueAt,
      done: followups.done,
      draft: followups.draft,
      createdAt: followups.createdAt,
    })
    .from(followups)
    .innerJoin(customers, eq(followups.customerId, customers.id))
    .leftJoin(jobs, eq(followups.jobId, jobs.id))
    .where(and(...conds))
    .orderBy(asc(followups.dueAt), desc(followups.createdAt))
    .limit(200);
  res.json(rows);
});

followupsRouter.post("/", requireRole("owner", "dispatcher"), async (req, res) => {
  const me = currentUser(req)!;
  const b = (req.body ?? {}) as Record<string, unknown>;
  const title = typeof b.title === "string" ? b.title.trim().slice(0, 200) : "";
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
  let jobId: string | null = null;
  if (typeof b.jobId === "string" && b.jobId) {
    const j = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(and(eq(jobs.orgId, me.orgId), eq(jobs.id, b.jobId)))
      .limit(1);
    if (j.length === 0) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    jobId = b.jobId;
  }
  const [row] = await db
    .insert(followups)
    .values({
      orgId: me.orgId,
      jobId,
      customerId,
      title,
      dueAt: typeof b.dueAt === "string" ? new Date(b.dueAt) : null,
    })
    .returning();
  res.status(201).json(row);
});

followupsRouter.patch("/:id", async (req, res) => {
  const me = currentUser(req)!;
  const b = (req.body ?? {}) as Record<string, unknown>;
  const patch: Partial<typeof followups.$inferInsert> = {};
  if (b.done !== undefined) {
    if (typeof b.done !== "boolean") {
      res.status(400).json({ error: "done must be boolean" });
      return;
    }
    patch.done = b.done;
  }
  if (b.title !== undefined) {
    const t = typeof b.title === "string" ? b.title.trim().slice(0, 200) : "";
    if (!t) {
      res.status(400).json({ error: "title cannot be empty" });
      return;
    }
    patch.title = t;
  }
  const rows = await getDb()
    .update(followups)
    .set(patch)
    .where(and(eq(followups.orgId, me.orgId), eq(followups.id, req.params.id as string)))
    .returning();
  if (rows.length === 0) {
    res.status(404).json({ error: "Follow-up not found" });
    return;
  }
  res.json(rows[0]);
});

// AI draft for the follow-up SMS. Mock unless OPENAI_* env is set (see lib/ai.ts).
followupsRouter.post("/:id/draft", requireRole("owner", "dispatcher"), async (req, res) => {
  const me = currentUser(req)!;
  const rows = await getDb()
    .select({
      id: followups.id,
      title: followups.title,
      jobTitle: jobs.title,
      jobStatus: jobs.status,
      customerName: customers.name,
    })
    .from(followups)
    .innerJoin(customers, eq(followups.customerId, customers.id))
    .leftJoin(jobs, eq(followups.jobId, jobs.id))
    .where(and(eq(followups.orgId, me.orgId), eq(followups.id, req.params.id as string)))
    .limit(1);
  const f = rows[0];
  if (!f) {
    res.status(404).json({ error: "Follow-up not found" });
    return;
  }
  try {
    const out = await generateDraft({
      customerName: f.customerName,
      jobTitle: f.jobTitle,
      jobStatus: f.jobStatus,
      followupTitle: f.title,
      tone: typeof (req.body as { tone?: unknown })?.tone === "string" ? ((req.body as { tone: string }).tone.slice(0, 40)) : undefined,
    });
    await getDb().update(followups).set({ draft: out.draft }).where(eq(followups.id, f.id));
    res.json(out);
  } catch (err) {
    res.status(502).json({ error: "Draft provider failed", hint: String(err).slice(0, 160) });
  }
});
