# Architecture

```
web/ (React 18 + Vite + Tailwind) ── cookies ──▶ server/ (Express 5 + TS)
  pages: Jobs kanban, Job detail,      routes: auth/customers/jobs/
  Customers, Follow-ups, Stats         followups/analytics/webhooks/ops
  lib/outbox.ts (durable queue)        lib: db (Drizzle) · auth (sessions)
  components: ui idiom, ErrorBoundary       · password (scrypt) · ai (seam)
  SyncDrawer (queue state)                  · webhooks (HMAC verify)
shared/ (status machine, roles, API shapes — imported by both)
postgres:16 (docker local, Neon in prod) · drizzle/ SQL migrations
```

## Request flow

`requestId → securityHeaders → accessLog → rateLimit → (raw-body webhooks |
json API) → requireAuth → requireRole → org-scoped Drizzle query`. Every tenant
read/write filters by the session `orgId`; there is no unscoped tenant query
(grep `from(` in `routes/` — each has an `orgId` predicate; `authz` tests pin it).

## Offline story

Tech writes (status advance, step toggle) call the API when online and enqueue
a durable mutation (`localStorage`, same desired-state semantics) when not.
`SyncDrawer` shows pending/sending/failed with per-mutation errors; 4xx parks
as failed with the server message instead of retrying forever. The extracted,
fully-tested engine is the companion repo `offline-outbox-js`.

## AI seam

`POST /followups/:id/draft` → `lib/ai.ts`: mock unless `OPENAI_BASE_URL` +
`OPENAI_API_KEY` are set, then one `/chat/completions` call with a JSON
contract (`{draft}` ≤ 320 chars). No SDK, no streaming, no retries to hide
behind — failures return `502` with the cause.

## Builds

`npm run build` (root) → shared → server (`tsc`) → web (`tsc` + `vite build`).
Docker: web static is copied into `server/public` and served by Express, so one
container serves console + API. `render.yaml` deploys that image; Postgres comes
from Neon via `DATABASE_URL` (migrations run in the release step).

## AI-native workflow (honest)

Built with Claude Code as the coding tool; every file was read and the suite
(`32` server tests) plus the live smoke were run before commit. Anything the
demo does not do is listed in `README.md` under Honest limits — no faked depth.
