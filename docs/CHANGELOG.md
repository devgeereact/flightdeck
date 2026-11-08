# Changelog

Newest first. Dates are UK dates.

## 8 November 2026 (after the live smoke test): fixes
- **Web links:** "Latest from the web" now retries once when Google's answer is not usable (it failed about half the time on its first try), skips Facebook, Instagram and similar, and shows one link per site.
- **Gates:** when an airport has published only a terminal, the tile says "Departure terminal" or "Arrival terminal" with "Gate not published yet", instead of calling a terminal a gate. For a flight that has already left or landed, the note no longer promises a gate for later.
- **Aircraft position:** a flight that has landed says so, instead of "not transmitting yet".
- **Owner console:** System and Costs and limits now show Bright Data (today's searches against the daily cap); the dead "AI features" row and the two always-zero Usage badges are gone; Provider health no longer says Bright Data is "off unless configured".

## 8 November 2026 (after the ads removal): owner items
- **Hidden server header:** the host's `X-Turbo-Charged-By: LiteSpeed` header is now removed at the edge by a Cloudflare response-header rule scoped to flightdeck.gakinz.com only. Checked live.
- **Cookies and privacy pages:** the cookies page now lists every browser-storage key the app uses (it missed seven), says what each does and how long it lasts, and has an "anonymous counting" section. The privacy policy now explains the short-lived rate-limit counter (a one-way code of the network address, removed after about two hours) and names Bright Data for the flight web links. A test fails if a storage key in the code is missing from the cookies page. Last reviewed date set to 8 Nov 2026.
- **Owner scripts (run by you, not by the site):** `scripts/set-bright-data.sh` (turn on the web links: asks for the zone and token, token typed hidden, backup kept), `scripts/install-backup-cron.sh` (the server's nightly backup entry had disappeared; no backup since 1 Nov), `scripts/pull-server-backup.sh` (copy the newest server backup to this Mac). Each is tested against a fake server.
- **Backup restore drill done:** the 1 Nov backup restored cleanly into a scratch folder.
- Corrections to earlier notes: Bright Data has no separate on/off switch (it is on once the key and zone are set), and `fd-once-*` is session storage.

## 8 November 2026 (last): the ads path is removed
- Flightdeck is personal and non-commercial, so the code that could have shown adverts is gone: the Google ad script and ad slots on guides and the packing list, the `/ads.txt` route and its server rule, the four-key server gate, the "Adverts" row in Site settings and in the console's "What is switched on" list, the unused `ads` block in `site.config.json`, and the ad CSS. Nothing visible to visitors changes: no adverts were ever shown. `/ads.txt` answers 404.
- A server config that still has the old `ads_*` keys is ignored (tested). Google Analytics, still behind the cookie choice, is unchanged. `docs/MONETISATION.md` is now a short non-commercial statement. Decision: ADR-024.
- `pnpm docs:check` now also fails if ad code or an ads mention returns.

## 8 November 2026 (later still): the written docs match the code (live)
- No behaviour change. The API reference now lists every route the server answers (`/me`, `/checklist`, `/event`, `/contact` and the owner overview, users, enquiry reply, system and analytics routes were missing) and says plainly which routes need sign-in. Several documents that still said "not released", "guest only", "Clerk not implemented", "Google Fonts" or "three demo destinations" were corrected, along with the product requirements, the integrations register, the data model's browser-storage list, the privacy notes, the runbook (new "when something breaks" section) and the decision records' statuses.
- New check: `pnpm docs:check` (part of `pnpm check`, so CI runs it) fails if a route is missing from the API reference, a retired phrase returns to a live document, or a document names a file that no longer exists.
- Still open: the public cookies and privacy page copy does not list every storage key (recorded in docs/PRIVACY.md); the off-server backup copy and restore drill need server access.

## 8 November 2026 (later): the deploy waits for the full gate (live)
- A push to `main` now runs the whole CI gate first (lint, tests, PHP tests, build, UI and console smoke tests, PHP syntax, secret scan) and deploys only if it passes. Before, the deploy ran a smaller set of checks and did not wait for CI. Pull requests run the gate and can never deploy. A manual run deploys only from `main`.
- After a deploy, the live check also confirms that sign-in is configured (`signInRequired` is true and an anonymous look-up is refused with 401, not 503), and that the home page, the app and the sitemap have their expected content. A failing check restores the previous release as before.
- CI and the deploy now use PHP 8.4, the version the server runs. Every action in the workflows is pinned to a commit. The type check no longer runs twice. The console test uses port 3995. Decision: ADR-023.

## 8 November 2026: go-live security fixes are live
- The 1 November security fixes (below) were pushed to `main` and deployed. No new code in this entry. After the deploy, signed-in routes answer 401 to anonymous visitors, the new isolation headers are sent, and `X-Powered-By` is gone.
- Known gap: the host still sends `X-Turbo-Charged-By: LiteSpeed`; it is added after `.htaccess` runs and needs a Cloudflare or LiteSpeed setting to hide.
- Housekeeping: the old `production` branch was deleted; unused local test browsers were removed.

## 1 November 2026 (later): go-live security fixes
- Sign-in fails closed. If the server's Clerk issuer is missing or mistyped, look-ups are refused instead of opened to everyone. A trailing slash or an empty value in config no longer switches sign-in off.
- Fair use: each signed-in user can cause up to 6 paid schedule look-ups an hour and 20 web searches a day. The owner is exempt. Watching a flight never hits the limit, and over the limit the flight still shows live data with a note.
- Spending caps hold under load (the Bright Data daily cap could be overrun by simultaneous searches). Slow providers answer "busy" after 10 seconds instead of holding the server.
- Packing-list saves stay correct during an account erase. Web-search links are cached per flight and airports. Travel-guide links must point at Wikivoyage or Wikipedia.
- Web server: new isolation headers. The server stack is no longer advertised. Stray `.env`, `.git`, backup, log and source-map files are never served.
- Dependencies: Clerk 6.18.4, Biome 2.6.4, and a build-time `serialize-javascript` fix. All `.env.*` files are ignored by git.

## 1 November 2026 (later): go-live security review
- Security review of checklist storage, sign-in checks, provider calls, `.htaccess` and the CSP: no Critical or High findings, no code changes. Two Medium and five Low items are recorded for the owner in docs/AUDIT.md and docs/SECURITY.md. The landing-page SEO check found only minor items.

## 1 November 2026: gates and key times, weather and Discover beside the flight, cleanup
- Flight page: a **Gates and key times** panel under the summary shows departure gate, boarding starts, gate closes, take-off, landing, reaches the gate, arrival gate and baggage belt. Times the airline reports show as reported; boarding and gate-closing times, which airlines rarely publish, are worked out from the departure time and badged **Typical** (they move with a delay). Unknown gates say when they usually appear.
- **Weather in [city]** (now, feels like, wind, humidity, the forecast for when you land, four days from your arrival) and **Discover [city]** (a travel guide for any destination from Wikivoyage or Wikipedia, with photo, summary, guide links and credit) now sit beside the flight on wide screens and straight after the key times on tablets and phones. The Weather and Destination tabs are gone; Journey, Airport and Updates remain.
- Optional **Latest from the web** card (Bright Data search links while the gate is unknown, never copied into gate fields): built and tested, off until the owner adds a key (it costs money per search).
- Search boxes (website and app) keep one height when the flight-number error shows; the error sits under its own box. Typing only digits (e.g. "75") now asks for the airline code ("such as BA75").
- API: `/api/weather` adds hourly and 7-day forecasts; new `/api/place` and `/api/web-check`; provider health lists Wikimedia and Bright Data; CSP allows Wikimedia images.
- Cleanup: removed the three merged agent worktrees and four merged local branches; about 640 lines of dead CSS (old admin styles, `.icon-button`, `.ad-kpis`), an unused helper and needless exports; the FTPS hosting probe and its workflow; the empty VS Code workspace file; outdated docs (October plans, HOOKS, MIGRATION-PHP, `docs/history`, VERIFICATION merged into AUDIT, AI-AUTOMATION into ROADMAP). README, AGENTS, DEPLOYMENT, RUNBOOK, TESTING, PROJECT-MEMORY, ARCHITECTURE, PRD, API and ROADMAP rewritten to match what runs today. Task history moved to `.agent/HANDOFF.md`.

## 31 October 2026 (later): design system as an agent skill
- New project skill `.claude/skills/flightdeck-design/` (SKILL.md plus tokens, surfaces, patterns and verification references, and the logo) so every agent builds UI the same way. `AGENTS.md` points to it.

## 31 October 2026 (later): responsive touch-ups and the design presentation
- App: the content column is centred on large and ultra-wide screens (1480px, 1680px above 2200px) instead of sitting flush left, and the footer follows it; on tablets the lookup card's Quick pick spans the full row (no empty cell, chips on one line).
- Website: the page column widens to 1600px above 2200px.
- Design presentation artifact "Flightdeck Design System and Screens": complete design system (colour with contrast, type, icons, tokens, 8-point spacing, components, patterns) beside 60+ real product screens in browser and tablet frames at 834/1280/1920/2560, exported as six 8K boards (7680×4320). Screens use labelled sample data.

## 31 October 2026 (later): "Too many requests" fixed
- The API rate limit is now split per visitor: flight and weather look-ups keep the strict configured limit (`rate_per_minute`, default 30), other app requests (site content, account, packing-list sync, events) get at least 120 a minute, owner-console requests at least 240. One shared 30/minute bucket used to trip during normal use of the packing list or the console.
- The packing list syncs after a 2.5-second pause in ticking instead of 0.9 seconds.

## 31 October 2026 (later): maintenance switch and Analytics ID in Site settings
- Site settings has a **Maintenance page** switch (Visibility card) and message: public pages answer 503 with a branded "back soon" page (noindex, Retry-After); the app, the owner console and the API keep working so the owner can switch it off.
- Site settings has an **Analytics** section: a GA4 Measurement ID set here replaces the build-time ID on the public pages (validated as `G-XXXXXXXXXX`; analytics still loads only after cookie consent).

## 31 October 2026 (later): FAQ ordering, accessibility audit fixes, cleanup
- Owner console: Help and FAQ questions can be moved up and down with arrows; one request saves the new order as drafts (`POST /api/admin/content/faq-order`), "Publish changes" puts it live.
- Accessibility (axe-core WCAG 2.2 AA audit): text on blue panels is solid white (translucent white failed 4.5:1); selected-chip counts readable on blue (site and console); success green darkened to #137a38 (4.87:1); console charts are labelled groups so their keyboard crosshair is announced; wide console tables are focusable regions that keyboard users can scroll.
- Destination favourite hearts say they save on this device only.
- Removed the unused DM Sans and Manrope font files (replaced by Inter; still in git history).

## 31 October 2026 (later): signed-in header and sign-in protection
- Public pages know when you are already signed in: the header shows "My flights" instead of "Sign in" / "Open the app", the closing band says "Open my flights" and the lookup note no longer asks for an account. Read in the browser from Clerk's `__client_uat` cookie, falling back to a marker the app writes (`fd-signed-in`); pages stay cached and show the signed-out version without JavaScript.
- Content-Security-Policy now allows Clerk's abuse and fraud protection hosts (`*.protect.clerk.com`), which production sign-in was refusing.

## 31 October 2026: blue redesign and our own logo
- New identity (ADR-020): sky blue, ink and amber on a cool canvas, Inter / Inter Tight self-hosted, our own mark (runway line, take-off arc, amber destination dot) in the favicon, PWA icons, social image and every header.
- Public website rebuilt to the approved prototype: photo hero with an overlapping tabbed search, result anatomy and freshness panels, "Before you fly" destinations and guides, how it works, packing teaser, questions, closing band. Every inner page restyled to match.
- Sticky header that turns into a frosted white bar once you scroll, readable on any background.
- Printable packing list redesigned for A4: branded header and footer, write-in lines, three level columns, one page.
- Guides index: equal three-column cards with an action tile filling any spare slot.
- Footer: longer description, "© Gakinz" linking to gakinz.com, photo credits moved to the About page.
- Signed-in app rebuilt: white sidebar and top bar, tracker banner with lookup card, saved-flight cards with destination photos, next-flight countdown, packing card, redesigned flight result, saved flights, packing room, new in-app Help page (reads the published FAQ), restyled Clerk sign-in, phone tab bar.
- Owner console rebuilt: its own full-page frame, grouped sidebar, KPI tiles and charts (colour-blind-safe series), list toolbars, two-column editor and Site settings with Publishing / Visibility / History aside, two-pane inbox.
- Fixed on the way: JSON-LD escaping that let CMS text close the script tag; contact form disabling the wrong button; home lookup offering the UTC date near midnight; dev router serving JPEGs without a type; console requests that could overwrite newer ones; app "Try again" doing nothing after a failed first search; Refresh and Share doing nothing on an offline copy; Save allowing 6 flights while sync allowed 12; Clerk treating app links as its own routes; clipped focus ring on the sign-in field; `pnpm check` failing on unformatted release files.
- `/api/site` now also returns the published FAQ (id, question, answer only).
