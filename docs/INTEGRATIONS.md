# Integrations (Stripe + Twilio skeletons)

Both are verified skeletons: real signature checks, real idempotency, fixtures
and tests — no live charges or SMS. Wire keys to go live; nothing in the route
code changes.

## Stripe → mark job paid

Dashboard → Developers → Webhooks → endpoint
`https://<host>/api/webhooks/stripe`, event `payment_intent.succeeded`,
signing secret → `STRIPE_WEBHOOK_SECRET`. Include `metadata.job_id` when
creating the PaymentIntent (the demo checkout would set it from the job page).

Replay locally (needs the secret + a job id):

```bash
SECRET=whsec_local JOB=<job-id> node - <<'EOF'
import { signStripePayload } from './server/dist/lib/webhooks.js';
const raw = JSON.stringify({ id: 'evt_local1', type: 'payment_intent.succeeded',
  data: { object: { metadata: { job_id: process.env.JOB } } } });
const ts = Math.floor(Date.now() / 1000);
const sig = signStripePayload(raw, process.env.SECRET, ts);
const r = await fetch('http://127.0.0.1:8100/api/webhooks/stripe',
  { method: 'POST', headers: { 'stripe-signature': sig }, body: raw });
console.log(r.status, await r.text());
EOF
```

Second POST of the same `id` returns `{deduped:true}`.

## Twilio → SMS status on the job trail

Number → Messaging → StatusCallback `https://<host>/api/webhooks/twilio`,
AuthToken → `TWILIO_AUTH_TOKEN`. Include the job id as `JobSid` when sending
(the demo sender would attach it). statuses land as `sms` activities.

## Where the seams are

Verify: `server/src/lib/webhooks.ts`. Routes: `server/src/routes/webhooks.ts`.
Tests: `server/test/webhooks.test.ts` (unsigned → 400, paid flow, replay dedupe,
stale timestamp). Event log table: `webhook_events(source, event_id unique)`.
