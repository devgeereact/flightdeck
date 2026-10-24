#!/usr/bin/env bash
# Flightdeck staging upload to cPanel (SSH alias "cpanel"). Additive only: never uses --delete.
# Prerequisite (done in cPanel -> Domains, or by uapi SubDomain addsubdomain): flightdeck.gakinz.com exists
# with document root ~/flightdeck.gakinz.com. Run from the project root after `pnpm build`.
set -euo pipefail
HOST=cpanel
DOCROOT='~/flightdeck.gakinz.com'
PRIVATE='~/flightdeck-private'

[ -f dist/api/index.php ] && [ -f dist/.htaccess ] || { echo "Run pnpm build first"; exit 1; }
ssh "$HOST" "test -d $DOCROOT" || { echo "Docroot $DOCROOT does not exist: create the subdomain first"; exit 1; }
ssh "$HOST" "mkdir -p $PRIVATE/src && chmod 700 $PRIVATE"

rsync -az -e ssh dist/ "$HOST:flightdeck.gakinz.com/"
rsync -az -e ssh php/private/src/ "$HOST:flightdeck-private/src/"
rsync -az -e ssh php/private/config.example.php "$HOST:flightdeck-private/config.example.php"

# Credentials go straight from the local .env to a 0600 file on the server; nothing is printed.
if ! ssh "$HOST" "test -f $PRIVATE/config.php"; then
  set -a; . ./.env; set +a
  ID="${OPENSKY_CLIENT_ID:-${clientId:-}}"; SECRET="${OPENSKY_CLIENT_SECRET:-${clientSecret:-}}"
  [ -n "$ID" ] && [ -n "$SECRET" ] || { echo "No OpenSky credentials in .env"; exit 1; }
  ID="$ID" SECRET="$SECRET" php -r 'echo "<?php\nreturn ".var_export(["opensky_client_id"=>getenv("ID"),"opensky_client_secret"=>getenv("SECRET"),"trust_cf_connecting_ip"=>false],true).";\n";' \
    | ssh "$HOST" "umask 077; cat > $PRIVATE/config.php"
fi
echo "Uploaded. Smoke test: curl -s https://flightdeck.gakinz.com/api/config"
