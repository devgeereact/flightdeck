<?php
declare(strict_types=1);
// Test helper for test/site.test.mjs: renders site paths from the seed and prints JSON.
// stdin: {"paths": [...], "settings": {...overrides}, "config": {...server config}, "content": {...top-level overrides}, "now": unix}
require __DIR__ . '/../private/src/Content/Markdown.php';
require __DIR__ . '/../private/src/Content/ContentStore.php';
require __DIR__ . '/../private/src/Site/Site.php';

$in = json_decode((string) stream_get_contents(STDIN), true) ?: [];
$content = (new Flightdeck\Content\ContentStore(sys_get_temp_dir()))->seed();
$content['settings'] = array_merge($content['settings'], $in['settings'] ?? []);
foreach ($in['content'] ?? [] as $k => $v) {
    $content[$k] = $v;
}
$assets = ['css' => '/site-test.css', 'js' => '/site-test.js', 'contactJs' => '/js/contact-test.js', 'checklistJs' => '/js/travel-checklist-test.js', 'gaId' => (string) ($in['gaId'] ?? '')];
$site = new Flightdeck\Site\Site($content, $assets, $in['config'] ?? [], isset($in['now']) ? (int) $in['now'] : null);
$out = [];
foreach ($in['paths'] ?? [] as $p) {
    $out[$p] = $site->handle($p);
}
echo json_encode($out, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
