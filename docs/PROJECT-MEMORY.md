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
