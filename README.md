# FieldCRM — Offline-First Mini-CRM for Home-Service Shops

> Kanban pipeline, customers, AI-drafted follow-ups, analytics, and an offline outbox — so field techs keep working with zero signal.

![React](https://img.shields.io/badge/React-18-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Node](https://img.shields.io/badge/Node-22-green) ![Postgres](https://img.shields.io/badge/PostgreSQL-16-blue) ![Tests](https://img.shields.io/badge/tests-32_Vitest-brightgreen)

**🚀 Live demo:** https://fieldcrm-60xk.onrender.com (login: luis@blueridge.example / Demo1234! · free tier sleeps after 15 min idle, first load ~60s) · **🎬 Demo video:** `demo/demo-kanban.webm` · **📸 Screenshots:** `screenshots/` (kanban, job checklist, follow-ups, stats, sync queue + responsive 390/768px)

**Demo shop:** Blue Ridge Window Cleaning — a fictional Denver CO business. All content is seed data.

## The problem it solves

Home-service shops lose follow-ups and field updates fall through the cracks the moment a tech loses signal. FieldCRM is a complete full-stack demo: multi-tenant auth, a jobs pipeline, customer records, follow-ups with AI-drafted SMS, revenue analytics, Stripe/Twilio webhooks — and a durable offline outbox so field writes queue instead of failing.

## Quickstart (60 seconds)

```bash
docker compose up -d            # postgres 16
npm ci && npm run build
npm run seed -w server          # demo org + users + jobs
npm run dev:server              # :8100 API
npm run dev:web                 # :5174 → luis@blueridge.example / Demo1234!
```

Try it: advance a job on the kanban → toggle checklist steps on the job page → open a follow-up and generate its SMS draft → check Stats. Toggle DevTools offline and watch writes queue in the Sync drawer.

## Stack

| Layer | Choice |
|---|---|
| Web | React 18 + TypeScript + Vite, Tailwind v4 |
| API | Node 22 + Express 5 + TypeScript |
| Data | PostgreSQL 16 + Drizzle ORM (`DATABASE_URL`, Neon-compatible) |
| Auth | scrypt passwords + opaque sessions (httpOnly cookies), per-org isolation |
| AI | OpenAI-compatible draft seam, mock by default (`docs/PROVIDERS.md`) |
| Webhooks | Stripe + Twilio signature verification + idempotency |
| Mobile | Capacitor config for the web build (`docs/MOBILE.md`) |
| Deploy | Docker + `render.yaml` (Render web, Neon database) |

## Repo map

```
server/          Express API + Drizzle schema + Vitest suite (32 tests)
  src/routes/    auth, customers, jobs, followups, analytics, webhooks, ops
  src/lib/       db, auth, passwords, ai seam, webhook verification
  drizzle/       versioned SQL migrations
web/             React console: kanban, customers, follow-ups, stats, sync drawer
shared/          status machine, roles, API shapes (single source of truth)
docs/            API, ARCHITECTURE, SECURITY, DEPLOY, INTEGRATIONS, PROVIDERS, MOBILE
screenshots/     1440px captures + 390/768px responsive checks
demo/            demo-kanban.webm walkthrough
```

## Tests

```bash
npm run test -w server   # 32 tests: auth, authz (cross-org → 404), pipeline, webhooks, analytics, AI seam
```

## Honest limits

- Single-process demo: in-memory rate limit (Redis sliding window in production).
- No real-time sync between dispatchers (poll/refresh; webhooks cover async events).
- Twilio/Stripe are verified skeletons with fixtures — no live charges or SMS.
- Capacitor shell configured, native builds untested.
- AI drafts mock unless `OPENAI_BASE_URL` + `OPENAI_API_KEY` are set.

## License

MIT — portfolio demo by Tiago Colo. (LICENSE file to be added.)
