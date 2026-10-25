<?php
declare(strict_types=1);

namespace Flightdeck\Site;

use Flightdeck\Content\ContentStore;
use Flightdeck\Content\Markdown;

/**
 * The public website, rendered from CMS content on each request (public/site.php). Pages request nothing from third parties;
 * the only scripts are our own files. A preview render (owner console) uses the same code with draft content.
 */
final class Site
{
    private const LABELS = ['page' => 'Flightdeck', 'about' => 'About', 'legal' => 'Legal and help', 'contact' => 'Get in touch', 'checklist' => 'Free tool', 'guide' => 'Travel guide', 'index' => 'Travel guides', 'help' => 'Help'];
    private const LEGAL = ['privacy', 'cookies', 'terms'];
    private const PLANE = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>';
    private const CHECK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

    private $c;
    private $s;
    private $assets;
    private $config;
    private $nowSec;
    private $preview;

    /**
     * @param array $content published (or draft, for preview) content
     * @param array $assets  ['css' => url, 'js' => url, 'contactJs' => url, 'checklistJs' => url, 'gaId' => string]
     */
    public function __construct(array $content, array $assets, array $config = [], ?int $nowSec = null, bool $preview = false)
    {
        $this->c = $content;
        $this->s = $content['settings'];
        $this->assets = $assets;
        $this->config = $config;
        $this->nowSec = $nowSec ?? time();
        $this->preview = $preview;
    }

    public static function e($v): string
    {
        return htmlspecialchars((string) $v, ENT_QUOTES | ENT_SUBSTITUTE | ENT_HTML5, 'UTF-8');
    }

    /** Resolve a request path. @return array{status: int, html?: string, location?: string, type?: string} */
    public function handle(string $path): array
    {
        if (!preg_match('#^/[A-Za-z0-9/_.-]*$#D', $path) || strpos($path, '..') !== false) {
            return ['status' => 404, 'html' => $this->notFound()];
        }
        if ($path === '/ads.txt') { // only when the owner has opened every condition of the ads gate (server config)
            return $this->adsOpen() ? ['status' => 200, 'type' => 'text/plain; charset=utf-8', 'html' => 'google.com, ' . $this->config['ads_pub_id'] . ", DIRECT, f08c47fec0942fa0\n"] : ['status' => 404, 'html' => $this->notFound()];
        }
        if ($path === '/sitemap.xml') {
            return ['status' => 200, 'type' => 'application/xml; charset=utf-8', 'html' => $this->sitemap()];
        }
        if ($path === '/' || $path === '/index.html') {
            return $path === '/' ? ['status' => 200, 'html' => $this->home()] : ['status' => 301, 'location' => '/'];
        }
        $slug = trim($path, '/');
        if (substr($slug, -11) === '/index.html') {
            return ['status' => 301, 'location' => '/' . substr($slug, 0, -10)];
        }
        $page = $this->c['pages'][$slug] ?? null;
        if ($page === null || $slug === 'home' || (!empty($page['unpublished']) && !$this->preview)) {
            return ['status' => 404, 'html' => $this->notFound()];
        }
        if (substr($path, -1) !== '/') {
            return ['status' => 301, 'location' => '/' . $slug . '/'];
        }
        return ['status' => 200, 'html' => $this->page($page)];
    }

    public function vars(): array
    {
        return ['ownerName' => $this->s['ownerName'] ?? '', 'contactEmail' => $this->s['contactEmail'] ?? '', 'lastReviewed' => $this->s['lastReviewed'] ?? '',
            'siteUrl' => $this->s['siteUrl'] ?? '', 'siteName' => $this->s['siteName'] ?? 'Flightdeck'];
    }

    private function md(string $md): array
    {
        return Markdown::render($md, $this->vars(), (string) ($this->s['siteUrl'] ?? ''));
    }

    private function inl(string $md): string
    {
        return Markdown::inline($md, $this->vars(), (string) ($this->s['siteUrl'] ?? ''));
    }

    private function url(string $slug): string
    {
        return rtrim((string) $this->s['siteUrl'], '/') . ($slug === '' ? '/' : '/' . $slug . '/');
    }

    private function catTitle(?string $id): string
    {
        foreach ($this->c['guideCategories'] ?? [] as $cat) {
            if ($cat['id'] === $id) {
                return $cat['title'];
            }
        }
        return 'Travel guide';
    }

    /** @return list<array> guides in seed order, published only */
    private function guides(): array
    {
        return array_values(array_filter($this->c['pages'], static function ($p): bool {
            return ($p['kind'] ?? '') === 'guide' && empty($p['unpublished']);
        }));
    }

