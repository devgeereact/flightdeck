// Public website behaviour. Plain script, no dependencies; the pages work without it (the menu simply shows).
(function () {
  var doc = document.documentElement;
  doc.classList.add('js');

  // Old app links and installed apps that still open "/" go to the app, which now lives at /app/ (ADR-015).
  if (location.pathname === '/') {
    var standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    if (/^#\/(flight|checklist|saved|overview|admin|console)(\/|$)/.test(location.hash) || standalone) {
      location.replace('/app/' + location.hash);
      return;
    }
  }

  var btn = document.querySelector('.menu-btn'), nav = document.getElementById('site-nav');
  if (btn && nav) {
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('open', open);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') { btn.click(); btn.focus(); }
    });
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-print]')) window.print();
  });

  // Home page lookup: hand the flight to the app (#/flight/<number>/<date>). Signed-out visitors sign in first and land on it.
  var form = document.getElementById('lookup');
  if (form) {
    var num = document.getElementById('lookup-number'), date = document.getElementById('lookup-date'), msg = document.getElementById('lookup-msg');
    var note = msg ? msg.innerHTML : '';
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var n = (num.value || '').toUpperCase().replace(/\s+/g, '');
      var d = date.value || '';
      if (!/^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/.test(n) || n.length < 3 || n.length > 8) {
        msg.textContent = 'Enter a flight number like BA117: the airline code, then the number.';
        num.setAttribute('aria-invalid', 'true');
        num.focus();
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        msg.textContent = 'Choose the departure date.';
        date.focus();
        return;
      }
      num.removeAttribute('aria-invalid');
      msg.innerHTML = note;
      location.href = '/app/#/flight/' + n + '/' + d;
    });
  }

  // Ad slots exist only when the owner has opened every condition of the ads gate (server config).
  var slots = document.querySelectorAll('ins.adsbygoogle');
  for (var i = 0; i < slots.length; i++) (window.adsbygoogle = window.adsbygoogle || []).push({});
})();
