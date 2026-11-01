# Flightdeck runbook

Reviewed 1 November 2026.

## Local
- `pnpm dev`: PHP API on 127.0.0.1:3001 and Vite on 127.0.0.1:5173 (Ctrl+C stops both). Stop the process you started before starting another on the same port; never kill unknown processes.
- `pnpm dev:live-account`: local preview signed in with your real Clerk account (docs/LOCAL-LIVE-LOGIN.md).
- App looks old? Check whether you are on Vite (5173) or a built preview, and whether the service worker is serving an older build. Do not clear user storage to fix it: saved flights and packing lists live in the browser (packing lists also sync to the account).

## Releasing and undoing
See docs/DEPLOYMENT.md. Watch a run with `gh run watch`. Undo the last release with `pnpm release --rollback --go`. If a header or manifest looks stale after a fix, purge that single URL in Cloudflare, never the whole zone.

## Providers
- Owner console → Operations → Provider health shows when each source last answered and why it failed: AeroDataBox, OpenSky, adsbdb, Open-Meteo, Wikimedia (travel guides), Bright Data (if on).
- Flights 503 / "not available": the provider key is missing or the monthly allowance is used. Never fake live data.
- Weather or travel guide missing: the page says so; the next view tries again (weather cached 10 minutes, guides a week, misses a day).

## Website and CMS
- Edit: Owner console → Content (docs/CMS.md). Nothing goes live until Publish. Undo: History → Restore to draft → Publish.
- Wrong content everywhere: move `~/flightdeck-private/var/content/published.json` aside; the site falls back to the built-in seed. Put it back to undo.
- Site shows "briefly unavailable" (503): check `~/flightdeck-private/src/site-bootstrap.php` exists and the PHP error log (`flightdeck site: <class> at <file>:<line>`).
- Maintenance: Site settings → Visibility → Maintenance shows a 503 "Back soon" page on public pages; app, console and API keep working.

## Backups and restore
- Nightly cron runs `~/flightdeck-backup.sh` → `~/flightdeck-backups/flightdeck-var-YYYYMMDD.tar.gz` (checklists, enquiries, metrics, content, health; caches skipped), mode 600, 14 days. Same disk, so copy off-server periodically.
- Restore: copy the current `var/` aside, then `tar -xzf <file> -C ~/flightdeck-private`.
- Release snapshots: `~/backups/flightdeck/releases/`.

## Monitoring
`.github/workflows/uptime.yml` runs every 6 hours: `/` 200, `/api/config` live, `/api/me` 401 without a token. Failures email the repository owner.

## Email replies from the console
"Reply by email" sends from `mail_from` with Reply-To `owner_email`, through PHP mail() or the SMTP settings in config.php (`smtp_host`, `smtp_port`, `smtp_secure`, `smtp_user`, `smtp_pass`). Local test: `node test/fake-smtp.mjs` with `SMTP_HOST=127.0.0.1 SMTP_PORT=2525 SMTP_SECURE=none`.

## Secrets
Rotate in the provider's dashboard, update `config.php` on the server (or the GitHub secret), then check the app. Never paste keys into docs, logs or chat.
