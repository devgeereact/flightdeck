# Flightdeck testing

Reviewed 1 November 2026. Rule from the owner: test locally first, look at the result, then push.

| Command | What it proves |
|---|---|
| `pnpm docs:check` | The docs agree with the code: every API route the router answers is in `docs/API.md`, no retired phrase (guest-only, not released, Google Fonts, dead files) is in a live doc, and every repo path a doc names exists. Part of `pnpm check`; tested by `test/docs-check.test.mjs`. |
| `pnpm check` | The core of the CI gate: Biome (errors), `pnpm docs:check`, `pnpm test`, `pnpm test:php`, production build (the build runs `tsc --noEmit` with `noUnusedLocals`, over `src/` and the TypeScript tests, so types and dead locals are checked once). CI adds `pnpm test:ui`, `pnpm test:console`, `php -l` and gitleaks. |
| `pnpm test` | Unit and page tests (190 on 9 Nov 2026; includes the Journey-agreement tests in `test/key-times.test.ts`; includes `test/crash-guards.test.ts`; includes `test/api-http.test.mjs` (17 route and router tests on three throwaway PHP servers) and `test/events-drift.test.mjs`; includes `test/config-patch.test.mjs` and `test/backup-scripts.test.mjs` (the owner-run server scripts, run against a fake ssh/crontab so nothing touches a server); includes `test/docs-check.test.mjs`, which runs the docs check on the repository, and `test/release-gate.test.mjs`, which fails if a workflow stops gating the deploy, an action is unpinned, PHP is not 8.4, or the smoke list loses its sign-in checks): flight times and key times, countdown, calendar file, packing list, consent, every public page rendered by PHP (`test/site.test.mjs`), the CMS over the real PHP router with signed test tokens (`test/cms-http.test.mjs`), local preview switch, CMS seed check. |
| `pnpm test:php` | PHP suite: flight mapping, time zones, rate buckets, auth, CMS store, Markdown XSS, media, health, enquiries, travel guides, web check (off by default, cache, daily cap), forecast rows. |
| `pnpm test:ui` | The real app build in jsdom with fixed fixtures (no provider units spent): tracker, flight page (gates and key times, weather and Discover beside the flight, tabs), saved flights, packing room, help, accessibility basics. `UI_TEST_LIVE=1` adds one real provider check. |
| `pnpm test:console` | (port 3995; its parent component mirrors the real app's, because a quieter parent once hid a request loop, check C22) The owner console in jsdom against a throwaway server: edit, draft, preview, publish, restore, FAQ order, inbox, health, audit, non-owner refused. |
| `bash scripts/check-apache-routes.sh` | macOS only: `dist/` under Apache + PHP-FPM in the host's layout: route and header checks. |
| `node ~/.claude/skills/product-design/scripts/shots.mjs --axe` | Screenshots at several widths, sideways-overflow check and axe-core WCAG 2.2 AA audit. |

## What to check by eye before a release
Screens at 1440 and 390 (plus 834/1920 for layout work), every state (loading, empty, error, not reported), print for the packing list. Record results in docs/AUDIT.md.

## Release matrix (the risky parts)
- Times: scheduled vs estimated vs actual; gate-out vs take-off vs landing vs gate-in; "Typical" boarding and gate-close times are labelled and move with a delay; nothing is invented when no time exists; DST and cross-midnight.
- Gates, terminals, belts: shown only when reported, "Usually T5" hints labelled, otherwise "Not reported yet".
- Weather: now, at landing (within 7 days), next days; failure says so.
- Travel guide: any city via Wikivoyage/Wikipedia with source and licence; unknown city says so.
- Saved flights and packing list: empty, save, remove, sync conflict, offline.
- Never presented as tracking: the route drawing is a diagram; position only from OpenSky.

Not testable from this Mac: a real phone, a real screen reader, a paper print, Firefox (BLOCKED, will not launch here).
