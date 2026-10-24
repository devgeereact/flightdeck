# Flightdeck test strategy

## Existing commands
pnpm test: tsx --test server/*.test.ts. Four tests cover search validation, null for unknown operational details, preservation of zero delay/baggage, and constrained illustrative sample results. pnpm build: tsc --noEmit plus Vite/PWA build. No dedicated lint/typecheck/browser-test script exists. Playwright extension installation is not a test suite.

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
