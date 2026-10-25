<?php
declare(strict_types=1);

namespace Flightdeck\Content;

/**
 * Server-side rules for every CMS item. Input is untrusted (it comes from the browser): unknown fields are dropped, every kept field
 * is type-checked and length-limited, links must pass the renderer's link rule. Returns the clean item or a list of field errors.
 */
final class Validator
{
    /** Paths the site cannot use for pages: real folders and files in the public root, the app and the API. */
    public const RESERVED = ['app', 'api', 'assets', 'fonts', 'js', 'media', 'home', 'index', 'sitemap', 'robots', 'ads', 'site', 'sw', 'workbox', 'manifest', 'sign-in', 'sign-up', 'sso-callback', 'v1', '__clerk', 'consent', '404'];
    /** Pages the site cannot run without. They can be edited but not unpublished or deleted. */
    public const REQUIRED = ['home', 'privacy', 'cookies', 'terms', 'contact', 'help', 'guides', 'travel-checklist', 'about'];
    public const PAGE_KINDS = ['page', 'about', 'legal', 'guide', 'help', 'contact', 'checklist', 'index', 'home'];

    private $errors = [];

    /** @return array{ok: bool, item?: array, errors?: array<string, string>} */
    public static function check(string $type, array $in, ?array $existing, array $categories = []): array
    {
        $v = new self();
        switch ($type) {
            case 'page':
                $item = $v->page($in, $existing, $categories);
                break;
            case 'faq':
                $item = $v->faq($in);
                break;
            case 'announcement':
                $item = $v->announcement($in);
                break;
            case 'navigation':
                $item = $v->navigation($in);
                break;
            case 'settings':
                $item = $v->settings($in, $existing ?? []);
                break;
            default:
                return ['ok' => false, 'errors' => ['type' => 'Unknown content type.']];
        }
        return $v->errors ? ['ok' => false, 'errors' => $v->errors] : ['ok' => true, 'item' => $item];
    }

    public static function slugOk(string $slug): bool
    {
        if (!preg_match('#^(guides/)?[a-z0-9]+(-[a-z0-9]+)*$#D', $slug) || strlen($slug) > 90) {
            return false;
        }
        return !in_array(explode('/', $slug)[0], self::RESERVED, true) || $slug === 'home';
    }

    private function err(string $field, string $message): void
    {
        if (!isset($this->errors[$field])) {
            $this->errors[$field] = $message;
        }
    }

