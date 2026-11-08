# FieldCRM — offline-first mini-CRM for home-service shops

A complete full-stack demo: multi-tenant auth, jobs pipeline (kanban), customers,
follow-ups with AI drafts, analytics, Stripe/Twilio webhooks, and an offline
outbox so field techs keep working without signal.

**Demo shop:** Blue Ridge Plumbing, a fictional Denver CO business. All content
is sample data from the seed — no real client data.

**Live demo:** coming with the Render deploy (see `docs/DEPLOY.md`) ·
**Companion lib:** `offline-outbox-js` (extracted sync engine, 36 tests)

## 60 seconds

```bash
docker compose up -d            # postgres 16
npm ci && npm run build
npm run seed -w server          # demo org + users + jobs
npm run dev:server              # :8100  (serves API; web via vite below)
npm run dev:web                 # :5174 → login luis@blueridge.example / Demo1234!
```

Then: advance a job on the kanban → toggle steps on the job page → open a
follow-up and generate its SMS draft → check Stats. Toggle DevTools offline and
watch writes queue in the Sync drawer instead of failing.

## Stack (mirrors the target role)

| Layer | Choice |
|---|---|
| Web | React 18 + TypeScript + Vite, Tailwind v4, shadcn/ui-idiom components |
| API | Node 22 + Express 5 + TypeScript |
| Data | PostgreSQL 16 + Drizzle ORM (Neon-compatible `DATABASE_URL`) |
| Auth | scrypt passwords + opaque sessions (httpOnly cookies), per-org isolation |
| AI | OpenAI-compatible draft seam, mock by default (`docs/PROVIDERS.md`) |
| Webhooks | Stripe + Twilio signature verification + idempotency |
| Mobile | Capacitor config for the web build (`docs/MOBILE.md`) |
| Deploy | Docker + `render.yaml` (Render web, Neon database) |

## How it maps to a home-service CRM role

| Requirement | Evidence |
|---|---|
| React/Node/TypeScript/Postgres | This repo, end to end |
| Internal CRM (client follow-ups) | Follow-ups page: due list, AI SMS drafts, done trail |
| Offline mode | Outbox drawer + durable queue; step toggles + advances work offline |
| Multi-tenant security | `orgId` on every query, proven by `authz` tests (cross-org → 404) |
| Auth + webhooks | Sessions, roles (owner/dispatcher/tech), Stripe/Twilio verify + replay tests |
| Analytics | Stats page: pipeline, revenue by tech, on-time %, overdue follow-ups |
| Observability | JSON logs (Coralogix-shaped), UI error boundary → `/api/client-errors` |
| AI-native workflow | Built with Claude Code; every line reviewed (see `ARCHITECTURE.md`) |

## Repo map

```
server/          Express API + Drizzle schema + Vitest suite (32 tests)
  src/routes/    auth, customers, jobs, followups, analytics, webhooks, ops
  src/lib/       db, auth, password (scrypt), ai (mock/live seam), webhooks verify
  drizzle/       versioned SQL migrations (Neon-ready)
web/             React 18 console (kanban, customers, follow-ups, stats, sync drawer)
shared/          status machine, roles, API shapes (single source of truth)
docs/            API, ARCHITECTURE, SECURITY, DEPLOY, INTEGRATIONS, PROVIDERS, MOBILE
```

## Verify

```bash
npm run test -w server   # 32 tests: auth, authz, pipeline, webhooks, analytics, AI seam
```

## Screenshots (captured from the live local run)

| Jobs kanban | Job + checklist | Follow-ups + AI draft |
|---|---|---|
| `screenshots/jobs-1440.png` | `screenshots/job-1440.png` | `screenshots/followups-1440.png` |

| Stats | Offline sync queue | Demo video |
|---|---|---|
| `screenshots/stats-1440.png` | `screenshots/sync-1440.png` | `demo/demo-kanban.webm` |

Responsive: `screenshots/jobs-390.png` (no horizontal overflow) + `jobs-768.png`.

## Honest limits

- Single-process demo: in-memory rate limit (Redis sliding window in production).
- No real-time sync between dispatchers (poll/refresh; webhooks cover async events).
- Twilio/Stripe are verified skeletons with fixtures — no live charges or SMS.
- Capacitor shell configured, native builds untested (no macOS runner here).
- AI drafts mock unless `OPENAI_BASE_URL` + `OPENAI_API_KEY` are set.

## License

MIT — portfolio demo by Tiago Colo.
