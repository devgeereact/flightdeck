# Current task

## Goal (8 Nov 2026, owner)
Work through the GSD roadmap (9 phases, local plan in `.planning/`). Personal-use direction; the ads path is removed in Phase 4.

## Status
- **Phases 1 to 5 of 9: DONE and live** (`main` at 0744308, 9 Nov 2026): 1 the security release, 2 the deploy waits for the full CI gate (ADR-023), 3 docs match the code (`pnpm docs:check`), 4 the ads path removed (ADR-024), 5 cleanup and a safety net (strict `noUnusedLocals`, 17 route tests on three throwaway servers, dead code and metrics removed). Details of each: docs/AUDIT.md.
- **Also live since:** the owner-app fixes from the live smoke test (terminal-vs-gate labels, landed-flight position card, Bright Data retry and link filtering, console rows), the console crash guard and the "Something went wrong" screen, and the fix for the owner console's endless request loop.
- **Phase 6 (the trip-day home) is NEXT and not started.** It changes what users see, so it needs the owner's go-ahead, a written proposal and a mockup first.
- Everything is merged: only `main` and two Dependabot PRs (#3 lucide-react 1, #4 vite 8, planned major upgrades) remain.

## Owner decisions (8 Nov 2026)
- Clerk sign-up: leave it open (owner). Per-user allowances cap the cost; the provider-terms concern (ADR-008) stays open.
- `.planning/` stays local, untracked (excluded through `.git/info/exclude`).
- Bright Data: ON. Not yet on the live site (`webCheck:false`). Only `brightdata_key` and `brightdata_zone` are needed (there is no other switch; an earlier note of mine said otherwise).
- Signed-in flight lookup on the live site: DONE by the owner.
- Cookies and privacy page text change: approved and written (branch below); check it live after deploy.
- Workspace cleanup done (unused test browsers, stale `graphify-out`, `.DS_Store`).
- Cloudflare header rule: DONE and live (rule `fdbcc345d3c245d693244a62da1203f8` in zone gakinz.com, host-scoped).
- Off-server backup drill and Dependabot: delegated to me; done, see docs/AUDIT.md (8 Nov, owner items).

## Latest (9 Nov 2026): console request-loop fix live; extra commit merged; no-op deploy and backup verified (`main` at 0744308)
- Deployed with run 42625658806 (smoke 5 passed, app files only). **Not verified in a browser** (the Chrome extension was disconnected): check by opening the console's Usage screen and watching the Network tab; after the first `/api/admin/overview` there should be no more calls. Press Reload on the update banner first.
- Another Claude session added a commit `9d9e95c` (one comment line in `deploy.yml`, tagged `[skip ci]`) to the PR branch after CI had passed; I first merged only `e6fa909`, then merged it too on the owner's instruction.
- Another session shares this checkout and commits to it; check `git log` before relying on a branch.

## Open (yours, in order)
1. ~~Backup~~ **VERIFIED (9 Nov 2026):** the cron entry works. The 02:23 run made `flightdeck-var-20261109.tar.gz` (3,476 bytes, 29 entries, gzip OK); `scripts/pull-server-backup.sh` copied it to `.local-test/restore-drill/` and a restore test parsed all 22 JSON files (3 enquiries, 1 packing list, no `var/content`). Gap: no nightly backup existed from 2 to 8 Nov. Run `bash scripts/pull-server-backup.sh` weekly (it writes to `~/Backups/projects/flightdeck/` when run from your own Terminal).
2. **Bright Data: ENABLED on the live server** (8 Nov 2026, zone `mcp_serp`, `/api/config` reports `webCheck:true`, verified read-only; the script's first run refused safely because the server config uses the older `array (` style, since fixed and tested). **Still to check by you:** open a flight page while signed in and look for "Latest from the web" links. If they are empty, look at Provider health (Bright Data) and tell me: Google returned non-JSON twice in my connector test, and the next step would be a small code change (`parsed_light`, or Bing). Each search costs money; caps default to 150 a day and 20 per user.
3. **Run `bash .local-test/fix-env-bare-line.sh`** for the bare line in `.env` (it never prints a value; I was not allowed to read `.env`). It refuses anything it cannot identify.
4. ~~Approve pushing~~ DONE: everything is merged and deployed; only `main` and two Dependabot PRs remain.
5. Server facts known: per-visitor limits behind Cloudflare are ON, server PHP 8.4.27, no `var/content/published.json` (the CMS has never been published). Still unverified: PHP GD.
6. Clerk sign-up restriction: left open by choice.
7. ~~Gap: a deploy with nothing to upload skipped the smoke checks~~ FIXED and PROVEN live on 9 Nov 2026: Deploy run 42626795807 printed "Nothing to upload" and then ran the smoke checks (5 passed).
8. Dependabot minimatch security job fails on every push: build-time only, needs vite-plugin-pwa 2 (Phase 9). Left on purpose.
9. Access to `~/Backups/` and `.local-state/` was denied to me; the drill's tarball is in `.local-test/restore-drill/` (mode 600). Move it to `~/Backups/projects/flightdeck/` if you want to keep it.
10. Still open from 31 Oct: console with the production account, a real phone, a screen reader, a paper print, Firefox (BLOCKED here).

## Rollback
If sign-in or the app breaks after a deploy: `pnpm release --rollback --go` (needs approval; restores code files, not server config).

## Next
After the loop fix lands: Phase 6, the trip-day home (needs the owner's go-ahead; this one changes what users see). Roadmap in `.planning/ROADMAP.md` (local only).

## Checks run (8 Nov 2026)
Owner-items branch (includes Phase 4): `npm run verify` PASS (node 153/153, PHP "All passed", build, upload guard); `pnpm lint`; `pnpm docs:check`; `pnpm test:ui`; `pnpm test:console`. Earlier phases: see docs/AUDIT.md.
