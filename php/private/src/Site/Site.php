<?php
declare(strict_types=1);

namespace Flightdeck\Site;

use Flightdeck\Content\ContentStore;
use Flightdeck\Content\Markdown;

/**
 * The public website, rendered from CMS content on each request (public/site.php). Pages request nothing from third parties;
 * the only scripts are our own files. A preview render (owner console) uses the same code with draft content.
 * Design (31 Oct 2026): the owner-approved prototype. A framed photo band with the header over it, white sheets on the cool canvas,
 * one blue action per screen. The home page follows the prototype section by section.
 */
final class Site
{
    private const LABELS = ['page' => 'Flightdeck', 'about' => 'About', 'legal' => 'Legal and help', 'contact' => 'Get in touch', 'checklist' => 'Free tool', 'guide' => 'Travel guide', 'index' => 'Travel guides', 'help' => 'Help'];
    private const LEGAL = ['privacy', 'cookies', 'terms'];
    /** The Flightdeck mark. The same drawing is public/icon.svg and src/shared/Logo.tsx; change all three together. */
    public const LOGO = '<svg class="fd-logo" width="34" height="34" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><rect width="64" height="64" rx="18" fill="#1866FF"/><path d="M23 47H50" stroke="#fff" stroke-opacity=".5" stroke-width="4.5" stroke-linecap="round"/><path d="M15 47C17 30 29.5 19.5 45 18.5" fill="none" stroke="#fff" stroke-width="5.5" stroke-linecap="round"/><circle cx="15" cy="47" r="5.5" fill="#1866FF" stroke="#fff" stroke-width="4"/><circle cx="47.5" cy="18" r="7" fill="#FFB618"/></svg>';
    private const CHECK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
    /** Line icons (24px grid, stroke), the same drawings as the prototype. */
    private const ICONS = [
        'search' => '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
        'plane' => '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
        'luggage' => '<path d="M6 20a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2"/><path d="M8 18V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v14"/><path d="M10 20h4"/><circle cx="16" cy="20" r="2"/><circle cx="8" cy="20" r="2"/>',
        'checks' => '<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>',
        'info' => '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
        'clock' => '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
        'refresh' => '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
        'gate' => '<path d="M18 20V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14"/><path d="M2 20h20"/><path d="M14 12v.01"/>',
        'radio' => '<path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/><circle cx="12" cy="12" r="2"/>',
        'route' => '<circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/>',
        'cloud' => '<path d="M12 2v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="M20 12h2"/><path d="m19.07 4.93-1.41 1.41"/><path d="M15.947 12.65a4 4 0 0 0-5.925-4.128"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/>',
        'history' => '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
        'pin' => '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
        'arrow' => '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
        'external' => '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
        'x' => '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
        'plus' => '<path d="M5 12h14"/><path d="M12 5v14"/>',
        'book' => '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
        'alert' => '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
        'user' => '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
        'mail' => '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
        'menu' => '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
        'share' => '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98"/><path d="m15.41 6.51-6.82 3.98"/>',
        'check' => '<path d="M20 6 9 17l-5-5"/>',
        'printer' => '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3h12v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
        'down' => '<path d="m6 9 6 6 6-6"/>',
        'heart' => '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
        'undo' => '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
        'send' => '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    ];
    /** Destination cards: the same facts and official links as the app (src/features/flight/destinations.ts). */
    private const DEST = [
        'JFK' => ['city' => 'New York', 'airport' => 'John F. Kennedy', 'img' => '/img/new-york.jpg', 'w' => 1100, 'h' => 618, 'alt' => 'Lower Manhattan skyline seen across the harbour from Liberty Island',
            'greeting' => 'Hello, New York.', 'intro' => 'Big-city energy. A thousand little discoveries. Your next chapter starts here.', 'currency' => 'US dollar · USD', 'language' => 'English',
            'tip' => 'Plan time for immigration and the trip into the city. Check official airport transport information before choosing your route.',
            'places' => [
                ['Statue of Liberty', 'Iconic New York', 'See the harbour’s most recognisable landmark. Plan your island visit with the National Park Service.', 'https://www.nps.gov/stli/index.htm'],
                ['Staten Island Ferry', 'On the water', 'A free ferry between Lower Manhattan and Staten Island, with a different perspective on the harbour.', 'https://www.nyc.gov/html/dot/html/ferrybus/staten-island-ferry.shtml'],
                ['Find your New York', 'Explore more', 'Explore neighbourhoods, arts, food and events through the city’s official tourism guide.', 'https://www.nyctourism.com/'],
            ]],
        'DXB' => ['city' => 'Dubai', 'airport' => 'Dubai International', 'img' => '/img/dubai.jpg', 'w' => 1100, 'h' => 734, 'alt' => 'Dubai Marina towers above the water at dusk',
            'greeting' => 'Marhaba, Dubai.', 'intro' => 'Old-world waterways meet a skyline that looks toward tomorrow.', 'currency' => 'UAE dirham · AED', 'language' => 'Arabic',
            'tip' => 'Check the forecast before planning outdoor activities. Use the official tourism guide for local customs and transport advice.',
            'places' => [
                ['Al Fahidi & Dubai Creek', 'Culture and heritage', 'Explore the city’s historic side and its waterside neighbourhoods.', 'https://www.visitdubai.com/en/places-to-visit'],
                ['Downtown Dubai', 'Skyline moments', 'Discover the landmarks and experiences around the city’s famous skyline.', 'https://www.visitdubai.com/en/places-to-visit'],
                ['Discover your Dubai', 'Explore more', 'Find beaches, arts, family activities and desert experiences in the official guide.', 'https://www.visitdubai.com/en/places-to-visit'],
            ]],
        'CDG' => ['city' => 'Paris', 'airport' => 'Charles de Gaulle', 'img' => '/img/paris.jpg', 'w' => 1100, 'h' => 826, 'alt' => 'The Eiffel Tower above the Seine on a clear day',
            'greeting' => 'Bonjour, Paris.', 'intro' => 'Slow walks, great art, and something wonderful around the next corner.', 'currency' => 'Euro · EUR', 'language' => 'French',
            'tip' => 'Check official transport information for your arrival terminal. Reserve popular attractions through their official websites.',
            'places' => [
                ['Art & museums', 'A little culture', 'Find museums, exhibitions and collections in the official Paris visitor guide.', 'https://parisjetaime.com/eng/'],
                ['Walk by the Seine', 'Take it slow', 'Browse official walking routes and discover the city one neighbourhood at a time.', 'https://parisjetaime.com/eng/'],
                ['A Paris of your own', 'Explore more', 'Explore monuments, food, seasonal events and family activities.', 'https://parisjetaime.com/eng/'],
            ]],
    ];
    /** Every photo the site shows, with its author and licence (footer dialog and /about/#photo-credits). */
    private const CREDITS = [
        ['In flight above scattered clouds', 'Harry Knight, Unsplash', 'CC0'],
        ['Flying over the countryside', 'Sergey Svechnikov, Unsplash', 'CC0'],
        ['People watching planes fly', 'Rob Bye, Unsplash', 'CC0'],
        ['Lower Manhattan from Liberty Island', 'Percival Kestreltail', 'CC BY-SA 3.0'],
        ['Dubai Marina skyline', 'Norlando Pobre', 'CC BY 2.0'],
        ['Eiffel Tower by the Seine', 'Nicolas Halftermeyer', 'CC BY-SA 3.0'],
    ];
    private const CAT_ICON = ['reading' => 'book', 'prepare' => 'luggage', 'trouble' => 'alert'];
    /** The three "Understand your flight" guides the prototype features; other topics take their first three. */
    private const PICK = ['reading' => ['guides/flight-status-explained', 'guides/how-to-read-an-airport-departure-board', 'guides/what-flight-tracking-can-and-cannot-tell-you']];

    private $c;
    private $s;
    private $assets;
    private $config;
    private $nowSec;
    private $preview;

    /**
     * @param array $content published (or draft, for preview) content
     * @param array $assets  ['css' => url, 'js' => url, 'contactJs' => url, 'checklistJs' => url, 'motionJs' => url, 'lenisJs' => url, 'gaId' => string]
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

    private static function ico(string $name, string $cls = ''): string
    {
        return '<svg class="ico' . ($cls !== '' ? ' ' . $cls : '') . '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' . (self::ICONS[$name] ?? self::ICONS['info']) . '</svg>';
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

    private function brand(string $variant = ''): string
    {
        $name = (string) ($this->s['siteName'] ?? 'Flightdeck');
        return '<a class="fd-brand' . ($variant !== '' ? ' ' . $variant : '') . '" href="/" aria-label="' . self::e($name . ' home') . '">' . self::LOGO . '<span class="fd-brand-word">' . self::e($name) . '</span></a>';
    }

    private function sectionId(array $sec): string
    {
        return 'list-' . self::slugify((string) $sec['title']);
    }

    private static function slugify(string $t): string
    {
        return trim(preg_replace('/[^a-z0-9]+/', '-', strtolower(preg_replace('/&[a-z]+;/', '', $t) ?? '')) ?? '', '-');
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
            $warn = ($a['level'] ?? 'info') === 'warning';
            $href = !empty($a['linkLabel']) ? Markdown::safeHref((string) ($a['linkHref'] ?? '')) : null;
            $link = $href !== null ? ' <a href="' . self::e($href) . '"' . (preg_match('#^https?://#i', $href) ? ' rel="noopener"' : '') . '>' . self::e($a['linkLabel']) . '</a>' : '';
            $out .= '<div class="announce' . ($warn ? ' announce-warning' : '') . '" role="region" aria-label="Announcement"><div class="shell"><span class="tag">' . ($warn ? 'Heads up' : 'News') . '</span><span>' . self::e($a['message'] ?? '') . $link . '</span></div></div>';
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
        // JSON_HEX_TAG writes < and > as < and >, so CMS text can never close the script element.
        $ld = implode('', array_map(static function (array $obj): string {
            return '<script type="application/ld+json">' . (string) json_encode($obj, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG) . '</script>';
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
        $lenis = !empty($this->assets['lenisJs']) ? '<script src="' . self::e($this->assets['lenisJs']) . '" defer></script>' : '';
        $motion = !empty($o['motion']) && !empty($this->assets['motionJs']) ? '<script src="' . self::e($this->assets['motionJs']) . '" defer></script>' : '';
        $scripts = '<script src="/consent.js" defer></script>' . $lenis . $motion . '<script src="' . self::e($this->assets['js']) . '" defer></script>' . ($o['scripts'] ?? '');
        $adsHead = !empty($o['ads']) ? '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-' . self::e($this->config['ads_pub_id']) . '" crossorigin="anonymous"></script>' : '';
        $site = self::e($this->s['siteName'] ?? 'Flightdeck');
        // One header for every page, sitting over the photo band. On narrow screens the nav becomes the menu sheet (site.js);
        // without JavaScript it simply stays open under the bar.
        $header = '<header class="site-top"><div class="shell"><div class="topbar">' . $this->brand('on-photo')
            . '<nav class="site-nav" id="site-nav" aria-label="Main"><div class="sheet-top">' . $this->brand() . '<button class="icon-btn" type="button" data-menu-close aria-label="Close menu">' . self::ico('x') . '</button></div><div class="topnav">' . $nav . '</div>'
            . '<div class="end"><a class="btn btn-glass btn-sm" data-auth="out" href="/app/">Sign in</a><a class="btn btn-white btn-sm" data-auth="out" href="/app/">Open the app</a><a class="btn btn-white btn-sm signed-chip" data-auth="in" href="/app/" hidden><span class="signed-dot" aria-hidden="true">' . self::ico('user', 'ico-sm') . '</span>My flights<span class="sr-only"> (you are signed in)</span></a></div></nav>'
            . '<button class="icon-btn menu-btn" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu">' . self::ico('menu') . '</button></div></div></header>';
        return '<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>' . self::e($fullTitle) . '</title>
<meta name="description" content="' . self::e($o['description']) . '">' . $robots . '<link rel="canonical" href="' . self::e($url) . '"><meta name="theme-color" content="#1866ff">
<meta property="og:title" content="' . self::e($title) . '"><meta property="og:description" content="' . self::e($o['description']) . '"><meta property="og:type" content="' . (($o['ogType'] ?? '') === 'article' ? 'article' : 'website') . '"><meta property="og:url" content="' . self::e($url) . '"><meta property="og:site_name" content="' . $site . '"><meta property="og:image" content="' . self::e($img) . '"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="' . self::e($img) . '">
<meta name="fd-ga-id" content="' . self::e($this->assets['gaId'] ?? '') . '">
<link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest">
<link rel="stylesheet" href="' . self::e($this->assets['css']) . '">' . $ld . $adsHead . '</head>
<body class="' . (!empty($o['home']) ? 'is-home' : 'is-inner') . '"><a class="skip" href="#main">Skip to content</a>
' . $this->announcements() . '<div class="stage">' . $header . '
<main id="main">' . $o['main'] . '</main></div>
<footer class="sf" aria-label="Site"><div class="sf-in"><div class="sf-top"><div class="sf-about">' . $this->brand('sf-brand') . '<p class="sf-blurb">' . self::e($this->s['footerBlurb'] ?? '') . '</p></div><div class="sf-cols">' . $foot . '</div></div><div class="sf-base"><p>' . self::e($this->s['footerNote'] ?? '') . '</p><p>© ' . $year . ' <a href="https://gakinz.com" rel="noopener">Gakinz</a></p></div></div></footer>
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

    /** The compact photo band every inner page opens with (the hero's smaller sibling): breadcrumbs, label, the one h1, the summary. */
    private function head(array $p, string $crumbs = '', string $tags = ''): string
    {
        $label = self::LABELS[$p['kind']] ?? 'Flightdeck';
        return '<div class="page-head"><div class="band-photo" aria-hidden="true"><img src="/img/sunset-wing.jpg" alt="" width="1500" height="942"></div><div class="page-head-in">' . $crumbs . '<p class="kicker">' . self::e($label) . '</p><h1>' . self::e($p['title']) . '</h1><p class="lede">' . self::e($p['description']) . '</p>' . $tags . '</div></div>';
    }

    private function prose(array $r, string $lead = '', bool $withToc = true): string
    {
        $toc = $withToc && count($r['toc']) >= 3 ? '<aside class="toc" aria-label="On this page"><p>On this page</p><ol>' . implode('', array_map(static function (array $t): string {
            return '<li><a href="#' . self::e($t['id']) . '">' . self::e($t['text']) . '</a></li>';
        }, $r['toc'])) . '</ol></aside>' : '';
        return '<div class="panel sheet layout' . ($toc ? '' : ' no-toc') . '">' . $toc . '<div class="prose">' . $lead . $r['html'] . '</div></div>';
    }

    private function cards(array $list, bool $pill = true, bool $fill = false): string
    {
        // $fill: on the guides index every row is three equal cards; a spare slot at the end becomes a real action tile
        // (look up a flight) instead of stretching the last cards wider.
        $rest = count($list) % 3;
        $tile = $fill && $rest !== 0
            ? '<li class="cards-fill fill-' . (3 - $rest) . '"><div><span class="gtile">' . self::ico('plane') . '</span><strong>Put it into practice</strong><span>Look up your flight to see its status, terminal, gate and baggage belt as they are reported.</span><a class="btn btn-primary btn-sm" href="/app/">Look up a flight</a></div></li>'
            : '';
        return '<ul class="cards">' . implode('', array_map(function (array $g) use ($pill): string {
            $cat = $g['category'] ?? '';
            return '<li><a href="/' . self::e($g['slug']) . '/"><span class="gtile">' . self::ico(self::CAT_ICON[$cat] ?? 'book') . '</span>' . ($pill ? '<em>' . self::e($this->catTitle($cat)) . '</em>' : '') . '<strong>' . self::e($g['title']) . '</strong><span>' . self::e($g['description']) . '</span><span class="cd-meta"><span class="num">' . $this->minutes($g) . ' min read</span><span class="go">Read the guide' . self::ico('arrow', 'ico-sm') . '</span></span></a></li>';
        }, $list)) . $tile . '</ul>';
    }

    private function cta(string $title, string $text, string $href, string $label): string
    {
        return '<section class="cta-box closing" aria-label="' . self::e($title) . '"><div><h2>' . self::e($title) . '</h2><p>' . self::e($text) . '</p><div class="actions"><a class="btn btn-white btn-lg" href="' . self::e($href) . '">' . self::e($label) . '</a></div></div>' . self::routeArt() . '</section>';
    }

    /** The closing band's route drawing: three dotted arcs out of London, one drawn solid. Decorative. */
    private static function routeArt(): string
    {
        return '<svg class="close-art" viewBox="0 0 520 300" aria-hidden="true" focusable="false"><path class="arc" d="M40 250 C 120 60, 300 40, 480 120"/><path class="arc" d="M40 250 C 150 150, 330 160, 470 240"/><path class="arc solid" d="M40 250 C 140 110, 330 90, 430 40"/>'
            . '<g class="ap"><circle class="node" cx="40" cy="250" r="7"/><text x="22" y="284">LHR</text><circle class="node" cx="480" cy="120" r="6"/><text x="452" y="152">DXB</text><circle class="node" cx="470" cy="240" r="6"/><text x="444" y="274">CDG</text><circle class="node" cx="430" cy="40" r="7"/><text x="408" y="22">JFK</text></g></svg>';
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
        $extra = $slug === 'about' ? $this->creditsSection() : '';
        $main = '<div class="shell page">' . $this->head($p + ['kind' => 'page'], '', $tags) . $this->prose($r) . $extra . '</div>';
        return $this->layout(['title' => $p['title'], 'description' => $p['description'], 'url' => $url, 'here' => '/' . $slug . '/', 'main' => $main, 'ld' => [$this->webPage($p, $url)]]);
    }

    private function creditsSection(): string
    {
        $list = implode('', array_map(static function (array $c): string {
            return '<li><b>' . self::e($c[0]) . '</b> <span>· ' . self::e($c[1]) . ' · ' . self::e($c[2]) . ', via Wikimedia Commons</span></li>';
        }, self::CREDITS));
        return '<section class="panel sheet" id="photo-credits" aria-labelledby="photo-credits-h"><div class="sheet-head"><h2 id="photo-credits-h">Photo credits</h2></div><p class="sub">The photographs on this site are used under these licences.</p><ul class="credits">' . $list . '</ul></section>';
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
        $tags = '<p class="tags"><span class="tag">' . self::e($catTitle) . '</span><span class="num">' . $this->minutes($p) . ' min read</span><span>Last reviewed ' . self::e($reviewed) . '</span></p>';
        $take = !empty($p['takeaways']) ? '<div class="take"><p class="take-h">Key points</p><ul>' . implode('', array_map(function ($x): string {
            return '<li>' . self::ico('check', 'ico-sm') . '<span>' . $this->inl((string) $x) . '</span></li>';
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
        $relHtml = $related ? '<section class="panel sheet related" aria-label="More guides"><div class="sheet-head"><h2>More guides</h2><a class="link-quiet" href="/guides/">See all ' . count($guides) . ' guides</a></div>' . $this->cards($related) . '</section>' : '';
        $slot = $this->adSlot('guide');
        $main = '<div class="shell page">' . $this->head($p, $crumbs, $tags) . $this->prose($r, $take) . $slot . $relHtml
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
                $cats .= '<section class="cat" aria-labelledby="cat-' . self::e($cat['id']) . '"><div class="sheet-head"><div><h2 id="cat-' . self::e($cat['id']) . '">' . self::e($cat['title']) . '</h2><p class="sub">' . self::e($cat['blurb']) . '</p></div><span class="badge plain num">' . count($list) . ' guides</span></div>' . $this->cards($list, false, true) . '</section>';
            }
        }
        $main = '<div class="shell page">' . $this->head($p) . '<div class="panel sheet intro"><div class="prose">' . $intro . '</div><p class="badge blue plain num">' . count($guides) . ' guides.</p></div>' . $cats
            . '<section class="promo" aria-label="Packing list"><div><p class="eyebrow">Free packing list</p><h2>Need a packing list?</h2><p>A free printable list of ' . $items . ' items in ' . count($tpl) . ' sections. Print it, or keep a reusable copy in Flightdeck.</p></div><a class="btn btn-white btn-lg" href="/travel-checklist/">Open the packing list</a></section></div>';
        $url = $this->url('guides');
        return $this->layout(['title' => $p['title'], 'description' => $p['description'], 'url' => $url, 'here' => '/guides/', 'main' => $main, 'ld' => [$this->webPage($p, $url)]]);
    }

    private function checklist(array $p): string
    {
        $tpl = $this->c['checklistTemplate'];
        $total = array_sum(array_map(static function ($s): int {
            return count($s['items']);
        }, $tpl));
        $rail = '';
        $panels = '';
        foreach ($tpl as $i => $sec) {
            $sid = $this->sectionId($sec);
            $n = count($sec['items']);
            $rail .= '<a class="ck-rail-item' . ($i === 0 ? ' on' : '') . '" href="#' . $sid . '" data-sec="' . $sid . '"><span class="ck-n" aria-hidden="true">' . ($i + 1) . '</span><span class="ck-rail-title">' . self::e($sec['title']) . '</span><span class="ck-rail-count">0/' . $n . '</span><i class="ck-rail-bar" aria-hidden="true"><b style="width:0"></b></i></a>';
            $list = '';
            foreach ($sec['items'] as $j => $it) {
                $list .= '<li><label class="ck-check"><input type="checkbox" data-k="' . $sid . '-' . $j . '"><span class="ck-box" aria-hidden="true">' . self::CHECK . '</span><span class="ck-text">' . self::e($it['text']) . '</span></label></li>';
            }
            $prev = $i > 0 ? '<a class="text-button" href="#' . $this->sectionId($tpl[$i - 1]) . '">' . self::e($tpl[$i - 1]['title']) . '</a>' : '<span></span>';
            $next = $i < count($tpl) - 1 ? '<a class="text-button primary" href="#' . $this->sectionId($tpl[$i + 1]) . '">' . self::e($tpl[$i + 1]['title']) . '</a>' : '<span></span>';
            $panels .= '<section class="ck-sec" id="' . $sid . '" aria-labelledby="' . $sid . '-h"><header class="ck-sec-head"><span class="ck-n" aria-hidden="true">' . ($i + 1) . '</span><div><h2 class="ck-sec-title" id="' . $sid . '-h">' . self::e($sec['title']) . '</h2>' . (!empty($sec['hint']) ? '<p class="ck-sec-hint">' . self::e($sec['hint']) . '</p>' : '') . '</div><span class="ck-sec-count">0/' . $n . '</span></header><ul class="ck-list">' . $list . '</ul><footer class="ck-pager noprint">' . $prev . $next . '</footer></section>';
        }
        $intro = $this->md((string) $p['body'])['html'];
        $slot = $this->adSlot('checklist');
        $main = '<div class="shell page packing-page">' . $this->head($p)
            . '<div class="panel sheet packing-sheet"><div class="packing-top noprint"><div class="sub">' . $intro . '<p class="packing-access">' . self::ico('info', 'ico-sm') . '<span>Free to use and print. No sign-in needed. Your ticks stay in this browser.</span></p></div>'
            . '<div class="tools"><button class="btn btn-primary" type="button" data-print>' . self::ico('printer', 'ico-sm') . 'Print this list</button><button class="btn btn-secondary" type="button" data-print-blank>Print blank copy</button><a class="btn btn-secondary" href="/app/#/checklist">Keep it in Flightdeck</a><span class="stat num">' . count($tpl) . ' sections · ' . $total . ' items</span></div></div>'
            . '<div class="packing-summary noprint"><div><strong id="packing-total" class="num" role="status" aria-live="polite">0 of ' . $total . ' packed</strong><span id="packing-for">Choose a section, or show the complete list.</span></div><label class="packing-show-all"><input type="checkbox" id="packing-show-all"> Show all sections</label></div>'
            // Paper only: branded header with write-in lines, and a branded footer (hidden on screen, see packingBoard.css).
            . '<div class="print-head"><div class="ph-top"><span class="fd-brand">' . self::LOGO . '<span class="fd-brand-word">Flightdeck</span></span><span class="ph-title"><b>Packing list</b><span>' . count($tpl) . ' sections · ' . $total . ' items · tick as you pack</span></span><span class="ph-url">flightdeck.gakinz.com</span></div>'
            . '<div class="ph-meta"><span><i>Trip</i><b id="packing-trip"></b></span><span><i>Leaving</i><b id="packing-date"></b></span><span><i>Packed by</i><b></b></span></div></div>'
            . '<div class="ck-layout" id="packing-board"><nav class="ck-rail" aria-label="Packing list sections">' . $rail . '</nav><div class="ck-panels">' . $panels . '</div></div>'
            . '<div class="print-foot"><span class="fd-brand">' . self::LOGO . '<span class="fd-brand-word">Flightdeck</span></span><span>Free printable packing list · flightdeck.gakinz.com/travel-checklist/</span><span>Flight details can change. Always follow airline and airport instructions.</span></div></div>'
            . $slot
            . '<section class="panel sheet noprint" aria-labelledby="ck-how"><div class="sheet-head"><h2 id="ck-how">How to use it</h2></div><ol class="ck-steps"><li><span class="n num">1</span><b>Start days ahead</b><span>The first section holds the things that take time: visas, insurance and vaccinations.</span></li><li><span class="n num">2</span><b>Pack by section</b><span>Clothes, then the bathroom bag, then accessories, so nothing is forgotten halfway through.</span></li><li><span class="n num">3</span><b>Make it yours</b><span>Cross out what you never need and add what you always forget. In Flightdeck your edits are saved for every trip.</span></li><li><span class="n num">4</span><b>Finish with the last lists</b><span>The night-before and last-minute sections catch the keys, the charger and the back door.</span></li></ol>'
            . '<div class="prose"><p>For entry requirements, visas and health advice for your destination, use the official <a href="https://www.gov.uk/foreign-travel-advice" rel="noopener">GOV.UK foreign travel advice</a>. Planning the day itself? Read the <a href="/guides/departure-day-airport-timeline/">departure day timeline</a> and the guide to <a href="/guides/pack-your-cabin-bag-for-a-long-flight/">packing your cabin bag</a>.</p></div></section>'
            . $this->cta('Keep this list for every trip', 'Create a free account to tick items off on your phone, add your own, keep several trips, and use it offline at the airport.', '/app/#/checklist', 'Open Flightdeck') . '</div>';
        $url = $this->url($p['slug']);
        return $this->layout(['title' => $p['title'], 'description' => $p['description'], 'url' => $url, 'here' => '/travel-checklist/', 'main' => $main, 'ld' => [$this->webPage($p, $url)],
            'scripts' => '<script src="' . self::e($this->assets['checklistJs']) . '" defer></script>', 'ads' => $slot !== '']);
    }

    /** The real contact form (posts to /api/contact through contact.js). Used on /contact/ and in the home page's message dialog. */
    private function contactForm(bool $inDialog = false): string
    {
        return '<form id="contact-form" class="form-card' . ($inDialog ? '' : ' panel sheet') . '" novalidate>'
            . ($inDialog ? '' : '<h2>Send a message</h2>')
            . '<fieldset class="kinds"><legend>What is this about?</legend><label><input type="radio" name="kind" value="contact" checked><span>A question</span></label><label><input type="radio" name="kind" value="bug"><span>A problem</span></label><label><input type="radio" name="kind" value="feedback"><span>Feedback</span></label></fieldset>'
            . '<div class="form-row two"><div class="form-row"><label for="cf-name">Your name (optional)</label><input class="input" id="cf-name" name="name" maxlength="80" autocomplete="name"></div><div class="form-row"><label for="cf-email">Your email (needed for a reply)</label><input class="input" id="cf-email" name="email" type="email" maxlength="254" autocomplete="email" required></div></div>'
            . '<div class="form-row"><label for="cf-msg">Your message</label><textarea class="textarea" id="cf-msg" name="message" rows="6" minlength="5" maxlength="4000" required></textarea></div>'
            . '<input class="trap" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">'
            . '<p id="contact-msg" class="form-msg" role="status" aria-live="polite"></p>'
            . '<div class="dialog-foot"><p class="small">We use your details only to reply. See the <a href="/privacy/">privacy policy</a>.</p>' . ($inDialog ? '<button class="btn btn-ghost" type="button" data-close>Cancel</button>' : '') . '<button class="btn btn-primary" type="submit">' . self::ico('send', 'ico-sm') . 'Send message</button></div></form>';
    }

    private function contact(array $p): string
    {
        $intro = $this->md((string) $p['body'])['html'];
        $email = (string) ($this->s['contactEmail'] ?? '');
        $side = '<div class="panel sheet contact-side"><div class="prose">' . $intro . '</div><div class="contact"><b>Still stuck?</b><span>' . ($email !== '' ? 'Write to <a class="num" href="mailto:' . self::e($email) . '">' . self::e($email) . '</a>. ' : '') . 'A real person reads every message.</span><a class="btn btn-ghost btn-sm" href="/help/">' . self::ico('book', 'ico-sm') . 'Read the questions</a></div></div>';
        $main = '<div class="shell page">' . $this->head($p) . '<div class="contact-grid">' . $side . $this->contactForm() . '</div></div>';
        $url = $this->url('contact');
        return $this->layout(['title' => $p['title'], 'description' => $p['description'], 'url' => $url, 'here' => '/contact/', 'main' => $main, 'ld' => [$this->webPage($p, $url)],
            'scripts' => '<script src="' . self::e($this->assets['contactJs']) . '" defer></script>']);
    }

    /** The accordion. Native details, so every answer opens without JavaScript; site.js animates the height. */
    private function faqList(array $faqs, bool $ids = true, bool $firstOpen = false): string
    {
        $out = '';
        foreach ($faqs as $i => $f) {
            $out .= '<div class="acc-item"><details' . ($ids ? ' id="faq-' . self::e($f['id']) . '"' : '') . ($firstOpen && $i === 0 ? ' open' : '') . '><summary class="acc-btn"><h3>' . $this->inl((string) $f['question']) . '</h3><span class="pm" aria-hidden="true">' . self::ico('plus', 'ico-sm') . '</span></summary><div class="acc-panel answer">' . $this->md((string) $f['answer'])['html'] . '</div></details></div>';
        }
        return '<div class="faq">' . $out . '</div>';
    }

    /** @return list<array> */
    private function faqs(): array
    {
        return array_values(array_filter($this->c['faqs'] ?? [], static function ($f): bool {
            return empty($f['unpublished']);
        }));
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
        $email = (string) ($this->s['contactEmail'] ?? '');
        $main = '<div class="shell page"><div class="faq-page">' . $this->head($p) . '<div class="qa"><div class="panel qa-side"><p class="eyebrow">Questions</p><h2>Still stuck?</h2><div class="prose">' . $this->md((string) $p['body'])['html'] . '</div>'
            . '<div class="contact"><b>Write to us</b><span>' . ($email !== '' ? '<a class="num" href="mailto:' . self::e($email) . '">' . self::e($email) . '</a>. ' : '') . 'A real person reads every message.</span><a class="btn btn-ghost btn-sm" href="/contact/">' . self::ico('mail', 'ico-sm') . 'Send a message</a></div></div>'
            . '<div class="panel acc help-acc">' . $html . '</div></div></div></div>';
        $url = $this->url('help');
        return $this->layout(['title' => $p['title'], 'description' => $p['description'], 'url' => $url, 'here' => '/help/', 'main' => $main, 'ld' => [$this->webPage($p, $url)]]);
    }

    // ------------------------------------------------------------------ home (the approved prototype, section by section)

    private function home(): string
    {
        $p = $this->c['pages']['home'];
        $h = $p['hero'] ?? [];
        $guides = $this->guides();
        $faqsAll = $this->faqs();
        $email = (string) ($this->s['contactEmail'] ?? '');

        // Departure dates: yesterday to 13 days ahead. Rendered for UTC here; site.js rebuilds the list in the visitor's own time zone.
        $base = (int) (floor($this->nowSec / 86400) * 86400) + 43200;
        $opts = '';
        for ($i = -1; $i <= 13; $i++) {
            $t = $base + $i * 86400;
            $opts .= '<option value="' . gmdate('Y-m-d', $t) . '"' . ($i === 0 ? ' selected' : '') . '>' . gmdate('D j M', $t) . ($i === 0 ? ' · today' : ($i === 1 ? ' · tomorrow' : ($i === -1 ? ' · yesterday' : ''))) . '</option>';
        }
        $nights = '';
        for ($i = 1; $i <= 30; $i++) {
            $nights .= '<option' . ($i === 7 ? ' selected' : '') . '>' . $i . '</option>';
        }

        $hero = '<section class="hero" id="top" aria-labelledby="heroTitle">'
            . '<div class="hero-photo" aria-hidden="true"><img src="/img/sky-wing.jpg" alt="" width="2200" height="1650" fetchpriority="high"></div>'
            . '<div class="hero-copy"><p class="kicker">' . self::e(($h['eyebrow'] ?? '') !== '' ? $h['eyebrow'] : ($this->s['tagline'] ?? '')) . '</p><h1 id="heroTitle">' . self::e($h['title'] ?? $p['title']) . '</h1><p class="hero-lede">' . $this->inl((string) ($h['text'] ?? '')) . '</p></div>'
            . '<svg class="hero-arc" viewBox="0 0 600 260" aria-hidden="true" focusable="false"><path id="heroPath" class="trail" d="M20 230 C 160 40, 440 40, 580 150"/><circle class="ring" cx="20" cy="230" r="11"/><circle class="end" cx="20" cy="230" r="4.5"/><circle class="ring" cx="580" cy="150" r="11"/><circle class="end" cx="580" cy="150" r="4.5"/>'
            . '<g id="heroPlane" transform="translate(580 150) rotate(25)"><circle r="17" fill="#fff"/><g transform="translate(-10 -10) scale(.84)"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" fill="#1866ff" transform="rotate(45 12 12)"/></g></g></svg>'
            . '<div class="hero-space"></div></section>';

        // The tabbed search card. Tab 2 is a real link to the packing list, so it works before (or without) JavaScript.
        $search = '<div class="search-wrap" id="lookup-card">'
            . '<div class="tabs-attached" data-tabs="search" aria-label="What would you like to do?"><a href="#lookup" id="t-flight" data-tab="lookup" class="on">' . self::ico('plane') . '<span>Track a flight</span></a><a href="/travel-checklist/" id="t-pack" data-tab="packstart">' . self::ico('luggage') . '<span class="long">Start a packing list</span><span class="short">Packing list</span></a></div>'
            . '<div class="search-card">'
            . '<form class="lookup" id="lookup" action="/app/" method="get" novalidate data-panel="lookup"><div class="search-grid">'
            . '<div class="field-wrap"><div class="field" id="fnField"><label for="lookup-number">Flight number</label><input name="number" id="lookup-number" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="8" placeholder="BA117" required pattern="[A-Za-z0-9]{2,3}\s?[0-9]{1,4}[A-Za-z]?" aria-describedby="fnErr"></div><p class="field-error" id="fnErr" hidden></p></div>'
            . '<div class="field"><label for="lookup-date">Departure date</label><select name="date" id="lookup-date">' . $opts . '</select>' . self::ico('down', 'caret') . '</div>'
            . '<div class="field"><span class="label" id="quickLbl">Quick pick</span><div class="daychips" role="group" aria-labelledby="quickLbl"><button type="button" data-off="-1" aria-pressed="false">Yesterday</button><button type="button" data-off="0" aria-pressed="true">Today</button><button type="button" data-off="1" aria-pressed="false">Tomorrow</button></div></div>'
            . '<button class="btn btn-primary" type="submit">' . self::ico('search') . 'Search</button></div>'
            . '<p class="search-note">' . self::ico('info', 'ico-sm') . '<span><span id="dateNote">Full schedule, gate and belt for departures from yesterday to three days ahead. Other dates show the usual route.</span> <span id="lookup-msg" role="status" aria-live="polite"><span data-auth="out">Free account needed. <a href="/help/#faq-account">Why?</a></span><span data-auth="in" hidden>You are signed in, so results open straight in your account.</span></span></span></p></form>'
            . '<form class="lookup" id="packstart" action="/travel-checklist/" method="get" data-panel="packstart" hidden><div class="search-grid packing">'
            . '<div class="field"><label for="trip">Trip name</label><input id="trip" name="trip" placeholder="New York in November" maxlength="60" autocomplete="off"></div>'
            . '<div class="field"><label for="leave">Leaving</label><input id="leave" name="date" type="date"></div>'
            . '<div class="field"><label for="nights">Nights away</label><select id="nights" name="nights">' . $nights . '</select>' . self::ico('down', 'caret') . '</div>'
            . '<button class="btn btn-primary" type="submit">' . self::ico('checks') . 'Start my list</button></div>'
            . '<p class="search-note">' . self::ico('info', 'ico-sm') . '<span>No account needed. Ticks stay on this device; sign in to keep a list for every trip.</span></p></form>'
            . '</div></div>';

        $sources = '<div class="sources" aria-label="Where the data comes from"><p>Data from</p><div class="src"><b>AeroDataBox</b><span>Schedules, terminals and gates</span></div><div class="src"><b>OpenSky Network</b><span>Aircraft position, when transmitting</span></div><div class="src"><b>adsbdb</b><span>The usual route for a flight number</span></div><div class="src"><b>Open-Meteo</b><span>Weather at the destination airport</span></div></div>';

        // Result anatomy: what each part is and where it comes from. No flight record, no times, no position.
        $rows = [
            ['clock', 'Scheduled times', 'AeroDataBox', 'blue', 'As published'],
            ['refresh', 'Estimated and actual', 'AeroDataBox', 'blue', 'Labelled clearly'],
            ['gate', 'Terminal and gate', 'AeroDataBox', 'warn missing', 'Not reported yet'],
            ['luggage', 'Baggage belt', 'AeroDataBox', 'warn missing', 'Not reported yet'],
            ['radio', 'Aircraft position', 'OpenSky Network', '', 'While transmitting'],
            ['route', 'Usual route', 'adsbdb', '', 'When no schedule'],
            ['cloud', 'Weather where you land', 'Open-Meteo', '', 'Today\'s conditions'],
            ['history', 'Fetched at', 'Flightdeck', 'ok', 'On every result'],
        ];
        $rowHtml = implode('', array_map(static function (array $r): string {
            return '<div class="row"><span class="tile">' . self::ico($r[0]) . '</span><div><b>' . self::e($r[1]) . '</b><small>' . self::e($r[2]) . '</small></div><span class="badge ' . $r[3] . '">' . self::e($r[4]) . '</span></div>';
        }, $rows));
        $icons = ['clock', 'gate', 'radio', 'cloud', 'share', 'checks'];
        $features = '';
        foreach (array_values($p['features'] ?? []) as $i => $f) {
            $features .= '<div class="feature"><span class="tile">' . self::ico($icons[$i] ?? 'info') . '</span><h3>' . self::e($f['title']) . '</h3><p>' . $this->inl((string) $f['text']) . '</p></div>';
        }
        $result = '<section class="sec" id="result" aria-labelledby="resultH"><div class="sec-head"><h2 id="resultH">Every detail on the page says where it came from.</h2><p>A result is built from four sources. When one of them has not reported yet, you see that plainly instead of a guess.</p></div>'
            . '<div class="anatomy"><aside class="panel board" aria-label="How a result is laid out"><div class="board-top"><div class="route" aria-label="Departure airport to arrival airport"><span class="code-ph on">LHR</span><svg class="route-line" viewBox="0 0 120 24" aria-hidden="true" focusable="false"><path d="M4 20 C 40 -4, 80 -4, 116 20" fill="none" stroke="#1866ff" stroke-width="2" stroke-dasharray="2 6" stroke-linecap="round"/><circle cx="4" cy="20" r="3.5" fill="#1866ff"/><circle cx="116" cy="20" r="3.5" fill="#1866ff"/></svg><span class="code-ph on">JFK</span></div><span class="badge blue">How a result is laid out</span></div><div class="rows">' . $rowHtml . '</div></aside>'
            . '<div class="fresh"><svg class="rings" viewBox="0 0 200 200" aria-hidden="true" focusable="false"><g fill="none" stroke="#fff" stroke-width="1.5"><circle cx="100" cy="100" r="30"/><circle cx="100" cy="100" r="55"/><circle cx="100" cy="100" r="80"/><circle cx="100" cy="100" r="99"/></g></svg><h3>How fresh it is</h3><p class="lead">Every result shows the time it was fetched. Nothing old is ever shown as live.</p>'
            . '<dl><div><dt class="num">10<small>min</small></dt><dd>Schedules and gates are fetched again at most this often.</dd></div><div><dt class="num">2<small>min</small></dt><dd>Aircraft position, while the aircraft is transmitting.</dd></div><div><dt class="num">12</dt><dd>Flights you can save to your account and see on any device.</dd></div></dl></div></div>'
            . ($features !== '' ? '<div class="panel features" id="features">' . $features . '</div>' : '') . '</section>';

        $steps = '';
        foreach (array_values($p['steps'] ?? []) as $i => $s) {
            $steps .= '<li><span class="n num">' . ($i + 1) . '</span><div><h3>' . self::e($s['title']) . '</h3><p>' . $this->inl((string) $s['text']) . '</p></div></li>';
        }
        $how = '<section class="sec" id="how" aria-labelledby="howH"><div class="how"><div class="how-photo"><img src="/img/terminal.jpg" alt="Passengers at a terminal window watching aircraft on the stand" loading="lazy" width="1100" height="1466"><div class="cap"><span class="tile">' . self::ico('gate') . '</span><div><b>Gates are often assigned late</b><span>Flightdeck waits for the airport instead of guessing. Always follow the screens.</span></div></div></div>'
            . '<div class="panel steps"><p class="eyebrow">How it works</p><h2 id="howH">Three steps, and no guesswork.</h2><p>Every time says whether it is scheduled, estimated or actual, in the airport\'s own time zone.</p><div class="steps-list"><span class="prog" aria-hidden="true"></span><ol id="steps">' . $steps . '</ol></div>'
            . '<div class="actions"><a class="btn btn-primary" href="#lookup-card">Look up a flight</a><a class="btn btn-ghost" href="#faq">Read the questions</a></div></div></div></section>';

        $count = count($faqsAll);
        $words = [1 => 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
        $faq = $faqsAll ? '<section class="sec" id="faq" aria-labelledby="faqH"><div class="qa"><div class="panel qa-side"><p class="eyebrow">Questions</p><h2 id="faqH">What people ask before they fly.</h2><p>Short answers here. The <a href="/help/">help page</a> has all ' . ($words[$count] ?? (string) $count) . ', with links to the data and privacy pages.</p>'
            . '<div class="contact"><b>Still stuck?</b><span>' . ($email !== '' ? 'Write to <a class="num" href="mailto:' . self::e($email) . '">' . self::e($email) . '</a>. ' : '') . 'A real person reads every message.</span><a class="btn btn-ghost btn-sm" href="/contact/" data-dialog="contact-dlg">' . self::ico('mail', 'ico-sm') . 'Send a message</a></div></div>'
            . '<div class="panel acc" id="acc">' . $this->faqList(array_slice($faqsAll, 0, 6), false, true) . '</div></div></section>' : '';

        $final = $p['final'] ?? ['title' => '', 'text' => ''];
        $closing = '<section class="sec" aria-labelledby="closeH"><div class="closing"><div><h2 id="closeH">' . self::e($final['title']) . '</h2><p>' . $this->inl((string) $final['text']) . '</p><div class="actions"><a class="btn btn-white btn-lg" data-auth="out" href="/app/">Create a free account</a><a class="btn btn-white btn-lg" data-auth="in" href="/app/" hidden>Open my flights</a><a class="btn btn-glass btn-lg" href="#packing">Use the packing list</a></div></div>' . self::routeArt() . '</div></section>';

        $dialog = '<dialog class="dialog" id="contact-dlg" aria-labelledby="contactH"><div class="dialog-head"><div><h2 id="contactH">Send a message</h2><p class="label">It goes to the Flightdeck inbox, and we reply by email.</p></div><button class="icon-btn" type="button" data-close aria-label="Close">' . self::ico('x') . '</button></div>' . $this->contactForm(true) . '</dialog>';

        $main = '<div class="shell">' . $hero . $search . '<div class="home-body">' . $sources . $result . $this->beforeYouFly($guides) . $how . $this->packTeaser() . $faq . $closing . '</div></div>' . $dialog;
        $url = $this->url('');
        $ld = [
            ['@context' => 'https://schema.org', '@type' => 'WebSite', 'name' => $this->s['siteName'], 'url' => $url],
            ['@context' => 'https://schema.org', '@type' => 'WebApplication', 'name' => $this->s['siteName'], 'url' => $url . 'app/', 'description' => $p['description'], 'applicationCategory' => 'TravelApplication', 'operatingSystem' => 'Any',
                'offers' => ['@type' => 'Offer', 'price' => '0', 'priceCurrency' => 'GBP']],
        ];
        return $this->layout(['title' => $p['title'], 'bareTitle' => true, 'description' => $p['description'], 'url' => $url, 'here' => '/', 'main' => $main, 'ld' => $ld, 'home' => true, 'motion' => true,
            'scripts' => '<script src="' . self::e($this->assets['contactJs']) . '" defer></script>']);
    }

    /** "Before you fly": destinations and three guide topics, three cards each. Without JavaScript the topic pills open the guide index. */
    private function beforeYouFly(array $guides): string
    {
        $tabs = '<a href="#spot-dest" class="chip" data-tab="spot-dest" aria-current="true">Destinations</a>';
        $cards = '';
        $dialogs = '';
        foreach (self::DEST as $code => $d) {
            $id = 'dest-' . strtolower($code);
            $cards .= '<article class="dest"><img src="' . $d['img'] . '" alt="' . self::e($d['alt']) . '" loading="lazy" width="' . $d['w'] . '" height="' . $d['h'] . '"><button class="open" type="button" data-dialog="' . $id . '" aria-haspopup="dialog" aria-label="Open the ' . self::e($d['city']) . ' guide"></button>'
                . '<button class="fav" type="button" data-fav="' . $code . '" aria-pressed="false" aria-label="Save ' . self::e($d['city']) . ' to favourites on this device" title="Saved on this device only" hidden>' . self::ico('heart') . '</button>'
                . '<div class="body"><h3>' . self::e(rtrim($d['greeting'], '.')) . '</h3><div class="meta"><span>' . self::ico('pin', 'ico-sm') . $code . ' · ' . self::e($d['airport']) . '</span><span class="num">' . self::e(trim(explode('·', $d['currency'])[1] ?? '')) . '</span></div></div></article>';
            $places = implode('', array_map(static function (array $pl): string {
                return '<li><a href="' . self::e($pl[3]) . '" target="_blank" rel="noopener"><b>' . self::e($pl[0]) . '</b><small>' . self::e($pl[1]) . '</small><small>' . self::e($pl[2]) . '</small>' . self::ico('external') . '</a></li>';
            }, $d['places']));
            $dialogs .= '<dialog class="dialog" id="' . $id . '" aria-labelledby="' . $id . '-h"><div class="dialog-head"><div><p class="label">' . $code . ' · ' . self::e($d['airport']) . '</p><h2 id="' . $id . '-h">' . self::e($d['greeting']) . '</h2></div><button class="icon-btn" type="button" data-close aria-label="Close">' . self::ico('x') . '</button></div>'
                . '<div class="dlg-photo"><img src="' . $d['img'] . '" alt="' . self::e($d['alt']) . '" loading="lazy" width="' . $d['w'] . '" height="' . $d['h'] . '"></div><p>' . self::e($d['intro']) . '</p>'
                . '<div class="facts"><div><span class="label">Currency</span><b>' . self::e($d['currency']) . '</b></div><div><span class="label">Language</span><b>' . self::e($d['language']) . '</b></div><div><span class="label">Airport</span><b>' . $code . '</b></div></div>'
                . '<p class="label tip-l">Arrival tip</p><p class="tip">' . self::e($d['tip']) . '</p><ul class="places">' . $places . '</ul></dialog>';
        }
        $panels = '<div class="cards3" id="spot-dest" data-panel="spot-dest">' . $cards . '</div>';
        $bySlug = [];
        foreach ($guides as $g) {
            $bySlug[$g['slug']] = $g;
        }
        foreach ($this->c['guideCategories'] ?? [] as $cat) {
            $pick = array_values(array_filter(array_map(static function ($s) use ($bySlug) {
                return $bySlug[$s] ?? null;
            }, self::PICK[$cat['id']] ?? [])));
            $list = count($pick) === 3 ? $pick : array_slice(array_values(array_filter($guides, static function ($g) use ($cat): bool {
                return ($g['category'] ?? '') === $cat['id'];
            })), 0, 3);
            if (count($list) < 3) {
                continue; // a row is always three equal cards
            }
            $pid = 'spot-' . self::e($cat['id']);
            $tabs .= '<a href="/guides/#cat-' . self::e($cat['id']) . '" class="chip" data-tab="' . $pid . '">' . self::e($cat['title']) . '</a>';
            $panels .= '<div class="cards3" id="' . $pid . '" data-panel="' . $pid . '" hidden>' . implode('', array_map(function (array $g) use ($cat): string {
                return '<a class="guide" href="/' . self::e($g['slug']) . '/"><span class="gtile">' . self::ico(self::CAT_ICON[$cat['id']] ?? 'book') . '</span><span class="label cat">' . self::e($cat['title']) . '</span><h3>' . self::e($g['title']) . '</h3><p>' . self::e($g['description']) . '</p><span class="go">Read the guide ' . self::ico('arrow') . '</span></a>';
            }, $list)) . '</div>';
        }
        return '<section class="sec" id="guides" aria-labelledby="spotsH"><div class="panel spots"><div class="spots-head"><h2 id="spotsH">Before you fly</h2><a class="link-quiet" href="/guides/">See all ' . count($guides) . ' guides</a></div>'
            . '<div class="spots-bar"><div class="chips" data-tabs="spots" aria-label="Choose a topic">' . $tabs . '</div></div>' . $panels . '</div>' . $dialogs . '</section>';
    }

    /** The packing list teaser: the real template, ticks shared with /travel-checklist/ (same storage key and item keys). */
    private function packTeaser(): string
    {
        $tpl = $this->c['checklistTemplate'] ?? [];
        if (!$tpl) {
            return '';
        }
        $total = array_sum(array_map(static function ($s): int {
            return count($s['items']);
        }, $tpl));
        $tabs = '';
        $panels = '';
        foreach ($tpl as $i => $sec) {
            $sid = $this->sectionId($sec);
            $n = count($sec['items']);
            $tabs .= '<a href="/travel-checklist/#' . $sid . '" class="chip" data-tab="pk-' . $sid . '"' . ($i === 0 ? ' aria-current="true"' : '') . '>' . self::e($sec['title']) . '<span class="c num" data-c="' . $sid . '">0/' . $n . '</span></a>';
            $items = '';
            foreach ($sec['items'] as $j => $it) {
                $items .= '<li><label><input class="tick" type="checkbox" data-k="' . $sid . '-' . $j . '"><span>' . self::e($it['text']) . '</span></label></li>';
            }
            $panels .= '<div class="pk-panel" id="pk-' . $sid . '" data-panel="pk-' . $sid . '" data-title="' . self::e($sec['title']) . '"' . ($i === 0 ? '' : ' hidden') . '><p class="pack-hint">' . self::e($sec['hint'] ?? '') . '</p><ul class="items">' . $items . '</ul></div>';
        }
        $words = [1 => 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
        return '<section class="sec" id="packing" aria-labelledby="packH"><div class="pack"><div class="pack-intro"><p class="eyebrow">Free packing list</p><h2 id="packH"><span id="packTitle">One list, ' . $total . ' things,</span> ' . ($words[count($tpl)] ?? (string) count($tpl)) . ' sections.</h2>'
            . '<p>Tick things off here or print a clean A4 copy. No account needed. Sign in and you can keep a list for each trip, add your own items and link it to a flight.</p>'
            . '<div class="ring-wrap"><svg class="ring" viewBox="0 0 120 120" aria-hidden="true" focusable="false"><circle class="bg" cx="60" cy="60" r="50"/><circle class="fg" id="ringFg" cx="60" cy="60" r="50" stroke-dasharray="314.16" stroke-dashoffset="314.16"/><text id="ringPct" x="60" y="68" text-anchor="middle" class="num">0%</text></svg><div><b id="packedCount" class="num" role="status" aria-live="polite">0 of ' . $total . ' packed</b><span id="packedNext">Start with ' . self::e($tpl[0]['title']) . '.</span></div></div>'
            . '<div class="actions"><a class="btn btn-white" href="/travel-checklist/">' . self::ico('printer') . 'Print preview</a><a class="btn btn-ghost" href="/app/#/checklist">Keep it in the app</a></div></div>'
            . '<div class="panel pack-list" id="pack-preview" data-total="' . $total . '"><div class="sec-tabs" data-tabs="pack" aria-label="Packing sections">' . $tabs . '</div>' . $panels
            . '<div class="pack-foot"><span class="label" id="secCount">' . count($tpl[0]['items']) . ' things in ' . self::e($tpl[0]['title']) . '</span><div class="pack-btns"><button class="btn btn-quiet btn-sm" type="button" id="clearSec" hidden>' . self::ico('undo', 'ico-sm') . 'Untick this section</button><a class="btn btn-ghost btn-sm" id="nextSec" href="/travel-checklist/">Open the full list' . self::ico('arrow', 'ico-sm') . '</a></div></div></div></div></section>';
    }

    private function notFound(): string
    {
        $p = ['kind' => 'page', 'title' => 'Page not found', 'description' => 'That page does not exist or has moved.'];
        $main = '<div class="shell page">' . $this->head($p) . '<div class="panel sheet lost"><p class="sub">Try one of these instead.</p><div class="lost-links"><a href="/"><span class="tile">' . self::ico('search') . '</span><b>Home page</b><small>Look up a flight</small></a><a href="/app/"><span class="tile">' . self::ico('plane') . '</span><b>The Flightdeck app</b><small>Your saved flights</small></a><a href="/travel-checklist/"><span class="tile">' . self::ico('checks') . '</span><b>Packing list</b><small>Free and printable</small></a><a href="/guides/"><span class="tile">' . self::ico('book') . '</span><b>Travel guides</b><small>Plain, practical help</small></a></div></div></div>';
        return $this->layout(['title' => $p['title'], 'description' => $p['description'], 'url' => $this->url(''), 'here' => '', 'main' => $main, 'noindex' => true]);
    }

    /** Owner switched on maintenance in Site settings: a branded "back soon" page (503), with the app still reachable. */
    public function maintenance(string $message): string
    {
        $text = trim($message) !== '' ? $message : 'Flightdeck is being updated. Please try again shortly.';
        $p = ['kind' => 'page', 'title' => 'Back soon', 'description' => $text];
        $main = '<div class="shell page">' . $this->head($p) . '<div class="panel sheet lost"><p>' . self::e($text) . '</p><p>Your saved flights and packing lists are safe. The <a href="/app/">app</a> may still work.</p></div></div>';
        return $this->layout(['title' => 'Back soon', 'description' => $text, 'url' => $this->url(''), 'here' => '', 'main' => $main, 'noindex' => true]);
    }

    public function unavailable(): string
    {
        $p = ['kind' => 'page', 'title' => 'Flightdeck is briefly unavailable', 'description' => 'Please try again in a few minutes.'];
        $main = '<div class="shell page">' . $this->head($p) . '<div class="panel sheet lost"><p>The website could not load its pages just now. The <a href="/app/">app</a> may still work.</p></div></div>';
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
