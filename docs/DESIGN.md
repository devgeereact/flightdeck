# Flightdeck design system

Reviewed 26 October 2026. Direction approved by the owner: evolve the existing identity (not a new brand).

## Identity

Flightdeck, "Your journey, in view". Calm, honest travel tool: deep green on warm paper, a signal-lime accent, plain UK English. Flight data (times, codes, gates) uses tabular figures so columns line up like a departure board. The landing page introduces the product without fabricated flight records; missing data says "Not reported yet" rather than being hidden or guessed.

## Tokens (`src/styles/tokens.css`)

One file for the app, the console and the public site. Component CSS uses `var(--fd-…)`; change a value here, not in components.

| Group | Tokens |
|---|---|
| Surfaces | `--fd-bg` #f5f4ee · `--fd-surface` #fff · `--fd-surface-raised` · `--fd-tint` #edf1e6 · `--fd-tint-soft` |
| Text | `--fd-ink` #2d4b3d · `--fd-heading` #173e34 · `--fd-muted` #5d6e64 · `--fd-muted-strong` · `--fd-on-brand` |
| Brand | `--fd-brand` #214e3e · `--fd-brand-hover` · `--fd-brand-deep` #102f29 · `--fd-brand-deep-ink` · `--fd-accent` #d9eea4 · `--fd-accent-leaf` |
| Lines | `--fd-line`, `--fd-line-soft`, `--fd-line-strong`, `--fd-line-hover` |
| Status | danger, warn, ok, info pairs (always with text, never colour alone) |
| Type | `--fd-font-body` DM Sans · `--fd-font-head` Manrope · `--fd-text-xs` 12.5px … `--fd-text-hero`; `.fd-data` = tabular figures |
| Space, shape | `--fd-space-1..8`, `--fd-page-w` 1280px, `--fd-gutter`, radii (4 / 6 / 10px, pill for nothing but round badges), `--fd-tap` 44px |
| Elevation | `--fd-shadow-1` (a hairline) and `--fd-shadow-2` (floating layers only: dialogs, menus). Cards are separated by hairlines, not shadows |
| Board | `--fd-board`, `--fd-board-line`, `--fd-board-ink`, `--fd-board-dim`: the one dark panel on the home page |
| Labels | `.fd-label`: 12.5px bold uppercase, wide tracking, for small headings and field labels |
| Motion | `--fd-ease`, `--fd-dur` (0 under reduced motion) |

Fonts are self-hosted (`public/fonts`, SIL OFL); no page requests anything from Google Fonts.

Measured contrast, 25 Oct 2026 (WCAG formula): every text/background pair used is at least 4.5:1. Lowest: muted on tint 4.76, TOC numbers 4.76; body ink on paper 8.94; band text on deep green 7.72. This is a measured check of colour pairs, not a full WCAG audit.

## Components

- **Buttons:** `.btn` + `.btn-primary` / `.btn-secondary` (site also `.btn-accent`, `.btn-lg`); 44px tall on touch screens. One focus ring everywhere: 2px brand outline, 2px offset.
- **Public site** (`src/styles/site.css`, one layer; the earlier stacked overrides were folded in on 26 Oct 2026): header with a menu button under 860px and a lime underline on the current page, announcement band, page head (eyebrow with a short rule, h1, lede), prose card with a ruled "On this page" list when there are 3+ sections, flat guide tiles with a brand-green top edge, FAQ as a ruled list with a plus that turns to a cross, form card, deep-green CTA box, footer (`src/siteFooter.css`, four groups). Home, in order: hero (headline, lookup strip, three ruled points) beside the board; a "Data from" row naming the four sources; "How it works" as a ruled timetable; "What you get" as a two-column spec sheet; "Honest about the data" as the one deep-green band; "Questions"; a lime closing band. The home sections use a sticky left heading and a ruled list on the right (`.split`).
- **App** (`src/style.css`): deep-green desktop sidebar (icons only 701-1000px, a scrollable row on phones), search card, flight tabs, notices, panels and a first-use welcome; split introduction and sign-in screen at `/app/`.
- **Console** (`src/styles/console.css`): grouped side navigation (becomes a scrollable row under 1000px), lists with state badges (Published, Changes not published, Draft only, Hidden), editor form with character counts, inline field errors, formatting help, action bar, history panel, full-screen sandboxed preview. Operations keep the `.ad-*` cards and charts.

## States every flow covers

Loading (role=status text), empty (what to do next), validation (field-level, from the server), failure (message and retry), success (status message), permission denied (owner area), offline/stale (app: "last fetched at"), unavailable (site 503 page, provider health "No calls yet"), 404 (branded page with useful links).

## Accessibility

Skip link, landmarks, one h1 per page, labelled controls, visible focus, keyboard tabs (arrow keys, Home, End), `aria-current` on navigation, reduced motion respected (CSS animation only under `prefers-reduced-motion: no-preference`; GSAP through `withMotion`). Target WCAG 2.2 AA; not certified. Not yet done: a full screen-reader pass on real devices. The public `/accessibility/` page states this.

