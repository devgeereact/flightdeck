#!/bin/bash
# Interactive, local-only setup. Run as your normal macOS user; sudo prompts only for approved OS changes.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ "$(uname -s)" != Darwin ]; then
  echo 'This one-time helper is for macOS.' >&2
  exit 1
fi
if ! command -v mkcert >/dev/null 2>&1; then
  echo 'Install mkcert with: brew install mkcert' >&2
  exit 1
fi
mkdir -p .local-live
chmod 700 .local-live
mkcert -install
mkcert -cert-file .local-live/cert.pem -key-file .local-live/key.pem local.flightdeck.gakinz.com
chmod 600 .local-live/key.pem
if ! awk '$1=="127.0.0.1" {for(i=2;i<=NF;i++)if($i=="local.flightdeck.gakinz.com")found=1} END{exit !found}' /etc/hosts; then
  printf '\n127.0.0.1 local.flightdeck.gakinz.com # Flightdeck local account preview\n' | sudo tee -a /etc/hosts >/dev/null
fi
printf '\nSetup complete. Starting the local account preview.\n'
exec pnpm dev:live-account
