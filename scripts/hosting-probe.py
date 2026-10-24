"""Manual Flightdeck hosting probe: certificate-verified explicit FTPS upload of ONE unique page, exact public HTTPS check, cleanup.

Requires FTP_SERVER, FTP_USERNAME, FTP_PASSWORD, PUBLIC_BASE_URL. Never overwrites or lists secrets. Adapted from the reusable kit.
"""
import datetime
import ftplib
import html
import io
import os
import pathlib
import re
import secrets
import ssl
import time
import urllib.error
import urllib.request
from urllib.parse import urlsplit

APP_NAME = 'Flightdeck'
BEACON = re.compile(rb'<script[^>]*static\.cloudflareinsights\.com[^>]*></script>')
TEMPLATE = pathlib.Path(__file__).with_name('deployment-test-page.template.html')


def render(hostname, marker, created):
    page = TEMPLATE.read_text(encoding='utf-8')
    for key, value in (('APP_NAME_HTML', APP_NAME), ('PUBLIC_HOSTNAME_HTML', hostname), ('MARKER_HTML', marker), ('CREATED_AT_HTML', created)):
        page = page.replace('{{' + key + '}}', html.escape(value))
    return page.encode('utf-8')


def main():
    names = ('FTP_SERVER', 'FTP_USERNAME', 'FTP_PASSWORD', 'PUBLIC_BASE_URL')
    values = {name: os.environ.get(name, '') for name in names}
    if any(not value or '\n' in value or '\r' in value for value in values.values()):
        raise ValueError('Missing or malformed hosting environment configuration')
    host = values['FTP_SERVER']
    if any(char in host for char in '/:@ \t'):
        raise ValueError('FTP_SERVER must be a bare certificate-valid origin hostname')
    url = urlsplit(values['PUBLIC_BASE_URL'])
    if url.scheme != 'https' or not url.hostname or url.username or url.password or url.query or url.fragment or url.path not in ('', '/'):
        raise ValueError('PUBLIC_BASE_URL must be an HTTPS site origin with no path or credentials')
    marker = 'fd-' + secrets.token_hex(16)
    filename = 'deploy-check-' + secrets.token_hex(8) + '.html'
    created = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')
    body = render(url.hostname, marker, created)
    uploaded = False
    with ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=25) as ftp:
        ftp.connect(host, 21)
        ftp.login(values['FTP_USERNAME'], values['FTP_PASSWORD'])
        ftp.prot_p()
        listing = ftp.nlst()
        # The dedicated account's root MUST be this site's public root, never the cPanel home.
        if 'index.html' not in listing or 'flightdeck-private' in listing or 'flightdeck.gakinz.com' in listing:
            raise RuntimeError('FTP root is not the Flightdeck public root')
        if filename in listing:
            raise RuntimeError('Probe filename already exists')
        try:
            ftp.storbinary('STOR ' + filename, io.BytesIO(body))
            uploaded = True
            request = urllib.request.Request(values['PUBLIC_BASE_URL'].rstrip('/') + '/' + filename, headers={'Cache-Control': 'no-cache', 'User-Agent': 'Flightdeck-deploy-probe/1.0 (+https://github.com/gsakinz/flightdeck)'})
            for attempt in range(1, 4):
                try:
                    with urllib.request.urlopen(request, timeout=25, context=ssl.create_default_context()) as response:
                        got = BEACON.sub(b'', response.read(65537), count=1)  # Cloudflare Web Analytics injects one script at the edge
                        info = (response.status, response.geturl() == request.full_url, len(got), len(body), response.headers.get('Content-Type'), response.headers.get('cf-mitigated'), response.headers.get('cf-cache-status'))
                        if response.status == 200 and info[1] and got.rstrip() == body.rstrip():
                            break
                except urllib.error.HTTPError as http_error:
                    info = (http_error.code, None, None, len(body), http_error.headers.get('Content-Type'), http_error.headers.get('cf-mitigated'), None)
                # Non-secret diagnostics: status, same-url, got/sent length, content-type, cf-mitigated, cf-cache-status.
                print('attempt ' + str(attempt) + ' mismatch: ' + repr(info))
                if attempt == 1 and info[2]:
                    print('tail bytes received: ' + repr(got[-30:]) + ' expected: ' + repr(body[-30:]))
                    # Public page content only; show the first differing region to find proxy/rewrite interference.
                    at = next((i for i, (a, b) in enumerate(zip(body, got)) if a != b), min(len(body), len(got)))
                    print('first difference at byte ' + str(at) + '; received: ' + repr(got[max(0, at - 40):at + 260]))
                time.sleep(3)
            else:
                raise RuntimeError('Public HTTPS probe did not match the uploaded page')
            print('PASS: GitHub runner -> certificate-verified FTPS -> public HTTPS exact page')
            print('Probe file: ' + filename + ' marker: ' + marker)
        finally:
            if uploaded:
                ftp.delete(filename)
                print('Probe page removed; homepage unchanged')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Do not log server exceptions, URLs or authentication details.
        print('FAIL: hosting probe (' + type(error).__name__ + '). Check scoped credentials, FTPS root, DNS/TLS and any leftover deploy-check page privately.')
        raise SystemExit(1)
