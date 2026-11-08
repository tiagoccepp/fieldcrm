import { describe, expect, it } from "vitest";
import { api, makeFixture } from "./harness.js";

describe("users (crew list)", () => {
  it("lists org members without password hashes", async () => {
    const fx = await makeFixture("usersA");
    const r = await api("/api/users", { cookie: fx.dispatcherCookie });
    expect(r.status).toBe(200);
    const rows = r.json as { id: string; name: string; role: string }[];
    expect(rows.length).toBe(3);
    expect(rows.map((u) => u.role).sort()).toEqual(["dispatcher", "owner", "tech"]);
    for (const u of rows) {
      expect(u).not.toHaveProperty("passwordHash");
      expect(u).not.toHaveProperty("email");
    }
  });

  it("is scoped to the session org", async () => {
    const a = await makeFixture("usersB");
    const b = await makeFixture("usersC");
    const ra = (await api("/api/users", { cookie: a.dispatcherCookie })).json as { id: string }[];
    const rb = (await api("/api/users", { cookie: b.dispatcherCookie })).json as { id: string }[];
    const idsA = new Set(ra.map((u) => u.id));
    for (const u of rb) expect(idsA.has(u.id)).toBe(false);
  });

  it("requires auth", async () => {
    const r = await api("/api/users");
    expect(r.status).toBe(401);
  });
});
