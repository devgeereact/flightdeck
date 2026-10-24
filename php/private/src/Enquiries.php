<?php
declare(strict_types=1);

namespace Flightdeck;

/**
 * Contact, feedback and bug messages from visitors. Each message is stored as a small JSON file for the owner console and, when an
 * owner address is configured, also emailed. Spam control: honeypot field, minimum fill time, size limits, link limit and a per-visitor
 * rate limit. Everything that reaches an email header is validated first (no line breaks), so a visitor cannot inject headers.
 */
final class Enquiries
{
    public const KINDS = ['contact', 'feedback', 'bug'];
    public const STATUSES = ['new', 'read', 'replied', 'archived'];
    public const MIN_FILL_MS = 2500;
    public const MAX_MESSAGE = 4000;

    private $dir;
    private $mailer;

    /** @param callable|null $mailer fn(string $to, string $subject, string $body, array $headers): bool, defaults to PHP mail() */
    public function __construct(string $varDir, ?callable $mailer = null)
    {
        $this->dir = $varDir . '/enquiries';
        if (!is_dir($this->dir) && !@mkdir($this->dir, 0700, true) && !is_dir($this->dir)) {
            throw new \RuntimeException('Storage directory is not writable.');
        }
        $this->mailer = $mailer ?? static function (string $to, string $subject, string $body, array $headers): bool {
            return @mail($to, $subject, $body, implode("\r\n", $headers));
        };
    }