    private function minutes(array $p): int
    {
        return max(1, (int) round($this->md((string) ($p['body'] ?? ''))['words'] / 200));
    }

    // ------------------------------------------------------------------ layout

    private function announcements(): string
    {
        $out = '';
        foreach ($this->c['announcements'] ?? [] as $a) {
            if (!empty($a['unpublished']) || !in_array($a['where'] ?? 'site', ['site', 'both'], true)) {
                continue;
            }
            $from = isset($a['start']) && $a['start'] !== '' ? strtotime((string) $a['start']) : null;
            $to = isset($a['end']) && $a['end'] !== '' ? strtotime((string) $a['end']) : null;
            if (($from !== null && $from !== false && $this->nowSec < $from) || ($to !== null && $to !== false && $this->nowSec >= $to)) {
                continue;
            }
            $level = ($a['level'] ?? 'info') === 'warning' ? ' announce-warning' : '';
            $href = !empty($a['linkLabel']) ? Markdown::safeHref((string) ($a['linkHref'] ?? '')) : null;
            $link = $href !== null ? ' <a href="' . self::e($href) . '"' . (preg_match('#^https?://#i', $href) ? ' rel="noopener"' : '') . '>' . self::e($a['linkLabel']) . '</a>' : '';
            $out .= '<div class="announce' . $level . '" role="region" aria-label="Announcement"><div class="wrap"><p style="margin:0">' . self::e($a['message'] ?? '') . $link . '</p></div></div>';
        }
        return $out;
    }

    private function navLink(array $l, string $here, string $extra = ''): string
    {
        $href = (string) $l['href'];
        $cur = $here === $href || ($href !== '/' && $href !== '/app/' && strpos($here, $href) === 0) ? ' aria-current="page"' : '';
        return '<a href="' . self::e($href) . '"' . $cur . $extra . '>' . self::e($l['label']) . '</a>';
    }

    private function layout(array $o): string
    {
        $title = (string) $o['title'];
        $fullTitle = !empty($o['bareTitle']) ? $title : $title . ' · ' . ($this->s['siteName'] ?? 'Flightdeck');
        $url = $o['url'];
        $here = $o['here'];
        $img = rtrim((string) $this->s['siteUrl'], '/') . (!empty($this->s['socialImage']) ? (string) $this->s['socialImage'] : '/og-image.png');
        $ld = implode('', array_map(static function (array $obj): string {
            return '<script type="application/ld+json">' . str_replace('<', '<', (string) json_encode($obj, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)) . '</script>';
        }, $o['ld'] ?? []));
        $nav = implode('', array_map(function (array $l) use ($here): string {
            return $this->navLink($l, $here);
        }, $this->c['navigation']['header'] ?? []));
        $foot = implode('', array_map(function (array $g) use ($here): string {
            return '<nav class="sf-col" aria-label="' . self::e($g['title']) . '"><h2>' . self::e($g['title']) . '</h2><ul>'
                . implode('', array_map(function (array $l) use ($here): string {
                    return '<li>' . $this->navLink($l, $here) . '</li>';
                }, $g['links'])) . '</ul></nav>';
        }, $this->c['navigation']['footer'] ?? []));
        $robots = !empty($o['noindex']) || $this->preview ? '<meta name="robots" content="noindex">' : '';
        $year = gmdate('Y', $this->nowSec);
        $scripts = '<script src="/consent.js" defer></script><script src="' . self::e($this->assets['js']) . '" defer></script>' . ($o['scripts'] ?? '');
        $adsHead = !empty($o['ads']) ? '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-' . self::e($this->config['ads_pub_id']) . '" crossorigin="anonymous"></script>' : '';
        $site = self::e($this->s['siteName'] ?? 'Flightdeck');
        return '<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>' . self::e($fullTitle) . '</title>
<meta name="description" content="' . self::e($o['description']) . '">' . $robots . '<link rel="canonical" href="' . self::e($url) . '"><meta name="theme-color" content="#133c35">
<meta property="og:title" content="' . self::e($title) . '"><meta property="og:description" content="' . self::e($o['description']) . '"><meta property="og:type" content="' . (($o['ogType'] ?? '') === 'article' ? 'article' : 'website') . '"><meta property="og:url" content="' . self::e($url) . '"><meta property="og:site_name" content="' . $site . '"><meta property="og:image" content="' . self::e($img) . '"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="' . self::e($img) . '">
<meta name="fd-ga-id" content="' . self::e($this->assets['gaId'] ?? '') . '">
<link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest">
<link rel="stylesheet" href="' . self::e($this->assets['css']) . '">' . $ld . $adsHead . '</head>
<body><a class="skip" href="#main">Skip to content</a>
' . $this->announcements() . '<header class="site-top"><div class="wrap"><a class="brand" href="/"><span class="brand-mark">' . self::PLANE . '</span><span>flightdeck<i>.</i></span></a><button class="menu-btn" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button><nav class="site-nav" id="site-nav" aria-label="Main">' . $nav . '<a class="btn btn-primary" href="/app/">Open the app</a></nav></div></header>
<main id="main">' . $o['main'] . '</main>
<footer class="sf" aria-label="Site"><div class="sf-in"><div class="sf-top"><div class="sf-about"><a class="sf-brand" href="/"><span class="sf-mark">' . str_replace('width="19" height="19"', 'width="16" height="16"', self::PLANE) . '</span><span>flightdeck<span class="sf-dot">.</span></span></a><p class="sf-blurb">' . self::e($this->s['footerBlurb'] ?? '') . '</p></div><div class="sf-cols">' . $foot . '</div></div><div class="sf-base"><p>© ' . $year . ' ' . $site . '. All rights reserved.</p><p>' . self::e($this->s['footerNote'] ?? '') . '</p></div></div></footer>
' . $scripts . '</body></html>
';
    }

