<?php
declare(strict_types=1);

namespace Flightdeck;

/**
 * "Latest from the web" for a flight, through the Bright Data SERP API. OFF unless the private server config has
 * brightdata_key and brightdata_zone (it costs money per search, so the owner switches it on).
 *
 * Results are search-result links (title, snippet, site) shown as links to check. Since ADR-025 the same results are also read by
 * WebFacts, which may lift a gate, terminal, belt or boarding time out of them, but only after checking the flight number, the date,
 * the airport and the exact wording (see WebFacts). Cached 10 minutes per flight, date and airports, and capped per day
 * (brightdata_daily_cap, default 200 searches; brightdata_user_daily_cap, default 40 per signed-in user) so a busy day cannot run up
 * a bill. The counts are taken under a lock, so simultaneous searches cannot slip past the cap.
 */
final class WebCheck
{
    /** Flight trackers whose terms forbid reuse; their links are dropped so the card points at airlines and airports. */
    private const SKIP = ['flightaware.com', 'flightradar24.com', 'planefinder.net', 'radarbox.com', 'flightstats.com',
        // Social networks are not flight information (a Facebook page appeared among the first live results).
        'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'tiktok.com', 'linkedin.com'];

    /** True when a host is one of the skipped flight trackers or social networks (also used by WebFacts as a second line of defence). */
    public static function skipped(string $host): bool
    {
        $host = strtolower($host);
        foreach (self::SKIP as $s) {
            if ($host === $s || substr($host, -strlen('.' . $s)) === '.' . $s) {
                return true;
            }
        }
        return false;
    }

    /** The answer for the app: the longer `text` of each result is for the server only (WebFacts) and is not sent. */
    public static function forClient(array $r): array
    {
        if (isset($r['results']) && is_array($r['results'])) {
            $r['results'] = array_map(static function ($x) {
                unset($x['text']);
                return $x;
            }, $r['results']);
        }
        return $r;
    }

    public static function enabled(array $config): bool
    {
        return trim((string) ($config['brightdata_key'] ?? '')) !== '' && trim((string) ($config['brightdata_zone'] ?? '')) !== '';
    }

    /**
     * @param callable|null $post test seam: fn(string $url, array $headers, string $body): array{0:int,1:string}
     * @param string|null $who the signed-in user's id, for their daily allowance (null: the owner or a test, not limited per user)
     * @return array{status:string, results?:array, fetchedAt?:string}
     */
    public static function lookup(array $config, Store $store, string $number, string $date, string $from, string $to, ?callable $post = null, ?string $who = null): array
    {
        if (!self::enabled($config)) {
            return ['status' => 'off'];
        }
        $key = 'web-' . $number . '-' . $date . '-' . $from . '-' . $to;
        $hit = $store->get($key);
        if (is_array($hit)) {
            return $hit;
        }
        $allowed = $store->withLock('web-count', static function () use ($store, $config, $who): bool {
            $today = gmdate('Y-m-d', intdiv(Store::nowMs(), 1000));
            $day = 'web-count-' . $today;
            $used = (int) ($store->get($day) ?? 0);
            $userDay = $who !== null && $who !== '' ? 'web-user-' . substr(hash('sha256', $who), 0, 24) . '-' . $today : null;
            $userUsed = $userDay !== null ? (int) ($store->get($userDay) ?? 0) : 0;
            if ($used >= max(0, (int) ($config['brightdata_daily_cap'] ?? 200)) || ($userDay !== null && $userUsed >= max(0, (int) ($config['brightdata_user_daily_cap'] ?? 40)))) {
                return false;
            }
            $store->put($day, $used + 1, 2 * 86400000);
            if ($userDay !== null) {
                $store->put($userDay, $userUsed + 1, 2 * 86400000);
            }
            return true;
        }, 5000, static fn (): bool => false);
        if (!$allowed) {
            return ['status' => 'cap'];
        }
        $q = trim($number . ' ' . $from . ' ' . $to . ' flight status');
        $payload = json_encode([
            'zone' => (string) $config['brightdata_zone'],
            // q= first: Bright Data's SERP API documents that Google requests should not carry parameters before q.
            'url' => 'https://www.google.com/search?q=' . rawurlencode($q) . '&hl=en&gl=gb&brd_json=1',
            'format' => 'raw',
        ]);
        $headers = ['Authorization: Bearer ' . trim((string) $config['brightdata_key']), 'Content-Type: application/json'];
        $send = static function () use ($post, $headers, $payload): array {
            [$status, $body] = $post ? $post('https://api.brightdata.com/request', $headers, (string) $payload)
                : Http::request('POST', 'https://api.brightdata.com/request', $headers, (string) $payload, 20);
            $d = $status === 200 ? json_decode($body, true) : null;
            Health::record('brightdata', is_array($d), $status);
            return [$status, $d];
        };
        [$status, $d] = $send();
        // Google sometimes answers with a page that is not JSON; on 8 Nov 2026 the first search failed and the next worked. Try once
        // more for that, a rate limit, a server error or a timeout. A refused key or zone (4xx) is not retried: it cannot help. The
        // daily caps were already counted once above, so a retry never uses a second unit of them.
        if (!is_array($d) && ($status === 200 || $status === 0 || $status === 429 || $status >= 500)) {
            [$status, $d] = $send();
        }
        if (!is_array($d)) {
            return ['status' => 'error'];
        }
        $out = ['status' => 'ok', 'results' => self::results($d['organic'] ?? []), 'query' => $q, 'fetchedAt' => Flight::iso(Store::nowMs())];
        $store->put($key, $out, 600000);
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
            if (self::skipped($host)) {
                continue;
            }
            $site = preg_replace('/^www\./', '', $host);
            if (in_array($site, array_column($out, 'site'), true)) {
                continue; // one link per site: two Google results for the same flight added nothing
            }
            $out[] = [
                'title' => mb_substr(trim((string) ($r['title'] ?? $host)), 0, 120),
                'snippet' => mb_substr(trim((string) ($r['description'] ?? '')), 0, 240),
                // The longer text is only for WebFacts on the server; forClient() removes it before the answer leaves.
                'text' => mb_substr(trim((string) ($r['description'] ?? '')), 0, 600),
                'url' => $link,
                'site' => $site,
            ];
            if (count($out) === 4) {
                break;
            }
        }
        return $out;
    }
}
