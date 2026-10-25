<?php
declare(strict_types=1);

namespace Flightdeck\Content;

/**
 * The safe Markdown subset used by every CMS text field (docs/CMS.md). There is no raw HTML: every character of input is escaped,
 * and only these tags can come out: h2-h4, p, ul, ol, li, strong, em, code, a, blockquote, table/thead/tbody/tr/th/td.
 * Links are limited to site paths, #anchors, http(s) and mailto. {{placeholders}} are replaced from settings before parsing,
 * with Markdown characters in the values escaped, so a setting can never add formatting or links.
 */
final class Markdown
{
    public const PLACEHOLDERS = ['ownerName', 'contactEmail', 'lastReviewed', 'siteUrl', 'siteName'];

    private $host;
    private $ids = [];
    private $toc = [];

    private function __construct(string $siteUrl)
    {
        $this->host = strtolower((string) parse_url($siteUrl, PHP_URL_HOST));
    }

    /** @return array{html: string, toc: list<array{id: string, text: string}>, words: int} */
    public static function render(string $md, array $vars = [], string $siteUrl = ''): array
    {
        $r = new self($siteUrl);
        $md = self::fill($md, $vars);
        $html = $r->blocks(str_replace(["\r\n", "\r"], "\n", $md));
        $text = trim(preg_replace('/\s+/', ' ', strip_tags($html)) ?? '');
        return ['html' => $html, 'toc' => $r->toc, 'words' => $text === '' ? 0 : count(explode(' ', $text))];
    }

    /** One line of inline text (FAQ question, card text) with the same rules, no block structure. */
    public static function inline(string $md, array $vars = [], string $siteUrl = ''): string
    {
        return (new self($siteUrl))->spans(self::fill(str_replace("\n", ' ', $md), $vars));
    }

    /** The same link rule the renderer uses, for structured fields (announcement and navigation links). */
    public static function safeHref(string $href): ?string
    {
        return (new self(''))->href($href);
    }

    public static function escapeText(string $v): string
    {
        return preg_replace('/([\\\\*`\[\]|{}])/', '\\\\$1', $v) ?? '';
    }

    /** Placeholders that are unknown stay visible as typed, so an editor sees the mistake in the preview. */
    private static function fill(string $md, array $vars): string
    {
        return preg_replace_callback('/\{\{\s*([a-zA-Z]+)\s*\}\}/', static function (array $m) use ($vars): string {
            return in_array($m[1], self::PLACEHOLDERS, true) && isset($vars[$m[1]]) ? self::escapeText((string) $vars[$m[1]]) : $m[0];
        }, $md) ?? '';
    }

    private static function e(string $v): string
    {
        return htmlspecialchars($v, ENT_QUOTES | ENT_SUBSTITUTE | ENT_HTML5, 'UTF-8');
    }

