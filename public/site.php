<?php
declare(strict_types=1);

header_remove('X-Powered-By');

// Public website entrypoint (home, guides, help, legal...). Content, code and config live in a private folder outside the webroot.
define('FLIGHTDECK_PUBLIC', __DIR__);
$private = getenv('FLIGHTDECK_PRIVATE') ?: dirname(__DIR__) . '/flightdeck-private';
if (!is_file($private . '/src/site-bootstrap.php')) {
    http_response_code(503);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><title>Flightdeck</title><p>Flightdeck is briefly unavailable. Please try again in a few minutes.</p>';
    exit;
}
require $private . '/src/site-bootstrap.php';
