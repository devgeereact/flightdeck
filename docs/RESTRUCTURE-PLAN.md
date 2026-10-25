# Flightdeck rebrand and CMS: restructure plan

Status: **PROPOSED, awaiting owner approval.** Nothing in this plan has been implemented. Written 25 October 2026.

## 0. Route, paths and decisions

| Item | Value |
|---|---|
| Route | **A: rebrand inside the existing project** (confirmed by the owner) |
| Project | /Users/realmrgee/Developer/Projects/flightdeck (branch `main`, remote gsakinz/flightdeck, private) |
| Reference kit | /Users/realmrgee/Downloads/Rebrand-and-Restructure (read only, unchanged) |
| Live site | https://flightdeck.gakinz.com, production = `main` = 731dae7, released 25 Oct 07:32 UTC (run 40173177059) |
| Audience | Personal and free: the owner, friends and family, anyone who finds it. Non-commercial, not promoted (fits ADR-008 data licences) |
| Brand | Evolve the current identity: Flightdeck, "Your journey, in view", deep green with lime accent, DM Sans and Manrope |
| URLs | Public site at `/`, server-rendered by PHP from CMS content. App moves to `/app/` |
| CMS scope | Content; settings and branding; inbox and operations. **No editor role**: owner only (`admin_user_ids`) |
| Storage | Versioned JSON files in the existing private `var/` folder. No database (no architecture change) |

## 1. Backup (done before any change)

`~/repo-backups/flightdeck-2026-10-25-1808-pre-rebrand/` (mode 700, files 600):
- `flightdeck-all.bundle`: all 7 refs. Verified: it clones, and the cloned `main` equals HEAD 731dae7.
- `source-tree.tar.gz`: 224 working-tree files, with generated folders and private files left out.
- `private/private-local.tar.gz`: local `.env`, `.env.local` and `php/private/var` (51 entries). Verified: it extracts identical to the live files. No values were printed.
- Patch and status files for the main tree and the three worktrees (all empty: no loose work), plus branch, stash and worktree lists and `SHA256SUMS` (checked OK).

**Server data is NOT in this backup.** The server's private config and `var/` live only on cPanel; a nightly cron already keeps 14 days (RUNBOOK). Before the release that introduces CMS storage, I will ask approval to take a pinned server backup (`config.php` + `var/` + public root `.htaccess`) and download a copy off the server.

## 2. Retained features and behaviour (must keep working)

- Flight lookup by number and date through the PHP pipeline: AeroDataBox (schedule, gates, baggage, with hard allowance caps), OpenSky (live position), adsbdb (usual route). Derived progress and ETA are labelled as estimates; missing values show "Not available".
- Time rules (ADR-012), shareable flight links (`#/flight/<n>/<date>`), Share, countdown, Add to calendar, offline fallback labelled "last fetched".
- Saved flights (device storage for guests, Clerk profile for signed-in users), packing list with server sync, rule-based suggestions, printable packing list.
- Weather (Open-Meteo, current conditions only).
- Clerk sign-in. Server-side RS256 verification on `/api/flights`, `/weather`, `/checklist`, `/me` and `/admin/*`. Owner check by exact user id. Lookups stay sign-in-only (cost protection, ADR-010).
- Owner console: overview, usage, costs and limits, users, enquiries with email reply, Google Analytics, system.
- Contact and feedback forms with all ADR-013 abuse limits. First-party anonymous counters. Consent banner and GA4 only after opt-in.
- All 15 guides and their URLs, breadcrumbs, sitemap and robots. Ads gate stays closed.
- PWA: install, update banner, offline shell. Security headers and the enforced CSP. The release workflow (production branch, additive uploads).
- Provider attribution (AeroDataBox, OpenSky, adsbdb, Open-Meteo).

## 3. Current problems → proposed improvements

