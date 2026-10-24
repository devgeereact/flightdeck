<?php
declare(strict_types=1);

namespace Flightdeck;

/**
 * First-party usage counters for the owner console. Daily aggregate files only: counts, small "top N" maps (airline, route, ...) and
 * a per-day set of hashed user ids used ONLY to count distinct signed-in users. No IP addresses, no flight number tied to a user,
 * no cookies. The user hash is salted per day with a random server-side salt, so a person cannot be followed from one day to the next,
 * and the hash lists are compacted to a plain number after two days. Daily files are deleted after 400 days.
 * Increments are buffered in memory and written once at the end of the request.
 */
final class Metrics
{
    private const MAP_CAP = 200;
    private const KEEP_DAYS = 400;

    private static $inst = null;
    private $dir;
    private $c = [];
    private $m = [];
    private $u = [];
    private $lat = [];

    private function __construct(string $varDir)
    {
        $this->dir = $varDir . '/metrics';
        if (!is_dir($this->dir)) {
            @mkdir($this->dir, 0700, true);
        }
    }

    public static function init(string $varDir): void
    {
        self::$inst = new self($varDir);
        register_shutdown_function([self::$inst, 'flush']);
    }

    /** Write what has been counted so far (the console calls this so it never shows data one request behind). */
    public static function flushNow(): void
    {
        if (self::$inst !== null) {
            self::$inst->flush();
        }
    }

    public static function instance(): ?self
    {
        return self::$inst;
    }

    private static function name(string $n): string
    {
        return substr((string) preg_replace('/[^A-Za-z0-9_.>-]/', '', $n), 0, 40);
    }

    public static function count(string $name, int $by = 1): void
    {
        if (self::$inst !== null && ($n = self::name($name)) !== '') {
            self::$inst->c[$n] = (self::$inst->c[$n] ?? 0) + $by;
        }
    }

    public static function tally(string $map, string $key, int $by = 1): void
    {
        if (self::$inst !== null && ($m = self::name($map)) !== '' && ($k = self::name($key)) !== '') {
            self::$inst->m[$m][$k] = (self::$inst->m[$m][$k] ?? 0) + $by;
        }
    }

    public static function latency(string $provider, int $ms): void
    {
        if (self::$inst !== null && ($p = self::name($provider)) !== '') {
            $cur = self::$inst->lat[$p] ?? [0, 0];
            self::$inst->lat[$p] = [$cur[0] + max(0, $ms), $cur[1] + 1];
        }
    }

    public static function user(string $sub): void
    {
        if (self::$inst !== null && $sub !== '') {
            self::$inst->u[$sub] = true;
        }
    }

    private function salt(): string
    {
        $f = $this->dir . '/.salt';
        $s = @file_get_contents($f);
        if (!is_string($s) || strlen($s) < 32) {
            $s = bin2hex(random_bytes(24));
            @file_put_contents($f, $s);
            @chmod($f, 0600);
        }
        return $s;
    }

    private function file(string $date): string
    {
        return $this->dir . '/' . $date . '.json';
    }

    public function flush(?int $nowSec = null): void
    {
        if (!$this->c && !$this->m && !$this->u && !$this->lat) {
            return;
        }
        $date = gmdate('Y-m-d', $nowSec ?? time());
        $path = $this->file($date);
        $h = @fopen($path . '.lock', 'c');
        if ($h === false) {
            return;
        }
        try {
            flock($h, LOCK_EX);
            $cur = json_decode((string) @file_get_contents($path), true);
            $cur = is_array($cur) ? $cur : [];
            $cur += ['c' => [], 'm' => [], 'u' => [], 'lat' => []];
            foreach ($this->c as $k => $v) {
                $cur['c'][$k] = ($cur['c'][$k] ?? 0) + $v;
            }
            foreach ($this->m as $map => $kv) {
                foreach ($kv as $k => $v) {
                    if (!isset($cur['m'][$map][$k]) && count($cur['m'][$map] ?? []) >= self::MAP_CAP) {
                        $k = '_other';
                    }
                    $cur['m'][$map][$k] = ($cur['m'][$map][$k] ?? 0) + $v;
                }
            }
            foreach ($this->lat as $p => [$sum, $n]) {
                $old = $cur['lat'][$p] ?? [0, 0];
                $cur['lat'][$p] = [$old[0] + $sum, $old[1] + $n];
            }
            if ($this->u) {
                $salt = $this->salt();
                $set = array_flip(is_array($cur['u']) ? $cur['u'] : []);
                foreach (array_keys($this->u) as $sub) {
                    if (count($set) < 5000) {
                        $set[substr(hash('sha256', $date . '|' . $salt . '|' . $sub), 0, 16)] = true;
                    }
                }
                $cur['u'] = array_keys($set);
            }
            $tmp = $path . '.' . bin2hex(random_bytes(3)) . '.tmp';
            if (@file_put_contents($tmp, json_encode($cur, JSON_UNESCAPED_SLASHES)) !== false) {
                @chmod($tmp, 0600);
                @rename($tmp, $path);
            }
            if (mt_rand(1, 100) === 1) {
                $this->prune($nowSec ?? time());
            }
        } finally {
            flock($h, LOCK_UN);
            fclose($h);
            $this->c = $this->m = $this->u = $this->lat = [];
        }
    }

    /** Old files go; recent per-day hashed-user lists collapse to a plain count. */
    private function prune(int $nowSec): void
    {
        foreach (glob($this->dir . '/????-??-??.json') ?: [] as $f) {
            $d = basename($f, '.json');
            $age = ($nowSec - (int) strtotime($d . ' 00:00:00 UTC')) / 86400;
            if ($age > self::KEEP_DAYS) {
                @unlink($f);
            } elseif ($age > 2) {
                $x = json_decode((string) @file_get_contents($f), true);
                if (is_array($x) && isset($x['u']) && is_array($x['u'])) {
                    $x['uc'] = count($x['u']);
                    unset($x['u']);
                    @file_put_contents($f, json_encode($x, JSON_UNESCAPED_SLASHES));
                }
            }
        }
    }

    /**
     * @return array<int,array{date:string,c:array,m:array,users:int,lat:array}> the last $days days, oldest first, missing days empty
     */
    public function range(int $days, ?int $nowSec = null): array
    {
        $days = max(1, min(self::KEEP_DAYS, $days));
        $now = $nowSec ?? time();
        $out = [];
        for ($i = $days - 1; $i >= 0; $i--) {
            $date = gmdate('Y-m-d', $now - $i * 86400);
            $x = json_decode((string) @file_get_contents($this->file($date)), true);
            $x = is_array($x) ? $x : [];
            $out[] = [
                'date' => $date, 'c' => (array) ($x['c'] ?? []), 'm' => (array) ($x['m'] ?? []),
                'users' => isset($x['uc']) ? (int) $x['uc'] : count((array) ($x['u'] ?? [])), 'lat' => (array) ($x['lat'] ?? []),
            ];
        }
        return $out;
    }
}
