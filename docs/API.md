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

## PHP implementation differences (24 Oct 2026)
The PHP API (public/api/index.php) returns the same shapes. Intentional differences: mode other than demo/live returns 400; non-GET/HEAD returns JSON 405. Limiter key is REMOTE_ADDR unless trust_cf_connecting_ip is enabled.

## Target changes, not yet implemented
Runtime schema validation, documented input enums, cost controls, bounded shared cache/limiter, exact proxy policy, broader codeshare/pagination/timezone coverage and testable upstream adapters. Preserve current field semantics unless an explicit versioned contract change is approved.