    private function adsOpen(): bool
    {
        $c = $this->config;
        return !empty($c['ads_enabled']) && !empty($c['ads_licence_cleared']) && !empty($c['ads_cmp_ready']) && preg_match('/^pub-\d{10,20}$/D', (string) ($c['ads_pub_id'] ?? '')) === 1;
    }

    private function adSlot(string $kind): string
    {
        $slot = (string) (($this->config['ads_slots'] ?? [])[$kind] ?? '');
        if (!$this->adsOpen() || !preg_match('/^\d{6,20}$/D', $slot)) {
            return '';
        }
        return '<aside class="ad-slot" aria-label="Advertisement"><ins class="adsbygoogle" style="display:block" data-ad-client="ca-' . self::e($this->config['ads_pub_id']) . '" data-ad-slot="' . self::e($slot) . '" data-ad-format="auto" data-full-width-responsive="true"></ins></aside>';
    }

    private function head(array $p, string $crumbs = '', string $tags = ''): string
    {
        $label = self::LABELS[$p['kind']] ?? 'Flightdeck';
        return '<div class="page-head">' . $crumbs . '<p class="eyebrow">' . self::e($label) . '</p><h1>' . self::e($p['title']) . '</h1><p class="lede">' . self::e($p['description']) . '</p>' . $tags . '</div>';
    }

    private function prose(array $r, string $lead = '', bool $withToc = true): string
    {
        $toc = $withToc && count($r['toc']) >= 3 ? '<aside class="toc" aria-label="On this page"><p>On this page</p><ol>' . implode('', array_map(static function (array $t): string {
            return '<li><a href="#' . self::e($t['id']) . '">' . self::e($t['text']) . '</a></li>';
        }, $r['toc'])) . '</ol></aside>' : '';
        return '<div class="layout' . ($toc ? '' : ' no-toc') . '">' . $toc . '<div class="prose">' . $lead . $r['html'] . '</div></div>';
    }

    private function cards(array $list, bool $pill = true): string
    {
        return '<ul class="cards">' . implode('', array_map(function (array $g) use ($pill): string {
            return '<li><a href="/' . self::e($g['slug']) . '/">' . ($pill ? '<em>' . self::e($this->catTitle($g['category'] ?? null)) . '</em>' : '') . '<strong>' . self::e($g['title']) . '</strong><span>' . self::e($g['description']) . '</span><span class="cd-meta">' . $this->minutes($g) . ' min read · Read the guide →</span></a></li>';
        }, $list)) . '</ul>';
    }

    private function cta(string $title, string $text, string $href, string $label): string
    {
        return '<section class="cta-box"><h2>' . self::e($title) . '</h2><p>' . self::e($text) . '</p><a class="btn btn-primary" href="' . self::e($href) . '">' . self::e($label) . '</a></section>';
    }

    private function webPage(array $p, string $url): array
    {
        return ['@context' => 'https://schema.org', '@type' => 'WebPage', 'name' => $p['title'], 'description' => $p['description'], 'url' => $url,
            'isPartOf' => ['@type' => 'WebSite', 'name' => $this->s['siteName'], 'url' => $this->s['siteUrl']]];
    }

    // ------------------------------------------------------------------ pages

