import { Router } from "express";
import { sql } from "drizzle-orm";
import { getDb } from "../lib/db.js";
import { log } from "../lib/logger.js";

export const opsRouter = Router();

const BOOT = Date.now();

opsRouter.get("/health", async (_req, res) => {
  let dbOk = false;
  try {
    await getDb().execute(sql`select 1`);
    dbOk = true;
  } catch {
    dbOk = false;
  }
  res.status(dbOk ? 200 : 503).json({
    ok: dbOk,
    uptimeSec: Math.floor((Date.now() - BOOT) / 1000),
    version: process.env.npm_package_version || "0.1.0",
  });
});

// UI error reports (Sentry-ready: with SENTRY_DSN set, a forwarder would relay;
// without it we log structured — never silently dropped, never faked).
opsRouter.post("/client-errors", async (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const message = typeof b.message === "string" ? b.message.slice(0, 500) : "unknown";
  log.warn("client-error", {
    message,
    url: typeof b.url === "string" ? b.url.slice(0, 200) : undefined,
    stack: typeof b.stack === "string" ? b.stack.slice(0, 1000) : undefined,
    sentry: Boolean(process.env.SENTRY_DSN),
  });
  res.json({ ok: true });
});
