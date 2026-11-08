# Current task

## Goal (8 Nov 2026, owner)
Work through the GSD roadmap (9 phases, local plan in `.planning/`). Personal-use direction; the ads path is removed in Phase 4.

## Status
- **Phase 1 (security release): DONE and live.** `main` at 3db0b73 deployed 8 Nov 2026; branches `production` and `golive/2026-11` deleted.
- **Phase 2 (gate the deploy): DONE and live** (PR #7, `main` at 5184493, ADR-023). `deploy.yml` = `check` (calls `ci.yml`) then `deploy`; PHP 8.4 in CI; actions pinned by SHA; richer smoke list. First gated deploy run 42526313819 PASS. A docs-only push (87ef5fb) correctly started no Deploy and no CI.
- **Phase 3 (docs match the code): DONE and live** (PR #8, `main` at f8653a2, Deploy run 42528085001 PASS, smoke checks 5 passed). `pnpm docs:check` (in `pnpm check`, so CI runs it) plus fixes to API, INTEGRATIONS, PRD, CMS, PRIVACY, SECURITY, SCHEMA, RUNBOOK, TESTING, ARCHITECTURE, ACCESSIBILITY, ROADMAP, PROJECT-MEMORY, ADR statuses and three code comments. Details: docs/AUDIT.md (8 Nov, Phase 3). Local checks PASS: `npm run verify` (135/135, PHP, build), lint, `test:ui`, `test:console`. CI ran `docs:check` on PHP 8.4.27 and passed. To do with approval: delete branch `phase-3/docs-match-code` (the remote copy may already be gone).

- **Phase 4 (remove the ads path): BUILT on branch `phase-4/remove-ads-path`, NOT pushed** (ADR-024). Local checks PASS (136/136, verify, lint, UI, console). NOT tested: CI, the deploy, and `/ads.txt` on the live host. To land: push the branch, open a PR, wait for green, then the owner says "approved: push main". The merge deploys real code (PHP, the site script, the console bundle and `.htaccess`).

## Owner decisions (8 Nov 2026)
- Clerk sign-up: leave it open (owner). Per-user allowances cap the cost; the provider-terms concern (ADR-008) stays open.
- `.planning/` stays local, untracked (excluded through `.git/info/exclude`).
- Bright Data: ON. Not yet on the live site (`webCheck:false`). Only `brightdata_key` and `brightdata_zone` are needed (there is no other switch; an earlier note of mine said otherwise).
- Signed-in flight lookup on the live site: DONE by the owner.
- Cookies and privacy page text change: approved and written (branch below); check it live after deploy.
- Workspace cleanup done (unused test browsers, stale `graphify-out`, `.DS_Store`).
- Cloudflare header rule: DONE and live (rule `fdbcc345d3c245d693244a62da1203f8` in zone gakinz.com, host-scoped).
- Off-server backup drill and Dependabot: delegated to me; done, see docs/AUDIT.md (8 Nov, owner items).

## Open (yours, in order)
1. **Backup cron: DONE** (installed by the owner's run on 8 Nov; first backup due 02:23 server time on 9 Nov). Check tomorrow: `bash scripts/pull-server-backup.sh` copies the newest backup to this Mac and warns if it is more than two days old. Weekly after that.
2. **Bright Data: ENABLED on the live server** (8 Nov 2026, zone `mcp_serp`, `/api/config` reports `webCheck:true`, verified read-only; the script's first run refused safely because the server config uses the older `array (` style, since fixed and tested). **Still to check by you:** open a flight page while signed in and look for "Latest from the web" links. If they are empty, look at Provider health (Bright Data) and tell me: Google returned non-JSON twice in my connector test, and the next step would be a small code change (`parsed_light`, or Bing). Each search costs money; caps default to 150 a day and 20 per user.
3. **Run `bash .local-test/fix-env-bare-line.sh`** for the bare line in `.env` (it never prints a value; I was not allowed to read `.env`). It refuses anything it cannot identify.
4. **Approve pushing**: Phase 4 (ads removed, branch `phase-4/remove-ads-path`) and the owner-items branch `post-phase-4/owner-items` (cookies and privacy text, the three scripts, tests, docs) are both local only. They are stacked: `post-phase-4/owner-items` contains Phase 4. One PR from the top branch lands both. The merge deploys real code (PHP site, seed content, console bundle, `.htaccess`).
5. Server settings unverified: `trust_cf_connecting_ip`, PHP GD. (`published.json`: the 1 Nov backup had none.)
6. Clerk sign-up restriction: left open by choice.
7. Gap: a deploy with nothing to upload exits before the smoke checks (candidate fix in Phase 5 or 7, test first).
8. Dependabot minimatch security job fails on every push: build-time only, needs vite-plugin-pwa 2 (Phase 9). Left on purpose.
9. Access to `~/Backups/` and `.local-state/` was denied to me; the drill's tarball is in `.local-test/restore-drill/` (mode 600). Move it to `~/Backups/projects/flightdeck/` if you want to keep it.
10. Still open from 31 Oct: console with the production account, a real phone, a screen reader, a paper print, Firefox (BLOCKED here).

## Rollback
If sign-in or the app breaks after a deploy: `pnpm release --rollback --go` (needs approval; restores code files, not server config).

## Next
After Phase 4 and the owner items land: Phase 5, cleanup and a safety net (needs the owner's go-ahead). Roadmap in `.planning/ROADMAP.md` (local only).

## Checks run (8 Nov 2026)
Owner-items branch (includes Phase 4): `npm run verify` PASS (node 153/153, PHP "All passed", build, upload guard); `pnpm lint`; `pnpm docs:check`; `pnpm test:ui`; `pnpm test:console`. Earlier phases: see docs/AUDIT.md.
