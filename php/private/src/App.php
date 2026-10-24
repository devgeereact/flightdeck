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

        $ip = $_SERVER['REMOTE_ADDR'] ?? 'local';
        if (!empty($config['trust_cf_connecting_ip']) && !empty($_SERVER['HTTP_CF_CONNECTING_IP'])
            && filter_var($_SERVER['HTTP_CF_CONNECTING_IP'], FILTER_VALIDATE_IP)) {
            $ip = $_SERVER['HTTP_CF_CONNECTING_IP'];
        }
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
        switch ($route) {
            case '/config':
                Http::json(200, ['liveAvailable' => $opensky->configured(), 'provider' => 'OpenSky Network']);
                return;
            case '/flights':
                self::flights($opensky);
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

    private static function flights(OpenSky $opensky): void
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
        if (!$opensky->configured()) {
            Http::json(503, ['error' => 'Live flights need OpenSky API credentials on the server. Sample mode is available now.']);
            return;
        }
        try {
            [$states, $cached, $fetchedAt] = $opensky->states();
            $flights = array_map(static function (array $s) use ($number) {
                return Flight::stateToFlight($s, $number);
            }, array_slice(Flight::matchStates($states, $number), 0, 20));
            Http::json(200, [
                'mode' => 'live', 'flights' => $flights, 'fetchedAt' => Flight::iso($fetchedAt), 'cached' => $cached,
                'source' => 'OpenSky Network — live aircraft position only; the date is not used', 'refreshSeconds' => OpenSky::SNAPSHOT_SECONDS,
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
