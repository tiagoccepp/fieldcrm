# API

Base: same origin (`/api`). Auth: `fieldcrm_session` httpOnly cookie from
`POST /api/auth/login`. All tenant routes 404 (not 403) outside your org.
Errors: `{error, hint?}`. Rate limit: 240 req/min/IP (`429` + `Retry-After`).

## Auth

| Method | Route | Body | Notes |
|---|---|---|---|
| POST | `/api/auth/login` | `{email, password}` | Sets cookie, 30-day session |
| POST | `/api/auth/logout` | — | Revokes session |
| GET | `/api/auth/me` | — | `{id, orgId, orgName, email, name, role}` |

No public signup (demo users come from the seed).

## Customers (tech: read-only)

`GET /api/customers` · `POST /api/customers` `{name, phone?, email?, address?, notes?}` ·
`GET/PATCH /api/customers/:id`

## Jobs

`GET /api/jobs?status=` — techs get assigned-only. `POST /api/jobs`
(owner/dispatcher): `{title, customerId, description?, priceCents?, scheduledFor?,
assignedTo?, steps?: string[]}`. `GET /api/jobs/:id` → job + steps + activity trail.

`PATCH /api/jobs/:id/status` `{status}` — pipeline order enforced
(`scheduled → en_route → on_site → done`, `→ canceled` by dispatcher+).
Invalid moves return `409` naming the fix.

`PATCH /api/jobs/:id/steps/:stepId` `{done: boolean}` — idempotent desired-state
writes (safe to replay from the offline outbox). Locked on done/canceled (`409`).

## Follow-ups

`GET /api/followups?open=1` · `POST /api/followups`
`{title, customerId, jobId?, dueAt?}` · `PATCH /api/followups/:id` `{done?, title?}` ·
`POST /api/followups/:id/draft` `{tone?}` → `{draft, provider: mock|live, model}`
(stores the draft; dispatcher+).

## Analytics

`GET /api/analytics/summary` → `{pipeline, jobsThisWeek, doneThisWeek,
revenueCents: {total, byTech[]}, onTimePct|null, overdueFollowups}`.
Revenue counts done+paid jobs only.

## Webhooks (no cookie; HMAC signatures)

`POST /api/webhooks/stripe` — `stripe-signature: t=…,v1=…`, 5-min tolerance.
`payment_intent.succeeded` + `metadata.job_id` marks the job paid and logs a
`payment` activity. `POST /api/webhooks/twilio` — `X-Twilio-Signature` over
URL+sorted params; appends `sms` activities. Both dedupe on `(source, event id)`
and return `{deduped:true}` on replay.

## Ops

`GET /api/health` → `{ok, uptimeSec, version}` (`503` when Postgres is down).
`POST /api/client-errors` `{message, url?, stack?}` — UI crash reports.
