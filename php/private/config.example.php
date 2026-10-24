<?php
// Copy to config.php on the server (private folder, outside the webroot). Never commit config.php.
return [
    'opensky_client_id' => '',
    'opensky_client_secret' => '',
    // AeroDataBox via RapidAPI (free Basic plan: personal use, 400 units/month, attribution required). Leave empty to disable.
    'aerodatabox_key' => '',
    'aerodatabox_monthly_units' => 360, // each flight lookup costs 2 units; stops before the 400 allowance
    'aerodatabox_hourly_calls' => 12,   // global cap so searches by strangers cannot burn the allowance
    // Only signed-in Clerk users may call /api/flights and /api/weather. Set to the Clerk Frontend API URL (the token issuer), e.g.
    // 'https://clerk.flightdeck.gakinz.com'. Left empty the lookups are open. Turn it on only AFTER the app that sends the token is live.
    'clerk_issuer' => '',
    'clerk_authorized_parties' => [], // optional: allowed site origins (the token's azp), e.g. ['https://flightdeck.gakinz.com']
    // Owner console and enquiries (all optional, server-only):
    'admin_user_ids' => [],      // exact Clerk user ids allowed into the owner console, e.g. ['user_abc123']
    'owner_email' => '',         // new enquiries are also emailed here
    'mail_from' => 'noreply@flightdeck.gakinz.com',
    'clerk_secret_key' => '',    // Clerk SECRET key (sk_live_...) for the Users view only; never commit it
    'home_country_code' => 'GB', // flights are labelled Outbound/Inbound relative to this country
    // Per-visitor rate limits behind Cloudflare. The CF-Connecting-IP header is only trusted when the connection really comes from a Cloudflare range.
    'trust_cf_connecting_ip' => false,
];
