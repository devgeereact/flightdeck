<?php
declare(strict_types=1);
// WebFacts tests (ADR-025). Included by run.php, so check() and $gdir exist. Nothing here calls a real service: the Bright Data and
// Anthropic calls are replaced by fake `$post` functions, and every flight below is sample data.
//
// The rule these tests protect: the AI may only PROPOSE a value with a quote. The code accepts it only when the quote appears
// word for word in a search result that names this flight's number and date, the value sits right after its label (Gate, Terminal,
// Belt, Boarding), and the airport on that side of the flight is named. A wrong gate is worse than none.

use Flightdeck\Store;
use Flightdeck\WebCheck;
use Flightdeck\WebFacts;

$wfCtx = ['number' => 'BA75', 'date' => '2026-11-09', 'adate' => '2026-11-10', 'from' => 'LHR', 'to' => 'LOS'];
$wfCands = [
    0 => ['title' => 'Flight BA075 to Lagos from London', 'site' => 'heathrow.com', 'url' => 'https://www.heathrow.com/x',
        'text' => 'Depart: London (LHR). Date. Mon, 09 Nov. Departure time. Estimated Time. 10:10. Terminal. 5. Gate. 12. Boarding 09:35.'],
    1 => ['title' => 'BA75 London to Lagos', 'site' => 'example-old.com', 'url' => 'https://example-old.com/a',
        'text' => 'British Airways flight BA75 left London (LHR) on Sat 7 Nov 2026. Departure Gate 7.'],
    2 => ['title' => 'BA77 London to Accra', 'site' => 'example-other.com', 'url' => 'https://example-other.com/a',
        'text' => 'Depart: London (LHR). Mon, 09 Nov. Terminal 5. Gate 3.'],
    3 => ['title' => 'BA75 arrivals Lagos', 'site' => 'faan.example', 'url' => 'https://faan.example/a',
        'text' => 'Arrival: Lagos (LOS). Tue, 10 Nov. BA75 expected 17:05. Arrival gate B4. Baggage belt 3.'],
    4 => ['title' => 'Schedule BA75', 'site' => 'example-multi.com', 'url' => 'https://example-multi.com/a',
        'text' => 'BA75 LHR departures: Sun 8 Nov Gate 5. Mon 9 Nov Gate 9. Tue 10 Nov Gate 11.'],
    5 => ['title' => 'BA75 live', 'site' => 'flightaware.com', 'url' => 'https://www.flightaware.com/live/flight/BAW75',
        'text' => 'Depart: London (LHR). Mon, 09 Nov. Gate 22.'],
    6 => ['title' => 'BA75 departures', 'site' => 'example-lower.com', 'url' => 'https://example-lower.com/a',
        'text' => 'Departures from London (LHR) on 9 Nov: BA75 to Lagos, gate b34.'],
    7 => ['title' => 'BA75 LHR to LOS', 'site' => 'example-dep.com', 'url' => 'https://example-dep.com/a',
        'text' => 'BA75 LHR to LOS departures 10 Nov: gate 8.'],
    // 8-13 each break exactly one rule, so removing any one rule in WebFacts::validate turns a test red.
    8 => ['title' => 'BA75', 'site' => 'iso-noword.example', 'url' => 'https://iso-noword.example/a', 'text' => 'BA75 LHR 9 Nov: gate 14.'],
    9 => ['title' => 'BA75', 'site' => 'iso-nocode.example', 'url' => 'https://iso-nocode.example/a', 'text' => 'BA75 departures 9 Nov: gate 14.'],
    10 => ['title' => 'BA75', 'site' => 'iso-otherword.example', 'url' => 'https://iso-otherword.example/a', 'text' => 'BA75 Arrival: Lagos (LOS) 10 Nov. Departure was late. Gate 8.'],
    11 => ['title' => 'BA75', 'site' => 'iso-shape1.example', 'url' => 'https://iso-shape1.example/a', 'text' => 'BA75 departures from LHR 9 Nov. Gate TBC.'],
    12 => ['title' => 'BA75', 'site' => 'iso-shape2.example', 'url' => 'https://iso-shape2.example/a', 'text' => 'BA75 departures from LHR 9 Nov. Gate 1234.'],
    14 => ['title' => 'BA75', 'site' => 'iso-http.example', 'url' => 'http://iso-http.example/a', 'text' => 'BA75 departures from LHR 9 Nov. Gate 31.'],
    13 => ['title' => 'BA75', 'site' => 'iso-long.example', 'url' => 'https://iso-long.example/a', 'text' => 'BA75 departures from LHR 9 Nov. ' . str_repeat('Lorem ipsum dolor. ', 12) . 'Gate 21.'],
];
$f = static fn (string $field, string $value, int $source, string $quote): array => ['field' => $field, 'value' => $value, 'source' => $source, 'quote' => $quote];
$ok = static fn (array $proposed): array => WebFacts::validate(['findings' => $proposed], $GLOBALS['wfCands'], $GLOBALS['wfCtx']);

