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
PASS: target discovery (cPanel roots, FTP account list), origin FTPS certificate, scoped FTP login/root, GitHub secrets saved by name, manual workflow run 40077621830, public HTTPS exact marker page, cleanup. PASS (Skyhook, 24 Oct 2026): Cloudflare SSL strict and hostname-scoped respect-origin cache rule verified by API; manifest MIME application/manifest+json live; production release run 40078631011 (tests, build, restricted-key PHP rsync, additive FTPS upload, public checks); restricted key denies shell and --delete. NOT TESTED: PWA install/offline/update on a device; rollback of a prior release.

## Live data pipeline, 24 October 2026
PASS: php tests 46/46 (mapping from a schema-derived AeroDataBox fixture, spend limits, caching, cooldown, route lookup, merge rules); pnpm test 6/6; pnpm build. PASS live through the local PHP server: OpenSky + adsbdb for EK1 (DXB to LHR, progress, distance, ETA estimate) and LH400. NOT TESTED: AeroDataBox against the real service (no key yet; fixture is derived from the published OpenAPI spec, not a captured response, and the unit cost per call is assumed to be 2); UI in a browser; Node/PHP parity run for the changed config route; production deploy.

## AeroDataBox verified against the real service, 24 October 2026
PASS (RapidAPI Basic, free): BA117 (arrived LHR to JFK, real times, terminals 5 to 8, Boeing 777-200 G-VIIW), EK1 (arrived DXB to LHR, gate A9, belt 06, A380), LH400 (departed FRA to JFK, gate Z13, progress from times). Provider headers confirmed the allowance (400 API units; 2 units per flight-status call) and the server's own counter matches. Repeat request served from cache (no extra units). Real responses exposed two mapping flaws, fixed with tests: delay must be measured on departure (the UI label), and an arrived flight is 100% (basis "status"). Where the aircraft has no OpenSky coverage (mid-Atlantic) there is no live position and progress falls back to flight times, labelled. php tests 50/50. Earlier "unit cost assumed" caveat is closed. Still NOT TESTED: UI in a browser; the key on the production server (not yet added); production release. Note: the production config.php does not yet contain aerodatabox_key.

## Live release of the data pipeline, 24 October 2026
Release run 40106000059 (production at 05e13b1) PASS: pnpm test, test:php, build, additive PHP rsync, static FTPS release with public HTTPS verification. Server config.php gained aerodatabox_key (mode 600, backup config.php.bak-202610241107; key never printed). Live smoke test via Cloudflare PASS: home, manifest (application/manifest+json), sw.js, 400 on bad input, demo, LH400 live (AeroDataBox + OpenSky: Departed FRA to JFK, gate Z13, A330-300, progress 73% from flight times), repeat request cached, no secrets or private paths in responses. NOT TESTED: UI in a browser, PWA update on a device, rate-limit trust (trust_cf_connecting_ip still false: all visitors share one 30/min bucket).

## Fixes after the live browser check, 24 October 2026
Found in the real browser (Chrome, live site): the PWA used registerType "prompt" with no update UI, so a new release sat in a waiting service worker forever and installed users stayed on the old bundle (browser ran index-CPucRI78 while the server served index-xWAw5PhD). Fix: in-app registration via virtual:pwa-register, a "Reload to update" banner when a new version is waiting, an hourly update check, workbox-window added as a dev dependency. Verified structurally (sw.js skips waiting only on the SKIP_WAITING message; bundle contains banner and waiting handling; registerSW.js no longer injected) but NOT end to end: headless Chrome would not start in this sandbox and the extension browser cannot reach localhost. The first release containing this fix is the first that can show the banner; the NEXT release will prove it. Existing stuck browsers recover by closing all Flightdeck tabs/windows once.
Rate limit: CF-Connecting-IP is now trusted only when the connecting peer is inside Cloudflare's published ranges (php/private/src/CloudflareIps.php, 6 tests incl. spoofing). The server flag trust_cf_connecting_ip must stay false until this code is released; then set true and verify.
Actions: checkout v7.0.1 and setup-node v7.1.0 (both Node 24, commit SHAs pinned) in release.yml and hosting-probe.yml. php tests 56/56.
