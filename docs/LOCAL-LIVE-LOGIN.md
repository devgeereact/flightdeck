# Local preview with your live account

The ordinary localhost build uses the Clerk development instance in `.env.local`. Its users are separate from production. Clerk production keys require a production-domain subdomain, HTTPS and port 443; they cannot authenticate on http://localhost or http://127.0.0.1.

Flightdeck uses `https://local.flightdeck.gakinz.com/app/`, resolved only on this Mac to 127.0.0.1. No public DNS, Clerk domain settings or live server changes are needed for the default subdomain configuration. Clerk documents this troubleshooting technique but does not officially support it: https://clerk.com/docs/guides/development/troubleshooting/using-production-keys-in-development

One-time setup (macOS): install mkcert using Homebrew, install its local CA, and generate a certificate specifically for the local hostname. Keep the CA private; `.local-live/` is ignored. Add only `127.0.0.1 local.flightdeck.gakinz.com` to `/etc/hosts`, preserving other entries.

```sh
brew install mkcert
mkcert -install
mkdir -p .local-live
mkcert -cert-file .local-live/cert.pem -key-file .local-live/key.pem local.flightdeck.gakinz.com
```

For guided setup and startup, run `bash scripts/setup-local-https.sh` from this project in Terminal. Enter the macOS administrator password in Terminal when requested; never put it in chat. After that first setup, start with `pnpm dev:live-account`. The script reads the existing production publishable key from `.env`, overrides the development key only for this build, builds the live-account app into `.local-live/dist/` (ordinary `dist/` stays separate), starts PHP on loopback port 3993 and an HTTPS proxy on loopback port 443. On macOS, the launcher requests administrator authentication for that proxy only, which drops back to your user immediately after binding. The build and PHP process are never run as root. No secret Clerk key is copied into the browser. It rejects other hostnames. Production token signatures, issuer, expiry and the exact local authorised origin are checked by PHP. The proxy does not forward to the live Flightdeck API.

The existing `.env` provider configuration is available to this local PHP process. Local cache, counters, checklists and CMS data are kept under `.local-live/private/var`, apart from the normal local and production stores. Your Clerk profile and saved-flight metadata are real production account data: edits there affect your live account. Login does not copy the live server's checklist/CMS files. Owner access uses the admin IDs already configured in `.env`.

Sign in with the existing live email/password or supported email-code flow. Social-login redirects may require provider configuration; those settings are not changed by this setup. If Clerk has an explicit subdomain allowlist, the owner must authorise this exact hostname. Never bypass TLS warnings. Stop with Ctrl+C. To return to the separate development instance, run `pnpm dev` and use its localhost URL; `.env.local` is unchanged. To remove the setup, stop the server and remove only this hostname's `/etc/hosts` entry. Remove the local CA from trust with `mkcert -uninstall` only if no other local projects use it.

## Verified blank-screen fix, 26 October 2026

The initial launcher wrote its production-key build into normal `dist/`. Visiting http://127.0.0.1:3996/app/ then tried production Clerk on an unsupported plain HTTP origin. The launcher now builds only into `.local-live/dist/`, and the local PHP router serves that folder only for the isolated live-account process. Ordinary PHP preview `/app/` links redirect to the HTTPS local address once that isolated build exists. Explicit `FLIGHTDECK_DIST` test harnesses are exempt. The ordinary Vite development instance remains separate.

The app now has a visible loading/retry screen and an error boundary for auth/chunk failures. In Safari, the same existing production account was confirmed signed in on https://local.flightdeck.gakinz.com/app/ and https://flightdeck.gakinz.com/app/. This verified existing sessions; no password was reset, no sign-out forced, and no production files or Clerk settings changed. Public Clerk configuration accepted both exact origins.
