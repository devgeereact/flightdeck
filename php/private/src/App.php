<?php
declare(strict_types=1);

namespace Flightdeck;

final class App
{
    public static function run(array $config, string $privateDir): void
    {
        $varDir = $privateDir . '/var';
        $store = new Store($varDir);
        Metrics::init($varDir);
        $method = (string) ($_SERVER['REQUEST_METHOD'] ?? 'GET');
        $path = (string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
        $pos = strpos($path, '/api');
        $route = rtrim($pos === false ? $path : substr($path, $pos + 4), '/');

        $ip = CloudflareIps::clientIp((string) ($_SERVER['REMOTE_ADDR'] ?? 'local'), isset($_SERVER['HTTP_CF_CONNECTING_IP']) ? (string) $_SERVER['HTTP_CF_CONNECTING_IP'] : null, !empty($config['trust_cf_connecting_ip']));
        if (!$store->rateAllow($ip, 30, 60000)) {
            Metrics::count('rate_limited');
            Http::json(429, ['error' => 'Too many requests. Please wait a minute.']);
            return;
        }
        $allowed = ['GET', 'HEAD'];
        if ($route === '/checklist') {
            $allowed[] = 'PUT';
            $allowed[] = 'DELETE';
        } elseif ($route === '/event' || $route === '/contact') {
            $allowed = ['POST'];
        } elseif (strpos($route, '/admin/enquiries/') === 0) {
            $allowed = substr($route, -6) === '/reply' ? ['POST'] : ['PATCH'];
        }
        if (!in_array($method, $allowed, true)) {
            header('Allow: ' . implode(', ', $allowed));
            Http::json(405, ['error' => 'Method not allowed']);
            return;
        }

        $auth = new ClerkAuth($config['clerk_issuer'] ?? null, $store, null, is_array($config['clerk_authorized_parties'] ?? null) ? $config['clerk_authorized_parties'] : []);
        $isAdminRoute = strpos($route, '/admin/') === 0;
        $sub = null;
        if (in_array($route, ['/flights', '/weather', '/checklist', '/me'], true) || $isAdminRoute) {
            if (!$auth->enabled()) {
                if ($route === '/me') {
                    Http::json(200, ['signedIn' => false, 'isAdmin' => false]);
                    return;
                }
                if ($route === '/checklist' || $isAdminRoute) {
                    Http::json(503, ['error' => 'This needs sign-in, which is not enabled on this server.']);
                    return;
                }
            } else {
                $token = ClerkAuth::tokenFrom($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? null, $_SERVER['HTTP_X_SESSION_TOKEN'] ?? null);
                $verdict = $auth->check($token);
                if (!$verdict['ok']) {
                    Metrics::count('auth_denied');
                    Http::json($verdict['status'], ['error' => $verdict['error']]);
                    return;
                }
                $sub = $verdict['sub'];
                if ($sub !== null) {
                    Metrics::user($sub);
                }
            }
        }
        if ($isAdminRoute && !Admin::isAdmin($sub, $config)) {
            Metrics::count('admin_denied');
            Http::json(403, ['error' => 'This area is for the site owner.']);
            return;
        }
        $opensky = new OpenSky($config['opensky_client_id'] ?? null, $config['opensky_client_secret'] ?? null, $store);
        $adb = new AeroDataBox($config, $store);
        $routes = new RouteLookup($store);
        switch (true) {
            case $route === '/config':
                Http::json(200, [
                    'liveAvailable' => $opensky->configured() || $adb->configured(),
                    'provider' => $adb->configured() ? 'AeroDataBox + OpenSky Network' : 'OpenSky Network',
                    'providers' => ['opensky' => $opensky->configured(), 'aerodatabox' => $adb->configured(), 'routes' => true],
                    'signInRequired' => $auth->enabled(),
                ]);
                return;
            case $route === '/flights':
                self::flights($opensky, $adb, $routes, $config);
                return;
            case $route === '/weather':
                self::weather($store);
                return;
            case $route === '/checklist':
                self::checklist(new Checklists($varDir), (string) $sub);
                return;
            case $route === '/me':
                $admin = Admin::isAdmin($sub, $config);
                Http::json(200, ['signedIn' => true, 'isAdmin' => $admin, 'unread' => $admin ? (new Enquiries($varDir))->unread() : null]);
                return;
            case $route === '/event':
                self::event();
                return;
            case $route === '/contact':
                self::contact($store, $varDir, $config, $ip);
                return;
            case $isAdminRoute:
                self::admin($route, $method, $config, $store, $varDir, (string) $sub, $privateDir);
                return;
            default:
                Http::json(404, ['error' => 'Unknown endpoint']);
        }
    }

    /** Small JSON request body, hard-capped. */
    private static function jsonBody(int $max): ?array
    {
        $raw = file_get_contents('php://input', false, null, 0, $max + 1);
        if ($raw === false || $raw === '' || strlen($raw) > $max) {
            return null;
        }
        $d = json_decode($raw, true);
        return is_array($d) ? $d : null;
    }

    /** Anonymous, whitelisted, counter-only events from the app (no cookies, no identifiers). */
    private static function event(): void
    {
        $b = self::jsonBody(512);
        $name = is_array($b) && is_string($b['name'] ?? null) ? $b['name'] : '';
        if (!in_array($name, Admin::EVENTS, true)) {
            Http::json(422, ['error' => 'Unknown event.']);
            return;
        }
        Metrics::count($name);
        Http::json(200, ['ok' => true]);
    }

    private static function contact(Store $store, string $varDir, array $config, string $ip): void
    {
        if (!$store->rateAllow('contact:' . $ip, 3, 3600000)) {
            Http::json(429, ['error' => 'You have sent a few messages already. Please try again in an hour.']);
            return;
        }
        $b = self::jsonBody(Enquiries::MAX_MESSAGE * 4 + 2048);
        if ($b === null) {
            Http::json(422, ['error' => 'Your message could not be read. Please try again.']);
            return;
        }
        $from = is_string($config['mail_from'] ?? null) && filter_var($config['mail_from'], FILTER_VALIDATE_EMAIL) ? $config['mail_from'] : 'noreply@flightdeck.gakinz.com';
        $r = (new Enquiries($varDir, Mailer::make($config)))->submit($b, is_string($config['owner_email'] ?? null) ? $config['owner_email'] : null, $from);
        if (!$r['ok']) {
            Http::json($r['status'], ['error' => $r['error']]);
            return;
        }
        if ($r['id'] !== null) {
            Metrics::count('enquiry_received');
        }
        Http::json(200, ['ok' => true, 'message' => 'Thank you. Your message has been sent.']);
    }

    /** Owner console data. Only reached by an allow-listed Clerk user (checked in run()). */
    private static function analytics(array $config, Store $store, string $privateDir): GoogleAnalytics
    {
        return new GoogleAnalytics(is_string($config['ga_property_id'] ?? null) ? $config['ga_property_id'] : null, GoogleAnalytics::loadKeyFile(is_string($config['ga_service_account_file'] ?? null) ? $config['ga_service_account_file'] : null, $privateDir), $store);
    }

    private static function admin(string $route, string $method, array $config, Store $store, string $varDir, string $sub, string $privateDir): void
    {
        $metrics = Metrics::instance();
        $enq = new Enquiries($varDir, Mailer::make($config));
        if ($route === '/admin/overview') {
            $days = max(1, min(90, (int) ($_GET['days'] ?? 30)));
            Metrics::flushNow();
            $range = $metrics !== null ? $metrics->range($days) : [];
            Http::json(200, ['overview' => Admin::overview($range), 'allowance' => Admin::allowance($store, $config), 'unread' => $enq->unread()]);
            return;
        }
        if ($route === '/admin/users') {
            Http::json(200, (new ClerkApi($config['clerk_secret_key'] ?? null, $store))->summary());
            return;
        }
        if ($route === '/admin/enquiries' && $method === 'GET') {
            Http::json(200, $enq->list(50, max(0, (int) ($_GET['offset'] ?? 0))));
            return;
        }
        if (preg_match('#^/admin/enquiries/(\d{14}-[0-9a-f]{6})/reply$#D', $route, $m) && $method === 'POST') {
            if (!$store->rateAllow('reply:' . $sub, 30, 3600000)) {
                Http::json(429, ['error' => 'Too many replies this hour. Please wait a little.']);
                return;
            }
            $b = self::jsonBody(Enquiries::MAX_MESSAGE * 4 + 1024);
            $from = is_string($config['mail_from'] ?? null) && filter_var($config['mail_from'], FILTER_VALIDATE_EMAIL) ? $config['mail_from'] : 'noreply@flightdeck.gakinz.com';
            $r = is_array($b) && is_string($b['message'] ?? null)
                ? $enq->reply($m[1], $b['message'], $from, is_string($config['owner_email'] ?? null) ? $config['owner_email'] : null)
                : ['ok' => false, 'status' => 422, 'error' => 'Write your reply first.'];
            if ($r['ok']) {
                Admin::audit($varDir, $sub, 'enquiry ' . $m[1] . ' replied');
                Http::json(200, ['ok' => true, 'unread' => $enq->unread()]);
            } else {
                Http::json($r['status'], ['error' => $r['error']]);
            }
            return;
        }
        if (strpos($route, '/admin/enquiries/') === 0 && $method === 'PATCH') {
            $b = self::jsonBody(512);
            $id = substr($route, strlen('/admin/enquiries/'));
            if (!is_array($b) || !is_string($b['status'] ?? null) || !$enq->setStatus($id, $b['status'])) {
                Http::json(422, ['error' => 'That change could not be saved.']);
                return;
            }
            Admin::audit($varDir, $sub, 'enquiry ' . $id . ' -> ' . $b['status']);
            Http::json(200, ['ok' => true, 'unread' => $enq->unread()]);
            return;
        }
        if ($route === '/admin/system') {
            Http::json(200, Admin::system($config, $store, (new ClerkApi($config['clerk_secret_key'] ?? null, $store))->configured(), self::analytics($config, $store, $privateDir)->configured()));
            return;
        }
        if ($route === '/admin/analytics') {
            Http::json(200, self::analytics($config, $store, $privateDir)->summary());
            return;
        }
        Http::json(404, ['error' => 'Unknown endpoint']);
    }

    /** GET returns the signed-in user's checklist document; PUT {baseRev, data} stores it if baseRev is still the latest. */
    private static function checklist(Checklists $lists, string $sub): void
    {
        if ($sub === '') {
            Http::json(401, ['error' => 'Sign in to keep your checklist.']);
            return;
        }
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'DELETE') {
            $lists->delete($sub);
            Http::json(200, ['ok' => true, 'deleted' => true]);
            return;
        }
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'PUT') {
            $cur = $lists->get($sub);
            Http::json(200, ['rev' => $cur['rev'], 'data' => $cur['data'], 'limits' => ['bytes' => Checklists::MAX_BYTES, 'trips' => Checklists::MAX_TRIPS, 'items' => Checklists::MAX_ADDED]]);
            return;
        }
        $raw = file_get_contents('php://input', false, null, 0, Checklists::MAX_BYTES + 1);
        if ($raw === false || strlen($raw) > Checklists::MAX_BYTES) {
            Http::json(413, ['error' => 'Your checklist is too large to save. Remove a trip or some of your own items.']);
            return;
        }
        $body = json_decode($raw, true);
        $doc = is_array($body) ? Checklists::validate($body['data'] ?? null) : null;
        $base = is_array($body) && isset($body['baseRev']) && is_int($body['baseRev']) && $body['baseRev'] >= 0 ? $body['baseRev'] : null;
        if ($doc === null || $base === null) {
            Http::json(422, ['error' => 'That checklist could not be saved because it is not valid.']);
            return;
        }
        if (strlen((string) json_encode($doc)) > Checklists::MAX_BYTES) {
            Http::json(413, ['error' => 'Your checklist is too large to save. Remove a trip or some of your own items.']);
            return;
        }
        $r = $lists->put($sub, $doc, $base);
        if (!$r['ok']) {
            Http::json(409, ['error' => 'conflict', 'rev' => $r['rev'], 'data' => $r['data']]);
            return;
        }
        Http::json(200, ['rev' => $r['rev']]);
    }

    /** Aggregate-only search statistics: never stored together with who searched. */
    private static function recordSearch(string $number, array $flights): void
    {
        Metrics::count('search_total');
        if (!$flights) {
            Metrics::count('search_notfound');
            Metrics::tally('notfound', $number);
            return;
        }
        Metrics::count(!empty($flights[0]['usualRouteOnly']) ? 'search_usual_route' : 'search_found');
        Metrics::tally('airlines', substr($number, 0, 2));
        if (isset($flights[0]['direction']['type'])) {
            Metrics::tally('direction', (string) $flights[0]['direction']['type']);
        }
        $o = $flights[0]['origin']['code'] ?? '—';
        $d = $flights[0]['destination']['code'] ?? '—';
        if ($o !== '—' && $d !== '—') {
            Metrics::tally('routes', $o . '>' . $d);
        }
    }

    private static function param(string $name): string
    {
        return isset($_GET[$name]) && is_string($_GET[$name]) ? $_GET[$name] : '';
    }

    private static function flights(OpenSky $opensky, AeroDataBox $adb, RouteLookup $routes, array $config): void
    {
        $number = Flight::normalizeNumber(self::param('number'));
        $date = self::param('date');
        $mode = self::param('mode');
        if (!Flight::validSearch($number, $date)) {
            Http::json(400, ['error' => 'Enter a flight number such as BA117 and a valid departure date.']);
            return;
        }
        if ($mode !== '' && $mode !== 'demo' && $mode !== 'live') {
            Http::json(400, ['error' => 'Mode must be demo or live.']);
            return;
        }
        if ($mode === 'demo') {
            $flight = Flight::demoFlight($number, $date);
            Http::json(200, [
                'mode' => 'demo', 'flights' => $flight ? [$flight] : [], 'fetchedAt' => Flight::iso(Store::nowMs()), 'cached' => false,
                'source' => 'Illustrative sample — not an operational flight', 'refreshSeconds' => 60,
            ]);
            return;
        }
        if (!$opensky->configured() && !$adb->configured()) {
            Http::json(503, ['error' => 'Live flights need provider credentials on the server. Sample mode is available now.']);
            return;
        }
        try {
            $now = Store::nowMs();
            $notes = [];
            $sources = [];
            $times = [];
            $cached = true;
            $scheduled = [];
            if ($adb->configured()) {
                if (Flight::scheduleDateOk($date, $now)) {
                    try {
                        [$raw, $c, $t] = $adb->fetch($number, $date);
                        [$raw, $exact] = Flight::filterByDepartureDate($raw, $date);
                        if (!$exact) {
                            $notes[] = 'No departure is scheduled on this date; showing the nearest departures instead.';
                        }
                        foreach ($raw as $x) {
                            $scheduled[] = Flight::fromAeroDataBox($x, $number, $date);
                        }
                        $sources[] = 'AeroDataBox';
                        $times[] = $t;
                        $cached = $cached && $c;
                    } catch (AeroDataBoxError $e) {
                        $notes[] = $e->getMessage();
                    }
                } else {
                    $notes[] = 'Scheduled details are requested only for dates from yesterday to three days ahead.';
                }
            }
            $matches = [];
            $openskyError = null;
            if ($opensky->configured()) {
                try {
                    [$states, $c, $t] = $opensky->states();
                    $matches = array_slice(Flight::matchStates($states, $number), 0, 20);
                    $sources[] = 'OpenSky Network';
                    $times[] = $t;
                    $cached = $cached && $c;
                } catch (OpenSkyError $e) {
                    $openskyError = $e->getMessage();
                    $notes[] = $e->getMessage();
                }
            }
            if ($openskyError !== null && !$scheduled && !$adb->configured()) {
                Http::json(502, ['error' => $openskyError]);
                return;
            }
            $flights = Flight::combine($scheduled, $matches, $number, $now, static function (string $callsign) use ($routes) {
                try {
                    return $routes->lookup($callsign);
                } catch (\Throwable $e) {
                    error_log('flightdeck route: ' . get_class($e));
                    return null;
                }
            });
            if ($flights && !$scheduled) {
                $sources[] = 'adsbdb routes';
            }
            if (!$flights) {
                // Nothing live and nothing scheduled: at least say what this flight number usually flies.
                foreach (Flight::callsignCandidates($number) as $callsign) {
                    $route = $routes->lookup($callsign);
                    if ($route !== null) {
                        $flights[] = Flight::usualRouteFlight($number, $date, $route);
                        $sources[] = 'adsbdb routes';
                        $notes[] = 'No schedule is published for this date yet, so this is the flight\'s usual route only. Times appear closer to departure.';
                        break;
                    }
                }
            }
            $home = is_string($config['home_country_code'] ?? null) && strlen($config['home_country_code']) === 2 ? strtoupper($config['home_country_code']) : 'GB';
            $flights = array_map(static function (array $f) use ($home) {
                return Flight::addTerminalHints(Flight::addDirection($f, $home));
            }, $flights);
            $airborne = false;
            foreach ($flights as $f) {
                $airborne = $airborne || $f['position'] !== null;
            }
            self::recordSearch($number, $flights);
            Http::json(200, [
                'mode' => 'live', 'flights' => $flights, 'fetchedAt' => Flight::iso($times ? min($times) : $now), 'cached' => $cached,
                'source' => $sources ? implode(' · ', $sources) : 'No provider answered', 'sources' => $sources, 'notes' => $notes,
                'refreshSeconds' => $airborne ? OpenSky::SNAPSHOT_SECONDS : 600,
            ]);
        } catch (OpenSkyError $e) {
            Metrics::count('search_error');
            Http::json(502, ['error' => $e->getMessage()]);
        } catch (\Throwable $e) {
            Metrics::count('search_error');
            error_log('flightdeck flights: ' . get_class($e));
            Http::json(502, ['error' => 'Unable to retrieve flight data.']);
        }
    }

    private static function weather(Store $store): void
    {
        $latRaw = self::param('lat');
        $lonRaw = self::param('lon');
        if ($latRaw === '' || $lonRaw === '' || !is_numeric($latRaw) || !is_numeric($lonRaw)
            || !is_finite((float) $latRaw) || !is_finite((float) $lonRaw) || abs((float) $latRaw) > 90 || abs((float) $lonRaw) > 180) {
            Http::json(400, ['error' => 'Valid airport coordinates are required.']);
            return;
        }
        $lat = (float) $latRaw;
        $lon = (float) $lonRaw;
        $key = 'weather-' . sprintf('%.2f,%.2f', $lat, $lon);
        $hit = $store->get($key);
        if (is_array($hit)) {
            Http::json(200, $hit);
            return;
        }
        $fmt = static function (float $v): string {
            return rtrim(rtrim(number_format($v, 6, '.', ''), '0'), '.');
        };
        [$status, $body] = Http::request(
            'GET',
            'https://api.open-meteo.com/v1/forecast?latitude=' . $fmt($lat) . '&longitude=' . $fmt($lon) . '&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto',
            [],
            null,
            10
        );
        $d = $status === 200 ? json_decode($body, true) : null;
        if (!is_array($d) || empty($d['current']) || !is_array($d['current'])) {
            Http::json(502, ['error' => 'Weather is temporarily unavailable.']);
            return;
        }
        $data = $d['current'] + ['timezone' => $d['timezone'] ?? null, 'source' => 'Open-Meteo', 'fetchedAt' => Flight::iso(Store::nowMs())];
        $store->put($key, $data, 600000);
        Http::json(200, $data);
    }
}
