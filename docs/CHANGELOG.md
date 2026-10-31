# Changelog

Newest first. Dates are UK dates.

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
