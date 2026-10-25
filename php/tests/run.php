<?php
declare(strict_types=1);
// Mirrors server/flight.test.ts. Run: php php/tests/run.php
foreach (['Http', 'DevEnv', 'ClerkAuth', 'Checklists', 'Metrics', 'Mailer', 'Enquiries', 'ClerkApi', 'Admin', 'GoogleAnalytics', 'Store', 'CloudflareIps', 'Geo', 'Flight', 'OpenSky', 'RouteLookup', 'AeroDataBox', 'App'] as $f) {
    require __DIR__ . '/../private/src/' . $f . '.php';
}
require __DIR__ . '/../private/src/Content/Markdown.php';

use Flightdeck\AeroDataBox;
use Flightdeck\AeroDataBoxError;
use Flightdeck\CloudflareIps;
use Flightdeck\ClerkAuth;
use Flightdeck\Checklists;
use Flightdeck\Metrics;
use Flightdeck\Enquiries;
use Flightdeck\ClerkApi;
use Flightdeck\Admin;
use Flightdeck\GoogleAnalytics;
use Flightdeck\DevEnv;
use Flightdeck\Flight;
use Flightdeck\Geo;
use Flightdeck\RouteLookup;
use Flightdeck\Store;
use Flightdeck\App;

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
// At 12:00 UTC on 24 Oct it is already 25 Oct 02:00 at UTC+14 (so +3 days there is 28 Oct) and still 24 Oct at UTC-12.
check('schedule window: yesterday..+3 days for any local date on Earth, nothing further', Flight::scheduleDateOk('2026-10-23', $now) && Flight::scheduleDateOk('2026-10-27', $now) && Flight::scheduleDateOk('2026-10-28', $now) && !Flight::scheduleDateOk('2026-10-22', $now) && !Flight::scheduleDateOk('2026-10-29', $now));
$ukJustAfterMidnight = (int) strtotime('2026-06-30 23:30:00 UTC') * 1000; // 00:30 BST on 1 July in the UK, still 30 June in UTC
check('schedule window: UK just after midnight in summer accepts the UK yesterday, today and +3 days', Flight::scheduleDateOk('2026-06-30', $ukJustAfterMidnight) && Flight::scheduleDateOk('2026-07-01', $ukJustAfterMidnight) && Flight::scheduleDateOk('2026-07-04', $ukJustAfterMidnight));
$laEvening = (int) strtotime('2026-10-25 02:00:00 UTC') * 1000; // 19:00 PDT on 24 Oct in Los Angeles
check('schedule window: a user in the Americas in the evening keeps their yesterday', Flight::scheduleDateOk('2026-10-23', $laEvening) && Flight::scheduleDateOk('2026-10-24', $laEvening));
$aucklandMorning = (int) strtotime('2026-10-24 12:00:00 UTC') * 1000; // 01:00 NZDT on 25 Oct in Auckland
check('schedule window: a user in New Zealand after midnight gets their +3 days', Flight::scheduleDateOk('2026-10-28', $aucklandMorning));
$gmtDay = (int) strtotime('2026-10-25 00:30:00 UTC') * 1000; // 00:30 GMT on 25 Oct 2026, just before the clocks went back
check('schedule window: clock-change day (25 Oct 2026) is today in the UK', Flight::scheduleDateOk('2026-10-25', $gmtDay) && Flight::scheduleDateOk('2026-10-24', $gmtDay) && Flight::scheduleDateOk('2026-10-28', $gmtDay) && !Flight::scheduleDateOk('2026-10-30', $gmtDay) && !Flight::scheduleDateOk('2026-10-22', $gmtDay));
check('schedule window: malformed dates never pass', !Flight::scheduleDateOk('2026-10-25x', $gmtDay) && !Flight::scheduleDateOk('', $gmtDay) && !Flight::scheduleDateOk('25/10/2026', $gmtDay));
// filterByDepartureDate uses the departure airport's LOCAL date: 00:30 UTC on 25 Oct is 01:30 BST on 25 Oct at LHR, and 23:30 UTC on
// 24 Oct is 00:30 BST on 25 Oct, so both belong to 25 Oct; the 20:00 New York departure on 24 Oct (00:00 UTC on 25 Oct) does not.
$leg = static function (string $utc, string $local): array {
    return ['departure' => ['scheduledTime' => ['utc' => $utc, 'local' => $local]]];
};
[$kept, $exact] = Flight::filterByDepartureDate([$leg('2026-10-25 00:30Z', '2026-10-25 01:30+01:00'), $leg('2026-10-24 23:30Z', '2026-10-25 00:30+01:00'), $leg('2026-10-25 00:00Z', '2026-10-24 20:00-04:00')], '2026-10-25');
check('filter: departure date is the airport\'s local date, not the UTC date', $exact && count($kept) === 2 && $kept[1]['departure']['scheduledTime']['utc'] === '2026-10-24 23:30Z');
$bst = Flight::fromAeroDataBox(['departure' => ['scheduledTime' => ['utc' => '2026-10-25 00:30Z', 'local' => '2026-10-25 01:30+01:00']], 'arrival' => ['scheduledTime' => ['utc' => '2026-10-25 01:30Z', 'local' => '2026-10-25 01:30+00:00']]], 'BA1', '2026-10-25');
check('adb: times across the BST to GMT change are kept as exact UTC instants', $bst['scheduledOut'] === '2026-10-25T00:30:00.000Z' && $bst['scheduledIn'] === '2026-10-25T01:30:00.000Z');

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
$p = DevEnv::parse("# c\nA=1\nB = \"two words\" \nC='x'\nEMPTY=\nbad line\n  D=4\r\n");
check('devenv: parses plain, quoted, spaced and CRLF lines; skips empty and junk', $p === ['A' => '1', 'B' => 'two words', 'C' => 'x', 'D' => '4'], json_encode($p));
check('devenv: never reads a .env on the real server layout', DevEnv::forPrivateDir('/home/someone/flightdeck-private') === [] && DevEnv::forPrivateDir('/srv/app/private') === []);
check('devenv: reads the project .env only for php/private', is_array(DevEnv::forPrivateDir(dirname(__DIR__) . '/private')));
// ---- Clerk session-token verification (real RSA keys, real signatures) ----
$b64 = static function (string $x): string {
    return rtrim(strtr(base64_encode($x), '+/', '-_'), '=');
};
$rsa = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
$rsaOther = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
$det = openssl_pkey_get_details($rsa);
$jwks = json_encode(['keys' => [['kty' => 'RSA', 'alg' => 'RS256', 'use' => 'sig', 'kid' => 'k1', 'n' => $b64($det['rsa']['n']), 'e' => $b64($det['rsa']['e'])]]]);
$iss = 'https://clerk.example.com';
$nowSec = 1800000000;
$mint = static function (array $claims, array $hdr = [], $priv = null) use ($b64, $rsa) {
    $hdr = $hdr + ['alg' => 'RS256', 'typ' => 'JWT', 'kid' => 'k1'];
    $h = $b64(json_encode($hdr));
    $p = $b64(json_encode($claims));
    openssl_sign("$h.$p", $sig, $priv ?? $rsa, OPENSSL_ALGO_SHA256);
    return "$h.$p." . $b64($sig);
};
$good = ['iss' => $iss, 'sub' => 'user_1', 'exp' => $nowSec + 60, 'nbf' => $nowSec - 10, 'azp' => 'https://flightdeck.gakinz.com'];
$fetches = 0;
$jwksUp = static function () use (&$fetches, $jwks) {
    $fetches++;
    return [200, $jwks];
};
$authStore = new Store($tmp . '-h');
$auth = new ClerkAuth($iss, $authStore, $jwksUp);
$r1 = $auth->check($mint($good), $nowSec);
check('auth: a validly signed, current token is accepted and names the user', $r1['ok'] && $r1['sub'] === 'user_1');
$auth->check($mint($good), $nowSec);
check('auth: the public key set is fetched once and cached', $fetches === 1);
check('auth: no token, junk and oversized tokens are 401', !$auth->check(null, $nowSec)['ok'] && $auth->check(null, $nowSec)['status'] === 401 && $auth->check('not.a.jwt!', $nowSec)['status'] === 401 && $auth->check(str_repeat('a', 5000) . '.b.c', $nowSec)['status'] === 401);
check('auth: expired token rejected', $auth->check($mint(['exp' => $nowSec - 60] + $good), $nowSec)['status'] === 401);
check('auth: not-yet-valid token rejected', $auth->check($mint(['nbf' => $nowSec + 600] + $good), $nowSec)['status'] === 401);
check('auth: wrong issuer rejected', $auth->check($mint(['iss' => 'https://evil.example.com'] + $good), $nowSec)['status'] === 401);
check('auth: missing subject rejected', $auth->check($mint(['sub' => ''] + $good), $nowSec)['status'] === 401);
check('auth: token signed by a different key is rejected (forgery)', $auth->check($mint($good, [], $rsaOther), $nowSec)['status'] === 401);
$tamper = explode('.', $mint($good));
$tamper[1] = $b64(json_encode(['sub' => 'user_admin'] + $good));
check('auth: a token whose payload was edited after signing is rejected', $auth->check(implode('.', $tamper), $nowSec)['status'] === 401);
check('auth: alg "none" and HS256 (key confusion) are rejected', $auth->check($b64('{"alg":"none","typ":"JWT","kid":"k1"}') . '.' . $b64(json_encode($good)) . '.', $nowSec)['status'] === 401 && $auth->check($mint($good, ['alg' => 'HS256']), $nowSec)['status'] === 401);
$unknown = $auth->check($mint($good, ['kid' => 'rotated']), $nowSec);
check('auth: unknown key id is refused after one rate-limited refresh', $unknown['status'] === 401 && $fetches === 2 && $auth->check($mint($good, ['kid' => 'rotated']), $nowSec)['status'] === 401 && $fetches === 2);
$parties = new ClerkAuth($iss, new Store($tmp . '-i'), $jwksUp, ['https://flightdeck.gakinz.com']);
check('auth: authorized-party (azp) is enforced when configured', $parties->check($mint($good), $nowSec)['ok'] && !$parties->check($mint(['azp' => 'https://evil.example.com'] + $good), $nowSec)['ok']);
$down = new ClerkAuth($iss, new Store($tmp . '-j'), static function () {
    return [0, ''];
});
check('auth: keys unreachable -> fail CLOSED with 503, never allow', !$down->check($mint($good), $nowSec)['ok'] && $down->check($mint($good), $nowSec)['status'] === 503);
$stale = new Store($tmp . '-k');
(new ClerkAuth($iss, $stale, $jwksUp))->check($mint($good), $nowSec);
$flaky = new ClerkAuth($iss, $stale, static function () {
    return [500, ''];
});
check('auth: cached keys keep working while Clerk is briefly down', $flaky->check($mint($good), $nowSec)['ok']);
check('auth: disabled (no issuer) lets everything through; bad issuer config disables nothing silently into http', (new ClerkAuth(null, $authStore))->check(null)['ok'] && !(new ClerkAuth('http://clerk.example.com', $authStore))->enabled() && !(new ClerkAuth('', $authStore))->enabled());
check('auth: issuer derived from real Clerk publishable keys', ClerkAuth::issuerFromPublishableKey('pk_test_ZGV2b3RlZC1tYXN0b2Rvbi03NTk5LmNsZXJrLmFjY291bnRzLmRldiQ') === 'https://devoted-mastodon-7599.clerk.accounts.dev' && ClerkAuth::issuerFromPublishableKey('pk_live_Y2xlcmsuZmxpZ2h0ZGVjay5nYWtpbnouY29tJA') === 'https://clerk.flightdeck.gakinz.com' && ClerkAuth::issuerFromPublishableKey('sk_live_abc') === null && ClerkAuth::issuerFromPublishableKey(null) === null);
check('auth: bearer parsing', ClerkAuth::tokenFrom('Bearer abc.def.ghi', null) === 'abc.def.ghi' && ClerkAuth::tokenFrom('bearer  x.y.z', null) === 'x.y.z' && ClerkAuth::tokenFrom(null, 'p.q.r') === 'p.q.r' && ClerkAuth::tokenFrom('Basic dXNlcjpwYXNz', null) === null && ClerkAuth::tokenFrom('', '') === null);

