# Flightdeck project memory

Reviewed 24 October 2026.

## Confirmed decisions
React/TypeScript PWA named Flightdeck. Existing local Node/Express prototype is preserved. Desired features: flight search/status/times/gates/baggage/aircraft/weather/local time/welcome/attractions. Existing cPanel hosting preferred to extra paid hosting. Current user standard for NEW apps is static frontend + PHP API + cPanel MariaDB when needed, Clerk if accounts, Cloudflare. No automatic architecture migration. Deliberate releases conserve GitHub Actions minutes. Current task authorises docs/rules kit only, no code/Git/deployment.

## Assumptions
Guest-first V1 remains suitable; no accounts/database are needed for current local saved searches. Approval for a PHP rewrite is NOT inferred from hosting preference. Decision 24 Oct 2026: OpenSky replaces FlightAware (ADR-006); user holds OpenSky API credentials; target host is flightdeck.gakinz.com. OpenSky gives live position only, so schedule/gate/baggage fields stay empty.

## Open questions
Document root for flightdeck.gakinz.com (domain is chosen)? Which GitHub owner/repo? Does OpenSky terms/credit allowance cover public use, and is a schedule/gate source wanted later? Commercial weather licence needed? Attraction coverage/location/radius? Must accounts/cross-device saved flights exist? What reliability/latency targets and budget apply?

## Risks
Live flight access missing; backend/runtime hosting mismatch; SSH process exhaustion; provider schema/timezone assumptions; incomplete PWA install/update validation; limited curated destinations; no Git repository/remote.

## Future / out of scope
World coverage, position, boarding/airport feeds, server-saved flights, alerts and native mobile are future decisions. Booking, check-in, guessed operational data, paid services, production DNS/deployment and Git cleanup are outside this docs task.

## Safety record
Verified source backup: ~/repo-backups/flightdeck-2026-10-24-0022. Original 25 files hashed; node_modules/generated output excluded. No Git bundle possible. User approved documentation-only plan. Do not classify local source as already pushed or default branch clean.

## Update 24 Oct 2026
User approved the PHP backend (picked as best option). PHP API implemented and locally tested (see MIGRATION-PHP). Next gate: read-only cPanel/DNS discovery for flightdeck.gakinz.com, then staging upload. php installed locally via Homebrew (8.5.12).

## Update 24 Oct 2026 (agent Skyhook)
Production release pipeline built and proven: `production` branch + .github/workflows/release.yml, restricted rsync-only SSH key for ~/flightdeck-private/src, additive FTPS for the public root. Cloudflare SSL strict verified; hostname-scoped cache rule respects origin headers; manifest MIME fixed. Open: trust_cf_connecting_ip (shared rate bucket) awaits user approval; PWA update test on a device. See docs/DEPLOYMENT.md.

## Update 25 Oct 2026: rebrand and CMS (Route A)
Owner decisions: audience personal and free (non-commercial, not promoted); evolve the green identity; public site at `/` rendered by PHP from CMS content, app at `/app/` (ADR-015); CMS = content, settings and branding, inbox and operations; owner only, no editor role; file-based storage (ADR-016); safe Markdown only (ADR-017). Built and verified locally (VERIFICATION.md), not released. Backup: `~/repo-backups/flightdeck-2026-10-25-1808-pre-rebrand` (verified bundle, source, private files). Release plan: RELEASE-PLAN-REBRAND.md. Open: server GD and backup scope, release approval, clean-up approval, Node reference archive decision.

## Decision 26 Oct 2026
Design language is airport signage and printed timetables (hairlines, small radii, one dark board panel, tabular data); brand colours and fonts unchanged; Lenis on public pages and the app, never under reduced motion; no fabricated flight data anywhere in marketing visuals; third-party design references (NerdWallet, 21st) inform structure only. See docs/DESIGN.md and ADR-019.

## Decision 31 Oct 2026
Owner approved the blue redesign prototype and asked for our own logo, every gap fixed, local testing of every part, then live. Brand: blue #1866ff, ink, amber fill, Inter / Inter Tight, own mark (runway, take-off arc, amber destination dot). Photography allowed from openly licensed sources with public credits. No fabricated flight data anywhere still holds. See ADR-020 and docs/DESIGN.md.
