# Current task

## Goal (1 November 2026, owner)
Get Flightdeck ready for live on branch `golive/2026-11`: security review, then (owner, later) "fix all" plus a standard hardening list (keys, env, admin routes, auth, access, forms, XSS, rate limits, API, CORS, headers, debug, dependencies, unused packages, exposed files, database, passwords, git secrets, full audit), and hide X-Powered-By and the server version. No push, deploy or Clerk/Cloudflare/GitHub changes.

## Status: DONE locally on `golive/2026-11`, NOT pushed or deployed
- All review findings fixed test first (M1 cap race reproduced 116/40, now 40/40; M2 fail-closed sign-in; L1 per-user allowances; L2 lock timeouts; L3 erase lock race reproduced and fixed; L4 cache key; L5 guide links). ADR-022.
- Hardening: new headers (COOP, X-Permitted-Cross-Domain-Policies), X-Powered-By and X-Turbo-Charged-By unset, hidden/backup/log/map files 404, `.env.*` ignored, Clerk 6.18.4, Biome 2.6.4, serialize-javascript 7.1.4 override, Semgrep clean, gitleaks history clean. Database and passwords: not applicable (no DB; Clerk).
- Independent review of the diff found an empty-issuer regression and a test gap; both fixed.
- Earlier today's feature commit 31f6851 (gates/key times, weather, Discover) is on `main`, unpushed; this branch builds on it.

## Checks run (1 Nov 2026)
`pnpm verify` PASS (node 116/116, PHP 229 all passed, build, upload guard); `pnpm test:ui` PASS; `pnpm test:console` PASS; `scripts/check-apache-routes.sh` PASS; Semgrep (p/default, p/php, p/secrets) clean; gitleaks full history clean. Details: docs/AUDIT.md.

## Next
1. Owner: look at the bare non `NAME=value` line in `.env` (reading `.env` was blocked). If it is the Clerk secret key, name it `CLERK_SECRET_KEY` or remove it.
2. Owner: approve merging `golive/2026-11` into `main` and pushing (a push deploys).
3. After deploy: live sign-in with the new COOP header; response headers (`X-Turbo-Charged-By` gone?); a real flight (gates, key times, weather, Discover); Provider health.
4. Planned tasks: major upgrades (vite 8, plugin-react 6, vite-plugin-pwa 2 which clears the build-time advisories, TypeScript 7, lucide 1, concurrently 10); self-host gtag to drop GTM from the CSP.
5. Still open from 31 Oct: console with the production account, a real phone, a screen reader, a paper print, Firefox (BLOCKED here).
6. For the owner (GitHub, needs approval): delete the stale remote branch `origin/production`; the 4 Dependabot PRs are the majors above.
