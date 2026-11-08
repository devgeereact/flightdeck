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

## Added 25 Oct 2026
| Data / flow | Handling | Retention / control |
|---|---|---|
| Last flight results (`flightdeck-last-results`, browser storage) | Up to six recent results kept on the device so a flight can be read offline; shown only as "last fetched at" | Cleared on sign-out; browser data |
| Public packing list ticks (`flightdeck-public-packing`, browser storage) | Which boxes were ticked on the printable list page | Browser data |
| Shared flight links | The address contains only the flight number and date | Not stored by us |

## Added 25 Oct 2026 (rebrand and CMS)

- New device storage: `flightdeck-dismissed` (ids of app announcements the user closed, at most 20). Listed on the cookies page.
- Enquiries can carry a private owner note and a resolved date. The privacy page now says messages are kept "to read and answer you, and to keep a short private note of what was done about it".
- The CMS audit log and content history store a 10-character fingerprint of the owner's account, not the account id; they hold no visitor data.
- Public website pages are rendered by our server and still load nothing from third parties. Uploaded branding images are re-encoded (metadata removed).

## Device storage: full list (checked against the code, 8 Nov 2026)
`flightdeck-saved`, `flightdeck-saved-owner`, `flightdeck-checklist`, `flightdeck-checklist-owner`, `flightdeck-last-results`, `flightdeck-public-packing`, `flightdeck-dismissed`, `fd-consent`, `fd-signed-in`, `fd.favs`, `fd-done-<id>`, `fd-once-<event>` (local storage) and `fd-signin-back` (session storage). Details: docs/SCHEMA.md.
- **Known gap in the public page copy:** the live cookies and privacy pages (`php/private/src/Content/seed.json`, editable in the console) do not yet list `fd.favs`, `fd-signed-in`, the `-owner` keys, `fd-done-*` or `fd-once-*`, that rate limits keep a one-way hash of the visitor address (the IPv6 /64 network) for a few minutes, or that web-check links (when on) send a Google search query through Bright Data. This document is correct; the page copy is a content change for the owner to approve.
