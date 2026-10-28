<?php
declare(strict_types=1);

namespace Flightdeck\Content;

/**
 * Branding images (social preview image) for the CMS. Stored privately in var/content/media under their SHA-256, served by
 * site.php at /media/<sha256>.<ext>. Every upload is decoded and re-encoded with GD, which drops metadata and anything hidden
 * in the file. Without GD, uploads are switched off rather than stored unchecked. SVG is never accepted (it can carry script).
 */
final class Media
{
    public const MAX_BYTES = 2097152;
    private const TYPES = ['png' => 'image/png', 'jpg' => 'image/jpeg', 'webp' => 'image/webp'];

    private $dir;

    public function __construct(string $contentDir)
    {
        $this->dir = $contentDir . '/media';
    }

    public static function available(): bool
    {
        return function_exists('imagecreatefromstring') && function_exists('imagepng') && function_exists('imagejpeg');
    }

    /** @return array{ok: bool, status: int, error?: string, url?: string, width?: int, height?: int} */
    public function store(string $bytes): array
    {
        if (!self::available()) {
            return ['ok' => false, 'status' => 503, 'error' => 'Image uploads need the GD extension on the server.'];
        }
        if ($bytes === '' || strlen($bytes) > self::MAX_BYTES) {
            return ['ok' => false, 'status' => 413, 'error' => 'Images can be at most 2 MB.'];
        }
        $info = @getimagesizefromstring($bytes);
        $mime = is_array($info) ? (string) ($info['mime'] ?? '') : '';
        $ext = array_search($mime, self::TYPES, true);
        if ($ext === false) {
            return ['ok' => false, 'status' => 415, 'error' => 'Use a PNG, JPEG or WebP image.'];
        }
        [$w, $h] = [(int) $info[0], (int) $info[1]];
        if ($w < 600 || $h < 315 || $w > 4000 || $h > 4000) {
            return ['ok' => false, 'status' => 422, 'error' => 'Use an image between 600 × 315 and 4000 × 4000 pixels (1200 × 630 is best for link previews).'];
        }
        if ($ext === 'webp' && !function_exists('imagewebp')) {
            return ['ok' => false, 'status' => 415, 'error' => 'WebP is not supported on this server. Use PNG or JPEG.'];
        }
        $img = @imagecreatefromstring($bytes);
        if ($img === false) {
            return ['ok' => false, 'status' => 415, 'error' => 'That image could not be read.'];
        }
        ob_start();
        $ok = $ext === 'png' ? imagepng($img, null, 6) : ($ext === 'jpg' ? imagejpeg($img, null, 88) : imagewebp($img, null, 86));
        $clean = (string) ob_get_clean();
        unset($img); // freed with the variable (imagedestroy() has done nothing since PHP 8.0)
        if (!$ok || $clean === '') {
            return ['ok' => false, 'status' => 500, 'error' => 'That image could not be saved.'];
        }
        $hash = hash('sha256', $clean);
        if (!is_dir($this->dir) && !@mkdir($this->dir, 0700, true) && !is_dir($this->dir)) {
            return ['ok' => false, 'status' => 500, 'error' => 'Image storage is not writable.'];
        }
        $path = $this->dir . '/' . $hash . '.' . $ext;
        if (!is_file($path)) {
            $tmp = $path . '.' . bin2hex(random_bytes(4)) . '.tmp';
            if (@file_put_contents($tmp, $clean) === false || !@rename($tmp, $path)) {
                @unlink($tmp);  // nosemgrep: php.lang.security.unlink-use.unlink-use -- path built from validated ids or a private storage folder
                return ['ok' => false, 'status' => 500, 'error' => 'That image could not be saved.'];
            }
            @chmod($path, 0600);
        }
        return ['ok' => true, 'status' => 200, 'url' => '/media/' . $hash . '.' . $ext, 'width' => $w, 'height' => $h];
    }

    /** @return list<array{url: string, bytes: int, at: string}> */
    public function list(): array
    {
        $out = [];
        foreach (glob($this->dir . '/*') ?: [] as $f) {
            if (!preg_match('/^[0-9a-f]{64}\.(png|jpg|webp)$/D', basename($f))) {
                continue;
            }
            $out[] = ['url' => '/media/' . basename($f), 'bytes' => (int) filesize($f), 'at' => gmdate('c', (int) filemtime($f))];
        }
        usort($out, static function ($a, $b): int {
            return strcmp($b['at'], $a['at']);
        });
        return $out;
    }

    /** For site.php: the file and type for a /media/ path, or null. */
    public function file(string $name): ?array
    {
        if (!preg_match('/^([0-9a-f]{64})\.(png|jpg|webp)$/D', $name, $m)) {
            return null;
        }
        $path = $this->dir . '/' . $name;
        return is_file($path) ? ['path' => $path, 'type' => self::TYPES[$m[2]]] : null;
    }
}
