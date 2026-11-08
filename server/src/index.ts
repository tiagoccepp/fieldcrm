import express from "express";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { authRouter } from "./routes/auth.js";
import { customersRouter } from "./routes/customers.js";
import { jobsRouter } from "./routes/jobs.js";
import { followupsRouter } from "./routes/followups.js";
import { analyticsRouter } from "./routes/analytics.js";
import { webhooksRouter } from "./routes/webhooks.js";
import { opsRouter } from "./routes/ops.js";
import {
  accessLog,
  rateLimit,
  requestId,
  securityHeaders,
} from "./middleware.js";
import { log } from "./lib/logger.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(requestId);
  app.use(securityHeaders);
  app.use(accessLog);
  app.use(rateLimit(240));

  // Webhooks need the raw body: mount before express.json().
  app.use("/api/webhooks", express.raw({ type: "*/*" }), webhooksRouter);

  app.use(express.json({ limit: "256kb" }));
  app.use("/api/auth", authRouter);
  app.use("/api/customers", customersRouter);
  app.use("/api/jobs", jobsRouter);
  app.use("/api/followups", followupsRouter);
  app.use("/api/analytics", analyticsRouter);
  app.use("/api", opsRouter);

  // Serve the built web console (Docker) when present; API 404s stay JSON.
  const here = dirname(fileURLToPath(import.meta.url));
  const pub = join(here, "..", "public");
  if (existsSync(join(pub, "index.html"))) {
    app.use(express.static(pub, { maxAge: "1h", index: false }));
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(join(pub, "index.html"));
    });
  }

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Unknown API route" });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use(
    (
      err: unknown,
      req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      log.error("unhandled", {
        reqId: (req as unknown as { reqId: string }).reqId,
        err: String(err).slice(0, 500),
      });
      res.status(500).json({ error: "Internal error" });
    },
  );

  return app;
}

if (process.env.VITEST !== "true") {
  const port = Number(process.env.PORT || 8100);
  createApp().listen(port, () => {
    log.info("boot", { port, env: process.env.NODE_ENV || "development" });
  });
}
