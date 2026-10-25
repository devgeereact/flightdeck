<?php
declare(strict_types=1);

// Loaded by public/site.php. Renders the public website from CMS content. Lives OUTSIDE every webroot on the server.
ini_set('display_errors', '0');
require __DIR__ . '/DevEnv.php';
require __DIR__ . '/ClerkAuth.php';
require __DIR__ . '/Content/Markdown.php';
require __DIR__ . '/Content/ContentStore.php';
require __DIR__ . '/Site/Site.php';

use Flightdeck\Content\ContentStore;
use Flightdeck\Site\Site;

/** Asset URLs: the hashed files named in site-build.json (written by scripts/build-public.mjs), or the dev router's live files. */
$assets = static function (string $publicDir): array {
    $build = json_decode((string) @file_get_contents($publicDir . '/site-build.json'), true);
    $dev = ['css' => '/site.css', 'js' => '/site.js', 'contactJs' => '/js/contact.js', 'checklistJs' => '/js/travel-checklist.js', 'gaId' => ''];
    return is_array($build) ? $build + $dev : $dev;
};

$send = static function (int $status, string $body, string $type = 'text/html; charset=utf-8', ?string $etag = null): void {
    http_response_code($status);
    header('Content-Type: ' . $type);
    header('Cache-Control: ' . ($status === 200 ? 'no-cache' : 'no-store'));
    header('X-Content-Type-Options: nosniff');
    if ($etag !== null) {
        header('ETag: "' . $etag . '"');
    }
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'HEAD') {
        echo $body;
    }
};

$publicDir = defined('FLIGHTDECK_PUBLIC') ? FLIGHTDECK_PUBLIC : dirname(__DIR__, 2);
$path = rawurldecode((string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH));
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'GET' && $method !== 'HEAD') {
    header('Allow: GET, HEAD');
    $send(405, 'Method not allowed', 'text/plain; charset=utf-8');
    return;
}

try {
    [$config, $privateDir] = require __DIR__ . '/loadConfig.php';
    $store = new ContentStore($privateDir . '/var');
    $content = $store->published();
    $a = $assets($publicDir);
    // Announcements have start and end times, so a cached copy is trusted for five minutes at most.
    $etag = substr(sha1($store->version() . '|' . json_encode($a) . '|' . $path . '|' . intdiv(time(), 300)), 0, 20);
    if (trim((string) ($_SERVER['HTTP_IF_NONE_MATCH'] ?? ''), '" ') === $etag) {
        http_response_code(304);
        header('ETag: "' . $etag . '"');
        header('Cache-Control: no-cache');
        return;
    }
    $site = new Site($content, $a, $config);
    $r = $site->handle($path);
    if (isset($r['location'])) {
        http_response_code($r['status']);
        header('Location: ' . $r['location']);
        header('Cache-Control: no-cache');
        return;
    }
    $send($r['status'], $r['html'], $r['type'] ?? 'text/html; charset=utf-8', $r['status'] === 200 ? $etag : null);
} catch (\Throwable $e) {
    error_log('flightdeck site: ' . get_class($e) . ' at ' . basename($e->getFile()) . ':' . $e->getLine());
    header('Retry-After: 120');
    try {
        $seed = (new ContentStore(sys_get_temp_dir()))->seed();
        $send(503, (new Site($seed, $assets($publicDir)))->unavailable());
    } catch (\Throwable $e2) {
        $send(503, '<!doctype html><title>Flightdeck</title><p>Flightdeck is briefly unavailable. Please try again in a few minutes.</p>');
    }
}
