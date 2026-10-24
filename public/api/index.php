<?php
declare(strict_types=1);

// Public API entrypoint. All logic, config and cache live in a private folder outside the webroot.
$private = getenv('FLIGHTDECK_PRIVATE') ?: dirname(__DIR__, 2) . '/flightdeck-private';
if (!is_file($private . '/src/bootstrap.php')) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo '{"error":"Server is not configured."}';
    exit;
}
require $private . '/src/bootstrap.php';
