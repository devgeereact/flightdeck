# Flightdeck architecture

Reviewed 1 November 2026. Everything below is live; `main` deploys on every push (DEPLOYMENT.md).

## Shape

```text
flightdeck.gakinz.com (Cloudflare Full strict -> cPanel, LiteSpeed/Apache rules in public/.htaccess)
  /                 public website   -> site.php -> ~/flightdeck-private/src/Site (PHP renders CMS content)
  /guides/ /help/…  public website   -> site.php
  /app/             signed-in app    -> app/index.html (React SPA, hash routes)
  /api/*            API              -> api/index.php -> ~/flightdeck-private/src (App, Cms, providers)
  /media/<hash>     branding images  -> site.php (from private var/content/media)
Private, outside every webroot: ~/flightdeck-private/{src, config.php, var/}
```

No database: shared state is small JSON files under private `var/` written with a lock, a unique temp file and a rename (cache, rate limits, counters, checklists, enquiries, CMS content, provider health). Clerk handles accounts; the API verifies its session tokens itself (JWKS, no Clerk secret needed for that). Releases: push to `main` -> `.github/workflows/deploy.yml` checks, builds and uploads over SSH with snapshots and automatic restore (DEPLOYMENT.md).

## Public website (server-rendered)

`public/site.php` loads `php/private/src/site-bootstrap.php` (`~/flightdeck-private/src/site-bootstrap.php` on the server), which reads the published CMS snapshot (`Content/ContentStore`, or the seed until the first publish) and renders the requested path with `Site/Site.php`: one layout (announcement, header, footer from CMS navigation), page kinds home, page, guide, guide index, packing list, contact, help, 404 and 503, plus `sitemap.xml`. Body text is the safe Markdown subset (`Content/Markdown.php`). Responses carry an ETag and `Cache-Control: no-cache`; security headers and the CSP come from `.htaccess`. Pages load only our own files: `/consent.js`, `site-<hash>.css/js`, and on two pages `js/contact-<hash>.js` and `js/travel-checklist-<hash>.js`. Asset names come from `site-build.json`, written by `scripts/build-public.mjs`.

`.htaccess` order: API, then the known site paths BEFORE the real-file check (releases are additive, so stale static copies of old pages are bypassed), then `/app/` (real files or the app shell), Clerk return paths, real files, and finally everything else to `site.php` (new CMS pages or a true 404). Tested under Apache with `scripts/check-apache-routes.sh`.

## App (`/app/`)

React 19 + strict TypeScript + Vite, PWA via vite-plugin-pwa (manifest `id: '/'`, `start_url: '/app/'`, scope `/`; service worker at `/sw.js`; offline fallback only for `/app/`). Signed-out visitors see a sign-in screen that names the flight from a shared link; signed-in users get the tracker, saved flights, packing list and, for the owner, the console. Old `/#/flight/...` links and installed apps opening `/` are forwarded by `site.js`.

```text
src/main.tsx                   app shell: router, dashboard, PWA update, Clerk provider
src/app/                       sign-in screen, Clerk glue (token bridge, account bar, saved-flight sync, shared-device clean-up),
                               saved-flight and offline helpers, install help, announcements, feedback
src/features/flight/           flight view, key times (keyTimes.ts: boarding, gate close, runway times; typical values labelled),
                               destination panels (weather, Discover, web check), formatting (ADR-012), summary, countdown, calendar file
src/features/checklist/        packing list UI, model, storage, sync, rules, template, board styles
src/console/                   owner console: shell, operations (Ops.tsx), inbox, provider health, audit, content editor
src/shared/                    API client (token in Authorization and X-Session-Token), tracking, motion, tab keys, smooth scroll
src/styles/                    tokens.css (design tokens), site.css (public site, one layer), workspace.css (app), console.css; src/style.css (app base)
src/site/                      public site scripts (site.js, contact.js, travel-checklist.js); the build also copies node_modules/lenis (smooth scroll) to /lenis-<hash>.js
src/siteNav.ts                 default links (app footer, CMS seed)    src/types.ts  flight contracts
```

## PHP (`php/private/src`)

`bootstrap.php` (API) and `site-bootstrap.php` (site) share `loadConfig.php` (private config.php, environment, and locally only the project's .env). API: `App.php` (routing, limits, auth gate, owner gate), `Cms.php` (console content, preview, media, health, audit routes), `ClerkAuth.php`, `Admin.php`, `Metrics.php`, `Health.php`, `Enquiries.php`, `Mailer.php`, `Checklists.php`, `ClerkApi.php`, `GoogleAnalytics.php`; flight data: `AeroDataBox.php`, `OpenSky.php`, `RouteLookup.php` (adsbdb), `Flight.php`, `Geo.php`; destination: `Place.php` (Wikivoyage/Wikipedia travel guide, cached a week), `WebCheck.php` (Bright Data search links, off unless configured), `WebFacts.php` (gate, terminal, belt and boarding facts that Claude proposes from those results and plain PHP checks before anything is shown, ADR-025; off unless the Anthropic key is set); weather in `App.php` (Open-Meteo current, hourly and 7-day); storage: `Store.php`. CMS: `Content/{Markdown,Validator,ContentStore,Media}.php`, `Content/seed.json`. Site: `Site/Site.php`.

## Flight page layout (1 Nov 2026)

Summary (route, scheduled/estimated/actual times) → Gates and key times (two rows of four: departure gate, boarding starts, gate closes, take-off; landing, reaches the gate, arrival gate, baggage belt) → aircraft position → tabs (Journey, Airport, Updates). On screens 1280px and wider the destination column (weather now and at landing, 4-day forecast, Discover, optional web links) sits alongside; narrower, it follows the key times.

## Node reference server (retired)

Removed from the app on 25 Oct 2026 (ADR-018) and from `docs/history` on 1 Nov 2026; it is in git history only. `pnpm dev` runs Vite with the PHP dev router.

## Known limits

Provider payload validation is light (guards, not schemas). File storage assumes one server (no shared cache across machines); fine for cPanel. Rendering is per request with no server-side HTML cache; pages are small and revalidated with ETags, so this has not been a measured problem. The live server's GD support (for branding uploads) is unconfirmed.
