# Audits and reviews

Newest first. Each entry says what was checked, how, and what was not.

## 31 October 2026: cross-browser and accessibility audit
- **WebKit (Playwright, Safari's engine), live site:** desktop 1440 and iPhone 13 emulation (touch, mobile viewport). PASS on both: no sideways scroll on home and help, lookup rejects a bad flight number, header sticks, destination dialog opens, phone menu opens, help accordion opens, packing ticks survive a reload, live Clerk sign-in renders; no page errors.
- **Firefox: BLOCKED.** Playwright Firefox 144 would not launch headless on this macOS (plugin-container sandbox refused, also with the content sandbox disabled). Not tested.
- **axe-core 4.10 (WCAG 2.0/2.1 A and AA, 2.2 AA):** public pages (home, help, guides, a guide, packing list, contact, about, how it works, coverage, privacy, live sign-in): violations found and fixed (translucent white text on blue, a selected-chip count, the success green at 4.49:1); final run clean on all. App, Clerk-less build with labelled test fixtures: 26 screens and tabs at 1440 and 390 clean. Owner console harness: 15 views at 1440 and 390; fixed chip-count contrast, chart role (nested interactive) and phone table scrolling for keyboard users; final run clean on all 30.
- **Gate after fixes:** `pnpm check` 108/108, `pnpm test:ui` and `pnpm test:console` (new C12b: FAQ arrows reorder and publish) all PASS.
- **Not possible from here:** a real phone, a real screen reader (VoiceOver/NVDA), a paper print, and the console signed in with the owner's production account (needs the owner's sign-in). The live API refuses anonymous console requests (checked below).

## 31 October 2026: post-release check of the live site
- Live pages 200 (home, guides, help, packing list, about, /app/, icons, photos, /api/site); new footer text and "© Gakinz" served; home, guides and sign-in screenshotted on production; packing list prints as one A4 page from production.
- Found and fixed: production CSP refused Clerk's protection script (`cdn.protect.clerk.com/bootstrap.js`). Added `*.protect.clerk.com` to script-src and frame-src and `*.protect.clerk.com:*` to connect-src per Clerk's CSP guide; after redeploy the live sign-in loads with no refused requests.
- Signed-in header: checked four states locally (Clerk cookie signed in, cookie signed out with a stale marker, marker only, nothing): only a real session shows "My flights".

## 31 October 2026: release review of the blue redesign (functional, visual, accessibility basics)
- **Gate:** `pnpm check` PASS (lint 0 errors, typecheck, 107/107 unit and page tests, PHP suite all passed, production build). `pnpm test:ui` all checks passed. `pnpm test:console` all checks passed.
- **Visual (headless Chrome shell 156, local build on 127.0.0.1):** home at 1440 and 390 compared side by side with the approved prototype; inner pages (guides, a guide, how it works, coverage, help, about, contact, packing list) after scrolling through; sticky header over the hero, white sheets, the dark panel and the canvas; phone menu opened while the header is stuck; app tracker, flight tabs, saved, packing, help and sign-in at 1440/900/390 (test fixtures clearly labelled); console screens at 1440/1024/390. No horizontal overflow and no page errors in the final runs.
- **Print:** packing list rendered to an A4 PDF: one page, branded header and footer, write-in lines filled from the home form, three level columns.
- **Sign-in:** development Clerk instance end to end (email code, return to the linked flight, sign out). Focus ring of the email field checked.
- **Contrast:** blue on white 4.79:1, blue-600 on canvas 6.0:1, muted on white 5.78:1, ink on amber 10.2:1; chart pair validated for colour-blind separation.
- **Not checked:** a real phone, Safari and Firefox, a screen reader, a paper print, Google sign-in (off on the development instance), the live owner console with a production account (checked after release).
