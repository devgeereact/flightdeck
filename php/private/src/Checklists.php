<?php
declare(strict_types=1);

namespace Flightdeck;

/**
 * One small JSON document per signed-in user: their checklist edits and per-trip ticks (the default list ships in the app).
 * Files are named by a hash of the Clerk user id, never the id itself. Writes are atomic and checked against a revision so two
 * devices cannot silently overwrite each other (the loser gets a conflict and merges). The document is validated field by field:
 * unknown keys are dropped and nothing arbitrary is stored.
 */
final class Checklists
{
    public const MAX_BYTES = 65536;
    public const MAX_TRIPS = 12;
    public const MAX_ADDED = 250;
    public const MAX_LABEL = 80;
    public const MAX_NAME = 60;

    private $dir;

    public function __construct(string $varDir)
    {
        $this->dir = $varDir . '/checklists';
        if (!is_dir($this->dir) && !@mkdir($this->dir, 0700, true) && !is_dir($this->dir)) {
            throw new \RuntimeException('Storage directory is not writable.');
        }
    }

    private function path(string $sub): string
    {
        return $this->dir . '/' . hash('sha256', $sub) . '.json';
    }

    private static function id($v): ?string
    {
        return is_string($v) && preg_match('/^[A-Za-z0-9._-]{1,64}$/D', $v) ? $v : null;
    }

    private static function text($v, int $max): ?string
    {
        if (!is_string($v)) {
            return null;
        }
        $t = trim((string) preg_replace('/\s+/u', ' ', $v));
        return $t === '' ? null : mb_substr($t, 0, $max);
    }

    private static function ts($v): int
    {
        return (is_int($v) || (is_float($v) && $v == (int) $v)) && $v >= 0 && $v < 4102444800000 ? (int) $v : 0;
    }

    /** @return array|null the normalised document, or null when it is not a valid checklist document */
    public static function validate($d): ?array
    {
        if (!is_array($d) || ($d['v'] ?? null) !== 1) {
            return null;
        }
        $tpl = is_array($d['tpl'] ?? null) ? $d['tpl'] : [];
        $out = ['v' => 1, 'tpl' => ['updatedAt' => self::ts($tpl['updatedAt'] ?? 0), 'hidden' => [], 'renamed' => new \stdClass(), 'added' => []], 'trips' => [], 'gone' => new \stdClass(), 'active' => null];
        foreach (is_array($tpl['hidden'] ?? null) ? array_slice($tpl['hidden'], 0, 400) : [] as $h) {
            if (($id = self::id($h)) !== null) {
                $out['tpl']['hidden'][] = $id;
            }
        }
        $renamed = [];
        foreach (is_array($tpl['renamed'] ?? null) ? array_slice($tpl['renamed'], 0, 400, true) : [] as $k => $v) {
            if (($id = self::id((string) $k)) !== null && ($t = self::text($v, self::MAX_LABEL)) !== null) {
                $renamed[$id] = $t;
            }
        }
        $out['tpl']['renamed'] = $renamed ?: new \stdClass();
        foreach (is_array($tpl['added'] ?? null) ? $tpl['added'] : [] as $a) {
            if (count($out['tpl']['added']) >= self::MAX_ADDED) {
                return null;
            }
            if (is_array($a) && ($id = self::id($a['id'] ?? null)) !== null && ($sec = self::id($a['sec'] ?? null)) !== null && ($t = self::text($a['text'] ?? null, self::MAX_LABEL)) !== null) {
                $out['tpl']['added'][] = ['id' => $id, 'sec' => $sec, 'text' => $t];
            }
        }
        $trips = is_array($d['trips'] ?? null) ? $d['trips'] : [];
        if (count($trips) > self::MAX_TRIPS) {
            return null;
        }
        foreach ($trips as $t) {
            if (!is_array($t) || ($id = self::id($t['id'] ?? null)) === null) {
                continue;
            }
            $updated = self::ts($t['updatedAt'] ?? 0);
            $trip = ['id' => $id, 'name' => self::text($t['name'] ?? null, self::MAX_NAME) ?? 'My trip', 'metaAt' => isset($t['metaAt']) ? self::ts($t['metaAt']) : $updated, 'updatedAt' => $updated, 'marks' => []];
            // marks: item id -> time of its last tick (positive) or untick (negative); merged item by item so ticks from two devices both survive
            foreach (is_array($t['marks'] ?? null) ? array_slice($t['marks'], 0, 500, true) : [] as $k => $m) {
                if (($xid = self::id((string) $k)) !== null && (is_int($m) || is_float($m)) && $m != 0 && abs($m) < 4.1e12) {
                    $trip['marks'][$xid] = (int) $m;
                }
            }
            if (!$trip['marks']) {
                $trip['marks'] = new \stdClass();
            }
            $f = $t['flight'] ?? null;
            if (is_array($f) && is_string($f['number'] ?? null) && preg_match('/^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/D', $f['number']) && is_string($f['date'] ?? null) && preg_match('/^\d{4}-\d{2}-\d{2}$/D', $f['date'])) {
                $trip['flight'] = ['number' => $f['number'], 'date' => $f['date']];
            }
            $out['trips'][] = $trip;
        }
        $gone = [];
        foreach (is_array($d['gone'] ?? null) ? array_slice($d['gone'], 0, 100, true) : [] as $k => $v) {
            if (($id = self::id((string) $k)) !== null) {
                $gone[$id] = self::ts($v);
            }
        }
        $out['gone'] = $gone ?: new \stdClass();
        $active = self::id($d['active'] ?? null);
        $out['active'] = $active !== null ? $active : null;
        return $out;
    }

    /** @return array{rev:int,data:?array} */
    public function get(string $sub): array
    {
        $raw = @file_get_contents($this->path($sub));
        $d = $raw === false ? null : json_decode($raw, true);
        return is_array($d) && isset($d['rev'], $d['data']) ? ['rev' => (int) $d['rev'], 'data' => $d['data']] : ['rev' => 0, 'data' => null];
    }

    /**
     * Store a document if the caller saw the latest revision.
     * @return array{ok:bool,rev:int,data:?array} on conflict ok=false and data is the current document
     */
    public function put(string $sub, array $doc, int $baseRev): array
    {
        $path = $this->path($sub);
        $lock = fopen($path . '.lock', 'c');
        if ($lock === false) {
            throw new \RuntimeException('Checklist storage is not writable.');
        }
        try {
            flock($lock, LOCK_EX);
            $cur = $this->get($sub);
            if ($cur['rev'] !== $baseRev) {
                return ['ok' => false, 'rev' => $cur['rev'], 'data' => $cur['data']];
            }
            $next = $cur['rev'] + 1;
            $json = json_encode(['rev' => $next, 'updatedAt' => Store::nowMs(), 'data' => $doc], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
            $tmp = $path . '.' . bin2hex(random_bytes(4)) . '.tmp';
            if ($json === false || @file_put_contents($tmp, $json) === false) {
                throw new \RuntimeException('Checklist storage is not writable.');
            }
            @chmod($tmp, 0600);
            if (!@rename($tmp, $path)) {
                @unlink($tmp);
                throw new \RuntimeException('Checklist storage is not writable.');
            }
            return ['ok' => true, 'rev' => $next, 'data' => $doc];
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }
}
