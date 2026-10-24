<?php
declare(strict_types=1);

// Loaded by the public entrypoint. Lives OUTSIDE every webroot on the server.
ini_set('display_errors', '0');
require __DIR__ . '/Http.php';
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

$privateDir = dirname(__DIR__);
$config = is_file($privateDir . '/config.php') ? (array) require $privateDir . '/config.php' : [];
$env = static function (string ...$names): ?string {
    foreach ($names as $n) {
        $v = getenv($n);
        if (is_string($v) && $v !== '') {
            return $v;
        }
    }
    return null;
};
$config['opensky_client_id'] = $config['opensky_client_id'] ?? $env('OPENSKY_CLIENT_ID', 'clientId');
$config['opensky_client_secret'] = $config['opensky_client_secret'] ?? $env('OPENSKY_CLIENT_SECRET', 'clientSecret');
$config['aerodatabox_key'] = $config['aerodatabox_key'] ?? $env('AERODATABOX_KEY', 'RAPID_API_KEY', 'RAPIDAPI_KEY');
if (($config['opensky_client_id'] ?? '') === '' || ($config['opensky_client_secret'] ?? '') === '') {
    $config['opensky_client_id'] = $config['opensky_client_secret'] = null;
}

\Flightdeck\App::run($config, $privateDir);
