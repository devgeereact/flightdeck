# Flightdeck project memory

Reviewed 24 October 2026.

## Confirmed decisions
React/TypeScript PWA named Flightdeck. Existing local Node/Express prototype is preserved. Desired features: flight search/status/times/gates/baggage/aircraft/weather/local time/welcome/attractions. Existing cPanel hosting preferred to extra paid hosting. Current user standard for NEW apps is static frontend + PHP API + cPanel MariaDB when needed, Clerk if accounts, Cloudflare. No automatic architecture migration. Deliberate releases conserve GitHub Actions minutes. Current task authorises docs/rules kit only, no code/Git/deployment.

## Assumptions
Guest-first V1 remains suitable; no accounts/database are needed for current local saved searches. Approval for a PHP rewrite is NOT inferred from hosting preference. FlightAware adapter is a candidate, not a purchased/verified provider choice.

## Open questions
Which owned domain/subdomain and document root? Which GitHub owner/repo? What free/licensed flight-data source meets coverage/cost? Is the PHP migration desired now, and what parity scope? Commercial weather licence needed? Attraction coverage/location/radius? Must accounts/cross-device saved flights exist? What reliability/latency targets and budget apply?

## Risks
Live flight access missing; backend/runtime hosting mismatch; SSH process exhaustion; provider schema/timezone assumptions; incomplete PWA install/update validation; limited curated destinations; no Git repository/remote.

## Future / out of scope
World coverage, position, boarding/airport feeds, server-saved flights, alerts and native mobile are future decisions. Booking, check-in, guessed operational data, paid services, production DNS/deployment and Git cleanup are outside this docs task.

## Safety record
Verified source backup: ~/repo-backups/flightdeck-2026-10-24-0022. Original 25 files hashed; node_modules/generated output excluded. No Git bundle possible. User approved documentation-only plan. Do not classify local source as already pushed or default branch clean.
