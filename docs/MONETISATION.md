# Monetisation: AdSense readiness

Status: built, OFF. Nothing loads from Google Ads on the live site.

## The gate
scripts/build-public.mjs emits ad slots and ads.txt only when ALL are true in site.config.json: ads.enabled, ads.licenceCleared, ads.cmpReady and a valid pubId (pub-<digits>). Any missing one builds without ads and prints a warning. Ads appear only on public guide and packing-list pages, never in the app, console or flight data.

## Before turning it on (owner decisions)
1. Data licences. AeroDataBox free plan is non-commercial (Pro is paid, commercial use allowed); OpenSky is for non-profit research only; adsbdb data may not be copied into a database. With ads, the site is commercial, so move to licensed sources or stop showing provider data next to ads. Set licenceCleared only when settled.
2. Consent. UK/EEA personalised ads need a Google-certified CMP (Google's free Privacy & messaging qualifies). Replace the built-in banner with it, then set cmpReady.
3. AdSense account: apply when about ten real pages exist (five guides plus the packing list, legal pages), then add the pub id and slot ids.
4. Privacy and cookie pages must list Google as an advertising partner before launch.
5. Never click your own ads. Auto ads stay off.

Realistic expectation: a new small site earns very little for months; approval depends on original useful content, which is why the guides and packing list come first.
