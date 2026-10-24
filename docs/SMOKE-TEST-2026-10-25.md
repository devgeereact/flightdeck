# Smoke test, 25 October 2026

Scope: the live site (https://flightdeck.gakinz.com at commit 12e0b15), the owner's signed-in session in Chrome, the local build and test suites, the server (read-only checks), and DNS. One live flight search (BA59) was run; it used cached data (769 ms). Nothing was changed on production by the test.

Status key: **Fixed** = fixed in code during this test (needs a release), **To do** = I can do it, **Owner** = needs you.

## What passed

| Area | Result |
|---|---|
| Pages | All 15 public pages, sitemap, robots, manifest, service worker, icons and the share image return 200 with the right content type. `/nope` and `/ads.txt` return a real 404. |
| Links | 19 internal links and 8 external links checked: no broken links (one false alarm, see item 12). Slash-less URLs redirect once to the slash version. HTTP redirects to HTTPS. |
| Headers | HSTS, enforced CSP, X-Frame-Options, Permissions-Policy, nosniff and referrer policy are all present. |
| TLS | Valid until 17 Dec 2026 (Cloudflare renews it). |
| API | Unsigned requests get 401. Wrong methods get 405. Bad contact input gets 422 or 413. Unknown routes get 404. Valid event gets 200. |
| Live search | BA59: card, seven journey steps in the right order, all five tabs render, weather loads. Summary, direction and times read correctly. |
| Signed-in routes | Tracker, Saved flights, Packing list and Owner console all load with the right top-bar label and one h1. All seven console tabs load with no error. |
| Speed (warm) | First paint 0.35 s, first contentful paint and largest paint 1.08 s, load 0.6 s, 26 requests. Main script 143 KB (brotli), stylesheet 11 KB. |
| Code | 71 Node tests, the PHP suite and the UI smoke suite pass. PHP lints clean. No secrets in tracked files (one match is a harmless string check in GoogleAnalytics.php). `.env` and `config.php` are not tracked. |
| Server | PHP 8.4.27, 960 KB of data, plenty of disk, backup script and cron entry in place. |

## Findings

### P1: do soon

1. **Email may land in spam (Owner).** `flightdeck.gakinz.com` has an SPF record but no DKIM key and no DMARC record. Replies and enquiry notifications go out as `noreply@flightdeck.gakinz.com`. Fix: in cPanel, open Email Deliverability and turn on DKIM; add a DMARC record (`_dmarc`, `v=DMARC1; p=none; rua=mailto:info@flightdeck.gakinz.com`); change `mail_from` to `info@flightdeck.gakinz.com`. I can do the `mail_from` part. The DNS part is yours (or give me Cloudflare access).
2. **The hourly uptime check has not run on its own yet (To do, verify).** Only the manual test run exists. Scheduled GitHub runs can start late. Check again in a few hours; if nothing, I will look at why.
3. **Backup not confirmed yet (To do, verify).** The only archive is my manual test. The first scheduled run is due at 02:23 server time. Backups are on the same disk, so a copy off the server is still missing (Owner: periodic download or a cPanel backup).

### P2: should fix

4. **Landing page is empty for crawlers (To do).** `/` is 1.4 KB of HTML with no text, so search engines and AdSense reviewers see a blank page until JavaScript runs. Put the headline, description and links into the static HTML.
5. **Web app install quality (To do).** The manifest has only an SVG icon. There is no PNG 192/512 icon, no maskable icon, no `apple-touch-icon`, and no favicon link in the app's `index.html`. The manifest description still talks about "destination inspiration". The Install button falls back to a browser `alert()` where install is not offered.
6. **Tracker is still two screens tall with a flight showing (To do).** About 1,800 px of page for a 900 px window. The full footer is the main extra height; use a one-line footer inside the app.
7. **High-severity dependency (To do).** `pnpm audit` reports `body-parser` (via `express`). Express only runs the local development server, not production, but it should be upgraded or moved to dev dependencies.
8. **Tests depend on live data (To do).** The UI smoke test calls the real flight providers, so it can fail in the evening when a flight is airborne (it did, once). Use recorded responses for the flight checks, and add UI tests for the console reply form, the in-app footer and the landing page.
9. **Console warnings (Fixed).** The signed-in app logged about 24 "GSAP target not found" warnings per visit. Animations now skip empty selections.
10. **Accessibility (Fixed).** No h1 on the tracker once a flight shows; low-contrast text in the flight card and destination tab; skipped heading levels in the console. All fixed; axe now reports no issues on any app view.

### P3: tidy up

11. `/404.html` itself returns 200 (it has `noindex`, so harmless).
12. Cloudflare email obfuscation turns the `mailto:` link into `/cdn-cgi/l/email-protection` for bots, which 404s in a link crawl. Turn off Email Address Obfuscation for this host (Owner, Cloudflare).
13. Hashed JavaScript has no long cache header at Cloudflare (CSS and fonts get 7 days). Add an edge cache rule for `/assets/*` (Owner, Cloudflare).
14. Three guide titles are longer than 70 characters and will be cut off in search results.
15. A real Google Analytics check after someone accepts cookies has not been done (the numbers read zero until then).

### Waiting on you

16. Check the phone layout (packing list, flight search) on a real phone.
17. AdSense: licence decisions (AeroDataBox, OpenSky), a certified consent tool and a publisher id.
18. Phase 8 needs an Anthropic key.
19. A second admin needs that person's Clerk user id.
20. Optional: mailbox password if you want replies sent through your own SMTP rather than the server's mail.
