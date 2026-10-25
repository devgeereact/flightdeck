<?php
declare(strict_types=1);

namespace Flightdeck\Content;

/**
 * CMS storage in private var/content (no database; ADR-016). Layout:
 *   published.json                      the live snapshot, replaced atomically on every publish
 *   drafts/<type>/<id>.json             work in progress (one per item)
 *   revisions/<type>/<id>/<ts>-<n>.json immutable history of every saved and published version
 * The seed (seed.json next to this file) is what the site shows until something is published. The packing-list template
 * always comes from the seed: it is code-owned and shared with the app.
 */
final class ContentStore
{
    public const TYPES = ['page', 'faq', 'announcement', 'navigation', 'settings'];

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
            $this->published = is_array($pub) ? $pub + ['checklistTemplate' => []] : $seed;
            $this->published['checklistTemplate'] = $seed['checklistTemplate'];
            $this->published['guideCategories'] = $this->published['guideCategories'] ?? $seed['guideCategories'];
        }
        return $this->published;
    }

    /** A short fingerprint of what is live, for ETags and the render cache. */
    public function version(): string
    {
        $f = $this->dir . '/published.json';
        return is_file($f) ? substr(sha1((string) filemtime($f) . ':' . (string) filesize($f)), 0, 12) : 'seed-' . substr(sha1_file($this->seedFile) ?: '', 0, 8);
    }
}
