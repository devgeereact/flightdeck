# Flightdeck

Personal flight tracker at [flightdeck.gakinz.com](https://flightdeck.gakinz.com): flight status, gates, boarding and runway times, the weather and a travel guide for where you are going, and a packing list you can reuse.

- **Public website** (server-rendered PHP, content from the owner console): home with flight look-up, travel guides, help, packing list, about.
- **App** at `/app/` (React 19 + TypeScript + Vite PWA, Clerk sign-in): tracker, flight page, saved flights, packing room.
- **Owner console** at `/app/#/admin`: pages, guides, FAQ, menus, announcements, inbox, usage, provider health, site settings.
- **API** (PHP 8.4, file store, no database): `public/api/index.php` → `php/private/src`. Data from AeroDataBox, OpenSky Network, adsbdb, Open-Meteo, Wikivoyage/Wikipedia, and optionally Bright Data search links with gate, terminal, belt and boarding facts that Claude reads from them and the server checks (ADR-025).

## Run locally

```sh
pnpm install
pnpm dev            # PHP API on 127.0.0.1:3001 + Vite on 127.0.0.1:5173 (Ctrl+C stops both)
pnpm check          # the gate CI runs: Biome, types, unit tests, PHP tests, build
pnpm test:ui        # app page checks (jsdom, fixtures)
pnpm test:console   # owner console checks
pnpm format         # format and safe lint fixes
```

`pnpm dev:live-account` previews with your real Clerk account (see [docs/LOCAL-LIVE-LOGIN.md](docs/LOCAL-LIVE-LOGIN.md)). Node is pinned in `.node-version`.

## Release

A push to `main` runs `.github/workflows/deploy.yml`, which builds and uploads over SSH with `scripts/release.mjs` (snapshot, switch, smoke test, automatic restore on failure). Pushes that only touch docs, or commits with `[skip ci]`, do not deploy. Details: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Documentation

Start with [docs/INDEX.md](docs/INDEX.md). Agents read [AGENTS.md](AGENTS.md), then `.agent/PROJECT.yml` and `.agent/CURRENT-TASK.md`.

Secrets never go in the repo: server keys live in the private `config.php` outside the webroot (template: `php/private/config.example.php`); anything `VITE_*` is public.