$a = $ok([$f('departureGate', '12', 0, 'Depart: London (LHR). Date. Mon, 09 Nov. Departure time. Estimated Time. 10:10. Terminal. 5. Gate. 12.')]);
check('web facts: a gate is accepted when the quote is in a result for this flight, date and airport', ($a['departureGate']['value'] ?? '') === '12' && ($a['departureGate']['site'] ?? '') === 'heathrow.com' && ($a['departureGate']['url'] ?? '') === 'https://www.heathrow.com/x');
$a = $ok([$f('departureTerminal', '5', 0, 'Estimated Time. 10:10. Terminal. 5.')]);
check('web facts: a terminal is accepted the same way', ($a['departureTerminal']['value'] ?? '') === '5');
check('web facts: a value is shown upper-case whatever the page used', ($ok([$f('departureGate', 'b34', 6, 'Departures from London (LHR) on 9 Nov: BA75 to Lagos, gate b34.')])['departureGate']['value'] ?? '') === 'B34');

check('web facts: a quote that is not in the result is refused (an invented gate)', $ok([$f('departureGate', '14', 0, 'Depart: London (LHR). Mon, 09 Nov. Gate. 14.')]) === []);
check('web facts: a result for a different date is refused (the 7 and 8 Nov results seen live)', $ok([$f('departureGate', '7', 1, 'left London (LHR) on Sat 7 Nov 2026. Departure Gate 7.')]) === []);
check('web facts: a result for another flight is refused', $ok([$f('departureGate', '3', 2, 'Depart: London (LHR). Mon, 09 Nov. Terminal 5. Gate 3.')]) === []);
check('web facts: a result from a flight tracker is refused even if it was passed in', $ok([$f('departureGate', '22', 5, 'Depart: London (LHR). Mon, 09 Nov. Gate 22.')]) === []);
check('web facts: the airport on that side must be named', $ok([$f('departureGate', '14', 9, 'BA75 departures 9 Nov: gate 14.')]) === []);
check('web facts: the result must be about that side of the flight (departures or arrivals)', $ok([$f('departureGate', '14', 8, 'BA75 LHR 9 Nov: gate 14.')]) === [] && ($ok([$f('departureGate', '14', 9, 'BA75 departures 9 Nov: gate 14.')]) === []));
check('web facts: a quote that talks about the other side is refused', $ok([$f('arrivalGate', '8', 10, 'Departure was late. Gate 8.')]) === [] && ($ok([$f('arrivalGate', '8', 10, 'BA75 Arrival: Lagos (LOS) 10 Nov. Departure was late. Gate 8.')]) === []));
check('web facts: a source link that is not https is refused', $ok([$f('departureGate', '31', 14, 'Gate 31.')]) === []);
check('web facts: when two findings name the same field, the first valid one is kept', ($ok([$f('departureGate', '12', 0, 'Estimated Time. 10:10. Terminal. 5. Gate. 12.'), $f('departureGate', '9', 4, 'Mon 9 Nov Gate 9.')])['departureGate']['value'] ?? '') === '12');
check('web facts: a value must have the shape of a gate', $ok([$f('departureGate', 'TBC', 11, 'Gate TBC.')]) === [] && $ok([$f('departureGate', '1234', 12, 'Gate 1234.')]) === []);
check('web facts: a quote over 200 characters is refused even when it is really in the result', $ok([$f('departureGate', '21', 13, (string) $wfCands[13]['text'])]) === [] && ($ok([$f('departureGate', '21', 13, 'Gate 21.')])['departureGate']['value'] ?? '') === '21');
check('web facts: a value that does not follow its label in the quote is refused (terminal digit offered as the gate)', $ok([$f('departureGate', '5', 0, 'Depart: London (LHR). Date. Mon, 09 Nov. Departure time. Estimated Time. 10:10. Terminal. 5. Gate. 12.')]) === []);
check('web facts: a dash, TBC or an odd value is refused', $ok([$f('departureGate', '-', 0, 'Depart: London (LHR). Mon, 09 Nov. Gate. -')]) === [] && $ok([$f('departureGate', 'TBC', 0, 'Mon, 09 Nov. Gate. 12')]) === []);
check('web facts: a source number that does not exist is refused', $ok([$f('departureGate', '12', 9, 'Depart: London (LHR). Mon, 09 Nov. Gate. 12.')]) === [] && $ok([$f('departureGate', '12', -1, 'x')]) === []);
check('web facts: a quote over 200 characters is refused', $ok([$f('departureGate', '12', 0, str_repeat('x', 201))]) === []);
check('web facts: an unknown field is refused', $ok([$f('pilotName', 'X', 0, 'Depart: London (LHR). Mon, 09 Nov. Gate. 12.')]) === []);

