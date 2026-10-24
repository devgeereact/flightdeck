<?php
declare(strict_types=1);

namespace Flightdeck;

final class AeroDataBoxError extends \RuntimeException
{
}

/**
 * AeroDataBox via RapidAPI: scheduled/estimated times, gates, terminals, baggage, aircraft, status.
 * Free Basic plan: 400 units a month, personal use, attribution required. "Flight status" is Tier 2 (2 units),
 * so every outbound call is counted BEFORE it is made and refused once the configured allowance is used.
 */
final class AeroDataBox
{
    public const COST_UNITS = 2;
    public const CACHE_MS = 600000;
    public const DEFAULT_MONTHLY_UNITS = 360;
    public const DEFAULT_HOURLY_CALLS = 12;

    private $key;
    private $host;
    private $monthly;
    private $hourly;
    private $store;
    private $http;

    public function __construct(array $config, Store $store, ?callable $http = null)
    {
        $this->key = is_string($config['aerodatabox_key'] ?? null) ? trim($config['aerodatabox_key']) : '';
        $host = $config['aerodatabox_host'] ?? 'aerodatabox.p.rapidapi.com';
        $this->host = is_string($host) && preg_match('/^[a-z0-9.-]+$/Di', $host) ? $host : 'aerodatabox.p.rapidapi.com';
        $this->monthly = max(0, (int) ($config['aerodatabox_monthly_units'] ?? self::DEFAULT_MONTHLY_UNITS));
        $this->hourly = max(0, (int) ($config['aerodatabox_hourly_calls'] ?? self::DEFAULT_HOURLY_CALLS));
        $this->store = $store;
        $this->http = $http ?? [Http::class, 'request'];
    }

    public function configured(): bool
    {
        return $this->key !== '';
    }

    /** @return array{unitsUsed:int,unitsAllowed:int} for the current UTC month */
    public function usage(): array
    {
        return ['unitsUsed' => (int) ($this->store->get('adb-units-' . gmdate('Y-m')) ?? 0), 'unitsAllowed' => $this->monthly];
    }

    /** @return array{0:array,1:bool,2:int} raw flights, served-from-cache, fetched-at (ms) */
    public function fetch(string $number, string $date): array
    {
        $cacheKey = 'adb-' . sha1($number . '|' . $date);
        $hit = $this->store->get($cacheKey);
        if (is_array($hit) && isset($hit['flights'], $hit['fetchedAt'])) {
            return [$hit['flights'], true, $hit['fetchedAt']];
        }
        return $this->store->withLock('adb', function () use ($number, $date, $cacheKey) {
            $hit = $this->store->get($cacheKey);
            if (is_array($hit) && isset($hit['flights'], $hit['fetchedAt'])) {
                return [$hit['flights'], true, $hit['fetchedAt']];
            }
            if ($this->store->get('adb-cooldown') !== null) {
                throw new AeroDataBoxError('Scheduled flight details are paused for a few minutes.');
            }
            $this->spend();
            [$status, $body] = ($this->http)(
                'GET',
                'https://' . $this->host . '/flights/number/' . rawurlencode($number) . '/' . $date . '?dateLocalRole=Both&withAircraftImage=false&withLocation=false&withFlightPlan=false',
                ['X-RapidAPI-Key: ' . $this->key, 'X-RapidAPI-Host: ' . $this->host, 'Accept: application/json'],
                null,
                15
            );
            if ($status === 401 || $status === 403) {
                $this->store->put('adb-cooldown', 1, 300000);
                throw new AeroDataBoxError(stripos($body, 'not subscribed') !== false
                    ? 'The RapidAPI key is not subscribed to the AeroDataBox API yet.'
                    : 'The AeroDataBox key was rejected.');
            }
            if ($status === 429) {
                $this->store->put('adb-cooldown', 1, 600000);
                throw new AeroDataBoxError('AeroDataBox allowance reached. Scheduled details are paused for now.');
            }
            if ($status !== 200 && $status !== 204) {
                throw new AeroDataBoxError('Scheduled flight details are temporarily unavailable.');
            }
            $flights = [];
            if ($status === 200) {
                $d = json_decode($body, true);
                if (!is_array($d)) {
                    throw new AeroDataBoxError('Scheduled flight details are temporarily unavailable.');
                }
                $flights = array_values(array_filter($d, 'is_array'));
            }
            $now = Store::nowMs();
            $this->store->put($cacheKey, ['flights' => $flights, 'fetchedAt' => $now], self::CACHE_MS);
            return [$flights, false, $now];
        });
    }

    /** Count a call before making it; refuse when the monthly or hourly allowance is gone. */
    private function spend(): void
    {
        $monthKey = 'adb-units-' . gmdate('Y-m');
        $hourKey = 'adb-calls-' . gmdate('Y-m-d-H');
        $units = (int) ($this->store->get($monthKey) ?? 0);
        $calls = (int) ($this->store->get($hourKey) ?? 0);
        if ($units + self::COST_UNITS > $this->monthly) {
            throw new AeroDataBoxError('The monthly allowance for scheduled flight details is used up.');
        }
        if ($calls >= $this->hourly) {
            throw new AeroDataBoxError('Scheduled flight details are limited per hour. Try again later.');
        }
        $this->store->put($monthKey, $units + self::COST_UNITS, 45 * 86400000);
        $this->store->put($hourKey, $calls + 1, 2 * 3600000);
    }
}
