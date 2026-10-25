# Flightdeck local operation and troubleshooting

From the project root use pnpm dev for Vite 5173 plus API 3001; pnpm test for domain tests; pnpm build for frontend production assets; pnpm start for local Express production preview on 127.0.0.1:3001. Stop the owned process before starting another on the same port. Do not kill arbitrary processes just because a port is busy.

If live flights report 503: no server-side key is configured; sample mode is available. Do not fake live data or expose keys in React. If weather fails: confirm backend/network/coordinates, retry within rate limits and show unavailable/stale honestly. No successful weather response guarantees the provider will always be available.

If app UI is old: distinguish running dev versus built preview and service-worker/HTML caching. Review update registration before deleting user storage. Saved flights are browser-local; clearing storage removes them. There is no server recovery of saved searches.

If VS Code SSH fails with fork/resource errors: Terminal authentication can still succeed; ask Namecheap to inspect process limits. Do not repeatedly start VS Code Server or terminate website processes without scope/backup. FTPS deployment is independent but still requires login/upload verification.

Production runbook remains incomplete until target architecture/domain/config and authorised deployment are implemented. Private source backup record: docs/PROJECT-MEMORY. For secret rotation, use provider/cPanel secure controls and verify the app afterwards, never paste keys into docs/logs.

## Releasing to production (added by Skyhook, 24 Oct 2026)
Push to the `production` branch (or run the "Production release" workflow manually from it). It tests, builds, syncs php/private/src over the restricted key, uploads dist/ additively over FTPS and checks the live site; it never deletes remote files, so removed files must be cleaned up by hand. Watch with `gh run watch`. If a release breaks the site, revert the commit on `production` and push; the previous files are uploaded again. If a manifest or other header looks stale after a fix, purge that single URL in Cloudflare instead of purging everything. Never put secrets in the repository; the config.php on the server is created once and is not touched by releases.

## Backups, monitoring and restore (24 Oct 2026)
- Nightly backup: cron 02:23 runs ~/flightdeck-backup.sh, which writes ~/flightdeck-backups/flightdeck-var-YYYYMMDD.tar.gz (checklists, enquiries, metrics; caches and rate files skipped), mode 600, keeps 14 days. Same server and disk, so it protects against mistakes, not against losing the account; copy the folder off-server (cPanel backup or download) periodically.
- Restore: stop nothing; extract into ~/flightdeck-private (`tar -xzf <file> -C ~/flightdeck-private`) after copying the current var/ aside.
- Uptime: .github/workflows/uptime.yml runs hourly from the default branch (main), checks / (200), /api/config (liveAvailable) and /api/me (401 without a token); a failure emails the repository owner. It only starts once the file is on main.
- GA numbers: verified from the server that the service account loads and the Data API answers (zeros until consented traffic exists).

## Replying to enquiries from the console (SMTP)
The Enquiries tab has "Reply by email". The reply is sent from `mail_from` to the visitor, with `Reply-To` set to `owner_email`, and the enquiry is marked replied only when the mail server accepted it. By default it uses the server's own mail (PHP mail()). To send through a specific mailbox, add to ~/flightdeck-private/config.php: `'smtp_host' => 'mail.flightdeck.gakinz.com', 'smtp_port' => 465, 'smtp_secure' => 'ssl', 'smtp_user' => 'info@flightdeck.gakinz.com', 'smtp_pass' => '<mailbox password>'` (587 with `'tls'` also works). The password stays in that private file (mode 600). Local testing: `node test/fake-smtp.mjs` and start the dev server with SMTP_HOST=127.0.0.1 SMTP_PORT=2525 SMTP_SECURE=none (the "none" mode is refused for any non-loopback host).

## Website and CMS operations (25 Oct 2026, after the rebrand release)

- **Edit the site:** app -> Owner console -> Content (docs/CMS.md). Nothing goes live until Publish.
- **Undo a change:** open the item -> History -> Restore to draft -> Publish.
- **Site shows wrong content everywhere:** move `~/flightdeck-private/var/content/published.json` aside (for example to `published.json.bak-<date>`); the site falls back to the built-in seed at once. Put it back to undo.
- **Site shows "briefly unavailable" (503):** site.php could not load its code or content. Check that `~/flightdeck-private/src/site-bootstrap.php` exists (the release rsyncs it) and the PHP error log (`flightdeck site: <class> at <file>:<line>`).
- **Backups:** the nightly `~/flightdeck-backup.sh` must include `var/content` and `var/health` (confirm before the release; see the release plan).
- **Provider problems:** Owner console -> Operations -> Provider health shows when each source last answered and why it failed (category only).
- **Old static pages on the server:** after the rebrand release the old `about/`, `guides/…`, `privacy/`… folders, `404.html`, `page.js`, `js/contact.js`, `js/travel-checklist.js`, root `index.html` and `sitemap.xml` are bypassed by `.htaccess`. Delete them only with the owner's approval, from the exact list in the release plan.
