<?php
declare(strict_types=1);

namespace Flightdeck;

use Flightdeck\Content\ContentStore;
use Flightdeck\Content\Media;
use Flightdeck\Site\Site;

/**
 * Owner-console routes for the CMS and operations (docs/CMS.md). App::run has already verified the Clerk session and the owner id.
 *   GET    /admin/content/<type>                 list
 *   GET    /admin/content/<type>/<id>            published + draft + history   (?revision=<name> returns that version's data)
 *   PUT    /admin/content/<type>/<id>            save draft {baseRev, data}
 *   POST   /admin/content/<type>/<id>            {action: publish|unpublish|republish|discard|restore, revision?}
 *   DELETE /admin/content/<type>/<id>            remove from the site (history kept)
 *   POST   /admin/preview                        {type, id, data} -> rendered page HTML (not saved)
 *   GET    /admin/media, POST /admin/media       list / upload an image (raw body, image/png|jpeg|webp)
 *   GET    /admin/health                         provider health, cache state, allowance
 *   GET    /admin/audit                          recent owner actions
 */
final class Cms
{
    public const METHODS = ['GET', 'HEAD', 'PUT', 'POST', 'DELETE'];

    public static function handles(string $route): bool
    {
        return (bool) preg_match('#^/admin/(content(/|$)|preview$|media$|health$|audit$)#', $route);
    }

    public static function handle(string $route, string $method, array $config, Store $store, string $varDir, string $sub): void
    {
        $content = new ContentStore($varDir);
        if (preg_match('#^/admin/content/(page|faq|announcement|navigation|settings)$#D', $route, $m) && $method === 'GET') {
            Http::json(200, ['items' => $content->list($m[1]), 'categories' => $content->published()['guideCategories'], 'seed' => $content->isSeed()]);
            return;
        }
        if (preg_match('#^/admin/content/(page|faq|announcement|navigation|settings)/(.+)$#D', $route, $m)) {
            [$type, $id] = [$m[1], $m[2]];
            if (!ContentStore::idOk($type, $id)) {
                Http::json(422, ['error' => 'That address or id cannot be used.', 'errors' => ['slug' => 'Use lower case letters, numbers and hyphens.']]);
                return;
            }
            self::item($content, $method, $type, $id, $varDir, $sub);
            return;
        }
        if ($route === '/admin/preview' && $method === 'POST') {
            $b = App::jsonBodyPublic(262144);
            $type = is_array($b) && is_string($b['type'] ?? null) ? $b['type'] : '';
            $id = is_array($b) && is_string($b['id'] ?? null) ? $b['id'] : '';
            if (!in_array($type, ContentStore::TYPES, true) || !is_array($b['data'] ?? null)) {
                Http::json(422, ['error' => 'Nothing to preview.']);
                return;
            }
            $r = $content->preview($type, $id, $b['data']);
            if (!$r['ok']) {
                Http::json(422, ['error' => 'Some fields need attention.', 'errors' => $r['errors']]);
                return;
            }
            $path = $type === 'page' ? ($id === 'home' ? '/' : '/' . $id . '/') : ($type === 'faq' ? '/help/' : '/');
            $site = new Site($r['content'], self::assets(), $config, null, true);
            $out = $site->handle($path);
            Http::json(200, ['html' => $out['html'] ?? '', 'path' => $path]);
            return;
        }
        if ($route === '/admin/media') {
            $media = new Media($content->dir());
            if ($method === 'GET') {
                Http::json(200, ['available' => Media::available(), 'items' => $media->list(), 'maxBytes' => Media::MAX_BYTES]);
                return;
            }
            if ($method === 'POST') {
                $type = strtolower(trim(explode(';', (string) ($_SERVER['CONTENT_TYPE'] ?? ''))[0]));
                if (!in_array($type, ['image/png', 'image/jpeg', 'image/webp'], true)) {
                    Http::json(415, ['error' => 'Use a PNG, JPEG or WebP image.']);
                    return;
                }
                if (!$store->rateAllow('media:' . $sub, 20, 3600000)) {
                    Http::json(429, ['error' => 'Too many uploads this hour.']);
                    return;
                }
                $len = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
                if ($len > Media::MAX_BYTES) {
                    Http::json(413, ['error' => 'Images can be at most 2 MB.']);
                    return;
                }
                $bytes = (string) file_get_contents('php://input', false, null, 0, Media::MAX_BYTES + 1);
                $r = $media->store($bytes);
                if ($r['ok']) {
                    Admin::audit($varDir, $sub, 'media uploaded ' . basename((string) $r['url']));
                }
                Http::json($r['status'], $r['ok'] ? ['url' => $r['url'], 'width' => $r['width'], 'height' => $r['height']] : ['error' => $r['error']]);
                return;
            }
        }
        if ($route === '/admin/health' && $method === 'GET') {
            Http::json(200, ['providers' => Health::read($varDir), 'cache' => self::cacheState($varDir, $store), 'allowance' => Admin::allowance($store, $config)]);
            return;
        }
        if ($route === '/admin/audit' && $method === 'GET') {
            Http::json(200, ['entries' => self::audit($varDir, max(0, min(5000, (int) ($_GET['offset'] ?? 0)))), 'you' => substr(hash('sha256', $sub), 0, 10)]);
            return;
        }
        Http::json(404, ['error' => 'Unknown endpoint']);
    }

