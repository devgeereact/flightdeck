# Proposed Node → PHP migration

Decision status: APPROVED by the user on 24 October 2026 and IMPLEMENTED LOCALLY (not deployed, not tested on cPanel). Goal: meet the user's static/cPanel/PHP preference without buying another hosting runtime. Keep Node prototype and real behaviour recoverable.

1. Freeze endpoint contracts from docs/API and shared Flight types. Add fixtures for sample/live-shaped/null/error/timezone cases without copying secrets or real personal records.
2. Decide PHP runtime/extensions (HTTP client, JSON, cache options) from host, not assumed versions. Confirm deployment/private folder/public entrypoint mapping.
3. Port search/date validation, demo fixtures, provider normalisation and Open-Meteo requests behind PHP interfaces. Preserve response shape/source/demo/freshness and explicit missing boarding/position.
4. Implement bounded provider budgets/cache/limiting suitable for shared hosting; prefer simple supported facilities, not an invented queue/server daemon.
5. Test current Node versus PHP sample/negative/fixture contracts locally. No paid API call needed for initial parity. Real source integration remains gated on authorised credentials/licence.
6. Configure /api routing before SPA fallback, bearer forwarding if auth later exists, secrets outside webroots, TLS and no-store for dynamic data. Do not add Clerk/DB just for migration.
7. Run scoped staging smoke checks on user-approved domain; capture backup/rollback; do not change the main live site blindly.
8. Switch frontend API target/routing only after parity and staging acceptance. Archive/reference Node implementation instead of destructive deletion; cleanup is another reviewed change.

Acceptance: all FD-01..FD-09 relevant API journeys preserved, missing/error semantics match, type/build/tests pass, PHP checks pass, public staging works and rollback exercised. Current status: none of these migration steps has been implemented by this documentation pass.

## Implementation status (24 October 2026)
Code: public/api/index.php (public entrypoint, copied into dist/api), php/private/src/* (Flight, OpenSky, Store, Http, App, bootstrap), php/private/config.example.php, public/.htaccess (API before SPA fallback, cache headers), php/dev-router.php (local only), php/tests/run.php, php/tests/parity.mjs. Node server/ is kept unchanged as the reference.

Steps 1, 3, 4, 5 and the code for 6 are done locally: 15 PHP unit checks pass; parity script reports identical status and JSON for 14 deterministic cases (config, demo flights, validation errors, weather validation, unknown route); live OpenSky lookup (DL1) and live Open-Meteo weather work through PHP; snapshot cache, 30/min rate limit (31st request returns 429), file permissions 0600 and the unconfigured-server error were exercised on PHP 8.5.12 with the built-in server.

Intentional differences from Node: unknown mode values return 400 instead of falling into live mode; non-GET/HEAD methods return JSON 405 instead of an HTML 404. The live snapshot is stored as JSON in php/private/var (about 0.85 MB) and decoding the OpenSky response needs tens of MB of PHP memory.

NOT done: step 2 (cPanel PHP version/extensions/memory_limit unknown; code avoids PHP 8-only syntax but was only run on 8.5), step 7 (staging on flightdeck.gakinz.com), step 8 (switching/rollback). Behind Cloudflare set trust_cf_connecting_ip only after confirming the header reaches PHP; otherwise all visitors share one rate-limit bucket.
