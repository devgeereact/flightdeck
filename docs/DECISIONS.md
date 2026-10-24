# Flightdeck decision records

## ADR-001: preserve current prototype
24 October 2026 · accepted for docs task. Keep React/TypeScript/Express working code unchanged. The new cPanel PHP stack is a target preference, not retrospective proof of implementation. Consequence: PHP parity/migration remains a separate approved code task.

## ADR-002: guest/browser-local V1
Current implementation has no accounts/DB. Treat Clerk/MariaDB as conditional; do not add services solely to match a template. Revisit only if cross-device/persistent shared requirements are accepted.

## ADR-003: honest data provenance
Samples must stay labelled. No guessed boarding/gates/baggage/location. No authorised live flight source currently exists. A schematic is never geographic tracking evidence.

## ADR-004: deliberate releases
Respect the user's limited Actions budget: production-branch/manual deployment is preferred. No repo/workflow exists yet, and documentation does not create one or authorise deployment.

## ADR-005: source backup without Git
Flightdeck has no .git/remote. Approved verified source archive substitutes for bundle for this task; Git history/branches cannot be audited or cleaned. Do not initialise/push as a side effect of docs creation.

## ADR-006: OpenSky replaces FlightAware
24 October 2026 · accepted by the user. FlightAware AeroAPI removed from code and env; OpenSky Network (OAuth2 client credentials) is the live source. Consequence: live mode is callsign-based and position-only. No flight-number/date lookup, scheduled times, gates, baggage, aircraft type or delay; origin/destination unknown; date ignored in live mode. Search maps IATA→ICAO for a partial carrier list. A snapshot is cached 120 s to bound credits. Revisit if schedule/gate data becomes a requirement (needs a second source). Target host chosen: flightdeck.gakinz.com (no DNS/deploy done).

## ADR-008: free live-data stack, personal use
24 October 2026 · accepted by the user (personal, non-commercial use). Google offers no flight API. Live data = OpenSky (position) + adsbdb (usual route, free, not persisted) + AeroDataBox free Basic plan (schedule/gates/baggage; 400 units a month, attribution required, commercial use not allowed). Hard server-side spend limits protect the allowance. Consequences: if Flightdeck ever becomes commercial or public-facing for others, AeroDataBox/AviationStack free plans no longer apply and a paid plan (AeroDataBox Pro, FlightAware Standard) is needed. Node is not extended with this pipeline (PHP is production). No LLM is used to produce flight facts: an AI search can summarise but cannot be an authoritative real-time source and would risk fabricated gates and times.

## ADR-007: Backend moves to PHP on cPanel
24 October 2026 · accepted by the user (asked to pick the best option). Port the Express API to PHP (public/api entrypoint + private php/private source) because shared hosting has already shown process exhaustion and the user default is static + PHP. Node server is kept as the behavioural reference and for local development; it is not deleted. Consequence: two implementations must stay in parity (php/tests/parity.mjs) until Node is formally archived. Not deployed yet.
