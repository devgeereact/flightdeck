#!/usr/bin/env bash
# Copies the newest server backup of Flightdeck's data (var/: packing lists, enquiries, counters) to this Mac, so there is a
# copy that is not on the same disk as the site. Run it yourself from the project folder:   bash scripts/pull-server-backup.sh
# Destination: ~/Backups/projects/flightdeck/ (override with FLIGHTDECK_BACKUP_DIR=/some/folder). The file is checked with gzip
# and kept mode 600 because it holds personal data (enquiry emails). It only reads from the server. Run it weekly.
# SSH host: the alias release.json uses ("cpanel"). Override with FLIGHTDECK_SSH_HOST=other-alias.
set -euo pipefail
HOST="${FLIGHTDECK_SSH_HOST:-cpanel}"
DEST="${FLIGHTDECK_BACKUP_DIR:-$HOME/Backups/projects/flightdeck}"
mkdir -p "$DEST"; chmod 700 "$DEST"

NEWEST="$(ssh "$HOST" 'ls -1 backups/flightdeck/flightdeck-var-*.tar.gz 2>/dev/null | sort | tail -1')"
[ -n "$NEWEST" ] || { echo "No backup found on the server in ~/backups/flightdeck/."; exit 1; }
NAME="$(basename "$NEWEST")"
echo "Newest on the server: $NAME"
scp -q "$HOST:$NEWEST" "$DEST/$NAME"
chmod 600 "$DEST/$NAME"
gzip -t "$DEST/$NAME" && tar -tzf "$DEST/$NAME" > /dev/null || { echo "The copy is damaged. Try again."; exit 1; }
echo "Saved and checked: $DEST/$NAME"
DAY="${NAME#flightdeck-var-}"; DAY="${DAY%.tar.gz}"
if [ "$DAY" \< "$(date -v-2d +%Y%m%d 2>/dev/null || date -d '2 days ago' +%Y%m%d)" ]; then
  echo "WARNING: that backup is older than two days. The server's nightly backup may have stopped (run scripts/install-backup-cron.sh)."
fi
