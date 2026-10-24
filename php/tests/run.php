<?php
declare(strict_types=1);
// Mirrors server/flight.test.ts. Run: php php/tests/run.php
foreach (['Http', 'Store', 'CloudflareIps', 'Geo', 'Flight', 'OpenSky', 'RouteLookup', 'AeroDataBox'] as $f) {
    require __DIR__ . '/../private/src/' . $f . '.php';
}

use Flightdeck\AeroDataBox;
use Flightdeck\AeroDataBoxError;
use Flightdeck\CloudflareIps;
use Flightdeck\Flight;
use Flightdeck\Geo;
use Flightdeck\RouteLookup;
use Flightdeck\Store;

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

// ---- Geometry, scheduled data (AeroDataBox), route lookup (adsbdb), merge ----
$tmp = sys_get_temp_dir() . '/flightdeck-test-' . bin2hex(random_bytes(4));
$store = new Store($tmp);
$km = Geo::distanceKm(51.4706, -0.461941, 40.6398, -73.7789);
check('great-circle LHR-JFK is about 5,540 km', $km > 5500 && $km < 5580);

$adb = json_decode((string) file_get_contents(__DIR__ . '/fixtures/adb-ba117-enroute.json'), true)[0];
$m = Flight::fromAeroDataBox($adb, 'BA117', '2026-10-24');
check('adb: route and airports', $m['origin']['code'] === 'LHR' && $m['destination']['code'] === 'JFK' && $m['origin']['timezone'] === 'Europe/London' && $m['destination']['lat'] === 40.6398);
check('adb: status and flags', $m['status'] === 'En route' && $m['providerStatus'] === 'EnRoute' && $m['cancelled'] === false && $m['airline'] === 'British Airways');
check('adb: times in UTC ISO', $m['scheduledOut'] === '2026-10-24T07:25:00.000Z' && $m['estimatedIn'] === '2026-10-24T15:35:00.000Z' && $m['takeoff'] === '2026-10-24T07:58:00.000Z');
check('adb: actual gate-out only once departed', $m['actualOut'] === '2026-10-24T07:40:00.000Z' && $m['actualIn'] === null && $m['landing'] === null);
check('adb: gates, terminals, baggage, aircraft', $m['gateOut'] === 'B34' && $m['terminalOut'] === '5' && $m['terminalIn'] === '7' && $m['gateIn'] === null && $m['baggage'] === '9' && $m['aircraft'] === 'Boeing 777-300ER' && $m['registration'] === 'G-STBH');
check('adb: departure delay in minutes, live flag', $m['delayMinutes'] === 15 && $m['liveUpdates'] === true && $m['boarding'] === null && $m['position'] === null);
$planned = $adb;
$planned['status'] = 'Expected';
unset($planned['departure']['revisedTime'], $planned['arrival']['revisedTime'], $planned['departure']['runwayTime'], $planned['departure']['gate'], $planned['departure']['quality'], $planned['arrival']['quality']);
$p = Flight::fromAeroDataBox($planned, 'BA117', '2026-10-24');
check('adb: scheduled-only flight keeps unknowns null', $p['actualOut'] === null && $p['takeoff'] === null && $p['estimatedOut'] === null && $p['delayMinutes'] === null && $p['gateOut'] === null && $p['liveUpdates'] === false && $p['status'] === 'Scheduled');
$junk = Flight::fromAeroDataBox(['departure' => 'x', 'arrival' => null, 'status' => 'Nonsense', 'airline' => ['name' => 5]], 'ZZ1', '2026-10-24');
check('adb: malformed provider data does not crash or invent', $junk['status'] === 'Status unavailable' && $junk['origin']['code'] === '—' && $junk['scheduledOut'] === null && $junk['airline'] === 'Airline not reported');
$early = $adb;
$early['departure']['revisedTime'] = ['utc' => '2026-10-24 07:20Z', 'local' => '2026-10-24 08:20+01:00'];
check('adb: early departure is negative, not hidden', Flight::fromAeroDataBox($early, 'BA117', '2026-10-24')['delayMinutes'] === -5);
$done = $adb;
$done['status'] = 'Arrived';
$d2 = Flight::fromAeroDataBox($done, 'BA117', '2026-10-24');
check('adb: arrived flight is 100% (status basis) with actual gate-in', $d2['progress'] === 100 && $d2['progressBasis'] === 'status' && $d2['actualIn'] === '2026-10-24T15:35:00.000Z');
check('combine: arrived flight keeps 100 and gets no live position', Flight::combine([$d2], [state('BAW117')], 'BA117', strtotime('2026-10-24 16:00:00 UTC') * 1000, static function () {
    return null;
})[0]['progress'] === 100);
$cx = $adb;
$cx['status'] = 'Canceled';
check('adb: cancelled flag', Flight::fromAeroDataBox($cx, 'BA117', '2026-10-24')['cancelled'] === true);