// ---- Checklist storage (per signed-in user) ----
$doc = ['v' => 1, 'tpl' => ['updatedAt' => 1800000000000, 'hidden' => ['cl.work.1'], 'renamed' => ['cl.papers.2' => '  Passport   (valid) '], 'added' => [['id' => 'cx.a1', 'sec' => 'last', 'text' => 'Umbrella']]],
    'trips' => [['id' => 'trip.1', 'name' => 'Cape Town', 'updatedAt' => 1800000000001, 'marks' => ['cl.papers.2' => 1800000000001, 'cx.a1' => -1800000000000], 'flight' => ['number' => 'BA59', 'date' => '2026-10-24'], 'evil' => '<script>']],
    'gone' => ['trip.0' => 1799999999999], 'active' => 'trip.1', 'extra' => 'dropped'];
$v = Checklists::validate($doc);
check('checklist: a valid document is accepted, cleaned and unknown keys dropped', $v !== null && !isset($v['extra']) && !isset($v['trips'][0]['evil']) && $v['tpl']['renamed']['cl.papers.2'] === 'Passport (valid)' && $v['trips'][0]['marks'] == ['cl.papers.2' => 1800000000001, 'cx.a1' => -1800000000000] && $v['trips'][0]['metaAt'] === 1800000000001 && $v['trips'][0]['flight']['number'] === 'BA59');
check('checklist: rejects the wrong version, wrong types and junk', Checklists::validate(null) === null && Checklists::validate(['v' => 2]) === null && Checklists::validate('x') === null && Checklists::validate([]) === null);
$tooMany = $doc;
$tooMany['trips'] = array_fill(0, 13, $doc['trips'][0]);
check('checklist: more than 12 trips is refused, not truncated', Checklists::validate($tooMany) === null);
$bad = $doc;
$bad['trips'][0]['flight'] = ['number' => '<b>', 'date' => 'soon'];
$bad['trips'][0]['marks'] = ['ok.id' => 5, '../../etc/passwd' => 5, 'zero' => 0, 'huge' => 9e15, str_repeat('a', 200) => 5, 'str' => 'x'];
$bad['tpl']['added'][] = ['id' => '../x', 'sec' => 'last', 'text' => 'nope'];
$vb = Checklists::validate($bad);
check('checklist: bad ids, paths, flights and labels are dropped individually', $vb !== null && !isset($vb['trips'][0]['flight']) && array_keys((array) $vb['trips'][0]['marks']) === ['ok.id'] && count($vb['tpl']['added']) === 1);
$longLabel = $doc;
$longLabel['tpl']['added'][0]['text'] = str_repeat('é', 500);
check('checklist: long labels are cut to 80 characters (multibyte safe)', mb_strlen(Checklists::validate($longLabel)['tpl']['added'][0]['text']) === 80);

