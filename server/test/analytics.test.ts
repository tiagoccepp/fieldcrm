import { describe, expect, it } from "vitest";
import { api, makeFixture } from "./harness.js";
import { generateDraft, mockDraft } from "../src/lib/ai.js";

describe("ai draft seam", () => {
  it("mock draft is short, addressed, and actionable", () => {
    const d = mockDraft({
      customerName: "Harper",
      jobTitle: "Heater install",
      jobStatus: "done",
      followupTitle: "Ask about the new heater",
    });
    expect(d.length).toBeLessThanOrEqual(320);
    expect(d).toContain("Harper");
    expect(d).toContain("Ask about the new heater");
  });

  it("generateDraft uses mock without env keys", async () => {
    delete process.env.OPENAI_BASE_URL;
    delete process.env.OPENAI_API_KEY;
    const out = await generateDraft({
      customerName: "C",
      jobTitle: null,
      jobStatus: null,
      followupTitle: "Check in",
    });
    expect(out.provider).toBe("mock");
    expect(out.draft.length).toBeGreaterThan(20);
  });
});

describe("follow-ups + drafts", () => {
  it("creates follow-up and generates a stored draft", async () => {
    const fx = await makeFixture("draftA");
    const cust = await api("/api/customers", {
      method: "POST",
      cookie: fx.dispatcherCookie,
      body: { name: "Draft Co" },
    });
    const custId = (cust.json as { id: string }).id;
    const created = await api("/api/followups", {
      method: "POST",
      cookie: fx.dispatcherCookie,
      body: { title: "Ask about the visit", customerId: custId },
    });
    expect(created.status).toBe(201);
    const id = (created.json as { id: string }).id;
    const draft = await api(`/api/followups/${id}/draft`, {
      method: "POST",
      cookie: fx.dispatcherCookie,
      body: {},
    });
    expect(draft.status).toBe(200);
    expect((draft.json as { provider: string }).provider).toBe("mock");
    const list = (await api("/api/followups?open=1", { cookie: fx.dispatcherCookie })).json as {
      id: string;
      draft: string | null;
    }[];
    expect(list.find((f) => f.id === id)?.draft).toContain("Draft Co");
  });

  it("tech cannot generate drafts", async () => {
    const fx = await makeFixture("draftB");
    const cust = await api("/api/customers", {
      method: "POST",
      cookie: fx.dispatcherCookie,
      body: { name: "Draft2 Co" },
    });
    const created = await api("/api/followups", {
      method: "POST",
      cookie: fx.dispatcherCookie,
      body: { title: "x", customerId: (cust.json as { id: string }).id },
    });
    const r = await api(`/api/followups/${(created.json as { id: string }).id}/draft`, {
      method: "POST",
      cookie: fx.techCookie,
      body: {},
    });
    expect(r.status).toBe(403);
  });
});

describe("analytics summary", () => {
  it("returns pipeline counts and revenue math", async () => {
    const fx = await makeFixture("statsA");
    const cust = await api("/api/customers", {
      method: "POST",
      cookie: fx.dispatcherCookie,
      body: { name: "Stats Co" },
    });
    const custId = (cust.json as { id: string }).id;
    await api("/api/jobs", {
      method: "POST",
      cookie: fx.dispatcherCookie,
      body: { title: "Counted", customerId: custId, priceCents: 5000, assignedTo: fx.techId },
    });
    const r = await api("/api/analytics/summary", { cookie: fx.ownerCookie });
    expect(r.status).toBe(200);
    const s = r.json as {
      pipeline: Record<string, number>;
      jobsThisWeek: number;
      revenueCents: { total: number };
      onTimePct: number | null;
    };
    expect(s.pipeline.scheduled).toBe(1);
    expect(s.jobsThisWeek).toBe(1);
    expect(s.revenueCents.total).toBe(0); // done+paid only
    expect(s.onTimePct).toBeNull(); // no done jobs yet
  });

  it("requires auth", async () => {
    const r = await api("/api/analytics/summary");
    expect(r.status).toBe(401);
  });
});

describe("ops", () => {
  it("health reports db status", async () => {
    const r = await api("/api/health");
    expect(r.status).toBe(200);
    expect((r.json as { ok: boolean }).ok).toBe(true);
  });

  it("client-errors accepts UI reports", async () => {
    const r = await api("/api/client-errors", {
      method: "POST",
      body: { message: "test crash", url: "/jobs" },
    });
    expect(r.status).toBe(200);
  });
});
