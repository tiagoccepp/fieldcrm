import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { getDb } from "../lib/db.js";
import { activities, jobs, webhookEvents } from "../schema.js";
import { log } from "../lib/logger.js";
import { verifyStripeSignature, verifyTwilioSignature } from "../lib/webhooks.js";

export const webhooksRouter = Router();

// NOTE: these routes need the RAW body for signature verification.
// index.ts mounts them BEFORE express.json() with express.raw().

// Stripe: payment_intent.succeeded with metadata.job_id marks the job paid.
// Idempotent on (source, event id): replays return {deduped:true}.
webhooksRouter.post(
  "/stripe",
  async (req, res) => {
    const raw = (req.body as Buffer).toString("utf8");
    const check = verifyStripeSignature(
      raw,
      req.headers["stripe-signature"] as string | undefined,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
    if (!check.ok) {
      res.status(400).json({ error: "Invalid webhook signature", hint: check.reason });
      return;
    }
    let event: { id?: string; type?: string; data?: { object?: Record<string, unknown> } };
    try {
      event = JSON.parse(raw);
    } catch {
      res.status(400).json({ error: "Invalid JSON payload" });
      return;
    }
    if (!event.id || !event.type) {
      res.status(400).json({ error: "Stripe event id/type required" });
      return;
    }
    const db = getDb();
    const seen = await db
      .select({ id: webhookEvents.id })
      .from(webhookEvents)
      .where(and(eq(webhookEvents.source, "stripe"), eq(webhookEvents.eventId, event.id)))
      .limit(1);
    if (seen.length > 0) {
      res.json({ ok: true, deduped: true });
      return;
    }
    await db.insert(webhookEvents).values({ source: "stripe", eventId: event.id, payload: event });
    if (event.type === "payment_intent.succeeded") {
      const obj = event.data?.object ?? {};
      const meta = (obj.metadata ?? {}) as Record<string, unknown>;
      const jobId = typeof meta.job_id === "string" ? meta.job_id : null;
      if (jobId) {
        const updated = await db
          .update(jobs)
          .set({ paid: true, updatedAt: new Date() })
          .where(eq(jobs.id, jobId))
          .returning({ id: jobs.id, orgId: jobs.orgId });
        if (updated[0]) {
          await db.insert(activities).values({
            orgId: updated[0].orgId,
            jobId,
            kind: "payment",
            body: `Stripe payment confirmed (${event.id})`,
          });
        }
      }
    }
    log.info("webhook", { source: "stripe", type: event.type });
    res.json({ ok: true });
  },
);

// Twilio: MessageStatus callbacks append to the job activity trail
// (job linked via PassThrough? No — via the followup/job sid mapping the
// sender includes; here we accept JobSid in the form body when present).
webhooksRouter.post("/twilio", async (req, res) => {
  const raw = (req.body as Buffer).toString("utf8");
  const params: Record<string, string> = {};
  for (const kv of raw.split("&")) {
    const i = kv.indexOf("=");
    if (i > 0) params[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, " "));
  }
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "http";
  const url = `${proto}://${req.get("host")}${req.originalUrl}`;
  const check = verifyTwilioSignature(
    url,
    params,
    req.headers["x-twilio-signature"] as string | undefined,
    process.env.TWILIO_AUTH_TOKEN,
  );
  if (!check.ok) {
    res.status(400).json({ error: "Invalid webhook signature", hint: check.reason });
    return;
  }
  const sid = params.MessageSid || params.SmsSid || "unknown";
  const db = getDb();
  const seen = await db
    .select({ id: webhookEvents.id })
    .from(webhookEvents)
    .where(and(eq(webhookEvents.source, "twilio"), eq(webhookEvents.eventId, sid)))
    .limit(1);
  if (seen.length > 0) {
    res.json({ ok: true, deduped: true });
    return;
  }
  await db.insert(webhookEvents).values({ source: "twilio", eventId: sid, payload: params });
  const jobId = params.JobSid || null;
  const status = params.MessageStatus || params.SmsStatus || "received";
  if (jobId) {
    const jobRows = await db
      .select({ id: jobs.id, orgId: jobs.orgId })
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);
    if (jobRows[0]) {
      await db.insert(activities).values({
        orgId: jobRows[0].orgId,
        jobId,
        kind: "sms",
        body: `SMS ${sid}: ${status}`,
      });
    }
  }
  log.info("webhook", { source: "twilio", status });
  res.json({ ok: true });
});
