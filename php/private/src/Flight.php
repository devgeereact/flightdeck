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
}
