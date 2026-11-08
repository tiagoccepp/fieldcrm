# DESIGN.md — FieldCRM ops console (portfolio demo)

Fictional home-service CRM for a fictional US shop ("Blue Ridge Plumbing", Denver CO).
Audience: the Blueworks hiring team judging full-stack craft in 60 seconds.
ONE primary action per screen: advance the job (kanban) / log the follow-up (CRM).

## Direction: dense operational console

Calm enterprise tool, not a marketing site. Sidebar + topbar + content. Data density
over whitespace; every number tabular; sync/offline status always visible (field
techs lose signal — the JD's "big one"). Utilitarian type is intentional here:
system stack + tabular numerals, JetBrains Mono for IDs/amounts only.

## Palette

| Token | Hex | Role | Contrast |
|---|---|---|---|
| `--ink` | #1A2220 | body text | 14.2 on paper |
| `--paper` | #F7F5F0 | content surface | — |
| `--card` | #FFFFFF | cards, kanban cols | 15.9 ink |
| `--side` | #1E2E2A | sidebar (pine) | 12.1 paper text |
| `--accent` | #7A5E14 | brass, links + primary buttons on light | 5.9 |
| `--accent-dk` | #D9B36A | brass on sidebar | 7.0 on side |
| `--ok` | #2F6B4F | done/synced | 5.4 |
| `--warn` | #9A6A12 | pending/conflict | 4.8 |
| `--bad` | #A83226 | failed/overdue | 6.1 |
| `--line` | #E2DCCB | hairlines | decorative |
| `--muted` | #5A645F | secondary text | 5.6 |

One accent (brass), ≤2 uses per screen. Status colors encode job/offline state only.
Contrast pairs verified programmatically in QA (script asserts ≥4.5 on rendered pairs).

## Type roles

- UI/body: system stack, 0.9375rem/1.55, dense tables 0.875rem.
- Display (page titles, KPI numerals): system 700, tight tracking; KPI numerals
  `font-variant-numeric: tabular-nums`.
- Mono: JetBrains Mono (self-hosted woff2) for job IDs, amounts, timestamps, sync log.
- No hero type moment — this is a tool; the memorable quality is the offline
  badge + outbox drawer, not typography.

## Layout concept

```
+--------+--------------------------------------------------+
| LOGO   |  Page title              [● Online] [Org ▾] [Me] |
| Jobs   |  +-----------+-----------+-----------+---------+ |
| Custom.|  | SCHEDULED | EN ROUTE  | ON SITE   | DONE    | |
| Follow |  | card      | card      | card      | card    | |
| Stats  |  | [Advance] | [Advance] | [Advance] | paid ✓  | |
| Sync:3 |  +-----------+-----------+-----------+---------+ |
+--------+--------------------------------------------------+
```

Signature moments: (1) kanban with per-card Advance + offline queue badge;
(2) Sync drawer listing pending mutations with retry/discard; (3) Stats page
with inline-SVG bars (no chart lib). Forms in dialogs (shadcn/ui idiom:
button/input/dialog/table/badge vendored minimal set, same API names).

## Motion (apps, minimal)

1. Status transitions: card background pulse 300ms on advance.
2. Dialogs: fade+scale 150ms; drawer slides 200ms.
3. Sync badge: count bump animation on enqueue/ack.
4. `prefers-reduced-motion`: all static. No preloader, no scroll reveals —
   wrong vocabulary for a tool.

## Principles (what makes THIS console different)

1. Offline is a first-class citizen: outbox drawer + per-mutation state, not a toast.
2. Multi-tenant honesty: org switcher disabled with tooltip in demo (single seed org),
   isolation enforced server-side and proven by tests.
3. Every write is traceable: activities trail on each job (who/when/what).
4. Zero-magic UI: buttons name exact outcomes ("Mark en route", "Queue SMS draft").
5. EN copy, terse ops labels; errors name the fix ("Job already done — reopen first").

## Self-check vs ban-list

Risked: indigo SaaS kit + 4 identical stat cards + "→" CTAs. Changed: pine/brass
ops palette, stats as ruled ledger rows with inline bars (not cards), CTAs are
verbs ("Advance", "Draft follow-up"), no emoji status (text badges), no middot
meta strings. shadcn/ui idiom kept for components because the JD names it.
