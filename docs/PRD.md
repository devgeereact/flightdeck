# Flightdeck product requirements

Status: live at flightdeck.gakinz.com (blue redesign 31 Oct 2026; gates, key times, weather and Discover on the flight page 1 Nov 2026). Reviewed 1 November 2026. The table below is the original V1 list; ARCHITECTURE.md describes what is built and AUDIT.md what was checked.

## Purpose and users
Help travellers and people meeting a flight see reliable updates in one calm interface: identify a flight by number and local departure date, understand times/gates/status, and plan arrival. Public pages and the packing list need no account. Flight look-ups need a free sign-in (Clerk) because they spend a metered personal-use allowance (ADR-010). No business model or billing.

## Core delight
A trustworthy journey summary with airport-local dates and clear provenance/freshness. Showing an honest missing value is better than a fabricated gate or live aircraft position.

## V1 requirements and acceptance
| ID | Requirement | Current status | Acceptance for release |
|---|---|---|---|
| FD-01 | Search number/date and select flight segment | IMPLEMENTED; demo verified previously | Schedules by date come from AeroDataBox; OpenSky adds position and adsbdb a route when there is no schedule. Live providers were last checked by hand, not in CI |
| FD-02 | STD/STA, estimated/actual gate-out/in and actual takeoff/landing | IMPLEMENTED fields | Every time identifies event, airport zone and date |
| FD-03 | Boarding, departure/arrival gate, terminal, baggage, aircraft | PARTIAL | Provider reports exact value or UI says unavailable; no inferred boarding |
| FD-04 | Punctuality and update provenance | PARTIAL | Departure/arrival delay semantics documented and tested |
| FD-05 | Refresh/change feed | Foreground polling/manual refresh implemented | Controlled provider cost and stale/error behaviour tested |
| FD-06 | Airport-area weather | IMPLEMENTED; previously fetched real Open-Meteo data | Current conditions clearly distinguished from arrival forecast |
| FD-07 | Welcome and attractions | Hand-written guides for New York, Dubai and Paris; Wikivoyage/Wikipedia travel guide and weather for any city (ADR-021) | Sources and attribution shown; coverage claims stay modest |
| FD-08 | Save/reopen/remove flight | Browser-local implementation | Seedless persistence and error cases tested |
| FD-09 | Installable PWA and safe offline shell | PARTIAL | Real install/update/offline matrix passes |
| FD-10 | Live geographic position | PARTIAL: OpenSky position/altitude/speed shown as text for matched live callsigns (verified once locally) | Map rendering of the real position not built; schematic never represented as GPS |

## Success measures
Proposed targets, not measured outcomes: user finds a supported flight without assistance; timezone/date correctness in acceptance cases; no sample data shown as live; clear failure within bounded request time. Define search success rate/latency targets after authorised provider access and baseline measurement. No fabricated engagement/revenue analytics.

## V1 exclusions
Bookings, ticket sales, check-in, immigration advice, predicted gates/boarding, background push alerts, offline mutations, live map tracking without source, universal attraction rankings, a SQL database and payments. Accounts exist only through Clerk sign-in (ADR-009, ADR-010); MariaDB is not used (ADR-016).

## Constraints and release blockers
Data: AeroDataBox (schedules, gates, belts; free allowance), OpenSky (positions), adsbdb (routes), Open-Meteo (weather), Wikivoyage/Wikipedia (travel guides for any city), Bright Data search links (live), and gate, terminal, belt and boarding facts read from them by Claude (built, labelled "From the web", off until the owner adds the Anthropic key; ADR-025). Hand-written guides cover New York, Dubai and Paris.

## Website and CMS (approved 25 Oct 2026, live)
Audience: personal and free (the owner, friends and family, anyone who finds it), non-commercial, not promoted, in line with the free data plans (ADR-008). Public pages: home with flight lookup and a labelled sample, how it works, data and coverage, help/FAQ, 11 guides, printable packing list, about, contact, privacy, cookies, terms, accessibility. Owner CMS: pages, guides, FAQs, announcements, menus, settings and branding image, with draft, preview, publish, history, restore and audit; inbox with resolution and notes; provider health. Evidence: docs/AUDIT.md.
