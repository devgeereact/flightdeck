<?php
declare(strict_types=1);

namespace Flightdeck;

/** Owner-console logic: who is an admin, and how the stored counters become the numbers and charts the console shows. */
final class Admin
{
    /** Client-reported events that are allowed to be counted (counters only, no personal data). */
    public const EVENTS = ['landing_view', 'cta_click', 'pwa_install', 'consent_accept', 'consent_reject', 'checklist_created', 'checklist_completed', 'feedback_opened', 'signup_started'];

    /** Only the exact Clerk user ids listed in the private config. Everyone else is refused, whatever they type in the address bar. */
    public static function isAdmin(?string $sub, array $config): bool
    {
        $ids = $config['admin_user_ids'] ?? [];
        return $sub !== null && $sub !== '' && is_array($ids) && in_array($sub, $ids, true);
    }

    public static function audit(string $varDir, string $sub, string $action): void
    {
        $line = gmdate('c') . ' ' . substr(hash('sha256', $sub), 0, 10) . ' ' . preg_replace('/[^A-Za-z0-9_:. -]/', '', $action) . "\n";
        $f = $varDir . '/admin-audit.log';
        @file_put_contents($f, $line, FILE_APPEND | LOCK_EX);
        @chmod($f, 0600);
    }

    private static function sum(array $days, string $key): int
    {
        return array_sum(array_map(static function ($d) use ($key) {
            return (int) ($d['c'][$key] ?? 0);
        }, $days));
    }

    private static function top(array $days, string $map, int $n = 10): array
    {
        $t = [];
        foreach ($days as $d) {
            foreach ((array) ($d['m'][$map] ?? []) as $k => $v) {
                $t[$k] = ($t[$k] ?? 0) + (int) $v;
            }
        }
        arsort($t);
        $out = [];
        foreach (array_slice($t, 0, $n, true) as $k => $v) {
            $out[] = ['key' => (string) $k, 'count' => $v];
        }
        return $out;
    }

