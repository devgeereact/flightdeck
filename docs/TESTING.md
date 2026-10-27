# Flightdeck test strategy

## Commands (added 24 Oct 2026)
(Archived 25 Oct 2026, ADR-018) pnpm test:php runs php/tests/run.php. pnpm parity compares Node and PHP responses; start Node (PORT=3999 npx tsx server/index.ts) and PHP (FLIGHTDECK_PRIVATE=$PWD/php/private php -S 127.0.0.1:3998 php/dev-router.php) first.

## Existing commands
(Archived 25 Oct 2026, ADR-018) pnpm test: tsx --test server/*.test.ts. Four tests cover search validation, null for unknown operational details, preservation of zero delay/baggage, and constrained illustrative sample results. pnpm build: tsc --noEmit plus Vite/PWA build. No dedicated lint/typecheck/browser-test script exists. Playwright extension installation is not a test suite.

## Release test matrix
- FD-01: supported/unsupported number, whitespace, invalid date, repeated carrier flight, cross-midnight, DST, codeshare, multi-segment selection and latest-request-wins.
- FD-02/03: distinguish scheduled/estimated/actual and gate-out/takeoff/landing/gate-in; null boarding/gates/belt never guessed.
- FD-04/05: error after good data clearly stale; change feed matches selected segment; no auto-refresh overlaps/new-search races; offline stops polling; provider quota failures and local limits recover.
- FD-06: weather timeout/malformed payload, missing coordinates, stale timestamp, actual timezone and current-versus-future label.
- FD-07: curated cards/source links, fallback unknown city, honest distance/coverage and licences.
- FD-08: new browser with no saved data, save/reopen/remove, six-item cap, malformed JSON/object, full/blocked storage, reload and keyboard operation.
- FD-09: cold/repeat visit, desktop/mobile install, offline shell, reconnect and deployed release update. Ensure private/provider data isn't cached by service worker.
- FD-10: position remains unavailable without real source; route drawing is never presented as tracking.

Use isolated test data. No seed business records required. Live-provider, account/login, paid quota, real mail and production mutations need appropriate access/authorisation. No user accounts currently exist to test.

Record exact evidence and limitations in VERIFICATION. Build/unit success alone is not a full app pass. A PHP migration needs HTTP contract/parity tests for config/search/weather and missing-key failures before switching the host.

## Local gate before any push or release (rule from the owner, 24 Oct 2026)
Test locally FIRST, then push. Required before pushing main or asking for a release: `pnpm test`, `pnpm test:php`, `pnpm test:ui`, `pnpm build`, and a look at the result. `pnpm test:ui` (test/ui-smoke.mjs) builds the real source, serves it with the PHP dev router using your .env keys and drives it in jsdom: default state with live data available (must open on live, empty search, no demo), a real live search, fallback to the sample flight when no providers are configured, and a remembered "Sample flights" choice. It is local only (uses provider keys, may spend 2 AeroDataBox units) and is not in the release workflow. A green unit-test run alone is not enough: the "still showing the demo" bug of 24 Oct 2026 passed every unit test.

## UI smoke test data (25 Oct 2026)
`pnpm test:ui` runs the real built app in jsdom against fixed flight and weather data, so it gives the same result at any hour and spends no provider units. To also run one check against the real providers, use `UI_TEST_LIVE=1 pnpm test:ui`.

## Rebrand and CMS tests (25 Oct 2026)

| Command | What it proves |
|---|---|
| `pnpm test` | (104 tests as of 26 Oct 2026) Unit and page tests, plus `test/site.test.mjs` (every public page rendered by PHP: document structure, no third parties, safe links, legal wording, ads gate, JSON-LD, shared links, announcements) and `test/cms-http.test.mjs` (real PHP router, throwaway private folder, locally signed tokens: 401/403 on every CMS route, draft vs live, conflict, restore, XSS, pages, FAQs, announcements, settings, navigation, operations). 106 tests. |
| `pnpm test:php` | PHP suite, including Markdown XSS cases, media re-encoding, health and enquiry notes (media tests skip where GD is missing). |
| `pnpm test:ui` | The app in jsdom (50 checks). Uses the real php/private folder and .env keys, as before. |
| `pnpm test:console` | The owner console in jsdom against a throwaway server (16 checks: edit, field error, draft, preview, publish, history restore, new FAQ, resolve enquiry, health, audit, non-owner refused). |
| `node scripts/seed-content.mjs --check` | The CMS seed matches its sources (also run inside `pnpm test`). |
| `bash scripts/check-apache-routes.sh` | macOS only: dist/ under Apache + PHP-FPM in the host's layout, with stale static pages present: 22 route and header checks. |
| `npx vite build -c vite.console-test.config.ts && node test/console-ui.mjs` | Serves the console harness for a manual look or screenshots (prints an owner URL with a test token). |

The release workflow runs `pnpm test` and `pnpm test:php`. `test:ui`, `test:console` and the Apache check are local gates before a release.
