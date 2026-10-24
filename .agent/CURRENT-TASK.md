# Current task and handoff

Date: 24 October 2026.
Approved by the user: OpenSky replaces FlightAware; target host flightdeck.gakinz.com; PHP backend ("pick the best one"). Still NOT approved/done: DNS/Cloudflare changes, cPanel access, git init, any deployment.

Completed this session: OpenSky adapter in Node (reference) and a full PHP port: public/api/index.php, php/private/src/*, public/.htaccess, php/dev-router.php, php/tests/run.php, php/tests/parity.mjs, package.json scripts test:php and parity, .gitignore entries; docs updated (MIGRATION-PHP, ARCHITECTURE, DEPLOYMENT recipe, API, TESTING, VERIFICATION, DECISIONS ADR-006/007, PROJECT-MEMORY, PROJECT.yml).

Checks (local): pnpm test 6/6; pnpm build OK (dist has .htaccess + api/index.php); php tests 15/15; parity 14/14 identical; live OpenSky and Open-Meteo through PHP verified; rate limiter, cache, safe errors verified. Not tested: UI in a browser against PHP, Apache rewrite rules, cPanel PHP version/memory, Cloudflare.

Local state: Homebrew php 8.5.12 installed. Local .env still has legacy names clientId/clientSecret (accepted) and an unused FLIGHTAWARE_API_KEY line; user to rename/remove. php/private/var is gitignored cache; deleted after tests.

Deployed 24 Oct 2026 (user created subdomain + Cloudflare record; assistant uploaded). White screen reported earlier was the empty docroot before upload; fixed by upload. Open items: Cloudflare Browser Cache TTL, trust_cf_connecting_ip, Full (strict) check, PWA tests, git/repo + release workflow. Local dev server may still be running on 3998.

Hosting setup audit, 24 Oct 2026 (read-only, no external changes): see docs/FLIGHTDECK-HOSTING-SETUP-PLAN.md. Blocked on user confirmation of GitHub owner/repo, FTP password route, Cloudflare check method, GitHub plan and commit identity. Files changed: that doc and this note only.

Next bounded task (superseded by the above deployment): read-only cPanel/DNS discovery for flightdeck.gakinz.com (subdomain exists? document root, PHP version/extensions/memory_limit, Cloudflare zone), then follow docs/DEPLOYMENT.md staging recipe. Do not deploy without explicit approval.
