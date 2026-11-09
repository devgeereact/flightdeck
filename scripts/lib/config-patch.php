<?php
// Sets `brightdata_key`, `brightdata_zone` and/or `anthropic_key` in the private config.php. Run on the server by
// scripts/set-bright-data.sh and scripts/set-anthropic-key.sh (sent as base64 through `php -r`, so nothing is left on the server)
// with the new values as JSON on STDIN:
//   {"brightdata_key": "...", "brightdata_zone": "..."}  or  {"anthropic_key": "..."}      argv[1] = path to config.php
// Rules: only those three keys; values must be plain tokens (no quotes, spaces or backslashes); the previous file is kept as
// config.php.bak-<time> (mode 600); the new file must pass `php -l` before it replaces the old one; the secret is never printed.
// Written for `eval()`, so: no declare(), no namespace, no output of values.

$fail = static function (string $why): void {
    fwrite(STDERR, "config-patch: $why\n");
    exit(1);
};

$file = $argv[1] ?? '';
if ($file === '' || !is_file($file) || !is_writable($file)) {
    $fail('the config file is missing or not writable');
}
$in = json_decode((string) stream_get_contents(STDIN), true);
if (!is_array($in) || $in === []) {
    $fail('expected a JSON object on stdin');
}

$rules = [
    'brightdata_key' => '/^[A-Za-z0-9._~+\/=:-]{16,255}$/D',
    'brightdata_zone' => '/^[A-Za-z0-9_-]{1,64}$/D',
    // Anthropic keys use letters, digits, - and _ (sk-ant-...). Same plain-token rule: no quotes, spaces or backslashes.
    'anthropic_key' => '/^[A-Za-z0-9._~+\/=:_-]{20,255}$/D',
];
foreach ($in as $k => $v) {
    if (!isset($rules[$k])) {
        $fail('only brightdata_key, brightdata_zone and anthropic_key may be set');
    }
    if (!is_string($v) || preg_match($rules[$k], $v) !== 1) {
        $fail("the value for $k is not valid (plain token, no spaces, quotes or backslashes)");
    }
}

$src = (string) file_get_contents($file);
$new = $src;
foreach ($in as $k => $v) {
    $line = "'" . $k . "' => " . var_export($v, true) . ',';
    $old = '/^([ \t]*)\'' . $k . '\'[ \t]*=>[ \t]*(?:\'(?:[^\'\\\\]|\\\\.)*\'|"(?:[^"\\\\]|\\\\.)*"|null|true|false|\d+)[ \t]*,?(.*)$/m';
    if (preg_match($old, $new) === 1) {
        $new = (string) preg_replace_callback($old, static function (array $m) use ($line): string {
            return $m[1] . $line . $m[2];
        }, $new, 1);
    } else {
        // The array ends with `];` (short style) or `);` (the older `return array (` style a tool wrote on the live server).
        $closeShort = strrpos($new, '];');
        $closeLong = strrpos($new, ');');
        $end = max($closeShort === false ? -1 : $closeShort, $closeLong === false ? -1 : $closeLong);
        if ($end < 0) {
            $fail('could not find the closing ]; or ); of the config array');
        }
        // Use the file's own indent for a new key line.
        $indent = preg_match('/^([ \t]+)\'[A-Za-z0-9_]+\'[ \t]*=>/m', $new, $im) === 1 ? $im[1] : '    ';
        $new = substr($new, 0, $end) . $indent . $line . "\n" . substr($new, $end);
    }
}

$tmp = $file . '.tmp-' . getmypid();
if (file_put_contents($tmp, $new) === false) {
    $fail('could not write the new file');
}
chmod($tmp, 0600);
exec(escapeshellarg(PHP_BINARY) . ' -l ' . escapeshellarg($tmp) . ' 2>&1', $lintOut, $lintCode);
if ($lintCode !== 0) {
    unlink($tmp);
    $fail('the edited file did not pass php -l; the original was left as it was');
}

$bak = $file . '.bak-' . gmdate('YmdHis');
for ($n = 2; file_exists($bak); $n++) {
    $bak = $file . '.bak-' . gmdate('YmdHis') . '-' . $n;
}
if (!copy($file, $bak)) {
    unlink($tmp);
    $fail('could not keep a backup; nothing was changed');
}
chmod($bak, 0600);
if (!rename($tmp, $file)) {
    unlink($tmp);
    $fail('could not replace the config file; nothing was changed');
}
if (function_exists('opcache_invalidate')) {
    @opcache_invalidate($file, true);
}

$loaded = (static function (string $f): array {
    return (array) require $f;
})($file);
$report = ['ok' => true, 'backup' => basename($bak)];
foreach ($in as $k => $v) {
    $report[$k] = ($loaded[$k] ?? null) === $v ? 'set (' . strlen($v) . ' characters)' : 'NOT SET';
}
echo json_encode($report), "\n";
