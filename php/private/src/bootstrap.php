<?php
declare(strict_types=1);

// Loaded by the public entrypoint. Lives OUTSIDE every webroot on the server.
ini_set('display_errors', '0');
require __DIR__ . '/Http.php';
require __DIR__ . '/DevEnv.php';
require __DIR__ . '/ClerkAuth.php';
require __DIR__ . '/Checklists.php';
require __DIR__ . '/Metrics.php';
require __DIR__ . '/Mailer.php';
require __DIR__ . '/Enquiries.php';
require __DIR__ . '/ClerkApi.php';
require __DIR__ . '/Admin.php';
require __DIR__ . '/GoogleAnalytics.php';
require __DIR__ . '/CloudflareIps.php';
require __DIR__ . '/Store.php';
require __DIR__ . '/Geo.php';
require __DIR__ . '/Flight.php';
require __DIR__ . '/OpenSky.php';
require __DIR__ . '/RouteLookup.php';
require __DIR__ . '/AeroDataBox.php';
require __DIR__ . '/App.php';

set_exception_handler(static function (\Throwable $e): void {
    error_log('flightdeck: ' . get_class($e) . ' at ' . basename($e->getFile()) . ':' . $e->getLine());
    if (!headers_sent()) {
        \Flightdeck\Http::json(500, ['error' => 'Unexpected server error.']);
    }
});

[$config, $privateDir] = require __DIR__ . '/loadConfig.php';

\Flightdeck\App::run($config, $privateDir);
