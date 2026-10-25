# Flightdeck design system

Reviewed 25 October 2026. Direction approved by the owner: evolve the existing identity (not a new brand).

## Identity

Flightdeck, "Your journey, in view". Calm, honest travel tool: deep green on warm paper, a signal-lime accent, plain UK English. Flight data (times, codes, gates) uses tabular figures so columns line up like a departure board. Anything illustrative is labelled ("Sample, not a real flight"); missing data says "Not reported yet" rather than being hidden or guessed.

## Tokens (`src/styles/tokens.css`)

One file for the app, the console and the public site. Component CSS uses `var(--fd-…)`; change a value here, not in components.

| Group | Tokens |
|---|---|
| Surfaces | `--fd-bg` #f6f7f4 · `--fd-surface` #fff · `--fd-surface-raised` · `--fd-tint` #edf2e8 · `--fd-tint-soft` |
| Text | `--fd-ink` #2d4b3d · `--fd-heading` #173e34 · `--fd-muted` #5d6e64 · `--fd-muted-strong` · `--fd-on-brand` |
| Brand | `--fd-brand` #214e3e · `--fd-brand-hover` · `--fd-brand-deep` #133c35 · `--fd-brand-deep-ink` · `--fd-accent` #d6eb9e · `--fd-accent-leaf` |
| Lines | `--fd-line`, `--fd-line-soft`, `--fd-line-strong`, `--fd-line-hover` |
| Status | danger, warn, ok, info pairs (always with text, never colour alone) |
| Type | `--fd-font-body` DM Sans · `--fd-font-head` Manrope · `--fd-text-xs` 12.5px … `--fd-text-hero`; `.fd-data` = tabular figures |
| Space, shape | `--fd-space-1..8`, `--fd-page-w` 1160px, `--fd-gutter`, radii, two shadows, `--fd-tap` 44px |
| Motion | `--fd-ease`, `--fd-dur` (0 under reduced motion) |

Fonts are self-hosted (`public/fonts`, SIL OFL); no page requests anything from Google Fonts.

Measured contrast, 25 Oct 2026 (WCAG formula): every text/background pair used is at least 4.5:1. Lowest: muted on tint 4.76, TOC numbers 4.76; body ink on paper 8.94; band text on deep green 7.72. This is a measured check of colour pairs, not a full WCAG audit.

## Components

- **Buttons:** `.btn` + `.btn-primary` / `.btn-secondary` (site also `.btn-accent`, `.btn-lg`); 44px tall on touch screens. One focus ring everywhere: 2px brand outline, 2px offset.
- **Public site** (`src/styles/site.css`): header with a menu button under 860px, announcement band, page head (eyebrow, h1, lede), prose card with an "On this page" list when there are 3+ sections, guide cards, FAQ disclosure list, form card, CTA band, footer (`src/siteFooter.css`, four groups). Home: hero with the flight-lookup form, labelled sample flight card, three steps, features grid, "Honest about the data" band, FAQ excerpt, closing call to action.
- **App** (`src/style.css`): sidebar (icons only 701-1000px, a scrollable row on phones), search card, flight tabs, notices, panels; sign-in screen at `/app/`.
- **Console** (`src/styles/console.css`): grouped side navigation (becomes a scrollable row under 1000px), lists with state badges (Published, Changes not published, Draft only, Hidden), editor form with character counts, inline field errors, formatting help, action bar, history panel, full-screen sandboxed preview. Operations keep the `.ad-*` cards and charts.

## States every flow covers

Loading (role=status text), empty (what to do next), validation (field-level, from the server), failure (message and retry), success (status message), permission denied (owner area), offline/stale (app: "last fetched at"), unavailable (site 503 page, provider health "No calls yet"), 404 (branded page with useful links).

## Accessibility

Skip link, landmarks, one h1 per page, labelled controls, visible focus, keyboard tabs (arrow keys, Home, End), `aria-current` on navigation, reduced motion respected (CSS animation only under `prefers-reduced-motion: no-preference`; GSAP through `withMotion`). Target WCAG 2.2 AA; not certified. Not yet done: a full screen-reader pass on real devices. The public `/accessibility/` page states this.

## Visual QA evidence

25 Oct 2026, headless Chrome (Puppeteer shell) screenshots: home at 1440 and 375, guide at 1280, coverage, help and contact at 375, 404 at 375 and 1280, sign-in screen at 1280 and 375, console pages list, page editor, inbox and provider health at 1440. No sideways overflow seen. Not checked: a real phone, a real large monitor.
