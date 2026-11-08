# Current task

## Goal (8 Nov 2026, owner)
Phase 1 of the GSD roadmap: land the go-live security release on `main` safely. Personal-use direction; remove the ads path later (Phase 4).

## Status: Phase 1 DONE except the owner's own checks
- **Security release is live.** `main` fast-forwarded from `31f6851` to `3db0b73` on 8 Nov 2026 (PR #6, CI `check` and Semgrep green on that exact commit; Deploy run 42523620903 passed in 1m16s). It contains: fail-closed sign-in (ADR-022), locked allowance caps, per-user allowances, new response headers, hidden-file rules, Clerk 6.18.4, Biome 2.6.4, `serialize-javascript` override.
- **Post-deploy checks (public requests, 8 Nov 2026):** anonymous `/api/weather` 401 (not 503), `/api/me` 401, `/api/admin/overview` 401; `/` and `/app/` 200; COOP and `X-Permitted-Cross-Domain-Policies` present; `X-Powered-By` gone; `config.php` and `.map` 404; `/.env` and `/.git/config` 403.
- **Branches:** `origin/production` and `golive/2026-11` deleted (GitHub removed the remote `golive/2026-11` itself when PR #6 merged). Only `main` and three Dependabot branches remain.
- **Owner decisions (8 Nov 2026):** restrict Clerk sign-up (yes, owner does it in the Clerk dashboard); `.planning/` stays local (excluded through `.git/info/exclude`); Bright Data stays ON; workspace cleanup done (deleted `.local-test/pw`, `.local-test/ff`, stale `graphify-out/`, two `.DS_Store`; `.local-test` 1.1 GB to 75 MB).

## Open after the release
1. **`X-Turbo-Charged-By: LiteSpeed` is still sent.** `public/.htaccess` unsets it, but LiteSpeed adds it after `.htaccess` runs. Fix needs a Cloudflare response-header rule or a LiteSpeed setting (server/Cloudflare change; needs the owner's approval). Low severity: it only names the web server.
2. **Bright Data is not live:** `/api/config` reports `webCheck: false`. The owner chose ON; the private server config needs `brightdata_key`, `brightdata_zone` and the `brightdata` switch. Not checked from here.
3. **Owner checks not done:** sign in with the real account; one real flight lookup (spends metered AeroDataBox quota); Provider health shows no failed provider; the bare non `NAME=value` line in `.env` (if it is the Clerk secret, name it `CLERK_SECRET_KEY` or remove it).
4. **Restrict Clerk sign-up** in the Clerk dashboard. Until then anyone can sign up.
5. Server settings still unverified: `trust_cf_connecting_ip`, whether `var/content/published.json` exists, PHP GD.
6. Rollback if sign-in breaks: `pnpm release --rollback --go` (needs approval; restores code files, not server config).
7. Planned tasks: major upgrades (vite 8, plugin-react 6, vite-plugin-pwa 2, TypeScript 7, lucide 1, concurrently 10; Dependabot PRs for vite and lucide are open); self-host gtag to drop GTM from the CSP.
8. Still open from 31 Oct: console with the production account, a real phone, a screen reader, a paper print, Firefox (BLOCKED here).

## Next (Phase 2 of 9: gate the deploy; not started, needs the owner's go-ahead)
Deploy runs on every push to `main` and does not wait for CI (DEL-10). Phase 2 makes it wait for or run the full gate. Full roadmap in `.planning/ROADMAP.md` (local only).

## Checks run
Before the push (8 Nov 2026, commit 971ce58 and docs-only tips): `npm run verify` PASS (node 116/116, PHP all passed, build, upload guard); Biome; `tsc --noEmit`; `php -l` 38 files; gitleaks; `scripts/check-apache-routes.sh`; `pnpm test:ui`; `pnpm test:console`. In CI on `3db0b73`: `check` and Semgrep PASS. After deploy: the public-request checks above. NOT run: any signed-in flow on the live site. Details: docs/AUDIT.md.