## Visual QA evidence

25 Oct 2026, headless Chrome (Puppeteer shell) screenshots: home at 1440 and 375, guide at 1280, coverage, help and contact at 375, 404 at 375 and 1280, sign-in screen at 1280 and 375, console pages list, page editor, inbox and provider health at 1440. No sideways overflow seen. Not checked: a real phone, a real large monitor.

## Design polish, 25 October 2026 (local, not released)

Implemented a coordinated landing, tracker and sign-in refresh using the existing green identity and shared tokens. Removed the fictional landing flight and its animation; the public lookup still passes the requested flight to the authenticated app. Existing live-provider requests, missing-data rules, account flow and storage remain in place. No new dependencies or services. The demo reference could not be located; the owner authorised a clean design instead.

Validation for this pass is recorded in CURRENT-TASK.md. Browser visual QA remains NOT TESTED: the session exposed no connected browser. Earlier screenshots above describe the preceding design.

## Full redesign (local, October 2026)

The owner requested a full redesign while keeping all functionality. The preceding polish pass is superseded by a composed workspace in `src/styles/workspace.css`, loaded after the legacy app stylesheet. Shared tokens now use warm ivory, deeper forest green and lime. Desktop navigation is 248px (220px below 1200px), an 84px icon rail at tablet sizes, and existing mobile navigation below 700px. The app keeps its existing routes and handlers.

Implemented: a new editorial landing and information strip; redesigned guide, legal, help and contact layouts; dark shared footer; split sign-in; revised flight summary, neutral route schematic, detail tabs, airport information, weather and destination panels; saved-flight cards in `src/app/SavedFlightCollection.tsx`; packing-room header, trip controls, checklist rail and item layout; console navigation, content lists, forms, history, preview, inbox and operations styling. The route drawing never plots an invented aircraft location; real coordinates and telemetry remain separate.

Functionality retained: lookup and date selection, live API path and missing-data labels, refresh/auto refresh, attribution, offline data, save/remove, sharing, calendar export, account/sync behaviour, packing creation/linking/suggestions/edit/hide/reset/print, feedback, install help, CMS draft/preview/publish/history, inbox and owner permissions. No providers, dependencies or production settings changed.

Validation: build; 100 unit/page tests; PHP suite; 50 app UI checks (including new saved-card open/remove/linked-packing checks); 16 console checks. Safari desktop visual review: landing, sign-in, tracker empty state, and created packing workspace using an isolated test build. Responsive CSS implemented; phone, installed-PWA, full screen-reader and production-provider journeys not exercised in this pass. Earlier contrast measurements describe the earlier palette and are not a new certification.

## Alignment and expanded packing list, 26 October 2026 (local)

Balanced desktop collections use six grid tracks: three equal cards per row, with a final pair sharing a row and a final four using two rows of two. This removes the oversized first feature and the resulting orphan card. Guide cards, steps, coverage, packing instructions, app saved flights, destinations and operation totals follow the same pattern. Phones intentionally stack cards for readability; a collection containing just one real record uses the full width. No dummy records are inserted.

Footer defaults now contain three links in each of the four groups. Help and FAQ is in Guides and tools. CMS seed regenerated from source; no existing published CMS snapshots overwritten.

The shared packing template now has 141 items in the same eight sections, with five practical additions per section. Original IDs and public checkbox keys retain their meaning, so saved ticks, hidden items and custom names survive. Public visitors can tick locally, show all sections, print the checked list or print a blank copy without an account. Blank printing does not alter the stored ticks. The paper layout includes trip/date fields, all sections, aligned checkbox columns and section pagination. The app inherits the expanded template and matching checkbox alignment; edit, hide, restore, suggestions, sync and print remain in place.

PASS: 103 unit/page tests, PHP suite, 50 app UI checks, production build and diff whitespace check. Added public guest tick/print coverage and template compatibility checks; updated expected totals and suggestion scenarios for items now in the default template. Safari confirmed anonymous access and A4 print preview (no printer job submitted). Further native card review timed out; no new mobile visual claim.

## Second redesign: airport signage, 26 October 2026 (local, not released)

The owner asked for a full redesign with no trace of generic AI styling. The earlier pass was audited honestly (repeated rounded cards, "01 /" numbering, a centred closing call to action, a vague "A calmer journey" panel, a decorative strip of arrows) and replaced with one idea: airport signage and printed timetables. The brand colours, fonts and every feature are unchanged.

**What the language is.** Hairline rules instead of boxed cards; corners of 4 to 10px; shadows only for things that float; tabular figures for anything that is data; big plain headlines; one dark panel per page at most. The lookup on the home page is a single ruled strip (flight number | date | button) with a hard lime offset edge, not a floating card.

