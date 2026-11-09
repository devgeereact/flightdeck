<?php
// Copy to config.php on the server (private folder, outside the webroot). Never commit config.php.
return [
    'opensky_client_id' => '',
    'opensky_client_secret' => '',
    // AeroDataBox via RapidAPI (free Basic plan: personal use, 400 units/month, attribution required). Leave empty to disable.
    'aerodatabox_key' => '',
    'aerodatabox_monthly_units' => 360, // each flight lookup costs 2 units; stops before the 400 allowance
    'aerodatabox_hourly_calls' => 12,   // global cap so searches by strangers cannot burn the allowance
    // 'aerodatabox_user_hourly_calls' => 6, // optional: paid look-ups per signed-in user per hour (default half the global cap; the owner is exempt)
    // 'provider_lock_wait_ms' => 10000,     // optional: how long a request waits for another's AeroDataBox fetch before saying "busy"
    // Only signed-in Clerk users may call /api/flights and /api/weather. Set to the Clerk Frontend API URL (the token issuer), e.g.
    // 'https://clerk.flightdeck.gakinz.com' (a trailing slash is ignored). Empty means: use CLERK_ISSUER or the Clerk publishable key
    // from the environment. If no valid issuer is found at all, every protected route refuses with 503 (fails closed); only
    // FLIGHTDECK_AUTH=off in a local test environment opens the look-ups.
    'clerk_issuer' => '',
    'clerk_authorized_parties' => [], // optional: allowed site origins (the token's azp), e.g. ['https://flightdeck.gakinz.com']
    // Owner console and enquiries (all optional, server-only):
    'admin_user_ids' => [],      // exact Clerk user ids allowed into the owner console, e.g. ['user_abc123']
    'owner_email' => '',         // new enquiries are also emailed here
    'mail_from' => 'noreply@flightdeck.gakinz.com',
    // Optional: send through your own mailbox (needed for replies from the owner console to land reliably). Leave smtp_host out to use PHP mail().
    // 'smtp_host' => 'mail.example.com', 'smtp_port' => 465, 'smtp_secure' => 'ssl', 'smtp_user' => 'info@example.com', 'smtp_pass' => '',
    'ga_property_id' => '',      // numeric GA4 property id (Admin > Property details), for the console's Analytics tab
    'ga_service_account_file' => '', // path inside this private folder to the service-account JSON key (mode 600)
    'clerk_secret_key' => '',    // Clerk SECRET key (sk_live_...) for the Users view only; never commit it
    // Optional "Latest from the web" links on a flight (Bright Data SERP API; costs money per search). Leave empty to keep it off.
    'brightdata_key' => '',      // API token from the Bright Data dashboard; never commit it
    'brightdata_zone' => '',     // the SERP API zone name, e.g. 'serp_api1'
    'brightdata_daily_cap' => 200, // searches per day across all visitors; results are cached 10 minutes per flight
    // 'brightdata_user_daily_cap' => 40, // optional: searches per signed-in user per day (the owner is exempt)
    // Optional gate, terminal, belt and boarding-time facts read out of those web results by Claude, checked by code and always labelled
    // "From the web" (ADR-025). Needs Bright Data above. Costs money per call; leave the key empty to keep it off. Set it with
    // scripts/set-anthropic-key.sh, never by hand in chat.
    'anthropic_key' => '',       // API key from the Anthropic Console; never commit it
    // 'anthropic_model' => 'claude-sonnet-5-5', // optional: the model that reads the results (this is the default)
    // 'anthropic_daily_cap' => 150,             // optional: Claude calls per day across all visitors (identical results are answered from cache)
    // 'web_facts' => false,                     // optional: set false to switch the facts off while keeping the key
    'home_country_code' => 'GB', // flights are labelled Outbound/Inbound relative to this country
    // Per-visitor rate limits behind Cloudflare. The CF-Connecting-IP header is only trusted when the connection really comes from a Cloudflare range.
    'trust_cf_connecting_ip' => false,
];
