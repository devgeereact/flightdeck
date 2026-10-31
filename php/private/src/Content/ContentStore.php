<?php
declare(strict_types=1);

namespace Flightdeck\Content;

/**
 * CMS storage in private var/content (no database; ADR-016). Layout:
 *   published.json                      the live snapshot, replaced atomically on every publish
 *   drafts/<type>/<id>.json             work in progress (one per item)
 *   revisions/<type>/<id>/<ts>-<n>.json immutable history of every save, publish, unpublish, delete and restore
 * The seed (seed.json next to this file) is what the site shows until something is published. The packing-list template
 * always comes from the seed: it is code-owned and shared with the app. Writes take one lock for the whole store.
 */
final class ContentStore
{
    public const TYPES = ['page', 'faq', 'announcement', 'navigation', 'settings'];
    private const SINGLETONS = ['navigation' => 'main', 'settings' => 'site'];

    private $dir;
    private $seedFile;
    private $published;

    public function __construct(string $varDir, ?string $seedFile = null)
    {
        $this->dir = $varDir . '/content';
        $this->seedFile = $seedFile ?? __DIR__ . '/seed.json';
    }

    public function dir(): string
    {
        return $this->dir;
    }

    public function seed(): array
    {
        static $cache = [];
        if (!isset($cache[$this->seedFile])) {
            $d = json_decode((string) @file_get_contents($this->seedFile), true);
            if (!is_array($d) || !isset($d['pages'], $d['settings'])) {
                throw new \RuntimeException('Content seed is missing or invalid.');
            }
            $cache[$this->seedFile] = $d;
        }
        return $cache[$this->seedFile];
    }

    /** The content visitors see: the published snapshot when there is one, otherwise the seed. */
    public function published(): array
    {
        if ($this->published === null) {
            $seed = $this->seed();
            $raw = @file_get_contents($this->dir . '/published.json');
            $pub = $raw === false ? null : json_decode($raw, true);
            if ($raw !== false && !is_array($pub)) {
                error_log('flightdeck content: published.json unreadable, showing the seed');
            }
            $c = is_array($pub) ? $pub : $seed;
            $c['checklistTemplate'] = $seed['checklistTemplate'];
            $c['guideCategories'] = $c['guideCategories'] ?? $seed['guideCategories'];
            $c['faqs'] = $c['faqs'] ?? [];
            $c['announcements'] = $c['announcements'] ?? [];
            $this->published = $c;
        }
        return $this->published;
    }

    public function isSeed(): bool
    {
        return !is_file($this->dir . '/published.json');
    }

    /** A short fingerprint of what is live, for ETags. */
    public function version(): string
    {
        $f = $this->dir . '/published.json';
        clearstatcache(true, $f);
        return is_file($f) ? substr(sha1((string) filemtime($f) . ':' . (string) filesize($f) . ':' . (string) fileinode($f)), 0, 12) : 'seed-' . substr(sha1_file($this->seedFile) ?: '', 0, 8);
    }

    public static function idOk(string $type, string $id): bool
    {
        if (isset(self::SINGLETONS[$type])) {
            return $id === self::SINGLETONS[$type];
        }
        if ($type === 'page') {
            return Validator::slugOk($id);
        }
        return in_array($type, self::TYPES, true) && preg_match('/^[a-z0-9][a-z0-9-]{0,39}$/D', $id) === 1;
    }

    // ------------------------------------------------------------------ reading items

    /** The published version of one item, or null. */
    public function current(string $type, string $id, ?array $content = null): ?array
    {
        $c = $content ?? $this->published();
        switch ($type) {
            case 'page':
                return $c['pages'][$id] ?? null;
            case 'faq':
            case 'announcement':
                foreach ($c[$type === 'faq' ? 'faqs' : 'announcements'] as $x) {
                    if (($x['id'] ?? '') === $id) {
                        return $x;
                    }
                }
                return null;
            case 'navigation':
                return $c['navigation'];
            case 'settings':
                return $c['settings'];
        }
        return null;
    }

    private function fileId(string $id): string
    {
        return str_replace('/', '~', $id);
    }

    public function draft(string $type, string $id): ?array
    {
        $d = json_decode((string) @file_get_contents($this->dir . '/drafts/' . $type . '/' . $this->fileId($id) . '.json'), true);
        return is_array($d) ? $d : null;
    }

