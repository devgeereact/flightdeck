# Flightdeck integration register

| Integration | State | Data/config and limits |
|---|---|---|
| OpenSky Network (OAuth2 client credentials) | Adapter implemented; live position lookup VERIFIED 24 Oct 2026 (one real DL1 match, local) | Live ADS-B position only: no schedules, gates, baggage, delays or flight-number/date lookup. Credit-limited (global snapshot costs ~4 credits, cached 120 s). Check OpenSky terms for the intended public use before launch. FlightAware was removed (ADR-006) |
| Open-Meteo | In use (flight page and Discover) | Airport or city coordinates sent; current, hourly and daily model data; cached 10 minutes; free endpoint for non-commercial use only |
| Airline status links | Static links for sample carriers | Browser navigation; no airline API feed |
| Tourism sources | Hand-written links for New York, Dubai and Paris (`src/features/flight/destinations.ts`); Wikivoyage/Wikipedia travel guides for any city (`/api/place`) | Not geospatial ranked; do not claim global coverage |
| Fonts | Inter, self-hosted (`public/fonts`, OFL licence) | No third-party font request |
| GitHub/cPanel/Cloudflare | Live: Namecheap cPanel behind Cloudflare; GitHub Actions deploys over SSH | See docs/DEPLOYMENT.md |
| Clerk | Live (production instance for flightdeck.gakinz.com) | Session tokens verified in PHP; no secret key needed to sign in. `clerk_secret_key` is optional and only feeds the console's Users panel |
| MariaDB | Not used | Data lives in JSON files under the private `var/` folder (ADR-016) |

Provider availability/licences may change. Before activation consult current official provider documentation; record source/date/limits and cost, without secret values. No source page is permission to buy a plan or send private data.

## Live flight data (24 October 2026)
- OpenSky Network: live positions; OAuth2 client credentials; 4,000 credits a day; snapshot cached 120 s.
- adsbdb (api.adsbdb.com/v0/callsign/{callsign}): free, no key; route data by David Taylor and Jim Mason, not to be copied into other databases; short cache only.
- AeroDataBox (RapidAPI, host aerodatabox.p.rapidapi.com, GET /flights/number/{number}/{date}): free Basic plan 400 units a month, 1 request a second, personal use, visible attribution required (shown in the app). Key goes in php/private/config.php as aerodatabox_key (server only, never VITE_). Spend limits in config.example.php.
- Google: no public flight API (QPX Express closed 2018).

## Clerk (accounts)
Application "Flightdeck" in the owner's Clerk workspace. The live site uses the PRODUCTION instance (publishable key `pk_live…`, passed to the build by `release.json`; public by design); the server derives the token issuer from it unless `clerk_issuer` is set (ADR-022). Local development uses a separate DEVELOPMENT instance key in `.env.local`, with its own users. Test user for local checks: flightdeck+clerk_test@example.com (Clerk's "+clerk_test" addresses accept the fixed development code 424242 on the development instance only; this user has no password).