    private function page(array $p): string
    {
        switch ($p['kind']) {
            case 'guide':
                return $this->guide($p);
            case 'index':
                return $this->guideIndex($p);
            case 'checklist':
                return $this->checklist($p);
            case 'contact':
                return $this->contact($p);
            case 'help':
                return $this->help($p);
        }
        $slug = $p['slug'];
        $url = $this->url($slug);
        $r = $this->md((string) $p['body']);
        $legal = in_array($slug, self::LEGAL, true) || $p['kind'] === 'legal';
        $tags = $legal ? '<p class="meta">Last reviewed ' . self::e($p['lastReviewed'] ?? $this->s['lastReviewed']) . '</p>' : '';
        $main = '<div class="page">' . $this->head($p + ['kind' => 'page'], '', $tags) . $this->prose($r) . '</div>';
        return $this->layout(['title' => $p['title'], 'description' => $p['description'], 'url' => $url, 'here' => '/' . $slug . '/', 'main' => $main, 'ld' => [$this->webPage($p, $url)]]);
    }

    private function guide(array $p): string
    {
        $slug = $p['slug'];
        $url = $this->url($slug);
        $cat = $p['category'] ?? '';
        $catTitle = $this->catTitle($cat);
        $reviewed = $p['lastReviewed'] ?? $this->s['lastReviewed'];
        $r = $this->md((string) $p['body']);
        $crumbs = '<nav class="crumbs" aria-label="Breadcrumb"><a href="/guides/">Guides</a><span aria-hidden="true">›</span><a href="/guides/#cat-' . self::e($cat) . '">' . self::e($catTitle) . '</a><span aria-hidden="true">›</span><span aria-current="page">' . self::e($p['title']) . '</span></nav>';
        $tags = '<p class="tags"><span class="tag">' . self::e($catTitle) . '</span><span>' . $this->minutes($p) . ' min read</span><span>Last reviewed ' . self::e($reviewed) . '</span></p>';
        $take = !empty($p['takeaways']) ? '<div class="take"><p class="take-h">Key points</p><ul>' . implode('', array_map(function ($x): string {
            return '<li>' . $this->inl((string) $x) . '</li>';
        }, $p['takeaways'])) . '</ul></div>' : '';
        $guides = $this->guides();
        $others = array_values(array_filter($guides, static function ($g) use ($slug): bool {
            return $g['slug'] !== $slug;
        }));
        $same = array_filter($others, static function ($g) use ($cat): bool {
            return ($g['category'] ?? '') === $cat;
        });
        $diff = array_filter($others, static function ($g) use ($cat): bool {
            return ($g['category'] ?? '') !== $cat;
        });
        $related = array_slice(array_merge(array_values($same), array_values($diff)), 0, 3);
        $relHtml = $related ? '<section class="related" aria-label="More guides"><h2>More guides</h2><p class="sub">Keep reading.</p>' . $this->cards($related) . '</section>' : '';
        $slot = $this->adSlot('guide');
        $main = '<div class="page">' . $this->head($p, $crumbs, $tags) . $this->prose($r, $take) . $slot . $relHtml
            . $this->cta('Follow your flight in Flightdeck', 'Status, gate and baggage belt when reported, outbound or inbound, and a packing list you can reuse.', '/app/', 'Open Flightdeck') . '</div>';
        $base = rtrim((string) $this->s['siteUrl'], '/');
        $ld = [
            ['@context' => 'https://schema.org', '@type' => 'Article', 'headline' => $p['title'], 'description' => $p['description'], 'dateModified' => $reviewed, 'mainEntityOfPage' => $url,
                'author' => ['@type' => 'Person', 'name' => $this->s['ownerName'] ?: $this->s['siteName']], 'publisher' => ['@type' => 'Organization', 'name' => $this->s['siteName'], 'url' => $this->s['siteUrl']]],
            ['@context' => 'https://schema.org', '@type' => 'BreadcrumbList', 'itemListElement' => [
                ['@type' => 'ListItem', 'position' => 1, 'name' => 'Guides', 'item' => $base . '/guides/'],
                ['@type' => 'ListItem', 'position' => 2, 'name' => $catTitle, 'item' => $base . '/guides/#cat-' . $cat],
                ['@type' => 'ListItem', 'position' => 3, 'name' => $p['title'], 'item' => $url],
            ]],
        ];
        return $this->layout(['title' => $p['title'], 'description' => $p['description'], 'url' => $url, 'here' => '/' . $slug . '/', 'main' => $main, 'ld' => $ld, 'ogType' => 'article', 'ads' => $slot !== '']);
    }

