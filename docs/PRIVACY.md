# Flightdeck privacy inventory

The published notice is generated from content/pages.mjs (privacy, cookies) and must be kept in step with this table. This is an engineering inventory, not legal advice. Controller: Gideon Akinlotan, info@flightdeck.gakinz.com.

| Data / flow | Handling | Retention / control |
|---|---|---|
| Flight number, date | Sent to our PHP API for the signed-in user; matched against provider data (OpenSky, AeroDataBox, adsbdb) | Cached server-side briefly; not tied to the user in counters |
| Saved flights | Clerk user metadata (signed-in) and localStorage | User can remove; deleted with the Clerk account |
| Travel checklist | localStorage; signed-in users also in `var/checklists/<sha256(sub)>.json` | "Delete my checklist" erases server copy and local copy |
| Account (email, name, avatar) | Clerk (sign-in provider); we verify its session token and never see passwords | Clerk account deletion |
| Usage counters | Daily aggregates in `var/metrics/` (searches, provider calls, errors, checklist saves, event whitelist). Daily active users use a hashed user id set, never paired with flight numbers | 90 days for the hashed set |
| Enquiries and feedback | Stored in `var/enquiries/` and emailed to the owner; IP kept only as a daily-salted hash for abuse control | Deleted on request |
| Google Analytics 4 | Loads only after the visitor accepts (Consent Mode, defaults denied, no user id, no flight numbers) | Google retention setting on the property |
| Weather | Airport coordinates sent to Open-Meteo | No user data |
| Fonts | Self-hosted (OFL); no Google Fonts requests | n/a |
| Browser IP | Hosting and Cloudflare logs; rate limiter | Host log retention not verified |
| Advertising | Not shown. If ever enabled: certified consent tool first; see docs/MONETISATION.md | n/a |

Not implemented: payments, precise location, AI processing of user text (phase 8 is flagged off; when enabled it must be disclosed here first). Audience is general public; the notice says the service is not aimed at under-13s.
