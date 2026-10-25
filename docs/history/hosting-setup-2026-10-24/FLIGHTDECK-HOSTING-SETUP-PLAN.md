# Flightdeck hosting setup — audit and plan (24 October 2026)

Status: PREPARE_ONLY. Read-only audit complete; no external resource, repository, credential, secret or file was created or changed. Everything marked "to confirm" needs the user's approval before the SETUP_AND_TEST stages run. Reusable procedure: `~/Downloads/Rebrand-and-Restructure/HOSTING-SETUP-PROMPT.md` and `GIT-AND-ACTIONS-SETUP.md` (read-only reference, unchanged).

## 1. Re-verified facts (this session)

| Item | Evidence | Result |
|---|---|---|
| Hostname | Public DoH: A 104.21.4.95, 172.67.153.246; AAAA 2606:4700:3031::ac43:99f6, 2606:4700:3036::6815:45f (Cloudflare proxied). Zone `gakinz.com` NS: clint/malavika.ns.cloudflare.com. Local resolver now resolves it too (earlier failure not reproduced). | PASS |
| Public HTTPS | Cert verifies (Google Trust CN=gakinz.com, edge cert, expires 17 Dec 2026). `/` 200 no-cache; `/api/config` 200 no-store BYPASS; `/sw.js` 200 text/javascript no-cache; `/manifest.webmanifest` 200 **application/octet-stream** (still wrong MIME). | PASS / PARTIAL |
| SPA fallback | A nonexistent path (`/deploy-check-nonexistent-probe.html`) returns **200 text/html**. HTTP status therefore cannot prove a probe file is absent; use FTP listing plus exact-body match. | NEW FINDING |
| cPanel account | SSH alias `cpanel` -> devgeereact @ 185.61.152.45:21098 works with the existing key. | PASS |
| Public root | `/home/devgeereact/flightdeck.gakinz.com` exists (drwxr-xr-x, owner devgeereact:nobody). Contains `.htaccess, api, assets, cgi-bin, icon.svg, index.html, manifest.webmanifest, registerSW.js, sw.js, workbox-*.js`. Sibling of, not nested in, `gakinz.com/`. | PASS |
| Private root | `/home/devgeereact/flightdeck-private` (drwx------) with `config.php` (mode 600), `config.example.php`, `src`, `var`. Outside every webroot. | PASS |
| Server PHP | CLI 8.4.27. Web SAPI version/memory not separately checked (live API works). | PARTIAL |
| Origin FTPS | `premium17.web-hosting.com:21` explicit TLS: cert `*.web-hosting.com` (Sectigo), hostname verification OK, expires 18 Dec 2026. No login attempted. | PASS (handshake only) |
| Existing FTP accounts | 9 sub-accounts for other sites, **none for flightdeck**. `gakinz_com@gakinz.com` belongs to the parent site; do not reuse. | New account needed |
| Shared host | Same cPanel home holds ~10 unrelated sites (egolimited, heritclothing, mimmycare, soulrefresh, vitalcare, harni.uk ...). Account scoping is the main safety control. | NOTE |
| GitHub | `gh` authenticated as **gsakinz** (scopes gist, read:org, repo, workflow). No orgs. No repository matching "flight". Billing API needs the `user` scope (not granted), so Actions minutes/plan cannot be read. | PARTIAL |
| Local Git | `/Users/realmrgee/Developer/Projects/flightdeck` is not a Git repo. `.gitignore` covers `node_modules, dist, .env, *.log, .DS_Store, php/private/config.php, php/private/var/`. `.env.example` holds empty secret values. | OK |
| Backup | `~/repo-backups/flightdeck-2026-10-24-0022` exists but **predates** the PHP work (php/, public/api, scripts/). A fresh snapshot is needed before `git init`. | ACTION |
| Cloudflare | Zone is on Cloudflare but no Cloudflare API access/token is available in this session, so Full (strict), Browser Cache TTL and the exact record set were NOT verifiable at the time. UPDATE 24 Oct 2026 (Skyhook): verified by API; SSL mode strict; hostname-scoped respect-origin Cache Rule added. Origin has a valid public-CA cert for `*.web-hosting.com`, but whether it covers `flightdeck.gakinz.com` (AutoSSL) is unverified. | NOT TESTED |

Doc inconsistencies to reconcile later (history kept): DEPLOYMENT.md, CURRENT-TASK.md and ARCHITECTURE.md still carry older "no deployment / PHP proposed / Node-only" paragraphs beside the current deployed-manually facts.

## 2. Proposed target table (confirm before any live step)

| Field | Proposed value | Status |
|---|---|---|
| Project | Flightdeck (existing React/TS PWA + PHP API), no re-scaffold | confirmed by docs |
| Public hostname | https://flightdeck.gakinz.com | confirmed |
| cPanel account / origin | devgeereact, premium17.web-hosting.com / 185.61.152.45 (FTPS 21 explicit, SFTP/SSH 21098) | verified |
| Public root | /home/devgeereact/flightdeck.gakinz.com (live, preserve) | verified |
| Private root | /home/devgeereact/flightdeck-private (not touched by the public pipeline) | verified |
| Cloudflare zone | gakinz.com (proxied A records exist for the subdomain) | partly verified |
| FTP identity | new `github-deploy-flightdeck@flightdeck.gakinz.com`, home directory exactly the public root | to create |
| GitHub owner / repo | `gsakinz` / `flightdeck` (private) | **to confirm** |
| Branches | local default `main`; release branch `production` created only after the probe passes | to confirm |
| Transport | GitHub runner -> explicit FTPS 21 to the origin hostname -> public HTTPS check | proposed |