$withCtx = $doc;
$withCtx['trips'][0]['nights'] = 7;
$withCtx['trips'][0]['ctx'] = ['dir' => 'overseas', 'intl' => true, 'dest' => 'CPT', 'destName' => 'Cape Town', 'lat' => -33.97, 'lon' => 18.6, 'tempC' => 24, 'rain' => false, 'km' => 9600, 'at' => 1800000000000];
$vc = Checklists::validate($withCtx);
check('checklist: nights and trip context are kept when valid', $vc !== null && $vc['trips'][0]['nights'] === 7 && $vc['trips'][0]['ctx']['dest'] === 'CPT' && $vc['trips'][0]['ctx']['tempC'] == 24 && $vc['trips'][0]['ctx']['rain'] === false);
$badCtx = $doc;
$badCtx['trips'][0]['nights'] = 9999;
$badCtx['trips'][0]['ctx'] = ['dir' => 'sideways', 'dest' => 'CPT', 'lat' => 999, 'tempC' => 'hot', 'km' => -5, 'destName' => '<b>' . str_repeat('x', 100)];
$vbc = Checklists::validate($badCtx);
check('checklist: out-of-range nights are dropped and bad context fields become null', $vbc !== null && !isset($vbc['trips'][0]['nights']) && $vbc['trips'][0]['ctx']['dir'] === null && $vbc['trips'][0]['ctx']['lat'] === null && $vbc['trips'][0]['ctx']['tempC'] === null && $vbc['trips'][0]['ctx']['km'] === null && mb_strlen($vbc['trips'][0]['ctx']['destName']) <= 40);
$noDest = $doc;
$noDest['trips'][0]['ctx'] = ['dest' => '../x'];
check('checklist: context with an invalid destination code is dropped', !isset(Checklists::validate($noDest)['trips'][0]['ctx']));

$lists = new Checklists($tmp . '-l');
check('checklist: a new user has nothing stored (rev 0)', $lists->get('user_a') === ['rev' => 0, 'data' => null]);
$r1 = $lists->put('user_a', $v, 0);
check('checklist: first save succeeds at revision 1 and can be read back', $r1['ok'] && $r1['rev'] === 1 && $lists->get('user_a')['rev'] === 1 && $lists->get('user_a')['data']['trips'][0]['name'] === 'Cape Town');
$stale = $lists->put('user_a', $v, 0);
check('checklist: a save based on an old revision is a conflict and returns the current copy', !$stale['ok'] && $stale['rev'] === 1 && $stale['data']['trips'][0]['id'] === 'trip.1');
$r2 = $lists->put('user_a', $v, 1);
check('checklist: a save based on the latest revision moves it to 2', $r2['ok'] && $r2['rev'] === 2);
check('checklist: users never see each other\'s data', $lists->get('user_b') === ['rev' => 0, 'data' => null] && $lists->put('user_b', $v, 0)['rev'] === 1 && $lists->get('user_a')['rev'] === 2);
$files = glob($tmp . '-l/checklists/*') ?: [];
$names = implode(' ', array_map('basename', $files));
check('checklist: files are named by a hash (never the user id), mode 600, no temp files left', strpos($names, 'user_a') === false && count(array_filter($files, static function ($f) {
    return substr($f, -4) === '.tmp';
})) === 0 && fileperms($tmp . '-l/checklists/' . hash('sha256', 'user_a') . '.json') % 01000 === 0600);

// ---- Owner console: counters, enquiries, Clerk users, admin rules ----
$mdir = $tmp . '-m';
@mkdir($mdir, 0700, true);
Metrics::init($mdir);
Metrics::count('search_total', 3);
Metrics::count('search_found', 2);
Metrics::count('search_notfound');
Metrics::tally('airlines', 'BA', 2);
Metrics::tally('airlines', 'LH');
Metrics::tally('routes', 'LHR>JFK', 2);
Metrics::tally('routes', 'bad key!! <script>');
Metrics::latency('aerodatabox', 300);
Metrics::latency('aerodatabox', 500);
Metrics::user('user_a');
Metrics::user('user_a');
Metrics::user('user_b');
$nowSec = (int) strtotime('2026-10-24 12:00:00 UTC');
Metrics::instance()->flush($nowSec);
Metrics::count('search_total');
Metrics::user('user_a');
Metrics::instance()->flush($nowSec); // a second request the same day
$day = Metrics::instance()->range(1, $nowSec)[0];
check('metrics: counters add up across requests in one day', $day['c']['search_total'] === 4 && $day['c']['search_found'] === 2 && $day['m']['airlines'] == ['BA' => 2, 'LH' => 1] && $day['m']['routes']['LHR>JFK'] === 2);
check('metrics: unsafe keys are cleaned, never stored raw', !array_key_exists('bad key!! <script>', $day['m']['routes']) && isset($day['m']['routes']['badkeyscript>']));
check('metrics: distinct users counted once per day (2 people, 3 visits)', $day['users'] === 2);
check('metrics: provider latency kept as sum and count', $day['lat']['aerodatabox'] == [800, 2]);
$raw = (string) file_get_contents($mdir . '/metrics/2026-10-24.json');
check('metrics: the file holds no raw user ids, only salted hashes, and is mode 600', strpos($raw, 'user_a') === false && fileperms($mdir . '/metrics/2026-10-24.json') % 01000 === 0600 && preg_match('/"u":\["[0-9a-f]{16}"/', $raw) === 1);
Metrics::count('search_total');
Metrics::instance()->flush((int) strtotime('2026-07-01 23:30:00 UTC')); // 00:30 BST on 2 July in the UK
check('metrics: days are UK days, so 00:30 BST counts on the new UK day, not the UTC one', is_file($mdir . '/metrics/2026-07-02.json') && !is_file($mdir . '/metrics/2026-07-01.json') && Metrics::day((int) strtotime('2026-07-01 23:30:00 UTC')) === '2026-07-02');
check('metrics: UK day across the clock change: 00:30 UTC and 23:30 UTC on 25 Oct 2026 are both 25 Oct', Metrics::day((int) strtotime('2026-10-25 00:30:00 UTC')) === '2026-10-25' && Metrics::day((int) strtotime('2026-10-25 23:30:00 UTC')) === '2026-10-25' && Metrics::day((int) strtotime('2026-10-24 23:30:00 UTC')) === '2026-10-25' && Metrics::day((int) strtotime('2026-03-29 00:30:00 UTC')) === '2026-03-29');
$rc = array_column(Metrics::instance()->range(3, (int) strtotime('2026-10-25 23:30:00 UTC')), 'date');
$rs = array_column(Metrics::instance()->range(3, (int) strtotime('2026-03-30 00:30:00 UTC')), 'date');
check('metrics: a range across a clock change lists each UK day once, none skipped', $rc === ['2026-10-23', '2026-10-24', '2026-10-25'] && $rs === ['2026-03-28', '2026-03-29', '2026-03-30']);
$r7 = Metrics::instance()->range(7, $nowSec);
check('metrics: a range returns every day, oldest first, with empty days as zeros', count($r7) === 7 && $r7[0]['date'] === '2026-10-18' && $r7[6]['date'] === '2026-10-24' && $r7[0]['users'] === 0 && $r7[0]['c'] === []);
for ($i = 0; $i < 230; $i++) {
    Metrics::tally('routes', 'R' . $i . '>X');
}
Metrics::instance()->flush($nowSec);
check('metrics: a map cannot grow without limit (extra keys fold into _other)', count(Metrics::instance()->range(1, $nowSec)[0]['m']['routes']) <= 202 && isset(Metrics::instance()->range(1, $nowSec)[0]['m']['routes']['_other']));