    /** Everything of one type, for the console lists: published state, draft state and when it last changed. */
    public function list(string $type): array
    {
        $c = $this->published();
        $items = [];
        $label = static function (string $type, array $x): string {
            return (string) ($type === 'faq' ? $x['question'] : ($type === 'announcement' ? $x['message'] : ($x['title'] ?? $type)));
        };
        $add = function (string $id, ?array $pub) use (&$items, $type, $label): void {
            $d = $this->draft($type, $id);
            $src = $d['data'] ?? $pub ?? [];
            $items[$id] = ['id' => $id, 'label' => $label($type, $src), 'kind' => $src['kind'] ?? null, 'category' => $src['category'] ?? null, 'order' => $type === 'faq' ? (int) ($src['order'] ?? 0) : null,
                'published' => $pub !== null, 'unpublished' => !empty($pub['unpublished']), 'hasDraft' => $d !== null, 'draftRev' => $d['rev'] ?? 0,
                'updatedAt' => $d['updatedAt'] ?? null, 'required' => $type === 'page' && in_array($id, Validator::REQUIRED, true)];
        };
        if ($type === 'page') {
            foreach ($c['pages'] as $slug => $p) {
                $add((string) $slug, $p);
            }
        } elseif ($type === 'faq' || $type === 'announcement') {
            foreach ($c[$type === 'faq' ? 'faqs' : 'announcements'] as $x) {
                $add((string) $x['id'], $x);
            }
        } else {
            $add(self::SINGLETONS[$type], $this->current($type, self::SINGLETONS[$type]));
        }
        foreach (glob($this->dir . '/drafts/' . $type . '/*.json') ?: [] as $f) { // drafts of items that were never published
            $id = str_replace('~', '/', basename($f, '.json'));
            if (!isset($items[$id])) {
                $add($id, null);
            }
        }
        return array_values($items);
    }

    // ------------------------------------------------------------------ writing

    private function lock(callable $fn)
    {
        if (!is_dir($this->dir) && !@mkdir($this->dir, 0700, true) && !is_dir($this->dir)) {
            throw new \RuntimeException('Content storage is not writable.');
        }
        $h = fopen($this->dir . '/.lock', 'c');
        if ($h === false) {
            throw new \RuntimeException('Content storage is not writable.');
        }
        flock($h, LOCK_EX);
        try {
            $this->published = null;
            return $fn();
        } finally {
            flock($h, LOCK_UN);
            fclose($h);
            $this->published = null;
        }
    }

