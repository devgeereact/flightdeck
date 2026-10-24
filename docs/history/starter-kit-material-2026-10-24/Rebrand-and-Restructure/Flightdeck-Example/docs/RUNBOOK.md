# Flightdeck local operation and troubleshooting

From the project root use pnpm dev for Vite 5173 plus API 3001; pnpm test for domain tests; pnpm build for frontend production assets; pnpm start for local Express production preview on 127.0.0.1:3001. Stop the owned process before starting another on the same port. Do not kill arbitrary processes just because a port is busy.

If live flights report 503: no server-side key is configured; sample mode is available. Do not fake live data or expose keys in React. If weather fails: confirm backend/network/coordinates, retry within rate limits and show unavailable/stale honestly. No successful weather response guarantees the provider will always be available.

If app UI is old: distinguish running dev versus built preview and service-worker/HTML caching. Review update registration before deleting user storage. Saved flights are browser-local; clearing storage removes them. There is no server recovery of saved searches.

If VS Code SSH fails with fork/resource errors: Terminal authentication can still succeed; ask Namecheap to inspect process limits. Do not repeatedly start VS Code Server or terminate website processes without scope/backup. FTPS deployment is independent but still requires login/upload verification.

Production runbook remains incomplete until target architecture/domain/config and authorised deployment are implemented. Private source backup record: docs/PROJECT-MEMORY. For secret rotation, use provider/cPanel secure controls and verify the app afterwards, never paste keys into docs/logs.
