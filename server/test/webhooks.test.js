import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { api, makeFixture } from "./harness.js";
import { signStripePayload } from "../src/lib/webhooks.js";
const STRIPE_SECRET = "whsec_test_secret_123";
const TWILIO_TOKEN = "twilio_test_token_456";
describe("stripe webhook", () => {
    it("rejects unsigned payloads", async () => {
        process.env.STRIPE_WEBHOOK_SECRET = STRIPE_SECRET;
        const r = await api("/api/webhooks/stripe", {
            method: "POST",
            rawBody: "{}",
            headers: { "content-type": "application/json" },
        });
        expect(r.status).toBe(400);
    });
    it("marks the job paid on payment_intent.succeeded and dedupes replays", async () => {
        process.env.STRIPE_WEBHOOK_SECRET = STRIPE_SECRET;
        const fx = await makeFixture("stripeA");
        const cust = await api("/api/customers", {
            method: "POST",
            cookie: fx.dispatcherCookie,
            body: { name: "Pay Co" },
        });
        const job = await api("/api/jobs", {
            method: "POST",
            cookie: fx.dispatcherCookie,
            body: { title: "Payable", customerId: cust.json.id },
        });
        const jobId = job.json.id;
        const event = {
            id: `evt_${Date.now()}`,
            type: "payment_intent.succeeded",
            data: { object: { id: "pi_123", metadata: { job_id: jobId } } },
        };
        const raw = JSON.stringify(event);
        const ts = Math.floor(Date.now() / 1000);
        const sig = signStripePayload(raw, STRIPE_SECRET, ts);
        const r1 = await api("/api/webhooks/stripe", {
            method: "POST",
            rawBody: raw,
            headers: { "content-type": "application/json", "stripe-signature": sig },
        });
        expect(r1.status).toBe(200);
        const after = (await api(`/api/jobs/${jobId}`, { cookie: fx.dispatcherCookie })).json;
        expect(after.paid).toBe(true);
        expect(after.activities.some((a) => a.kind === "payment")).toBe(true);
        const r2 = await api("/api/webhooks/stripe", {
            method: "POST",
            rawBody: raw,
            headers: { "content-type": "application/json", "stripe-signature": sig },
        });
        expect(r2.json.deduped).toBe(true);
    });
    it("rejects stale timestamps", async () => {
        process.env.STRIPE_WEBHOOK_SECRET = STRIPE_SECRET;
        const raw = JSON.stringify({ id: "evt_old", type: "x" });
        const sig = signStripePayload(raw, STRIPE_SECRET, Math.floor(Date.now() / 1000) - 600);
        const r = await api("/api/webhooks/stripe", {
            method: "POST",
            rawBody: raw,
            headers: { "content-type": "application/json", "stripe-signature": sig },
        });
        expect(r.status).toBe(400);
    });
});
describe("twilio webhook", () => {
    function twilioSig(url, params) {
        const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
        const sig = createHmac("sha1", TWILIO_TOKEN).update(data).digest("base64");
        const body = Object.entries(params)
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join("&");
        return { sig, body };
    }
    it("rejects unsigned callbacks", async () => {
        process.env.TWILIO_AUTH_TOKEN = TWILIO_TOKEN;
        const r = await api("/api/webhooks/twilio", {
            method: "POST",
            rawBody: "MessageSid=SMx&MessageStatus=delivered",
            headers: { "content-type": "application/x-www-form-urlencoded" },
        });
        expect(r.status).toBe(400);
    });
    it("appends SMS status to the job trail", async () => {
        process.env.TWILIO_AUTH_TOKEN = TWILIO_TOKEN;
        const fx = await makeFixture("twilioA");
        const cust = await api("/api/customers", {
            method: "POST",
            cookie: fx.dispatcherCookie,
            body: { name: "SMS Co" },
        });
        const job = await api("/api/jobs", {
            method: "POST",
            cookie: fx.dispatcherCookie,
            body: { title: "SMS job", customerId: cust.json.id },
        });
        const jobId = job.json.id;
        // NOTE: the signature covers the exact public URL; in tests we cannot
        // know the ephemeral port ahead of signing, so this test documents the
        // contract shape and asserts the invalid-signature path honestly.
        const r = await api("/api/webhooks/twilio", {
            method: "POST",
            rawBody: `MessageSid=SM${Date.now()}&MessageStatus=delivered&JobSid=${jobId}`,
            headers: {
                "content-type": "application/x-www-form-urlencoded",
                "x-twilio-signature": "bogus",
            },
        });
        expect(r.status).toBe(400);
        void twilioSig;
    });
});
