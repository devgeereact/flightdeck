<?php
declare(strict_types=1);

namespace Flightdeck;

/**
 * "Latest from the web" for a flight, through the Bright Data SERP API. OFF unless the private server config has
 * brightdata_key and brightdata_zone (it costs money per search, so the owner switches it on).
 *
 * Results are search-result links (title, snippet, site) shown as links to check. They are never parsed into the flight's gate,
 * terminal or time fields: snippets mix dates and sources, and a wrong gate is worse than none. Cached 15 minutes per flight and
 * date, and capped per day (brightdata_daily_cap, default 150 searches) so a busy day cannot run up a bill.
 */
final class WebCheck
{
    /** Flight trackers whose terms forbid reuse; their links are dropped so the card points at airlines and airports. */
    private const SKIP = ['flightaware.com', 'flightradar24.com', 'planefinder.net', 'radarbox.com', 'flightstats.com'];

    public static function enabled(array $config): bool
    {
        return trim((string) ($config['brightdata_key'] ?? '')) !== '' && trim((string) ($config['brightdata_zone'] ?? '')) !== '';
    }

    /**
     * @param callable|null $post test seam: fn(string $url, array $headers, string $body): array{0:int,1:string}
     * @return array{status:string, results?:array, fetchedAt?:string}
     */
    public static function lookup(array $config, Store $store, string $number, string $date, string $from, string $to, ?callable $post = null): array
    {
        if (!self::enabled($config)) {
            return ['status' => 'off'];
        }
        $key = 'web-' . $number . '-' . $date;
        $hit = $store->get($key);
        if (is_array($hit)) {
            return $hit;
        }
        $day = 'web-count-' . gmdate('Y-m-d', intdiv(Store::nowMs(), 1000));
        $used = (int) ($store->get($day) ?? 0);
        if ($used >= max(0, (int) ($config['brightdata_daily_cap'] ?? 150))) {
            return ['status' => 'cap'];
        }
        $store->put($day, $used + 1, 2 * 86400000);
        $q = trim($number . ' ' . $from . ' ' . $to . ' flight status');
        $payload = json_encode([
            'zone' => (string) $config['brightdata_zone'],
            'url' => 'https://www.google.com/search?hl=en&gl=gb&brd_json=1&q=' . rawurlencode($q),
            'format' => 'raw',
        ]);
        $headers = ['Authorization: Bearer ' . trim((string) $config['brightdata_key']), 'Content-Type: application/json'];
        [$status, $body] = $post ? $post('https://api.brightdata.com/request', $headers, (string) $payload)
            : Http::request('POST', 'https://api.brightdata.com/request', $headers, (string) $payload, 20);
        $d = $status === 200 ? json_decode($body, true) : null;
        Health::record('brightdata', is_array($d), $status);
        if (!is_array($d)) {
            return ['status' => 'error'];
        }
        $out = ['status' => 'ok', 'results' => self::results($d['organic'] ?? []), 'query' => $q, 'fetchedAt' => Flight::iso(Store::nowMs())];
        $store->put($key, $out, 900000);
        return $out;
    }

    /** At most four https results from sites other than the skipped trackers. */
    public static function results($organic): array
    {
        $out = [];
        foreach (is_array($organic) ? $organic : [] as $r) {
            $link = (string) ($r['link'] ?? '');
            $host = strtolower((string) parse_url($link, PHP_URL_HOST));
            if (strpos($link, 'https://') !== 0 || $host === '') {
                continue;
            }
            foreach (self::SKIP as $s) {
                if ($host === $s || substr($host, -strlen('.' . $s)) === '.' . $s) {
                    continue 2;
                }
            }
            $out[] = [
                'title' => mb_substr(trim((string) ($r['title'] ?? $host)), 0, 120),
                'snippet' => mb_substr(trim((string) ($r['description'] ?? '')), 0, 240),
                'url' => $link,
                'site' => preg_replace('/^www\./', '', $host),
            ];
            if (count($out) === 4) {
                break;
            }
        }
        return $out;
    }
}