| # | Problem (evidence) | Improvement |
|---|---|---|
| P1 | Two separate visual systems: the React app (`src/style.css`, 51 KB, 124 hard-coded colours, ~3 CSS variables) and public pages (CSS string inside `scripts/build-public.mjs` with its own tokens) | One token file (`src/styles/tokens.css`) shared by app, console and server-rendered pages. Components consume tokens only |
| P2 | Public content is HTML strings in `content/pages.mjs`. Any wording change needs a code release | CMS-managed content rendered by PHP at request time, with draft, publish and history |
| P3 | Home (`/`) is a React page. Crawlers see only the `<noscript>` text. Hero overclaims ("Know your flight before the airport does", "where the aircraft is right now") | Server-rendered home with honest copy. Coverage, freshness and limits stated plainly |
| P4 | No public pages for how it works, data coverage, FAQ or accessibility | New pages (section 4) |
| P5 | `main.tsx` (24 KB on few lines) and `Admin.tsx` (23 KB) mix routing, state, I/O and UI | Split by responsibility into `src/app`, `src/features/*`, `src/console/*` with no behaviour change, covered by existing UI tests |
| P6 | Console has no content tools, enquiries cannot be "resolved" or annotated, and there are no last-success/last-failure times per provider | New Content, Settings, Inbox and Operations sections (section 5) |
| P7 | Docs stale: ARCHITECTURE/SCHEMA/SECURITY say "no Clerk/PHP/accounts". CURRENT-TASK says the overnight build is unreleased (it is live) | Canonical docs rewritten to match the code |
| P8 | ~690 MB of merged agent worktrees. Node reference server is out of date (overnight decision) | Approved cleanup (section 8) |

## 4. Public page map (server-rendered, CMS-managed)

| Path | Purpose | Notes |
|---|---|---|
| `/` | Home: hero, flight-lookup form, how it works (3 steps), what you get, honest coverage summary, labelled sample flight, FAQ excerpt, announcement banner | Lookup form sends to `/app/#/flight/<n>/<date>`. Signed-out users sign in first, then land on that flight |
| `/how-it-works/` | Step by step, from typing a number to the data sources answering | Plain English, no claims beyond what the code does |
| `/coverage/` | Data sources and attribution, freshness (cache times, AeroDataBox window yesterday to +3 days), limits (no ocean positions, monthly allowance, usual-route-only cases) | Values come from the real config defaults |
| `/help/` | Help and FAQ (CMS FAQs grouped by category) | Visible Q&A; FAQPage schema only if the owner wants it |
| `/guides/` and 15 `/guides/*` | Unchanged URLs, now CMS-managed | Imported from `content/pages.mjs` |
| `/travel-checklist/` | Printable packing list | Template stays in code (`checklistTemplate.ts`); intro copy is CMS |
| `/about/`, `/contact/` | About; contact form (existing endpoint) | |
| `/privacy/`, `/cookies/`, `/terms/` | Legal, CMS-editable with an enforced "last reviewed" date | Wording updated for the new storage and the new pages |
| `/accessibility/` | Accessibility statement (honest: target WCAG 2.2 AA, known limits) | New |
| 404 / 503 pages | Branded, with useful links. 503 is shown if the content store cannot be read | |
| `/app/` | The signed-in app (tracker, saved, packing list, console) | SPA. Clerk return paths stay routed to it |

Every page gets a title and description from the CMS, a canonical URL, Open Graph/Twitter tags (social image from Settings), JSON-LD (WebSite on home, BreadcrumbList on guides), skip link, landmarks, and visible focus. Public pages still load no third-party scripts (only `/consent.js` and a small `/site.js`).

**Moving the app safely:** `/site.js` on `/` forwards old app links (`/#/flight/…`, `#/checklist`, `#/saved`, `#/admin`) to `/app/#…`. The manifest's `start_url` becomes `/app/` while the service worker stays at `/sw.js` with root scope, so existing installs keep updating. An installed app opening `/` in standalone mode is forwarded to `/app/`. The navigate fallback is limited to `/app/`.