$mails = [];
$enq = new Enquiries($tmp . '-n', static function ($to, $subject, $body, $headers) use (&$mails) {
    $mails[] = compact('to', 'subject', 'body', 'headers');
    return true;
});
$ok = ['kind' => 'contact', 'name' => 'Sam', 'email' => 'sam@example.com', 'message' => 'Hello, can you add Terminal 3 info please?', 'elapsed' => 9000, 'website' => ''];
$nowMs = 1800000000000;
$r = $enq->submit($ok, 'owner@example.com', 'noreply@flightdeck.gakinz.com', $nowMs);
check('enquiry: a good message is stored, emailed to the owner with a safe reply-to', $r['ok'] && $r['id'] !== null && count($mails) === 1 && $mails[0]['to'] === 'owner@example.com' && in_array('Reply-To: sam@example.com', $mails[0]['headers'], true) && strpos($mails[0]['body'], 'Terminal 3') !== false);
$stored = $enq->list();
check('enquiry: it appears in the inbox as new, with the unread count', $stored['total'] === 1 && $stored['unread'] === 1 && $stored['items'][0]['status'] === 'new' && $stored['items'][0]['emailed'] === true);
$inj = $ok;
$inj['email'] = "evil@example.com\r\nBcc: victim@example.com";
check('enquiry: header injection through the email field is refused', $enq->submit($inj, 'owner@example.com', 'noreply@x.com', $nowMs)['status'] === 422 && count($mails) === 1);
$inj2 = $ok;
$inj2['name'] = "Sam\r\nBcc: victim@example.com";
$inj2['message'] = "Subject line\r\nBcc: victim@example.com\r\n\r\nhello there";
$enq->submit($inj2, 'owner@example.com', 'noreply@x.com', $nowMs + 1000);
$last = end($mails);
check('enquiry: line breaks in name or message never reach an email header', count($mails) === 2 && !preg_match('/[\r\n]Bcc:/i', implode("\r\n", $last['headers']) . $last['subject']) && strpos($last['subject'], 'Bcc') === false);
$bot = $ok;
$bot['website'] = 'http://spam.example';
$rb = $enq->submit($bot, 'owner@example.com', 'noreply@x.com', $nowMs);
check('enquiry: the honeypot silently drops bots without storing or emailing', $rb['ok'] && $rb['id'] === null && count($mails) === 2 && $enq->list()['total'] === 2);
$fast = $ok;
$fast['elapsed'] = 400;
check('enquiry: a form filled in under a second is refused', $enq->submit($fast, 'o@example.com', 'n@x.com', $nowMs)['status'] === 429);
$links = $ok;
$links['message'] = 'Buy http://a.example http://b.example http://c.example now';
check('enquiry: too many links are refused as spam', $enq->submit($links, 'o@example.com', 'n@x.com', $nowMs)['status'] === 422);
check('enquiry: invalid kind, short, huge, bad email and missing email for contact are refused', $enq->submit(['kind' => 'x'] + $ok, null, 'n@x.com', $nowMs)['status'] === 422 && $enq->submit(['message' => 'hi'] + $ok, null, 'n@x.com', $nowMs)['status'] === 422 && $enq->submit(['message' => str_repeat('a', 5000)] + $ok, null, 'n@x.com', $nowMs)['status'] === 413 && $enq->submit(['email' => 'nope'] + $ok, null, 'n@x.com', $nowMs)['status'] === 422 && $enq->submit(['email' => ''] + $ok, null, 'n@x.com', $nowMs)['status'] === 422);
$fb = $enq->submit(['kind' => 'feedback', 'message' => 'Love the checklist!', 'elapsed' => 5000, 'email' => ''], null, 'n@x.com', $nowMs + 5000);
check('enquiry: feedback needs no email; stored without email when no owner address is set', $fb['ok'] && $enq->list()['items'][0]['emailed'] === false);
$bigId = $enq->list()['items'][0]['id'];
check('enquiry: the owner can mark it read; bad ids and statuses are refused; unread drops', $enq->setStatus($bigId, 'read') && !$enq->setStatus('../../etc/passwd', 'read') && !$enq->setStatus($bigId, 'deleted') && $enq->unread() === 2);
$noMail = new Enquiries($tmp . '-n', static function () {
    throw new \RuntimeException('smtp down');
});
check('enquiry: a broken mail system never loses the message', $noMail->submit($ok, 'owner@example.com', 'n@x.com', $nowMs + 9000)['ok'] && $noMail->list()['total'] >= 4);

