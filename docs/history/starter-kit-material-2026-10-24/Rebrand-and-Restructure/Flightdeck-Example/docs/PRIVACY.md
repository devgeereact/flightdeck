# Flightdeck privacy inventory — review draft

Not a published privacy policy. Entity/contact/jurisdiction/retention details are unknown. No legal compliance claim is made.

| Data/flow | Current handling | Unknowns/actions |
|---|---|---|
| Flight number/date/mode | Browser → local API; upstream FlightAware only with key | Provider retention/licence; avoid needless logs |
| Saved searches | browser localStorage, up to six | Inform users clearing browser data removes them |
| Airport coordinates | server → Open-Meteo | Provider policy/retention and commercial licence |
| Browser IP | Express limiter memory; hosting may log requests in production | Host log retention/region not verified |
| Font request | Google Fonts CSS import in src/style.css | Third-party network disclosure or approved self-hosting |
| PWA cache | static shell/resources | Verify no private API caching on device |
| External attraction/airline links | User navigates to third parties | Make external destinations clear |

No account, payment, precise device-location permission, analytics SDK, AI prompt processing or DB is implemented. Do not infer no personal data: IPs, local travel searches and network requests can be relevant. Data retention/export/deletion claims must reflect actual controls. Determine target audience/age, legal entity/contact and applicable obligations before drafting/publishing a notice with appropriate review.