## 5. CMS: navigation, entities, permissions

**Permissions:** every `/api/admin/*` route needs a verified Clerk token AND a user id in `admin_user_ids` (unchanged). There is no role management in the browser. Same-site JSON only on writes (ADR-013 checks reused). Every write is audited.

**Console navigation** (inside `/app/#/console`, the old `#/admin` redirects there):
- **Content**: Pages · Guides · FAQs · Announcements · Navigation
- **Inbox**: Enquiries and feedback (new → read → replied → resolved / archived, internal notes, filters)
- **Operations**: Overview · Usage · Costs and limits · Provider health (new) · Cache · System
- **People**: Users · Google Analytics
- **Settings**: Public settings · Branding assets
- **Audit log**: who changed what, when, with "restore this version"

| Entity | Fields | Workflow |
|---|---|---|
| Page (incl. guides, legal, home sections) | slug (fixed for existing pages), title, description, kind, category, body (safe Markdown), lastReviewed, social image override | Draft → preview → publish. Revision history. Restore any revision as a new draft. Unpublish (except required pages) |
| FAQ | question, answer (safe Markdown), category, order | Same workflow |
| Announcement | message (plain text + one optional link), level (info/warning), where (site, app, both), start and end time | Same workflow. Shown only between start and end |
| Navigation | header links, footer groups | Internal paths, or http(s) and mailto links that pass validation. Same workflow |
| Settings | site name, tagline, owner name, contact email, footer note, home hero text, default social image | Same workflow. No secrets ever stored or shown here |
| Branding asset | logo (SVG not accepted), social image (PNG/JPEG/WebP, ≤ 2 MB, size checks) | Stored privately, served by PHP with the right type. Re-encoded with GD if the server has it; otherwise uploads stay disabled (checked before release) |
| Enquiry (existing) | + `resolved` status, internal notes, resolvedAt | Locked updates (existing mechanism) |
| Provider health (new) | per provider: last success, last failure, failure category (never secrets or payloads), consecutive failures | Written by the existing adapters |

**Rich content safety:** bodies are stored as a constrained Markdown subset (headings h2–h4, paragraphs, lists, bold/italic, links, tables, note callout). The PHP renderer escapes everything first, then builds only allow-listed tags. Links are limited to relative, https, http and mailto, and external ones get `rel="noopener"`. No raw HTML, scripts, iframes, styles or event attributes are possible. Preview uses the same server renderer, so what you preview is what visitors get. Server-side validation covers length limits, slug rules and required fields. Tests include XSS payloads.

## 6. Data, API, migration and recovery

**Storage (private, outside the webroot):**
```
flightdeck-private/var/content/
  published.json          # current published snapshot (atomic swap on publish)
  drafts/<type>/<id>.json
  revisions/<type>/<id>/<UTC-timestamp>-<rev>.json   # immutable, never edited
  media/<sha256>.<ext>
  render-cache/           # rendered page HTML, cleared on publish
var/health/providers.json
var/admin-audit.log       # existing, extended to JSON lines
```
Writes use the existing pattern: lock file, unique temp file, rename, mode 600. Publishing is a single atomic rename. Retention: all revisions kept (they are small). An optional limit can be added later.

**New endpoints:** `GET /api/site/announcements` (public, cached). Admin: `GET/PUT /api/admin/content/{type}/{id}`, `POST …/publish`, `POST …/unpublish`, `GET …/revisions`, `POST …/restore`, `POST /api/admin/content/preview`, `GET/PUT /api/admin/settings`, `POST /api/admin/media`, `GET /api/admin/health`, `GET /api/admin/audit`, `PATCH /api/admin/enquiries/{id}` (adds `resolved` and `note`). Public pages are served through a new `public/site.php` entry (bootstraps the same private code). `public/api/index.php` is unchanged. Unknown operations return 404/405 as now.

