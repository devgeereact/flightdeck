# Audits and reviews

Newest first. Each entry says what was checked, how, and what was not.

## 31 October 2026: release review of the blue redesign (functional, visual, accessibility basics)
- **Gate:** `pnpm check` PASS (lint 0 errors, typecheck, 107/107 unit and page tests, PHP suite all passed, production build). `pnpm test:ui` all checks passed. `pnpm test:console` all checks passed.
- **Visual (headless Chrome shell 156, local build on 127.0.0.1):** home at 1440 and 390 compared side by side with the approved prototype; inner pages (guides, a guide, how it works, coverage, help, about, contact, packing list) after scrolling through; sticky header over the hero, white sheets, the dark panel and the canvas; phone menu opened while the header is stuck; app tracker, flight tabs, saved, packing, help and sign-in at 1440/900/390 (test fixtures clearly labelled); console screens at 1440/1024/390. No horizontal overflow and no page errors in the final runs.
- **Print:** packing list rendered to an A4 PDF: one page, branded header and footer, write-in lines filled from the home form, three level columns.
- **Sign-in:** development Clerk instance end to end (email code, return to the linked flight, sign out). Focus ring of the email field checked.
- **Contrast:** blue on white 4.79:1, blue-600 on canvas 6.0:1, muted on white 5.78:1, ink on amber 10.2:1; chart pair validated for colour-blind separation.
- **Not checked:** a real phone, Safari and Firefox, a screen reader, a paper print, Google sign-in (off on the development instance), the live owner console with a production account (checked after release).