    /** @param array<int,array> $days output of Metrics::range */
    public static function overview(array $days): array
    {
        $series = static function (string $key) use ($days): array {
            return array_map(static function ($d) use ($key) {
                return (int) ($d['c'][$key] ?? 0);
            }, $days);
        };
        $searches = self::sum($days, 'search_total');
        $found = self::sum($days, 'search_found');
        $usual = self::sum($days, 'search_usual_route');
        $notFound = self::sum($days, 'search_notfound');
        $errors = self::sum($days, 'search_error');
        $accept = self::sum($days, 'consent_accept');
        $reject = self::sum($days, 'consent_reject');
        $hits = self::sum($days, 'adb_cache_hit');
        $calls = self::sum($days, 'adb_call');
        $latency = [];
        foreach ($days as $d) {
            foreach ((array) ($d['lat'] ?? []) as $p => $sn) {
                $latency[$p] = [($latency[$p][0] ?? 0) + (int) $sn[0], ($latency[$p][1] ?? 0) + (int) $sn[1]];
            }
        }
        $avgLatency = [];
        foreach ($latency as $p => [$sum, $n]) {
            $avgLatency[$p] = $n > 0 ? (int) round($sum / $n) : null;
        }
        $users = array_map(static function ($d) {
            return (int) $d['users'];
        }, $days);
        return [
            'days' => count($days),
            'dates' => array_map(static function ($d) {
                return $d['date'];
            }, $days),
            'series' => [
                'searches' => $series('search_total'), 'found' => $series('search_found'), 'errors' => $series('search_error'),
                'users' => $users, 'adbUnits' => $series('adb_units'), 'landingViews' => $series('landing_view'),
                'checklistsCreated' => $series('checklist_created'), 'enquiries' => $series('enquiry_received'),
            ],
            'totals' => [
                'searches' => $searches, 'found' => $found, 'usualRoute' => $usual, 'notFound' => $notFound, 'errors' => $errors,
                'successRate' => $searches > 0 ? round(($found + $usual) / $searches * 100, 1) : null,
                'activeUserDays' => array_sum($users), 'peakUsers' => $users ? max($users) : 0,
                'landingViews' => self::sum($days, 'landing_view'), 'ctaClicks' => self::sum($days, 'cta_click'),
                'pwaInstalls' => self::sum($days, 'pwa_install'), 'checklistsCreated' => self::sum($days, 'checklist_created'),
                'checklistsCompleted' => self::sum($days, 'checklist_completed'), 'checklistSaves' => self::sum($days, 'checklist_save'),
                'feedbackOpened' => self::sum($days, 'feedback_opened'), 'enquiries' => self::sum($days, 'enquiry_received'),
                'consentAccept' => $accept, 'consentReject' => $reject, 'consentOptIn' => ($accept + $reject) > 0 ? round($accept / ($accept + $reject) * 100, 1) : null,
                'rateLimited' => self::sum($days, 'rate_limited'), 'authDenied' => self::sum($days, 'auth_denied'),
                'adbCalls' => $calls, 'adbCacheHits' => $hits, 'adbUnits' => self::sum($days, 'adb_units'), 'adbErrors' => self::sum($days, 'adb_error'),
                'adbCacheRatio' => ($hits + $calls) > 0 ? round($hits / ($hits + $calls) * 100, 1) : null, 'adbUnitsSaved' => $hits * AeroDataBox::COST_UNITS,
                'openskyFetches' => self::sum($days, 'opensky_fetch'), 'openskyCacheHits' => self::sum($days, 'opensky_cache_hit'), 'openskyErrors' => self::sum($days, 'opensky_error'),
                'routeLookups' => self::sum($days, 'route_lookup'), 'routeCacheHits' => self::sum($days, 'route_cache_hit'),
                'searchesPerActiveUserDay' => array_sum($users) > 0 ? round($searches / array_sum($users), 1) : null,
            ],
            'top' => ['airlines' => self::top($days, 'airlines'), 'routes' => self::top($days, 'routes'), 'direction' => self::top($days, 'direction', 5), 'notFoundNumbers' => self::top($days, 'notfound', 10)],
            'latencyMs' => $avgLatency,
        ];
    }

    /** Allowance forecast for the paid-data plan, from this month's counted units. */
    public static function allowance(Store $store, array $config, ?int $nowSec = null): array
    {
        $now = $nowSec ?? time();
        $used = (int) ($store->get('adb-units-' . gmdate('Y-m', $now)) ?? 0);
        $cap = max(0, (int) ($config['aerodatabox_monthly_units'] ?? AeroDataBox::DEFAULT_MONTHLY_UNITS));
        $dayOfMonth = (int) gmdate('j', $now);
        $daysInMonth = (int) gmdate('t', $now);
        $perDay = $dayOfMonth > 0 ? $used / $dayOfMonth : 0;
        $left = max(0, $cap - $used);
        $daysLeft = $perDay > 0 ? (int) floor($left / $perDay) : null;
        return ['used' => $used, 'cap' => $cap, 'left' => $left, 'perDay' => round($perDay, 1), 'daysUntilEmpty' => $daysLeft,
            'runsOutBeforeMonthEnd' => $daysLeft !== null && $daysLeft < ($daysInMonth - $dayOfMonth), 'month' => gmdate('Y-m', $now)];
    }

    public static function system(array $config, Store $store, bool $clerkApi, bool $ga): array
    {
        return [
            'phpVersion' => PHP_VERSION, 'serverTime' => gmdate('c'),
            'signInEnforced' => !empty($config['clerk_issuer']), 'aerodatabox' => !empty($config['aerodatabox_key']),
            'opensky' => !empty($config['opensky_client_id']), 'clerkApi' => $clerkApi, 'googleAnalyticsApi' => $ga,
            'emailNotifications' => !empty($config['owner_email']), 'ai' => !empty($config['ai_enabled']), 'ads' => !empty($config['ads_enabled']),
            'trustCloudflareIp' => !empty($config['trust_cf_connecting_ip']),
        ];
    }
}
