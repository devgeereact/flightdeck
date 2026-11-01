<?php
declare(strict_types=1);

namespace Flightdeck;

/**
 * A short travel guide for any destination city, from Wikivoyage (travel guide text) with Wikipedia as the fallback. Both are free,
 * need no key and are CC BY-SA, so the response carries the page link and licence for attribution. Cached for a week per city.
 */
final class Place
{
    private const UA = 'Flightdeck/1.0 (https://flightdeck.gakinz.com; personal flight tracker)';

    /** @param callable|null $get test seam: fn(string $url): array{0:int,1:string} */
    public static function lookup(Store $store, string $city, string $country, ?callable $get = null): ?array
    {
        $city = trim(preg_replace('/\s+/', ' ', $city) ?? '');
        $country = trim($country);
        if ($city === '' || mb_strlen($city) > 80 || mb_strlen($country) > 80) {
            return null;
        }
        $key = 'place-' . substr(sha1(mb_strtolower($city . '|' . $country)), 0, 20);
        $hit = $store->get($key);
        if (is_array($hit)) {
            return $hit;
        }
        $get = $get ?? static fn (string $url): array => Http::request('GET', $url, ['User-Agent: ' . self::UA, 'Accept: application/json'], null, 8);
        $out = null;
        foreach ([['en.wikivoyage.org', 'Wikivoyage'], ['en.wikipedia.org', 'Wikipedia']] as [$host, $name]) {
            $title = self::search($get, $host, $city . ($host === 'en.wikipedia.org' && $country !== '' ? ' ' . $country : ''));
            if ($title === null) {
                continue;
            }
            [$status, $body] = $get('https://' . $host . '/api/rest_v1/page/summary/' . rawurlencode(str_replace(' ', '_', $title)));
            $s = $status === 200 ? json_decode($body, true) : null;
            if (!is_array($s) || ($s['type'] ?? '') === 'disambiguation' || trim((string) ($s['extract'] ?? '')) === '') {
                continue;
            }
            // The page link comes from the provider; keep it only when it points at the guide's own site, else build it ourselves.
            $page = (string) ($s['content_urls']['desktop']['page'] ?? '');
            if (strpos($page, 'https://' . $host . '/wiki/') !== 0) {
                $page = 'https://' . $host . '/wiki/' . rawurlencode(str_replace(' ', '_', $title));
            }
            $out = [
                'title' => (string) ($s['title'] ?? $title),
                'summary' => self::trimText((string) $s['extract'], 600),
                'image' => self::image($s),
                'url' => $page,
                'source' => $name,
                'licence' => 'CC BY-SA 4.0',
                'sections' => $host === 'en.wikivoyage.org' ? [
                    ['label' => 'Getting in', 'url' => $page . '#Get_in'],
                    ['label' => 'Getting around', 'url' => $page . '#Get_around'],
                    ['label' => 'See', 'url' => $page . '#See'],
                    ['label' => 'Eat', 'url' => $page . '#Eat'],
                    ['label' => 'Stay safe', 'url' => $page . '#Stay_safe'],
                ] : [],
                'fetchedAt' => Flight::iso(Store::nowMs()),
            ];
            break;
        }
        Health::record('wikimedia', $out !== null, $out !== null ? 200 : 404);
        // Misses are cached too (for a day) so an unknown city does not hit Wikimedia on every view.
        $store->put($key, $out ?? ['missing' => true], $out !== null ? 7 * 86400000 : 86400000);
        return $out;
    }

    private static function search(callable $get, string $host, string $q): ?string
    {
        [$status, $body] = $get('https://' . $host . '/w/api.php?action=query&list=search&srlimit=1&format=json&srsearch=' . rawurlencode($q));
        $d = $status === 200 ? json_decode($body, true) : null;
        $t = $d['query']['search'][0]['title'] ?? null;
        return is_string($t) && $t !== '' ? $t : null;
    }

    /** Only Wikimedia's own image host, so the page CSP can stay narrow. */
    private static function image(array $s): ?string
    {
        $src = (string) ($s['thumbnail']['source'] ?? '');
        if (!preg_match('#^https://(upload|thumb)\.wikimedia\.org/#', $src)) {
            return null;
        }
        // The summary thumbnail is 330 px wide; ask for 640 px for the card, and drop the tracking query.
        return preg_replace('#/330px-#', '/640px-', strtok($src, '?') ?: $src);
    }

    private static function trimText(string $t, int $max): string
    {
        $t = trim(preg_replace('/\s+/', ' ', $t) ?? '');
        if (mb_strlen($t) <= $max) {
            return $t;
        }
        $cut = mb_substr($t, 0, $max);
        $dot = mb_strrpos($cut, '. ');
        return $dot !== false && $dot > $max / 2 ? mb_substr($cut, 0, $dot + 1) : rtrim($cut) . '…';
    }
}