**The board.** The dark panel beside the hero lists what a result is made of (status, scheduled, estimated and actual times, terminal and gate, baggage belt, aircraft position, destination weather) with the source of each, and shows what a missing detail looks like ("Not reported yet"). It contains no flight record, no time and no aircraft position, and makes no provider call. A test enforces that. The route line above it is drawn once on load and carries no aircraft.

**Banned, and checked in review.** Purple-to-blue gradients, glass effects, identical rounded cards in endless grids, emoji icons, stock hero art, "01 /" counters, centred feature rows used by default, decorative blobs, invented statistics or testimonials, and vague copy ("seamless", "unlock", "Less X. More Y."). Copy was edited with the humanizer rules: plain UK English, specific claims, no taglines in the form "Your journeys, together."

**Motion.** Once, on load, and only when the visitor has not asked for less: the route line draws, the board rows appear in turn, home sections fade up as they scroll into view (`data-reveal`, with a four-second failsafe and a print override). Smooth scrolling (Lenis) runs on the public pages through `/lenis-<hash>.js` (built by `scripts/build-public.mjs`, started by `src/site/site.js`) and, as before, inside the signed-in app (`src/shared/smoothScroll.ts`). It is never started under `prefers-reduced-motion`, and it stops while the mobile menu is open. The console has none. GSAP stays in the app behind `withMotion`.

**Tools used and not used.** `npx getdesign@latest add nerdwallet` was read as a structural reference only: hairline separation, near-square corners, comparison-style ruled lists, a trust row naming the data sources. Nothing of NerdWallet's brand, wording or palette is used. The 21st catalogue was searched for patterns (a borderless accordion with a plus/cross toggle; a ticket-style confirmation card); no 21st code was retrieved or installed, because the components are shadcn/Tailwind and this site is server-rendered PHP with token CSS. Hyperframes was not used: the only motion the hero needed is a path drawing once, which is a few bytes of CSS; a rendered video would add weight and a second thing to keep in step with the tokens.

**Radii sweep.** 66 hard-coded radii of 9px and above in the app, console, packing board and footer were mapped to the tokens (icon tiles and controls to 6px, surfaces and dialogs to 10px, text chips to 4px). Round count badges stay round.

**Sign-in copy.** "Less wondering. More looking forward." became "Your flights and packing list, on every device." with three ruled facts that the product already states elsewhere (12 saved flights, a list per trip, open guides).

**Contrast, measured 26 Oct 2026 (WCAG formula, new pairs only).** Board text on board 13.5:1; board secondary text 7.4:1; lime on board 12.4:1; brand-deep on the lime band 11.4:1; secondary text on paper 5.8:1 and on tint 5.6:1; green label text on its pale background 5.3:1. A first draft used the lighter leaf green for the step numerals and the contents numbers (2.6:1); it was caught by this check and changed to the dark green. The leaf green remains only on decoration (rules, bullets, the logo dot, underlines). The earlier palette measurements still apply to unchanged pairs.

**Fixes found on the way.** On phones the app search card wrapped its button into a second column and made the page 276px too wide (flex column with wrap); fixed in `workspace.css`. The provider-health page was 13px too wide on phones; the console main column can now shrink and wide tables scroll inside their panel. KPI tiles use `minmax(min(210px,100%),1fr)`.

**Visual QA evidence.** Headless Chrome shell 156, 26 Oct 2026, at 1440, 768 and 375px, no sideways overflow in any capture: public home, how it works, guides, help, contact, packing list, 404; the app (tracker, flight result, saved flights, packing room) built without Clerk and fed a clearly labelled fixture flight through request interception; the sign-in screen rendered with a stub for Clerk's two button wrappers; the owner console (pages, inbox, provider health, overview) through the test harness. **Not checked:** a real phone, an installed PWA, a screen reader, Safari and Firefox rendering of this pass, the live Clerk sign-in widget itself, the cookie banner with analytics switched on (it only appears when a GA ID is configured), and print output of the new CSS beyond the unchanged packing list rules.

## Console type and icon pass, 26 October 2026 (local)

The owner found the CMS text too big and too bold, and its icons uneven. In `src/styles/console.css` (final block): body text is 15px at regular weight; labels, navigation and buttons are medium (500); nothing is heavier than 600; page titles are 26px (editor titles 22px) and KPI numbers 28px, down from 750 weight at 28 to 36px. The page Text field now uses the body font instead of monospace. Every small icon is 16px (14px inline in badges, notes and errors, 18px in the side navigation) at one stroke width, and every control that holds an icon is a centred flex row, so icons and labels share a baseline. The navigation item "Enquiries and feedback" is now "Enquiries" (the page title is unchanged) so it no longer wraps beside its count.

## Plain network errors, 26 October 2026

When the server cannot be reached, the service worker rejects `/api/` requests with Workbox's own text ("FetchEvent.respondWith received an error: no-response ..."). `readableError` in `src/shared/api.ts` turns that and other network failures into "Flightdeck could not be reached. Check your connection, then try again." A saved copy of the flight still takes priority and shows the offline notice. Covered by UI check B16b.
