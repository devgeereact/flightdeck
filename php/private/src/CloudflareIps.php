<?php
declare(strict_types=1);

namespace Flightdeck;

/**
 * Cloudflare's published proxy ranges (https://www.cloudflare.com/ips-v4 and ips-v6, checked 24 Oct 2026).
 * CF-Connecting-IP is only believed when the TCP peer is one of these, so someone reaching the origin directly
 * cannot spoof a fresh address on every request to dodge the rate limit.
 */
final class CloudflareIps
{
    public const RANGES = [
        '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18', '108.162.192.0/18',
        '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
        '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
        '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32',
    ];

    public static function contains(string $ip): bool
    {
        $addr = @inet_pton($ip);
        if ($addr === false) {
            return false;
        }
        foreach (self::RANGES as $range) {
            [$base, $bits] = explode('/', $range);
            $net = inet_pton($base);
            if ($net === false || strlen($net) !== strlen($addr)) {
                continue;
            }
            $full = intdiv((int) $bits, 8);
            $rest = (int) $bits % 8;
            if (substr($addr, 0, $full) !== substr($net, 0, $full)) {
                continue;
            }
            if ($rest === 0) {
                return true;
            }
            $mask = (0xFF << (8 - $rest)) & 0xFF;
            if ((ord($addr[$full]) & $mask) === (ord($net[$full]) & $mask)) {
                return true;
            }
        }
        return false;
    }

    /** Client address for rate limiting: the CF header only when the peer really is Cloudflare. */
    public static function clientIp(string $remoteAddr, ?string $cfHeader, bool $trust): string
    {
        if ($trust && $cfHeader !== null && filter_var($cfHeader, FILTER_VALIDATE_IP) !== false && self::contains($remoteAddr)) {
            return $cfHeader;
        }
        return $remoteAddr;
    }
}
