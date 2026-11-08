# Monetisation: none

Flightdeck is a personal, free, non-commercial project (owner decision, 25 Oct 2026; confirmed 8 Nov 2026). It has no adverts, no sponsored content and nothing to buy, and the code for showing adverts was removed on 8 Nov 2026 (ADR-024).

## Why
- The data providers' free plans are for personal or non-commercial use only: AeroDataBox free plan, OpenSky Network (non-profit research), Open-Meteo free endpoint, and adsbdb route data that may not be copied into other databases (docs/INTEGRATIONS.md). Showing adverts would make the site commercial and break those terms.
- Adverts would also need a certified consent tool and a change to the privacy and cookies pages. None of that is wanted.

## What this means in practice
- No ad script, ad slot or `ads.txt` exists in the code. `/ads.txt` answers 404. `pnpm docs:check` fails if ad code returns by accident.
- Analytics (Google Analytics 4) load only after the visitor accepts them, and advertising features stay off (docs/PRIVACY.md).
- If the owner ever wants income, it is a new decision: first move to licensed data sources, then add a consent tool, then update the privacy and cookies pages, and record it as a new ADR. Do not restore the old code from git without that.
