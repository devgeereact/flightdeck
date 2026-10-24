<?php
declare(strict_types=1);

namespace Flightdeck;

final class App
{
    public static function run(array $config, string $privateDir): void
    {
        $store = new Store($privateDir . '/var');
        $path = (string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
        $pos = strpos($path, '/api');
        $route = rtrim($pos === false ? $path : substr($path, $pos + 4), '/');

        $ip = CloudflareIps::clientIp((string) ($_SERVER['REMOTE_ADDR'] ?? 'local'), isset($_SERVER['HTTP_CF_CONNECTING_IP']) ? (string) $_SERVER['HTTP_CF_CONNECTING_IP'] : null, !empty($config['trust_cf_connecting_ip']));
        if (!$store->rateAllow($ip, 30, 60000)) {
            Http::json(429, ['error' => 'Too many requests. Please wait a minute.']);
            return;
        }
        if (!in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', ['GET', 'HEAD'], true)) {
            header('Allow: GET, HEAD');
            Http::json(405, ['error' => 'Method not allowed']);
            return;
        }

        $opensky = new OpenSky($config['opensky_client_id'] ?? null, $config['opensky_client_secret'] ?? null, $store);
        $adb = new AeroDataBox($config, $store);
        $routes = new RouteLookup($store);
        switch ($route) {
            case '/config':
                Http::json(200, [
                    'liveAvailable' => $opensky->configured() || $adb->configured(),
                    'provider' => $adb->configured() ? 'AeroDataBox + OpenSky Network' : 'OpenSky Network',
                    'providers' => ['opensky' => $opensky->configured(), 'aerodatabox' => $adb->configured(), 'routes' => true],
                ]);
                return;
            case '/flights':
                self::flights($opensky, $adb, $routes);
                return;
            case '/weather':
                self::weather($store);
                return;
            default:
                Http::json(404, ['error' => 'Unknown endpoint']);
        }
    }

    private static function param(string $name): string
    {
        return isset($_GET[$name]) && is_string($_GET[$name]) ? $_GET[$name] : '';
    }

    private static function flights(OpenSky $opensky, AeroDataBox $adb, RouteLookup $routes): void
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
            $airborne = false;
            foreach ($flights as $f) {
                $airborne = $airborne || $f['position'] !== null;
            }
            Http::json(200, [
                'mode' => 'live', 'flights' => $flights, 'fetchedAt' => Flight::iso($times ? min($times) : $now), 'cached' => $cached,
                'source' => $sources ? implode(' · ', $sources) : 'No provider answered', 'sources' => $sources, 'notes' => $notes,
                'refreshSeconds' => $airborne ? OpenSky::SNAPSHOT_SECONDS : 600,
            ]);
        } catch (OpenSkyError $e) {
            Http::json(502, ['error' => $e->getMessage()]);
        } catch (\Throwable $e) {
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