$now = (int) strtotime('2026-10-24 12:00:00 UTC') * 1000;
check('schedule window: yesterday..+3 days only', Flight::scheduleDateOk('2026-10-23', $now) && Flight::scheduleDateOk('2026-10-27', $now) && !Flight::scheduleDateOk('2026-10-22', $now) && !Flight::scheduleDateOk('2026-10-28', $now));

$calls = [];
$fakeAdb = static function (int $status, string $body = '[]') use (&$calls) {
    return static function ($method, $url, $headers) use (&$calls, $status, $body) {
        $calls[] = ['url' => $url, 'headers' => $headers];
        return [$status, $body];
    };
};
$body = (string) file_get_contents(__DIR__ . '/fixtures/adb-ba117-enroute.json');
$svc = new AeroDataBox(['aerodatabox_key' => 'k-test', 'aerodatabox_monthly_units' => 4, 'aerodatabox_hourly_calls' => 10], $store, $fakeAdb(200, $body));
[$raw, $cachedFirst] = $svc->fetch('BA117', '2026-10-24');
[$raw2, $cachedSecond] = $svc->fetch('BA117', '2026-10-24');
check('adb svc: result cached, one outbound call', count($calls) === 1 && !$cachedFirst && $cachedSecond && count($raw) === 1 && $raw === $raw2);
check('adb svc: right URL and headers', strpos($calls[0]['url'], 'https://aerodatabox.p.rapidapi.com/flights/number/BA117/2026-10-24?') === 0 && in_array('X-RapidAPI-Key: k-test', $calls[0]['headers'], true));
check('adb svc: units counted before the call', $svc->usage() === ['unitsUsed' => 2, 'unitsAllowed' => 4]);
$svc->fetch('EK2', '2026-10-24');
$blocked = false;
try {
    $svc->fetch('AF1381', '2026-10-24');
} catch (AeroDataBoxError $e) {
    $blocked = strpos($e->getMessage(), 'monthly') !== false;
}
check('adb svc: refuses a call that would pass the monthly allowance', $blocked && count($calls) === 2);

$calls = [];
$store2 = new Store($tmp . '-b');
$hourly = new AeroDataBox(['aerodatabox_key' => 'k', 'aerodatabox_hourly_calls' => 1], $store2, $fakeAdb(204, ''));
[$none] = $hourly->fetch('ZZ9', '2026-10-24');
$h = false;
try {
    $hourly->fetch('ZZ8', '2026-10-24');
} catch (AeroDataBoxError $e) {
    $h = strpos($e->getMessage(), 'per hour') !== false;
}
check('adb svc: 204 means no flights; hourly cap enforced', $none === [] && $h && count($calls) === 1);

$store3 = new Store($tmp . '-c');
$bad = new AeroDataBox(['aerodatabox_key' => 'k'], $store3, $fakeAdb(401, 'secret-body-k'));
$msg = '';
try {
    $bad->fetch('BA117', '2026-10-24');
} catch (AeroDataBoxError $e) {
    $msg = $e->getMessage();
}
$again = '';
try {
    $bad->fetch('BA118', '2026-10-24');
} catch (AeroDataBoxError $e) {
    $again = $e->getMessage();
}
check('adb svc: rejected key -> safe message, then cooldown without more calls', strpos($msg, 'rejected') !== false && strpos($again, 'paused') !== false && count($calls) === 2 && strpos($msg . $again, 'k-test') === false);
$calls = [];
$unsub = new AeroDataBox(['aerodatabox_key' => 'k'], new Store($tmp . '-g'), $fakeAdb(403, '{"message":"You are not subscribed to this API."}'));
$why = '';
try {
    $unsub->fetch('BA117', '2026-10-24');
} catch (AeroDataBoxError $e) {
    $why = $e->getMessage();
}
check('adb svc: 403 not-subscribed gives an actionable message', strpos($why, 'not subscribed') !== false);
check('adb svc: unconfigured without key', !(new AeroDataBox([], $store3))->configured());

