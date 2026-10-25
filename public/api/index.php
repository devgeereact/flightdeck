<?php
declare(strict_types=1);

header_remove('X-Powered-By');
define('FLIGHTDECK_PUBLIC', dirname(__DIR__)); // for console previews: the site's asset names (site-build.json)

// Public API entrypoint. All logic, config and cache live in a private folder outside the webroot.
$private = getenv('FLIGHTDECK_PRIVATE') ?: dirname(__DIR__, 2) . '/flightdeck-private';
if (!is_file($private . '/src/bootstrap.php')) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo '{"error":"Server is not configured."}';
    exit;
}
require $private . '/src/bootstrap.php';
