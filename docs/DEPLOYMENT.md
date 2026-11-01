# Flightdeck deployment

Reviewed 1 November 2026. Status: LIVE at https://flightdeck.gakinz.com.

## How a release happens
- Every push to `main` runs `.github/workflows/deploy.yml` (owner decision, 30 Oct 2026). It installs, runs the checks and build, then `scripts/release.mjs --go` over SSH. Pushes that only touch `docs/`, `*.md` or `.agent/`, and commits with `[skip ci]`, do not deploy. Manual run: `gh workflow run deploy.yml`.
- `release.json` lists the parts: `php/private/src` → `~/flightdeck-private/src`, then `dist/` → `~/flightdeck.gakinz.com`, with `.htaccess` last. `config.php` is never uploaded.
- Every changed server file is snapshotted to `~/backups/flightdeck/releases/` first. Smoke checks: `/`, `/app/`, `/api/config`. A failed check restores the snapshot automatically.
- From the Mac: `pnpm release` (dry run), `pnpm release --go`, undo with `pnpm release --rollback --go`.
- GitHub secrets (names only): `CPANEL_SSH_KEY`, `CPANEL_KNOWN_HOSTS`. Front-end build variable: `VITE_CLERK_PUBLISHABLE_KEY` (public `pk_live`).

## Hosting
- Namecheap shared cPanel (account `devgeereact`, server premium17.web-hosting.com), PHP 8.4. Public root `~/flightdeck.gakinz.com`; private code, config and data in `~/flightdeck-private` (outside every webroot).
- Cloudflare proxies the hostname with SSL Full (strict). Host-scoped rules: browser cache respects origin headers, `/assets/*` cached for a year (2xx only), email obfuscation off. Nothing zone-wide was changed for Flightdeck.
- Private server config: `~/flightdeck-private/config.php` (mode 600), created from `php/private/config.example.php`. Never edit server files by hand outside this file; everything else ships through a release.

## Optional paid features (off until the owner adds keys)
- AeroDataBox (`aerodatabox_key`): schedules, gates, terminals, belts. Monthly and hourly caps in config.
- Bright Data (`brightdata_key`, `brightdata_zone`, `brightdata_daily_cap`): "Latest from the web" links on a flight while the gate is unknown. Costs per search; cached 15 minutes per flight; capped per day.

## Retired
FTPS uploads, the `production` branch, `release.yml`, `release-static.py`, the hosting probe and the manual staging script (all in git history; evidence in docs/AUDIT.md).