$routeBody = json_encode(['response' => ['flightroute' => [
    'origin' => ['iata_code' => 'LHR', 'icao_code' => 'EGLL', 'name' => 'London Heathrow Airport', 'municipality' => 'London', 'country_name' => 'United Kingdom', 'latitude' => 51.4706, 'longitude' => -0.46194],
    'destination' => ['iata_code' => 'JFK', 'icao_code' => 'KJFK', 'name' => 'John F Kennedy International Airport', 'municipality' => 'New York', 'country_name' => 'United States', 'latitude' => 40.6398, 'longitude' => -73.7789],
]]]);
$rc = 0;
$routes = new RouteLookup(new Store($tmp . '-d'), static function () use (&$rc, $routeBody) {
    $rc++;
    return [200, $routeBody];
});
$r = $routes->lookup('BAW117');
$routes->lookup('BAW117');
check('route: airports mapped, second call cached', $r !== null && $r['origin']['code'] === 'LHR' && $r['destination']['lat'] === 40.6398 && $r['destination']['timezone'] === null && $rc === 1);
check('route: invalid callsign never reaches the network', $routes->lookup('bad callsign!') === null && $routes->lookup('') === null && $rc === 1);
$mc = 0;
$miss = new RouteLookup(new Store($tmp . '-e'), static function () use (&$mc) {
    $mc++;
    return [404, '{"response":"unknown callsign"}'];
});
check('route: unknown callsign -> null and negative-cached', $miss->lookup('ZZZ9999') === null && $miss->lookup('ZZZ9999') === null && $mc === 1);
$down = new RouteLookup(new Store($tmp . '-f'), static function () {
    return [0, ''];
});
check('route: provider down -> null, no exception', $down->lookup('BAW117') === null);