**Seed and migration:** a one-time script converts `content/pages.mjs` and `src/siteNav.ts` into seed JSON (`content/seed/`). The PHP side uses the seed when the store is empty, and the first publish copies it into `var/content`. Seed output is checked against the current pages: same URLs, headings and links. On the server, the first request after release builds the store from the seed. No manual data step.

**Server cutover concerns (release time, needs approval):** releases are additive, so the old static `about/index.html` and similar files remain in the public root. New `.htaccess` rules send those paths to `site.php` before the file check, so the old files are ignored. Deleting them is a separate, listed, approved step.

**Recovery:** content changes are recovered with Restore revision in the console. Data loss is covered by the nightly `var/` backup (to be confirmed that it includes `var/content`; the script excludes only caches and rate files). Code rollback: revert on `production` and push (RUNBOOK). The pinned pre-release server backup is taken before cutover.

## 7. Phases and acceptance criteria

Each phase is a separate commit series on `main`, tested locally and shown to the owner before the next. Nothing is pushed to `production`.

| Phase | Work | Accepted when |
|---|---|---|
| 1. Design system and public shell | `tokens.css` (colour, type scale, spacing, radius, shadow, motion), base and components CSS. PHP layout template (header, nav, footer, announcement slot). `site.php` + dev router + Vite proxy | Tokens drive app and site. Header and footer work at 375, 800 and 1440 px. Keyboard and focus pass. Contrast is AA on measured pairs. App looks unchanged or better; `test:ui` passes |
| 2. Landing and public content | Content store (read side), Markdown renderer, seed import, home, how-it-works, coverage, help, accessibility, rewritten legal text, 404/503, SEO/OG/JSON-LD, sitemap from the store | Every existing URL returns 200 with equal or better content. New pages accurate against the code. No invented data. Renderer XSS tests pass. Lighthouse SEO and accessibility checks recorded |
| 3. App move to `/app/` | Vite multi-page input, manifest, SW fallback, redirects, Clerk paths, `.htaccess` | Old links redirect. Sign-in and return work. Shared flight link works signed out (sign in, then open the flight). Installed-PWA path tested in Chrome |
| 4. Console shell and permissions | Split `Admin.tsx`. New console navigation. Server checks on all new routes | Anonymous gets 401, a signed-in non-owner gets 403, the owner gets 200, on every new route (PHP tests + UI) |
| 5. Content workflows | Drafts, preview, publish, unpublish, revisions, restore, audit, navigation, announcements, settings, media | Create, edit, preview, publish and restore each entity through the UI. Public site reflects publish within one request. Audit lists each change. Media uploads either work or are clearly disabled |
| 6. Inbox and operations | Resolved status and notes. Provider health recorder. Cache view | Real values only. A provider with no data says "No data yet" |
| 7. Feature integration and refactor | Split `main.tsx` into `app/` and `features/` (no behaviour change). Home lookup form hands off to the app. Announcements in the app | 92+ unit, all PHP and all UI tests green. Lookup works end to end locally |
| 8. Polish | Loading, empty, unavailable and failure states across site, app and console. Reduced motion. Long-text and zoom checks | Checklist in VERIFICATION with evidence |
| 9. Verification, docs, cleanup | Full test run, build, PHP lint. Approved cleanup. Docs updated. Release artifact and rollback written | Evidence recorded. A release request with the exact steps goes to the owner |

## 8. Cleanup candidates (only with your explicit approval)

