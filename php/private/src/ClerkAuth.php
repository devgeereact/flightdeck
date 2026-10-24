<?php
declare(strict_types=1);

namespace Flightdeck;

/**
 * Verifies a Clerk session token (RS256 JWT) against the instance's public key set, so only signed-in users can call the
 * paid/limited endpoints. No Clerk secret key is needed: the keys at <issuer>/.well-known/jwks.json are public.
 * Fails closed: if enforcement is on and the keys cannot be fetched, requests are refused (503), never let through.
 */
final class ClerkAuth
{
    public const JWKS_TTL_MS = 3600000;
    public const REFRESH_COOLDOWN_MS = 60000;
    private const MAX_TOKEN = 4096;

    private $issuer;
    private $store;
    private $http;
    private $parties;

    /** @param string[] $authorizedParties allowed `azp` origins; empty means do not check azp */
    public function __construct(?string $issuer, Store $store, ?callable $http = null, array $authorizedParties = [])
    {
        $this->issuer = $issuer !== null && preg_match('#^https://[a-z0-9.-]+\.[a-z]{2,}$#D', $issuer) ? $issuer : null;
        $this->store = $store;
        $this->http = $http ?? [Http::class, 'request'];
        $this->parties = $authorizedParties;
    }

    public function enabled(): bool
    {
        return $this->issuer !== null;
    }

    /** "pk_test_<base64 of host$>" -> https://host (the Frontend API, which is the token issuer). */
    public static function issuerFromPublishableKey(?string $key): ?string
    {
        if ($key === null || !preg_match('/^pk_(?:test|live)_([A-Za-z0-9+\/=_-]+)$/D', $key, $m)) {
            return null;
        }
        $host = base64_decode(strtr($m[1], '-_', '+/'), true);
        $host = $host === false ? '' : rtrim($host, '$');
        return preg_match('/^[a-z0-9.-]+\.[a-z]{2,}$/D', $host) ? 'https://' . $host : null;
    }

    /** Pull the token out of "Bearer <token>" (or a bare token from the fallback header). */
    public static function tokenFrom(?string $authorization, ?string $fallback): ?string
    {
        foreach ([$authorization, $fallback] as $v) {
            if (is_string($v) && $v !== '') {
                $t = preg_match('/^Bearer\s+(\S+)$/i', trim($v), $m) ? $m[1] : (strpos($v, ' ') === false ? trim($v) : null);
                if ($t !== null && $t !== '') {
                    return $t;
                }
            }
        }
        return null;
    }

    /**
     * @return array{ok:bool,status:int,error:?string,sub:?string}
     */
    public function check(?string $token, ?int $now = null): array
    {
        $deny = static function (int $status, string $error): array {
            return ['ok' => false, 'status' => $status, 'error' => $error, 'sub' => null];
        };
        if ($this->issuer === null) {
            return ['ok' => true, 'status' => 200, 'error' => null, 'sub' => null];
        }
        if ($token === null || strlen($token) > self::MAX_TOKEN || !preg_match('/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/D', $token)) {
            return $deny(401, 'Sign in to search flights.');
        }
        [$h64, $p64, $s64] = explode('.', $token);
        $header = json_decode((string) self::b64($h64), true);
        $claims = json_decode((string) self::b64($p64), true);
        $sig = self::b64($s64);
        if (!is_array($header) || !is_array($claims) || $sig === null || ($header['alg'] ?? null) !== 'RS256' || !is_string($header['kid'] ?? null)) {
            return $deny(401, 'Sign in to search flights.');
        }
        $keys = $this->keys(false);
        if ($keys === null) {
            return $deny(503, 'Sign-in verification is temporarily unavailable.');
        }
        $jwk = $this->find($keys, $header['kid']);
        if ($jwk === null) {
            // A rotated key: refresh once (rate limited) before refusing.
            $keys = $this->keys(true);
            $jwk = $keys === null ? null : $this->find($keys, $header['kid']);
        }
        $pem = $jwk === null ? null : self::pem($jwk);
        if ($pem === null || openssl_verify($h64 . '.' . $p64, $sig, $pem, OPENSSL_ALGO_SHA256) !== 1) {
            return $deny(401, 'Your session is not valid. Please sign in again.');
        }
        $now = $now ?? time();
        $exp = $claims['exp'] ?? null;
        $nbf = $claims['nbf'] ?? null;
        $sub = $claims['sub'] ?? null;
        if (($claims['iss'] ?? null) !== $this->issuer || !is_string($sub) || $sub === '' || !is_int($exp) || $exp <= $now - 5 || (is_int($nbf) && $nbf > $now + 5)) {
            return $deny(401, 'Your session has expired. Please sign in again.');
        }
        if ($this->parties && !in_array($claims['azp'] ?? null, $this->parties, true)) {
            return $deny(401, 'Your session is not valid for this site.');
        }
        return ['ok' => true, 'status' => 200, 'error' => null, 'sub' => $sub];
    }

    private static function b64(string $s): ?string
    {
        $d = base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4), true);
        return $d === false ? null : $d;
    }

    private function find(array $keys, string $kid): ?array
    {
        foreach ($keys as $k) {
            if (is_array($k) && ($k['kid'] ?? null) === $kid && ($k['kty'] ?? null) === 'RSA' && is_string($k['n'] ?? null) && is_string($k['e'] ?? null)) {
                return $k;
            }
        }
        return null;
    }

    /** @return array|null the JWK list, or null when it cannot be had (then callers fail closed) */
    private function keys(bool $forceRefresh): ?array
    {
        $cached = $this->store->get('clerk-jwks');
        if (is_array($cached) && !$forceRefresh) {
            return $cached;
        }
        if ($forceRefresh && $this->store->get('clerk-jwks-refresh') !== null) {
            return is_array($cached) ? $cached : null;
        }
        if ($forceRefresh) {
            $this->store->put('clerk-jwks-refresh', 1, self::REFRESH_COOLDOWN_MS);
        }
        [$status, $body] = ($this->http)('GET', $this->issuer . '/.well-known/jwks.json', ['Accept: application/json'], null, 8);
        $d = $status === 200 ? json_decode($body, true) : null;
        if (!is_array($d) || !is_array($d['keys'] ?? null) || !$d['keys']) {
            return is_array($cached) ? $cached : null;
        }
        $this->store->put('clerk-jwks', $d['keys'], self::JWKS_TTL_MS);
        return $d['keys'];
    }

    private static function der(int $tag, string $body): string
    {
        $len = strlen($body);
        $l = $len < 128 ? chr($len) : (($len < 256) ? "\x81" . chr($len) : "\x82" . chr($len >> 8) . chr($len & 255));
        return chr($tag) . $l . $body;
    }

    private static function derInt(string $bin): string
    {
        $bin = ltrim($bin, "\x00");
        return self::der(0x02, ($bin === '' || ord($bin[0]) > 127) ? "\x00" . $bin : $bin);
    }

    /** RSA JWK -> PEM public key (SubjectPublicKeyInfo). */
    private static function pem(array $jwk): ?string
    {
        $n = self::b64($jwk['n']);
        $e = self::b64($jwk['e']);
        if ($n === null || $e === null || $n === '' || $e === '') {
            return null;
        }
        $rsaKey = self::der(0x30, self::derInt($n) . self::derInt($e));
        $algo = self::der(0x30, self::der(0x06, "\x2a\x86\x48\x86\xf7\x0d\x01\x01\x01") . "\x05\x00");
        $spki = self::der(0x30, $algo . self::der(0x03, "\x00" . $rsaKey));
        return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($spki), 64, "\n") . "-----END PUBLIC KEY-----\n";
    }
}