// --- replying from the console (own mailbox / SMTP)
$replyMails = [];
$replier = new Enquiries($tmp . '-r', static function ($to, $subject, $body, $headers) use (&$replyMails) {
    $replyMails[] = compact('to', 'subject', 'body', 'headers');
    return true;
});
$rid = $replier->submit($ok, null, 'noreply@x.com', $nowMs)['id'];
$rr = $replier->reply($rid, "Thanks Sam.\nTerminal 3 is on the list.", 'info@flightdeck.gakinz.com', 'owner@example.com', $nowMs + 1000);
$saved = $replier->list()['items'][0];
check('reply: goes to the visitor from the site mailbox, replies route to the owner, quotes the original', $rr['ok'] && $replyMails[0]['to'] === 'sam@example.com' && in_array('Reply-To: owner@example.com', $replyMails[0]['headers'], true) && in_array('From: Flightdeck <info@flightdeck.gakinz.com>', $replyMails[0]['headers'], true) && strpos($replyMails[0]['body'], 'Hello Sam') === 0 && strpos($replyMails[0]['body'], '> Hello, can you add Terminal 3') !== false);
check('reply: the enquiry is marked replied and keeps the reply text', $saved['status'] === 'replied' && $saved['replies'][0]['text'] === "Thanks Sam.\nTerminal 3 is on the list." && $replier->unread() === 0);
$noAddr = $replier->submit(['kind' => 'feedback', 'message' => 'No email here at all', 'elapsed' => 5000, 'email' => ''], null, 'n@x.com', $nowMs + 2000)['id'];
check('reply: refused when there is no email address, nothing is sent', $replier->reply($noAddr, 'Hi', 'n@x.com', null)['status'] === 422 && count($replyMails) === 1);
check('reply: empty, oversized and badly-identified replies are refused', $replier->reply($rid, ' ', 'n@x.com', null)['status'] === 422 && $replier->reply($rid, str_repeat('x', 4001), 'n@x.com', null)['status'] === 413 && $replier->reply('../../etc/passwd', 'Hello there', 'n@x.com', null)['status'] === 404 && count($replyMails) === 1);
$failing = new Enquiries($tmp . '-r', static function () {
    return false;
});
$fid = $failing->submit($ok, null, 'n@x.com', $nowMs + 3000)['id'];
$rf2 = $failing->reply($fid, 'Hello Sam', 'n@x.com', null);
check('reply: a failed send returns 502 and leaves the enquiry new', $rf2['status'] === 502 && array_values(array_filter($failing->list()['items'], static function ($i) use ($fid) { return $i['id'] === $fid; }))[0]['status'] === 'new');

// --- SMTP conversation against a scripted fake server
final class FakeSmtp
{
    public $sent = [];
    private $replies;
    public function __construct(array $replies) { $this->replies = $replies; }
    public function read(): string { return array_shift($this->replies) ?? ''; }
    public function write(string $s): void { $this->sent[] = $s; }
    public function startTls(): void { $this->sent[] = '[TLS]'; }
}
$script = ["220 hi\r\n", "250-mail\r\n250 AUTH LOGIN\r\n", "334 VXNlcm5hbWU6\r\n", "334 UGFzc3dvcmQ6\r\n", "235 ok\r\n", "250 ok\r\n", "250 ok\r\n", "354 go\r\n", "250 queued\r\n"];
$c = new FakeSmtp($script);
$sentOk = \Flightdeck\Mailer::deliver($c, 'mail.example.com', 'info@x.com', 's3cret', 'info@x.com', 'sam@example.com', 'Re: hi', "Line1\n.dot line\nLine3", ['From: Flightdeck <info@x.com>', "Evil: a\r\nBcc: v@x.com", 'Reply-To: o@x.com']);
$wire = implode('', $c->sent);
check('smtp: full login and delivery conversation succeeds with the right commands', $sentOk && strpos($wire, "AUTH LOGIN\r\n") !== false && strpos($wire, base64_encode('info@x.com') . "\r\n") !== false && strpos($wire, base64_encode('s3cret') . "\r\n") !== false && strpos($wire, "MAIL FROM:<info@x.com>\r\n") !== false && strpos($wire, "RCPT TO:<sam@example.com>\r\n") !== false);
check('smtp: dot-stuffing, CRLF and header-injection safety in the message', strpos($wire, "\r\n..dot line\r\n") !== false && strpos($wire, "\r\n.\r\n") !== false && strpos($wire, 'Bcc: v@x.com') === false && strpos($wire, 'Subject: Re: hi') !== false && strpos($wire, 'Reply-To: o@x.com') !== false);
$bad = new FakeSmtp(["220 hi\r\n", "250 ok\r\n", "334 a\r\n", "334 b\r\n", "535 auth failed\r\n"]);
$threw = false;
try {
    \Flightdeck\Mailer::deliver($bad, 'm', 'u', 'wrong', 'a@x.com', 'b@x.com', 's', 'b', []);
} catch (\RuntimeException $e) {
    $threw = true;
}
check('smtp: a refused login is an error, not a silent success', $threw);
check('smtp: addresses with line breaks are refused before any connection', !\Flightdeck\Mailer::deliver(new FakeSmtp([]), 'm', '', '', 'a@x.com', "b@x.com\r\nBcc: v@x.com", 's', 'b', []));
$tls = new FakeSmtp(["220 hi\r\n", "250 ok\r\n", "220 go\r\n", "250 ok\r\n", "250 ok\r\n", "250 ok\r\n", "354 go\r\n", "250 q\r\n"]);
check('smtp: STARTTLS upgrades the connection before login or sending', \Flightdeck\Mailer::deliver($tls, 'm', '', '', 'a@x.com', 'b@x.com', 's', 'b', [], true) && array_search('[TLS]', $tls->sent, true) !== false && array_search('[TLS]', $tls->sent, true) < count($tls->sent) - 4);
check('mailer: without smtp_host the factory returns a callable (mail() fallback)', is_callable(\Flightdeck\Mailer::make([])) && is_callable(\Flightdeck\Mailer::make(['smtp_host' => 'mail.example.com', 'smtp_user' => 'a@x.com', 'smtp_pass' => 'p'])));

$clerkCalls = [];
$clerkFake = static function ($method, $url, $headers) use (&$clerkCalls) {
    $clerkCalls[] = $url;
    if (strpos($url, '/users/count') !== false) {
        return [200, json_encode(['object' => 'total_count', 'total_count' => strpos($url, 'last_active') !== false ? 3 : 12])];
    }
    return [200, json_encode([['id' => 'user_1', 'created_at' => 1800000000000, 'last_active_at' => 1800000100000, 'last_sign_in_at' => 1800000090000, 'primary_email_address_id' => 'idn_1', 'email_addresses' => [['id' => 'idn_0', 'email_address' => 'other@example.com'], ['id' => 'idn_1', 'email_address' => 'primary@example.com']]]])];
};
check('clerk users: refuses a malformed secret key, nothing is called', !(new ClerkApi('not-a-key', new Store($tmp . '-o'), $clerkFake))->configured() && (new ClerkApi('', new Store($tmp . '-o'), $clerkFake))->summary() === ['configured' => false] && $clerkCalls === []);
$ca = new ClerkApi('sk_live_abcdef123456', new Store($tmp . '-o'), $clerkFake);
$sum = $ca->summary(1800000200000);
check('clerk users: totals, 7/30-day activity, signups and the newest user with their PRIMARY email', $sum['configured'] && $sum['total'] === 12 && $sum['active7'] === 3 && $sum['active30'] === 3 && $sum['newest'][0]['email'] === 'primary@example.com' && $sum['newest'][0]['lastActiveAt'] === 1800000100000);
$n = count($clerkCalls);
$ca->summary(1800000200001);
check('clerk users: cached for five minutes (no second round of calls)', count($clerkCalls) === $n);
$rejected = (new ClerkApi('sk_live_abcdef123456', new Store($tmp . '-p'), static function () {
    return [401, '{}'];
}))->summary();
check('clerk users: a rejected key reports an error, no exception, no key in the message', $rejected['configured'] === true && strpos($rejected['error'], 'rejected') !== false && strpos(json_encode($rejected), 'sk_live') === false);