$noRoute = static function () {
    return null;
};
$withRoute = static function () use ($r) {
    return $r;
};
$live = state('BAW117', [5 => -30.0, 6 => 52.0, 8 => false, 9 => 230]);
$both = Flight::combine([$m], [$live], 'BA117', $now, $noRoute);
check('combine: live position attached to the airborne scheduled flight', count($both) === 1 && $both[0]['position']['lat'] === 52.0 && $both[0]['position']['lon'] === -30.0 && $both[0]['onGround'] === false);
check('combine: scheduled gate/baggage preserved with position', $both[0]['gateOut'] === 'B34' && $both[0]['baggage'] === '9' && $both[0]['speedKmh'] === 828);
check('combine: progress and distance from position', $both[0]['progressBasis'] === 'position' && $both[0]['progress'] > 0 && $both[0]['progress'] < 100 && $both[0]['distanceRemainingKm'] > 0 && !isset($both[0]['etaEstimate']));
$idle = Flight::combine([$p], [$live], 'BA117', $now, $noRoute);
check('combine: position NOT attached to a flight that has not departed', $idle[0]['position'] === null && $idle[0]['progress'] === null);
$grounded = Flight::combine([$m], [state('BAW117', [8 => true])], 'BA117', $now, $noRoute);
check('combine: grounded aircraft is not used as a live position', $grounded[0]['position'] === null);
$timesOnly = Flight::combine([$m], [], 'BA117', strtotime('2026-10-24 11:30:00 UTC') * 1000, $noRoute);
check('combine: time-based progress when no position (labelled)', $timesOnly[0]['progressBasis'] === 'times' && $timesOnly[0]['progress'] > 40 && $timesOnly[0]['progress'] < 60);
$only = Flight::combine([], [$live], 'BA117', $now, $withRoute);
check('combine: live-only flight gets route, progress and ETA estimate', $only[0]['origin']['code'] === 'LHR' && $only[0]['routeSource'] === 'adsbdb' && $only[0]['progress'] !== null && isset($only[0]['etaEstimate']) && $only[0]['scheduledOut'] === null && $only[0]['gateOut'] === null);
$lookups = 0;
$many = [];
for ($i = 0; $i < 8; $i++) {
    $many[] = state('BAW117', [0 => 'abc' . $i]);
}
Flight::combine([], $many, 'BA117', $now, static function () use (&$lookups) {
    $lookups++;
    return null;
});
check('combine: at most 5 route lookups per search', $lookups === 5);
check('combine: unknown route -> no geometry invented', Flight::combine([], [$live], 'BA117', $now, $noRoute)[0]['progress'] === null);
// ---- Direction (inbound/outbound), usual terminals, estimates, usual-route fallback ----
$mk = static function (string $number, ?string $oc, ?string $dc, string $o = 'LHR', string $d = 'JFK', array $t = []) {
    $f = Flight::stateToFlight(state('X'), $number);
    $f['origin'] = ['code' => $o, 'name' => $o . ' airport', 'city' => $o . ' city', 'country' => '', 'countryCode' => $oc, 'timezone' => null, 'lat' => null, 'lon' => null];
    $f['destination'] = ['code' => $d, 'name' => $d . ' airport', 'city' => $d . ' city', 'country' => '', 'countryCode' => $dc, 'timezone' => null, 'lat' => null, 'lon' => null];
    return Flight::addDirection(array_merge($f, $t));
};
check('direction: leaving the UK is outbound (route)', $mk('BA117', 'GB', 'US')['direction']['type'] === 'outbound' && $mk('BA117', 'GB', 'US')['direction']['basis'] === 'route' && $mk('BA117', 'GB', 'US')['direction']['place'] === 'LHR city (LHR)');
check('direction: arriving in the UK is inbound, named by the UK airport', $mk('BA118', 'US', 'GB', 'JFK', 'LHR')['direction']['type'] === 'inbound' && $mk('BA118', 'US', 'GB', 'JFK', 'LHR')['direction']['place'] === 'LHR city (LHR)');
check('direction: UK to UK is domestic; neither end UK is overseas', $mk('BA1300', 'GB', 'GB', 'LHR', 'MAN')['direction']['type'] === 'domestic' && $mk('EK73', 'US', 'FR', 'JFK', 'CDG')['direction']['type'] === 'overseas');
$noRoute = static function (string $n) {
    $f = Flight::stateToFlight(state('X'), $n);
    return Flight::addDirection($f);
};
check('direction: BA odd number with unknown route is outbound, labelled by number, no place invented', $noRoute('BA59')['direction']['type'] === 'outbound' && $noRoute('BA59')['direction']['basis'] === 'number' && $noRoute('BA59')['direction']['place'] === null);
check('direction: BA even number with unknown route is inbound', $noRoute('BA60')['direction']['type'] === 'inbound');
check('direction: other airline with unknown route gets NO guess', !isset($noRoute('EK2')['direction']) && !isset($noRoute('LH400')['direction']));
check('direction: route beats the number convention', $mk('BA59', 'ZA', 'GB', 'CPT', 'LHR')['direction']['type'] === 'inbound');
check('direction: a different home country is respected', Flight::addDirection($mk('BA117', 'GB', 'US'), 'US')['direction']['type'] === 'inbound');

$h = Flight::addTerminalHints($mk('BA59', 'GB', 'ZA', 'LHR', 'CPT'));
check('terminal hint: BA from LHR with no reported terminal gets usual T5', ($h['terminalOutHint'] ?? null) === '5' && !isset($h['terminalInHint']));
$h2 = Flight::addTerminalHints($mk('BA60', 'ZA', 'GB', 'CPT', 'LHR'));
check('terminal hint: BA arriving at LHR gets usual T5 for arrival', ($h2['terminalInHint'] ?? null) === '5' && !isset($h2['terminalOutHint']));
check('terminal hint: never overrides a reported terminal, never for other airlines or airports', !isset(Flight::addTerminalHints($mk('BA59', 'GB', 'ZA', 'LHR', 'CPT', ['terminalOut' => '3']))['terminalOutHint']) && !isset(Flight::addTerminalHints($mk('EK2', 'GB', 'AE', 'LHR', 'DXB'))['terminalOutHint']) && !isset(Flight::addTerminalHints($mk('BA117', 'GB', 'GB', 'LGW', 'MAN'))['terminalOutHint']));

