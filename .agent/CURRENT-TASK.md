# Current task and handoff

## 29 October 2026 — repository moved
- Now `devgeereact/flightdeck` (transferred from gsakinz; history, issues and secrets kept). Main is protected from force-push and deletion.

## 28 October 2026 — aligned with build-kit v4 (Status: DONE locally; CI pending first run)
- Changed: Biome replaces the Prettier config (formatting-only commit in `.git-blame-ignore-revs`), `pnpm check` gate, gitleaks pre-commit hook, `ci.yml` (check, smoke tests, PHP syntax, secret scan), **release is manual from main** (check-only default, typed RELEASE), uptime every 6 h, Dependabot, `.node-version`, AGENTS.md entry point, project Claude permissions; graphify on demand only. Decisions in `docs/DECISIONS.md` (28 Oct).
- Checks: `pnpm check` PASS (lint 0 errors, typecheck, 104 tests, PHP tests, build); `pnpm test:ui` and `pnpm test:console` PASS.
- Note: the `production` branch is 6+ commits behind main; the next release (from main) will publish everything since 24 Oct. Run `check-only` first.
- Next: lint warnings in slices (ROADMAP "Code-quality follow-ups"); add an external uptime monitor.

Date: 24 October 2026.
Approved by the user: OpenSky replaces FlightAware; target host flightdeck.gakinz.com; PHP backend ("pick the best one"). Still NOT approved/done: DNS/Cloudflare changes, cPanel access, git init, any deployment.

