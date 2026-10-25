# Flightdeck API — implemented contracts

Base: same-origin /api in browser; Vite proxies it during development. Guest endpoints, no authentication implemented.

| Method/route | Input | Success | Errors/limits |
|---|---|---|---|
| GET /api/config | none | liveAvailable boolean; provider string | Does not expose key |
| GET /api/flights | number, date YYYY-MM-DD, mode=demo or otherwise live | FlightResponse | 400 invalid; 503 no key; 502 upstream; 429 local limiter |
| GET /api/weather | lat, lon | current temperature_2m, weather_code, wind_speed_10m, time, timezone, source, fetchedAt | 400 coordinates; 502 upstream; 429 local limiter |

Unknown /api paths return JSON 404. Global limiter is 30 requests per minute per req.ip in local memory; proxy/IP trust is not production configured.

## Search semantics
Number is uppercased and whitespace removed; accepted pattern is 2–3 alphanumeric carrier characters + 1–4 digits + optional trailing letter. Date must round-trip as a real ISO calendar date. Demo supports only BA117/EK2/AF1381 and returns [] otherwise. Unknown non-demo modes currently fall into live mode; future PHP contract should explicitly validate the enum rather than silently expand it.

Live query uses OpenSky (OAuth2 client credentials). OpenSky has no flight-number or date lookup, so the server fetches one global state snapshot (cached 120 s, shared by all searches; ~4 credits per fetch) and matches the callsign: the IATA number is mapped to the ICAO callsign for a built-in list of ~40 carriers (BA117 → BAW117), leading zeros are ignored, and an ICAO callsign (BAW117) can be entered directly. The selected date is NOT used for live results; only aircraft transmitting now are found. Live flights carry position, altitude (m), speed (km/h), heading and on-ground status (optional fields altitudeM, speedKmh, headingDeg, onGround, originCountry); origin/destination are unavailable airports, and times, gates, baggage, aircraft type and delay are null. Processes first 20 matches. Snapshot timeout 20 seconds, weather 10 seconds. Errors: 503 no credentials; 502 rejected credentials / credit limit (429 upstream) / unavailable. Verified once against the real service on 24 Oct 2026 (local); coverage of the carrier map and credit consumption under real traffic are unmeasured.

Missing boarding and aircraft position remain null. Flight data source and retrieved time accompany results. Weather is CURRENT airport-area model data, not an arrival forecast. Detailed response types are src/types.ts; extend parity tests before PHP replacement.

## Live data pipeline (24 Oct 2026, PHP only)
`GET /api/flights?mode=live` now combines up to three sources; each degrades independently and the response names what was used (`sources`, `notes`).
1. **AeroDataBox** (RapidAPI, needs `aerodatabox_key` in the private config): schedule, revised/actual times, terminal, gate, baggage belt, aircraft model/registration, status, delay. Date-specific. Requested only for dates from yesterday to three days ahead. The date is the departure date in the departure airport's local time; because that zone is unknown before the lookup, the server accepts any date that is yesterday-to-+3-days somewhere on Earth (UTC-12 to UTC+14), so a user's own "today" is never refused near midnight. Cached 10 minutes per number+date. Every call costs 2 of the free 400 units a month (verified against the provider's own counter); the server counts BEFORE calling and stops at `aerodatabox_monthly_units` (default 360) and `aerodatabox_hourly_calls` (default 12), then falls back with a note. A rejected key or 429 pauses calls for 5-10 minutes.
2. **OpenSky**: live position, altitude, speed, heading of the aircraft in the air. If a scheduled flight is airborne the position is attached to it; a grounded aircraft is never used as a position.
3. **adsbdb** (free, no key): usual origin/destination for a callsign, used only when there is no scheduled data. Cached 1 hour (10 minutes for unknown), at most 5 lookups per search. Route data belongs to its authors: do not persist it.
Derived fields (never provider times): `progress` with `progressBasis` position|times|status (status = flight reported Arrived, 100%), `distanceRemainingKm` (straight line), `etaEstimate` (only when the provider gave no estimated arrival and speed is at least 200 km/h). Extra fields: `providerStatus`, `liveUpdates` (false means the times are only the airline schedule), `dataSource`, `routeSource`. `/api/config` adds `providers`. With no AeroDataBox key the behaviour is OpenSky plus route enrichment. The Node reference server is NOT extended with these; parity covers demo mode and validation only.

## PHP implementation differences (24 Oct 2026)
The PHP API (public/api/index.php) returns the same shapes. Intentional differences: mode other than demo/live returns 400; non-GET/HEAD returns JSON 405. Limiter key is REMOTE_ADDR unless trust_cf_connecting_ip is enabled.

## Target changes, not yet implemented
Runtime schema validation, documented input enums, cost controls, bounded shared cache/limiter, exact proxy policy, broader codeshare/pagination/timezone coverage and testable upstream adapters. Preserve current field semantics unless an explicit versioned contract change is approved.

## Flight fields added 24 Oct 2026
`direction` {type outbound|inbound|domestic|overseas, basis route|number, home (country code, default GB, config home_country_code), place}: from the route's country codes; only when the route is unknown a flight-number convention is used (BA odd = outbound from the UK, even = inbound) and it is labelled basis "number" with no place. `terminalOutHint`/`terminalInHint`: the airline's usual terminal (only British Airways at LHR, Terminal 5) and ONLY when the provider reports no terminal; the UI shows it as "usual, not confirmed". `estimatedTakeoff`/`estimatedLanding`: runway times before they happen (after they happen they are takeoff/landing, the actuals). `usualRouteOnly`: no schedule for that date; origin and destination come from adsbdb and nothing else is invented. Airports carry `countryCode`. Flights are matched on the SCHEDULED DEPARTURE DATE at the departure airport: the provider also returns the flight that merely arrives on that date, so those are filtered out (if nothing matches, the nearest departures are returned with a note). Flight ids include the departure time.