    private function writeJson(string $path, array $data): void
    {
        $dir = dirname($path);
        if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) {
            throw new \RuntimeException('Content storage is not writable.');
        }
        $tmp = $path . '.' . bin2hex(random_bytes(4)) . '.tmp';
        if (@file_put_contents($tmp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT)) === false) {
            throw new \RuntimeException('Content could not be written.');
        }
        @chmod($tmp, 0600);
        if (!@rename($tmp, $path)) {
            @unlink($tmp);  // nosemgrep: php.lang.security.unlink-use.unlink-use -- path built from validated ids or a private storage folder
            throw new \RuntimeException('Content could not be written.');
        }
    }

    private function revision(string $type, string $id, string $action, ?array $data, string $by): string
    {
        $dir = $this->dir . '/revisions/' . $type . '/' . $this->fileId($id);
        $t = microtime(true); // microseconds keep the history in order even for several changes in one second
        $name = gmdate('Ymd\THis', (int) $t) . sprintf('%06d', (int) (fmod($t, 1) * 1000000)) . 'Z-' . bin2hex(random_bytes(3));
        $this->writeJson($dir . '/' . $name . '.json', ['type' => $type, 'id' => $id, 'action' => $action, 'at' => gmdate('c'), 'by' => $by, 'data' => $data]);
        return $name;
    }

    private function categories(): array
    {
        return array_map(static function ($c): string {
            return (string) $c['id'];
        }, $this->published()['guideCategories']);
    }

    /**
     * Save a draft. $baseRev is the draft revision the editor started from (0 when there was no draft); if someone saved in
     * between, the save is refused so nothing is silently overwritten.
     * @return array{ok: bool, status: int, error?: string, errors?: array, draft?: array}
     */
    public function save(string $type, string $id, array $data, string $by, int $baseRev): array
    {
        if (!self::idOk($type, $id)) {
            return ['ok' => false, 'status' => 422, 'error' => 'That address or id cannot be used.', 'errors' => ['slug' => 'That address or id cannot be used.']];
        }
        return $this->lock(function () use ($type, $id, $data, $by, $baseRev): array {
            $existing = $this->current($type, $id);
            $draft = $this->draft($type, $id);
            if (($draft['rev'] ?? 0) !== $baseRev) {
                return ['ok' => false, 'status' => 409, 'error' => 'This was changed somewhere else since you opened it. Reload to see the latest version.'];
            }
            $data['id'] = $data['id'] ?? $id;
            $data['slug'] = $type === 'page' ? $id : null;
            $v = Validator::check($type, $data, $type === 'page' ? $existing : ($type === 'settings' ? $existing : null), $this->categories());
            if (!$v['ok']) {
                return ['ok' => false, 'status' => 422, 'error' => 'Some fields need attention.', 'errors' => $v['errors']];
            }
            $item = $v['item'];
            if ($type === 'faq' || $type === 'announcement') {
                $item['id'] = $id;
            }
            $rec = ['type' => $type, 'id' => $id, 'rev' => ($draft['rev'] ?? 0) + 1, 'updatedAt' => gmdate('c'), 'updatedBy' => $by, 'data' => $item];
            $this->writeJson($this->dir . '/drafts/' . $type . '/' . $this->fileId($id) . '.json', $rec);
            $this->revision($type, $id, 'save', $item, $by);
            return ['ok' => true, 'status' => 200, 'draft' => $rec];
        });
    }

    /**
     * Help and FAQ order from the console's move up / move down: $ids is every question in its new order. Each question whose
     * order number changes gets a draft with order = position (1-based), so "Publish changes" puts the new order live and the
     * history and audit trail record it. The list must name every question exactly once.
     */
    public function reorderFaqs(array $ids, string $by): array
    {
        $known = array_map(static function (array $x): string {
            return (string) $x['id'];
        }, $this->list('faq'));
        $clean = array_values(array_filter($ids, 'is_string'));
        $a = $clean;
        $b = $known;
        sort($a);
        sort($b);
        if (count($clean) !== count($ids) || $a !== $b || count(array_unique($clean)) !== count($clean)) {
            return ['ok' => false, 'status' => 422, 'error' => 'The list of questions has changed. Reload and try again.'];
        }
        $changed = 0;
        foreach ($clean as $k => $id) {
            $draft = $this->draft('faq', $id);
            $data = $draft['data'] ?? $this->current('faq', $id);
            if (!is_array($data) || (int) ($data['order'] ?? 0) === $k + 1) {
                continue;
            }
            $data['order'] = $k + 1;
            $r = $this->save('faq', $id, $data, $by, (int) ($draft['rev'] ?? 0));
            if (!$r['ok']) {
                return $r;
            }
            $changed++;
        }
        return ['ok' => true, 'status' => 200, 'changed' => $changed];
    }

    /** Replace one item in a content snapshot (used by publish and by preview). */
    public function withItem(array $c, string $type, string $id, ?array $item): array
    {
        switch ($type) {
            case 'page':
                if ($item === null) {
                    unset($c['pages'][$id]);
                } else {
                    $c['pages'][$id] = $item;
                }
                break;
            case 'faq':
            case 'announcement':
                $key = $type === 'faq' ? 'faqs' : 'announcements';
                $list = array_values(array_filter($c[$key] ?? [], static function ($x) use ($id): bool {
                    return ($x['id'] ?? '') !== $id;
                }));
                if ($item !== null) {
                    $list[] = $item;
                }
                if ($type === 'faq') {
                    usort($list, static function ($a, $b): int {
                        return [(int) ($a['order'] ?? 0)] <=> [(int) ($b['order'] ?? 0)];
                    });
                }
                $c[$key] = $list;
                break;
            case 'navigation':
            case 'settings':
                $c[$type] = $item;
                break;
        }
        return $c;
    }

    private function writePublished(array $c): void
    {
        unset($c['checklistTemplate']);
        $c['publishedAt'] = gmdate('c');
        $this->writeJson($this->dir . '/published.json', $c);
    }

    /** Publish the draft (or re-publish the current version with a changed published state). */
    public function publish(string $type, string $id, string $by): array
    {
        return $this->lock(function () use ($type, $id, $by): array {
            $draft = $this->draft($type, $id);
            if ($draft === null) {
                return ['ok' => false, 'status' => 409, 'error' => 'There are no unpublished changes.'];
            }
            $item = $draft['data'];
            unset($item['unpublished']);
            $this->writePublished($this->withItem($this->published(), $type, $id, $item));
            @unlink($this->dir . '/drafts/' . $type . '/' . $this->fileId($id) . '.json');  // nosemgrep: php.lang.security.unlink-use.unlink-use -- path built from validated ids or a private storage folder
            $rev = $this->revision($type, $id, 'publish', $item, $by);
            return ['ok' => true, 'status' => 200, 'revision' => $rev];
        });
    }

    /** Hide a page, FAQ or announcement from the site without losing it. Required pages cannot be hidden. */
    public function setUnpublished(string $type, string $id, bool $hidden, string $by): array
    {
        if (!in_array($type, ['page', 'faq', 'announcement'], true) || ($type === 'page' && in_array($id, Validator::REQUIRED, true))) {
            return ['ok' => false, 'status' => 422, 'error' => 'This item cannot be unpublished.'];
        }
        return $this->lock(function () use ($type, $id, $hidden, $by): array {
            $cur = $this->current($type, $id);
            if ($cur === null) {
                return ['ok' => false, 'status' => 404, 'error' => 'Not found.'];
            }
            if ($hidden) {
                $cur['unpublished'] = true;
            } else {
                unset($cur['unpublished']);
            }
            $this->writePublished($this->withItem($this->published(), $type, $id, $cur));
            $this->revision($type, $id, $hidden ? 'unpublish' : 'republish', $cur, $by);
            return ['ok' => true, 'status' => 200];
        });
    }

    /** Delete a draft only (the published version stays). */
    public function discard(string $type, string $id, string $by): array
    {
        return $this->lock(function () use ($type, $id, $by): array {
            $f = $this->dir . '/drafts/' . $type . '/' . $this->fileId($id) . '.json';
            if (!is_file($f)) {
                return ['ok' => false, 'status' => 404, 'error' => 'There is no draft.'];
            }
            $this->revision($type, $id, 'discard', $this->draft($type, $id)['data'] ?? null, $by);
            @unlink($f);  // nosemgrep: php.lang.security.unlink-use.unlink-use -- path built from validated ids or a private storage folder
            return ['ok' => true, 'status' => 200];
        });
    }

    /** Remove a page, FAQ or announcement from the site. Its history is kept, so it can be restored. */
    public function remove(string $type, string $id, string $by): array
    {
        if (!in_array($type, ['page', 'faq', 'announcement'], true) || ($type === 'page' && in_array($id, Validator::REQUIRED, true))) {
            return ['ok' => false, 'status' => 422, 'error' => 'This item cannot be deleted.'];
        }
        return $this->lock(function () use ($type, $id, $by): array {
            $cur = $this->current($type, $id);
            if ($cur !== null) {
                $this->writePublished($this->withItem($this->published(), $type, $id, null));
            }
            @unlink($this->dir . '/drafts/' . $type . '/' . $this->fileId($id) . '.json');  // nosemgrep: php.lang.security.unlink-use.unlink-use -- path built from validated ids or a private storage folder
            $this->revision($type, $id, 'delete', $cur, $by);
            return ['ok' => true, 'status' => 200];
        });
    }

    /** @return list<array{name: string, action: string, at: string, by: string}> newest first */
    public function revisions(string $type, string $id, int $limit = 50): array
    {
        $files = glob($this->dir . '/revisions/' . $type . '/' . $this->fileId($id) . '/*.json') ?: [];
        rsort($files);
        $out = [];
        foreach (array_slice($files, 0, $limit) as $f) {
            $d = json_decode((string) @file_get_contents($f), true);
            if (is_array($d)) {
                $out[] = ['name' => basename($f, '.json'), 'action' => (string) $d['action'], 'at' => (string) $d['at'], 'by' => (string) $d['by'], 'hasData' => is_array($d['data'] ?? null)];
            }
        }
        return $out;
    }

    public function revisionData(string $type, string $id, string $name): ?array
    {
        if (!preg_match('/^\d{8}T\d{12}Z-[0-9a-f]{6}$/D', $name)) {
            return null;
        }
        $d = json_decode((string) @file_get_contents($this->dir . '/revisions/' . $type . '/' . $this->fileId($id) . '/' . $name . '.json'), true);
        return is_array($d) && is_array($d['data'] ?? null) ? $d['data'] : null;
    }

    /** Copy an old version into the draft, to review and publish. Nothing goes live until it is published. */
    public function restore(string $type, string $id, string $name, string $by): array
    {
        $data = $this->revisionData($type, $id, $name);
        if ($data === null) {
            return ['ok' => false, 'status' => 404, 'error' => 'That version was not found.'];
        }
        $base = $this->draft($type, $id)['rev'] ?? 0;
        $r = $this->save($type, $id, $data, $by, $base);
        if ($r['ok']) {
            $this->lock(function () use ($type, $id, $name, $by): void {
                $this->revision($type, $id, 'restore ' . $name, null, $by);
            });
        }
        return $r;
    }

    /** Validate one item against the live content and return the content as it would look with it, for a preview. */
    public function preview(string $type, string $id, array $data): array
    {
        if (!self::idOk($type, $id)) {
            return ['ok' => false, 'errors' => ['slug' => 'That address or id cannot be used.']];
        }
        $existing = $this->current($type, $id);
        $data['id'] = $data['id'] ?? $id;
        $data['slug'] = $type === 'page' ? $id : null;
        $v = Validator::check($type, $data, $type === 'page' || $type === 'settings' ? $existing : null, $this->categories());
        if (!$v['ok']) {
            return ['ok' => false, 'errors' => $v['errors']];
        }
        unset($v['item']['unpublished']);
        return ['ok' => true, 'content' => $this->withItem($this->published(), $type, $id, $v['item'])];
    }
}
