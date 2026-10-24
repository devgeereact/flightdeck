# Flightdeck architecture

## CURRENT — implemented
React 19 + strict TypeScript + Vite frontend. Express 5 API in server/index.ts, executed through tsx. Shared contracts in src/types.ts. In-memory caches and per-IP limiter; browser-local saved flights. No Clerk, PHP, database, queue, paid deployment service or account system is implemented.

```text
Browser React → /api/config, /api/flights, /api/weather
             → Express → sample adapter OR OpenSky (client credentials required)
                       → Open-Meteo current weather
Browser localStorage → saved search inputs
```

Vite dev port 5173 proxies /api to loopback 3001. Production local preview serves dist through Express. Current pnpm build checks all TypeScript and builds frontend only; it does not emit a PHP API or compiled production server. pnpm start needs tsx, currently a dev dependency. Paths to dist assume the project working directory. These facts prevent a blind “upload dist and everything works” deployment.

## Source map
src/main.tsx: app state, search/refresh, presentational components and effects. src/style.css: responsive CSS. src/destinations.ts: curated guides. src/types.ts: contracts. server/flight.ts: normalisation/validation/samples. server/index.ts: upstream requests/cache/rate limiting/HTTP/static serving. server/flight.test.ts: four domain tests. public/icon.svg, vite.config.ts: PWA resources/config. .vscode and mise.toml: workspace tasks/runtime pins.

## PHP API — IMPLEMENTED LOCALLY 24 Oct 2026 (approved; not deployed or cPanel-tested)
public/api/index.php is the only public PHP file; it loads php/private/src/bootstrap.php from a private folder outside the webroot (FLIGHTDECK_PRIVATE, default ../flightdeck-private next to the docroot). Config comes from private config.php or environment. Cache, OpenSky token, shared snapshot and rate-limit counters are files under private var/ (0600). Contracts match the Node reference except the two intentional differences in MIGRATION-PHP.md. See docs/MIGRATION-PHP.md for evidence.

## TARGET — hosting shape
Static React/PWA frontend on a dedicated cPanel document root (flightdeck.gakinz.com). PHP backend and private configuration outside every webroot, with a public API entrypoint and equivalent contracts. No mandatory hosted Node runtime. MariaDB only if shared persistent features are later approved; Clerk only if accounts are needed. Cloudflare DNS/HTTPS and low-minutes deliberate GitHub FTPS releases after target confirmation.

## Migration boundary
Preserve Node prototype as reference. Inventory current endpoints and fixtures, add contract tests, approve PHP parity scope, implement PHP provider/weather/cache/validation adapters, compare sample/live/unavailable behaviour, test cPanel PHP/extensions/private layout, and switch routing only after acceptance and rollback. Do not claim a PHP migration exists or change app behaviour through docs. See MIGRATION-PHP.md.

## Risks
OpenSky state vectors are checked by a light guard (isState) only; deeper runtime schema validation is still needed; explicit any remains in adapters/frontend weather. Main component is large and warrants scoped extraction later. Cache/rate maps are process-local; limiter map has no expiry eviction of old IP entries. Airport timezone fallback uses UTC when absent. Hosting process exhaustion was observed despite successful SSH. No live deployment or end-to-end provider test is proven.
