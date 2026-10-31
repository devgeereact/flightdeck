---
name: flightdeck-design
description: >-
  The Flightdeck design system (ADR-020) — sky-blue #1866ff on a cool canvas, Inter / Inter Tight, the
  runway-arc logo, 10/14/20/28 radii, equal-row layouts, honest "Not reported yet" data states, GSAP motion
  behind reduced-motion. Use this skill for ANY visual or UI work in the Flightdeck repo: new or changed pages,
  components, screens, CSS, copy on screens, the public PHP site (Site.php, site.css), the React app (main.tsx,
  workspace.css, features/*), the owner console (src/console, console.css), print styles, icons, the logo,
  charts, empty/error states, responsive fixes, design reviews, screenshots or design presentations — even when
  the request just says "add a button", "fix the layout", "make it look better" or "build a settings page"
  without mentioning design.
---

# Flightdeck design system

Flightdeck is a calm, honest flight tracker: sky blue on a cool white canvas, near-black ink, an amber accent used only as a fill, photography where it earns its place, plain UK English. Three surfaces share one token file: the **public site** (server-rendered PHP), the **signed-in app** (React PWA at `/app/`) and the **owner console** (React, `#/admin`). Decision record: `docs/DECISIONS.md` ADR-020. Living description: `docs/DESIGN.md`.

The owner approved this design from a prototype and asked for it to stay "high-end, human, no AI slop, no empty gaps, no uneven cards". Everything below serves that.

## Before you write anything

1. **Read the tokens**, don't invent values: `src/styles/tokens.css` is the single source (see `references/tokens.md` for the meaning of each). Component CSS uses `var(--fd-…)`; if a value you need is missing, add a token rather than a hard-coded hex.
2. **Find the surface's existing pieces** in `references/surfaces.md` and reuse them (console: `src/console/ui.tsx` components; app: `workspace.css` classes; site: `site.css` classes and `Site.php` helpers). New one-off styles are usually a sign you missed an existing component.
3. **Decide the layout on the 8-point grid** with the rules below before styling details.

## Core rules (and why)

- **Blue leads, ink reads, amber fills.** `--fd-blue` #1866ff is the one primary action colour. Blue text only on white (4.79:1); on the grey canvas use `--fd-link` #1458e0 (6.0:1). Amber #ffb618 is a fill behind dark text (10.2:1), never text on white. Violet is for small badges only and never a chart series (it failed the colour-blind check against blue). Chart series are blue then `--fd-series-2` #d97706. Semi-transparent white text on blue fails contrast — use solid `#fff`.
- **One primary action per screen.** Everything else is a white, outlined or quiet pill. Users should never wonder which button matters.
- **Equal rows, no gaps.** Cards in a row share width and height; no orphan last card, no empty band inside a panel, no half-width form leaving dead space. When a group doesn't divide evenly, fill the slot with a real action tile (see the guides index) or change the layout (two columns with a sticky aside, like the console editor and Site settings). This was the owner's most repeated correction.
- **Honest data, always.** Never fabricate flights, times, positions, statistics or testimonials on real screens. Missing data says "Not reported yet"; estimates are labelled; stale results show "last fetched at". Marketing visuals explain sources and states instead of faking a result. Presentation/demo data must be labelled as sample data.
- **Calm type.** Inter Tight for display (600, tracking −0.02 to −0.035em), Inter for reading (400 body, 500 labels). Console never goes above 600 weight; body 15px there. Tabular figures (`.num` / `.fd-data`) for anything numeric that lines up.
- **Radii by role:** 10 inputs, 14 fields, 20 panels/cards, 28 hero and big bands, pill for buttons and chips. Shadows by level (`--fd-shadow-1..4`, `--fd-shadow-blue` under the primary button only).
- **Icons:** one stroke family (lucide in React; the matching `Site::ICONS` set in PHP), 16/18/20/24px, never emoji.
- **Accessible by default.** Visible 2px blue focus ring, labelled controls, `aria-current` on navigation, keyboard tabs, dialogs that trap and return focus, 44px tap targets, scrollable regions focusable. Target WCAG 2.2 AA; run the audit (see verification).
- **Motion is optional.** GSAP only through `withMotion` / `motionAllowed` (app, console) or the deferred `motion-<hash>.js` bundle (site home). Nothing animates under `prefers-reduced-motion`, and every page is complete with JavaScript off — never leave content at opacity 0 waiting for an observer.
- **Plain UK English.** Specific, active, short. Buttons say what happens ("Save and publish", "Look up a flight"). Errors say what went wrong and how to fix it. No "seamless", "unlock", "Less X. More Y.", em-dash asides or invented labels.

## The logo

Our own mark: a runway line, a take-off arc and an amber destination dot on a blue tile (rx 18 of 64). It exists in three places that must stay identical — change all three together:

- `public/icon.svg` (also the source for the PWA PNGs and `og-image.png`)
- `src/shared/Logo.tsx` → `<LogoMark size />` and `<Brand href size className />` (React)
- `Site::LOGO` in `php/private/src/Site/Site.php` (PHP)

Lock-up: mark + "Flightdeck" in Inter Tight 700, tracking −0.03em, class `.fd-brand` (`.on-photo` / `.on-dark` for white text). A copy is in `assets/logo.svg`. Don't recolour, stretch, add effects or put it on busy photos without the hero overlay.

## Layout patterns to reach for

- **Photo hero + overlapping search card** — site home and app tracker. One hero per surface.
- **Pill filters over a row of three equal cards** — "Before you fly", saved flights.
- **Form + sticky aside (340px)** — any edit or settings screen: grouped header-row sections on the left; Publishing (state badge, primary save, discard disabled until dirty), Visibility switches, History on the right.
- **Header-row panels + hairline tables** — lists and operations: toolbar with search and filter chips, right-aligned tabular numbers, state badges.
- **Two-pane list/detail** — inbox.
- **Sticky frosted header** on the public site after 80px of scroll; sticky side panels sit at `top: 104px` below it.

Details and class names per surface: `references/surfaces.md`. States every flow needs (loading, empty, validation, failure, success, permission denied, offline, unavailable, 404) and copy rules: `references/patterns.md`.

## Responsive

Design for 375/834/1280/1920/2560. Tablet stacks and the app uses an icon rail; phones get the bottom tab bar (app) or the menu sheet (site); large and ultra-wide screens **centre a wider column** (site 1360 → 1600 above 2200px; app 1480 → 1680) rather than stretching or sitting flush left. No horizontal scroll at any width except inside a deliberately scrollable table or tab row.

## Verify before you call it done

Follow `references/verification.md`. In short: `pnpm check` (lint, types, tests, PHP, build), `pnpm test:ui` / `pnpm test:console` when you touched those surfaces, then **look** — headless screenshots at 1440 and 390 (plus 834/2560 for layout work) with no sideways overflow, and an axe-core pass for contrast and roles. Update `docs/DESIGN.md` and `docs/CHANGELOG.md` when the system itself changes, and rebuild the design presentation if screens changed visibly.
