<?php
// Local only: php -S 127.0.0.1:3998 php/dev-router.php
// Provider keys come from the project's .env automatically (see php/private/src/DevEnv.php); nothing has to be exported.
if (getenv('FLIGHTDECK_PRIVATE') === false) {
    putenv('FLIGHTDECK_PRIVATE=' . __DIR__ . '/private');
}
$path = rawurldecode((string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH));
if (strncmp($path, '/api', 4) === 0 && ($path === '/api' || $path[4] === '/')) {
    require __DIR__ . '/../public/api/index.php';
    return true;
}
$dist = realpath(__DIR__ . '/../dist');
$file = realpath($dist . $path);
if ($path !== '/' && $file !== false && is_file($file) && strncmp($file, $dist . '/', strlen($dist) + 1) === 0) {
    $types = ['js' => 'text/javascript', 'css' => 'text/css', 'svg' => 'image/svg+xml', 'html' => 'text/html; charset=utf-8',
              'webmanifest' => 'application/manifest+json', 'json' => 'application/json'];
    header('Content-Type: ' . ($types[pathinfo($file, PATHINFO_EXTENSION)] ?? 'application/octet-stream'));
    header('Cache-Control: no-cache');
    readfile($file);
    return true;
}
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache');
readfile($dist . '/index.html');
return true;
