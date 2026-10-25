# Flightdeck architecture

Reviewed 25 October 2026. "Live" means the production release of 25 Oct (731dae7). "Local" means committed on `main` after it and not released (rebrand and CMS, see RESTRUCTURE-PLAN.md).

## Shape

```text
flightdeck.gakinz.com (Cloudflare Full strict -> cPanel, LiteSpeed/Apache rules in public/.htaccess)
  /                 public website   -> site.php -> ~/flightdeck-private/src/Site (PHP renders CMS content)   [local]
  /guides/ /help/…  public website   -> site.php                                                              [local]
  /app/             signed-in app    -> app/index.html (React SPA, hash routes)                               [local; live at /]
  /api/*            API              -> api/index.php -> ~/flightdeck-private/src (App, Cms, providers)       [live + local CMS routes]
  /media/<hash>     branding images  -> site.php (from private var/content/media)                             [local]
Private, outside every webroot: ~/flightdeck-private/{src, config.php, var/}
```

No database: shared state is small JSON files under private `var/` written with a lock, a unique temp file and a rename (cache, rate limits, counters, checklists, enquiries, CMS content, provider health). Clerk handles accounts; the API verifies its session tokens itself (JWKS, no Clerk secret needed for that). Releases: push to `production` -> GitHub Actions tests, builds, rsyncs `php/private/src` over a restricted key, then uploads `dist/` over FTPS additively (DEPLOYMENT.md).

## Public website (server-rendered)

`public/site.php` loads `src/site-bootstrap.php`, which reads the published CMS snapshot (`Content/ContentStore`, or the seed until the first publish) and renders the requested path with `Site/Site.php`: one layout (announcement, header, footer from CMS navigation), page kinds home, page, guide, guide index, packing list, contact, help, 404 and 503, plus `sitemap.xml` and (only when the ads gate in the server config is fully open) `ads.txt`. Body text is the safe Markdown subset (`Content/Markdown.php`). Responses carry an ETag and `Cache-Control: no-cache`; security headers and the CSP come from `.htaccess`. Pages load only our own files: `/consent.js`, `site-<hash>.css/js`, and on two pages `js/contact-<hash>.js` and `js/travel-checklist-<hash>.js`. Asset names come from `site-build.json`, written by `scripts/build-public.mjs`.

`.htaccess` order: API, then the known site paths BEFORE the real-file check (releases are additive, so stale static copies of old pages are bypassed), then `/app/` (real files or the app shell), Clerk return paths, real files, and finally everything else to `site.php` (new CMS pages or a true 404). Tested under Apache with `scripts/check-apache-routes.sh`.

## App (`/app/`)

React 19 + strict TypeScript + Vite, PWA via vite-plugin-pwa (manifest `id: '/'`, `start_url: '/app/'`, scope `/`; service worker at `/sw.js`; offline fallback only for `/app/`). Signed-out visitors see a sign-in screen that names the flight from a shared link; signed-in users get the tracker, saved flights, packing list and, for the owner, the console. Old `/#/flight/...` links and installed apps opening `/` are forwarded by `site.js`.

```text
src/main.tsx                   app shell: router, dashboard, PWA update, Clerk provider
src/app/                       sign-in screen, Clerk glue (token bridge, account bar, saved-flight sync, shared-device clean-up),
                               saved-flight and offline helpers, install help, announcements, feedback
src/features/flight/           flight view, formatting (time rules ADR-012), summary, countdown, calendar file, destinations
src/features/checklist/        packing list UI, model, storage, sync, rules, template, board styles
src/console/                   owner console: shell, operations (Ops.tsx), inbox, provider health, audit, content editor
src/shared/                    API client (token in Authorization and X-Session-Token), tracking, motion, tab keys, smooth scroll
src/styles/                    tokens.css (design tokens), site.css (public site), console.css; src/style.css (app)
src/site/                      public site scripts (site.js, contact.js, travel-checklist.js)
src/siteNav.ts                 default links (app footer, CMS seed)    src/types.ts  flight contracts
```

## PHP (`php/private/src`)

`bootstrap.php` (API) and `site-bootstrap.php` (site) share `loadConfig.php` (private config.php, environment, and locally only the project's .env). API: `App.php` (routing, limits, auth gate, owner gate), `Cms.php` (console content, preview, media, health, audit routes), `ClerkAuth.php`, `Admin.php`, `Metrics.php`, `Health.php`, `Enquiries.php`, `Mailer.php`, `Checklists.php`, `ClerkApi.php`, `GoogleAnalytics.php`; flight data: `AeroDataBox.php`, `OpenSky.php`, `RouteLookup.php` (adsbdb), `Flight.php`, `Geo.php`; storage: `Store.php`. CMS: `Content/{Markdown,Validator,ContentStore,Media}.php`, `Content/seed.json`. Site: `Site/Site.php`.

## Node reference server

`server/` (Express) is the original prototype. It does not have sign-in, the console, enquiries, the CMS or the site; production does not run it and the release workflow does not test it. Archiving it is a pending owner decision (RESTRUCTURE-PLAN.md section 8).

## Known limits

Provider payload validation is light (guards, not schemas). File storage assumes one server (no shared cache across machines); fine for cPanel. Rendering is per request with no server-side HTML cache; pages are small and revalidated with ETags, so this has not been a measured problem. The live server's GD support (for branding uploads) is unconfirmed.
