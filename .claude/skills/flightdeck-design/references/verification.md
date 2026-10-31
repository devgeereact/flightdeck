# Verification

House rule: test locally before any push (pushing `main` deploys to production). Report results with the status words DONE / PARTIAL / NOT TESTED / BLOCKED.

## Gates

```bash
pnpm format            # then revert .vscode/settings.json if it changed: git checkout -- .vscode/settings.json
pnpm check             # lint, typecheck, unit + page tests, PHP tests, build (the CI gate)
pnpm test:ui           # app UI smoke (port 3997) — when the app changed
pnpm test:console      # console smoke (port 3993) — when the console changed
```

Update assertions only where markup or copy legitimately changed; never weaken a safety assertion (no fabricated flight data, owner-only routes, no third-party scripts).

## Look at it

- Local servers: `pnpm dev` (site + API on 127.0.0.1:3001, app with live reload on 127.0.0.1:5173/app/). For a production-like build: `pnpm build` then `FLIGHTDECK_DIST=dist FLIGHTDECK_PRIVATE=php/private php -S 127.0.0.1:<port> php/dev-router.php`.
- Headless screenshots: Puppeteer's cached shell — `require('/Users/realmrgee/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer')`, `executablePath: ~/.cache/puppeteer/chrome-headless-shell/mac_arm-156.0.8078.47/chrome-headless-shell-mac-arm64/chrome-headless-shell`, `headless: 'shell'`. Capture 1440 and 390 at minimum; add 834 and 2560 for layout work. Assert `document.documentElement.scrollWidth <= innerWidth` on each.
- Signed-in app without Clerk: `VITE_CLERK_PUBLISHABLE_KEY= npx vite build --outDir .local-test/qa-dist`, serve with `FLIGHTDECK_DIST=.local-test/qa-dist`, intercept `/api/*` with clearly labelled sample data, `page.setBypassServiceWorker(true)`, preset `localStorage['fd-consent']`.
- Console without an owner account: `npx vite build -c vite.console-test.config.ts && node test/console-ui.mjs --port 4403 --minutes 20` prints an owner URL.
- Print: `page.emulateMediaType('print')` and `page.pdf({ format: 'A4', preferCSSPageSize: true })`; the packing list must stay one page.
- Lazy images load only when scrolled near: scroll through before full-page screenshots.

## Accessibility audit

axe-core (installed in `.local-test/pw-tool/node_modules/axe-core`) injected with `page.addScriptTag`, run with tags `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa`, `setBypassCSP(true)`. Fix every violation; common ones here: translucent text on blue, dimmed counts on selected chips, interactive elements nested in `role="img"`, scrollable regions not focusable.

## Cross-browser

WebKit (Safari engine) via Playwright in `.local-test/pw-tool` with `PLAYWRIGHT_BROWSERS_PATH=.local-test/pw` (desktop and `devices['iPhone 13']`). Firefox does not launch headless on this Mac (BLOCKED) — ask the owner for a manual check.

## Presentation

After visible changes, rebuild the design presentation artifact ("Flightdeck Design System and Screens"): capture scripts in `.local-test/portfolio/` (app, site, console with sample data, live sign-in), then the canvas in the session scratchpad `present/index.html`, exported as 7680×4320 boards.

## Docs

Same commit: `docs/DESIGN.md` (system changes), `docs/CHANGELOG.md`, `docs/AUDIT.md` (checks run), `.agent/CURRENT-TASK.md`, and ADR in `docs/DECISIONS.md` for direction changes.
