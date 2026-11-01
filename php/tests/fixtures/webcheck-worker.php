<?php
declare(strict_types=1);
// Test helper for php/tests/run.php: runs many web checks against one shared store at the same time as other copies of itself.
// Args: <store dir> <worker no> <searches> <daily cap>. Prints how many paid searches this worker made.
foreach (['Http', 'Store', 'Flight', 'Health', 'WebCheck'] as $f) {
    require __DIR__ . '/../../private/src/' . $f . '.php';
}
[, $dir, $no, $n, $cap] = $argv;
$store = new Flightdeck\Store($dir);
$posts = 0;
$post = static function () use (&$posts): array {
    $posts++;
    return [200, '{"organic":[]}'];
};
$cfg = ['brightdata_key' => 'k', 'brightdata_zone' => 'z', 'brightdata_daily_cap' => (int) $cap, 'brightdata_user_daily_cap' => 100000];
for ($i = 0; $i < (int) $n; $i++) {
    Flightdeck\WebCheck::lookup($cfg, $store, 'BA' . ((int) $no * 1000 + $i), '2026-11-01', '', '', $post);
}
echo $posts;
