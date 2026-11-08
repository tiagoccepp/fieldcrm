import { describe, expect, it } from "vitest";
import { api, makeFixture } from "./harness.js";
import { hashPassword, verifyPassword } from "../src/lib/password.js";

describe("password hashing (scrypt, zero-dep)", () => {
  it("hashes and verifies", async () => {
    const h = await hashPassword("Secret123!");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("Secret123!", h)).toBe(true);
    expect(await verifyPassword("Wrong!", h)).toBe(false);
  });

  it("rejects malformed hashes", async () => {
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
    expect(await verifyPassword("x", "")).toBe(false);
  });

  it("salts differ per hash", async () => {
    const a = await hashPassword("same");
    const b = await hashPassword("same");
    expect(a).not.toBe(b);
  });
});

describe("auth endpoints", () => {
  it("login rejects bad credentials", async () => {
    const fx = await makeFixture("auth");
    const bad = await api("/api/auth/login", {
      method: "POST",
      body: { email: "nobody@test.example", password: "nope" },
    });
    expect(bad.status).toBe(401);
    void fx;
  });

  it("login validates input shape", async () => {
    const r1 = await api("/api/auth/login", { method: "POST", body: {} });
    expect(r1.status).toBe(400);
    const r2 = await api("/api/auth/login", {
      method: "POST",
      body: { email: "not-an-email", password: "x" },
    });
    expect(r2.status).toBe(400);
  });

  it("me returns the session user", async () => {
    const fx = await makeFixture("authme");
    const r = await api("/api/auth/me", { cookie: fx.ownerCookie });
    expect(r.status).toBe(200);
    const me = r.json as { email: string; role: string; orgId: string };
    expect(me.role).toBe("owner");
    expect(me.orgId).toBe(fx.orgId);
  });

  it("me rejects without cookie", async () => {
    const r = await api("/api/auth/me");
    expect(r.status).toBe(401);
  });

  it("logout kills the session", async () => {
    const fx = await makeFixture("authout");
    const out = await api("/api/auth/logout", {
      method: "POST",
      cookie: fx.techCookie,
    });
    expect(out.status).toBe(200);
    const me = await api("/api/auth/me", { cookie: fx.techCookie });
    expect(me.status).toBe(401);
  });
});
