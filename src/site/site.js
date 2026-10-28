// Public website behaviour. Plain script, no dependencies; the pages work without it (the menu simply shows).
(function () {
  var doc = document.documentElement;
  doc.classList.add('js');

  // Old app links and installed apps that still open "/" go to the app, which now lives at /app/ (ADR-015).
  if (location.pathname === '/') {
    var standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    if (
      /^#\/(flight|checklist|saved|overview|admin|console)(\/|$)/.test(location.hash) ||
      standalone
    ) {
      location.replace('/app/' + location.hash);
      return;
    }
  }

  var btn = document.querySelector('.menu-btn'),
    nav = document.getElementById('site-nav');
  if (btn && nav) {
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('open', open);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') {
        btn.click();
        btn.focus();
      }
    });
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-print]')) window.print();
  });

  // A link to one answer (/help/#faq-account) opens it.
  var openTarget = function () {
    var el =
      location.hash.length > 1
        ? document.getElementById(decodeURIComponent(location.hash.slice(1)))
        : null;
    if (el && el.tagName === 'DETAILS') el.open = true;
  };
  openTarget();
  window.addEventListener('hashchange', openTarget);

  // Home page lookup: hand the flight to the app (#/flight/<number>/<date>). Signed-out visitors sign in first and land on it.
  var form = document.getElementById('lookup');
  if (form) {
    var num = document.getElementById('lookup-number'),
      date = document.getElementById('lookup-date'),
      msg = document.getElementById('lookup-msg');
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

  // Motion is for visitors who have not asked for less of it. Smooth scrolling (Lenis, the public pages only) and the
  // reveal of each home section both stand down under prefers-reduced-motion; the page is complete without either.
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  var reveals = document.querySelectorAll('[data-reveal]');
  var showAll = function () {
    for (var r = 0; r < reveals.length; r++) reveals[r].classList.add('in');
  };
  if (reveals.length) {
    if (!('IntersectionObserver' in window) || (calm && calm.matches)) showAll();
    else {
      var seen = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (en) {
            if (en.isIntersecting) {
              en.target.classList.add('in');
              seen.unobserve(en.target);
            }
          });
        },
        { rootMargin: '0px 0px -12% 0px' },
      );
      for (var r = 0; r < reveals.length; r++) seen.observe(reveals[r]);
      setTimeout(showAll, 4000); // never leave content hidden if the observer is slow
    }
  }
  if (window.Lenis && !(calm && calm.matches)) {
    var lenis = new window.Lenis({ lerp: 0.11, anchors: true });
    var tick = function (t) {
      lenis.raf(t);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    if (calm && calm.addEventListener)
      calm.addEventListener('change', function () {
        if (calm.matches) {
          lenis.destroy();
          showAll();
        }
      });
    // The mobile menu is a stacked panel; do not let the page scroll beneath it while it is open.
    if (btn)
      btn.addEventListener('click', function () {
        if (btn.getAttribute('aria-expanded') === 'true') lenis.stop();
        else lenis.start();
      });
  }

  // Ad slots exist only when the owner has opened every condition of the ads gate (server config).
  var slots = document.querySelectorAll('ins.adsbygoogle');
  for (var i = 0; i < slots.length; i++) (window.adsbygoogle = window.adsbygoogle || []).push({});
})();
