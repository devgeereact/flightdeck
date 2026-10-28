// Contact form on /contact/: posts JSON to our own API (same-site only, ADR-013). Honeypot and fill time are checked by the server.
(function () {
  var f = document.getElementById('contact-form'),
    m = document.getElementById('contact-msg'),
    t0 = Date.now();
  if (!f || !m) return;
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    m.textContent = '';
    m.classList.remove('ok');
    var d = new FormData(f);
    var body = {
      kind: d.get('kind'),
      message: d.get('message'),
      name: d.get('name'),
      email: d.get('email'),
      website: d.get('website'),
      elapsed: Date.now() - t0,
    };
    if (!f.checkValidity()) {
      m.textContent = 'Please write your message and add a valid email address.';
      return;
    }
    f.querySelector('button').disabled = true;
    fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, j: j };
        });
      })
      .then(function (x) {
        if (!x.ok) throw new Error(x.j.error || 'Your message could not be sent.');
        f.reset();
        m.classList.add('ok');
        m.textContent = 'Thank you. Your message has been sent.';
      })
      .catch(function (err) {
        m.textContent = err.message || 'Your message could not be sent. Please try again.';
      })
      .then(function () {
        f.querySelector('button').disabled = false;
      });
  });
})();
