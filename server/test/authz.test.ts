import { describe, expect, it } from "vitest";
import { api, makeFixture } from "./harness.js";

// Multi-tenant isolation proof: every cross-org read returns 404 (never 403,
// never a leak — the org filter is part of the query, see routes/*).
describe("multi-tenant isolation", () => {
  it("org A cannot read org B's customer", async () => {
    const a = await makeFixture("isoA");
    const b = await makeFixture("isoB");
    const created = await api("/api/customers", {
      method: "POST",
      cookie: b.dispatcherCookie,
      body: { name: "Secret Co" },
    });
    const id = (created.json as { id: string }).id;
    const r = await api(`/api/customers/${id}`, { cookie: a.dispatcherCookie });
    expect(r.status).toBe(404);
  });

  it("org A cannot list org B's jobs", async () => {
    const a = await makeFixture("isoC");
    const b = await makeFixture("isoD");
    const cust = await api("/api/customers", {
      method: "POST",
      cookie: b.dispatcherCookie,
      body: { name: "List Co" },
    });
    await api("/api/jobs", {
      method: "POST",
      cookie: b.dispatcherCookie,
      body: { title: "Hidden job", customerId: (cust.json as { id: string }).id },
    });
    const list = await api("/api/jobs", { cookie: a.dispatcherCookie });
    expect(list.status).toBe(200);
    expect((list.json as unknown[]).length).toBe(0);
  });

  it("org A cannot mutate org B's job status", async () => {
    const a = await makeFixture("isoE");
    const b = await makeFixture("isoF");
    const cust = await api("/api/customers", {
      method: "POST",
      cookie: b.dispatcherCookie,
      body: { name: "Mut Co" },
    });
    const job = await api("/api/jobs", {
      method: "POST",
      cookie: b.dispatcherCookie,
      body: { title: "Victim job", customerId: (cust.json as { id: string }).id },
    });
    const id = (job.json as { id: string }).id;
    const r = await api(`/api/jobs/${id}/status`, {
      method: "PATCH",
      cookie: a.dispatcherCookie,
      body: { status: "en_route" },
    });
    expect(r.status).toBe(404);
  });
});

describe("role scoping", () => {
  it("tech sees only assigned jobs", async () => {
    const fx = await makeFixture("scopeA");
    const cust = await api("/api/customers", {
      method: "POST",
      cookie: fx.dispatcherCookie,
      body: { name: "Scope Co" },
    });
    const custId = (cust.json as { id: string }).id;
    await api("/api/jobs", {
      method: "POST",
      cookie: fx.dispatcherCookie,
      body: { title: "Mine", customerId: custId, assignedTo: fx.techId },
    });
    await api("/api/jobs", {
      method: "POST",
      cookie: fx.dispatcherCookie,
      body: { title: "Not mine", customerId: custId },
    });
    const mine = (await api("/api/jobs", { cookie: fx.techCookie })).json as { title: string }[];
    expect(mine.map((j) => j.title)).toEqual(["Mine"]);
    const all = (await api("/api/jobs", { cookie: fx.dispatcherCookie })).json as unknown[];
    expect(all.length).toBe(2);
  });

  it("tech cannot open an unassigned job directly", async () => {
    const fx = await makeFixture("scopeB");
    const cust = await api("/api/customers", {
      method: "POST",
      cookie: fx.dispatcherCookie,
      body: { name: "Scope2 Co" },
    });
    const job = await api("/api/jobs", {
      method: "POST",
      cookie: fx.dispatcherCookie,
      body: { title: "Other job", customerId: (cust.json as { id: string }).id },
    });
    const r = await api(`/api/jobs/${(job.json as { id: string }).id}`, {
      cookie: fx.techCookie,
    });
    expect(r.status).toBe(404);
  });

  it("tech cannot create customers or follow-ups", async () => {
    const fx = await makeFixture("scopeC");
    const c = await api("/api/customers", {
      method: "POST",
      cookie: fx.techCookie,
      body: { name: "Tech Co" },
    });
    expect(c.status).toBe(403);
    const f = await api("/api/followups", {
      method: "POST",
      cookie: fx.techCookie,
      body: { title: "x", customerId: "00000000-0000-0000-0000-000000000000" },
    });
    expect(f.status).toBe(403);
  });
});
