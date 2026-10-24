# Current task and handoff

Date: 24 October 2026.
Approved by the user: OpenSky replaces FlightAware; target host flightdeck.gakinz.com; PHP backend ("pick the best one"). Still NOT approved/done: DNS/Cloudflare changes, cPanel access, git init, any deployment.

Completed this session: OpenSky adapter in Node (reference) and a full PHP port: public/api/index.php, php/private/src/*, public/.htaccess, php/dev-router.php, php/tests/run.php, php/tests/parity.mjs, package.json scripts test:php and parity, .gitignore entries; docs updated (MIGRATION-PHP, ARCHITECTURE, DEPLOYMENT recipe, API, TESTING, VERIFICATION, DECISIONS ADR-006/007, PROJECT-MEMORY, PROJECT.yml).

Checks (local): pnpm test 6/6; pnpm build OK (dist has .htaccess + api/index.php); php tests 15/15; parity 14/14 identical; live OpenSky and Open-Meteo through PHP verified; rate limiter, cache, safe errors verified. Not tested: UI in a browser against PHP, Apache rewrite rules, cPanel PHP version/memory, Cloudflare.

Local state: Homebrew php 8.5.12 installed. Local .env still has legacy names clientId/clientSecret (accepted) and an unused FLIGHTAWARE_API_KEY line; user to rename/remove. php/private/var is gitignored cache; deleted after tests.

Deployed 24 Oct 2026 (user created subdomain + Cloudflare record; assistant uploaded). White screen reported earlier was the empty docroot before upload; fixed by upload. Open items: Cloudflare Browser Cache TTL, trust_cf_connecting_ip, Full (strict) check, PWA tests, git/repo + release workflow. Local dev server may still be running on 3998.

Hosting setup done 24 Oct 2026: private repo gsakinz/flightdeck, scoped FTP account, repo secrets (names only), manual probe PASS (run 40077621830). Details in docs/DEPLOYMENT.md and docs/FLIGHTDECK-HOSTING-SETUP-PLAN.md. Next: reviewed production release workflow (production branch + manual), manifest MIME fix, Cloudflare Full (strict)/cache check by the user. Nothing from the full app was deployed by this task.

Live data build, 24 Oct 2026 (not pushed, not deployed): PHP pipeline OpenSky + adsbdb route + AeroDataBox (needs user key), UI shows route/progress/ETA estimate/attribution, 46 php tests. Files: php/private/src/{Geo,RouteLookup,AeroDataBox,Flight,App,bootstrap}.php, config.example.php, php/tests/*, src/{types.ts,main.tsx,style.css}, docs API/DECISIONS/INTEGRATIONS/VERIFICATION. Needs: user creates RapidAPI AeroDataBox Basic key; then add aerodatabox_key to the server config.php; push main and release via production branch only after approval.

Fix round 24 Oct 2026 (released d64b709, verified live): PWA update banner, Cloudflare-verified per-visitor rate limit (server flag trust_cf_connecting_ip now true), Node 24 actions. Open: phone/installed PWA test, banner on a real new release, FRA/JFK-style routes need OpenSky coverage for live position (none over oceans), AeroDataBox free allowance 400 units/month (server stops at 360).

UI/data/Clerk round 24 Oct 2026 (local only, NOT pushed): see docs/VERIFICATION.md last section and ADR-009. To release: push main, then the owner pushes production; the release build only includes login when the GitHub variable VITE_CLERK_PUBLISHABLE_KEY is set (do not set the development key on the live site; create a Clerk production instance first). Local .env now has VITE_CLERK_PUBLISHABLE_KEY (dev).

Sign-in enforcement 24 Oct 2026 (local only): see ADR-010. Go-live order: owner adds 5 Clerk CNAMEs in Cloudflare -> get_domain_status complete -> set GitHub variable VITE_CLERK_PUBLISHABLE_KEY (pk_live...) -> push main -> owner pushes production -> verify landing/login on the live site -> ONLY THEN add clerk_issuer + clerk_authorized_parties to the server config.php (backup first) -> verify anonymous 401 / signed-in 200 live.

Next bounded task (superseded by the above deployment): read-only cPanel/DNS discovery for flightdeck.gakinz.com (subdomain exists? document root, PHP version/extensions/memory_limit, Cloudflare zone), then follow docs/DEPLOYMENT.md staging recipe. Do not deploy without explicit approval.

Handoff 24 Oct 2026 by agent **Skyhook** (Claude Code, Claude Sonnet 5.5): created subdomain and Cloudflare record, verified SSL strict, added hostname-scoped cache rule, fixed manifest MIME (62ab381), built release.yml + scripts/release-static.py, installed the restricted release key (user ran the setup script), created the `production` branch and ran release 40078631011 (PASS). Files: .github/workflows/release.yml, scripts/release-static.py, public/.htaccess, docs (DEPLOYMENT, RUNBOOK, VERIFICATION, ROADMAP, PROJECT-MEMORY, hosting plan/readiness). Blockers/open: enabling trust_cf_connecting_ip needs user approval; PWA update untested on a device.
