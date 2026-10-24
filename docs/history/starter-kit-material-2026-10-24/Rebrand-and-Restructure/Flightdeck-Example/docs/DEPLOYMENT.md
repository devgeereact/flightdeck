# Flightdeck deployment status and runbook

Status: NOT DEPLOYED. No selected public URL, document root, GitHub repo, release workflow or dedicated FTP account is confirmed. No deployment occurs in this task.

## Verified host evidence (23 October)
Namecheap StellarPlus18; account devgeereact; premium17.web-hosting.com → 185.61.152.45. SSH port 21098 accepts key authentication. Explicit FTPS port 21 TLS handshake/certificate verified; FTP credentials/write tests not performed. cPanel feature list reports Node selector and Passenger enabled, but an app was not created/tested. VS Code Server failed with server process exhaustion. Feature availability is not runtime proof.

## Chosen direction, pending migration approval
User's new default is static React + PHP on cPanel. Existing Flightdeck is still Node/Express. Before release implement/test PHP parity (MIGRATION-PHP). Uploading current dist alone breaks /api/weather and /api/flights; current pnpm start also needs tsx and local working-directory assumptions. Do not deploy either blindly.

## Target discovery
Inspect existing project config, cPanel Domains and authorised DNS connections; if none clearly assigned, ask the user for a subdomain. Verify account/zone/document root, DNS/valid origin certificate/Cloudflare Full(strict). Never repurpose another site or alter mail/DNSSEC. No Cloudflare account/zone access has been verified here.

## Layout and secrets
Separate public static root and intended PHP API entrypoint from private backend source/vendor/config and rollback backups. Choose precise paths only after domain mapping. Runtime secrets stay in private server config, not GitHub build or browser VITE_ variables. No DB/auth is needed until approved requirements demand it. If added, cPanel restricted MariaDB identities and backend Clerk verification must be tested.

## Delivery
Prefer reviewed encrypted FTPS to premium17.web-hosting.com:21 using a site-restricted account, because shared-host SSH is unstable. FTPS must use origin hostname, not Cloudflare's proxied web hostname. Credentials go directly into GitHub Actions secrets via secure tooling; never chat or repository. Verify FTP account root with a scoped harmless test before uploads.

Release branch is a deliberate production branch by preference, but no actual repo/branch exists yet. Use one Linux job, lockfile cache, path filters, serial releases, no scheduled deploys, no overlap/mid-upload cancellation. Preserve server config/uploads/unrelated files. Run controlled migrations/restart steps only if needed; file transfer alone does not execute them. Do not require Node runtime on cPanel for the PHP target.

## Acceptance and rollback
Back up existing target privately; deploy staging first; test HTTPS/home/deep links/API/missing-key/stale/weather/source attribution, then PWA repeat visit and release update. Verify restored prior release too. Do not call automatic deployment working until a real approved workflow ran and public checks succeeded. No such run has occurred.
