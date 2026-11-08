# Current task

## Goal (8 Nov 2026, owner)
Work through the GSD roadmap (9 phases, local plan in `.planning/`). Personal-use direction; the ads path is removed in Phase 4.

## Status
- **Phase 1 (security release): DONE and live.** `main` at 3db0b73 deployed 8 Nov 2026; branches `production` and `golive/2026-11` deleted.
- **Phase 2 (gate the deploy): DONE and live** (PR #7, `main` at 5184493, ADR-023). `deploy.yml` = `check` (calls `ci.yml`) then `deploy`; PHP 8.4 in CI; actions pinned by SHA; richer smoke list. First gated deploy run 42526313819 PASS. A docs-only push (87ef5fb) correctly started no Deploy and no CI.
- **Phase 3 (docs match the code): BUILT on branch `phase-3/docs-match-code`, NOT pushed.** `pnpm docs:check` (in `pnpm check`, so CI runs it) plus fixes to API, INTEGRATIONS, PRD, CMS, PRIVACY, SECURITY, SCHEMA, RUNBOOK, TESTING, ARCHITECTURE, ACCESSIBILITY, ROADMAP, PROJECT-MEMORY, ADR statuses and three code comments. Details: docs/AUDIT.md (8 Nov, Phase 3). Local checks PASS: `npm run verify` (135/135, PHP, build), lint, `test:ui`, `test:console`. NOT tested on GitHub: CI has not run `docs:check` yet. To land: push the branch, open a PR, wait for green, then the owner says "approved: push main". The merge deploys, but the only served file that changes is `Flight.php` (a comment), so the release uploads that one file.

## Owner decisions (8 Nov 2026)
- Restrict Clerk sign-up: yes (owner, in the Clerk dashboard). Not done yet.
- `.planning/` stays local, untracked (excluded through `.git/info/exclude`).
- Bright Data: ON. The live site still reports `webCheck: false`; the private server config needs `brightdata_key`, `brightdata_zone` and the `brightdata` switch.
- Workspace cleanup done (unused test browsers, stale `graphify-out`, `.DS_Store`).

## Open (mostly yours)
1. **Restrict Clerk sign-up** in the Clerk dashboard. Until then anyone can sign up and spend the metered provider allowance.
2. **Signed-in check on the live site:** sign in, one real flight lookup (spends metered AeroDataBox quota), Provider health. Never done.
3. **Bright Data config** on the server (see above).
4. **`X-Turbo-Charged-By: LiteSpeed`** is still sent; `.htaccess` cannot remove it. Needs a Cloudflare response-header rule or a LiteSpeed setting (needs approval).
5. **Bare line in `.env`** (if it is the Clerk secret, name it `CLERK_SECRET_KEY` or delete it).
6. Server settings unverified: `trust_cf_connecting_ip`, whether `var/content/published.json` exists, PHP GD.
7. **Off-server backup copy and one restore drill** (the Phase 3 item that needs server access): not done.
8. **Public cookies and privacy page copy** lacks several storage keys, rate-limit hashing and the Bright Data query (docs/PRIVACY.md has the list). It is live content in `php/private/src/Content/seed.json`; changing it needs the owner's approval.
9. Gap: a deploy with nothing to upload exits before the smoke checks (candidate fix in Phase 5 or 7, test first).
10. Dependabot: PRs for vite 8 and lucide 1 are open (planned major upgrades, Phase 9); one Dependabot Updates run failed on 3db0b73 and was never looked at.
11. Still open from 31 Oct: console with the production account, a real phone, a screen reader, a paper print, Firefox (BLOCKED here).

## Rollback
If sign-in or the app breaks after a deploy: `pnpm release --rollback --go` (needs approval; restores code files, not server config).

## Next
After Phase 3 lands: Phase 4, remove the ads path (needs the owner's go-ahead). Roadmap in `.planning/ROADMAP.md` (local only).

## Checks run (8 Nov 2026)
Phase 3 branch: `npm run verify` PASS (node 135/135, PHP "All passed", build, upload guard); `pnpm lint`; `pnpm docs:check`; `pnpm test:ui`; `pnpm test:console`. Earlier phases: see docs/AUDIT.md.
