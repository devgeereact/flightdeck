<?php
declare(strict_types=1);

namespace Flightdeck;

/**
 * Callsign -> usual origin/destination via adsbdb (free, no key).
 * Route data belongs to its authors and may not be copied into other databases, so results are only
 * held in a short-lived cache, never stored permanently. A callsign's route is the usual one, not
 * proof of today's routing (diversions and swaps are not reflected).
 */
final class RouteLookup
{
    public const FOUND_MS = 3600000;
    public const MISS_MS = 600000;
    public const FAIL_MS = 60000;

    private $store;
    private $http;

    public function __construct(Store $store, ?callable $http = null)
    {
        $this->store = $store;
        $this->http = $http ?? [Http::class, 'request'];
    }

    /** @return array{origin:array,destination:array}|null */
    public function lookup(string $callsign): ?array
    {
        $callsign = strtoupper(trim($callsign));
        if (!preg_match('/^[A-Z0-9]{3,8}$/D', $callsign)) {
            return null;
        }
        $key = 'route-' . $callsign;
        $hit = $this->store->get($key);
        if ($hit !== null) {
            Metrics::count('route_cache_hit');
        }
        if (is_array($hit)) {
            return isset($hit['origin'], $hit['destination']) ? $hit : null;
        }
        if ($hit === 'none') {
            return null;
        }
        Metrics::count('route_lookup');
        [$status, $body] = ($this->http)('GET', 'https://api.adsbdb.com/v0/callsign/' . rawurlencode($callsign), ['User-Agent: Flightdeck/1.0 (+https://flightdeck.gakinz.com)', 'Accept: application/json'], null, 8);
        Health::record('adsbdb', in_array($status, [200, 400, 404], true), $status); // 404: no route known, a valid answer
        if ($status === 404 || $status === 400) {
            $this->store->put($key, 'none', self::MISS_MS);
            return null;
        }
        $d = $status === 200 ? json_decode($body, true) : null;
        $route = is_array($d) && isset($d['response']['flightroute']) && is_array($d['response']['flightroute']) ? $d['response']['flightroute'] : null;
        $origin = $route ? self::airport($route['origin'] ?? null) : null;
        $destination = $route ? self::airport($route['destination'] ?? null) : null;
        if ($origin === null || $destination === null) {
            $this->store->put($key, 'none', $status === 200 ? self::MISS_MS : self::FAIL_MS);
            return null;
        }
        $found = ['origin' => $origin, 'destination' => $destination];
        $this->store->put($key, $found, self::FOUND_MS);
        return $found;
    }

    private static function airport($a): ?array
    {
        if (!is_array($a)) {
            return null;
        }
        $code = $a['iata_code'] ?? ($a['icao_code'] ?? null);
        $lat = $a['latitude'] ?? null;
        $lon = $a['longitude'] ?? null;
        if (!is_string($code) || $code === '' || !(is_int($lat) || is_float($lat)) || !(is_int($lon) || is_float($lon))) {
            return null;
        }
        $str = static function ($v): string {
            return is_string($v) ? $v : '';
        };
        return [
            'code' => $code, 'name' => $str($a['name'] ?? '') ?: $code, 'city' => $str($a['municipality'] ?? ''),
            'country' => $str($a['country_name'] ?? ''), 'countryCode' => $str($a['country_iso_name'] ?? '') ?: null, 'timezone' => null, 'lat' => $lat, 'lon' => $lon,
        ];
    }
}
