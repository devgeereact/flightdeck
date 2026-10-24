# Flightdeck security model

## Implemented boundary
OpenSky client ID/secret are read from server environment (OPENSKY_CLIENT_ID/OPENSKY_CLIENT_SECRET; legacy clientId/clientSecret accepted); /api/config exposes only availability. Vite does not embed them. The OAuth token is held in server memory only. Provider calls are server-side. .env is ignored by existing .gitignore. Browser saves only search inputs. No account/DB/payment/write API exists.

## Gaps before public release
Validate all provider payloads rather than any; strict enum/body/query bounds; shared bounded rate/cache controls and provider cost budget; correct origin proxy/IP trust; remove unused exposed source artifacts; review logs, HTTPS/security headers and PWA caching. Do not claim current per-IP memory limiting is production abuse protection. Secret scan must include staged/built artifacts if Git is later created.

A missing OpenSky credential is a blocker to live service, not a reason to put a private key in VITE_ config. No provider key, user credential or database password should be added to docs. PHP target places source/config/vendor outside all webroots, with reviewed token verification only if auth becomes necessary.

## Trust and approvals
No Supabase/Clerk/Cloudflare/GitHub/provider service has been newly activated here. Domain and repo remain unassigned. No production deployment is authorised by these docs. Backups remain private; do not publish source/secret archives in a document root. Review provider terms/data attribution before commercial release.

Current .gitignore excludes `.env` but not every `.env.*` variant. Broader ignore/secret-scanning protection is recommended in a separately approved configuration change; this documentation-only pass leaves the existing file unchanged.
