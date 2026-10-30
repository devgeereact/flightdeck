# Flightdeck roadmap

## P0 — foundations and confirmed decisions
- F0: confirm domain/repo/source licence/budget and PHP parity scope. Exit: decisions recorded; no API key in source.
- F1: preserve prototype and establish contract fixtures/tests from implemented /api endpoints. Exit: sample/missing-key/weather semantics reproducible.

## P1 — hosting-compatible API, after separate approval
- F2: implement PHP validation/provider/weather/cache/rate adapters with private config. Exit: Node/PHP contract parity and negative tests pass locally.
- F3: verify cPanel PHP/extensions/routing on a scoped staging subdomain. Exit: HTTPS/API/deep links and controlled resource usage; rollback verified. No migration approval/deployment has yet occurred.

## P2 — usable live service
- F4: connect an approved licensed flight source and verify coverage/timezones/codeshares/status/gates/baggage. Exit: real provider evidence; unavailable fields honest; spending bounded.
- F5: add destination coverage selected by product scope. Exit: useful linked tips with sources, coverage and location semantics documented.

## P3 — quality and release
- F6: scoped UI extraction/readability/accessibility and storage/error fixes.
- F7: complete PWA icons/update UX/offline/reconnect/device checks.
- F8 (DONE 24 Oct 2026 by Skyhook, run 40078631011): dedicated FTPS account and low-minutes GitHub release workflow after Git/repo/targets are separately approved. Exit: real successful authorised deploy and public smoke checks.

Current: documentation/governance completed in this task; product code unchanged. Do not mark future milestones complete based on scaffold or docs existence. No calendar estimates are promised.

## Code-quality follow-ups — 28 October 2026 (from the Biome warnings)
Fix in small slices, then raise each rule to "error" in `biome.json`:
1. Buttons without `type` (71) — `type="button"` for actions, `type="submit"` only for form submit buttons.
2. React hook dependencies (29) — review each effect/callback for stale values.
3. `any` (59) and non-null `!` (40) — replace with real types and explicit checks at boundaries.
4. CSS: duplicate properties and shorthand overrides (2), `!important` (39).
5. Other accessibility rules (~20) — fix with keyboard testing.
