# Current task

## Goal (1 November 2026, owner)
Fix the search-row glitch; show boarding and arrival gates, take-off and landing times, when boarding starts and the gate closes; make destination weather and discovery a first feature next to the flight; use Bright Data for missing information if sensible; clean up dead code, worktrees and outdated docs.

## Status: DONE locally, NOT pushed or deployed
- Search row: equal box heights with the error showing (site and app); digits-only input asks for the airline code.
- Flight page: Gates and key times panel (typical boarding/gate-close times labelled "Typical"); Weather in [city] (now, at landing, 4 days) and Discover [city] (any city via Wikivoyage/Wikipedia) beside the flight from 1280px, after the key times below that. New API: `/api/place`, `/api/web-check`; `/api/weather` forecasts. ADR-021.
- Bright Data: built as "Latest from the web" links only, OFF until the owner adds `brightdata_key` and `brightdata_zone` (+ optional `brightdata_daily_cap`) to `~/flightdeck-private/config.php`. It costs money per search.
- Cleanup: 3 merged worktrees and 4 merged local branches removed; dead CSS/exports, FTPS probe, workspace file and outdated docs removed; docs rewritten; history moved to `.agent/HANDOFF.md`.

## Checks run (1 Nov 2026)
`pnpm check` PASS (116/116 + PHP), `pnpm test:ui` PASS (56), `pnpm test:console` PASS (17); flight page screenshots at 1440/1920/834/390 with no overflow; axe clean on all 6 captures; search row measured. Details: docs/AUDIT.md.

## Next
1. Owner: approve commit + push to `main` (a push deploys).
2. After deploy: check a real flight live (gates, key times, weather, Discover) and Provider health (Wikimedia should turn green).
3. Optional: decide on Bright Data (key + zone, budget).
4. Still open from 31 Oct: console with the production account, a real phone, a screen reader, a paper print, Firefox (BLOCKED here).
5. For the owner (GitHub, needs approval): delete the stale remote branch `origin/production`; the 4 Dependabot PRs include major upgrades (vite 8, lucide 1.x), which are planned tasks.