    /** A single-line plain string, trimmed, control characters removed. */
    private function line(array $in, string $f, int $min, int $max, string $label, string $path = ''): string
    {
        $raw = $in[$f] ?? '';
        $key = $path !== '' ? $path : $f;
        if (!is_string($raw)) {
            $this->err($key, "$label must be text.");
            return '';
        }
        $s = trim(preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $raw) ?? '');
        $len = mb_strlen($s);
        if ($len < $min) {
            $this->err($key, $min <= 1 ? "$label is required." : "$label needs at least $min characters.");
        } elseif ($len > $max) {
            $this->err($key, "$label can be at most $max characters.");
        }
        return $s;
    }

    /** Multi-line Markdown text: newlines kept, other control characters removed. */
    private function text(array $in, string $f, int $min, int $max, string $label): string
    {
        $raw = $in[$f] ?? '';
        if (!is_string($raw)) {
            $this->err($f, "$label must be text.");
            return '';
        }
        $s = trim(str_replace(["\r\n", "\r"], "\n", preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]+/u', '', $raw) ?? ''));
        $len = mb_strlen($s);
        if ($len < $min) {
            $this->err($f, $min <= 1 ? "$label is required." : "$label needs at least $min characters.");
        } elseif ($len > $max) {
            $this->err($f, "$label can be at most $max characters.");
        }
        return $s;
    }

    private function date(array $in, string $f, bool $required, string $label): string
    {
        $s = is_string($in[$f] ?? null) ? trim($in[$f]) : '';
        if ($s === '' && !$required) {
            return '';
        }
        $d = \DateTime::createFromFormat('!Y-m-d', $s, new \DateTimeZone('UTC'));
        if ($d === false || $d->format('Y-m-d') !== $s) {
            $this->err($f, "$label must be a date like 2026-10-25.");
        }
        return $s;
    }

    /** @return list<string> */
    private function lines(array $in, string $f, int $maxItems, int $maxLen, string $label, string $path = ''): array
    {
        $raw = $in[$f] ?? [];
        $path = $path !== '' ? $path : $f;
        if (!is_array($raw) || count($raw) > $maxItems) {
            $this->err($path, "$label: at most $maxItems items.");
            return [];
        }
        $out = [];
        foreach (array_values($raw) as $i => $x) {
            $s = $this->line(['v' => $x], 'v', 1, $maxLen, "$label item " . ($i + 1), "$path.$i");
            if ($s !== '') {
                $out[] = $s;
            }
        }
        return $out;
    }

    private function link(array $in, string $path, bool $required): ?array
    {
        $label = $this->line($in, 'label', $required ? 1 : 0, 40, 'Link text', "$path.label");
        $href = is_string($in['href'] ?? null) ? trim($in['href']) : '';
        if ($label === '' && $href === '' && !$required) {
            return null;
        }
        if (Markdown::safeHref($href) === null || $href === '#') {
            $this->err("$path.href", 'Use a site path such as /guides/, or a full https:// address.');
        }
        return ['label' => $label, 'href' => $href];
    }

    private function page(array $in, ?array $existing, array $categories): array
    {
        $slug = is_string($in['slug'] ?? null) ? trim($in['slug']) : '';
        if ($existing !== null) {
            $slug = $existing['slug']; // the address of an existing page never changes (links and search results point at it)
            $kind = $existing['kind'];
        } else {
            $kind = is_string($in['kind'] ?? null) && in_array($in['kind'], ['page', 'guide'], true) ? $in['kind'] : 'page';
            if (!self::slugOk($slug) || ($kind === 'guide') !== (strpos($slug, 'guides/') === 0)) {
                $this->err('slug', $kind === 'guide' ? 'Use an address like guides/my-guide (lower case, numbers and hyphens).' : 'Use an address like my-page (lower case, numbers and hyphens).');
            }
        }
        $p = ['slug' => $slug, 'kind' => $kind];
        $p['title'] = $this->line($in, 'title', 3, 120, 'Title');
        $p['description'] = $this->line($in, 'description', 20, 300, 'Description');
        if ($kind === 'home') {
            return $p + $this->home($in);
        }
        $p['body'] = $this->text($in, 'body', $kind === 'page' || $kind === 'guide' || $kind === 'legal' || $kind === 'about' ? 20 : 0, 60000, 'Text');
        if ($kind === 'guide') {
            $cat = is_string($in['category'] ?? null) ? $in['category'] : '';
            if (!in_array($cat, $categories, true)) {
                $this->err('category', 'Choose a guide section.');
            }
            $p['category'] = $cat;
            $p['takeaways'] = $this->lines($in, 'takeaways', 5, 200, 'Key points');
        }
        $reviewed = $this->date($in, 'lastReviewed', false, 'Last reviewed');
        if ($reviewed !== '') {
            $p['lastReviewed'] = $reviewed;
        }
        if (!empty($in['unpublished']) && !in_array($slug, self::REQUIRED, true)) {
            $p['unpublished'] = true;
        }
        return $p;
    }

    private function home(array $in): array
    {
        $hero = is_array($in['hero'] ?? null) ? $in['hero'] : [];
        $out = ['body' => '', 'hero' => [
            'eyebrow' => $this->line($hero, 'eyebrow', 0, 60, 'Hero label', 'hero.eyebrow'),
            'title' => $this->line($hero, 'title', 5, 90, 'Hero headline', 'hero.title'),
            'text' => $this->line($hero, 'text', 20, 400, 'Hero text', 'hero.text'),
        ]];
        $out['points'] = $this->lines($in, 'points', 5, 120, 'Hero points');
        foreach (['steps' => [3, 3, 'Steps'], 'features' => [1, 9, 'Features']] as $f => [$minN, $maxN, $label]) {
            $list = is_array($in[$f] ?? null) ? array_values($in[$f]) : [];
            if (count($list) < $minN || count($list) > $maxN) {
                $this->err($f, $minN === $maxN ? "$label: exactly $minN." : "$label: between $minN and $maxN.");
            }
            $out[$f] = [];
            foreach (array_slice($list, 0, $maxN) as $i => $x) {
                $x = is_array($x) ? $x : [];
                $out[$f][] = ['title' => $this->line($x, 'title', 2, 60, "$label " . ($i + 1) . ' title', "$f.$i.title"), 'text' => $this->line($x, 'text', 10, 300, "$label " . ($i + 1) . ' text', "$f.$i.text")];
            }
        }
        $cov = is_array($in['coverage'] ?? null) ? $in['coverage'] : [];
        $cols = is_array($cov['columns'] ?? null) ? array_values($cov['columns']) : [];
        if (count($cols) > 4) {
            $this->err('coverage.columns', 'At most 4 columns.');
        }
        $out['coverage'] = ['title' => $this->line($cov, 'title', 3, 60, 'Coverage title', 'coverage.title'), 'text' => $this->line($cov, 'text', 0, 300, 'Coverage text', 'coverage.text'), 'columns' => []];
        foreach (array_slice($cols, 0, 4) as $i => $c) {
            $c = is_array($c) ? $c : [];
            $out['coverage']['columns'][] = ['title' => $this->line($c, 'title', 2, 60, 'Column ' . ($i + 1) . ' title', "coverage.columns.$i.title"), 'items' => $this->lines($c, 'items', 6, 160, 'Column ' . ($i + 1), "coverage.columns.$i.items")];
        }
        $final = is_array($in['final'] ?? null) ? $in['final'] : [];
        $out['final'] = ['title' => $this->line($final, 'title', 3, 80, 'Closing title', 'final.title'), 'text' => $this->line($final, 'text', 10, 300, 'Closing text', 'final.text')];
        return $out;
    }

    private function faq(array $in): array
    {
        $id = is_string($in['id'] ?? null) ? $in['id'] : '';
        if (!preg_match('/^[a-z0-9][a-z0-9-]{0,39}$/D', $id)) {
            $this->err('id', 'Use a short id: lower case letters, numbers and hyphens.');
        }
        $f = ['id' => $id, 'question' => $this->line($in, 'question', 5, 200, 'Question'), 'answer' => $this->text($in, 'answer', 5, 4000, 'Answer'), 'category' => $this->line($in, 'category', 2, 60, 'Section')];
        $order = $in['order'] ?? 0;
        $f['order'] = is_int($order) || (is_string($order) && ctype_digit($order)) ? max(0, min(9999, (int) $order)) : 0;
        if (!empty($in['unpublished'])) {
            $f['unpublished'] = true;
        }
        return $f;
    }

    private function announcement(array $in): array
    {
        $id = is_string($in['id'] ?? null) ? $in['id'] : '';
        if (!preg_match('/^[a-z0-9][a-z0-9-]{0,39}$/D', $id)) {
            $this->err('id', 'Use a short id: lower case letters, numbers and hyphens.');
        }
        $a = ['id' => $id, 'message' => $this->line($in, 'message', 3, 280, 'Message')];
        $a['level'] = in_array($in['level'] ?? '', ['info', 'warning'], true) ? $in['level'] : 'info';
        $a['where'] = in_array($in['where'] ?? '', ['site', 'app', 'both'], true) ? $in['where'] : 'site';
        foreach (['start' => 'Start', 'end' => 'End'] as $f => $label) {
            $s = is_string($in[$f] ?? null) ? trim($in[$f]) : '';
            if ($s !== '' && (strtotime($s) === false || !preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})$/D', $s))) {
                $this->err($f, "$label must be a date and time.");
            }
            $a[$f] = $s;
        }
        if ($a['start'] !== '' && $a['end'] !== '' && strtotime($a['end']) <= strtotime($a['start'])) {
            $this->err('end', 'The end must be after the start.');
        }
        $link = $this->link(['label' => $in['linkLabel'] ?? '', 'href' => $in['linkHref'] ?? ''], 'link', false);
        $a['linkLabel'] = $link['label'] ?? '';
        $a['linkHref'] = $link['href'] ?? '';
        if (!empty($in['unpublished'])) {
            $a['unpublished'] = true;
        }
        return $a;
    }

    private function navigation(array $in): array
    {
        $header = is_array($in['header'] ?? null) ? array_values($in['header']) : [];
        $footer = is_array($in['footer'] ?? null) ? array_values($in['footer']) : [];
        if (count($header) < 1 || count($header) > 7) {
            $this->err('header', 'The top menu needs 1 to 7 links.');
        }
        if (count($footer) < 1 || count($footer) > 5) {
            $this->err('footer', 'The footer needs 1 to 5 groups.');
        }
        $nav = ['header' => [], 'footer' => []];
        foreach (array_slice($header, 0, 7) as $i => $l) {
            $nav['header'][] = $this->link(is_array($l) ? $l : [], "header.$i", true);
        }
        foreach (array_slice($footer, 0, 5) as $g => $grp) {
            $grp = is_array($grp) ? $grp : [];
            $links = is_array($grp['links'] ?? null) ? array_values($grp['links']) : [];
            if (count($links) < 1 || count($links) > 8) {
                $this->err("footer.$g.links", 'Each footer group needs 1 to 8 links.');
            }
            $nav['footer'][] = ['title' => $this->line($grp, 'title', 1, 40, 'Group title', "footer.$g.title"), 'links' => array_map(function ($l, $i) use ($g) {
                return $this->link(is_array($l) ? $l : [], "footer.$g.links.$i", true);
            }, array_slice($links, 0, 8), array_keys(array_slice($links, 0, 8)))];
        }
        return $nav;
    }

    private function settings(array $in, array $existing): array
    {
        $s = [
            'siteName' => $this->line($in, 'siteName', 1, 60, 'Site name'),
            'siteUrl' => (string) ($existing['siteUrl'] ?? ''), // fixed: the address is set by hosting, not the console
            'ownerName' => $this->line($in, 'ownerName', 1, 80, 'Owner name'),
            'contactEmail' => $this->line($in, 'contactEmail', 3, 254, 'Contact email'),
            'lastReviewed' => $this->date($in, 'lastReviewed', true, 'Last reviewed'),
            'tagline' => $this->line($in, 'tagline', 0, 80, 'Tagline'),
            'footerBlurb' => $this->line($in, 'footerBlurb', 0, 160, 'Footer text'),
            'footerNote' => $this->line($in, 'footerNote', 0, 200, 'Footer note'),
            'socialImage' => is_string($in['socialImage'] ?? null) ? trim($in['socialImage']) : '',
        ];
        if ($s['contactEmail'] !== '' && filter_var($s['contactEmail'], FILTER_VALIDATE_EMAIL) === false) {
            $this->err('contactEmail', 'Enter a valid email address.');
        }
        if ($s['socialImage'] !== '' && !preg_match('#^/media/[0-9a-f]{64}\.(png|jpg|webp)$#D', $s['socialImage'])) {
            $this->err('socialImage', 'Choose an image uploaded in Branding.');
        }
        return $s;
    }
}
