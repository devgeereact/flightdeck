# Flightdeck security model

## Implemented boundary
OpenSky client ID/secret are read from server environment (OPENSKY_CLIENT_ID/OPENSKY_CLIENT_SECRET; legacy clientId/clientSecret accepted); /api/config exposes only availability. Vite does not embed them. The OAuth token is held in server memory only. Provider calls are server-side. .env is ignored by existing .gitignore. Browser saves only search inputs. No account/DB/payment/write API exists.

## Gaps before public release
Validate all provider payloads rather than any; strict enum/body/query bounds; shared bounded rate/cache controls and provider cost budget; correct origin proxy/IP trust; remove unused exposed source artifacts; review logs, HTTPS/security headers and PWA caching. Do not claim current per-IP memory limiting is production abuse protection. Secret scan must include staged/built artifacts if Git is later created.

A missing OpenSky credential is a blocker to live service, not a reason to put a private key in VITE_ config. No provider key, user credential or database password should be added to docs. PHP target places source/config/vendor outside all webroots, with reviewed token verification only if auth becomes necessary.

## Trust and approvals
No Supabase/Clerk/Cloudflare/GitHub/provider service has been newly activated here. Domain and repo remain unassigned. No production deployment is authorised by these docs. Backups remain private; do not publish source/secret archives in a document root. Review provider terms/data attribution before commercial release.

Current .gitignore excludes `.env` but not every `.env.*` variant. Broader ignore/secret-scanning protection is recommended in a separately approved configuration change; this documentation-only pass leaves the existing file unchanged.

## Accounts, console and secrets (24 Oct 2026)
- All /api/flights and /api/weather calls require a valid Clerk session token (server-side RS256 verification, issuer and authorised parties checked).
- Owner console: every /api/admin/* route requires a valid token AND the user id to be in config `admin_user_ids`; everyone else gets 403. Writes are limited to marking enquiries.
- Server-only secrets live in ~/flightdeck-private/config.php (mode 600) and ~/flightdeck-private/ga-reader.json: Clerk secret key, owner_email, GA service-account key, provider keys. Never in git, the build, or browser variables. Backup of the last config edit: config.php.bak-admin.
- Public inputs: /api/contact and /api/event are rate-limited per client IP (Cloudflare peer verified), whitelisted, size-capped; contact has a honeypot and minimum fill time; mail headers are injection-safe.
- Response headers: nosniff, strict referrer policy, X-Frame-Options, Permissions-Policy. Open items: Content-Security-Policy (needs a tested allowlist for Clerk, Google Analytics and Cloudflare), HSTS (Cloudflare zone setting), off-server backup of private var/.
