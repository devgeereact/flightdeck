# Proposed Node → PHP migration

Decision status: PROPOSED, implementation not approved by the docs task. Goal: meet the user's static/cPanel/PHP preference without buying another hosting runtime. Keep Node prototype and real behaviour recoverable.

1. Freeze endpoint contracts from docs/API and shared Flight types. Add fixtures for sample/live-shaped/null/error/timezone cases without copying secrets or real personal records.
2. Decide PHP runtime/extensions (HTTP client, JSON, cache options) from host, not assumed versions. Confirm deployment/private folder/public entrypoint mapping.
3. Port search/date validation, demo fixtures, provider normalisation and Open-Meteo requests behind PHP interfaces. Preserve response shape/source/demo/freshness and explicit missing boarding/position.
4. Implement bounded provider budgets/cache/limiting suitable for shared hosting; prefer simple supported facilities, not an invented queue/server daemon.
5. Test current Node versus PHP sample/negative/fixture contracts locally. No paid API call needed for initial parity. Real source integration remains gated on authorised credentials/licence.
6. Configure /api routing before SPA fallback, bearer forwarding if auth later exists, secrets outside webroots, TLS and no-store for dynamic data. Do not add Clerk/DB just for migration.
7. Run scoped staging smoke checks on user-approved domain; capture backup/rollback; do not change the main live site blindly.
8. Switch frontend API target/routing only after parity and staging acceptance. Archive/reference Node implementation instead of destructive deletion; cleanup is another reviewed change.

Acceptance: all FD-01..FD-09 relevant API journeys preserved, missing/error semantics match, type/build/tests pass, PHP checks pass, public staging works and rollback exercised. Current status: none of these migration steps has been implemented by this documentation pass.