    private function guideIndex(array $p): string
    {
        $guides = $this->guides();
        $tpl = $this->c['checklistTemplate'];
        $items = array_sum(array_map(static function ($s): int {
            return count($s['items']);
        }, $tpl));
        $intro = $this->md((string) $p['body'])['html'];
        $cats = '';
        foreach ($this->c['guideCategories'] ?? [] as $cat) {
            $list = array_values(array_filter($guides, static function ($g) use ($cat): bool {
                return ($g['category'] ?? '') === $cat['id'];
            }));
            if ($list) {
                $cats .= '<section class="cat" aria-labelledby="cat-' . self::e($cat['id']) . '"><h2 id="cat-' . self::e($cat['id']) . '">' . self::e($cat['title']) . '</h2><p class="sub">' . self::e($cat['blurb']) . '</p>' . $this->cards($list, false) . '</section>';
            }
        }
        $main = '<div class="page">' . $this->head($p) . '<div class="sub">' . $intro . '<p>' . count($guides) . ' guides.</p></div>' . $cats
            . '<section class="promo" aria-label="Packing list"><div><h2>Need a packing list?</h2><p>A free printable list of ' . $items . ' items in ' . count($tpl) . ' sections. Print it, or keep a reusable copy in Flightdeck.</p></div><a class="btn btn-primary" href="/travel-checklist/">Open the packing list</a></section></div>';
        $url = $this->url('guides');
        return $this->layout(['title' => $p['title'], 'description' => $p['description'], 'url' => $url, 'here' => '/guides/', 'main' => $main, 'ld' => [$this->webPage($p, $url)]]);
    }

    private static function slugify(string $t): string
    {
        return trim(preg_replace('/[^a-z0-9]+/', '-', strtolower(preg_replace('/&[a-z]+;/', '', $t) ?? '')) ?? '', '-');
    }

    private function checklist(array $p): string
    {
        $tpl = $this->c['checklistTemplate'];
        $total = array_sum(array_map(static function ($s): int {
            return count($s['items']);
        }, $tpl));
        $id = static function (array $sec): string {
            return 'list-' . self::slugify((string) $sec['title']);
        };
        $rail = '';
        $panels = '';
        foreach ($tpl as $i => $sec) {
            $sid = $id($sec);
            $n = count($sec['items']);
            $rail .= '<a class="ck-rail-item' . ($i === 0 ? ' on' : '') . '" href="#' . $sid . '" data-sec="' . $sid . '"><span class="ck-n" aria-hidden="true">' . ($i + 1) . '</span><span class="ck-rail-title">' . self::e($sec['title']) . '</span><span class="ck-rail-count">0/' . $n . '</span><i class="ck-rail-bar" aria-hidden="true"><b style="width:0"></b></i></a>';
            $list = '';
            foreach ($sec['items'] as $j => $it) {
                $list .= '<li><label class="ck-check"><input type="checkbox" data-k="' . $sid . '-' . $j . '"><span class="ck-box" aria-hidden="true">' . self::CHECK . '</span><span class="ck-text">' . self::e($it['text']) . '</span></label></li>';
            }
            $prev = $i > 0 ? '<a class="text-button" href="#' . $id($tpl[$i - 1]) . '">' . self::e($tpl[$i - 1]['title']) . '</a>' : '<span></span>';
            $next = $i < count($tpl) - 1 ? '<a class="text-button primary" href="#' . $id($tpl[$i + 1]) . '">' . self::e($tpl[$i + 1]['title']) . '</a>' : '<span></span>';
            $panels .= '<section class="ck-sec" id="' . $sid . '" aria-labelledby="' . $sid . '-h"><header class="ck-sec-head"><span class="ck-n" aria-hidden="true">' . ($i + 1) . '</span><div><h2 class="ck-sec-title" id="' . $sid . '-h">' . self::e($sec['title']) . '</h2>' . (!empty($sec['hint']) ? '<p class="ck-sec-hint">' . self::e($sec['hint']) . '</p>' : '') . '</div><span class="ck-sec-count">0/' . $n . '</span></header><ul class="ck-list">' . $list . '</ul><footer class="ck-pager noprint">' . $prev . $next . '</footer></section>';
        }
        $intro = $this->md((string) $p['body'])['html'];
        $slot = $this->adSlot('checklist');
        $main = '<div class="page">' . $this->head($p) . '<div class="sub noprint">' . $intro . '</div>'
            . '<div class="tools noprint"><button class="btn btn-primary" type="button" data-print>Print this list</button><a class="btn btn-secondary" href="/app/#/checklist">Keep it in Flightdeck</a><span class="stat">' . count($tpl) . ' sections · ' . $total . ' items</span></div>'
            . '<div class="ck-layout" id="packing-board"><nav class="ck-rail" aria-label="Packing list sections">' . $rail . '</nav><div class="ck-panels">' . $panels . '</div></div>'
            . $slot
            . '<h2 class="noprint">How to use it</h2><ol class="ck-steps noprint"><li><b>1. Start days ahead</b><span>The first section holds the things that take time: visas, insurance and vaccinations.</span></li><li><b>2. Pack by section</b><span>Clothes, then the bathroom bag, then accessories, so nothing is forgotten halfway through.</span></li><li><b>3. Make it yours</b><span>Cross out what you never need and add what you always forget. In Flightdeck your edits are saved for every trip.</span></li><li><b>4. Finish with the last lists</b><span>The night-before and last-minute sections catch the keys, the charger and the back door.</span></li></ol>'
            . '<div class="prose noprint"><p>For entry requirements, visas and health advice for your destination, use the official <a href="https://www.gov.uk/foreign-travel-advice" rel="noopener">GOV.UK foreign travel advice</a>. Planning the day itself? Read the <a href="/guides/departure-day-airport-timeline/">departure day timeline</a> and the guide to <a href="/guides/pack-your-cabin-bag-for-a-long-flight/">packing your cabin bag</a>.</p></div>'
            . $this->cta('Keep this list for every trip', 'Create a free account to tick items off on your phone, add your own, keep several trips, and use it offline at the airport.', '/app/#/checklist', 'Open Flightdeck') . '</div>';
        $url = $this->url($p['slug']);
        return $this->layout(['title' => $p['title'], 'description' => $p['description'], 'url' => $url, 'here' => '/travel-checklist/', 'main' => $main, 'ld' => [$this->webPage($p, $url)],
            'scripts' => '<script src="' . self::e($this->assets['checklistJs']) . '" defer></script>', 'ads' => $slot !== '']);
    }

