# Flightdeck deployment

Reviewed 1 November 2026. Status: LIVE at https://flightdeck.gakinz.com.

## How a release happens
- Every push to `main` runs `.github/workflows/deploy.yml` (owner decision, 30 Oct 2026; gated 8 Nov 2026, ADR-023). Its `check` job calls `ci.yml` (Biome, types, unit and PHP tests, build, UI and console smoke tests, `php -l`, gitleaks) and its `deploy` job needs `check`, so a red gate never deploys. Then `scripts/release.mjs --go` runs over SSH. Pull requests run `ci.yml` only and cannot deploy. Pushes that only touch `docs/`, `*.md` or `.agent/`, and commits with `[skip ci]`, do not deploy. Manual run: `gh workflow run deploy.yml` (runs the same gate; deploys only from `main`).
- `release.json` lists the parts: `php/private/src` → `~/flightdeck-private/src`, then `dist/` → `~/flightdeck.gakinz.com`, with `.htaccess` last. `config.php` is never uploaded.
- Every changed server file is snapshotted to `~/backups/flightdeck/releases/` first. Smoke checks (`release.json`): `/` and `/app/` and `/sitemap.xml` answer 200 with their expected content; `/api/config` answers 200 and reports `signInRequired: true`; an anonymous `/api/weather` answers 401 (a 503 means the server has no valid Clerk issuer). A failed check restores the snapshot automatically.
- From the Mac: `pnpm release` (dry run), `pnpm release --go`, undo with `pnpm release --rollback --go`.
- GitHub secrets (names only): `CPANEL_SSH_KEY`, `CPANEL_KNOWN_HOSTS`. Front-end build variable: `VITE_CLERK_PUBLISHABLE_KEY` (public `pk_live`).

## Hosting
- Namecheap shared cPanel (account `devgeereact`, server premium17.web-hosting.com), PHP 8.4. Public root `~/flightdeck.gakinz.com`; private code, config and data in `~/flightdeck-private` (outside every webroot).
- Cloudflare proxies the hostname with SSL Full (strict). Host-scoped rules: browser cache respects origin headers, `/assets/*` cached for a year (2xx only), email obfuscation off. Nothing zone-wide was changed for Flightdeck.
- Private server config: `~/flightdeck-private/config.php` (mode 600), created from `php/private/config.example.php`. Never edit server files by hand outside this file; everything else ships through a release.

## Optional paid features (off until the owner adds keys)
- AeroDataBox (`aerodatabox_key`): schedules, gates, terminals, belts. Monthly, hourly and per-user hourly caps in config.
- Bright Data (`brightdata_key`, `brightdata_zone`, `brightdata_daily_cap` default 200, optional `brightdata_user_daily_cap` default 40): "Latest from the web" links on a flight while something is still missing. Costs per search; cached 10 minutes per flight; capped per day.
- Anthropic (`anthropic_key`, optional `anthropic_model` default `claude-sonnet-5-5`, `anthropic_daily_cap` default 150, `web_facts` set to `false` to switch it off): reads the Bright Data results into gate, terminal, belt and boarding-time facts, checked by code and labelled "From the web" (ADR-025). Needs Bright Data. Costs per call; the same results are never sent twice. Set the key with `bash scripts/set-anthropic-key.sh`.

## Retired
FTPS uploads, the `production` branch, `release.yml`, `release-static.py`, the hosting probe and the manual staging script (all in git history; evidence in docs/AUDIT.md).
