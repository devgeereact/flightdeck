<?php
// Copy to config.php on the server (private folder, outside the webroot). Never commit config.php.
return [
    'opensky_client_id' => '',
    'opensky_client_secret' => '',
    // AeroDataBox via RapidAPI (free Basic plan: personal use, 400 units/month, attribution required). Leave empty to disable.
    'aerodatabox_key' => '',
    'aerodatabox_monthly_units' => 360, // each flight lookup costs 2 units; stops before the 400 allowance
    'aerodatabox_hourly_calls' => 12,   // global cap so searches by strangers cannot burn the allowance
    // Per-visitor rate limits behind Cloudflare. The CF-Connecting-IP header is only trusted when the connection really comes from a Cloudflare range.
    'trust_cf_connecting_ip' => false,
];
