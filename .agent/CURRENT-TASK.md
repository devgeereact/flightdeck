# Current task

## Goal (1 November 2026, owner)
Get Flightdeck ready for live on branch `golive/2026-11`: security review, then (owner, later) "fix all" plus a standard hardening list (keys, env, admin routes, auth, access, forms, XSS, rate limits, API, CORS, headers, debug, dependencies, unused packages, exposed files, database, passwords, git secrets, full audit), and hide X-Powered-By and the server version. No push, deploy or Clerk/Cloudflare/GitHub changes.

## Status: DONE locally on `golive/2026-11`, NOT pushed or deployed
- All review findings fixed test first (M1 cap race reproduced 116/40, now 40/40; M2 fail-closed sign-in; L1 per-user allowances; L2 lock timeouts; L3 erase lock race reproduced and fixed; L4 cache key; L5 guide links). ADR-022.
- Hardening: new headers (COOP, X-Permitted-Cross-Domain-Policies), X-Powered-By and X-Turbo-Charged-By unset, hidden/backup/log/map files 404, `.env.*` ignored, Clerk 6.18.4, Biome 2.6.4, serialize-javascript 7.1.4 override, Semgrep clean, gitleaks history clean. Database and passwords: not applicable (no DB; Clerk).
- Independent review of the diff found an empty-issuer regression and a test gap; both fixed.
- Feature commit 31f6851 (gates/key times, weather, Discover) is already on `origin/main` and was deployed on 1 Nov 2026 (Deploy run 41283970437). This branch is ahead of `origin/main` by the 3 security commits plus the docs commits since, and 0 behind, so it fast-forwards with no conflicts. (This file used to say "unpushed"; checked with git and `gh run list` on 8 Nov 2026.)

## Checks run (1 Nov 2026)
`pnpm verify` PASS (node 116/116, PHP 229 all passed, build, upload guard); `pnpm test:ui` PASS; `pnpm test:console` PASS; `scripts/check-apache-routes.sh` PASS; Semgrep (p/default, p/php, p/secrets) clean; gitleaks full history clean. Details: docs/AUDIT.md.

## Checks re-run on the same commit 971ce58 (8 Nov 2026, Phase 1 gate)
`npm run verify` PASS (node 116/116, PHP all passed, build, upload guard); Biome PASS; `tsc --noEmit` PASS; `php -l` 38 files, 0 errors; gitleaks 131 commits, no leaks; `scripts/check-apache-routes.sh` PASS; `pnpm test:ui` PASS; `pnpm test:console` PASS. Semgrep not re-run. Not run: anything against the live server. Details: docs/AUDIT.md.

## Owner decisions (8 Nov 2026)
- **Restrict Clerk sign-up: yes.** Personal-use app with provider terms (AeroDataBox free tier, OpenSky) to respect. Owner changes it in the Clerk dashboard (restricted sign-up / allowlist); not done from the repo. Record here when done.
- **`.planning/` stays local**, untracked (excluded through `.git/info/exclude`, not `.gitignore`).
- **Bright Data stays ON.** Needs `brightdata_key` and `brightdata_zone` in the private server config; caps are `brightdata_daily_cap` (150/day) and `brightdata_user_daily_cap` (20/user/day). Not checked on the server; confirm in Provider health after deploy.
- **Workspace cleanup done:** deleted `.local-test/pw` and `.local-test/ff` (unused Firefox/WebKit downloads, about 1 GB, nothing in `package.json`, `test/`, `scripts/` or workflows referenced them), the stale `graphify-out/` (27 Oct) and two `.DS_Store` files. `.local-test` went from 1.1 GB to 75 MB. Nothing tracked was touched.

## Next (Phase 1: land the security release; each step marked * needs the owner's explicit "approved")
1. Owner: look at the bare non `NAME=value` line in `.env` (reading `.env` was blocked). If it is the Clerk secret key, name it `CLERK_SECRET_KEY` or remove it.
2. * Push the branch `golive/2026-11` (does not deploy) and open a PR so CI runs the whole gate. Only when CI is green on the pushed commit (`gh pr checks`), run `git fetch origin`, confirm `origin/main` is still 31f6851, then fast-forward `main` (`git merge --ff-only`) and push `main` (this deploys). The deploy itself runs only `pnpm test`, `pnpm test:php` and the build, so the PR's CI is the only full gate before it (until Phase 2).
3. Owner, on the server (not checked from here): `FLIGHTDECK_AUTH` is not `off`; **a valid Clerk issuer resolves** (`clerk_issuer` in the private config, `CLERK_ISSUER`, or the publishable key). The new code answers 503 on every protected route without one, and the deploy smoke test (`/`, `/app/`, `/api/config`) would not notice. Also: `trust_cf_connecting_ip` is set; whether `var/content/published.json` exists; PHP GD is available. Record the answers here.
4. After deploy: an anonymous `GET /api/weather` answers 401, not 503; `curl -sI https://flightdeck.gakinz.com/ | grep -i 'x-turbo\|x-powered'` prints nothing and `Cross-Origin-Opener-Policy` is present; live sign-in works; one real flight lookup by the owner (spends metered AeroDataBox quota) shows gates, key times, weather and Discover; Provider health shows no failed provider. Undo with `pnpm release --rollback --go` (with approval). Rollback restores code files, not server config.
5. Planned tasks: major upgrades (vite 8, plugin-react 6, vite-plugin-pwa 2 which clears the build-time advisories, TypeScript 7, lucide 1, concurrently 10); self-host gtag to drop GTM from the CSP.
6. Still open from 31 Oct: console with the production account, a real phone, a screen reader, a paper print, Firefox (BLOCKED here).
7. * For the owner (GitHub, needs approval): delete the remote branch `origin/production` (fully merged into `main`, 0 commits ahead) and, after the merge, `golive/2026-11`. Dependabot PR #2 (Clerk 6.18.1) is obsolete because this branch has 6.18.4; PRs #3, #4 and #5 are the planned majors/actions above.
