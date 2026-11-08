# Providers (AI drafts)

`POST /api/followups/:id/draft` needs no key: it ships a mock that writes a
short addressed SMS from the follow-up title. Set these to go live:

| Var | Example |
|---|---|
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` (or any OpenAI-compatible host) |
| `OPENAI_API_KEY` | `sk-…` (server-side only, never shipped to the browser) |
| `OPENAI_MODEL` | `gpt-4o-mini` (default) |

Contract: one `/chat/completions` call, `response_format: json_object`,
`max_tokens: 300`, system prompt pinned in `server/src/lib/ai.ts`
(≤320 chars, one next step, no invented prices/dates, plain text).

The response tells you which path ran: `{draft, provider: "mock"|"live", model}`.
The draft is stored on the follow-up either way. Failures return `502` with the
cause — drafts never silently fall back after keys are configured (a configured
provider that errors is a bug to fix, not a mock to hide behind).
