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

Live query uses a UTC window around the selected date, enriches origin/destination, filters by origin-local scheduled departure date (UTC fallback if timezone absent). Processes first 20 returned flights only; no pagination. Provider request timeout is 15 seconds, weather 10 seconds. No live FlightAware response has been validated in this project. Arrival delay is not separately calculated; delayMinutes reflects departure_delay.

Missing boarding and aircraft position remain null. Flight data source and retrieved time accompany results. Weather is CURRENT airport-area model data, not an arrival forecast. Detailed response types are src/types.ts; extend parity tests before PHP replacement.

## Target changes, not yet implemented
Runtime schema validation, documented input enums, cost controls, bounded shared cache/limiter, exact proxy policy, broader codeshare/pagination/timezone coverage and testable upstream adapters. Preserve current field semantics unless an explicit versioned contract change is approved.
