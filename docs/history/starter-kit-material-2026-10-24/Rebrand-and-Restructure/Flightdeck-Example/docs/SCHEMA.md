# Flightdeck data model

## Implemented persistence
No SQL database, schema, migrations, ORM or auth-provider tables exist. No database creation is justified by current guest/browser-saved functionality.

Browser localStorage key `flightdeck-saved`: array of {number, date, mode}, with a UI maximum of six searches. It is device/browser-local, not cross-device storage. Parsing exists but there is no full schema validation for malformed stored objects; writes/removal error handling is inconsistent. Test these cases before release.

In-memory server maps: flight cache (60 seconds), airport cache (24 hours), weather cache (10 minutes), and per-IP rate counter (30 requests/minute). These reset on restart and are not shared across server workers. Most caches use a size guard; the IP limiter needs bounded eviction.

## Transfer models
Airport: code/name/city/country/timezone/nullable lat/lon. Flight: source ID/number/airline/status, cancelled/diverted, origin/destination, scheduled/estimated/actual gate times, takeoff/landing, nullable boarding/gates/terminals/baggage/aircraft/registration/progress/delay/position. FlightResponse: demo/live mode, flights, fetchedAt, cached, source and refreshSeconds. Canonical field definitions: src/types.ts.

## Future schema — NOT approved or implemented
If account-based cross-device saved flights become a requirement, design Clerk subject → local user mapping, per-user saved searches/preferences and minimal provider cache/log storage. Specify unique search keys, timezone/date semantics, retention/deletion and server ownership checks first. Use cPanel MariaDB with restricted runtime/migration users only when approved. MariaDB authorisation belongs in the application; no Supabase/PostgreSQL RLS policies apply to this app.

No invented users/profiles/app_settings tables, seed data or migrations should be added just to fill this document.