    private static function item(ContentStore $content, string $method, string $type, string $id, string $varDir, string $sub): void
    {
        $who = substr(hash('sha256', $sub), 0, 10);
        if ($method === 'GET' || $method === 'HEAD') {
            if (is_string($_GET['revision'] ?? null)) {
                $data = $content->revisionData($type, $id, $_GET['revision']);
                Http::json($data === null ? 404 : 200, $data === null ? ['error' => 'That version was not found.'] : ['data' => $data]);
                return;
            }
            $pub = $content->current($type, $id);
            $draft = $content->draft($type, $id);
            if ($pub === null && $draft === null) {
                Http::json(404, ['error' => 'Not found.', 'revisions' => $content->revisions($type, $id)]);
                return;
            }
            Http::json(200, ['published' => $pub, 'draft' => $draft, 'revisions' => $content->revisions($type, $id),
                'required' => $type === 'page' && in_array($id, Content\Validator::REQUIRED, true)]);
            return;
        }
        if ($method === 'PUT') {
            $b = App::jsonBodyPublic(262144);
            if (!is_array($b) || !is_array($b['data'] ?? null) || !is_int($b['baseRev'] ?? null)) {
                Http::json(422, ['error' => 'Nothing to save.']);
                return;
            }
            $r = $content->save($type, $id, $b['data'], $who, $b['baseRev']);
            if ($r['ok']) {
                Admin::audit($varDir, $sub, "content $type $id draft saved r" . $r['draft']['rev']);
            }
            Http::json($r['status'], $r['ok'] ? ['draft' => $r['draft']] : ['error' => $r['error'], 'errors' => $r['errors'] ?? null]);
            return;
        }
        if ($method === 'POST') {
            $b = App::jsonBodyPublic(1024);
            $action = is_array($b) && is_string($b['action'] ?? null) ? $b['action'] : '';
            switch ($action) {
                case 'publish':
                    $r = $content->publish($type, $id, $who);
                    break;
                case 'unpublish':
                case 'republish':
                    $r = $content->setUnpublished($type, $id, $action === 'unpublish', $who);
                    break;
                case 'discard':
                    $r = $content->discard($type, $id, $who);
                    break;
                case 'restore':
                    $r = $content->restore($type, $id, is_string($b['revision'] ?? null) ? $b['revision'] : '', $who);
                    $action = 'restore ' . (is_string($b['revision'] ?? null) ? $b['revision'] : '');
                    break;
                default:
                    Http::json(422, ['error' => 'Unknown action.']);
                    return;
            }
            if ($r['ok']) {
                Admin::audit($varDir, $sub, "content $type $id $action");
            }
            Http::json($r['status'], $r['ok'] ? ['ok' => true, 'draft' => $r['draft'] ?? null] : ['error' => $r['error'], 'errors' => $r['errors'] ?? null]);
            return;
        }
        if ($method === 'DELETE') {
            $r = $content->remove($type, $id, $who);
            if ($r['ok']) {
                Admin::audit($varDir, $sub, "content $type $id deleted");
            }
            Http::json($r['status'], $r['ok'] ? ['ok' => true] : ['error' => $r['error']]);
            return;
        }
        Http::json(405, ['error' => 'Method not allowed']);
    }

    private static function assets(): array
    {
        $public = defined('FLIGHTDECK_PUBLIC') ? FLIGHTDECK_PUBLIC : '';
        $build = $public !== '' ? json_decode((string) @file_get_contents($public . '/site-build.json'), true) : null;
        $dev = ['css' => '/site.css', 'js' => '/site.js', 'contactJs' => '/js/contact.js', 'checklistJs' => '/js/travel-checklist.js', 'gaId' => ''];
        return is_array($build) ? $build + $dev : $dev;
    }

    /** Cache folder size and the live-data snapshot age. Counts only; no cached data is shown. */
    private static function cacheState(string $varDir, Store $store): array
    {
        $files = 0;
        $bytes = 0;
        foreach (glob($varDir . '/cache/*.json') ?: [] as $f) {
            $files++;
            $bytes += (int) @filesize($f);
        }
        $snap = $store->get('snapshot');
        return ['files' => $files, 'bytes' => $bytes, 'snapshotFetchedAt' => is_array($snap) && isset($snap['fetchedAt']) ? gmdate('c', intdiv((int) $snap['fetchedAt'], 1000)) : null,
            'snapshotAircraft' => is_array($snap) && is_array($snap['states'] ?? null) ? count($snap['states']) : null];
    }

    /** Newest first, 100 at a time. Lines: "<ISO time> <user hash> <action>". */
    private static function audit(string $varDir, int $offset): array
    {
        $lines = @file($varDir . '/admin-audit.log', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
        $lines = array_reverse(array_slice($lines, -5000));
        $out = [];
        foreach (array_slice($lines, $offset, 100) as $l) {
            $parts = explode(' ', $l, 3);
            if (count($parts) === 3) {
                $out[] = ['at' => $parts[0], 'by' => $parts[1], 'action' => $parts[2]];
            }
        }
        return $out;
    }
}
