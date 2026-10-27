// Local test mailbox: accepts any login on 127.0.0.1:2525 and writes each message to .local-test/mail/<n>.eml. For trying "reply from the console"
// without sending real email. Run: node test/fake-smtp.mjs
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
const dir = path.join(import.meta.dirname, '../.local-test/mail');
fs.mkdirSync(dir, { recursive: true });
let n = Date.now();
net.createServer((sock) => {
  sock.on('error', () => {});
  let buf = ''; let data = null; let step = null;
  const say = (s) => sock.write(s + '\r\n');
  say('220 fake-smtp ready');
  sock.on('data', (chunk) => {
    buf += chunk.toString('utf8');
    for (;;) {
      if (data !== null) {
        const end = buf.indexOf('\r\n.\r\n');
        if (end < 0) return;
        data += buf.slice(0, end); buf = buf.slice(end + 5);
        fs.writeFileSync(path.join(dir, `${n++}.eml`), data.replace(/\r\n\.\./g, '\r\n.'));
        data = null; say('250 queued'); continue;
      }
      const i = buf.indexOf('\r\n'); if (i < 0) return;
      const line = buf.slice(0, i); buf = buf.slice(i + 2);
      if (step === 'user') { step = 'pass'; say('334 UGFzc3dvcmQ6'); continue; }
      if (step === 'pass') { step = null; say('235 ok'); continue; }
      if (/^EHLO/i.test(line)) say('250-fake\r\n250 AUTH LOGIN');
      else if (/^AUTH LOGIN/i.test(line)) { step = 'user'; say('334 VXNlcm5hbWU6'); }
      else if (/^DATA/i.test(line)) { data = ''; say('354 go'); }
      else if (/^QUIT/i.test(line)) { say('221 bye'); sock.end(); }
      else say('250 ok');
    }
  });
}).listen(2525, '127.0.0.1', () => console.log('fake smtp on 127.0.0.1:2525'));