$cfg = ['admin_user_ids' => ['user_owner']];
check('admin: only the exact configured user ids are admins', Admin::isAdmin('user_owner', $cfg) && !Admin::isAdmin('user_other', $cfg) && !Admin::isAdmin(null, $cfg) && !Admin::isAdmin('', $cfg) && !Admin::isAdmin('user_owner', []) && !Admin::isAdmin('user_owner', ['admin_user_ids' => 'user_owner']) && !Admin::isAdmin('USER_OWNER', $cfg));
$ov = Admin::overview(Metrics::instance()->range(7, $nowSec));
check('admin: overview totals and success rate', $ov['totals']['searches'] === 4 && $ov['totals']['found'] === 2 && $ov['totals']['notFound'] === 1 && $ov['totals']['successRate'] === 50.0 && $ov['days'] === 7 && count($ov['series']['searches']) === 7 && $ov['series']['searches'][6] === 4);
check('admin: top airlines/routes and average provider latency', $ov['top']['airlines'][0] === ['key' => 'BA', 'count' => 2] && array_column($ov['top']['routes'], 'count', 'key')['LHR>JFK'] === 2 && $ov['latencyMs']['aerodatabox'] === 400);
$store2 = new Store($tmp . '-q');
$store2->put('adb-units-2026-10', 100, 86400000);
$al = Admin::allowance($store2, ['aerodatabox_monthly_units' => 360], $nowSec);
check('admin: allowance forecast (100 units in 24 days -> about 4/day, enough until month end)', $al['used'] === 100 && $al['left'] === 260 && $al['perDay'] === 4.2 && $al['runsOutBeforeMonthEnd'] === false);
$store2->put('adb-units-2026-10', 340, 86400000);
check('admin: allowance forecast warns when the month will run out early', Admin::allowance($store2, ['aerodatabox_monthly_units' => 360], $nowSec)['runsOutBeforeMonthEnd'] === true);
check('admin: the console never reports secrets in the system view', strpos(json_encode(Admin::system(['aerodatabox_key' => 'SECRETKEY', 'clerk_secret_key' => 'sk_live_x', 'owner_email' => 'o@x.com'], $store2, true, false)), 'SECRET') === false && Admin::system(['owner_email' => 'o@x.com'], $store2, false, false)['emailNotifications'] === true);
check('admin: the event whitelist contains only counter names', in_array('landing_view', Admin::EVENTS, true) && !in_array('search_total', Admin::EVENTS, true) && !in_array('admin_denied', Admin::EVENTS, true));

// ---- Checklist erasure and Google Analytics numbers ----
$er = new Checklists($tmp . '-r');
$er->put('user_x', $v, 0);
$er->put('user_y', $v, 0);
check('erasure: deleting removes the user\'s checklist completely, leaves others alone, and is repeatable', $er->delete('user_x') === true && $er->get('user_x') === ['rev' => 0, 'data' => null] && $er->get('user_y')['rev'] === 1 && $er->delete('user_x') === false && !glob($tmp . '-r/checklists/' . hash('sha256', 'user_x') . '*'));
$er->put('user_x', $v, 0);
check('erasure: a fresh list can be started afterwards at revision 1', $er->get('user_x')['rev'] === 1);

$gaKey = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
openssl_pkey_export($gaKey, $gaPem);
$gaPub = openssl_pkey_get_details($gaKey)['key'];
$gaAccount = ['client_email' => 'reader@flightdeck-123.iam.gserviceaccount.com', 'private_key' => $gaPem];
$gaCalls = [];
$gaReport = static function (array $rows, array $dims = []) {
    return ['rows' => $rows];
};
$gaFake = static function ($method, $url, $headers, $body) use (&$gaCalls, $gaPub) {
    $gaCalls[] = compact('method', 'url', 'headers', 'body');
    if (strpos($url, 'oauth2.googleapis.com') !== false) {
        parse_str($body, $f);
        [$h, $c, $sg] = explode('.', $f['assertion']);
        $ok = openssl_verify("$h.$c", base64_decode(strtr($sg, '-_', '+/')), $gaPub, OPENSSL_ALGO_SHA256) === 1;
        return $ok && $f['grant_type'] === 'urn:ietf:params:oauth:grant-type:jwt-bearer' ? [200, json_encode(['access_token' => 'ya29.test', 'expires_in' => 3599])] : [400, '{}'];
    }
    $row = static function (array $d, array $m) {
        return ['dimensionValues' => array_map(static function ($v) {
            return ['value' => $v];
        }, $d), 'metricValues' => array_map(static function ($v) {
            return ['value' => (string) $v];
        }, $m)];
    };
    return [200, json_encode(['reports' => [
        ['rows' => [$row(['20261023'], [4, 6, 15]), $row(['20261024'], [7, 9, 30])]],
        ['rows' => [$row(['date_range_0'], [11, 15, 45]), $row(['date_range_1'], [40, 61, 190])]],
        ['rows' => [$row(['United Kingdom'], [30]), $row(['United States'], [7]), $row([''], [1])]],
        ['rows' => [$row(['mobile'], [28]), $row(['desktop'], [12])]],
        ['rows' => [$row(['Organic Search'], [33]), $row(['Direct'], [20])]],
    ]])];
};
check('ga: not configured without a property id and a valid key, and says so', !(new GoogleAnalytics(null, $gaAccount, new Store($tmp . '-s'), $gaFake))->configured() && !(new GoogleAnalytics('12345678', null, new Store($tmp . '-s'), $gaFake))->configured() && !(new GoogleAnalytics('abc', $gaAccount, new Store($tmp . '-s'), $gaFake))->configured() && !(new GoogleAnalytics('12345678', ['client_email' => 'x', 'private_key' => 'nope'], new Store($tmp . '-s'), $gaFake))->configured() && (new GoogleAnalytics(null, null, new Store($tmp . '-s'), $gaFake))->summary() === ['configured' => false] && $gaCalls === []);
$ga = new GoogleAnalytics('123456789', $gaAccount, new Store($tmp . '-s'), $gaFake);
$gs = $ga->summary(1800000000);
check('ga: the service-account JWT is signed correctly (Google could verify it) and the report call uses the bearer token', $gs['configured'] && strpos($gaCalls[0]['url'], 'oauth2.googleapis.com/token') !== false && in_array('Authorization: Bearer ya29.test', $gaCalls[1]['headers'], true) && strpos($gaCalls[1]['url'], 'properties/123456789:batchRunReports') !== false);
check('ga: totals for 7 and 28 days, daily series with real dates, ranked countries, devices and channels', $gs['totals']['7'] === ['users' => 11, 'sessions' => 15, 'pageViews' => 45] && $gs['totals']['28']['users'] === 40 && $gs['series'][1] === ['date' => '2026-10-24', 'users' => 7, 'sessions' => 9, 'pageViews' => 30] && $gs['countries'][0] === ['key' => 'United Kingdom', 'count' => 30] && $gs['countries'][2]['key'] === '(not set)' && $gs['devices'][0]['key'] === 'mobile' && $gs['channels'][1] === ['key' => 'Direct', 'count' => 20]);
$gn = count($gaCalls);
$ga->summary(1800000100);
check('ga: results cached for 15 minutes (no new Google calls)', count($gaCalls) === $gn);
check('ga: the response never contains the private key or token', strpos(json_encode($gs), 'PRIVATE KEY') === false && strpos(json_encode($gs), 'ya29') === false);
$gaDenied = new GoogleAnalytics('123456789', $gaAccount, new Store($tmp . '-t'), static function ($m, $u) {
    return strpos($u, 'oauth2') !== false ? [200, '{"access_token":"t","expires_in":3600}'] : [403, '{"error":{"message":"PERMISSION_DENIED"}}'];
});
$den = $gaDenied->summary(1800000000);
check('ga: a refusal from Google becomes a clear set-up message, not an exception or a leak', $den['configured'] === true && strpos($den['error'], 'Viewer') !== false && strpos(json_encode($den), 'PERMISSION_DENIED') === false);
$gaBad = (new GoogleAnalytics('123456789', $gaAccount, new Store($tmp . '-u'), static function () {
    return [500, ''];
}))->summary();
check('ga: when Google is down the console shows an error and nothing breaks', $gaBad['configured'] === true && isset($gaBad['error']));
$keydir = $tmp . '-kd';
@mkdir($keydir . '/secrets', 0700, true);
file_put_contents($keydir . '/secrets/ga.json', json_encode($gaAccount));
@mkdir($tmp . '-outside', 0700, true);
file_put_contents($tmp . '-outside/ga.json', json_encode($gaAccount));
check('ga: the key file must be inside the private folder (no path escapes)', GoogleAnalytics::loadKeyFile('secrets/ga.json', $keydir) !== null && GoogleAnalytics::loadKeyFile($keydir . '/secrets/ga.json', $keydir) !== null && GoogleAnalytics::loadKeyFile('../' . basename($tmp) . '-outside/ga.json', $keydir) === null && GoogleAnalytics::loadKeyFile($tmp . '-outside/ga.json', $keydir) === null && GoogleAnalytics::loadKeyFile('/etc/passwd', $keydir) === null && GoogleAnalytics::loadKeyFile('', $keydir) === null && GoogleAnalytics::loadKeyFile(null, $keydir) === null);

