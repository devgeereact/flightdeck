<?php
declare(strict_types=1);

namespace Flightdeck;

/** Port of server/flight.ts. Keep behaviour and response shapes identical to the Node reference. */
final class Flight
{
    /** IATA carrier code => [ICAO callsign prefix, name]. Partial list; ICAO callsigns can be searched directly. */
    public const CARRIERS = [
        'BA' => ['BAW', 'British Airways'], 'EK' => ['UAE', 'Emirates'], 'AF' => ['AFR', 'Air France'], 'LH' => ['DLH', 'Lufthansa'],
        'KL' => ['KLM', 'KLM'], 'AA' => ['AAL', 'American Airlines'], 'DL' => ['DAL', 'Delta Air Lines'], 'UA' => ['UAL', 'United Airlines'],
        'QR' => ['QTR', 'Qatar Airways'], 'EY' => ['ETD', 'Etihad Airways'], 'TK' => ['THY', 'Turkish Airlines'], 'VS' => ['VIR', 'Virgin Atlantic'],
        'FR' => ['RYR', 'Ryanair'], 'U2' => ['EZY', 'easyJet'], 'IB' => ['IBE', 'Iberia'], 'LX' => ['SWR', 'SWISS'],
        'SQ' => ['SIA', 'Singapore Airlines'], 'QF' => ['QFA', 'Qantas'], 'AC' => ['ACA', 'Air Canada'], 'WN' => ['SWA', 'Southwest Airlines'],
        'B6' => ['JBU', 'JetBlue'], 'AS' => ['ASA', 'Alaska Airlines'], 'EI' => ['EIN', 'Aer Lingus'], 'AY' => ['FIN', 'Finnair'],
        'SK' => ['SAS', 'SAS Scandinavian'], 'OS' => ['AUA', 'Austrian'], 'TP' => ['TAP', 'TAP Air Portugal'], 'AZ' => ['ITY', 'ITA Airways'],
        'KE' => ['KAL', 'Korean Air'], 'NH' => ['ANA', 'All Nippon Airways'], 'JL' => ['JAL', 'Japan Airlines'], 'CX' => ['CPA', 'Cathay Pacific'],
        'SV' => ['SVA', 'Saudia'], 'MS' => ['MSR', 'EgyptAir'], 'ET' => ['ETH', 'Ethiopian Airlines'], 'KQ' => ['KQA', 'Kenya Airways'],
        'W6' => ['WZZ', 'Wizz Air'], 'LS' => ['EXS', 'Jet2'], 'BY' => ['TOM', 'TUI Airways'],
    ];

    public const AIRPORTS = [
        'LHR' => ['code' => 'LHR', 'name' => 'London Heathrow', 'city' => 'London', 'country' => 'United Kingdom', 'timezone' => 'Europe/London', 'lat' => 51.47, 'lon' => -0.4543],
        'JFK' => ['code' => 'JFK', 'name' => 'John F. Kennedy International', 'city' => 'New York', 'country' => 'United States', 'timezone' => 'America/New_York', 'lat' => 40.6413, 'lon' => -73.7781],
        'DXB' => ['code' => 'DXB', 'name' => 'Dubai International', 'city' => 'Dubai', 'country' => 'United Arab Emirates', 'timezone' => 'Asia/Dubai', 'lat' => 25.2532, 'lon' => 55.3657],
        'CDG' => ['code' => 'CDG', 'name' => 'Paris Charles de Gaulle', 'city' => 'Paris', 'country' => 'France', 'timezone' => 'Europe/Paris', 'lat' => 49.0097, 'lon' => 2.5479],
    ];

    public static function normalizeNumber(string $input): string
    {
        $out = preg_replace('/\s/u', '', strtoupper($input));
        return $out === null ? '' : $out;
    }