## 3. Plan, in order

Stage A — local, no external effect (safe to start on approval of the repo name)
1. Fresh verified backup of the current tree (hash manifest, excluding node_modules, dist, .env) to `~/repo-backups/flightdeck-<timestamp>`.
2. Reconcile docs with a short appended "current state" block; keep old text under a heading or in docs/history.
3. Adapt the reference probe into `scripts/hosting-probe.py` and `.github/workflows/hosting-probe.yml` in this folder: manual `workflow_dispatch` only, `permissions: contents: read`, pinned `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683`, `timeout-minutes: 3`, no mirror-delete. Changes versus the kit: render `deployment-test-page.template.html` (HTML-escaped app name, hostname, random marker, UTC time), name the file `deploy-check-<random>.html`, list the FTP directory for absence, then verify the public body exactly, then delete only that file (or keep it if you choose).
4. `git init -b main`, secret scan (patterns for the OpenSky id/secret, tokens, private keys; confirm `.env`, `config.php`, `var/` are not staged), review staged names, one focused commit. The first commit contains the whole source because there is no history, but no workflow that publishes the app.

Stage B — external, after you confirm the table
5. `gh repo create gsakinz/flightdeck --private --source . --remote origin` and push `main`. No force push.
6. cPanel: create the FTP account scoped to the public root; verify the home directory does not gain a username subfolder. Password never goes through chat or command arguments. Two routes: (a) you create the account in cPanel with a generated password, then run `gh secret set FTP_PASSWORD` yourself so gh prompts for it hidden, or (b) I generate it in memory and pass it by stdin only if cPanel's UAPI supports a stdin input mode; I will check that and fall back to (a).
7. Verify FTPS login, that `/` is exactly the public root and that the account cannot see `flightdeck-private`, from this Mac (no Actions minutes, no OpenSky quota).
8. Secrets by name: `FTP_SERVER` (= premium17.web-hosting.com), `FTP_USERNAME`, `FTP_PASSWORD`. Variable `PUBLIC_BASE_URL` = https://flightdeck.gakinz.com. Prefer a `hosting-test` environment; environments on private repos depend on the GitHub plan, so if unavailable the fallback is repository-level secrets with the workflow restricted to manual runs on `main`.
9. Run the manual workflow once. Pass criteria: run green, public body equals the rendered template and contains the marker, HTTP 200, TLS valid, host correct, homepage hash unchanged, cleanup done. Record run id, commit SHA, UTC time and measured runtime.
10. Only after that, a second reviewed task adds the production release workflow (production branch plus manual dispatch, lockfile install, `pnpm test`, `pnpm test:php`, `pnpm build`, serial, no cancel mid-upload, docs path filters, additive upload, preserving `.htaccess` rules, `api/` and `cgi-bin/`). Private PHP code releases need a separate least-privilege identity and are out of scope for the probe.

Out of scope for this task: deploying the full app, changing the homepage, Cloudflare zone-wide settings, database/Clerk, other sites, OpenSky quota use.

## 4. Proposed small fixes (separate approval)
- Manifest MIME: add `AddType application/manifest+json .webmanifest` to the project's own `public/.htaccess` (origin-side, affects only this subdomain). Inspect the current file first; do not overwrite.
- DONE 24 Oct 2026 (Skyhook): SSL strict confirmed; a hostname-scoped respect-origin Cache Rule replaced the zone-wide change. Original note: confirm SSL mode Full (strict) and Browser Cache TTL "Respect Existing Headers" in the dashboard (zone-wide, your call); note the headers now look right for sw.js and index.html.
- `trust_cf_connecting_ip` stays false until Cloudflare IP ranges are verified (shared 30/min rate bucket remains).

## 5. Questions that block Stage B
1. GitHub owner and repository: `gsakinz/flightdeck`, private? (Your domain is spelled gakinz.com but the authenticated GitHub login is gsakinz — please confirm that is the intended account.)
2. Keep or delete the probe page after verification? (Default: delete only that file.)
3. FTP password route (a) or (b) above.
4. Cloudflare: may I use a scoped read-only API token, or will you check SSL mode and Browser Cache TTL in the dashboard?
5. GitHub plan (Free/Pro) for environment availability and Actions minutes; the CLI token lacks the `user` scope. Authorize `gh auth refresh -s user`, or tell me the plan.
6. Git commit identity for the first commit (name and email).

## 6. Rollback
Nothing external has changed yet. Later: remove the probe file only by its exact name; revoke the FTP account and secrets only on request; restore from the private backup, never delete a home directory or unrelated DNS.

## Update 24 Oct 2026 (Skyhook)
The production release workflow and the restricted private PHP release path were built and ran successfully (run 40078631011). Details: docs/DEPLOYMENT.md, Production release. Items above that say Cloudflare is unverifiable or the release workflow is not built are superseded.
