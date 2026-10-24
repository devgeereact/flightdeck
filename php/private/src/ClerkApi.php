<?php
declare(strict_types=1);

namespace Flightdeck;

/**
 * Read-only user statistics for the owner console, from Clerk's Backend API. Needs the Clerk SECRET key, which lives only in the
 * private server config and is used by nothing else. Results are cached for five minutes so the console never hammers Clerk.
 */
final class ClerkApi
{
    public const CACHE_MS = 300000;
    private const BASE = 'https://api.clerk.com/v1';

    private $secret;
    private $store;
    private $http;

    public function __construct(?string $secret, Store $store, ?callable $http = null)
    {
        $this->secret = is_string($secret) && preg_match('/^sk_(test|live)_[A-Za-z0-9]+$/D', trim($secret)) ? trim($secret) : null;
        $this->store = $store;
        $this->http = $http ?? [Http::class, 'request'];
    }

    public function configured(): bool
    {
        return $this->secret !== null;
    }

    private function get(string $path, array $query = [])
    {
        [$status, $body] = ($this->http)('GET', self::BASE . $path . ($query ? '?' . http_build_query($query) : ''), ['Authorization: Bearer ' . $this->secret, 'Accept: application/json'], null, 10);
        if ($status === 401 || $status === 403) {
            throw new \RuntimeException('Clerk rejected the secret key.');
        }
        $d = $status === 200 ? json_decode($body, true) : null;
        if ($d === null) {
            throw new \RuntimeException('Clerk is not answering right now.');
        }
        return $d;
    }

    private function total(array $query = []): int
    {
        $d = $this->get('/users/count', $query);
        return is_array($d) ? (int) ($d['total_count'] ?? 0) : 0;
    }

    /**
     * @return array{configured:bool,error?:string,total?:int,signups7?:int,signups30?:int,active7?:int,active30?:int,newest?:array}
     */
    public function summary(?int $nowMs = null): array
    {
        if (!$this->configured()) {
            return ['configured' => false];
        }
        $hit = $this->store->get('clerk-summary');
        if (is_array($hit)) {
            return $hit;
        }
        $now = $nowMs ?? Store::nowMs();
        $day = 86400000;
        try {
            $list = $this->get('/users', ['limit' => 10, 'order_by' => '-created_at']);
            $newest = [];
            foreach (is_array($list) ? $list : [] as $u) {
                if (!is_array($u)) {
                    continue;
                }
                $email = null;
                foreach ((array) ($u['email_addresses'] ?? []) as $e) {
                    if (is_array($e) && ($e['id'] ?? null) === ($u['primary_email_address_id'] ?? null)) {
                        $email = $e['email_address'] ?? null;
                    }
                }
                $newest[] = ['id' => (string) ($u['id'] ?? ''), 'email' => is_string($email) ? $email : null, 'createdAt' => (int) ($u['created_at'] ?? 0),
                    'lastActiveAt' => isset($u['last_active_at']) ? (int) $u['last_active_at'] : null, 'lastSignInAt' => isset($u['last_sign_in_at']) ? (int) $u['last_sign_in_at'] : null];
            }
            $out = [
                'configured' => true, 'fetchedAt' => $now, 'total' => $this->total(),
                'signups7' => $this->total(['created_at_after' => $now - 7 * $day]), 'signups30' => $this->total(['created_at_after' => $now - 30 * $day]),
                'active7' => $this->total(['last_active_at_after' => $now - 7 * $day]), 'active30' => $this->total(['last_active_at_after' => $now - 30 * $day]),
                'newest' => $newest,
            ];
        } catch (\Throwable $e) {
            return ['configured' => true, 'error' => $e->getMessage()];
        }
        $this->store->put('clerk-summary', $out, self::CACHE_MS);
        return $out;
    }
}
