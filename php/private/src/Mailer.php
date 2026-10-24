<?php
declare(strict_types=1);

namespace Flightdeck;

/**
 * Outgoing email. Uses the owner's own SMTP mailbox when `smtp_host` is configured (implicit TLS on 465 or STARTTLS on 587, AUTH LOGIN),
 * and falls back to PHP mail() otherwise. Every address and header value is checked for line breaks first, so nothing a visitor typed
 * can inject headers. The SMTP password lives only in the private config file.
 */
final class Mailer
{
    /** @return callable fn(string $to, string $subject, string $body, array $headers): bool */
    public static function make(array $config): callable
    {
        $host = is_string($config['smtp_host'] ?? null) ? trim($config['smtp_host']) : '';
        if ($host === '') {
            return static function (string $to, string $subject, string $body, array $headers): bool {
                return !preg_match('/[\r\n]/', $to) && @mail($to, $subject, $body, implode("\r\n", $headers));
            };
        }
        $port = (int) ($config['smtp_port'] ?? 465);
        $want = $config['smtp_secure'] ?? ($port === 465 ? 'ssl' : 'tls');
        // 'none' (no encryption) exists only for talking to a test server on this same machine.
        $secure = $want === 'none' && in_array($host, ['127.0.0.1', 'localhost', '::1'], true) ? 'none' : ($want === 'ssl' ? 'ssl' : 'tls');
        $user = is_string($config['smtp_user'] ?? null) ? $config['smtp_user'] : '';
        $pass = is_string($config['smtp_pass'] ?? null) ? $config['smtp_pass'] : '';
        $from = is_string($config['mail_from'] ?? null) ? $config['mail_from'] : $user;
        return static function (string $to, string $subject, string $body, array $headers) use ($host, $port, $secure, $user, $pass, $from): bool {
            try {
                $conn = SmtpConnection::open($host, $port, $secure);
                return self::deliver($conn, $host, $user, $pass, $from, $to, $subject, $body, $headers, $secure === 'tls');
            } catch (\Throwable $e) {
                error_log('flightdeck: smtp failed: ' . get_class($e));
                return false;
            }
        };
    }

    /** One SMTP conversation over any connection with read(): string (one full reply) and write(string). */
    public static function deliver($conn, string $host, string $user, string $pass, string $from, string $to, string $subject, string $body, array $headers, bool $startTls = false): bool
    {
        foreach ([$to, $from] as $addr) {
            if (filter_var($addr, FILTER_VALIDATE_EMAIL) === false || preg_match('/[\r\n]/', $addr)) {
                return false;
            }
        }
        $expect = static function (string $reply, array $codes) {
            if (!in_array((int) substr($reply, 0, 3), $codes, true)) {
                throw new \RuntimeException('smtp ' . substr($reply, 0, 3));
            }
            return $reply;
        };
        $cmd = static function (string $line, array $codes) use ($conn, $expect) {
            $conn->write($line . "\r\n");
            return $expect($conn->read(), $codes);
        };
        $expect($conn->read(), [220]);
        $cmd('EHLO flightdeck.local', [250]);
        if ($startTls) {
            $cmd('STARTTLS', [220]);
            $conn->startTls();
            $cmd('EHLO flightdeck.local', [250]);
        }
        if ($user !== '') {
            $cmd('AUTH LOGIN', [334]);
            $cmd(base64_encode($user), [334]);
            $cmd(base64_encode($pass), [235]);
        }
        $cmd('MAIL FROM:<' . $from . '>', [250]);
        $cmd('RCPT TO:<' . $to . '>', [250, 251]);
        $cmd('DATA', [354]);
        $conn->write(self::message($to, $subject, $body, $headers, $host) . "\r\n.\r\n");
        $expect($conn->read(), [250]);
        $conn->write("QUIT\r\n");
        return true;
    }

    /** Full message text with CRLF line ends and dot-stuffing. Header values containing line breaks are dropped. */
    public static function message(string $to, string $subject, string $body, array $headers, string $host): string
    {
        $lines = [];
        foreach ($headers as $h) {
            if (is_string($h) && $h !== '' && !preg_match('/[\r\n]/', $h)) {
                $lines[] = $h;
            }
        }
        $lines[] = 'To: ' . $to;
        $lines[] = 'Subject: ' . str_replace(["\r", "\n"], ' ', $subject);
        $lines[] = 'Date: ' . gmdate('D, d M Y H:i:s') . ' +0000';
        $lines[] = 'Message-ID: <' . bin2hex(random_bytes(8)) . '@' . preg_replace('/[^a-z0-9.-]/i', '', $host) . '>';
        $text = str_replace(["\r\n", "\r"], "\n", $body);
        $text = preg_replace('/^\./m', '..', $text);
        return implode("\r\n", $lines) . "\r\n\r\n" . str_replace("\n", "\r\n", $text);
    }
}

/** Thin wrapper over a real socket. */
final class SmtpConnection
{
    private $fp;

    private function __construct($fp)
    {
        $this->fp = $fp;
    }

    public static function open(string $host, int $port, string $secure): self
    {
        $ctx = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true]]);
        $fp = @stream_socket_client(($secure === 'ssl' ? 'ssl://' : 'tcp://') . $host . ':' . $port, $errno, $err, 12, STREAM_CLIENT_CONNECT, $ctx);
        if (!$fp) {
            throw new \RuntimeException('smtp connect');
        }
        stream_set_timeout($fp, 15);
        return new self($fp);
    }

    public function read(): string
    {
        $out = '';
        while (($line = fgets($this->fp, 1024)) !== false) {
            $out .= $line;
            if (strlen($line) < 4 || $line[3] !== '-') {
                break;
            }
        }
        return $out;
    }

    public function write(string $s): void
    {
        fwrite($this->fp, $s);
    }

    public function startTls(): void
    {
        if (!stream_socket_enable_crypto($this->fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            throw new \RuntimeException('smtp tls');
        }
    }
}