// Arrival side: the arrival airport and the word "arrival" must be in the quote, so a departure board cannot fill an arrival field.
$a = $ok([$f('arrivalGate', 'B4', 3, 'Arrival: Lagos (LOS). Tue, 10 Nov. BA75 expected 17:05. Arrival gate B4.')]);
check('web facts: an arrival gate is accepted with the arrival date and airport', ($a['arrivalGate']['value'] ?? '') === 'B4');
$a = $ok([$f('baggageBelt', '3', 3, 'Arrival gate B4. Baggage belt 3.')]);
check('web facts: a baggage belt is accepted', ($a['baggageBelt']['value'] ?? '') === '3');
check('web facts: a departures page cannot fill the arrival gate, even with both airports and the arrival day on it', $ok([$f('arrivalGate', '8', 7, 'BA75 LHR to LOS departures 10 Nov: gate 8.')]) === [] && $ok([$f('arrivalGate', '12', 0, 'Estimated Time. 10:10. Terminal. 5. Gate. 12.')]) === []);
check('web facts: a belt value must follow belt, baggage or carousel', $ok([$f('baggageBelt', '17', 3, 'Arrival: Lagos (LOS). Tue, 10 Nov. BA75 expected 17:05.')]) === []);

// Boarding time: needs the word boarding right before the time, in 24-hour form.
$a = $ok([$f('boardingTime', '09:35', 0, 'Terminal. 5. Gate. 12. Boarding 09:35.')]);
check('web facts: a boarding time is accepted when it follows the word Boarding', ($a['boardingTime']['value'] ?? '') === '09:35');
check('web facts: a time that is not labelled boarding (the departure time) is refused', $ok([$f('boardingTime', '10:10', 0, 'Departure time. Estimated Time. 10:10. Terminal. 5.')]) === []);

// A result listing several dates: the gate counts only when the quote itself holds the flight's date.
check('web facts: in a multi-date result a quote that holds our date is accepted', ($ok([$f('departureGate', '9', 4, 'Mon 9 Nov Gate 9.')])['departureGate']['value'] ?? '') === '9');
check('web facts: in a multi-date result a quote for another day is refused', $ok([$f('departureGate', '5', 4, 'BA75 LHR departures: Sun 8 Nov Gate 5.')]) === []);
check('web facts: in a multi-date result a quote that runs into the next day is refused', $ok([$f('departureGate', '9', 4, 'Gate 9. Tue 10 Nov Gate 11.')]) === [] && $ok([$f('departureGate', '11', 4, 'Tue 10 Nov Gate 11.')]) === []);

// Date and flight number matching, on their own.
$d = static fn (string $t, string $date = '2026-11-09'): bool => WebFacts::mentionsDate($t, $date);
check('web facts: dates are found in the usual written forms', $d('Sun, 09 Nov') && $d('9 Nov') && $d('9th November 2026') && $d('Nov 9') && $d('November 9th') && $d('09/11/2026') && $d('9/11') && $d('2026-11-09') && $d('09.11.2026'));
check('web facts: other days, months and years are not matched', !$d('19 Nov') && !$d('9 Dec') && !$d('Nov 19') && !$d('09 Nov 2025') && !$d('2026-11-19') && !$d('Gate 9 at 11:09'));
$n = static fn (string $t): bool => WebFacts::mentionsFlight($t, 'BA75');
check('web facts: the flight number is found with a leading zero or a space', $n('Flight BA075') && $n('BA 75 to Lagos') && $n('(BA75)') && $n('ba75'));
check('web facts: a longer or different number is not this flight', !$n('BA750') && !$n('BA175') && !$n('XBA75') && !$n('BA7') && !$n('BA77'));
check('web facts: a number with a letter suffix keeps the suffix', WebFacts::mentionsFlight('Flight U21234 to Rome', 'U21234') && !WebFacts::mentionsFlight('Flight U2123 to Rome', 'U21234'));

