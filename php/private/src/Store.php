<?php
declare(strict_types=1);

namespace Flightdeck;

/** Small file-backed cache, lock and rate limiter for shared hosting (no daemon or database). */
final class Store
{
    private $dir;

    public function __construct(string $dir)
    {
        $this->dir = $dir;
        foreach ([$dir, $dir . '/cache', $dir . '/rate'] as $d) {
            if (!is_dir($d) && !@mkdir($d, 0700, true) && !is_dir($d)) {
                throw new \RuntimeException('Storage directory is not writable.');
            }
        }
    }

    public static function nowMs(): int
    {
        return (int) floor(microtime(true) * 1000);
    }

    private function path(string $name): string
    {
        return $this->dir . '/cache/' . preg_replace('/[^a-z0-9._-]/i', '_', $name) . '.json';
    }

    public function get(string $name)
    {
        $raw = @file_get_contents($this->path($name));
        $d = $raw === false ? null : json_decode($raw, true);
        if (!is_array($d) || !isset($d['expires']) || $d['expires'] <= self::nowMs() || !array_key_exists('data', $d)) {
            return null;
        }
        return $d['data'];
    }

    public function put(string $name, $data, int $ttlMs): void
    {
        $path = $this->path($name);
        $tmp = $path . '.' . bin2hex(random_bytes(4)) . '.tmp';
        if (@file_put_contents($tmp, json_encode(['expires' => self::nowMs() + $ttlMs, 'data' => $data])) === false) {
            return;
        }
        @chmod($tmp, 0600);
        @rename($tmp, $path);
    }

    public function forget(string $name): void
    {
        @unlink($this->path($name));
    }

    /** Run $fn while holding an exclusive lock so only one request refreshes shared data. */
    public function withLock(string $name, callable $fn)
    {
        $h = fopen($this->dir . '/' . preg_replace('/[^a-z0-9._-]/i', '_', $name) . '.lock', 'c');
        if ($h === false) {
            return $fn();
        }
        flock($h, LOCK_EX);
        try {
            return $fn();
        } finally {
            flock($h, LOCK_UN);
            fclose($h);
        }
    }

    /** Fixed-window limiter. Returns false when the caller is over the limit. */
    public function rateAllow(string $key, int $limit, int $windowMs): bool
    {
        if (mt_rand(1, 100) === 1) {
            $cutoff = time() - 7200; // longer than the longest window used (one hour)
            foreach (glob($this->dir . '/rate/*.json') ?: [] as $f) {
                if (@filemtime($f) < $cutoff) {
                    @unlink($f);
                }
            }
        }
        $h = fopen($this->dir . '/rate/' . sha1($key) . '.json', 'c+');
        if ($h === false) {
            return true;
        }
        flock($h, LOCK_EX);
        $now = self::nowMs();
        $r = json_decode((string) stream_get_contents($h), true);
        if (!is_array($r) || !isset($r['reset'], $r['count']) || $r['reset'] < $now) {
            $r = ['count' => 0, 'reset' => $now + $windowMs];
        }
        $r['count']++;
        ftruncate($h, 0);
        rewind($h);
        fwrite($h, json_encode($r));
        flock($h, LOCK_UN);
        fclose($h);
        return $r['count'] <= $limit;
    }
}
