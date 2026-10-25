# Release plan: rebrand, public website and CMS

Status: PREPARED, NOT APPROVED, NOT RELEASED. Written 25 October 2026. Every step marked **(approval)** needs the owner's explicit go-ahead for that step. Nothing here has been run against the server.

What ships: commits `df91923..HEAD` on `main` (see `git log 731dae7..main`). Live today: 731dae7.

## 0. Local gate (done 25 Oct 2026, repeat on the final commit)

`pnpm build` · `pnpm test` (106) · `pnpm test:php` · `pnpm test:ui` (47) · `pnpm test:console` (16) · `bash scripts/check-apache-routes.sh` (22) · owner looks at the site and console locally (`pnpm dev`, then http://127.0.0.1:5173/ for the site and /app/ for the app).

## 1. Read-only server checks **(approval: SSH read-only)**

1. PHP for the web: Owner console -> System shows the live PHP version (8.4.27 recorded on 24 Oct). GD: `php -m | grep -i '^gd$'` with the same PHP version cPanel uses for the site (for example `/opt/cpanel/ea-php84/root/usr/bin/php -m`). Without GD the site still works; only branding uploads are switched off.
2. Backup scope: `cat ~/flightdeck-backup.sh`. It must include `var/content` and `var/health` (it is meant to skip only `cache` and `rate`).
3. Free space for the pinned backup: `du -sh ~/flightdeck-private ~/flightdeck.gakinz.com`.

## 2. Pinned pre-release backup **(approval: creates one file on the server and downloads a copy)**

```
umask 077; ts=$(date +%Y%m%d-%H%M)
tar -czf ~/flightdeck-backups/pinned-pre-rebrand-$ts.tar.gz -C ~ flightdeck-private/config.php flightdeck-private/var flightdeck.gakinz.com/.htaccess flightdeck.gakinz.com/index.html
sha256sum ~/flightdeck-backups/pinned-pre-rebrand-$ts.tar.gz
```
Download it (scp/SFTP) to `~/repo-backups/` on the Mac and compare the checksum. This copy is pinned: the 14-day rotation must not delete it. If step 1.2 showed `var/content` missing from the nightly script, add it **(approval: edits ~/flightdeck-backup.sh; back it up first)**.

## 3. Release **(approval)**

1. Push `main` to GitHub (normal push, no force).
2. The owner pushes `production` (`git push origin main:production`). The workflow tests and builds, rsyncs `php/private/src` (site code and CMS seed arrive first), then uploads `dist/` additively: assets, `app/`, site CSS/JS, `site-build.json`, `site.php`, and `.htaccess` last (it switches the routing).
3. The workflow's own checks: `/api/config`, manifest type, `/` has the lookup form, `/guides/` renders, `/app/` is the app shell.

## 4. After the release (owner and assistant, on the live site)

- `/`, `/how-it-works/`, `/coverage/`, `/help/`, `/accessibility/`, three guides, `/privacy/`, `/contact/` (send a test message), `/travel-checklist/`, `/sitemap.xml`, `/robots.txt`, a missing page (branded 404).
- Old links: `/#/flight/BA117/<date>` forwards to `/app/#/flight/...`; an installed home-screen app still opens and updates (phone).
- `/app/`: sign in, look up a flight, saved flights, packing list, sign out (lands on the home page).
- Console: open Pages, edit About, preview, publish, check the live page, restore the earlier version, publish again. Create a test announcement for "Both", check site and app, delete it. Inbox, Provider health, Audit log.
- `/api/me` without a token is 401; a non-owner account sees "This area is for the site owner".
- If `/robots.txt` or `/sitemap.xml` still show the old version, purge just those two URLs in Cloudflare (no zone purge).

## 5. Clean-up of stale static files **(approval, separately, after step 4 passes)**

The release does not delete anything. `.htaccess` bypasses these, so they are harmless, but they are dead weight. Exact list, all in `~/flightdeck.gakinz.com/` (from the 731dae7 build):
`about/index.html`, `contact/index.html`, `cookies/index.html`, `privacy/index.html`, `terms/index.html`, `travel-checklist/index.html`, `guides/index.html`, and `guides/<slug>/index.html` for the 11 guides (baggage-reclaim-and-missing-bags, cabin-bag-or-hold-bag, connecting-flights-and-missed-connections, departure-day-airport-timeline, flight-numbers-airline-codes-and-codeshares, flight-status-explained, how-to-read-an-airport-departure-board, outbound-and-inbound-flights, pack-your-cabin-bag-for-a-long-flight, what-flight-tracking-can-and-cannot-tell-you, what-to-do-if-your-flight-is-delayed-or-cancelled), `404.html`, `page.js`, `js/contact.js`, `js/travel-checklist.js`, `sitemap.xml`, and the old root `index.html` (only after confirming the new release works, since rollback re-uploads it anyway). Then the empty folders. Old hashed files in `assets/` can stay (a later tidy-up, if wanted).

## 6. Rollback

Fast, content only: move `~/flightdeck-private/var/content/published.json` aside (the site shows the seed).

Full code rollback: on `production`, `git revert --no-edit 731dae7..<released commit>` (or revert the merge), push normally. The workflow re-uploads the 731dae7 build: the old root `index.html`, the old `.htaccess` (routes `/` to the React app again) and the old static pages. The private rsync restores the old PHP files; the new ones (Cms.php, Content/, Site/, site-bootstrap.php) stay but are unused, and so does `var/content`. No user data changes in either direction. If the workflow itself fails, restore from the pinned backup of step 2 (`.htaccess` and `index.html` back into the public root) and re-run the release of 731dae7 manually from the Actions tab.

## 7. Known limits going into the release

- Not tested on LiteSpeed itself: the same `.htaccess` was tested under Apache 2.4 (22 checks). LiteSpeed reads Apache rewrite rules; check step 4 carefully.
- New PHP files linted and tested with PHP 8.5 locally; no syntax newer than 8.4 is used, and the live code already relies on mbstring.
- Branding uploads depend on GD (step 1).
- Not tested on a real phone: installed-app forwarding from `/` to `/app/`.
