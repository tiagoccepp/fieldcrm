import type { Request, Response, NextFunction } from "express";
import { getDb } from "./lib/db.js";
import { getSessionUser } from "./lib/auth.js";
import { COOKIE_NAME, parseCookies } from "./middleware.js";
import type { Me, Role } from "fieldcrm-shared";

export function currentUser(req: Request): Me | null {
  return (req as unknown as { me?: Me }).me ?? null;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = parseCookies(req)[COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: "Not signed in", hint: "POST /api/auth/login" });
    return;
  }
  const me = await getSessionUser(getDb(), token);
  if (!me) {
    res.status(401).json({ error: "Session expired", hint: "Sign in again" });
    return;
  }
  (req as unknown as { me: Me }).me = me;
  next();
}

export function requireRole(...allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const me = currentUser(req);
    if (!me || !(allowed as string[]).includes(me.role)) {
      res.status(403).json({
        error: "Forbidden for your role",
        hint: `Requires: ${allowed.join(", ")}`,
      });
      return;
    }
    next();
  };
}
