<?php
// Copy to config.php on the server (private folder, outside the webroot). Never commit config.php.
return [
    'opensky_client_id' => '',
    'opensky_client_secret' => '',
    // Only enable behind Cloudflare so rate limits are per visitor, not per Cloudflare edge IP.
    'trust_cf_connecting_ip' => false,
];
