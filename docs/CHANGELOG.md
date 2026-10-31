# Changelog

Newest first. Dates are UK dates.

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
