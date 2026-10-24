# Flightdeck product requirements

Status: local prototype; not production-ready. Reviewed 24 October 2026.

## Purpose and users
Help travellers and people meeting a flight see reliable updates in one calm interface: identify a flight by number and local departure date, understand times/gates/status, and plan arrival. Guest access is the current model. No business model, billing, staff portal or account requirement is confirmed.

## Core delight
A trustworthy journey summary with airport-local dates and clear provenance/freshness. Showing an honest missing value is better than a fabricated gate or live aircraft position.

## V1 requirements and acceptance
| ID | Requirement | Current status | Acceptance for release |
|---|---|---|---|
| FD-01 | Search number/date and select flight segment | IMPLEMENTED; demo verified previously | Live lookup is callsign-based (OpenSky); no date/schedule lookup. Carrier coverage tested |
| FD-02 | STD/STA, estimated/actual gate-out/in and actual takeoff/landing | IMPLEMENTED fields | Every time identifies event, airport zone and date |
| FD-03 | Boarding, departure/arrival gate, terminal, baggage, aircraft | PARTIAL | Provider reports exact value or UI says unavailable; no inferred boarding |
| FD-04 | Punctuality and update provenance | PARTIAL | Departure/arrival delay semantics documented and tested |
| FD-05 | Refresh/change feed | Foreground polling/manual refresh implemented | Controlled provider cost and stale/error behaviour tested |
| FD-06 | Airport-area weather | IMPLEMENTED; previously fetched real Open-Meteo data | Current conditions clearly distinguished from arrival forecast |
| FD-07 | Welcome and attractions | Three curated demo destinations | Sources/attribution verified; broader coverage explicitly scoped |
| FD-08 | Save/reopen/remove flight | Browser-local implementation | Seedless persistence and error cases tested |
| FD-09 | Installable PWA and safe offline shell | PARTIAL | Real install/update/offline matrix passes |
| FD-10 | Live geographic position | PARTIAL: OpenSky position/altitude/speed shown as text for matched live callsigns (verified once locally) | Map rendering of the real position not built; schematic never represented as GPS |

## Success measures
Proposed targets, not measured outcomes: user finds a supported flight without assistance; timezone/date correctness in acceptance cases; no sample data shown as live; clear failure within bounded request time. Define search success rate/latency targets after authorised provider access and baseline measurement. No fabricated engagement/revenue analytics.

## V1 exclusions
Bookings, ticket sales, check-in, immigration advice, predicted gates/boarding, background push alerts, offline mutations, live map tracking without source, universal attraction rankings, accounts, DB and payments. Do not add Clerk/MariaDB just because they are defaults for projects needing them.

## Constraints and release blockers
No live flight key is configured. Data rights/coverage/cost remain unresolved. Destination guides cover New York, Dubai and Paris. No target domain, remote repository or deployment workflow exists. New hosting preference is PHP/static cPanel; current Node API is preserved pending migration approval. See ROADMAP, ARCHITECTURE and VERIFICATION.
