import { describe, expect, it } from "vitest";
import { api, db, makeFixture } from "./harness.js";
import { customers } from "../src/schema.js";
async function makeCustomer(cookie, orgId, name) {
    const r = await api("/api/customers", {
        method: "POST",
        cookie,
        body: { name },
    });
    expect(r.status).toBe(201);
    return r.json.id;
}
describe("jobs pipeline", () => {
    it("dispatcher creates a job with steps; tech cannot create", async () => {
        const fx = await makeFixture("jobscreate");
        const custId = await makeCustomer(fx.dispatcherCookie, fx.orgId, "Create Co");
        const denied = await api("/api/jobs", {
            method: "POST",
            cookie: fx.techCookie,
            body: { title: "Nope", customerId: custId },
        });
        expect(denied.status).toBe(403);
        const ok = await api("/api/jobs", {
            method: "POST",
            cookie: fx.dispatcherCookie,
            body: {
                title: "Fix leak",
                customerId: custId,
                priceCents: 15000,
                assignedTo: fx.techId,
                steps: ["Diagnose", "Fix", "Verify"],
            },
        });
        expect(ok.status).toBe(201);
        const job = ok.json;
        expect(job.status).toBe("scheduled");
        const full = await api(`/api/jobs/${job.id}`, { cookie: fx.dispatcherCookie });
        const body = full.json;
        expect(body.steps.map((s) => s.label)).toEqual(["Diagnose", "Fix", "Verify"]);
        expect(body.activities.length).toBeGreaterThan(0);
    });
    it("tech advances own job through the pipeline in order", async () => {
        const fx = await makeFixture("jobsflow");
        const custId = await makeCustomer(fx.dispatcherCookie, fx.orgId, "Flow Co");
        const created = await api("/api/jobs", {
            method: "POST",
            cookie: fx.dispatcherCookie,
            body: { title: "Flow job", customerId: custId, assignedTo: fx.techId },
        });
        const id = created.json.id;
        // Skip ahead is rejected with the fix
        const skip = await api(`/api/jobs/${id}/status`, {
            method: "PATCH",
            cookie: fx.techCookie,
            body: { status: "done" },
        });
        expect(skip.status).toBe(409);
        for (const s of ["en_route", "on_site", "done"]) {
            const r = await api(`/api/jobs/${id}/status`, {
                method: "PATCH",
                cookie: fx.techCookie,
                body: { status: s },
            });
            expect(r.status).toBe(200);
        }
        // Done is terminal
        const again = await api(`/api/jobs/${id}/status`, {
            method: "PATCH",
            cookie: fx.techCookie,
            body: { status: "on_site" },
        });
        expect(again.status).toBe(409);
    });
    it("tech cannot cancel; dispatcher can", async () => {
        const fx = await makeFixture("jobscancel");
        const custId = await makeCustomer(fx.dispatcherCookie, fx.orgId, "Cancel Co");
        const created = await api("/api/jobs", {
            method: "POST",
            cookie: fx.dispatcherCookie,
            body: { title: "Cancel me", customerId: custId, assignedTo: fx.techId },
        });
        const id = created.json.id;
        const denied = await api(`/api/jobs/${id}/status`, {
            method: "PATCH",
            cookie: fx.techCookie,
            body: { status: "canceled" },
        });
        expect(denied.status).toBe(403);
        const ok = await api(`/api/jobs/${id}/status`, {
            method: "PATCH",
            cookie: fx.dispatcherCookie,
            body: { status: "canceled" },
        });
        expect(ok.status).toBe(200);
    });
    it("step toggle is idempotent and locks on done", async () => {
        const fx = await makeFixture("jobssteps");
        const custId = await makeCustomer(fx.dispatcherCookie, fx.orgId, "Steps Co");
        const created = await api("/api/jobs", {
            method: "POST",
            cookie: fx.dispatcherCookie,
            body: { title: "Steps job", customerId: custId, assignedTo: fx.techId, steps: ["A", "B"] },
        });
        const id = created.json.id;
        const full = (await api(`/api/jobs/${id}`, { cookie: fx.techCookie })).json;
        const t1 = await api(`/api/jobs/${id}/steps/${full.steps[0].id}`, {
            method: "PATCH",
            cookie: fx.techCookie,
            body: { done: true },
        });
        expect(t1.status).toBe(200);
        const t2 = await api(`/api/jobs/${id}/steps/${full.steps[0].id}`, {
            method: "PATCH",
            cookie: fx.techCookie,
            body: { done: true },
        });
        expect(t2.status).toBe(200);
        for (const s of ["en_route", "on_site", "done"]) {
            await api(`/api/jobs/${id}/status`, {
                method: "PATCH",
                cookie: fx.techCookie,
                body: { status: s },
            });
        }
        const locked = await api(`/api/jobs/${id}/steps/${full.steps[1].id}`, {
            method: "PATCH",
            cookie: fx.techCookie,
            body: { done: true },
        });
        expect(locked.status).toBe(409);
    });
    it("creating with another org's customer returns 404", async () => {
        const a = await makeFixture("jobsx1");
        const b = await makeFixture("jobsx2");
        const custB = await makeCustomer(b.dispatcherCookie, b.orgId, "B Co");
        const r = await api("/api/jobs", {
            method: "POST",
            cookie: a.dispatcherCookie,
            body: { title: "X-org", customerId: custB },
        });
        expect(r.status).toBe(404);
        void db;
        void customers;
    });
});
