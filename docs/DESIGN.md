# Flightdeck design system

Reviewed 31 October 2026. Direction approved by the owner from a working prototype ("I approve this design… build it to live… create our own logo"). Decision record: ADR-020.

## Identity

Flightdeck, "Your journey, in view". A calm, honest travel tool: sky blue on a cool white canvas, near-black ink, an amber accent used only as a fill, photography where it earns its place, plain UK English. Flight data (times, codes, gates) uses tabular figures. No fabricated flight records anywhere in marketing: the home page "result anatomy" shows sources and states (for example "Not reported yet"), never a flight, a time or a position, and a test enforces it.

## Logo

Our own mark: a runway line, a take-off arc and an amber destination dot on a blue tile with 18/64 rounded corners. One drawing in three places that must stay identical: `public/icon.svg`, `src/shared/Logo.tsx` (`<LogoMark/>`, `<Brand/>`), and `Site::LOGO` in `php/private/src/Site/Site.php`. Wordmark: "Flightdeck" in Inter Tight 700, tracking -0.03em, beside the mark (`.fd-brand`; `.on-photo` / `.on-dark` for white text). PWA and touch icons (`icon-192/512.png`, `icon-maskable-512.png` with the mark inside the 80% safe zone, `apple-touch-icon.png` full bleed) and `og-image.png` (1200×630, hero photo, logo, headline) are rendered from the same SVG.

## Tokens (`src/styles/tokens.css`)

One file for the app, the console and the public site. Component CSS uses `var(--fd-…)`; change a value here, not in components. Earlier token names (`--fd-brand`, `--fd-accent`, `--fd-board`…) are kept and remapped so older component rules follow the new palette.

| Group | Tokens |
|---|---|
| Palette | `--fd-blue` #1866ff, `-600` #1458e0, `-700` #0f4fd1, `-50`, `-100` · `--fd-amber` #ffb618 (fill only), `-50`, `--fd-amber-ink` #8a5300 · `--fd-violet` #8818ff (small badges only) · `--fd-series-2` #d97706 (second chart series) |
| Surfaces | `--fd-bg` canvas #eef1f6 · `--fd-surface` #fff · `--fd-surface-raised` #f6f8fb |
| Text | `--fd-heading` #14171f · `--fd-ink` #2f3644 · `--fd-muted` #5e6675 · `--fd-faint` (decoration only) · `--fd-link` #1458e0 (links on the canvas) |
| Lines | `--fd-line` #e3e7ee, `--fd-line-strong` #d3d9e3 |
| Status | ok, warn, danger pairs, always with text |
| Type | Inter (body) and Inter Tight (display), self-hosted in `public/fonts` (OFL, no Google requests). Hero clamp(42px, 6.4vw, 84px); headings tracked -0.02 to -0.035em; `.fd-data` tabular figures |
| Shape | radii 10 / 14 / 20 / 28px, pills for buttons and chips · shadows 1–4 plus `--fd-shadow-blue` under the primary button |
| Space | 4 to 120px scale, page width 1360px, gutter clamp(12px, 2.4vw, 28px), tap targets 44px |
| Motion | `--fd-ease` cubic-bezier(.22, 1, .36, 1), `--fd-dur` .22s (0 under reduced motion) |

Measured contrast (WCAG formula, 31 Oct 2026): blue on white 4.79:1 (so blue text sits only on white), blue-600 on the canvas 6.0:1, muted on white 5.78:1 and on the canvas 5.11:1, ink on amber 10.2:1, violet badge text on violet-50 above 4.5:1. Chart palette blue + #d97706 passed the colour-blind validator (protan ΔE 33); blue + violet failed (deutan ΔE 1.4), so violet is never a chart colour.

## Layout language

- Soft canvas, white panels (20px radius), the 28px radius only on the framed hero and big bands.
- One framed photo hero per surface with the search card overlapping its bottom edge (site home, app tracker). Sign-in uses a framed photo panel beside the form.
- Rows are always equal: equal columns and heights, no orphan last card, no empty band inside a panel. Pill filters sit above rows of exactly three cards.
- One blue primary action per screen. Secondary actions are white or outlined pills.
- Photos: six openly licensed images in `public/img/` (credits published on the site footer "Photo credits"). Destination photos exist for JFK, DXB and CDG; other destinations use a non-photo treatment.
- Icons: one stroke family (lucide), 16 / 18 / 20 / 24px, never emoji.

