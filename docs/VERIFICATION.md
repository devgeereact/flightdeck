# Flightdeck verification evidence

Reviewed 24 October 2026. This task adds documentation/rules only; it does not certify a production release.

| Check | Result | Evidence and limit |
|---|---|---|
| Pre-edit safety backup | PASS | 25 source/config files individually SHA-256 verified in ~/repo-backups/flightdeck-2026-10-24-0022 |
| Application code/config preservation | SUPERSEDED | Held for the docs-only task. On 24 Oct 2026 the user approved replacing FlightAware with OpenSky: server/flight.ts, server/index.ts, src/types.ts, src/main.tsx, tests and .env.example changed intentionally |
| Unit tests | PASS | 24 Oct 2026 pnpm test: 6 tests passed (validation, callsign mapping, OpenSky state normalisation, null handling, sample data) |
| Type check + frontend/PWA build | PASS | 24 Oct 2026 pnpm build after OpenSky change: tsc --noEmit and Vite/PWA succeeded |
| Dependency install | NOT TESTED | Existing dependencies reused; package/lock/runtime config unchanged |
| Lint | NOT TESTED | No lint script/config defined; no fictional lint result |
| Documentation local links | PASS | Checked after final verification document was written |
| Browser journeys | PARTIAL | Desktop/mobile/demo/saved behaviour historically inspected 23 October; not rerun as full E2E in docs pass |
| Live weather | PARTIAL | Successful historical Open-Meteo retrieval; not revalidated in docs pass |
| Live flight provider (OpenSky) | PARTIAL | 24 Oct 2026, local server: OAuth2 token + /states/all succeeded; snapshot cache reused; callsign DL1 matched a real airborne aircraft. Not verified: UI rendering of live result, other carriers, credit usage under load, public-use terms |
| PHP API migration | PARTIAL | 24 Oct 2026, PHP 8.5.12 built-in server, local: php php/tests/run.php 15/15 pass; node php/tests/parity.mjs 14/14 identical to Node; live OpenSky + Open-Meteo through PHP; cache, 429 limiter, 405, safe error, 0600 files verified. NOT tested: Apache/.htaccess routing, cPanel PHP version/memory/extensions, Cloudflare, concurrent load |
| Accessibility/install/offline/update matrix | NOT TESTED | Release test plan exists, not a completed audit |
| Auth/DB | NOT TESTED | No account system or SQL database implemented; not required by current V1 |
| Git/GitHub sync/cleanup | BLOCKED | Project has no .git or remote; no initialisation, push or cleanup performed |
| Public deployment | PARTIAL | 24 Oct 2026 manual deploy to flightdeck.gakinz.com: HTTPS pages and API smoke tests pass, browser render OK (details in DEPLOYMENT.md). CI/auto-deploy NOT TESTED (no repo/workflow). PWA update behaviour affected by Cloudflare cache TTL |

Historical feature checks are not promoted to fresh passes. No newly configured integration, current server runtime or live-source availability is implied. Update this table only with actual reproducible evidence.

## Hosting probe, 24 October 2026
PASS: target discovery (cPanel roots, FTP account list), origin FTPS certificate, scoped FTP login/root, GitHub secrets saved by name, manual workflow run 40077621830, public HTTPS exact marker page, cleanup. PARTIAL: Cloudflare (no API access in this session; Full strict, Browser Cache TTL unverified), manifest MIME. NOT TESTED: production release workflow, private PHP release, PWA install/update.