    private function contact(array $p): string
    {
        $intro = $this->md((string) $p['body'])['html'];
        $form = '<form id="contact-form" class="form-card" novalidate>
 <fieldset class="kinds" style="border:0;padding:0;margin:0 0 16px"><legend class="visually-hidden">What is this about?</legend>
  <label><input type="radio" name="kind" value="contact" checked> A question</label>
  <label><input type="radio" name="kind" value="bug"> A problem</label>
  <label><input type="radio" name="kind" value="feedback"> Feedback</label>
 </fieldset>
 <label class="field"><span>Your message</span><textarea name="message" rows="6" minlength="5" maxlength="4000" required></textarea></label>
 <div class="form-row">
  <label class="field"><span>Your name (optional)</span><input name="name" maxlength="80" autocomplete="name"></label>
  <label class="field"><span>Your email (needed for a reply)</span><input name="email" type="email" maxlength="254" autocomplete="email" required></label>
 </div>
 <input class="trap" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
 <p id="contact-msg" class="form-msg" role="status" aria-live="polite"></p>
 <button class="btn btn-primary" type="submit">Send message</button>
 <p class="small">We use your details only to reply. See the <a href="/privacy/">privacy policy</a>.</p>
</form>';
        $main = '<div class="page">' . $this->head($p) . '<div class="prose" style="margin-bottom:20px">' . $intro . '</div>' . $form . '</div>';
        $url = $this->url('contact');
        return $this->layout(['title' => $p['title'], 'description' => $p['description'], 'url' => $url, 'here' => '/contact/', 'main' => $main, 'ld' => [$this->webPage($p, $url)],
            'scripts' => '<script src="' . self::e($this->assets['contactJs']) . '" defer></script>']);
    }

    private function faqList(array $faqs, string $headingLevel = 'h3'): string
    {
        return '<ul class="faq">' . implode('', array_map(function (array $f): string {
            return '<li><details id="faq-' . self::e($f['id']) . '"><summary>' . $this->inl((string) $f['question']) . '</summary><div class="answer">' . $this->md((string) $f['answer'])['html'] . '</div></details></li>';
        }, $faqs)) . '</ul>';
    }

    /** @return list<array> */
    private function faqs(): array
    {
        $list = array_values(array_filter($this->c['faqs'] ?? [], static function ($f): bool {
            return empty($f['unpublished']);
        }));
        return $list;
    }