// ---- the request to Claude
$req = WebFacts::request(['anthropic_key' => 'sk-ant-test-key-aaaaaaaaaaaaaaaaaaaa'], $wfCtx, $wfCands);
check('web facts request: Sonnet 5.5, structured output, low effort, one user message', ($req['model'] ?? '') === 'claude-sonnet-5-5' && ($req['output_config']['format']['type'] ?? '') === 'json_schema' && ($req['output_config']['effort'] ?? '') === 'low' && count($req['messages'] ?? []) === 1 && ($req['messages'][0]['role'] ?? '') === 'user');
check('web facts request: none of the options this model refuses (sampling, thinking off, forced tool, budget)', !isset($req['temperature']) && !isset($req['top_p']) && !isset($req['top_k']) && !isset($req['tool_choice']) && !isset($req['thinking']) && strpos((string) json_encode($req), 'budget_tokens') === false);
check('web facts request: the model name can be set in the private config', (WebFacts::request(['anthropic_model' => 'claude-haiku-5-5'], $wfCtx, $wfCands)['model'] ?? '') === 'claude-haiku-5-5');
$userText = (string) ($req['messages'][0]['content'] ?? '');
check('web facts request: the flight, the date and every result are in the message, with the results marked as data', strpos($userText, 'BA75') !== false && strpos($userText, '2026-11-09') !== false && strpos($userText, 'Terminal. 5. Gate. 12.') !== false && strpos($userText, '<results>') !== false && stripos((string) ($req['system'] ?? ''), 'data') !== false);
check('web facts request: no personal data and no key go into the message', strpos((string) json_encode($req), 'sk-ant') === false && strpos($userText, '@') === false);

$reply = static fn (array $over = []): string => json_encode($over + ['stop_reason' => 'end_turn', 'content' => [['type' => 'text', 'text' => json_encode(['findings' => [['field' => 'departureGate', 'value' => '12', 'source' => 0, 'quote' => 'Gate. 12']]])]]]);
check('web facts reply: the findings are read from the text block', (WebFacts::parseReply(200, $reply())['findings'][0]['value'] ?? '') === '12');
check('web facts reply: a refusal, a cut-off answer, an error status or junk gives nothing', WebFacts::parseReply(200, $reply(['stop_reason' => 'refusal'])) === null && WebFacts::parseReply(200, $reply(['stop_reason' => 'max_tokens'])) === null && WebFacts::parseReply(500, $reply()) === null && WebFacts::parseReply(200, 'not json') === null && WebFacts::parseReply(200, json_encode(['stop_reason' => 'end_turn', 'content' => [['type' => 'text', 'text' => 'sorry']]])) === null);

