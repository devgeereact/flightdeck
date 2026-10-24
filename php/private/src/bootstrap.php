<?php
declare(strict_types=1);

// Loaded by the public entrypoint. Lives OUTSIDE every webroot on the server.
ini_set('display_errors', '0');
require __DIR__ . '/Http.php';
require __DIR__ . '/DevEnv.php';
require __DIR__ . '/ClerkAuth.php';
require __DIR__ . '/Checklists.php';
require __DIR__ . '/Metrics.php';
require __DIR__ . '/Enquiries.php';
require __DIR__ . '/ClerkApi.php';
require __DIR__ . '/Admin.php';
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

$privateDir = dirname(__DIR__);
$config = is_file($privateDir . '/config.php') ? (array) require $privateDir . '/config.php' : [];
$devEnv = \Flightdeck\DevEnv::forPrivateDir($privateDir); // empty on the real server
$env = static function (string ...$names) use ($devEnv): ?string {
    foreach ($names as $n) {
        $v = getenv($n);
        if (is_string($v) && $v !== '') {
            return $v;
        }
        if (isset($devEnv[$n])) {
            return $devEnv[$n];
        }
    }
    return null;
};
$config['opensky_client_id'] = $config['opensky_client_id'] ?? $env('OPENSKY_CLIENT_ID', 'clientId');
$config['opensky_client_secret'] = $config['opensky_client_secret'] ?? $env('OPENSKY_CLIENT_SECRET', 'clientSecret');
$config['admin_user_ids'] = $config['admin_user_ids'] ?? array_values(array_filter(array_map('trim', explode(',', (string) $env('FLIGHTDECK_ADMIN_IDS')))));
$config['owner_email'] = $config['owner_email'] ?? $env('OWNER_EMAIL');
$config['clerk_secret_key'] = $config['clerk_secret_key'] ?? $env('CLERK_SECRET_KEY');
$config['aerodatabox_key'] = $config['aerodatabox_key'] ?? $env('AERODATABOX_KEY', 'RAPID_API_KEY', 'RAPIDAPI_KEY');
if (($config['opensky_client_id'] ?? '') === '' || ($config['opensky_client_secret'] ?? '') === '') {
    $config['opensky_client_id'] = $config['opensky_client_secret'] = null;
}

// Sign-in enforcement: on when the Clerk issuer is known (explicit config, CLERK_ISSUER, or derived from the Clerk publishable key).
// FLIGHTDECK_AUTH=off switches it off for local automated tests only.
$config['clerk_issuer'] = $config['clerk_issuer'] ?? $env('CLERK_ISSUER') ?? \Flightdeck\ClerkAuth::issuerFromPublishableKey($env('CLERK_PUBLISHABLE_KEY', 'VITE_CLERK_PUBLISHABLE_KEY'));
if (getenv('FLIGHTDECK_AUTH') === 'off') {
    $config['clerk_issuer'] = null;
}

\Flightdeck\App::run($config, $privateDir);
