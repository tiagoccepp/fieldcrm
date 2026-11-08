# Security

Threat model: a curious user in org A (or a logged-out caller) must never read
or mutate org B's data; webhook endpoints must reject forged calls; sessions
must be revocable.

## What is enforced

- **Multi-tenant isolation:** `orgId` from the session, applied in every tenant
  query. Cross-org reads return `404` (no existence oracle). Proven by
  `server/test/authz.test.ts` (6 tests).
- **Roles:** owner/dispatcher manage; techs see and advance only assigned jobs,
  cannot create customers/follow-ups, cannot cancel or draft. Pinned by tests.
- **Auth:** scrypt password hashes, opaque 256-bit session tokens (sha256 in DB,
  httpOnly + SameSite=Lax cookies, 30-day expiry, logout revokes server-side).
- **Webhooks:** Stripe `t,v1` HMAC-SHA256 with 5-minute tolerance; Twilio
  HMAC-SHA1 over URL+params; both `timingSafeEqual`, both refuse to verify
  without their secret (loud `400`, never silent pass); idempotent replay log.
- **Pipeline integrity:** status transitions validated server-side (`409` on
  skips); steps lock on done/canceled; step writes are idempotent desired-state.
- **Headers + limits:** nosniff, DENY framing, no-referrer, tight CSP; JSON body
  cap 256kb; 240 req/min/IP with `Retry-After`.

## Honest limits (demo scope)

- In-memory rate limit is per-process — production wants Redis sliding window.
- No 2FA, no password-reset flow, no audit export (activity trail exists per job).
- Cookies are `Secure` only in production; demo runs http on localhost.
- `POST /api/client-errors` is unauthenticated by design (login page can crash
  too) — rate-limited, length-capped, never echoes input.
