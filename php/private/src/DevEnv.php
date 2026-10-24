<?php
declare(strict_types=1);

namespace Flightdeck;

/**
 * Local development only: lets `php -S php/dev-router.php` read the project's .env so no keys have to be exported by hand.
 * It looks for <project>/.env next to php/private and does nothing anywhere else, so the real server (where the private
 * folder is flightdeck-private, not php/private) never reads a .env. Real environment variables always win.
 */
final class DevEnv
{
    /** @return array<string,string> */
    public static function parse(string $text): array
    {
        $out = [];
        foreach (preg_split('/\R/', $text) ?: [] as $line) {
            if (!preg_match('/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/', $line, $m)) {
                continue;
            }
            $v = $m[2];
            if (strlen($v) >= 2 && ($v[0] === '"' || $v[0] === "'") && substr($v, -1) === $v[0]) {
                $v = substr($v, 1, -1);
            }
            if ($v !== '') {
                $out[$m[1]] = $v;
            }
        }
        return $out;
    }

    /** @return array<string,string> */
    public static function forPrivateDir(string $privateDir): array
    {
        if (basename($privateDir) !== 'private' || basename(dirname($privateDir)) !== 'php') {
            return [];
        }
        $file = dirname($privateDir, 2) . '/.env';
        $text = is_file($file) ? @file_get_contents($file) : false;
        return $text === false ? [] : self::parse($text);
    }
}
