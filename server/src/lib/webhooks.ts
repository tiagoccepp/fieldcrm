import { createHmac, timingSafeEqual } from "node:crypto";

// Webhook signature verification (skeletons with honest semantics):
// - Stripe: HMAC-SHA256 over "<timestamp>.<rawBody>", header "stripe-signature"
//   in the form "t=<ts>,v1=<hex>". Timestamp must be within 5 minutes.
// - Twilio: HMAC-SHA1 over URL+sorted params (X-Twilio-Signature), base64.
// Both reject loudly without their secret configured (500, never silent pass).

export interface StripeCheck {
  ok: boolean;
  reason?: string;
}

export function verifyStripeSignature(
  rawBody: string,
  header: string | undefined,
  secret: string | undefined,
  nowSec = Math.floor(Date.now() / 1000),
): StripeCheck {
  if (!secret) return { ok: false, reason: "STRIPE_WEBHOOK_SECRET not configured" };
  if (!header) return { ok: false, reason: "Missing stripe-signature header" };
  const parts: Record<string, string> = {};
  for (const kv of header.split(",")) {
    const i = kv.indexOf("=");
    if (i > 0) parts[kv.slice(0, i)] = kv.slice(i + 1);
  }
  const ts = Number(parts.t);
  const v1 = parts.v1;
  if (!ts || !v1) return { ok: false, reason: "Malformed stripe-signature header" };
  if (Math.abs(nowSec - ts) > 300)
    return { ok: false, reason: "Timestamp outside 5-minute tolerance" };
  const expected = createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(v1, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b))
    return { ok: false, reason: "Signature mismatch" };
  return { ok: true };
}

export function signStripePayload(rawBody: string, secret: string, ts: number): string {
  const v1 = createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest("hex");
  return `t=${ts},v1=${v1}`;
}

export function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  header: string | undefined,
  authToken: string | undefined,
): StripeCheck {
  if (!authToken) return { ok: false, reason: "TWILIO_AUTH_TOKEN not configured" };
  if (!header) return { ok: false, reason: "Missing X-Twilio-Signature header" };
  const data =
    url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = createHmac("sha1", authToken).update(data).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  if (a.length !== b.length || !timingSafeEqual(a, b))
    return { ok: false, reason: "Signature mismatch" };
  return { ok: true };
}