$before = $adb;
unset($before['departure']['runwayTime']);
$before['status'] = 'Expected';
$before['departure']['runwayTime'] = ['utc' => '2026-10-24 07:50Z', 'local' => '2026-10-24 08:50+01:00'];
$before['arrival']['runwayTime'] = ['utc' => '2026-10-24 15:25Z', 'local' => '2026-10-24 11:25-04:00'];
$e = Flight::fromAeroDataBox($before, 'BA117', '2026-10-24');
check('adb: take-off/touchdown before they happen are ESTIMATES, not actuals', $e['takeoff'] === null && $e['landing'] === null && $e['estimatedTakeoff'] === '2026-10-24T07:50:00.000Z' && $e['estimatedLanding'] === '2026-10-24T15:25:00.000Z');
check('adb: after departure the runway time is the actual take-off', $m['takeoff'] === '2026-10-24T07:58:00.000Z' && $m['estimatedTakeoff'] === null);
check('adb: airports carry a country code', $m['origin']['countryCode'] === 'GB' && $m['destination']['countryCode'] === 'US');
$u = Flight::usualRouteFlight('BA59', '2026-12-01', $r);
check('usual route flight: route only, no times or status claims', $u['usualRouteOnly'] === true && $u['scheduledOut'] === null && $u['gateOut'] === null && $u['status'] === 'Schedule not published yet' && $u['origin']['code'] === 'LHR');

$two = [$adb, $adb];
$two[0]['departure']['scheduledTime']['local'] = '2026-10-23 22:30+01:00';
$two[1]['departure']['scheduledTime']['local'] = '2026-10-24 22:30+01:00';
[$kept, $exact] = Flight::filterByDepartureDate($two, '2026-10-24');
check('date filter: only the flight departing on the requested local date is kept', count($kept) === 1 && $exact && $kept[0]['departure']['scheduledTime']['local'] === '2026-10-24 22:30+01:00');
[$none, $exact2] = Flight::filterByDepartureDate($two, '2026-10-25');
check('date filter: nothing matches -> provider list returned, flagged inexact', count($none) === 2 && $exact2 === false && Flight::filterByDepartureDate([], '2026-10-25') === [[], true]);
$idA = Flight::fromAeroDataBox($two[0], 'BA59', '2026-10-24')['id'];
$two[1]['departure']['scheduledTime']['utc'] = '2026-10-24 21:30Z';
check('flight ids are unique per departure time', $idA !== Flight::fromAeroDataBox($two[1], 'BA59', '2026-10-24')['id']);
foreach ([$tmp, $tmp . '-b', $tmp . '-c', $tmp . '-d', $tmp . '-e', $tmp . '-f', $tmp . '-g'] as $dir) {
    exec('rm -rf ' . escapeshellarg($dir));
}

// ---- Cloudflare client address ----
check('cf: published IPv4 and IPv6 ranges recognised', CloudflareIps::contains('104.21.4.95') && CloudflareIps::contains('172.67.153.246') && CloudflareIps::contains('162.159.0.1') && CloudflareIps::contains('2606:4700:3031::ac43:99f6'));
check('cf: range edges are exact', CloudflareIps::contains('173.245.63.255') && !CloudflareIps::contains('173.245.64.0') && CloudflareIps::contains('104.23.255.255') && !CloudflareIps::contains('104.32.0.0'));
check('cf: ordinary and malformed addresses are not Cloudflare', !CloudflareIps::contains('8.8.8.8') && !CloudflareIps::contains('203.0.113.9') && !CloudflareIps::contains('not-an-ip') && !CloudflareIps::contains('2001:db8::1'));
check('cf: header honoured only from a Cloudflare peer', CloudflareIps::clientIp('104.21.4.95', '198.51.100.7', true) === '198.51.100.7');
check('cf: spoofed header from a direct connection is ignored', CloudflareIps::clientIp('203.0.113.9', '198.51.100.7', true) === '203.0.113.9');
check('cf: trust off, garbage or missing header fall back to the peer', CloudflareIps::clientIp('104.21.4.95', '198.51.100.7', false) === '104.21.4.95' && CloudflareIps::clientIp('104.21.4.95', 'junk', true) === '104.21.4.95' && CloudflareIps::clientIp('104.21.4.95', null, true) === '104.21.4.95');

echo $failed ? "\n$failed FAILED\n" : "\nAll passed\n";
exit($failed ? 1 : 0);
