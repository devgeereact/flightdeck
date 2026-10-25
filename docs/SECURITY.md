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
- Response headers (public/.htaccess): nosniff, strict referrer policy, X-Frame-Options, Permissions-Policy, HSTS for this hostname only (max-age one year, no includeSubDomains/preload, so sibling gakinz.com sites are unaffected).
- Content-Security-Policy: ENFORCED (public/.htaccess): default-src self; scripts, connections, frames and images limited to self plus Clerk (clerk.flightdeck.gakinz.com and the dev instance), Cloudflare challenges and analytics, and Google Analytics/Tag Manager; styles allow inline (the consent banner and public pages inline small styles); no inline scripts anywhere (the build externalises them); plus frame-ancestors, base-uri, object-src none and form-action self. It was run report-only first; the owner confirmed no violations on production sign-in (25 Oct 2026). If something third-party stops working, look for a 'Content Security Policy' message in the browser console and add that host to the matching directive. Missing files and unknown paths return a real 404 page (Clerk return paths still get the app shell).
- Open: off-server copy of backups (see RUNBOOK).

## Overnight hardening (25 Oct 2026)
From the security audit (no Critical or High findings):
- Public write routes (`/api/contact`, `/api/event`) refuse requests that are not JSON or that come from another site (`Sec-Fetch-Site`, `Origin`). A JSON body forces a CORS preflight that other sites cannot pass, so visitors' browsers cannot be used to flood the form.
- Contact limits count an IPv6 visitor by their /64 network. Across the site at most 20 messages an hour are emailed; later ones are still kept for the console. At most 5,000 messages are stored (then the form says messages are paused).
- The cache deletes expired files when it reads them and sweeps now and then; weather is cached per 0.1 degree, not per 0.01.
- If Clerk's key endpoint is unreachable, the last keys are used for up to a week (`clerk-jwks-stale`) instead of signing everyone out; bad tokens are still refused.
- Enquiry status changes and replies are written under a lock with unique temp files, so they cannot undo each other.
- The console's mailto link is encoded; `X-Powered-By` is removed; the production CSP no longer allows Clerk development hosts (the local dev router adds them back for local sign-in only).
Still open (needs the owner): set `clerk_authorized_parties` to `['https://flightdeck.gakinz.com']` in the server config if it is not already set; consider Cloudflare Turnstile on the contact form; Google Tag Manager in `script-src` is broad (self-hosting gtag would remove it).

## Website and CMS (25 Oct 2026, local, not released)

- **Access:** every CMS route sits under `/api/admin`, so App.php checks the Clerk token and the owner id before Cms.php runs. End-to-end tests prove 401 (anonymous; forged, expired or wrong-issuer tokens) and 403 (signed-in non-owner) on every CMS route, and that nothing changes. No roles can be granted from the browser.
- **No executable content:** editors write a Markdown subset. The renderer escapes every character first and can only emit a fixed set of tags; links are limited to site paths, #anchors, http(s) and mailto (external links get `rel="noopener"`). Settings placeholders are escaped before parsing. Announcement links pass the same check or are dropped. Tests cover script tags, event handlers, javascript:/data:/vbscript: and protocol-relative links, entity tricks, quote break-outs and hostile settings. Preview HTML is shown in an `<iframe sandbox="">` (no scripts, no navigation). The site's CSP (no inline scripts) applies to every server-rendered page.
- **Input validation:** server-side per type (Validator.php): unknown fields dropped, types and lengths checked, existing page addresses and the site URL cannot change, reserved paths refused, required pages cannot be hidden or deleted.
- **Uploads:** PNG/JPEG/WebP only, decoded and re-encoded with GD (metadata and trailing data dropped), size and dimension limits, 20 an hour, stored outside the webroot under their SHA-256, served with `nosniff` and a fixed type. SVG refused. No GD means no uploads.
- **Secrets:** the console never receives provider keys, Clerk keys, SMTP passwords or owner ids. Settings hold only public values. `/api/site` returns only the listed public fields.
- **Integrity and recovery:** one lock for CMS writes, atomic renames, immutable revisions, stale-editor conflicts refused (409), audit log with a hashed account fingerprint. Restore from history, or fall back to the seed by moving `published.json` aside.
- **Test-only switches:** `FLIGHTDECK_RATE_PER_MINUTE` (server environment only, never a request) raises the limit for local test runs; `FLIGHTDECK_DIST` lets the dev router serve a test build. Neither exists in the production config.
- **Still open:** audit-log rotation; Turnstile on the contact form (owner decision); confirm GD on the server.
