#!/usr/bin/env bash
# Turns on the "Latest from the web" links (Bright Data SERP API) on the live server.
# Run it yourself, in Terminal, from the project folder:   bash scripts/set-bright-data.sh
#
# What it does: asks for your Bright Data zone name and API token (the token is typed hidden), sends them over your
# existing SSH login to the server, and sets brightdata_key and brightdata_zone in ~/flightdeck-private/config.php.
# The server keeps a backup (config.php.bak-<time>, mode 600) and the new file must pass `php -l` first.
# The token is never printed, never put on a command line and never written anywhere else. Nothing is committed.
# Afterwards https://flightdeck.gakinz.com/api/config should report "webCheck":true.
# Caps stay as set in config.php (default 150 searches a day overall, 20 per signed-in user). Each search costs money.
#
# SSH host: the same alias release.json uses ("cpanel"). Override with FLIGHTDECK_SSH_HOST=other-alias.
set -euo pipefail
cd "$(dirname "$0")/.."

HOST="${FLIGHTDECK_SSH_HOST:-cpanel}"
PATCH="scripts/lib/config-patch.php"
[ -f "$PATCH" ] || { echo "Cannot find $PATCH. Run this from the Flightdeck project."; exit 1; }

echo "Bright Data: zone name (the SERP API zone, e.g. serp_api1):"
read -r ZONE
echo "Bright Data: API token (typing is hidden):"
read -r -s KEY
echo

# Same rules as the program on the server, checked here first so a typo fails before anything is sent.
[[ "$ZONE" =~ ^[A-Za-z0-9_-]{1,64}$ ]] || { echo "The zone name may only contain letters, digits, - and _."; exit 1; }
[[ "$KEY" =~ ^[A-Za-z0-9._~+/=:-]{16,255}$ ]] || { echo "The token looks wrong (16 to 255 plain characters, no spaces or quotes)."; exit 1; }

echo "Sending to $HOST ..."
CODE="$(tail -n +2 "$PATCH" | base64 | tr -d '\n')"
# The secret travels on stdin only. printf is a shell builtin, so it never shows up in a process list.
printf '{"brightdata_key":"%s","brightdata_zone":"%s"}' "$KEY" "$ZONE" \
  | ssh "$HOST" "php -r 'eval(base64_decode(\"$CODE\"));' -- \"\$HOME/flightdeck-private/config.php\""
unset KEY

echo
echo "Checking the live site (can take a few seconds to take effect) ..."
for i in 1 2 3 4 5; do
  sleep 3
  if curl -fsS "https://flightdeck.gakinz.com/api/config?cb=$RANDOM" | grep -q '"webCheck":true'; then
    echo "Done: the live site now reports webCheck:true."
    exit 0
  fi
done
echo "The server file was changed, but /api/config does not report webCheck:true yet."
echo "Wait a minute and run:  curl -s https://flightdeck.gakinz.com/api/config"
echo "To undo, copy the newest ~/flightdeck-private/config.php.bak-* back over config.php on the server."
exit 1
