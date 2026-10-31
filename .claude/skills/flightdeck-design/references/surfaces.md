# Surfaces: where things live and what to reuse

Read only the section for the surface you are changing.

## Public site (server-rendered PHP)

- Markup: `php/private/src/Site/Site.php` (layout, header, footer, every page template, `Site::LOGO`, `Site::ICONS`, `ico()`, `brand()`, `cards()`, `cta()`). Content comes from the CMS (`ContentStore`), seeded from `content/site-content.mjs` + `content/pages.mjs` via `scripts/seed-content.mjs` — copy changes go there, then regenerate the seed (a test checks it is current).
- Styles: `src/styles/site.css` (one layer; local aliases like `--blue`, `--ink-2`, `--surface-2`, `--shell` map to tokens), `src/siteFooter.css` (shared with the app), `src/features/checklist/packingBoard.css` (printable list incl. the authoritative A4 print block at the end).
- Behaviour: `src/site/site.js` (menu sheet, sticky header `.stuck`, signed-in swap `data-auth="in|out"`, dialogs `data-dialog`, tabs, accordion, packing teaser), `src/site/contact.js`, `src/site/travel-checklist.js`. GSAP for the home page is bundled by `scripts/build-public.mjs` as `motion-<hash>.js`.
- Key classes: `.site-top` / `.topbar` (header; `.stuck` frosted state), `.hero` + `.search-wrap` / `.tabs-attached` / `.search-card` / `.search-grid` (overlapping search), `.sources`, `.board` + `.fresh` (result anatomy), `.features`, `.spots` + `.cards3` + `.dest` / `.guide` (rows of three), `.how`, `.pack`, `.qa` (questions), `.closing`, `.page-head`, `.sheet`, `.layout` + `.toc` (prose pages), `.cards` + `.cards-fill` (guides index, spare-slot action tile), `.field`, `.chip`, `.badge`, `.btn` variants.
- Rules: content must render without JavaScript; photos only from `public/img/` with credits on `/about/`; no third-party scripts beyond those the CSP allows; footer "© year Gakinz" → gakinz.com.

## Signed-in app (React PWA, `/app/`)

- Shell and routes: `src/main.tsx` (hash router, sidebar, top bar, tab bar, lookup/load, saved flights). Views: `src/app/TrackerHome.tsx`, `src/app/SavedFlightCollection.tsx`, `src/app/HelpView.tsx`, `src/app/SignInScreen.tsx` (Clerk, `clerkAppearance.ts` — style Clerk through `elements` classes, never `.cl-*` internals), `src/features/flight/FlightView.tsx`, `src/features/checklist/Checklist.tsx`.
- Styles: `src/styles/workspace.css` (composition layer; read this first), `src/style.css` (base, keeps console `.ad-*` rules).
- Key classes: `.app` / `.side-nav` / `.mobile-nav` (shell), `.view` (centred column), `.vh` (view header), `.banner` + `.lookup-grid` (+ `.qp-field`), `.fcard` (saved card with destination photo or non-photo treatment), `.next` / `.countdown` / `.facts` / `.tl` (next flight), `.packcard` + `.ring`, `.fhead` / `.route` / `.tbox` / `.journey` / `.kv` / `.wxmain` / `.destpanel` (flight result), `.trip` / `.rail` / `.plist` (packing room), `.si-photo` / `.si-card` / `.si-step` (sign-in), `.pop` (popovers), `.field`, `.daychips`.
- Logo: `<Brand />` / `<LogoMark />` from `src/shared/Logo.tsx`. Motion: `withMotion`, `fromAny`, `motionAllowed` from `src/shared/motion.ts` with `useGSAP`.
- Rules: real API data only (no fixtures in production code); every missing field labelled; offline copies say "last fetched"; saved flights cap 12.

## Owner console (React, `#/admin`)

- Shell: `src/console/ConsoleShell.tsx` (own full-page frame, grouped sidebar, crumb). Views: `content/ContentSection.tsx` (lists, FAQ with reorder), `content/Editor.tsx` (two-column editor and Site settings), `content/forms.tsx` (per-type forms), `Inbox.tsx`, `Ops.tsx` (overview, usage, costs, users, analytics, system), `HealthView.tsx`, `AuditView.tsx`.
- Reuse from `src/console/ui.tsx`: `PageHead`, `Panel`, `Badge`, `StateBadge` + `contentState`, `Notice`, `Loading`, `LoadError`, `Empty`, `Kpi`, `Spark`, `Meter`, `ChartPanel`, `RankTable`, `Switch`, `Dialog`, `toast` / `Toasts`, `useRise`.
- Styles: `src/styles/console.css` (`.cs-*` namespace; never rely on app globals like `main` or `.muted`).
- State badges: Published (ok), Changes not published (amber), Draft only (violet), Hidden (grey).
- Rules: calm type (15px body, 500 labels, ≤600 weight); tables in `.cs-tw` are focusable regions; charts are `role="group"` with a label, keyboard crosshair, legend for ≥2 series and a "Show as table" toggle; every write is audited; owner-only checks stay server-side.

## Print

- Packing list A4 design lives at the end of `packingBoard.css`: branded `.print-head` (logo, title, counts, site address, write-in lines) and `.print-foot`, three level CSS columns, sections may continue across columns with headings kept with their items, one A4 page. Check with `emulateMediaType('print')` + a PDF render.
