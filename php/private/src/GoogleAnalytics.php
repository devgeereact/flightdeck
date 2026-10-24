<?php
declare(strict_types=1);

namespace Flightdeck;

/**
 * Read-only Google Analytics 4 numbers for the owner console, through a Google SERVICE ACCOUNT that has been added to the GA4 property
 * as a Viewer. The service-account key file lives in the private folder (mode 600) and is used for nothing else. Results are cached for
 * 15 minutes so the console never spends Google's API quota.
 */
final class GoogleAnalytics
{
    public const CACHE_MS = 900000;
    private const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
    private const TOKEN_URL = 'https://oauth2.googleapis.com/token';

    private $propertyId;
    private $account;
    private $store;
    private $http;

    /** @param array|null $serviceAccount decoded key file: client_email and private_key */
    public function __construct(?string $propertyId, ?array $serviceAccount, Store $store, ?callable $http = null)
    {
        $this->propertyId = is_string($propertyId) && preg_match('/^\d{5,15}$/D', trim($propertyId)) ? trim($propertyId) : null;
        $ok = is_array($serviceAccount) && is_string($serviceAccount['client_email'] ?? null) && filter_var($serviceAccount['client_email'], FILTER_VALIDATE_EMAIL)
            && is_string($serviceAccount['private_key'] ?? null) && strpos($serviceAccount['private_key'], 'BEGIN PRIVATE KEY') !== false;
        $this->account = $ok ? $serviceAccount : null;
        $this->store = $store;
        $this->http = $http ?? [Http::class, 'request'];
    }

    /** Load the key file safely: must be inside the private folder, a real file, and not readable by other users. */
    public static function loadKeyFile(?string $path, string $privateDir): ?array
    {
        if (!is_string($path) || $path === '') {
            return null;
        }
        $full = $path[0] === '/' ? $path : $privateDir . '/' . $path;
        $real = realpath($full);
        $root = realpath($privateDir);
        if ($real === false || $root === false || strpos($real, $root . DIRECTORY_SEPARATOR) !== 0 || !is_file($real)) {
            return null;
        }
        $d = json_decode((string) @file_get_contents($real), true);
        return is_array($d) ? $d : null;
    }

    public function configured(): bool
    {
        return $this->propertyId !== null && $this->account !== null;
    }

    private static function b64(string $s): string
    {
        return rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
    }

    private function token(int $now): string
    {
        $cached = $this->store->get('ga-token');
        if (is_string($cached)) {
            return $cached;
        }
        $claims = ['iss' => $this->account['client_email'], 'scope' => self::SCOPE, 'aud' => self::TOKEN_URL, 'iat' => $now, 'exp' => $now + 3600];
        $head = self::b64((string) json_encode(['alg' => 'RS256', 'typ' => 'JWT'])) . '.' . self::b64((string) json_encode($claims));
        if (!openssl_sign($head, $sig, $this->account['private_key'], OPENSSL_ALGO_SHA256)) {
            throw new \RuntimeException('The Google key file could not be used.');
        }
        [$status, $body] = ($this->http)('POST', self::TOKEN_URL, ['Content-Type: application/x-www-form-urlencoded'],
            http_build_query(['grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer', 'assertion' => $head . '.' . self::b64($sig)]), 10);
        $d = $status === 200 ? json_decode($body, true) : null;
        if (!is_array($d) || !is_string($d['access_token'] ?? null)) {
            throw new \RuntimeException('Google did not accept the service account.');
        }
        $this->store->put('ga-token', $d['access_token'], max(60, ((int) ($d['expires_in'] ?? 3600) - 120)) * 1000);
        return $d['access_token'];
    }

    private static function rows(array $report): array
    {
        $out = [];
        foreach ((array) ($report['rows'] ?? []) as $r) {
            $out[] = [array_map(static function ($x) {
                return (string) ($x['value'] ?? '');
            }, (array) ($r['dimensionValues'] ?? [])), array_map(static function ($x) {
                return (int) ($x['value'] ?? 0);
            }, (array) ($r['metricValues'] ?? []))];
        }
        return $out;
    }

