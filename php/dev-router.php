<?php
$csp = file_get_contents(__DIR__ . '/../public/.htaccess');
// FLIGHTDECK_NO_CSP=1 lets a test page frame the app (for phone-width checks); the real policy is always on in production.
if (getenv('FLIGHTDECK_NO_CSP') !== '1' && preg_match('/Content-Security-Policy "([^"]+)"/', $csp, $m)) {
    // Locally the app signs in with Clerk's development instance, which production does not allow.
    header('Content-Security-Policy: ' . preg_replace('/(script-src|connect-src|frame-src) /', '$1 https://*.clerk.accounts.dev https://clerk-telemetry.com ', $m[1]));
}

// Local only: php -S 127.0.0.1:3001 php/dev-router.php (pnpm dev starts it). Mirrors public/.htaccess:
// /api -> API, site-owned paths -> public/site.php (server-rendered pages), /app/ -> the built app, other real files -> as is.
// Provider keys come from the project's .env automatically (see php/private/src/DevEnv.php); nothing has to be exported.
if (getenv('FLIGHTDECK_PRIVATE') === false) {
    putenv('FLIGHTDECK_PRIVATE=' . __DIR__ . '/private');
}
$path = rawurldecode((string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH));
if (strncmp($path, '/api', 4) === 0 && ($path === '/api' || $path[4] === '/')) {
    require __DIR__ . '/../public/api/index.php';
    return true;
}
$root = dirname(__DIR__);
$serve = static function (string $file, string $type): bool {
    header('Content-Type: ' . $type);
    header('Cache-Control: no-cache');
    readfile($file);
    return true;
};
// Public-site assets straight from source, so edits show on reload. The release build hashes them (scripts/build-public.mjs).
if ($path === '/site.css') {
    header('Content-Type: text/css');
    header('Cache-Control: no-cache');
    foreach (['src/fonts.css', 'src/styles/tokens.css', 'src/siteFooter.css', 'src/packingBoard.css', 'src/styles/site.css'] as $f) {
        readfile($root . '/' . $f);
        echo "\n";
    }
    return true;
}
$siteJs = ['/site.js' => 'src/site/site.js', '/js/contact.js' => 'src/site/contact.js', '/js/travel-checklist.js' => 'src/site/travel-checklist.js'];
if (isset($siteJs[$path])) {
    return $serve($root . '/' . $siteJs[$path], 'text/javascript');
}
$dist = realpath($root . '/dist');
$types = ['js' => 'text/javascript', 'css' => 'text/css', 'svg' => 'image/svg+xml', 'html' => 'text/html; charset=utf-8', 'png' => 'image/png', 'woff2' => 'font/woff2',
          'webmanifest' => 'application/manifest+json', 'json' => 'application/json', 'xml' => 'application/xml', 'txt' => 'text/plain; charset=utf-8'];
// The app and Clerk's return paths get the app shell, like the real host.
if (preg_match('#^/app(/|$)#', $path) || preg_match('#^/(sso-callback|sign-in|sign-up|v1|__clerk)(/|$)#', $path)) {
    $file = $dist !== false ? realpath($dist . $path) : false;
    if ($file !== false && is_file($file) && strncmp($file, $dist . '/', strlen($dist) + 1) === 0) {
        return $serve($file, $types[pathinfo($file, PATHINFO_EXTENSION)] ?? 'application/octet-stream');
    }
    if ($path === '/app') {
        header('Location: /app/', true, 301);
        return true;
    }
    return $serve($dist . '/app/index.html', 'text/html; charset=utf-8');
}
$file = $dist !== false ? realpath($dist . $path) : false;
if ($path !== '/' && $path !== '/sitemap.xml' && $file !== false && is_file($file) && strncmp($file, $dist . '/', strlen($dist) + 1) === 0 && pathinfo($file, PATHINFO_EXTENSION) !== 'html') {
    return $serve($file, $types[pathinfo($file, PATHINFO_EXTENSION)] ?? 'application/octet-stream');
}
$_SERVER['SCRIPT_NAME'] = '/site.php';
require $root . '/public/site.php';
return true;
