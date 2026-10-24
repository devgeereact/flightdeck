<?php
declare(strict_types=1);

namespace Flightdeck;

final class OpenSkyError extends \RuntimeException
{
}

final class OpenSky
{
    /** One global snapshot costs credits, so it is shared by all searches for this long. */
    public const SNAPSHOT_SECONDS = 120;

    private $id;
    private $secret;
    private $store;

    public function __construct(?string $id, ?string $secret, Store $store)
    {
        $this->id = $id;
        $this->secret = $secret;
        $this->store = $store;
    }

    public function configured(): bool
    {
        return (bool) ($this->id && $this->secret);
    }

    private function token(): string
    {
        $cached = $this->store->get('token');
        if (is_string($cached)) {
            return $cached;
        }
        [$status, $body] = Http::request(
            'POST',
            'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token',
            ['Content-Type: application/x-www-form-urlencoded'],
            http_build_query(['grant_type' => 'client_credentials', 'client_id' => $this->id, 'client_secret' => $this->secret]),
            10
        );
        $d = json_decode($body, true);
        if ($status < 200 || $status > 299 || !is_array($d) || empty($d['access_token']) || !is_string($d['access_token'])) {
            throw new OpenSkyError('OpenSky rejected the API credentials.');
        }
        $ttl = max(0, (isset($d['expires_in']) && is_numeric($d['expires_in']) ? (int) $d['expires_in'] : 300) - 30);
        $this->store->put('token', $d['access_token'], $ttl * 1000);
        return $d['access_token'];
    }

    /** @return array{0:array,1:bool,2:int} states, served-from-cache, fetched-at (ms) */
    public function states(): array
    {
        $snap = $this->store->get('snapshot');
        if (is_array($snap)) {
            Metrics::count('opensky_cache_hit');
            return [$snap['states'], true, $snap['fetchedAt']];
        }
        return $this->store->withLock('snapshot', function () {
            $snap = $this->store->get('snapshot');
            if (is_array($snap)) {
                return [$snap['states'], true, $snap['fetchedAt']];
            }
            @ini_set('memory_limit', '256M');
            Metrics::count('opensky_fetch');
            $t0 = microtime(true);
            [$status, $body] = Http::request('GET', 'https://opensky-network.org/api/states/all', ['Authorization: Bearer ' . $this->token()], null, 20);
            Metrics::latency('opensky', (int) round((microtime(true) - $t0) * 1000));
            if ($status !== 200) {
                Metrics::count('opensky_error');
            }
            if ($status === 401) {
                $this->store->forget('token');
                throw new OpenSkyError('OpenSky rejected the API credentials.');
            }
            if ($status === 429) {
                throw new OpenSkyError('OpenSky credit limit reached. Try again later.');
            }
            $d = $status === 200 ? json_decode($body, true) : null;
            unset($body);
            if (!is_array($d)) {
                throw new OpenSkyError('OpenSky is temporarily unavailable.');
            }
            $states = [];
            foreach (is_array($d['states'] ?? null) ? $d['states'] : [] as $s) {
                if (is_array($s)) {
                    $states[] = array_slice($s, 0, 11); // only the fields Flightdeck reads
                }
            }
            $now = Store::nowMs();
            $this->store->put('snapshot', ['fetchedAt' => $now, 'states' => $states], self::SNAPSHOT_SECONDS * 1000);
            return [$states, false, $now];
        });
    }
}