    /** @return array{configured:bool,error?:string,fetchedAt?:int,totals?:array,series?:array,countries?:array,devices?:array,channels?:array} */
    public function summary(?int $nowSec = null): array
    {
        if (!$this->configured()) {
            return ['configured' => false];
        }
        $hit = $this->store->get('ga-summary');
        if (is_array($hit)) {
            return $hit;
        }
        $now = $nowSec ?? time();
        $reports = [
            ['dimensions' => [['name' => 'date']], 'metrics' => [['name' => 'activeUsers'], ['name' => 'sessions'], ['name' => 'screenPageViews']], 'dateRanges' => [['startDate' => '27daysAgo', 'endDate' => 'today']], 'orderBys' => [['dimension' => ['dimensionName' => 'date']]], 'limit' => 40],
            ['metrics' => [['name' => 'activeUsers'], ['name' => 'sessions'], ['name' => 'screenPageViews']], 'dateRanges' => [['startDate' => '6daysAgo', 'endDate' => 'today'], ['startDate' => '27daysAgo', 'endDate' => 'today']]],
            ['dimensions' => [['name' => 'country']], 'metrics' => [['name' => 'activeUsers']], 'dateRanges' => [['startDate' => '27daysAgo', 'endDate' => 'today']], 'orderBys' => [['metric' => ['metricName' => 'activeUsers'], 'desc' => true]], 'limit' => 6],
            ['dimensions' => [['name' => 'deviceCategory']], 'metrics' => [['name' => 'activeUsers']], 'dateRanges' => [['startDate' => '27daysAgo', 'endDate' => 'today']], 'orderBys' => [['metric' => ['metricName' => 'activeUsers'], 'desc' => true]], 'limit' => 5],
            ['dimensions' => [['name' => 'sessionDefaultChannelGroup']], 'metrics' => [['name' => 'sessions']], 'dateRanges' => [['startDate' => '27daysAgo', 'endDate' => 'today']], 'orderBys' => [['metric' => ['metricName' => 'sessions'], 'desc' => true]], 'limit' => 6],
        ];
        try {
            $token = $this->token($now);
            [$status, $body] = ($this->http)('POST', 'https://analyticsdata.googleapis.com/v1beta/properties/' . $this->propertyId . ':batchRunReports',
                ['Authorization: Bearer ' . $token, 'Content-Type: application/json'], (string) json_encode(['requests' => $reports]), 15);
            if ($status === 401 || $status === 403) {
                $this->store->forget('ga-token');
                throw new \RuntimeException('Google refused access. Add the service account to the Analytics property as a Viewer and enable the Analytics Data API.');
            }
            $d = $status === 200 ? json_decode($body, true) : null;
            if (!is_array($d) || count((array) ($d['reports'] ?? [])) !== 5) {
                throw new \RuntimeException('Google Analytics is not answering right now.');
            }
        } catch (\Throwable $e) {
            return ['configured' => true, 'error' => $e->getMessage()];
        }
        $r = $d['reports'];
        $series = [];
        foreach (self::rows($r[0]) as [$dim, $m]) {
            $day = preg_match('/^(\d{4})(\d{2})(\d{2})$/D', $dim[0] ?? '', $x) ? "$x[1]-$x[2]-$x[3]" : null;
            if ($day !== null) {
                $series[] = ['date' => $day, 'users' => $m[0] ?? 0, 'sessions' => $m[1] ?? 0, 'pageViews' => $m[2] ?? 0];
            }
        }
        $tot = ['7' => ['users' => 0, 'sessions' => 0, 'pageViews' => 0], '28' => ['users' => 0, 'sessions' => 0, 'pageViews' => 0]];
        foreach (self::rows($r[1]) as [$dim, $m]) {
            $key = ($dim[0] ?? '') === 'date_range_0' ? '7' : '28';
            $tot[$key] = ['users' => $m[0] ?? 0, 'sessions' => $m[1] ?? 0, 'pageViews' => $m[2] ?? 0];
        }
        $rank = static function (array $rep): array {
            return array_map(static function ($row) {
                return ['key' => $row[0][0] !== '' ? $row[0][0] : '(not set)', 'count' => $row[1][0] ?? 0];
            }, self::rows($rep));
        };
        $out = ['configured' => true, 'fetchedAt' => $now * 1000, 'totals' => $tot, 'series' => $series, 'countries' => $rank($r[2]), 'devices' => $rank($r[3]), 'channels' => $rank($r[4])];
        $this->store->put('ga-summary', $out, self::CACHE_MS);
        return $out;
    }
}
