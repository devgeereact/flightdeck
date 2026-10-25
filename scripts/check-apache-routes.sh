#!/usr/bin/env bash
# Local release check (macOS): serves dist/ the way the host does (public root + private folder beside it, public/.htaccess,
# PHP through PHP-FPM) with Apache on 127.0.0.1:3990, plus stale static pages a previous additive release would leave behind,
# then checks every kind of route and the cache/security headers. Production runs LiteSpeed, which reads the same rules.
# Needs: /usr/sbin/httpd (built in), Homebrew php-fpm. Run after `pnpm build`. Nothing outside a temporary folder is touched.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"
pub="$tmp/home/flightdeck.gakinz.com"; priv="$tmp/home/flightdeck-private"
mkdir -p "$pub" "$priv/var" "$tmp/logs"
cp -R "$root/dist/." "$pub/"; cp -R "$root/php/private/src" "$priv/src"
mkdir -p "$pub/about"; echo '<h1>OLD STATIC</h1>' > "$pub/about/index.html"; echo 'OLD SITEMAP' > "$pub/sitemap.xml"; echo 'OLD ROOT SHELL' > "$pub/index.html"
fpm="$(command -v php-fpm || echo /opt/homebrew/sbin/php-fpm)"
cat > "$tmp/fpm.conf" <<EOF
[global]
pid = $tmp/fpm.pid
error_log = $tmp/logs/fpm.log
daemonize = yes
[www]
listen = 127.0.0.1:9077
pm = static
pm.max_children = 2
clear_env = yes
EOF
cat > "$tmp/httpd.conf" <<EOF
ServerRoot "/usr"
Listen 127.0.0.1:3990
PidFile "$tmp/httpd.pid"
Mutex file:$tmp/logs default
DefaultRuntimeDir $tmp/logs
$(for m in mpm_prefork authz_core dir mime rewrite headers proxy proxy_fcgi unixd log_config setenvif env alias; do echo "LoadModule ${m}_module libexec/apache2/mod_${m}.so"; done)
TypesConfig /private/etc/apache2/mime.types
ServerName 127.0.0.1
ErrorLog "$tmp/logs/error.log"
DocumentRoot "$pub"
<Directory "$pub">
  AllowOverride All
  Require all granted
</Directory>
<FilesMatch "\.php$">
  SetHandler "proxy:fcgi://127.0.0.1:9077"
</FilesMatch>
EOF
"$fpm" -y "$tmp/fpm.conf"; httpd -f "$tmp/httpd.conf" -k start
cleanup() { httpd -f "$tmp/httpd.conf" -k stop 2>/dev/null || true; kill "$(cat "$tmp/fpm.pid" 2>/dev/null)" 2>/dev/null || true; sleep 0.3; rm -rf "$tmp"; }
trap cleanup EXIT
sleep 1
B=http://127.0.0.1:3990; fail=0
expect() { # path, status, text expected in body (or "-")
  local body; body="$(curl -s -o - -w '\n%{http_code}' "$B$1")"; local code="${body##*$'\n'}"; body="${body%$'\n'*}"
  if [[ "$code" == "$2" && ( "$3" == "-" || "$body" == *"$3"* ) ]]; then echo "PASS $1 -> $code"; else echo "FAIL $1 -> $code (wanted $2 with '$3')"; fail=1; fi
}
header() { # path, header line expected
  if curl -sI "$B$1" | tr -d '\r' | grep -qi "^$2"; then echo "PASS $1 has $2"; else echo "FAIL $1 lacks $2"; fail=1; fi
}
expect / 200 'Your flight, clearly'
expect /about/ 200 'About Flightdeck'
expect /about 301 -
expect /guides/flight-status-explained/ 200 'Key points'
expect /help/ 200 'Help and FAQ'
expect /sitemap.xml 200 '<urlset'
expect /index.html 301 -
expect /nope/ 404 'Page not found'
expect /app/ 200 'Flightdeck app'
expect /app/anything 200 'Flightdeck app'
expect /sign-in/factor-one 200 'Flightdeck app'
expect /api/config 200 'liveAvailable'
expect /api/nope 404 'Unknown endpoint'
expect /robots.txt 200 'Disallow: /app/'
header /guides/ 'Content-Security-Policy:'
header /guides/ 'ETag:'
header /guides/ 'Cache-Control: no-cache'
header /app/ 'Cache-Control: no-cache'
header "$(node -p "require('$root/dist/site-build.json').css")" 'Cache-Control: public, max-age=31536000, immutable'
header /manifest.webmanifest 'Content-Type: application/manifest+json'
etag="$(curl -sI $B/help/ | tr -d '\r' | awk -F': ' 'tolower($1)=="etag"{print $2}')"
[[ "$(curl -s -o /dev/null -w '%{http_code}' -H "If-None-Match: $etag" $B/help/)" == 304 ]] && echo "PASS revalidation 304" || { echo "FAIL revalidation"; fail=1; }
[[ "$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/help/)" == 405 ]] && echo "PASS POST to a page is 405" || { echo "FAIL POST"; fail=1; }
[[ $fail == 0 ]] && echo "All Apache route checks passed" || { echo "Apache route checks FAILED"; exit 1; }