// ---- forResults: off switch, cache, caps, failures
$aiCfg = ['anthropic_key' => 'sk-ant-test-key-aaaaaaaaaaaaaaaaaaaa', 'brightdata_key' => 'k', 'brightdata_zone' => 'z', 'anthropic_daily_cap' => 2];
check('web facts: off without the Anthropic key, without Bright Data, or when switched off', !WebFacts::enabled([]) && !WebFacts::enabled(['brightdata_key' => 'k', 'brightdata_zone' => 'z']) && !WebFacts::enabled(['anthropic_key' => 'x' . str_repeat('a', 30)]) && WebFacts::enabled($aiCfg) && !WebFacts::enabled($aiCfg + ['web_facts' => false]));
$wfResults = [];
foreach ($wfCands as $c) {
    $wfResults[] = ['title' => $c['title'], 'snippet' => substr($c['text'], 0, 240), 'text' => $c['text'], 'url' => $c['url'], 'site' => $c['site']];
}
$aiCalls = 0;
$aiSeen = [];
$aiPost = static function (string $url, array $h, string $body) use (&$aiCalls, &$aiSeen): array {
    $aiCalls++;
    $aiSeen = ['url' => $url, 'headers' => $h, 'raw' => $body];
    return [200, json_encode(['stop_reason' => 'end_turn', 'content' => [['type' => 'text', 'text' => json_encode(['findings' => [
        ['field' => 'departureGate', 'value' => '12', 'source' => 0, 'quote' => 'Depart: London (LHR). Date. Mon, 09 Nov. Departure time. Estimated Time. 10:10. Terminal. 5. Gate. 12.'],
        ['field' => 'departureTerminal', 'value' => '5', 'source' => 0, 'quote' => 'Estimated Time. 10:10. Terminal. 5.'],
        ['field' => 'arrivalGate', 'value' => '99', 'source' => 3, 'quote' => 'Arrival gate 99. Tue, 10 Nov.'],
    ]])]]])];
};
$wfStore = new Store($gdir . '-wf1');
$r = WebFacts::forResults($aiCfg, $wfStore, $wfResults, $wfCtx, $aiPost);
check('web facts: a lookup returns only the checked facts, with the time they were checked', ($r['status'] ?? '') === 'ok' && array_keys($r['items']) === ['departureGate', 'departureTerminal'] && ($r['items']['departureGate']['value'] ?? '') === '12' && isset($r['checkedAt']) && $aiCalls === 1);
check('web facts: the key travels only in the x-api-key header, to the Messages endpoint', $aiSeen['url'] === 'https://api.anthropic.com/v1/messages' && in_array('x-api-key: sk-ant-test-key-aaaaaaaaaaaaaaaaaaaa', $aiSeen['headers'], true) && strpos($aiSeen['raw'], 'sk-ant-test') === false && in_array('anthropic-version: 2026-10-21', $aiSeen['headers'], true));
WebFacts::forResults($aiCfg, $wfStore, $wfResults, $wfCtx, $aiPost);
check('web facts: the same results are not sent to Claude twice (answered from the cache)', $aiCalls === 1);
$changed = $wfResults;
$changed[0]['text'] .= ' Updated.';
WebFacts::forResults($aiCfg, $wfStore, $changed, $wfCtx, $aiPost);
check('web facts: changed results are sent again', $aiCalls === 2);
$changed2 = $wfResults;
$changed2[0]['text'] .= ' Updated again.';
$capped = WebFacts::forResults($aiCfg, $wfStore, $changed2, $wfCtx, $aiPost);
check('web facts: the daily cap stops further Claude calls and says so', ($capped['status'] ?? '') === 'cap' && $aiCalls === 2);

$failStore = new Store($gdir . '-wf2');
$failPost = static function (string $url, array $h, string $body) use (&$aiCalls): array {
    $aiCalls++;
    return [529, '{"type":"error"}'];
};
$before = $aiCalls;
$bad = WebFacts::forResults($aiCfg, $failStore, $wfResults, $wfCtx, $failPost);
WebFacts::forResults($aiCfg, $failStore, $wfResults, $wfCtx, $failPost);
check('web facts: a Claude failure gives status error, and an immediate retry is not made again', ($bad['status'] ?? '') === 'error' && $aiCalls === $before + 1);
check('web facts: no results means no call', ($z = WebFacts::forResults($aiCfg, new Store($gdir . '-wf3'), [], $wfCtx, $aiPost)) && ($z['status'] ?? '') === 'ok' && $z['items'] === [] && $aiCalls === $before + 1);

// ---- WebCheck changes that feed this
$long = WebCheck::results([['link' => 'https://www.heathrow.com/a', 'title' => 'T', 'description' => str_repeat('word ', 200)]]);
check('web check: results keep a longer text for the server and a short snippet for the screen', strlen($long[0]['snippet']) <= 240 && strlen($long[0]['text']) > 240 && strlen($long[0]['text']) <= 600);
check('web check: the text meant for the server is removed before the answer goes to the app', !isset(WebCheck::forClient(['status' => 'ok', 'results' => $long, 'facts' => ['status' => 'ok']])['results'][0]['text']) && isset(WebCheck::forClient(['status' => 'ok', 'results' => $long, 'facts' => ['status' => 'ok']])['facts']));
$caps = ['brightdata_key' => 'k', 'brightdata_zone' => 'z'];
$okPost = static fn (string $u, array $h, string $b): array => [200, json_encode(['organic' => []])];
$capStore = new Store($gdir . '-wf4');
$allowed = 0;
for ($i = 101; $i <= 145; $i++) {
    if ((WebCheck::lookup($caps, $capStore, 'BA' . $i, '2026-11-09', 'LHR', 'LOS', $okPost, 'user_cap')['status'] ?? '') === 'ok') {
        $allowed++;
    }
}
check('web check: the default allowance is 40 searches a day per signed-in user', $allowed === 40);