    public static function validSearch(string $number, string $date): bool
    {
        if (!preg_match('/^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/D', $number)) {
            return false;
        }
        if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/D', $date, $m)) {
            return false;
        }
        return checkdate((int) $m[2], (int) $m[3], (int) $m[1]);
    }

    /** Callsigns are space-padded and may zero-pad the number (BAW0117); compare on a canonical form. */
    public static function canonicalCallsign(string $c): string
    {
        $c = strtoupper(trim($c));
        $r = preg_replace('/^([A-Z]{3})0+(\d)/', '$1$2', $c);
        return $r === null ? $c : $r;
    }

    /** @return string[] */
    public static function callsignCandidates(string $number): array
    {
        $set = [self::canonicalCallsign($number)];
        $carrier = self::CARRIERS[substr($number, 0, 2)] ?? null;
        if ($carrier !== null) {
            $set[] = self::canonicalCallsign($carrier[0] . substr($number, 2));
        }
        return array_values(array_unique($set));
    }

    public static function isState($s): bool
    {
        return is_array($s) && isset($s[0]) && is_string($s[0]) && array_key_exists(8, $s) && is_bool($s[8]);
    }

    public static function matchStates(array $states, string $number): array
    {
        $wanted = array_flip(self::callsignCandidates($number));
        $out = [];
        foreach ($states as $s) {
            if (self::isState($s) && isset($s[1]) && is_string($s[1]) && isset($wanted[self::canonicalCallsign($s[1])])) {
                $out[] = $s;
            }
        }
        return $out;
    }

    private static function num($v)
    {
        return (is_int($v) || is_float($v)) && is_finite((float) $v) ? $v : null;
    }

    /** JS Math.round semantics (half up). */
    private static function round($v): int
    {
        return (int) floor($v + 0.5);
    }

    public static function iso(int $ms): string
    {
        return gmdate('Y-m-d\TH:i:s', intdiv($ms, 1000)) . sprintf('.%03dZ', $ms % 1000);
    }

    private static function emptyFlight(string $id, string $number): array
    {
        return [
            'id' => $id, 'number' => $number, 'airline' => 'Airline not reported', 'status' => 'Status unavailable', 'cancelled' => false, 'diverted' => false,
            'origin' => null, 'destination' => null,
            'scheduledOut' => null, 'estimatedOut' => null, 'actualOut' => null, 'scheduledIn' => null, 'estimatedIn' => null, 'actualIn' => null,
            'takeoff' => null, 'landing' => null, 'boarding' => null, 'gateOut' => null, 'gateIn' => null, 'terminalOut' => null, 'terminalIn' => null,
            'baggage' => null, 'aircraft' => null, 'registration' => null, 'progress' => null, 'delayMinutes' => null, 'position' => null,
        ];
    }

    public static function stateToFlight(array $s, string $number): array
    {
        $callsign = self::canonicalCallsign(isset($s[1]) && is_string($s[1]) && $s[1] !== '' ? $s[1] : $number);
        $lat = self::num($s[6] ?? null);
        $lon = self::num($s[5] ?? null);
        $stamp = self::num($s[3] ?? null) ?? self::num($s[4] ?? null);
        $velocity = self::num($s[9] ?? null);
        $altitude = self::num($s[7] ?? null);
        $heading = self::num($s[10] ?? null);
        $unknown = ['code' => '—', 'name' => 'Airport unavailable', 'city' => '', 'country' => '', 'timezone' => null, 'lat' => null, 'lon' => null];
        $icaoNames = [];
        foreach (self::CARRIERS as $c) {
            $icaoNames[$c[0]] = $c[1];
        }
        $f = self::emptyFlight('opensky-' . $s[0], $number);
        $f['airline'] = $icaoNames[substr($callsign, 0, 3)] ?? 'Airline not reported';
        $f['status'] = $s[8] ? 'On the ground' : 'Airborne';
        $f['origin'] = $unknown;
        $f['destination'] = $unknown;
        $f['position'] = $lat !== null && $lon !== null && $stamp !== null
            ? ['lat' => $lat, 'lon' => $lon, 'time' => self::iso(self::round($stamp * 1000))]
            : null;
        $f['altitudeM'] = $altitude === null ? null : self::round($altitude);
        $f['speedKmh'] = $velocity === null ? null : self::round($velocity * 3.6);
        $f['headingDeg'] = $heading === null ? null : self::round($heading);
        $f['onGround'] = $s[8];
        $f['originCountry'] = isset($s[2]) && is_string($s[2]) && $s[2] !== '' ? $s[2] : null;
        return $f;
    }

    public static function demoFlight(string $number, string $date): ?array
    {
        $routes = [
            'BA117' => ['LHR', 'JFK', 'British Airways', 'Boeing 777-300ER', 'T07:25:00Z', 'T15:20:00Z'],
            'EK2' => ['LHR', 'DXB', 'Emirates', 'Airbus A380', 'T13:00:00Z', 'T20:05:00Z'],
            'AF1381' => ['LHR', 'CDG', 'Air France', 'Airbus A320', 'T10:00:00Z', 'T11:20:00Z'],
        ];
        if (!isset($routes[$number])) {
            return null;
        }
        $r = $routes[$number];
        $out = $date . $r[4];
        $in = $date . $r[5];
        $ms = static function (string $t): int {
            return (int) strtotime($t) * 1000;
        };
        $delayed = $number === 'EK2';
        $f = self::emptyFlight('demo-' . $number . '-' . $date, $number);
        $f['airline'] = $r[2];
        $f['status'] = $delayed ? 'Delayed' : 'En route';
        $f['origin'] = self::AIRPORTS[$r[0]];
        $f['destination'] = self::AIRPORTS[$r[1]];
        $f['scheduledOut'] = $out;
        $f['estimatedOut'] = $delayed ? self::iso($ms($out) + 35 * 60000) : $out;
        $f['actualOut'] = $delayed ? null : $out;
        $f['scheduledIn'] = $in;
        $f['estimatedIn'] = $delayed ? self::iso($ms($in) + 35 * 60000) : $in;
        $f['takeoff'] = $delayed ? null : self::iso($ms($out) + 20 * 60000);
        $f['gateOut'] = 'B34';
        $f['terminalOut'] = '5';
        $f['terminalIn'] = $r[1] === 'JFK' ? '8' : null;
        $f['aircraft'] = $r[3];
        $f['progress'] = $delayed ? 0 : 46;
        $f['delayMinutes'] = $delayed ? 35 : 0;
        return $f;
    }

    private const ADB_STATUS = [
        'Unknown' => 'Status unavailable', 'Expected' => 'Scheduled', 'EnRoute' => 'En route', 'CheckIn' => 'Check-in open',
        'Boarding' => 'Boarding', 'GateClosed' => 'Gate closed', 'Departed' => 'Departed', 'Delayed' => 'Delayed',
        'Approaching' => 'Approaching', 'Arrived' => 'Arrived', 'Canceled' => 'Cancelled', 'Diverted' => 'Diverted',
        'CanceledUncertain' => 'Possibly cancelled',
    ];
    /** Provider statuses where the aircraft has left the gate. */
    private const AIRBORNE = ['Departed' => 1, 'EnRoute' => 1, 'Approaching' => 1];
    private const GATE_OUT_DONE = ['Departed' => 1, 'EnRoute' => 1, 'Approaching' => 1, 'Arrived' => 1];

    private static function str($v): ?string
    {
        return is_string($v) && $v !== '' ? $v : null;
    }

    /** AeroDataBox times look like "2026-10-24 15:20Z" (UTC) or with an offset (local). Returns ISO UTC or null. */
    private static function adbTime($t): ?string
    {
        $raw = is_array($t) ? ($t['utc'] ?? null) : null;
        $ts = is_string($raw) ? strtotime($raw) : false;
        return $ts === false ? null : self::iso($ts * 1000);
    }

    private static function adbAirport($m): array
    {
        $a = is_array($m) && is_array($m['airport'] ?? null) ? $m['airport'] : [];
        $loc = is_array($a['location'] ?? null) ? $a['location'] : [];
        $lat = self::num($loc['lat'] ?? null);
        $lon = self::num($loc['lon'] ?? null);
        $code = self::str($a['iata'] ?? null) ?? self::str($a['icao'] ?? null) ?? '—';
        $name = self::str($a['shortName'] ?? null) ?? self::str($a['name'] ?? null) ?? ($code === '—' ? 'Airport unavailable' : $code);
        return [
            'code' => $code, 'name' => $name, 'city' => self::str($a['municipalityName'] ?? null) ?? '',
            'country' => self::str($a['countryCode'] ?? null) ?? '', 'timezone' => self::str($a['timeZone'] ?? null),
            'lat' => $lat, 'lon' => $lon,
        ];
    }

    /** Map one AeroDataBox flight to Flightdeck's shape. Unknown fields stay null; nothing is invented. */
    public static function fromAeroDataBox(array $x, string $number, string $date): array
    {
        $dep = is_array($x['departure'] ?? null) ? $x['departure'] : [];
        $arr = is_array($x['arrival'] ?? null) ? $x['arrival'] : [];
        $rawStatus = is_string($x['status'] ?? null) ? $x['status'] : 'Unknown';
        $origin = self::adbAirport($dep);
        $destination = self::adbAirport($arr);
        $f = self::emptyFlight('adb-' . $number . '-' . $date . '-' . $origin['code'] . '-' . $destination['code'], $number);
        $f['airline'] = self::str(is_array($x['airline'] ?? null) ? ($x['airline']['name'] ?? null) : null) ?? 'Airline not reported';
        $f['status'] = self::ADB_STATUS[$rawStatus] ?? 'Status unavailable';
        $f['providerStatus'] = isset(self::ADB_STATUS[$rawStatus]) ? $rawStatus : 'Unknown';
        $f['cancelled'] = $rawStatus === 'Canceled';
        $f['diverted'] = $rawStatus === 'Diverted';
        $f['origin'] = $origin;
        $f['destination'] = $destination;
        $f['scheduledOut'] = self::adbTime($dep['scheduledTime'] ?? null);
        $f['scheduledIn'] = self::adbTime($arr['scheduledTime'] ?? null);
        $revisedOut = self::adbTime($dep['revisedTime'] ?? null);
        $revisedIn = self::adbTime($arr['revisedTime'] ?? null);
        $f['estimatedOut'] = $revisedOut;
        $f['estimatedIn'] = $revisedIn;
        if (isset(self::GATE_OUT_DONE[$rawStatus])) {
            $f['actualOut'] = $revisedOut;
            $f['takeoff'] = self::adbTime($dep['runwayTime'] ?? null);
        }
        if ($rawStatus === 'Arrived') {
            $f['actualIn'] = $revisedIn;
            $f['landing'] = self::adbTime($arr['runwayTime'] ?? null);
        }
        $f['gateOut'] = self::str($dep['gate'] ?? null);
        $f['terminalOut'] = self::str($dep['terminal'] ?? null);
        $f['gateIn'] = self::str($arr['gate'] ?? null);
        $f['terminalIn'] = self::str($arr['terminal'] ?? null);
        $f['baggage'] = self::str($arr['baggageBelt'] ?? null);
        $ac = is_array($x['aircraft'] ?? null) ? $x['aircraft'] : [];
        $f['aircraft'] = self::str($ac['model'] ?? null);
        $f['registration'] = self::str($ac['reg'] ?? null);
        $scheduled = $revisedIn !== null ? $f['scheduledIn'] : $f['scheduledOut'];
        $revised = $revisedIn !== null ? $revisedIn : $revisedOut;
        if ($scheduled !== null && $revised !== null) {
            $f['delayMinutes'] = max(0, self::round((strtotime($revised) - strtotime($scheduled)) / 60));
        }
        $quality = array_merge(
            is_array($dep['quality'] ?? null) ? $dep['quality'] : [],
            is_array($arr['quality'] ?? null) ? $arr['quality'] : []
        );
        $f['liveUpdates'] = in_array('Live', $quality, true);
        $f['dataSource'] = 'AeroDataBox';
        return $f;
    }

    /** Copy live position fields from an OpenSky-derived flight onto a scheduled flight. */
    public static function applyPosition(array $f, array $live): array
    {
        foreach (['position', 'altitudeM', 'speedKmh', 'headingDeg', 'onGround', 'originCountry'] as $k) {
            if (array_key_exists($k, $live)) {
                $f[$k] = $live[$k];
            }
        }
        return $f;
    }

    /** Fill unknown origin/destination from a callsign route lookup. */
    public static function applyRoute(array $f, ?array $route): array
    {
        if ($route !== null) {
            $f['origin'] = $route['origin'];
            $f['destination'] = $route['destination'];
            $f['routeSource'] = 'adsbdb';
        }
        return $f;
    }

    /** Derive journey progress, distance remaining and a labelled ETA estimate. Never overrides provider times. */
    public static function addGeometry(array $f, int $nowMs): array
    {
        $o = $f['origin'];
        $d = $f['destination'];
        if (!isset($o['lat'], $o['lon'], $d['lat'], $d['lon'])) {
            return $f;
        }
        $total = Geo::distanceKm((float) $o['lat'], (float) $o['lon'], (float) $d['lat'], (float) $d['lon']);
        $pos = $f['position'] ?? null;
        if (is_array($pos) && empty($f['onGround']) && $total > 50) {
            $remaining = Geo::distanceKm((float) $pos['lat'], (float) $pos['lon'], (float) $d['lat'], (float) $d['lon']);
            $f['distanceRemainingKm'] = self::round($remaining);
            if ($f['progress'] === null) {
                $f['progress'] = (int) max(0, min(100, self::round((1 - $remaining / $total) * 100)));
                $f['progressBasis'] = 'position';
            }
            $speed = $f['speedKmh'] ?? null;
            if ($f['estimatedIn'] === null && $speed !== null && $speed >= 200) {
                $f['etaEstimate'] = self::iso($nowMs + (int) round($remaining / $speed * 3600000));
            }
            return $f;
        }
        $out = $f['actualOut'] ?? $f['estimatedOut'] ?? $f['scheduledOut'];
        $in = $f['estimatedIn'] ?? $f['scheduledIn'];
        if ($f['progress'] === null && isset(self::AIRBORNE[$f['providerStatus'] ?? '']) && $out !== null && $in !== null) {
            $span = strtotime($in) - strtotime($out);
            if ($span > 0) {
                $f['progress'] = (int) max(0, min(100, self::round(($nowMs / 1000 - strtotime($out)) / $span * 100)));
                $f['progressBasis'] = 'times';
            }
        }
        return $f;
    }

    /** Scheduled details are only requested close to now, so the small free allowance is not wasted. */
    public static function scheduleDateOk(string $date, int $nowMs): bool
    {
        $day = strtotime($date . ' 00:00:00 UTC');
        $today = strtotime(gmdate('Y-m-d', intdiv($nowMs, 1000)) . ' 00:00:00 UTC');
        return $day !== false && $day >= $today - 86400 && $day <= $today + 3 * 86400;
    }

    public static function isAirborneStatus(array $f): bool
    {
        return isset(self::AIRBORNE[$f['providerStatus'] ?? '']);
    }

    /**
     * Merge scheduled (date-specific) flights with live OpenSky matches. Scheduled data is authoritative; the aircraft's live
     * position is attached to the first flight that is in the air. Without scheduled data, live matches are returned alone and
     * their usual route is looked up (at most 5 lookups) via $routeFor(callsign): ?array.
     */
    public static function combine(array $scheduled, array $matches, string $number, int $nowMs, callable $routeFor): array
    {
        $flights = [];
        if ($scheduled) {
            $live = null;
            foreach ($matches as $s) {
                if (empty($s[8])) {
                    $live = self::stateToFlight($s, $number);
                    break;
                }
            }
            $attached = false;
            foreach ($scheduled as $f) {
                if ($live !== null && !$attached && self::isAirborneStatus($f)) {
                    $f = self::applyPosition($f, $live);
                    $attached = true;
                }
                $flights[] = self::addGeometry($f, $nowMs);
            }
            return $flights;
        }
        $looked = 0;
        foreach ($matches as $s) {
            $f = self::stateToFlight($s, $number);
            if ($looked < 5 && isset($s[1]) && is_string($s[1])) {
                $looked++;
                $f = self::applyRoute($f, $routeFor(self::canonicalCallsign($s[1])));
            }
            $flights[] = self::addGeometry($f, $nowMs);
        }
        return $flights;
    }
}
