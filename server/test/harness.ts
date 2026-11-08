import { afterAll, beforeAll } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { createApp } from "../src/index.js";
import { getDb, closeDb, type Db } from "../src/lib/db.js";
import { hashPassword } from "../src/lib/password.js";
import { migrate } from "../src/migrate.js";
import { orgs, users } from "../src/schema.js";

// Parallel-safe: every test file builds its own org + users with unique
// emails. No truncation, no shared rows. Requires a live Postgres
// (TEST_DATABASE_URL or DATABASE_URL — docker compose up).

export let baseUrl = "";
export let db: Db;
let server: Server;

export async function api(
  path: string,
  opts: { method?: string; cookie?: string; body?: unknown; rawBody?: string; headers?: Record<string, string> } = {},
): Promise<{ status: number; json: unknown; headers: Headers }> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.cookie) headers.cookie = opts.cookie;
  let body: string | undefined;
  if (opts.rawBody !== undefined) {
    body = opts.rawBody;
  } else if (opts.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(baseUrl + path, { method: opts.method || "GET", headers, body });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json, headers: res.headers };
}

export interface Fixture {
  orgId: string;
  ownerCookie: string;
  dispatcherCookie: string;
  techCookie: string;
  techId: string;
}

export async function makeFixture(tag: string): Promise<Fixture> {
  const suffix = `${tag}-${randomUUID().slice(0, 8)}`;
  const [org] = await db.insert(orgs).values({ name: `Test Org ${suffix}` }).returning();
  const pw = await hashPassword("Test1234!");
  const mkuser = async (role: "owner" | "dispatcher" | "tech") => {
    const email = `${role}-${suffix}@test.example`;
    const [u] = await db
      .insert(users)
      .values({ orgId: org.id, email, name: `Test ${role}`, role, passwordHash: pw })
      .returning();
    const login = await api("/api/auth/login", { method: "POST", body: { email, password: "Test1234!" } });
    if (login.status !== 200) throw new Error(`fixture login failed for ${email}: ${login.status}`);
    const setCookie = login.headers.get("set-cookie") || "";
    const cookie = setCookie.split(";")[0];
    return { user: u, cookie };
  };
  const owner = await mkuser("owner");
  const dispatcher = await mkuser("dispatcher");
  const tech = await mkuser("tech");
  return {
    orgId: org.id,
    ownerCookie: owner.cookie,
    dispatcherCookie: dispatcher.cookie,
    techCookie: tech.cookie,
    techId: tech.user.id,
  };
}

beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL && process.env.DATABASE_URL) {
    process.env.DATABASE_URL = process.env.DATABASE_URL;
  }
  if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  await migrate();
  db = getDb();
  const app = createApp();
  server = app.listen(0);
  await new Promise<void>((resolve) => server.on("listening", () => resolve()));
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
  await closeDb();
});

export { eq };
