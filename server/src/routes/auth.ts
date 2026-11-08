import { Router } from "express";
import { eq } from "drizzle-orm";
import { getDb } from "../lib/db.js";
import { users } from "../schema.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { createSession, destroySession } from "../lib/auth.js";
import { clearSessionCookie, parseCookies, setSessionCookie, COOKIE_NAME } from "../middleware.js";
import { currentUser, requireAuth } from "../scope.js";

export const authRouter = Router();

function validEmail(v: unknown): v is string {
  return typeof v === "string" && v.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
}

// Login only — demo orgs/users come from the seed. No public signup:
// multi-tenant signup without billing + abuse controls would be dishonest scope.
authRouter.post("/login", async (req, res) => {
  const { email, password } = (req.body ?? {}) as { email?: unknown; password?: unknown };
  if (!validEmail(email) || typeof password !== "string" || password.length === 0) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }
  const rows = await getDb().select().from(users).where(eq(users.email, email)).limit(1);
  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const { token } = await createSession(getDb(), user.id);
  setSessionCookie(res, token);
  res.json({ ok: true });
});

authRouter.post("/logout", async (req, res) => {
  const token = parseCookies(req)[COOKIE_NAME];
  if (token) await destroySession(getDb(), token);
  clearSessionCookie(res);
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json(currentUser(req));
});

export { hashPassword };
