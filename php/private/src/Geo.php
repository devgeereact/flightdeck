<?php
declare(strict_types=1);

namespace Flightdeck;

final class Geo
{
    /** Great-circle distance in kilometres (haversine, mean Earth radius). */
    public static function distanceKm(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $r = 6371.0088;
        $p1 = deg2rad($lat1);
        $p2 = deg2rad($lat2);
        $dp = $p2 - $p1;
        $dl = deg2rad($lon2 - $lon1);
        $a = sin($dp / 2) ** 2 + cos($p1) * cos($p2) * sin($dl / 2) ** 2;
        return 2 * $r * asin(min(1.0, sqrt($a)));
    }
}
