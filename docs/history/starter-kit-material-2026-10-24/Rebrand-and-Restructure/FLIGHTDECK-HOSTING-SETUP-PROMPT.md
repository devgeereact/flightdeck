# Flightdeck — existing-app hosting and GitHub release setup

## Copy/paste launcher

My reference kit is:
/Users/realmrgee/Downloads/New-App-Starter

Read START-PROMPT.md and its referenced rules, but apply the existing-project instructions below. Also read FLIGHTDECK-HOSTING-SETUP-PROMPT.md and FLIGHTDECK-HOSTING-READINESS.md in that folder.

Continue my EXISTING app in:
/Users/realmrgee/Developer/Projects/flightdeck

Do not create a replacement app, run the new-app scaffolder, reset this folder or work inside the reference kit. Keep the reference kit unchanged. Start with read-only discovery and ask only focused questions about missing or conflicting facts before changing code/infrastructure.

The existing public hostname is:
https://flightdeck.gakinz.com

Hosting mode: SETUP_AND_TEST, after I confirm the exact target table described below.

My goal: reuse the current domain/subdomain and cPanel deployment, verify the correct Cloudflare DNS/HTTPS configuration, create or reuse project-restricted FTPS access, connect the correct private GitHub repository, save deployment credentials securely in its Actions secrets, and prove GitHub → FTPS → public HTTPS with one unique harmless test page. Then prepare deliberate low-minutes production releases. Do not launch another site, overwrite the live homepage, add paid services, weaken security or change unrelated resources.

## Flightdeck facts and overrides — read before generic hosting instructions

- This is an existing React/TypeScript PWA with a PHP API now present and a Node reference backend. Preserve it; do NOT perform another Node-to-PHP rewrite or replace OpenSky with FlightAware.
- Fresh verification on 24 October: Node unit tests 6/6, PHP checks 15/15 and TypeScript/frontend/PWA build passed. Public home/config/demo/sw/manifest returned 200 with TLS checked. Normal local DNS failed while independent public DNS resolved; do not claim the domain is absent or purchase/create it again.
- /api/config reported provider OpenSky Network and liveAvailable true. That is not proof that gates/boarding/baggage/schedules are supplied. Never fabricate missing operational fields. Do not consume live-provider quota to test FTP connectivity.
- There is no Git repository/remote at the local app folder and no release workflow. Existing docs have contradictory old/current deployment paragraphs. Reconcile using read-only evidence and retain history before edits.
- Recorded public root: /home/devgeereact/flightdeck.gakinz.com. Recorded private root: /home/devgeereact/flightdeck-private. Recheck these in cPanel; preserve private config.php, tokens, var/cache, .env and any unrelated content. No need to create a database or Clerk app for current guest functionality.
- Previous origin: premium17.web-hosting.com / 185.61.152.45; FTPS explicit TLS 21; SSH/SFTP 21098. Cloudflare web proxy is not an FTP proxy. Current provider access/identity, zone, origin certificate and FTP account scope must be reverified.
- Public manifest currently returns application/octet-stream. Public sw/HTML now return no-cache; do not blindly apply the older claim that their cache headers are still overridden. Inspect current cache/MIME rules and propose the smallest scoped fix; avoid changing a shared zone's settings without wider approval.
- Keep public and private release paths separate. A public-root FTP identity must not access private secrets. For the probe, use ONLY the public account. For later PHP code releases, either a second identity restricted to the verified private-code root or another reviewed least-privilege transport is needed. Preserve config.php, .env, var/cache and server-managed files; never mirror-delete. Do not grant one FTP user the entire cPanel home to simplify deployment.
- Suggested secret names for public probe: FTP_SERVER, FTP_USERNAME, FTP_PASSWORD. Only if a separately verified private-code pipeline is needed add PRIVATE_FTP_USERNAME and PRIVATE_FTP_PASSWORD in the SAME confirmed repository; do not upload real application runtime secrets to GitHub unless a specifically approved requirement exists. Never print them or put them into YAML/source/chat.
- Ask for the intended GitHub owner/repository when existing authenticated access cannot establish it. In this separately invoked SETUP_AND_TEST task, private repo creation/local Git init is permitted only after the user confirms that exact destination in the target table. Snapshot/verified source backup and secret scanning come first. No blanket Git cleanup, branch/stash deletion, force pushes or history rewriting.
- Initial workflow should be manual and only upload the probe; do not enable a full production upload with the first push. Select production branch/manual releases after success; ordinary development pushes and PRs must not publish. No repeated no-op runs or broad CI matrix. Record actual Actions usage if available.
- Any secret transmission is only to the confirmed repository/account. If provider authentication or secret-creation UI needs personal action, guide me locally; never ask me to paste passwords into chat.

## Verification and publishing boundary

This file is a prompt, not a completed deployment. When I send it as my active request, start read-only, verify backup/targets, and show the exact account/domain/DNS/root/FTP/repo/branch table. Ask me to confirm that concrete table before creating credentials or mutating external resources. After confirmation, perform only the scoped setup/probe task, respecting tool permissions. No existing homepage/full product replacement is approved by the probe test.

Use a new non-secret random path such as deploy-check-<random>.html and the provided deployment test-page template. Verify absence before upload. The real proof is a successful GitHub workflow run followed by a public HTTPS 200 with the exact marker. A page uploaded from my Mac alone is not evidence of GitHub auto-deploy. Local build/tests may reuse existing dependencies; don't copy real .env/config into artifacts.

Final report: what was reused/created/changed, private/public release design, secret NAMES only, run/commit/public probe URL, cache/MIME/TLS evidence, minutes if known, rollback/private backup, and PASS/FAIL/PARTIAL/NOT TESTED/BLOCKED per stage. Show blockers precisely and don't call full app auto-deploy verified when only the static probe is proven.

## Full hosting procedure

Follow HOSTING-SETUP-PROMPT.md from the reference kit for the detailed staged procedure, subject to the Flightdeck-specific facts above. If two instructions conflict, use these current project-specific facts and the user's active task; ask before consequential unresolved changes. Generic fresh-app folder or domain examples are never instructions to recreate Flightdeck.
