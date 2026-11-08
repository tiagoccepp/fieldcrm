import { createHash } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import type { Db } from "./db.js";
import { sessions, users, orgs } from "../schema.js";
import { randomToken } from "./password.js";
import type { Me, Role } from "fieldcrm-shared";

const THIRTY_DAYS_MS = 30 * 24 * 3600 * 1000;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(
  db: Db,
  userId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + THIRTY_DAYS_MS);
  await db.insert(sessions).values({ userId, tokenHash: hashToken(token), expiresAt });
  return { token, expiresAt };
}

export async function getSessionUser(db: Db, token: string): Promise<Me | null> {
  const rows = await db
    .select({
      id: users.id,
      orgId: users.orgId,
      orgName: orgs.name,
      email: users.email,
      name: users.name,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .innerJoin(orgs, eq(users.orgId, orgs.id))
    .where(
      and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())),
    )
    .limit(1);
  if (rows.length === 0) return null;
  return rows[0] as Me;
}

export async function destroySession(db: Db, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

export function assertRole(me: Me, allowed: Role[]): boolean {
  return (allowed as string[]).includes(me.role);
}
