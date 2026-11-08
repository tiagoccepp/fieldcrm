# Submission — Full-Stack Developer (home-service CRM)

**Tiago Colo** · github.com/tiagoccepp · fieldcrm + offline-outbox-js

## What I built

A working mini-CRM for a fictional home-service shop, on your exact stack:

- **FieldCRM** (`fieldcrm/`): React 18 + Express + Drizzle/Postgres, Tailwind +
  shadcn/ui-idiom console. Multi-tenant auth with roles, jobs kanban with an
  offline outbox, customers, follow-ups with AI SMS drafts, analytics, and
  Stripe/Twilio webhooks with signature verification. 32 backend tests green,
  Docker + `render.yaml` + Neon-ready migrations.
- **offline-outbox-js** (companion repo): the extracted sync engine — durable
  mutation queue with backoff, conflict strategies, and a field-tech demo page.
  36 tests green, zero runtime deps.

## Where to look (2 minutes)

1. `fieldcrm/README.md` — 60-second run + stack table.
2. Kanban → advance a job → Sync drawer (offline story in one flow).
3. `server/test/authz.test.ts` — multi-tenant isolation proof.
4. `server/src/lib/webhooks.ts` + `test/webhooks.test.ts` — verified skeletons.
5. `docs/SECURITY.md` — threat model and honest limits.

## Verify

```bash
git clone https://github.com/tiagoccepp/fieldcrm && cd fieldcrm
docker compose up -d && npm ci && npm run build
npm run test -w server   # 32 green
```

No cloud accounts or API keys needed: Postgres runs locally, AI drafts mock.