    private function blocks(string $md): string
    {
        $lines = explode("\n", $md);
        $out = [];
        $n = count($lines);
        for ($i = 0; $i < $n;) {
            $line = rtrim($lines[$i]);
            if (trim($line) === '') {
                $i++;
                continue;
            }
            if (preg_match('/^(#{2,4})\s+(.+)$/', $line, $m)) {
                $level = strlen($m[1]);
                $inner = $this->spans(trim($m[2]));
                if ($level === 2) {
                    $text = trim(html_entity_decode(strip_tags($inner), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
                    $id = $this->id($text);
                    $this->toc[] = ['id' => $id, 'text' => $text];
                    $out[] = '<h2 id="' . $id . '">' . $inner . '</h2>';
                } else {
                    $out[] = "<h$level>$inner</h$level>";
                }
                $i++;
                continue;
            }
            if (preg_match('/^(-|\d{1,3}\.)\s+/', $line, $m)) {
                $ordered = $m[1] !== '-';
                $items = [];
                while ($i < $n && preg_match($ordered ? '/^\d{1,3}\.\s+(.*)$/' : '/^-\s+(.*)$/', rtrim($lines[$i]), $im)) {
                    $item = $im[1];
                    $i++;
                    while ($i < $n && preg_match('/^\s{2,}(\S.*)$/', $lines[$i], $cm)) { // indented continuation line
                        $item .= ' ' . rtrim($cm[1]);
                        $i++;
                    }
                    $items[] = '<li>' . $this->spans(trim($item)) . '</li>';
                }
                $tag = $ordered ? 'ol' : 'ul';
                $out[] = "<$tag>" . implode('', $items) . "</$tag>";
                continue;
            }
            if ($line[0] === '|' && $i + 1 < $n && preg_match('/^\|?(\s*:?-{3,}:?\s*\|)+\s*:?-{0,}:?\s*$/', trim($lines[$i + 1]))) {
                $head = $this->cells($line);
                $i += 2;
                $rows = [];
                while ($i < $n && strlen(trim($lines[$i])) > 0 && trim($lines[$i])[0] === '|') {
                    $rows[] = $this->cells(trim($lines[$i]));
                    $i++;
                }
                $width = count($head);
                $th = implode('', array_map(function (string $c): string {
                    return '<th>' . $this->spans($c) . '</th>';
                }, $head));
                $body = implode('', array_map(function (array $r) use ($width): string {
                    $r = array_pad(array_slice($r, 0, $width), $width, '');
                    return '<tr>' . implode('', array_map(function (string $c): string {
                        return '<td>' . $this->spans($c) . '</td>';
                    }, $r)) . '</tr>';
                }, $rows));
                $out[] = '<div class="table-scroll"><table><thead><tr>' . $th . '</tr></thead><tbody>' . $body . '</tbody></table></div>';
                continue;
            }
            if (preg_match('/^>\s?(.*)$/', $line)) {
                $quote = [];
                while ($i < $n && preg_match('/^>\s?(.*)$/', rtrim($lines[$i]), $qm)) {
                    $quote[] = $qm[1];
                    $i++;
                }
                $out[] = '<blockquote><p>' . $this->spans(trim(implode(' ', $quote))) . '</p></blockquote>';
                continue;
            }
            $para = [];
            while ($i < $n && trim($lines[$i]) !== '' && !preg_match('/^(#{2,4}\s|-\s|\d{1,3}\.\s|>|\|)/', ltrim($lines[$i]))) {
                $para[] = trim($lines[$i]);
                $i++;
            }
            if ($para === []) { // a line that looks like a block start but is not a valid block: show it as text
                $para[] = trim($lines[$i]);
                $i++;
            }
            $out[] = '<p>' . $this->spans(implode(' ', $para)) . '</p>';
        }
        return implode("\n", $out);
    }

    /** @return list<string> */
    private function cells(string $row): array
    {
        $row = trim($row);
        $row = substr($row, 1);
        if (substr($row, -1) === '|' && substr($row, -2) !== '\\|') {
            $row = substr($row, 0, -1);
        }
        $parts = preg_split('/(?<!\\\\)\|/', $row) ?: [];
        return array_map('trim', $parts);
    }

    private function id(string $text): string
    {
        $base = trim(preg_replace('/[^a-z0-9]+/', '-', strtolower($text)) ?? '', '-');
        $base = $base === '' ? 'section' : substr($base, 0, 80);
        $id = $base;
        for ($k = 2; isset($this->ids[$id]); $k++) {
            $id = $base . '-' . $k;
        }
        $this->ids[$id] = true;
        return $id;
    }

    /** Inline spans. Output is built only from escaped text and the fixed tags below. */
    private function spans(string $s, bool $inLink = false): string
    {
        $out = '';
        $len = strlen($s);
        for ($i = 0; $i < $len;) {
            $c = $s[$i];
            if ($c === '\\' && $i + 1 < $len && strpos('\\*`[]|{}#->_.!()', $s[$i + 1]) !== false) {
                $out .= self::e($s[$i + 1]);
                $i += 2;
                continue;
            }
            if ($c === '`' && ($end = strpos($s, '`', $i + 1)) !== false) {
                $out .= '<code>' . self::e(substr($s, $i + 1, $end - $i - 1)) . '</code>';
                $i = $end + 1;
                continue;
            }
            if (!$inLink && $c === '[' && preg_match('/\G\[((?:\\\\.|[^\]\\\\])+)\]\(([^()\s]+)\)/', $s, $m, 0, $i)) {
                $label = $this->spans($m[1], true);
                $href = $this->href($m[2]);
                if ($href === null) {
                    $out .= $label; // unsafe or malformed link: keep the words, drop the link
                } else {
                    $external = (bool) preg_match('#^https?://#i', $href) && strtolower((string) parse_url($href, PHP_URL_HOST)) !== $this->host;
                    // #cookie-settings is reserved: it reopens the cookie choice (public/consent.js listens for the attribute).
                    $extra = $href === '#cookie-settings' ? ' data-fd-cookie-settings' : ($external ? ' rel="noopener"' : '');
                    $out .= '<a href="' . self::e($href) . '"' . $extra . '>' . $label . '</a>';
                }
                $i += strlen($m[0]);
                continue;
            }
            if ($c === '*' && substr($s, $i, 2) === '**' && ($end = strpos($s, '**', $i + 2)) !== false && $end > $i + 2) {
                $out .= '<strong>' . $this->spans(substr($s, $i + 2, $end - $i - 2), $inLink) . '</strong>';
                $i = $end + 2;
                continue;
            }
            if ($c === '*' && preg_match('/\G\*([^*\s](?:[^*]*[^*\s])?)\*/', $s, $m, 0, $i)) {
                $out .= '<em>' . $this->spans($m[1], $inLink) . '</em>';
                $i += strlen($m[0]);
                continue;
            }
            // Copy a run of ordinary characters at once (multibyte-safe: we only ever stop on ASCII markers).
            $run = strcspn($s, '\\`[*', $i + 1) + 1;
            $out .= self::e(substr($s, $i, $run));
            $i += $run;
        }
        return $out;
    }

    /** Allowed link targets only. Returns the href to use, or null to drop the link. */
    private function href(string $raw): ?string
    {
        $h = trim(html_entity_decode($raw, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        if ($h === '' || strlen($h) > 2000 || preg_match('/[\x00-\x20\x7f"<>\\\\]/', $h)) {
            return null;
        }
        if ($h[0] === '#') {
            return preg_match('/^#[A-Za-z0-9_-]{1,80}$/D', $h) ? $h : null;
        }
        if ($h[0] === '/') {
            return substr($h, 0, 2) === '//' ? null : (preg_match('#^/[A-Za-z0-9/_.~%+-]*(\?[A-Za-z0-9=&_.~%+-]*)?(\#[A-Za-z0-9_-]*)?$#D', $h) ? $h : null);
        }
        if (preg_match('#^https?://[A-Za-z0-9.-]+(:\d{1,5})?(/[^\s]*)?$#iD', $h)) {
            return $h;
        }
        if (preg_match('/^mailto:[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/D', $h)) {
            return $h;
        }
        return null;
    }
}