foreach ([$tmp, $tmp . '-b', $tmp . '-c', $tmp . '-d', $tmp . '-e', $tmp . '-f', $tmp . '-g', $tmp . '-h', $tmp . '-i', $tmp . '-j', $tmp . '-k', $tmp . '-l', $tmp . '-m', $tmp . '-n', $tmp . '-o', $tmp . '-p', $tmp . '-q', $tmp . '-r', $tmp . '-s', $tmp . '-t', $tmp . '-u', $tmp . '-kd', $tmp . '-outside'] as $dir) {
    exec('rm -rf ' . escapeshellarg($dir));
}

// ---- Cloudflare client address ----
check('cf: published IPv4 and IPv6 ranges recognised', CloudflareIps::contains('104.21.4.95') && CloudflareIps::contains('172.67.153.246') && CloudflareIps::contains('162.159.0.1') && CloudflareIps::contains('2606:4700:3031::ac43:99f6'));
check('cf: range edges are exact', CloudflareIps::contains('173.245.63.255') && !CloudflareIps::contains('173.245.64.0') && CloudflareIps::contains('104.23.255.255') && !CloudflareIps::contains('104.32.0.0'));
check('cf: ordinary and malformed addresses are not Cloudflare', !CloudflareIps::contains('8.8.8.8') && !CloudflareIps::contains('203.0.113.9') && !CloudflareIps::contains('not-an-ip') && !CloudflareIps::contains('2001:db8::1'));
check('cf: header honoured only from a Cloudflare peer', CloudflareIps::clientIp('104.21.4.95', '198.51.100.7', true) === '198.51.100.7');
check('cf: spoofed header from a direct connection is ignored', CloudflareIps::clientIp('203.0.113.9', '198.51.100.7', true) === '203.0.113.9');
check('cf: trust off, garbage or missing header fall back to the peer', CloudflareIps::clientIp('104.21.4.95', '198.51.100.7', false) === '104.21.4.95' && CloudflareIps::clientIp('104.21.4.95', 'junk', true) === '104.21.4.95' && CloudflareIps::clientIp('104.21.4.95', null, true) === '104.21.4.95');

// --- abuse protection on public write routes
$js = ['CONTENT_TYPE' => 'application/json', 'HTTP_HOST' => 'flightdeck.gakinz.com'];
check('cross-site: a same-site JSON request is accepted', App::refuseCrossSite($js) === null && App::refuseCrossSite($js + ['HTTP_ORIGIN' => 'https://flightdeck.gakinz.com', 'HTTP_SEC_FETCH_SITE' => 'same-origin']) === null);
check('cross-site: a form or text post (no preflight) is refused', App::refuseCrossSite(['CONTENT_TYPE' => 'text/plain'] + $js) !== null && App::refuseCrossSite(['CONTENT_TYPE' => 'application/x-www-form-urlencoded', 'HTTP_HOST' => 'x']) !== null && App::refuseCrossSite(['HTTP_HOST' => 'x']) !== null);
check('cross-site: another site in Origin or Sec-Fetch-Site is refused', App::refuseCrossSite($js + ['HTTP_ORIGIN' => 'https://evil.example']) !== null && App::refuseCrossSite($js + ['HTTP_SEC_FETCH_SITE' => 'cross-site']) !== null && App::refuseCrossSite($js + ['HTTP_SEC_FETCH_SITE' => 'same-site']) !== null);
check('cross-site: local development (origin with port) still works', App::refuseCrossSite(['CONTENT_TYPE' => 'application/json; charset=utf-8', 'HTTP_HOST' => '127.0.0.1:3998', 'HTTP_ORIGIN' => 'http://127.0.0.1:3998']) === null);
check('rate key: IPv6 is limited per /64, IPv4 per address', App::visitorKey('2001:db8:1:2:aaaa::1') === App::visitorKey('2001:db8:1:2:ffff::9') && App::visitorKey('2001:db8:1:3::1') !== App::visitorKey('2001:db8:1:2::1') && App::visitorKey('198.51.100.7') === '198.51.100.7');

$cs = new Store($tmp . '-sweep');
$cs->put('old', ['x' => 1], -1000);
$cs->put('fresh', ['x' => 2], 600000);
check('store: reading an expired entry deletes its file', $cs->get('old') === null && !is_file($tmp . '-sweep/cache/old.json') && $cs->get('fresh') === ['x' => 2]);
$cs->put('old2', 1, -1000);
check('store: sweep removes expired entries and keeps live ones', $cs->sweep() === 1 && $cs->get('fresh') === ['x' => 2]);

$capDir = $tmp . '-cap';
@mkdir($capDir . '/enquiries', 0700, true);
for ($i = 0; $i < Enquiries::MAX_STORED; $i++) { touch(sprintf('%s/enquiries/2026010100%04d-%06x.json', $capDir, $i % 10000, $i)); }
$capped = (new Enquiries($capDir, static function () { return true; }))->submit($ok, null, 'n@x.com', $nowMs);
check('enquiry: storage has a hard ceiling (a flood cannot fill the disk)', $capped['status'] === 503);
array_map('unlink', glob($capDir . '/enquiries/*.json') ?: []);