    private function help(array $p): string
    {
        $groups = [];
        foreach ($this->faqs() as $f) {
            $groups[$f['category'] ?? 'Questions'][] = $f;
        }
        $html = '';
        foreach ($groups as $cat => $list) {
            $gid = 'faq-' . self::slugify((string) $cat);
            $html .= '<section class="faq-group" aria-labelledby="' . self::e($gid) . '"><h2 id="' . self::e($gid) . '">' . self::e($cat) . '</h2>' . $this->faqList($list) . '</section>';
        }
        if ($html === '') {
            $html = '<p>No questions are published yet.</p>';
        }
        $main = '<div class="page">' . $this->head($p) . $html . '<div class="prose">' . $this->md((string) $p['body'])['html'] . '</div></div>';
        $url = $this->url('help');
        return $this->layout(['title' => $p['title'], 'description' => $p['description'], 'url' => $url, 'here' => '/help/', 'main' => $main, 'ld' => [$this->webPage($p, $url)]]);
    }

    private function home(): string
    {
        $p = $this->c['pages']['home'];
        $h = $p['hero'] ?? [];
        $today = gmdate('Y-m-d', $this->nowSec);
        $points = implode('', array_map(function ($x): string {
            return '<li>' . $this->inl((string) $x) . '</li>';
        }, $p['points'] ?? []));
        $hero = '<section class="hero" aria-labelledby="hero-title"><div class="wrap"><div>'
            . '<p class="eyebrow">' . self::e($h['eyebrow'] ?? '') . '</p><h1 id="hero-title">' . self::e($h['title'] ?? $p['title']) . '</h1><p class="lede">' . $this->inl((string) ($h['text'] ?? '')) . '</p>'
            . '<form class="lookup" id="lookup" action="/app/" method="get" novalidate><div class="form-row">'
            . '<label class="field"><span>Flight number</span><input name="number" id="lookup-number" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="8" placeholder="BA117" required pattern="[A-Za-z0-9]{2,3}\s?[0-9]{1,4}[A-Za-z]?"></label>'
            . '<label class="field"><span>Departure date</span><input name="date" id="lookup-date" type="date" value="' . self::e($today) . '" required></label>'
            . '<button class="btn btn-primary btn-lg" type="submit">Track flight</button></div>'
            . '<p class="lookup-note" id="lookup-msg" role="status" aria-live="polite">Free account needed to look up flights. <a href="/help/#faq-account">Why?</a></p></form>'
            . ($points !== '' ? '<ul class="points">' . $points . '</ul>' : '') . '</div>'
            . $this->sample() . '</div></section>';
        $steps = implode('', array_map(function ($s): string {
            return '<li><h3>' . self::e($s['title']) . '</h3><p>' . $this->inl((string) $s['text']) . '</p></li>';
        }, $p['steps'] ?? []));
        $features = implode('', array_map(function ($s): string {
            return '<li><h3>' . self::e($s['title']) . '</h3><p>' . $this->inl((string) $s['text']) . '</p></li>';
        }, $p['features'] ?? []));
        $cov = $p['coverage'] ?? ['columns' => []];
        $cols = implode('', array_map(function ($col): string {
            return '<section><h3>' . self::e($col['title']) . '</h3><ul>' . implode('', array_map(function ($i): string {
                return '<li>' . $this->inl((string) $i) . '</li>';
            }, $col['items'])) . '</ul></section>';
        }, $cov['columns']));
        $faqs = array_slice($this->faqs(), 0, 4);
        $final = $p['final'] ?? ['title' => '', 'text' => ''];
        $main = $hero
            . ($steps !== '' ? '<section class="band band-white" aria-labelledby="how-h"><div class="wrap"><div class="band-head"><h2 id="how-h">How it works</h2><p>Three steps, and you always see where each detail came from.</p></div><ol class="steps">' . $steps . '</ol><p class="band-foot"><a href="/how-it-works/">More about how Flightdeck works</a></p></div></section>' : '')
            . ($features !== '' ? '<section class="band" aria-labelledby="feat-h"><div class="wrap"><div class="band-head"><h2 id="feat-h">What you get</h2><p>Everything on one page, each detail labelled with what it is.</p></div><ul class="features">' . $features . '</ul></div></section>' : '')
            . ($cols !== '' ? '<section class="band band-deep" aria-labelledby="cov-h"><div class="wrap"><div class="band-head"><h2 id="cov-h">' . self::e($cov['title'] ?? 'Honest about the data') . '</h2><p>' . self::e($cov['text'] ?? '') . '</p></div><div class="coverage">' . $cols . '</div><p class="band-foot"><a href="/coverage/">Read about the data and its limits</a></p></div></section>' : '')
            . ($faqs ? '<section class="band band-white" aria-labelledby="faq-h"><div class="wrap"><div class="band-head"><h2 id="faq-h">Questions</h2><p>The short answers. There are more on the <a href="/help/">help page</a>.</p></div>' . $this->faqList($faqs) . '</div></section>' : '')
            . '<section class="band final" aria-labelledby="final-h"><div class="wrap"><h2 id="final-h">' . self::e($final['title']) . '</h2><p>' . $this->inl((string) $final['text']) . '</p><div class="actions"><a class="btn btn-primary btn-lg" href="/app/">Open Flightdeck</a><a class="btn btn-secondary btn-lg" href="/guides/">Read the guides</a></div></div></section>';
        $url = $this->url('');
        $ld = [
            ['@context' => 'https://schema.org', '@type' => 'WebSite', 'name' => $this->s['siteName'], 'url' => $url],
            ['@context' => 'https://schema.org', '@type' => 'WebApplication', 'name' => $this->s['siteName'], 'url' => $url . 'app/', 'description' => $p['description'], 'applicationCategory' => 'TravelApplication', 'operatingSystem' => 'Any',
                'offers' => ['@type' => 'Offer', 'price' => '0', 'priceCurrency' => 'GBP']],
        ];
        return $this->layout(['title' => $p['title'], 'bareTitle' => true, 'description' => $p['description'], 'url' => $url, 'here' => '/', 'main' => $main, 'ld' => $ld]);
    }