    private static function oneLine(string $v, int $max): string
    {
        return mb_substr(trim((string) preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $v)), 0, $max);
    }

    /**
     * @return array{ok:bool,status:int,error:?string,id:?string}
     */
    public function submit(array $in, ?string $ownerEmail, string $mailFrom, ?int $nowMs = null): array
    {
        $fail = static function (int $status, string $error): array {
            return ['ok' => false, 'status' => $status, 'error' => $error, 'id' => null];
        };
        $now = $nowMs ?? Store::nowMs();
        if (!empty($in['website'])) { // honeypot: real people never see this field
            return ['ok' => true, 'status' => 200, 'error' => null, 'id' => null]; // pretend success, store nothing
        }
        $kind = is_string($in['kind'] ?? null) && in_array($in['kind'], self::KINDS, true) ? $in['kind'] : null;
        $message = is_string($in['message'] ?? null) ? trim(str_replace("\r\n", "\n", $in['message'])) : '';
        $email = is_string($in['email'] ?? null) ? trim($in['email']) : '';
        $name = is_string($in['name'] ?? null) ? self::oneLine($in['name'], 80) : '';
        $elapsed = $in['elapsed'] ?? null;
        if ($kind === null) {
            return $fail(422, 'Choose what this message is about.');
        }
        if (mb_strlen($message) < 5) {
            return $fail(422, 'Please write a little more so we can help.');
        }
        if (mb_strlen($message) > self::MAX_MESSAGE) {
            return $fail(413, 'That message is too long. Please keep it under 4,000 characters.');
        }
        if ($email !== '' && (strlen($email) > 254 || filter_var($email, FILTER_VALIDATE_EMAIL) === false || preg_match('/[\r\n]/', $email))) {
            return $fail(422, 'That email address does not look right.');
        }
        if ($kind === 'contact' && $email === '') {
            return $fail(422, 'Please add your email address so we can reply.');
        }
        if (!is_numeric($elapsed) || (float) $elapsed < self::MIN_FILL_MS) {
            return $fail(429, 'That was very quick. Please check your message and send it again.');
        }
        if (preg_match_all('#https?://#i', $message) > 2) {
            return $fail(422, 'Please remove the links from your message.');
        }
        $id = gmdate('YmdHis', intdiv($now, 1000)) . '-' . bin2hex(random_bytes(3));
        $record = [
            'id' => $id, 'kind' => $kind, 'status' => 'new', 'createdAt' => $now, 'name' => $name, 'email' => $email,
            'message' => $message, 'emailed' => false,
        ];
        if (is_string($ownerEmail) && filter_var($ownerEmail, FILTER_VALIDATE_EMAIL) !== false) {
            $subject = '[Flightdeck] ' . $kind . ': ' . self::oneLine($message, 60);
            $headers = ['MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'From: Flightdeck <' . $mailFrom . '>'];
            if ($email !== '') {
                $headers[] = 'Reply-To: ' . $email;
            }
            $body = "New {$kind} message\n\nFrom: " . ($name !== '' ? $name : '(no name)') . ' <' . ($email !== '' ? $email : 'no email') . ">\n\n" . $message . "\n\n-- Open the owner console to mark it read or replied.\n";
            try {
                $record['emailed'] = (bool) ($this->mailer)($ownerEmail, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, $headers);
            } catch (\Throwable $e) {
                $record['emailed'] = false;
            }
        }
        $path = $this->dir . '/' . $id . '.json';
        if (@file_put_contents($path, json_encode($record, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) === false) {
            return $fail(500, 'Your message could not be saved. Please try again in a moment.');
        }
        @chmod($path, 0600);
        return ['ok' => true, 'status' => 200, 'error' => null, 'id' => $id];
    }

    /** @return array{items:array,total:int,unread:int} newest first */
    public function list(int $limit = 50, int $offset = 0): array
    {
        $files = glob($this->dir . '/*.json') ?: [];
        rsort($files);
        $items = [];
        $unread = 0;
        foreach ($files as $i => $f) {
            $d = json_decode((string) @file_get_contents($f), true);
            if (!is_array($d) || !isset($d['id'])) {
                continue;
            }
            if (($d['status'] ?? 'new') === 'new') {
                $unread++;
            }
            if ($i >= $offset && count($items) < $limit) {
                $items[] = $d;
            }
        }
        return ['items' => $items, 'total' => count($files), 'unread' => $unread];
    }

    public function unread(): int
    {
        return $this->list(0, 0)['unread'];
    }

    /**
     * Email a reply to the person who wrote in, from the owner's mailbox, and keep a copy on the enquiry. Replies to the reply go to
     * the owner address. The enquiry is marked "replied" only when the mail was really accepted for delivery.
     * @return array{ok:bool,status:int,error:?string}
     */
    public function reply(string $id, string $message, string $mailFrom, ?string $ownerEmail, ?int $nowMs = null): array
    {
        $fail = static function (int $status, string $error): array {
            return ['ok' => false, 'status' => $status, 'error' => $error];
        };
        if (!preg_match('/^\d{14}-[0-9a-f]{6}$/D', $id)) {
            return $fail(404, 'That message was not found.');
        }
        $path = $this->dir . '/' . $id . '.json';
        $d = json_decode((string) @file_get_contents($path), true);
        if (!is_array($d)) {
            return $fail(404, 'That message was not found.');
        }
        $to = is_string($d['email'] ?? null) ? trim($d['email']) : '';
        if ($to === '' || filter_var($to, FILTER_VALIDATE_EMAIL) === false || preg_match('/[\r\n]/', $to)) {
            return $fail(422, 'This message has no email address to reply to.');
        }
        $message = trim(str_replace("\r\n", "\n", $message));
        if (mb_strlen($message) < 2) {
            return $fail(422, 'Write your reply first.');
        }
        if (mb_strlen($message) > self::MAX_MESSAGE) {
            return $fail(413, 'That reply is too long. Please keep it under 4,000 characters.');
        }
        $name = is_string($d['name'] ?? null) ? $d['name'] : '';
        $quoted = '> ' . str_replace("\n", "\n> ", mb_substr((string) ($d['message'] ?? ''), 0, 1500));
        $body = ($name !== '' ? 'Hello ' . $name . ",\n\n" : "Hello,\n\n") . $message . "\n\n--\nFlightdeck\n\nYou wrote on " . gmdate('j M Y', intdiv((int) ($d['createdAt'] ?? 0), 1000)) . ":\n" . $quoted . "\n";
        $subject = 'Re: ' . self::oneLine('Your message to Flightdeck: ' . (string) ($d['message'] ?? ''), 70);
        $headers = ['MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'From: Flightdeck <' . $mailFrom . '>'];
        if (is_string($ownerEmail) && filter_var($ownerEmail, FILTER_VALIDATE_EMAIL) !== false) {
            $headers[] = 'Reply-To: ' . $ownerEmail;
        }
        try {
            $sent = (bool) ($this->mailer)($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, $headers);
        } catch (\Throwable $e) {
            $sent = false;
        }
        if (!$sent) {
            return $fail(502, 'The email could not be sent. Check the mail settings, then try again.');
        }
        $now = $nowMs ?? Store::nowMs();
        $d['replies'] = array_slice(array_merge(is_array($d['replies'] ?? null) ? $d['replies'] : [], [['at' => $now, 'text' => $message]]), -20);
        $d['status'] = 'replied';
        $d['updatedAt'] = $now;
        $tmp = $path . '.tmp';
        if (@file_put_contents($tmp, json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) === false || !@rename($tmp, $path)) {
            return $fail(500, 'The reply was sent but could not be saved on the message.');
        }
        @chmod($path, 0600);
        return ['ok' => true, 'status' => 200, 'error' => null];
    }

    public function setStatus(string $id, string $status): bool
    {
        if (!preg_match('/^\d{14}-[0-9a-f]{6}$/D', $id) || !in_array($status, self::STATUSES, true)) {
            return false;
        }
        $path = $this->dir . '/' . $id . '.json';
        $d = json_decode((string) @file_get_contents($path), true);
        if (!is_array($d)) {
            return false;
        }
        $d['status'] = $status;
        $d['updatedAt'] = Store::nowMs();
        $tmp = $path . '.tmp';
        if (@file_put_contents($tmp, json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) === false) {
            return false;
        }
        @chmod($tmp, 0600);
        return @rename($tmp, $path);
    }
}
