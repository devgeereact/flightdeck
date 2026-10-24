# Flightdeck integration register

| Integration | State | Data/config and limits |
|---|---|---|
| OpenSky Network (OAuth2 client credentials) | Adapter implemented; live position lookup VERIFIED 24 Oct 2026 (one real DL1 match, local) | Live ADS-B position only: no schedules, gates, baggage, delays or flight-number/date lookup. Credit-limited (global snapshot costs ~4 credits, cached 120 s). Check OpenSky terms for the intended public use before launch. FlightAware was removed (ADR-006) |
| Open-Meteo | Current weather previously verified | Airport coordinates sent; current model data; public endpoint prototype/non-commercial usage must be checked before launch |
| Airline status links | Static links for sample carriers | Browser navigation; no airline API feed |
| Tourism sources | Curated New York/Dubai/Paris links | Not geospatial ranked; do not claim global coverage |
| Google Fonts | CSS import implemented | External request; offline/privacy review remains |
| GitHub/cPanel/Cloudflare | Hosting target not configured | Prior host checks do not equal deployed integration |
| Clerk/MariaDB | NOT IMPLEMENTED; not required by current V1 | Activate only for approved accounts/shared data |

Provider availability/licences may change. Before activation consult current official provider documentation; record source/date/limits and cost, without secret values. No source page is permission to buy a plan or send private data.

## Live flight data (24 October 2026)
- OpenSky Network: live positions; OAuth2 client credentials; 4,000 credits a day; snapshot cached 120 s.
- adsbdb (api.adsbdb.com/v0/callsign/{callsign}): free, no key; route data by David Taylor and Jim Mason, not to be copied into other databases; short cache only.
- AeroDataBox (RapidAPI, host aerodatabox.p.rapidapi.com, GET /flights/number/{number}/{date}): free Basic plan 400 units a month, 1 request a second, personal use, visible attribution required (shown in the app). Key goes in php/private/config.php as aerodatabox_key (server only, never VITE_). Spend limits in config.example.php.
- Google: no public flight API (QPX Express closed 2018).
