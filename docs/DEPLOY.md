# Deploy (Render + Neon, free tier)

One Docker image serves console + API. Postgres comes from Neon (the Render
free database expires; Neon free persists).

## 1. Database (Neon, ~3 min)

1. Create a project at neon.tech, copy the pooled connection string.
2. From this repo with `DATABASE_URL` exported:
   `npm ci -w server && npm run build -w shared && node server/dist/migrate.js`
   (or `node --import tsx server/src/migrate.ts` without a build).
3. Seed the demo org: `npm run seed -w server`.

## 2. Web service (Render, ~5 min)

1. New → Web Service → connect this repo. Render reads `render.yaml`.
2. Set `DATABASE_URL` to the Neon string (secret, never committed).
3. `SESSION_SECRET` generates automatically. Deploy.

`GET /api/health` must return `{ok:true}`. First load may take ~60s on free
(cold start) — the login page explains nothing; the health check is the probe.

## 3. After deploy

- Set the repo homepage + `LIVE_VERIFIED.md` with the public URL + date.
- Cold-start note: free Render sleeps after 15 min idle; screenshots and the
  video in this repo cover the recruiter who will not wait.

## Local prod-like run

```bash
docker compose up -d
docker build -t fieldcrm . && docker run -p 10000:10000 \
  -e DATABASE_URL=postgres://fieldcrm:fieldcrm@host.docker.internal:5433/fieldcrm \
  -e SESSION_SECRET=local-dev-only-min-32-chars fieldcrm
```
