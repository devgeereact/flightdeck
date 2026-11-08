#!/usr/bin/env bash
# Puts the nightly Flightdeck backup back into the server's crontab (found missing by the 8 Nov 2026 restore drill: no backup
# had been made since 1 Nov). Run it yourself from the project folder:   bash scripts/install-backup-cron.sh
# It adds ONE line (02:23 every night: ~/flightdeck-backup.sh) and leaves every other job alone. A copy of the crontab as it was
# is kept on the server in ~/backups/_crontab-history/. Safe to run twice: it changes nothing if the line is already there.
# SSH host: the alias release.json uses ("cpanel"). Override with FLIGHTDECK_SSH_HOST=other-alias.
set -euo pipefail
HOST="${FLIGHTDECK_SSH_HOST:-cpanel}"
ssh "$HOST" bash -s <<'REMOTE'
set -euo pipefail
cur="$(mktemp)"; new="$(mktemp)"
crontab -l > "$cur" 2>/dev/null || true
if grep -qF 'flightdeck-backup.sh' "$cur"; then
  echo "The nightly backup is already in the crontab, so nothing was changed:"
  grep -F 'flightdeck-backup.sh' "$cur"
  exit 0
fi
[ -x "$HOME/flightdeck-backup.sh" ] || { echo "~/flightdeck-backup.sh is missing or not executable on the server; nothing was changed."; exit 1; }
mkdir -p "$HOME/backups/_crontab-history"
cp "$cur" "$HOME/backups/_crontab-history/crontab-before-$(date +%Y%m%d%H%M%S).txt"
{ cat "$cur"; echo '23 2 * * * $HOME/flightdeck-backup.sh >/dev/null 2>&1'; } > "$new"
crontab "$new"
echo "Installed. The crontab now has these Flightdeck lines:"
crontab -l | grep -F 'flightdeck-backup.sh'
echo "The first backup will be made at 02:23 server time. To make one right now: ssh into the server and run ~/flightdeck-backup.sh"
REMOTE
