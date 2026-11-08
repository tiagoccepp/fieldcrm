# Mobile (Capacitor shell)

The web console is the mobile UI: responsive layouts, 44px+ touch targets on
job actions, and the offline outbox (the field story) work in any mobile
browser. The native shell is configured, not built here:

- `capacitor.config.ts` at the repo root (`webDir: web/dist`).
- To wrap: `npm i -D @capacitor/cli && npx cap init FieldCRM app.fieldcrm.demo
  --web-dir web/dist && npm run build -w web && npx cap add ios android &&
  npx cap sync`.

Honest scope: native builds are untested in this repo (no macOS runner, no
device lab). What IS proven: the 390px layouts (see `screenshots/*-390.png`),
offline queueing (airplane-mode safe), and touch-sized controls.
