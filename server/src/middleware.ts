import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { log } from "./lib/logger.js";

export const COOKIE_NAME = "fieldcrm_session";

export function parseCookies(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  const header = req.headers.cookie;
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function setSessionCookie(res: Response, token: string): void {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=2592000`,
  );
}

export function clearSessionCookie(res: Response): void {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  );
}

export function requestId(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  (req as unknown as { reqId: string }).reqId =
    (req.headers["x-request-id"] as string) || randomUUID();
  next();
}

export function securityHeaders(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'",
  );
  next();
}

// Fixed-window in-memory rate limit. Single-process demo semantics —
// documented in SECURITY.md (use Redis sliding window in production).
const hits = new Map<string, { count: number; reset: number }>();

export function rateLimit(perMinute = 120) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || "unknown";
    const now = Date.now();
    const slot = hits.get(key);
    if (!slot || now >= slot.reset) {
      hits.set(key, { count: 1, reset: now + 60_000 });
      next();
      return;
    }
    slot.count += 1;
    if (slot.count > perMinute) {
      const retryAfter = Math.ceil((slot.reset - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      res
        .status(429)
        .json({ error: "Rate limit exceeded", hint: "Retry shortly" });
      return;
    }
    next();
  };
}

export function accessLog(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const start = Date.now();
  const reqId = (req as unknown as { reqId: string }).reqId;
  res.on("finish", () => {
    log.info("http", {
      reqId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms: Date.now() - start,
    });
  });
  next();
}