## Surfaces

- **Public site** (`Site.php`, `src/styles/site.css`, `src/site/*.js`): home in this order: photo hero with nav over the photo, tabbed search card (Track a flight / Start a packing list), "Data from" row, result anatomy beside the blue "How fresh it is" panel, six CMS features as a ruled 3×2 grid, "Before you fly" (Destinations and three guide groups, three cards each, destination details in a native dialog), How it works (photo and steps), packing list teaser, Questions, blue closing band with drawn routes, footer. Every other page uses a compact page head and white sheets in the same family. The header is sticky: over the photo band it is transparent with white text; after 80px of scroll it becomes a fixed frosted white bar with dark text and a blue primary button (`.site-top.stuck`, toggled in `site.js`; the frosted surface is a pseudo-element so the fixed phone menu is not trapped). Sticky side panels and anchor targets sit 104px down, below it. Signed-in visitors (Clerk's `__client_uat` cookie, else the app's `fd-signed-in` marker) see a "My flights" chip instead of "Sign in" / "Open the app" (`data-auth="in"|"out"`, swapped by `site.js`). The guides index is three equal columns; a spare end slot becomes a "Look up a flight" tile rather than stretching cards. Footer: description, four link groups, safety note, "© year Gakinz" linking to gakinz.com; photo credits live on /about/ only. The printable packing list has its own A4 print design (`packingBoard.css`, last block): branded header (logo, title, counts, site address over a blue rule), write-in lines for trip, leaving date and packer, three level columns with numbered section headings and aligned boxes, branded footer; it fits one A4 page. Motion (home only, a deferred hashed `motion-<hash>.js` bundle of GSAP): headline line reveal, search card rise, the hero plane along its dotted arc, slight photo parallax, the steps progress line, closing arcs drawing once. Everything is readable with JavaScript off and under reduced motion.
- **App** (`src/main.tsx`, `src/styles/workspace.css`, features): white sidebar (Travel, Support, owner link, sign-out), white top bar with lookup, announcements and account; tracker banner with the overlapping lookup card, saved flights as equal cards, next-flight and packing panels; flight result with route arc (illustrative, labelled), time boxes, fetched line, position panel and pill tabs; saved flights; packing room with section rail; phone bottom tab bar.
- **Owner console** (`src/console/**`, `src/styles/console.css`): its own full-page frame at `#/admin` with a grouped sidebar and the violet "Owner console" badge; header-row panels, hairline tables, filter chips; the editor and Site settings share one two-column layout (form | sticky Publishing / Visibility / History aside). Calm type: 15px body, labels 500, nothing above 600.

## States every flow covers

Loading (role=status text), empty (what to do next), validation (field-level, from the server), failure (message and retry), success (status message), permission denied (owner area), offline/stale (app: "last fetched at"), unavailable (site 503 page, provider health "No calls yet"), 404 (branded page with useful links).

## Accessibility

Skip link, landmarks, one h1 per page, labelled controls, visible 2px blue focus ring, keyboard tabs (arrow keys, Home, End), `aria-current` on navigation, dialogs that trap and return focus, reduced motion respected everywhere (CSS and GSAP through `withMotion` / `matchMedia`). Target WCAG 2.2 AA; not certified.

## History

Earlier directions, all superseded: green "evolve the identity" polish (25 Oct), a composed green workspace (25 Oct), the airport-signage language with hairlines and 4–10px corners (26 Oct, ADR-019). Their useful habits carry over: tabular data, honest missing-data labels, balanced rows, calm console type.

## Plain network errors, 26 October 2026

When the server cannot be reached, the service worker rejects `/api/` requests with Workbox's own text ("FetchEvent.respondWith received an error: no-response ..."). `readableError` in `src/shared/api.ts` turns that and other network failures into "Flightdeck could not be reached. Check your connection, then try again." A saved copy of the flight still takes priority and shows the offline notice. Covered by UI check B16b.