| Item | Evidence | Proposed action |
|---|---|---|
| Worktrees `.claude/worktrees/agent-a21deeb…`, `agent-a75c311…`, `agent-a99352b…` (~690 MB) | Each branch is an ancestor of `main` (`git merge-base --is-ancestor` = yes). `git status` is empty in each. They are in the backup bundle | `git worktree remove <path>`, then `git branch -d worktree-agent-…` (refuses unmerged) |
| `server/` (Node/Express reference), `start`, `dev:node`, `parity` scripts, `php/tests/parity.mjs`, deps `express`, `dotenv`, `@types/express` | Overnight notes: Node is out of date versus the PHP API and is retired as a release check. Production runs only PHP. ADR-007 kept it "until formally archived" | **Archive** to `docs/history/node-reference-2026-10-25/` (or keep). Needs your decision plus an ADR. `server/flight.test.ts` would leave `pnpm test` |
| `scripts/deploy-staging.sh` | Manual SSH upload from before the release workflow. Superseded by `release.yml` | Move to `docs/history/` |
| `docs/FLIGHTDECK-HOSTING-{SETUP-PLAN,SETUP-PROMPT,READINESS}.md`, `FLIGHTDECK-START-WITH-HOSTING.md` | One-off setup material from 24 Oct. Facts already summarised in DEPLOYMENT.md | Move to `docs/history/` |
| `scripts/hosting-probe.py`, `.github/workflows/hosting-probe.yml`, `scripts/deployment-test-page.template.html` | Manual probe proven once (run 40077621830). Useful for diagnosing FTPS | **Keep** (recommended). Listed for completeness |
| `content/pages.mjs`, public-page part of `scripts/build-public.mjs` | Replaced by the seed and PHP rendering after phase 2 | Keep until phase 2 passes, then convert into the seed source and remove the rendering code |
| Old static public pages on the server | Will be bypassed by rewrite rules | Separate, listed deletion at release time, after the pinned backup |

Not candidates: `.cursor/`, `.github/copilot-instructions.md`, `docs/history/`, `.ui-test-build/` and `dist/` (generated and ignored), private `var/`, all user data.

## 9. Current → target folder map

```
CURRENT                                TARGET
index.html (SPA at /)                  app/index.html (SPA at /app/)
src/main.tsx (everything)              src/app/{main,AppShell,routes,auth}.tsx
src/FlightView.tsx, flightFormat,      src/features/flight/*
  summary, countdown, ics
src/Checklist*.ts(x), packingBoard     src/features/checklist/*
src/Admin.tsx                          src/console/{ConsoleShell,content/*,inbox/*,ops/*,settings/*,audit/*}.tsx
src/Landing.tsx                        (removed; home is server-rendered, its sample animation reused in site.js)
src/style.css, siteFooter.css          src/styles/{tokens,base,components,app,console}.css (+ site.css built for PHP pages)
src/api.ts, track.ts, tabKeys.ts       src/shared/*
content/pages.mjs                      content/seed/*.json (+ import script scripts/seed-content.mjs)
scripts/build-public.mjs               scripts/build-public.mjs (copies site.css/site.js, robots; pages no longer rendered)
php/private/src/*.php                  unchanged + Content/{Store,Markdown,Validator,Media}.php, Site/{Renderer,templates/*}.php, Health.php
public/api/index.php                   unchanged; + public/site.php, public/site.js
public/.htaccess                       + site routes, /app/ fallback
```

## 10. Docs to update during delivery

PRD, DESIGN (tokens and components), ARCHITECTURE, SCHEMA (content storage), API, SECURITY (CMS threat model), PRIVACY (wording), DEPLOYMENT and RUNBOOK (cutover, restore), new CMS.md, DECISIONS (ADR-015 app at /app/, ADR-016 file-based CMS, ADR-017 safe Markdown), TESTING, VERIFICATION, PROJECT-MEMORY, `.agent/PROJECT.yml` (route metadata, `database: none`, `authentication: clerk`), CURRENT-TASK.

## 11. Open items needing the owner (not blockers for phases 1–8)

- Server: does PHP have GD (or Imagick) for branding uploads? I'll check read-only at release time with your approval.
- Release approval, pinned server backup, deletion of old static files: separate approvals.
- Node reference archive: yes or no (section 8).
