<?php
declare(strict_types=1);

namespace Flightdeck;

/**
 * Last success and last failure of each data provider, for the owner console (Operations > Provider health). Recorded only when
 * a provider is really called (not for cache hits). Stores a failure category, never a response body, key or token.
 * One small file (var/health/providers.json), written once per request at shutdown.
 */
final class Health
{
    public const PROVIDERS = ['opensky' => 'OpenSky Network', 'aerodatabox' => 'AeroDataBox', 'adsbdb' => 'adsbdb', 'openmeteo' => 'Open-Meteo'];

    private static $file;
    private static $events = [];

    public static function init(string $varDir): void
    {
        self::$file = $varDir . '/health/providers.json';
        self::$events = [];
        register_shutdown_function([self::class, 'flush']);
    }

    /** What an HTTP status means for the owner. 0 is a network failure or timeout. */
    public static function category(int $status): string
    {
        if ($status === 0) {
            return 'no_response';
        }
        if ($status === 401 || $status === 403) {
            return 'rejected_credentials';
        }
        if ($status === 429) {
            return 'limit_reached';
        }
        return $status >= 500 ? 'provider_error' : 'unexpected_response';
    }

    public static function record(string $provider, bool $ok, int $status = 200, ?int $nowSec = null): void
    {
        if (self::$file === null || !isset(self::PROVIDERS[$provider])) {
            return;
        }
        self::$events[] = [$provider, $ok, $ok ? null : self::category($status), $nowSec ?? time()];
    }

    public static function flush(): void
    {
        if (self::$file === null || self::$events === []) {
            return;
        }
        $dir = dirname(self::$file);
        if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) {
            return;
        }
        $h = @fopen(self::$file . '.lock', 'c');
        if ($h === false) {
            return;
        }
        flock($h, LOCK_EX);
        try {
            $d = json_decode((string) @file_get_contents(self::$file), true);
            $d = is_array($d) ? $d : [];
            foreach (self::$events as [$p, $ok, $cat, $t]) {
                $cur = $d[$p] ?? ['lastOk' => null, 'lastFail' => null, 'lastFailCategory' => null, 'consecutiveFailures' => 0];
                if ($ok) {
                    $cur['lastOk'] = gmdate('c', $t);
                    $cur['consecutiveFailures'] = 0;
                } else {
                    $cur['lastFail'] = gmdate('c', $t);
                    $cur['lastFailCategory'] = $cat;
                    $cur['consecutiveFailures'] = (int) $cur['consecutiveFailures'] + 1;
                }
                $d[$p] = $cur;
            }
            $tmp = self::$file . '.' . bin2hex(random_bytes(4)) . '.tmp';
            if (@file_put_contents($tmp, json_encode($d)) !== false) {
                @chmod($tmp, 0600);
                @rename($tmp, self::$file);
            }
            self::$events = [];
        } finally {
            flock($h, LOCK_UN);
            fclose($h);
        }
    }

    /** @return array<string, array> every known provider, with null times when it has not been called yet */
    public static function read(string $varDir): array
    {
        $d = json_decode((string) @file_get_contents($varDir . '/health/providers.json'), true);
        $d = is_array($d) ? $d : [];
        $out = [];
        foreach (self::PROVIDERS as $id => $name) {
            $out[$id] = ['name' => $name] + ($d[$id] ?? ['lastOk' => null, 'lastFail' => null, 'lastFailCategory' => null, 'consecutiveFailures' => 0]);
        }
        return $out;
    }
}
