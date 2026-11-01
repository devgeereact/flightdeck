# Current task

## Goal (1 November 2026, owner)
Get Flightdeck ready for live on branch `golive/2026-11`: security review (checklist storage, Clerk token checks, provider calls, .htaccess/CSP), fix Critical/High, SEO check of the landing page. No push, deploy or Clerk/Cloudflare/GitHub changes.

## Status: DONE locally on `golive/2026-11`, NOT pushed or deployed
- Security review: no Critical or High findings, so no code fixes. 2 Medium (Bright Data cap race, sign-in fails open on a missing/malformed issuer) and 5 Low recorded in docs/AUDIT.md (1 Nov go-live entry) and docs/SECURITY.md. Independent second review agreed.
- SEO (home page, rendered locally from the seed): sound; minor items only (description 185 chars, JPEG without srcset, no Organization schema).
- Earlier today's feature work (commit 31f6851 on `main`: gates/key times, weather and Discover, cleanup) is still unpushed; this branch starts from it.

## Checks run (1 Nov 2026)
`pnpm verify` PASS before the commit (lint, typecheck, tests, PHP "All passed", build, upload guard). PHP suite prints harmless teardown `unlink` warnings on directories.

## Next
1. Owner: decide whether to fix M1 (lock the Bright Data daily count, needed before adding a key) and M2 (fail closed when `clerk_issuer` is missing or malformed). Both are small.
2. Owner: approve merge of `golive/2026-11` into `main` and push (a push deploys).
3. After deploy: check a real flight live (gates, key times, weather, Discover) and Provider health.
4. Optional: Bright Data (key, zone and budget, after M1); the SEO touch-ups.
5. Still open from 31 Oct: console with the production account, a real phone, a screen reader, a paper print, Firefox (BLOCKED here).
6. For the owner (GitHub, needs approval): delete the stale remote branch `origin/production`; the 4 Dependabot PRs include major upgrades (vite 8, lucide 1.x), which are planned tasks.
