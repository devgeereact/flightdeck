<?php
declare(strict_types=1);

// Builds the server config from private config.php, the environment and (locally only) the project's .env.
// Shared by the API (bootstrap.php) and the public site (site-bootstrap.php). Returns [$config, $privateDir].
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
foreach (['smtp_host' => 'SMTP_HOST', 'smtp_port' => 'SMTP_PORT', 'smtp_secure' => 'SMTP_SECURE', 'smtp_user' => 'SMTP_USER', 'smtp_pass' => 'SMTP_PASS', 'mail_from' => 'MAIL_FROM'] as $k => $e) {
    $config[$k] = $config[$k] ?? $env($e);
}
$config['clerk_secret_key'] = $config['clerk_secret_key'] ?? $env('CLERK_SECRET_KEY');
$config['ga_property_id'] = $config['ga_property_id'] ?? $env('GA_PROPERTY_ID');
$config['ga_service_account_file'] = $config['ga_service_account_file'] ?? $env('GA_SERVICE_ACCOUNT_FILE');
$config['aerodatabox_key'] = $config['aerodatabox_key'] ?? $env('AERODATABOX_KEY', 'RAPID_API_KEY', 'RAPIDAPI_KEY');
if (($config['opensky_client_id'] ?? '') === '' || ($config['opensky_client_secret'] ?? '') === '') {
    $config['opensky_client_id'] = $config['opensky_client_secret'] = null;
}

// Sign-in enforcement: on when the Clerk issuer is known (explicit config, CLERK_ISSUER, or derived from the Clerk publishable key).
// FLIGHTDECK_AUTH=off switches it off for local automated tests only.
$config['clerk_issuer'] = $config['clerk_issuer'] ?? $env('CLERK_ISSUER') ?? \Flightdeck\ClerkAuth::issuerFromPublishableKey($env('CLERK_PUBLISHABLE_KEY', 'VITE_CLERK_PUBLISHABLE_KEY'));
// Local automated tests only (server environment, never a request): a higher per-visitor limit for long test runs.
if (getenv('FLIGHTDECK_RATE_PER_MINUTE') !== false && ctype_digit((string) getenv('FLIGHTDECK_RATE_PER_MINUTE'))) {
    $config['rate_per_minute'] = (int) getenv('FLIGHTDECK_RATE_PER_MINUTE');
}
if (getenv('FLIGHTDECK_AUTH') === 'off') {
    $config['clerk_issuer'] = null;
}


return [$config, $privateDir];
