# Flightdeck deployment status and runbook

Status: DEPLOYED MANUALLY 24 Oct 2026 to https://flightdeck.gakinz.com (see Live evidence below); no GitHub workflow/auto-deploy exists. Earlier status text follows.  Target hostname chosen: flightdeck.gakinz.com (document root, DNS state, GitHub repo, release workflow and dedicated FTP account NOT yet confirmed). PHP backend approved and implemented locally (docs/MIGRATION-PHP.md). No deployment has occurred.

## Verified host evidence (23 October)
Namecheap StellarPlus18; account devgeereact; premium17.web-hosting.com → 185.61.152.45. SSH port 21098 accepts key authentication. Explicit FTPS port 21 TLS handshake/certificate verified; FTP credentials/write tests not performed. cPanel feature list reports Node selector and Passenger enabled, but an app was not created/tested. VS Code Server failed with server process exhaustion. Feature availability is not runtime proof.

## Chosen direction (PHP approved 24 Oct 2026)
User's new default is static React + PHP on cPanel. Existing Flightdeck is still Node/Express. PHP parity is implemented and locally tested; cPanel staging is the next gate. Uploading current dist alone breaks /api/weather and /api/flights; current pnpm start also needs tsx and local working-directory assumptions. Do not deploy either blindly.

## Target discovery
Inspect existing project config, cPanel Domains and authorised DNS connections; if none clearly assigned, ask the user for a subdomain. Verify account/zone/document root, DNS/valid origin certificate/Cloudflare Full(strict). Never repurpose another site or alter mail/DNSSEC. No Cloudflare account/zone access has been verified here.

## Layout and secrets
Separate public static root and intended PHP API entrypoint from private backend source/vendor/config and rollback backups. Choose precise paths only after domain mapping. Runtime secrets stay in private server config, not GitHub build or browser VITE_ variables. No DB/auth is needed until approved requirements demand it. If added, cPanel restricted MariaDB identities and backend Clerk verification must be tested.

## Delivery
Prefer reviewed encrypted FTPS to premium17.web-hosting.com:21 using a site-restricted account, because shared-host SSH is unstable. FTPS must use origin hostname, not Cloudflare's proxied web hostname. Credentials go directly into GitHub Actions secrets via secure tooling; never chat or repository. Verify FTP account root with a scoped harmless test before uploads.

Release branch is a deliberate production branch by preference, but no actual repo/branch exists yet. Use one Linux job, lockfile cache, path filters, serial releases, no scheduled deploys, no overlap/mid-upload cancellation. Preserve server config/uploads/unrelated files. Run controlled migrations/restart steps only if needed; file transfer alone does not execute them. Do not require Node runtime on cPanel for the PHP target.

## Acceptance and rollback
Back up existing target privately; deploy staging first; test HTTPS/home/deep links/API/missing-key/stale/weather/source attribution, then PWA repeat visit and release update. Verify restored prior release too. Do not call automatic deployment working until a real approved workflow ran and public checks succeeded. No such run has occurred.

## First staging release recipe (not yet executed)
1. Confirm in cPanel: flightdeck.gakinz.com exists (or create it), its document root, PHP version (>= 7.4, curl/json/openssl enabled), memory_limit (>= 128M), and that DNS/Cloudflare is Full (strict) for that hostname only.
2. Build locally: pnpm build. Upload CONTENTS of dist/ (including .htaccess and api/index.php) to the subdomain document root. Upload php/private/ to a folder OUTSIDE every webroot named flightdeck-private next to the docroot (src/ and config.example.php). On the server create flightdeck-private/config.php from config.example.php with the OpenSky credentials (typed on the server or via cPanel File Manager, never in chat or Git). Create var/ writable by the PHP user (it is created automatically with 0700 if the parent is writable).
3. Smoke tests: https://flightdeck.gakinz.com/api/config, sample flight, live DL1-style lookup, weather, deep link refresh (/saved route returns the app), service worker update, api/ responses carry no-store.
4. Back up whatever existed first; keep the previous dist for rollback.

## Live evidence (24 October 2026)
Subdomain created by the user in cPanel (docroot ~/flightdeck.gakinz.com, additive; other sites untouched); Cloudflare proxied A record added by the user. Uploaded with scripts/deploy-staging.sh (rsync, no --delete); private source in ~/flightdeck-private; config.php mode 600 created from the local .env without printing secrets. Server PHP CLI 8.4.27 with curl/json/openssl.
Smoke tests via Cloudflare: home 200, deep link /saved 200 (SPA fallback), /api/config 200 liveAvailable true, demo BA117 LHR to JFK, Open-Meteo weather, live OpenSky DL1 matched an airborne aircraft and second call served from cache, validation 400, manifest/sw/icon 200, private paths return the SPA shell (not files). Page renders in Chrome with no console errors.
Known issues: (1) Cloudflare Browser Cache TTL overrides origin headers (sw.js and JS get max-age=14400; origin sends no-cache for sw.js/index.html), which delays PWA updates: set Browser Cache TTL to Respect Existing Headers or add a Cache Rule. (2) trust_cf_connecting_ip is false, so all visitors share one rate-limit bucket (30/min) until verified. (3) Not tested: PWA install/offline/update, mobile devices, web-SAPI PHP version/memory (the live API worked), AutoSSL origin cert / Full (strict) state, no rollback copy exercised.