Completed this session: OpenSky adapter in Node (reference) and a full PHP port: public/api/index.php, php/private/src/*, public/.htaccess, php/dev-router.php, php/tests/run.php, php/tests/parity.mjs, package.json scripts test:php and parity, .gitignore entries; docs updated (MIGRATION-PHP, ARCHITECTURE, DEPLOYMENT recipe, API, TESTING, VERIFICATION, DECISIONS ADR-006/007, PROJECT-MEMORY, PROJECT.yml).

Checks (local): pnpm test 6/6; pnpm build OK (dist has .htaccess + api/index.php); php tests 15/15; parity 14/14 identical; live OpenSky and Open-Meteo through PHP verified; rate limiter, cache, safe errors verified. Not tested: UI in a browser against PHP, Apache rewrite rules, cPanel PHP version/memory, Cloudflare.

Local state: Homebrew php 8.5.12 installed. Local .env still has legacy names clientId/clientSecret (accepted) and an unused FLIGHTAWARE_API_KEY line; user to rename/remove. php/private/var is gitignored cache; deleted after tests.

Deployed 24 Oct 2026 (user created subdomain + Cloudflare record; assistant uploaded). White screen reported earlier was the empty docroot before upload; fixed by upload. Open items: Cloudflare Browser Cache TTL, trust_cf_connecting_ip, Full (strict) check, PWA tests, git/repo + release workflow. Local dev server may still be running on 3998.

Hosting setup done 24 Oct 2026: private repo gsakinz/flightdeck, scoped FTP account, repo secrets (names only), manual probe PASS (run 40077621830). Details in docs/DEPLOYMENT.md and docs/history/hosting-setup-2026-10-24/FLIGHTDECK-HOSTING-SETUP-PLAN.md. Next: reviewed production release workflow (production branch + manual), manifest MIME fix, Cloudflare Full (strict)/cache check by the user. Nothing from the full app was deployed by this task.

Live data build, 24 Oct 2026 (not pushed, not deployed): PHP pipeline OpenSky + adsbdb route + AeroDataBox (needs user key), UI shows route/progress/ETA estimate/attribution, 46 php tests. Files: php/private/src/{Geo,RouteLookup,AeroDataBox,Flight,App,bootstrap}.php, config.example.php, php/tests/*, src/{types.ts,main.tsx,style.css}, docs API/DECISIONS/INTEGRATIONS/VERIFICATION. Needs: user creates RapidAPI AeroDataBox Basic key; then add aerodatabox_key to the server config.php; push main and release via production branch only after approval.

Fix round 24 Oct 2026 (released d64b709, verified live): PWA update banner, Cloudflare-verified per-visitor rate limit (server flag trust_cf_connecting_ip now true), Node 24 actions. Open: phone/installed PWA test, banner on a real new release, FRA/JFK-style routes need OpenSky coverage for live position (none over oceans), AeroDataBox free allowance 400 units/month (server stops at 360).

UI/data/Clerk round 24 Oct 2026 (local only, NOT pushed): see docs/VERIFICATION.md last section and ADR-009. To release: push main, then the owner pushes production; the release build only includes login when the GitHub variable VITE_CLERK_PUBLISHABLE_KEY is set (do not set the development key on the live site; create a Clerk production instance first). Local .env now has VITE_CLERK_PUBLISHABLE_KEY (dev).

Sign-in enforcement 24 Oct 2026 (local only): see ADR-010. Go-live order: owner adds 5 Clerk CNAMEs in Cloudflare -> get_domain_status complete -> set GitHub variable VITE_CLERK_PUBLISHABLE_KEY (pk_live...) -> push main -> owner pushes production -> verify landing/login on the live site -> ONLY THEN add clerk_issuer + clerk_authorized_parties to the server config.php (backup first) -> verify anonymous 401 / signed-in 200 live.

LIVE 24 Oct 2026: login + landing released (production dec07ff) and sign-in enforcement ON (server config.php clerk_issuer set; backup config.php.bak-202610241321-pre-signin-check). See docs/VERIFICATION.md last section for proof and rollback. Open: Google login credentials, password length rule (15), phone test.

Phases 0-3 of the 24 Oct plan are built and committed LOCALLY, nothing pushed (checklist, sync, owner console, counters, enquiries, feedback). Remaining: 4 consent+GA4+legal pages, 5 GA numbers in console, 6 rules suggestions, 7 public pages+ads gate, 8 AI. Before releasing 0-3 the server config needs: admin_user_ids (owner's production Clerk id), owner_email, clerk_secret_key (for Users tab) and the privacy page must disclose counters/enquiries. Release order in docs/VERIFICATION.md.

Next bounded task (superseded by the above deployment): read-only cPanel/DNS discovery for flightdeck.gakinz.com (subdomain exists? document root, PHP version/extensions/memory_limit, Cloudflare zone), then follow docs/DEPLOYMENT.md staging recipe. Do not deploy without explicit approval.

Handoff 24 Oct 2026 by agent **Skyhook** (Claude Code, Claude Sonnet 5.5): created subdomain and Cloudflare record, verified SSL strict, added hostname-scoped cache rule, fixed manifest MIME (62ab381), built release.yml + scripts/release-static.py, installed the restricted release key (user ran the setup script), created the `production` branch and ran release 40078631011 (PASS). Files: .github/workflows/release.yml, scripts/release-static.py, public/.htaccess, docs (DEPLOYMENT, RUNBOOK, VERIFICATION, ROADMAP, PROJECT-MEMORY, hosting plan/readiness). Blockers/open: enabling trust_cf_connecting_ip needs user approval; PWA update untested on a device.

## Update 24 Oct 2026 (latest)
Released to production: travel checklist with sync, owner console (#/admin), counters, contact and feedback, consent + GA4, public pages, rule-based suggestions. Ads built but OFF (docs/MONETISATION.md). Owner supplied GA ID, mailbox, Clerk secret, GA service account, admin id (set in server config). Open: owner verification of console and GA tab live, CSP/HSTS, backups of private var/, soft-404 for unknown paths, Phase 8 AI, licence decisions.

## Time-correctness audit 25 Oct 2026 (local branch, not pushed, not deployed)
Fixed: PHP schedule window now accepts yesterday..+3 days for any local date on Earth (was the UTC date, a day off near midnight); owner-console counters use UK days with calendar-day ranges; summary labels a zone-less time as UTC; time()/day() return "Not available" for unreadable times or zones instead of throwing; trip flight dates must be real YYYY-MM-DD dates; a vacuous summary test (`|| true`) now asserts. Added `ukDate()` in src/flightFormat.ts for main.tsx to adopt. Files: src/{flightFormat,summary,checklistModel}.ts, php/private/src/{Flight,Metrics}.php, test/time.test.ts, test/suggestions.test.ts, php/tests/run.php, docs/{API,DECISIONS}.md. Checks: pnpm test 78/78 (also under TZ=America/Los_Angeles, Pacific/Kiritimati, Asia/Tokyo), tsc OK, php tests 168/168. Pending (files this task could not edit): main.tsx date badge and today(), FlightView ETA/journey/fetched labels; see the handoff report.

## Overnight build 25 Oct 2026 (RELEASED: production = 731dae7, run 40173177059, 07:32 UTC)
See docs/OVERNIGHT-2026-10-25.md. New: flight links and Share, countdown, Add to calendar, offline fallback, saved-flight day labels, install help; UK time and DST fixes; security hardening (ADR-013); 4 new guides with breadcrumbs; full UX and accessibility pass. Release when reviewed: `git push origin main:production`. Open for the owner: clerk_authorized_parties on the server, phone check, AdSense, Anthropic key, second admin id.

## Rebrand, public website and CMS, 25 Oct 2026 (Route A; committed on main, NOT pushed, NOT released)
Approved plan: docs/RESTRUCTURE-PLAN.md. Built: design tokens; PHP-rendered public site at / from CMS content (home with lookup, how it works, coverage, help/FAQ, accessibility, all old pages at their addresses); app moved to /app/ (sign-in screen, old links forwarded, manifest id kept); file-based CMS with drafts, preview, publish, history, restore, audit, media; inbox resolve/notes; provider health; console rebuilt in src/console; app source in feature folders. Docs: CMS.md, ARCHITECTURE, DESIGN, SCHEMA, API, SECURITY, DECISIONS ADR-015..017, TESTING, RUNBOOK, PRIVACY, PRD, VERIFICATION, RELEASE-PLAN-REBRAND.md.
Checks (local): build PASS; pnpm test 100/100 (106 before the Node archive); test:php PASS; test:ui 47/47; test:console 16/16; Apache route check 22/22.
Backups: ~/repo-backups/flightdeck-2026-10-25-1808-pre-rebrand (verified). Release artifact record: ~/flightdeck-release-artifacts/ (see final report).
Waiting for the owner: (1) approval to push main; (2) read-only server checks (GD, backup scope) and a pinned server backup; (3) owner pushes production; (4) approval of the SERVER clean-up list (RELEASE-PLAN step 5). Local clean-up is done (worktrees removed, Node server archived ADR-018, hosting docs moved to docs/history).
Do not: deploy, force-push, delete remote branches, or delete server files without that approval.

## Design polish, 25 October 2026 (local only; not committed, pushed or deployed)

User requested a professional redesign including landing and real data; subsequently authorised a clean design if the demo could not be found. Implemented: dark desktop navigation, refined search and flight panels, first-use tracker welcome, split sign-in introduction, search-led landing with a product introduction in place of fictional flight records. Preserved real API/auth/data behaviour. Removed unused sample-card CSS.

Files: src/main.tsx, src/app/SignInScreen.tsx, src/style.css, src/styles/site.css, php/private/src/Site/Site.php, test/site.test.mjs, test/ui-smoke.mjs, docs/DESIGN.md and this handoff.

Checks: pnpm test PASS 100/100; pnpm test:php PASS; pnpm build PASS. pnpm test:ui PASS (all 47 checks); public assets rebuilt after removing unused CSS; git diff --check PASS. Initial assertions caught undersized new text (fixed) and the changed welcome wording (updated assertion). Unit/UI tests need local sockets outside the sandbox; approved command prefixes used. Browser visual QA NOT TESTED: no browsers available through computer-use (listBrowsers returned []). Live providers were not called by this pass; UI coverage uses explicit test fixtures. No release authorised or performed.

## Full redesign follow-up (October 2026, local only)

Active user explicitly requested a full redesign retaining all functionality. Implemented coordinated public site, shared footer, sign-in, full tracker/details, saved cards, packing room, printable packing tool and owner console. Existing data/auth/backend contracts preserved. New component: src/app/SavedFlightCollection.tsx. New app composition stylesheet: src/styles/workspace.css. Changed: src/main.tsx, src/styles/{tokens,site,console}.css, src/siteFooter.css, src/features/{flight/FlightView.tsx,checklist/Checklist.tsx,checklist/packingBoard.css}, php/private/src/Site/Site.php, test/ui-smoke.mjs, docs/DESIGN.md, this handoff; preceding-turn changes also remain uncommitted.

PASS: production build (TypeScript + Vite + PWA + public assets), pnpm test 100/100, pnpm test:php all passed, pnpm test:ui 50 checks, pnpm test:console 16 checks. Fixed case-insensitive component filename collision found by TypeScript (renamed to SavedFlightCollection); retained Past badge wording caught by UI test. Added 3 functional saved-card regression checks.

Safari desktop reviewed: public landing, signed-out sign-in, tracker empty state and created packing workspace. The temporary app preview at 127.0.0.1:3995 used an ignored test build (server stopped after review) (no Clerk, provider calls or production data). Its temporary HTML had a character-encoding issue; production HTML includes UTF-8 and rendered correctly. A test trip named Design review trip exists only in that preview origin's browser storage. Public/normal app preview: 127.0.0.1:3996. Native Safari review succeeded after browser-plugin discovery had returned no browsers. Phone visual QA, installed PWA, real login completion and live provider searches are NOT TESTED in this pass. No pushes, deployment, commits, provider activation or user-data migrations performed.

## Alignment, footer and expanded packing list, 26 October 2026 (local only)

User requested aligned cards without isolated final-row cards, three footer links per group with Help and FAQ moved to Guides and tools, a fuller clean printable packing list accessible without sign-in, and matching app fixes. Implemented balanced collection rows in site/workspace CSS (single-column phones and full-width single actual records), equal card heights, aligned packing columns, 40 appended default packing items (141 total), guest Show all sections/progress/checked or blank print, A4 trip/date fields and all-section printing. Footer source and seed now have 3/3/3/3 links. No persisted CMS snapshot or user checklist overwritten; original item IDs and public checkbox keys unchanged.

Changed this round: src/siteNav.ts; src/features/checklist/{checklistTemplate.ts,packingBoard.css}; src/site/travel-checklist.js; src/styles/{site,workspace}.css; php/private/src/{Site/Site.php,Content/seed.json}; test/{checklist.test.ts,suggestions.test.ts,site.test.mjs,ui-smoke.mjs}; docs/DESIGN.md; this handoff. Previous uncommitted redesign files remain.

PASS: pnpm test 103/103; pnpm test:php all; pnpm test:ui 50 checks; production build; git diff --check. Existing expectations for hidden section totals and Laundry bag suggestion were adapted to the expanded defaults. Safari public list and anonymous A4 print preview reviewed (all four pages offered); cancelled without printing. Subsequent native card screenshot request timed out/reset, so no additional card/mobile visual verification claimed. Print section pagination tightened after that review to keep sections together. No commit, push or deployment.

## Live-account local preview, 26 October 2026 (setup pending OS administrator authentication)

User requested local access to the existing live account and explicitly approved mkcert CA system trust plus mapping local.flightdeck.gakinz.com to 127.0.0.1. Cause: .env.local intentionally overrides the existing production publishable key in .env with a separate Clerk development instance. Official Clerk docs require a production subdomain, trusted HTTPS and port 443 for production-account local troubleshooting; plain localhost cannot use the live account.

Implemented scripts/local-live.mjs and package script dev:live-account: builds with the existing .env production publishable key, copies PHP sources into ignored .local-live/private, preserves separate local data, verifies production tokens and exact local authorised-party origin, serves HTTPS bound only to 127.0.0.1:443 with host validation, proxies only to loopback PHP :3993. Does not change the live server, DNS or Clerk provider settings; .env.local remains development. Added CLERK_AUTHORIZED_PARTIES env support in loadConfig.php and a PHP regression test; setup-local-https.sh for interactive setup; docs/LOCAL-LIVE-LOGIN.md; .local-live ignore.

Installed mkcert via Homebrew. Auto-review first rejected trust-store install without explicit approval; owner subsequently explicitly approved it. Retried installation created the private local CA but could not trust it because sudo needs an administrator password/interactive terminal. No TLS warning bypass or auth disabling. Certificate/key generated successfully in ignored .local-live/; CA is not yet trusted. /etc/hosts entry is not yet installed. Computer-use access to Terminal was denied by the tool safety policy, so no alternative GUI route was attempted. User must enter password locally using bash scripts/setup-local-https.sh. No live sign-in verified yet. Unit tests 103/103 PASS; PHP suite including local-origin rejection PASS; node/bash/PHP syntax PASS; production build PASS before setup. New files remain uncommitted; no deployment.

### Follow-up after owner completed setup
Owner said setup was done. Host/certificate prechecks now pass and macOS `security verify-cert` reports No error. Preview was not listening; launching exposed EACCES binding port 443. Corrected launcher: scripts/local-live-proxy.mjs binds loopback 443 (sudo only when needed), clears supplementary groups and drops to SUDO_UID/GID immediately after bind. Normal-user launcher continues to own build/PHP. Requires interactive Terminal administrator authentication at startup; no live login verified yet. No changes to live infrastructure.

## Blank local app fixed and both sessions verified, 26 October 2026

Root cause: live-account launcher overwrote normal dist/ with pk_live build; http://127.0.0.1:3996/app/ attempted Clerk production sign-in from unsupported origin and stayed at loading/failure. Fixed scripts/local-live.mjs to build into .local-live/dist using production publishable key only for that isolated build, and set FLIGHTDECK_DIST. php/dev-router.php selects the isolated build for the isolated private directory (canonical realpath comparison) and redirects ordinary /app/ preview links to HTTPS local origin after setup; explicit test dist overrides are exempt. Rebuilt isolated and ordinary dist independently. Existing running PHP/proxy picked up corrected assets without restart.

Added src/app/AuthLoading.tsx + AppBoundary.tsx and loading/retry styling; auth wait and lazy chunk/provider failures no longer give an empty screen. Added test/local-preview.test.mjs exercising two build roots, localhost redirect with query preservation, and harness exemption against throwaway PHP servers. Test originally exposed macOS /var vs /private/var canonical path mismatch; fixed with realpath comparison.

VERIFIED in native Safari: local.flightdeck.gakinz.com/app/ loaded dashboard and packing list signed in as the existing live user; flightdeck.gakinz.com/app/ loaded dashboard with the same account and owner console. Did not sign out or alter credentials. Local HTTPS 200, anonymous local /api/me 401, ordinary /app/ 302 to approved local HTTPS, Clerk public /v1/environment 200 for both origins. Browser tool intermittently timed out, but both signed-in screens were subsequently observed. No production deployment or provider configuration changes.

Checks before final fallback addition: pnpm test 104 tests (final result below), PHP PASS, app UI 50 PASS, isolated + ordinary builds PASS. Final checks recorded below. Other unrelated working-tree changes (.claude, CLAUDE.md, graphify files) belong to the user and were not edited.

Final checks for blank-screen fix: pnpm test 104/104 PASS; pnpm test:php PASS; pnpm test:ui 50/50 PASS after AppBoundary addition; normal build and isolated production-account build PASS; syntax and git diff --check PASS. Both real signed-in Safari screens observed. The existing local HTTPS/PHP processes stayed running; no further administrator action or restart required for this fix.

## Second redesign, airport signage, 26 October 2026 (local only; not committed, pushed or deployed)

Requested by the owner: full redesign of site, app, sign-in and console with no generic AI styling, using ui-ux-pro-max, lenis, humanizer, impeccable-style review, the NerdWallet getdesign reference, the 21st catalogue and (where needed) hyperframes. Result and rationale: docs/DESIGN.md "Second redesign", ADR-019. Colours, fonts, routes, APIs, auth and data behaviour are unchanged.

Changed: src/styles/{tokens,site,workspace,console}.css (tokens: radii 4/6/10, flatter shadows, board tokens, .fd-label; site.css rewritten as one layer), src/style.css and src/siteFooter.css and src/features/checklist/packingBoard.css (66 hard-coded radii mapped to tokens; KPI grid fix), php/private/src/Site/Site.php (home markup: hero with lookup strip and result board, sources row, ruled sections, lime closing band; Lenis script tag), php/private/src/site-bootstrap.php and php/dev-router.php and scripts/build-public.mjs (lenis asset), src/site/site.js (Lenis start, scroll reveal, both off for reduced motion), src/app/SignInScreen.tsx and src/main.tsx (plain copy), content/site-content.mjs and php/private/src/Content/seed.json (closing title), public/consent.js (radii), test/site.test.mjs and test/ui-smoke.mjs (assertions for new copy and board), docs (DESIGN, DECISIONS ADR-019, VERIFICATION, ARCHITECTURE, TESTING, this file).

Checks: build PASS; pnpm test 104/104; test:php PASS; test:ui 50/50; test:console 16/16; seed check PASS; 44 screenshots at 1440/768/375 with no overflow. Defects fixed: phone overflow in the app search card and provider-health page; low-contrast numerals.

Not done / not tested: real phone, installed PWA, screen reader, Safari/Firefox, real Clerk widget, cookie banner with GA on, any provider call, the live server; smooth-scroll feel by eye. Hyperframes not used (see ADR-019). 21st: patterns only, no code installed. Before any release: owner reviews locally (`pnpm build`, then `php -S 127.0.0.1:3998 php/dev-router.php`; delete dist/site-build.json for live CSS edits or rebuild), then commit, push main, owner pushes production per docs/RELEASE-PLAN-REBRAND.md. Stray scratch: none left in the repo (.shot-tmp removed).

Follow-up 26 Oct 2026 (local): fixed the raw service-worker error text (src/shared/api.ts readableError, used in src/main.tsx; test B16b) and the heavy console type and uneven icons (src/styles/console.css final block; nav label "Enquiries"). Docs: DESIGN.md, VERIFICATION.md. The local live-account preview must be restarted by the owner (`pnpm dev:live-account`, needs the macOS password in Terminal) to pick up the new build; the plain preview on 127.0.0.1:3998 already serves it.

## 2026-10-30: docs tidy
Docs tidy (owner rule: one source of truth): Markdown moved into docs/, audits and checklists merged into docs/AUDIT.md, exact duplicates removed, links updated. No code changed. Tasks stay in this file; every audit is added to `docs/AUDIT.md`.
- 30 Oct 2026: push to `main` deploys over SSH (`deploy.yml`, `scripts/release.mjs`); `release.yml` and the FTPS script removed. Dry run: main is ahead of live (9 private PHP files, new front-end build), so the first deploy ships that.
- 30 Oct 2026: first Actions SSH deploy released `a7d37d4` (20261030T191903Z): 9 private PHP files and the new front-end build; 13 files snapshotted; smoke 3/3. Undo: `pnpm release --rollback --go`.

## Redesign prototype, 31 October 2026 (artifact only; no repo code changed, nothing committed, pushed or deployed)

Owner asked for a high-end redesign planned from three references (FlyScope-style travel dashboard, an Oripio palette card: #1866FF / #FFFFFF / #FFB618 / #8818FF / #000000 with Inter, and a goflight-style photo hero with an overlapping search card), using ui-refactor, ui-ux-pro-max and GSAP, and built first as working artifacts.

Built: one private artifact, "Flightdeck Redesign" (https://claude.ai/artifact/3Z9QxDzKCa8tMuT9DCD47T), three linked pages sharing fd.css / fd.js / data.js:
- index.html: website. Photo hero, overlapping tabbed search card (Track a flight / Start a packing list), data sources row, result anatomy (no fabricated flight record), freshness panel, features, "Before you fly" (Destinations: JFK, DXB, CDG from destinations.ts; 3 guide categories, 3 cards each), how it works, public packing list (141 items, A4 preview), FAQ, contact form into the console inbox, CMS-driven nav, footer and announcement bar.
- app.html: sign-in (Google, email code, wrong-code state), tracker, flight result (example flights BA117, EK2, BA304, all labelled "Example data"; times in UTC converted with real zone rules), not-found and usual-route states, save/share/calendar, 5 detail tabs, saved flights (Flip on remove, undo), packing room (trips, sections, tick, rename, hide, own items, suggestions, reset), help, feedback, install, account.
- console.html: owner gate and non-owner denied state; Pages and Guides (filters, editor, autosaved draft, preview, publish, hide, history and restore); the home hero and closing band publish to the website; FAQ, announcements, menus, inbox (notes, resolve), overview, usage, costs and limits, provider health, users, GA, site settings, system, audit log.
Source files: the session scratchpad `fd/` folder (not in the repo).

Design decisions: brand moves from green to blue #1866FF with Inter / Inter Tight. This supersedes the 26 Oct "colours unchanged" rule (ADR-019) and needs an ADR when implemented. Amber is a fill only (10.2:1 with ink). Blue text only on white (4.79:1); on the grey canvas use #1458E0 (6.0:1). Chart pair blue + #D97706 passed the dataviz CVD validator; blue + violet failed (deutan ΔE 1.4), so violet is for badges only. Photos: 3 CC0 (Unsplash via Wikimedia Commons), plus CC BY-SA 3.0, CC BY 2.0 and CC BY-SA 3.0 city photos. Credits are listed in the site footer and must ship with them.

Checks: headless Chrome shell screenshots at 1440 and 390 of the site, sign-in, tracker, flight, packing, console overview, editor and inbox. Final run: no page errors and no sideways overflow. One review pass fixed grid overflow on phones, packing panel height, badge letter-spacing, a duplicate top-bar logo, an empty gap in the next-flight panel and the flight-number field height. NOT TESTED: real phone, Safari/Firefox, screen reader, the artifact viewer itself (cross-page links rely on relative paths).

Found on the way: the live home page search description is 185 characters, against the 155 guideline.

Next: owner reviews the artifact and gives feedback. Then plan the implementation in slices: tokens, then public site PHP templates, then app, then console. Record a new ADR for the blue rebrand, and update docs/DESIGN.md and CHANGELOG at implementation time.

## 31 October 2026: blue redesign built and released (owner: "I approve this design… build it to live… create our own logo")
- Built on branch `redesign-blue`, merged to `main`: foundation (tokens, Inter fonts, own logo and icons, photos), public website, signed-in app, owner console, then the owner's follow-up fixes (sticky header, branded A4 packing list, aligned guide cards, footer "© Gakinz", credits on About only, longer footer description). Decision: ADR-020. Design: docs/DESIGN.md. Changes: docs/CHANGELOG.md. Checks: docs/AUDIT.md (31 Oct).
- Checks: `pnpm check` PASS (107/107), `pnpm test:ui` PASS, `pnpm test:console` PASS; visual review at 1440/900/390; A4 print one page.
- Open for the owner: the footer description and any other settings may be overridden by a published CMS snapshot on the server (edit in console Site settings if the live footer still shows the old text); Google sign-in and the console with the production account to be checked live; a real phone, Safari/Firefox and a screen reader are not tested.
- Product choices made: destination "favourite" hearts kept (local-only, as in the prototype); console FAQ reorder buttons not built (order is a per-question field and the API rate limit would make reordering several saves); no maintenance switch or GA ID in console settings (the server keeps neither).
