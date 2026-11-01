<?php
declare(strict_types=1);
// Test helper for php/tests/run.php: saves one empty checklist for a user while the test holds and swaps the lock file.
// Args: <var dir> <user>. Prints the saved revision.
foreach (['Store', 'Checklists'] as $f) {
    require __DIR__ . '/../../private/src/' . $f . '.php';
}
[, $dir, $sub] = $argv;
$r = (new Flightdeck\Checklists($dir))->put($sub, Flightdeck\Checklists::validate(['v' => 1, 'trips' => []]), 0);
echo $r['rev'];
