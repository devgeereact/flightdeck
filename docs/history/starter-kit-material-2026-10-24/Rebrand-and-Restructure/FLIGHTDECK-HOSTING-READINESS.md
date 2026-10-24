# Flightdeck hosting readiness — 24 October 2026

This is a fresh read-only/source-check report plus prompt preparation. No live configuration, file upload, Git repository, account, secret or workflow was created/changed.

## Current state verified locally

- Existing app path: /Users/realmrgee/Developer/Projects/flightdeck.
- React + TypeScript + Vite/PWA frontend; Express/Node reference API remains.
- PHP API and parity/unit test files now exist; package scripts include test:php and parity.
- pnpm test: PASS, 6 tests.
- pnpm test:php: PASS, 15 checks.
- pnpm build: PASS, TypeScript and Vite/PWA production build. Vite needed sandbox permission for temporary/output files; after that the build completed. Source was not edited.
- No .git repository and no GitHub remote at this project path. .github contains an agent adapter, not Actions deployment workflows.
- Real .env/config credentials were not opened, printed or copied.

## Public evidence checked freshly

Public DNS-over-HTTPS returned Cloudflare A records for flightdeck.gakinz.com (104.21.4.95 and 172.67.153.246). This Mac's normal resolver failed for that hostname while resolving other domains. HTTPS was therefore tested using curl --resolve to a DNS-returned Cloudflare address, preserving the original hostname/SNI and normal TLS certificate verification. This establishes the tested public endpoint, not that every recursive resolver works.

| URL/path | Result | Detail |
|---|---|---|
| https://flightdeck.gakinz.com/ | PASS, 200 | Flightdeck HTML; Cache-Control no-cache |
| /api/config | PASS, 200 | provider OpenSky Network; liveAvailable true; no-store; CF BYPASS |
| /api/flights?number=BA117&date=2026-10-24&mode=demo | PASS, 200 | mode demo; one sample result; no-store |
| /sw.js | PASS, 200 | JavaScript; no-cache |
| /manifest.webmanifest | PARTIAL, 200 | no-cache, but Content-Type application/octet-stream; correct manifest MIME still needs review |

Live OpenSky search was NOT called in this pass, to avoid spending its quota. liveAvailable true is configuration evidence, not proof of every live field. OpenSky positional data does not establish boarding/gates/baggage/schedules. No browser rendering/device/install/update matrix was repeated. PHP/Node HTTP parity was not rerun because it needs controlled local servers.

## Recorded targets requiring authoritative recheck before mutation

Project notes name public root /home/devgeereact/flightdeck.gakinz.com and private PHP root /home/devgeereact/flightdeck-private. These filesystem mappings were not freshly checked via cPanel in this pass. Do not guess or recreate them. Prior origin: premium17.web-hosting.com / 185.61.152.45, explicit FTPS 21, SSH/SFTP 21098. Check account/root/permissions before using.

The existing public site must be preserved. Origin certificate/Cloudflare Full(strict), zone ID/access, exact current DNS configuration, current dedicated FTP accounts, GitHub identity/repo and saved Actions secrets were NOT verified here. Public Cloudflare HTTPS alone does not prove strict origin TLS.

## Documentation inconsistencies

PROJECT.yml and the tail of CURRENT-TASK/DEPLOYMENT report a manual deployment and approved PHP implementation. Earlier paragraphs still say no deployment/PHP proposed; ARCHITECTURE mixes correct PHP detail with stale Node-only claims. The present source/public responses should guide a carefully scoped documentation reconciliation, not a blind template overwrite. Historical statements remain untrusted evidence until checked; they do not grant further deployment permission.

## Next task

Use FLIGHTDECK-START-WITH-HOSTING.md. Reuse the existing app/hostname, verify exact targets, reconcile deployment facts, create/reuse restricted public/private deployment access as necessary, create/connect a confirmed private GitHub repo, add secrets securely, prepare a low-minutes manual test, and verify a unique harmless page deployed through GitHub. That task is not executed by creating its prompt.