$race = new Enquiries($tmp . '-race', static function () { return true; });
$rid2 = $race->submit($ok, null, 'n@x.com', $nowMs)['id'];
$race->reply($rid2, 'First reply', 'info@x.com', null, $nowMs + 1);
$race->setStatus($rid2, 'archived');
$after = $race->list()['items'][0];
check('enquiry: a status change keeps the replies already saved', $after['status'] === 'archived' && count($after['replies']) === 1 && !glob($tmp . '-race/enquiries/*.tmp'));

$staleStore = new Store($tmp . '-stale');
$staleStore->put('clerk-jwks-stale', json_decode($jwks, true)['keys'], 86400000);
$staleAuth = new ClerkAuth($iss, $staleStore, static function () { return [503, '']; });
$claimsNow = ['iss' => $iss, 'sub' => 'user_1', 'exp' => time() + 60, 'nbf' => time() - 10];
check('auth: when Clerk is unreachable, the last known keys (kept a week) still verify sign-ins', $staleAuth->check($mint($claimsNow), time())['ok'] === true);
$freshStore = new Store($tmp . '-stale2');
(new ClerkAuth($iss, $freshStore, $jwksUp))->check($mint($claimsNow), time());
check('auth: every successful key fetch also keeps a long-lived copy', is_array($freshStore->get('clerk-jwks-stale')));

// ------------------------------------------------------------------ CMS: the safe Markdown subset (no raw HTML, safe links only)
$md = static function (string $s, array $vars = []): string {
    return \Flightdeck\Content\Markdown::render($s, $vars, 'https://flightdeck.gakinz.com')['html'];
};
$attacks = [
    '<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '[x](javascript:alert(1))', '[x](JaVaScRiPt:alert(1))', '[x](data:text/html;base64,PHNjcmlwdD4=)',
    '[x](//evil.example/a)', '[x](&#106;avascript:alert(1))', '[x](/a"onmouseover="alert(1))', '[x](vbscript:msgbox)', '<a href="https://x">x</a>',
    '## <svg onload=alert(1)>', '| <b>a</b> | b |' . "\n" . '| --- | --- |' . "\n" . '| <i>c</i> | d |', '`<script>`', '**<u>bold</u>**', "> <iframe src=x></iframe>",
    '[x](https://ok.example/"><script>)', '[x](mailto:a@b.co?subject=<script>)', '[x](/path\\evil)', "[a\nb](javascript:x)",
];
$bad = false;
foreach ($attacks as $a) {
    $h = $md($a);
    // Inspect real tags only (escaped text such as "&lt;img onerror" is harmless): allowed names, allowed attributes, safe hrefs.
    $unsafe = false;
    preg_match_all('/<(\/?)([a-zA-Z0-9]+)([^>]*)>/', $h, $tags, PREG_SET_ORDER);
    foreach ($tags as $t) {
        if (!in_array(strtolower($t[2]), ['h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'code', 'a', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'div'], true)) {
            $unsafe = true;
        }
        preg_match_all('/\s([a-zA-Z-]+)(?:="([^"]*)")?/', $t[3], $attrs, PREG_SET_ORDER);
        foreach ($attrs as $at) {
            $name = strtolower($at[1]);
            $val = html_entity_decode($at[2] ?? '', ENT_QUOTES | ENT_HTML5);
            if (!in_array($name, ['href', 'id', 'rel', 'class', 'data-fd-cookie-settings'], true) || ($name === 'href' && !preg_match('#^(/(?!/)|\#|https?://|mailto:)#i', $val))) {
                $unsafe = true;
            }
        }
        if (preg_match('/["\'][^>]*["\']\s*[a-z]+=/i', $t[3]) && strtolower($t[2]) === 'a' && substr_count($t[3], '"') > 4) {
            $unsafe = true; // an attribute broke out of its quotes
        }
    }
    if ($unsafe) {
        $bad = true;
        echo "   unsafe output for: $a\n   -> $h\n";
    }
}
check('markdown: script, handler, javascript/data/vbscript and protocol-relative links never come out', !$bad);
check('markdown: blocks render (headings with ids, lists, tables, quotes)', $md("## Hello world\n\n- a\n- b\n\n1. one\n2. two\n\n| H | I |\n| --- | --- |\n| c | d |\n\n> note") === '<h2 id="hello-world">Hello world</h2>' . "\n" . '<ul><li>a</li><li>b</li></ul>' . "\n" . '<ol><li>one</li><li>two</li></ol>' . "\n" . '<div class="table-scroll"><table><thead><tr><th>H</th><th>I</th></tr></thead><tbody><tr><td>c</td><td>d</td></tr></tbody></table></div>' . "\n" . '<blockquote><p>note</p></blockquote>');
check('markdown: inline bold, italic, code and escaping', $md('**b** *i* `c<d` \\*not\\* a & b') === '<p><strong>b</strong> <em>i</em> <code>c&lt;d</code> *not* a &amp; b</p>');
check('markdown: site links plain, external links noopener, mailto allowed', $md('[a](/guides/) [b](https://example.com/x) [c](https://flightdeck.gakinz.com/y) [d](mailto:hi@example.com)') === '<p><a href="/guides/">a</a> <a href="https://example.com/x" rel="noopener">b</a> <a href="https://flightdeck.gakinz.com/y">c</a> <a href="mailto:hi@example.com">d</a></p>');
check('markdown: an unsafe link keeps its words and loses the link', $md('[click](javascript:alert(1))') === '<p>[click](javascript:alert(1))</p>' || strpos($md('[click](javascript:alert1)'), '<a') === false);
check('markdown: placeholders are filled and their values cannot add markup or links', $md('By {{ownerName}}.', ['ownerName' => '**x** [y](javascript:z) <b>']) === '<p>By **x** [y](javascript:z) &lt;b&gt;.</p>');
check('markdown: unknown placeholders stay visible for the editor', $md('{{nope}}') === '<p>{{nope}}</p>');
check('markdown: duplicate headings get unique ids; the toc lists h2 only', \Flightdeck\Content\Markdown::render("## A\n\n### B\n\n## A")['toc'] === [['id' => 'a', 'text' => 'A'], ['id' => 'a-2', 'text' => 'A']]);
check('markdown: #cookie-settings reopens the cookie choice', $md('[Cookie settings](#cookie-settings)') === '<p><a href="#cookie-settings" data-fd-cookie-settings>Cookie settings</a></p>');
check('markdown: safeHref allows site paths, https and mailto only', \Flightdeck\Content\Markdown::safeHref('/a/') === '/a/' && \Flightdeck\Content\Markdown::safeHref('https://x.org') === 'https://x.org' && \Flightdeck\Content\Markdown::safeHref('javascript:x') === null && \Flightdeck\Content\Markdown::safeHref('//x.org') === null);
check('markdown: multibyte text survives', $md('Café — naïve “quotes” 日本') === '<p>Café — naïve “quotes” 日本</p>');

echo $failed ? "\n$failed FAILED\n" : "\nAll passed\n";
exit($failed ? 1 : 0);
