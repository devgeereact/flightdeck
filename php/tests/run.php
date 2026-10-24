<?php
declare(strict_types=1);
// Mirrors server/flight.test.ts. Run: php php/tests/run.php
require __DIR__ . '/../private/src/Flight.php';

use Flightdeck\Flight;

$failed = 0;
function check(string $name, bool $ok): void
{
    global $failed;
    echo ($ok ? "PASS " : "FAIL ") . $name . "\n";
    if (!$ok) {
        $failed++;
    }
}
function state($callsign, array $over = []): array
{
    $s = ['4ca7b3', $callsign, 'United Kingdom', 1700000000, 1700000005, -30.5, 52.25, 10668, false, 230, 271.4, 0, null, 10700, '1000', false, 0];
    foreach ($over as $k => $v) {
        $s[$k] = $v;
    }
    return $s;
}

check('normalises numbers', Flight::normalizeNumber('ba 117') === 'BA117');
check('valid search accepted', Flight::validSearch('BA117', '2026-10-23'));
check('path-like number rejected', !Flight::validSearch('../secret', '2026-10-23'));
check('impossible date rejected', !Flight::validSearch('BA117', '2026-02-30'));
check('trailing newline rejected', !Flight::validSearch("BA117\n", '2026-10-23') && !Flight::validSearch('BA117', "2026-10-23\n"));

$c = Flight::callsignCandidates('BA117');
sort($c);
check('IATA maps to ICAO callsign', $c === ['BA117', 'BAW117']);
$found = Flight::matchStates([state('BAW117  '), state('BAW0117'), state('BAW1170'), state('UAE2'), state(null), 'junk'], 'BA117');
check('matches padded/zero-padded only', count($found) === 2);
check('ICAO callsign direct + IATA map', count(Flight::matchStates([state('UAE2')], 'UAE2')) === 1 && count(Flight::matchStates([state('UAE2')], 'EK2')) === 1);

$f = Flight::stateToFlight(Flight::matchStates([state('BAW117')], 'BA117')[0], 'BA117');
check('airline + status', $f['airline'] === 'British Airways' && $f['status'] === 'Airborne');
check('position', $f['position'] === ['lat' => 52.25, 'lon' => -30.5, 'time' => '2023-11-14T22:13:20.000Z']);
check('altitude/speed/heading', $f['altitudeM'] === 10668 && $f['speedKmh'] === 828 && $f['headingDeg'] === 271);
$allNull = true;
foreach (['boarding', 'gateOut', 'gateIn', 'baggage', 'aircraft', 'scheduledOut', 'scheduledIn', 'delayMinutes', 'progress'] as $k) {
    $allNull = $allNull && $f[$k] === null;
}
check('unknown operational details stay null', $allNull && $f['origin']['timezone'] === null);

$g = Flight::stateToFlight(Flight::matchStates([state('BAW117', [5 => null, 6 => null, 8 => true])], 'BA117')[0], 'BA117');
check('missing coordinates -> no position; ground preserved', $g['position'] === null && $g['status'] === 'On the ground' && $g['onGround'] === true);

check('demo never invents flights', Flight::demoFlight('ZZ999', '2026-10-23') === null);
$d = Flight::demoFlight('BA117', '2026-10-23');
check('demo shape', strpos($d['id'], 'demo-') === 0 && substr($d['scheduledOut'], 0, 10) === '2026-10-23' && $d['boarding'] === null && $d['destination']['timezone'] === 'America/New_York');

echo $failed ? "\n$failed FAILED\n" : "\nAll passed\n";
exit($failed ? 1 : 0);
