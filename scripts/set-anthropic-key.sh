#!/usr/bin/env bash
# Turns on the gate, terminal, belt and boarding-time facts on the live server (Claude reads the "Latest from the web" results; ADR-025).
# Run it yourself, in Terminal, from the project folder:   bash scripts/set-anthropic-key.sh
#
# What it does: asks for your Anthropic API key (typed hidden), sends it over your existing SSH login to the server, and sets
# anthropic_key in ~/flightdeck-private/config.php. The server keeps a backup (config.php.bak-<time>, mode 600) and the new file must
# pass `php -l` first. The key is never printed, never put on a command line and never written anywhere else. Nothing is committed.
# Afterwards https://flightdeck.gakinz.com/api/config should report "webFacts":true (it also needs Bright Data on, which it already is).
# Each Claude call costs money. Defaults: claude-sonnet-5-5, at most 150 calls a day, and identical web results are answered from a
# cache. To turn the facts off again without removing the key, add  'web_facts' => false,  to config.php.
#
# SSH host: the same alias release.json uses ("cpanel"). Override with FLIGHTDECK_SSH_HOST=other-alias.
set -euo pipefail
cd "$(dirname "$0")/.."

HOST="${FLIGHTDECK_SSH_HOST:-cpanel}"
PATCH="scripts/lib/config-patch.php"
[ -f "$PATCH" ] || { echo "Cannot find $PATCH. Run this from the Flightdeck project."; exit 1; }

echo "Anthropic API key (it normally starts with sk-ant-; typing is hidden):"
read -r -s KEY
echo

# Same rule as the program on the server, checked here first so a typo fails before anything is sent.
[[ "$KEY" =~ ^[A-Za-z0-9._~+/=:_-]{20,255}$ ]] || { echo "The key looks wrong (20 to 255 plain characters, no spaces or quotes)."; exit 1; }

echo "Sending to $HOST ..."
CODE="$(tail -n +2 "$PATCH" | base64 | tr -d '\n')"
# The secret travels on stdin only. printf is a shell builtin, so it never shows up in a process list.
printf '{"anthropic_key":"%s"}' "$KEY" \
  | ssh "$HOST" "php -r 'eval(base64_decode(\"$CODE\"));' -- \"\$HOME/flightdeck-private/config.php\""
unset KEY

echo
echo "Checking the live site (can take a few seconds to take effect) ..."
for i in 1 2 3 4 5; do
  sleep 3
  if curl -fsS "https://flightdeck.gakinz.com/api/config?cb=$RANDOM" | grep -q '"webFacts":true'; then
    echo "Done: the live site now reports webFacts:true."
    exit 0
  fi
done
echo "The server file was changed, but /api/config does not report webFacts:true yet."
echo "Wait a minute and run:  curl -s https://flightdeck.gakinz.com/api/config"
echo "(webFacts also needs the Bright Data key and zone; webCheck must be true too.)"
echo "To undo, copy the newest ~/flightdeck-private/config.php.bak-* back over config.php on the server."
exit 1
