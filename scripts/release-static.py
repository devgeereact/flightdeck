"""Flightdeck production release, static half: certificate-verified explicit FTPS, ADDITIVE upload of dist/, public HTTPS checks.

Requires FTP_SERVER, FTP_USERNAME, FTP_PASSWORD, PUBLIC_BASE_URL. Never deletes remote files. Entry points go last so a visitor
never gets a page that references files that are not uploaded yet: the service worker and manifest, then site-build.json (names
the hashed site CSS/JS), then site.php, and .htaccess at the very end because it switches the routing (ADR-015). The private PHP
source is synced by the workflow BEFORE this step, so site.php always finds its code.
"""
import ftplib
import os
import pathlib
import ssl
import sys
import urllib.request
from urllib.parse import urlsplit

DIST = pathlib.Path('dist')
LAST = ['workbox', 'registerSW.js', 'sw.js', 'manifest.webmanifest', 'site-build.json', 'site.php', '.htaccess']
UA = 'Flightdeck-release/1.0 (+https://github.com/gsakinz/flightdeck)'


def order(path):
    name = path.name
    return (1 + next((i for i, key in enumerate(LAST) if name.startswith(key)), -1), str(path)) if path.parent == DIST else (0, str(path))


def ensure_dir(ftp, remote):
    for part in remote.split('/'):
        if not part:
            continue
        try:
            ftp.cwd(part)
        except ftplib.error_perm:
            ftp.mkd(part)
            ftp.cwd(part)


def upload(ftp, path):
    rel = path.relative_to(DIST).as_posix()
    folder, _, name = rel.rpartition('/')
    ftp.cwd('/')
    ensure_dir(ftp, folder)
    temp = '.' + name + '.upload'
    with path.open('rb') as handle:
        ftp.storbinary('STOR ' + temp, handle)
    try:
        ftp.rename(temp, name)
    except ftplib.error_perm:
        ftp.delete(name)  # server refuses rename-over-existing; the gap is a single request
        ftp.rename(temp, name)


def fetch(base, path):
    request = urllib.request.Request(base + path, headers={'Cache-Control': 'no-cache', 'User-Agent': UA})
    with urllib.request.urlopen(request, timeout=25, context=ssl.create_default_context()) as response:
        return response.status, response.headers.get('Content-Type', ''), response.read(65537)


def main():
    env = {k: os.environ.get(k, '') for k in ('FTP_SERVER', 'FTP_USERNAME', 'FTP_PASSWORD', 'PUBLIC_BASE_URL')}
    if any(not v or '\n' in v or '\r' in v for v in env.values()) or any(c in env['FTP_SERVER'] for c in '/:@ \t'):
        raise ValueError('Missing or malformed release environment configuration')
    url = urlsplit(env['PUBLIC_BASE_URL'])
    if url.scheme != 'https' or not url.hostname or url.path not in ('', '/'):
        raise ValueError('PUBLIC_BASE_URL must be an HTTPS site origin')
    base = env['PUBLIC_BASE_URL'].rstrip('/')
    files = sorted((p for p in DIST.rglob('*') if p.is_file()), key=order)
    required = ['app/index.html', 'site.php', 'site-build.json', 'api/index.php', '.htaccess']
    if not all((DIST / f).is_file() for f in required):
        raise RuntimeError('dist/ is incomplete: run the build first')
    with ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=30) as ftp:
        ftp.connect(env['FTP_SERVER'], 21)
        ftp.login(env['FTP_USERNAME'], env['FTP_PASSWORD'])
        ftp.prot_p()
        listing = ftp.nlst()
        if not ({'index.html', 'site.php'} & set(listing)) or 'flightdeck-private' in listing or 'flightdeck.gakinz.com' in listing:
            raise RuntimeError('FTP root is not the Flightdeck public root')
        for path in files:
            upload(ftp, path)
    print('Uploaded ' + str(len(files)) + ' files (additive, nothing deleted)')
    status, _, body = fetch(base, '/api/config')
    if status != 200 or b'liveAvailable' not in body:
        raise RuntimeError('/api/config check failed')
    status, ctype, _ = fetch(base, '/manifest.webmanifest')
    if status != 200 or 'manifest+json' not in ctype:
        raise RuntimeError('manifest check failed: ' + ctype)
    status, _, body = fetch(base, '/')
    if status != 200 or b'id="lookup"' not in body:
        raise RuntimeError('home page check failed (server-rendered site)')
    status, _, body = fetch(base, '/guides/')
    if status != 200 or b'class="cards"' not in body:
        raise RuntimeError('guides page check failed (server-rendered site)')
    status, _, body = fetch(base, '/app/')
    if status != 200 or b'id="root"' not in body:
        raise RuntimeError('app shell check failed (/app/)')
    print('PASS: release uploaded and public checks succeeded')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('FAIL: release (' + type(error).__name__ + '): ' + str(error)[:200])
        sys.exit(1)