    /** The illustrative flight card. Clearly a sample: fixed, labelled, and showing "not reported yet" the way the app does. */
    private function sample(): string
    {
        return '<figure class="sample" aria-labelledby="sample-cap" style="margin:0"><span class="sample-tag">Sample, not a real flight</span>'
            . '<div class="sample-head"><span class="sample-num fd-data">BA117</span><span class="sample-status">En route</span></div>'
            . '<div class="sample-route"><div><b class="fd-data">LHR</b><small>London Heathrow</small></div><div class="sample-line" aria-hidden="true"><i></i>' . str_replace('aria-hidden="true"', '', self::PLANE) . '</div><div style="text-align:right"><b class="fd-data">JFK</b><small>New York JFK</small></div></div>'
            . '<div class="board fd-data"><div><small>Departed</small><strong>08:41</strong></div><div><small>Est. arrival</small><strong>11:32</strong></div><div><small>Gate in</small><strong class="unknown">Not reported yet</strong></div>'
            . '<div><small>Terminal</small><strong>5</strong></div><div><small>Altitude</small><strong>11,280 m</strong></div><div><small>Baggage belt</small><strong class="unknown">Not reported yet</strong></div></div>'
            . '<figcaption class="sample-foot" id="sample-cap">An illustration of how a flight looks in Flightdeck. Times are shown in each airport\'s local time.</figcaption></figure>';
    }

    private function notFound(): string
    {
        $p = ['kind' => 'page', 'title' => 'Page not found', 'description' => 'That page does not exist or has moved.'];
        $main = '<div class="page">' . $this->head($p) . '<div class="prose"><p>Try the <a href="/">home page</a>, <a href="/app/">the Flightdeck app</a>, the <a href="/travel-checklist/">packing list</a> or the <a href="/guides/">travel guides</a>.</p></div></div>';
        return $this->layout(['title' => $p['title'], 'description' => $p['description'], 'url' => $this->url(''), 'here' => '', 'main' => $main, 'noindex' => true]);
    }

    public function unavailable(): string
    {
        $p = ['kind' => 'page', 'title' => 'Flightdeck is briefly unavailable', 'description' => 'Please try again in a few minutes.'];
        $main = '<div class="page">' . $this->head($p) . '<div class="prose"><p>The website could not load its pages just now. The <a href="/app/">app</a> may still work.</p></div></div>';
        return $this->layout(['title' => $p['title'], 'description' => $p['description'], 'url' => $this->url(''), 'here' => '', 'main' => $main, 'noindex' => true]);
    }

    private function sitemap(): string
    {
        $date = (string) $this->s['lastReviewed'];
        $urls = [$this->url('')];
        foreach ($this->c['pages'] as $slug => $p) {
            if ($slug !== 'home' && empty($p['unpublished'])) {
                $urls[] = $this->url($slug);
            }
        }
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n"
            . implode("\n", array_map(static function (string $u) use ($date): string {
                return '<url><loc>' . self::e($u) . '</loc><lastmod>' . self::e($date) . '</lastmod></url>';
            }, $urls)) . "\n</urlset>\n";
    }
}
