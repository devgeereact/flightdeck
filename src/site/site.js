// Public website behaviour. Plain script, no dependencies of its own; every page is complete without it (the menu stays open
// under the bar, topic pills and tabs are ordinary links, answers are native <details>). GSAP (home only, bundled by
// build-public.mjs) and Lenis add motion for visitors who have not asked for less of it.
(() => {
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

  var $ = (s, r) => (r || document).querySelector(s);
  var $$ = (s, r) => [].slice.call((r || document).querySelectorAll(s));

  // Signed in already? The public pages are cached HTML, so the header is fixed at "Sign in". Clerk's __client_uat cookie
  // (a timestamp, 0 when signed out) is the truth when present; otherwise the app's own marker (localStorage fd-signed-in,
  // written whenever its Clerk state settles). Signed-in visitors see "My flights" instead of sign-in prompts.
  var signedIn = (() => {
    var vals = [];
    document.cookie.replace(/(?:^|;\s*)__client_uat(?:_[A-Za-z0-9-]+)?=(\d+)/g, (m, v) => {
      vals.push(Number(v));
      return m;
    });
    if (vals.length) return vals.some((v) => v > 0);
    try {
      return localStorage.getItem('fd-signed-in') === '1';
    } catch (e) {
      return false;
    }
  })();
  if (signedIn) {
    doc.classList.add('signed-in');
    $$('[data-auth="out"]').forEach((e) => {
      e.hidden = true;
    });
    $$('[data-auth="in"]').forEach((e) => {
      e.hidden = false;
    });
  }

  // Sticky header: over the photo band it stays as it is; once the visitor scrolls past it, it becomes a frosted white bar
  // with dark text (.stuck) so it can be read on any background. Without JavaScript it simply scrolls with the page.
  var topEl = $('.site-top');
  if (topEl) {
    var stick = () => topEl.classList.toggle('stuck', window.scrollY > 80);
    window.addEventListener('scroll', stick, { passive: true });
    stick();
  }
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  var motionOk = () => !(calm && calm.matches);
  var store = {
    get: (k, d) => {
      try {
        var v = JSON.parse(localStorage.getItem(k));
        return v == null ? d : v;
      } catch (e) {
        return d;
      }
    },
    set: (k, v) => {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (e) {
        /* not remembered */
      }
    },
  };

  // A short message at the bottom of the screen, with an optional action (Undo).
  function toast(text, action, onAction) {
    var host = $('.toasts');
    if (!host) {
      host = document.createElement('div');
      host.className = 'toasts';
      host.setAttribute('role', 'status');
      host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }
    var t = document.createElement('div');
    t.className = 'toast';
    var s = document.createElement('span');
    s.textContent = text;
    t.appendChild(s);
    if (action) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = action;
      b.addEventListener('click', () => {
        onAction();
        t.remove();
      });
      t.appendChild(b);
    }
    host.appendChild(t);
    setTimeout(() => t.remove(), 4200);
  }

  // ---------------------------------------------------------------- menu (a sheet on narrow screens)
  var btn = $('.menu-btn'),
    nav = document.getElementById('site-nav'),
    lenis = null;
  function setMenu(open) {
    if (!btn || !nav) return;
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    nav.classList.toggle('open', open);
    if (lenis) open ? lenis.stop() : lenis.start();
    if (open) {
      var c = $('[data-menu-close]', nav);
      if (c) c.focus();
    } else btn.focus();
  }
  if (btn && nav) {
    btn.addEventListener('click', () => setMenu(btn.getAttribute('aria-expanded') !== 'true'));
    nav.addEventListener('click', (e) => {
      if (
        e.target.closest('[data-menu-close]') ||
        (e.target.closest('a') && nav.classList.contains('open'))
      )
        setMenu(false);
    });
    document.addEventListener('click', (e) => {
      if (nav.classList.contains('open') && !nav.contains(e.target) && !btn.contains(e.target))
        setMenu(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') setMenu(false);
    });
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest && e.target.closest('[data-print]')) window.print();
  });

  // A link to one answer (/help/#faq-account) opens it.
  var openTarget = () => {
    var el =
      location.hash.length > 1
        ? document.getElementById(decodeURIComponent(location.hash.slice(1)))
        : null;
    if (el && el.tagName === 'DETAILS') el.open = true;
  };
  openTarget();
  window.addEventListener('hashchange', openTarget);

  // ---------------------------------------------------------------- dialogs (destinations, contact, photo credits)
  document.addEventListener('click', (e) => {
    var opener = e.target.closest && e.target.closest('[data-dialog]');
    if (opener) {
      var d = document.getElementById(opener.getAttribute('data-dialog'));
      if (d && typeof d.showModal === 'function') {
        e.preventDefault();
        d.showModal();
        if (window.gsap && motionOk())
          window.gsap.from(d, {
            y: 18,
            opacity: 0,
            duration: 0.35,
            ease: 'power3.out',
            clearProps: 'all',
          });
      }
      return;
    }
    var closer = e.target.closest && e.target.closest('[data-close]');
    if (closer && closer.closest('dialog')) {
      closer.closest('dialog').close();
      return;
    }
    if (e.target.tagName === 'DIALOG') e.target.close(); // a click on the backdrop
  });

  // ---------------------------------------------------------------- tabs: search card, topic pills, packing sections
  // Without JavaScript each tab is a link (to the panel, the guide index or the full packing list). Here they become real tabs.
  $$('[data-tabs]').forEach((list) => {
    var tabs = $$('[data-tab]', list);
    if (!tabs.length) return;
    list.setAttribute('role', 'tablist');
    var panelOf = (t) =>
      document.querySelector('[data-panel="' + t.getAttribute('data-tab') + '"]');
    var current =
      tabs.filter(
        (t) => t.classList.contains('on') || t.getAttribute('aria-current') === 'true',
      )[0] || tabs[0];
    function select(t, focus) {
      tabs.forEach((x) => {
        var on = x === t,
          p = panelOf(x);
        x.setAttribute('aria-selected', String(on));
        x.removeAttribute('aria-current');
        x.classList.toggle('on', on);
        x.tabIndex = on ? 0 : -1;
        if (p) p.hidden = !on;
      });
      if (focus) t.focus();
      var panel = panelOf(t);
      list.dispatchEvent(new CustomEvent('fd-tab', { detail: { tab: t, panel: panel } }));
      if (window.gsap && motionOk() && panel && focus !== null)
        window.gsap.from(panel.children.length > 1 ? panel.children : panel, {
          y: 14,
          opacity: 0,
          stagger: 0.05,
          duration: 0.4,
          ease: 'power3.out',
          clearProps: 'all',
        });
    }
    tabs.forEach((t, i) => {
      var p = panelOf(t);
      if (!p) return;
      t.setAttribute('role', 'tab');
      if (!t.id) t.id = 'tab-' + t.getAttribute('data-tab');
      t.setAttribute('aria-controls', p.id || '');
      p.setAttribute('role', 'tabpanel');
      p.setAttribute('aria-labelledby', t.id);
      t.addEventListener('click', (e) => {
        e.preventDefault();
        select(t, false);
      });
      t.addEventListener('keydown', (e) => {
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) < 0) return;
        e.preventDefault();
        var n =
          e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? tabs.length - 1
              : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        select(tabs[n], true);
      });
    });
    select(current, null);
  });

  // ---------------------------------------------------------------- home: flight lookup
  // Hands the flight to the app (#/flight/<number>/<date>). Signed-out visitors sign in first and land on it.
  var form = document.getElementById('lookup');
  var pad = (n) => (n < 10 ? '0' : '') + n;
  var isoLocal = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  var noon = new Date();
  noon.setHours(12, 0, 0, 0);
  var addDays = (n) => {
    var d = new Date(noon);
    d.setDate(d.getDate() + n);
    return d;
  };
  if (form) {
    var num = document.getElementById('lookup-number'),
      date = document.getElementById('lookup-date'),
      err = document.getElementById('fnErr'),
      field = document.getElementById('fnField'),
      note = document.getElementById('dateNote'),
      chips = $$('.daychips button', form);
    // The server rendered the dates for UTC; rebuild them for the visitor's own calendar day.
    if (date && date.tagName === 'SELECT') {
      date.textContent = '';
      for (var i = -1; i <= 13; i++) {
        var d = addDays(i),
          o = document.createElement('option');
        o.value = isoLocal(d);
        o.textContent =
          d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) +
          (i === 0 ? ' · today' : i === 1 ? ' · tomorrow' : i === -1 ? ' · yesterday' : '');
        if (i === 0) o.selected = true;
        date.appendChild(o);
      }
    }
    var syncDate = () => {
      var off = date.selectedIndex - 1;
      chips.forEach((b) =>
        b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-off')) === off)),
      );
      if (note)
        note.textContent =
          off <= 3
            ? 'Full schedule, gate and belt for departures from yesterday to three days ahead.'
            : 'That date is more than three days ahead, so you will see the usual route. Times appear closer to departure.';
    };
    chips.forEach((b) =>
      b.addEventListener('click', () => {
        date.selectedIndex = Number(b.getAttribute('data-off')) + 1;
        syncDate();
      }),
    );
    date.addEventListener('change', syncDate);
    var validate = () => {
      var v = (num.value || '').toUpperCase().replace(/\s+/g, '');
      var msg = '';
      if (!v) msg = 'Enter the flight number from your booking, such as BA117.';
      else if (!/^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/.test(v) || v.length < 3 || v.length > 8)
        msg =
          'That does not look like a flight number. Use the airline code and number, such as BA117.';
      err.hidden = !msg;
      err.textContent = msg;
      field.classList.toggle('invalid', !!msg);
      if (msg) num.setAttribute('aria-invalid', 'true');
      else num.removeAttribute('aria-invalid');
      return msg ? '' : v;
    };
    num.addEventListener('input', () => {
      var at = num.selectionStart;
      num.value = num.value.toUpperCase().replace(/\s+/g, '');
      if (at != null) num.setSelectionRange(at, at);
      if (!err.hidden) validate();
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      var n = validate();
      var d = date.value || '';
      if (!n) {
        num.focus();
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        date.focus();
        return;
      }
      location.href = '/app/#/flight/' + n + '/' + d;
    });
  }
  var leave = document.getElementById('leave');
  if (leave && !leave.value) leave.value = isoLocal(addDays(7));

  // ---------------------------------------------------------------- home: destination favourites (kept on this device)
  var favs = store.get('fd.favs', []);
  if (!Array.isArray(favs)) favs = [];
  $$('[data-fav]').forEach((f) => {
    f.hidden = false;
    f.setAttribute('aria-pressed', String(favs.indexOf(f.getAttribute('data-fav')) >= 0));
    f.addEventListener('click', () => {
      var c = f.getAttribute('data-fav'),
        on = favs.indexOf(c) < 0;
      favs = on ? favs.concat(c) : favs.filter((x) => x !== c);
      store.set('fd.favs', favs);
      f.setAttribute('aria-pressed', String(on));
      if (window.gsap && motionOk())
        window.gsap.fromTo(f, { scale: 0.8 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' });
      var city = (f.getAttribute('aria-label') || '').replace(
        /^Save | to favourites on this device$/g,
        '',
      );
      toast(on ? city + ' saved to favourites on this device' : 'Removed from favourites');
    });
  });

  // ---------------------------------------------------------------- home: packing list teaser
  // Same storage key and item keys as /travel-checklist/, so ticks made here appear on the full list and the other way round.
  var pack = document.getElementById('pack-preview');
  if (pack) {
    var KEY = 'flightdeck-public-packing';
    var saved = store.get(KEY, {});
    if (!saved || typeof saved !== 'object') saved = {};
    var panels = $$('.pk-panel', pack),
      boxes = $$('input[data-k]', pack),
      total = boxes.length,
      cur = 0;
    var titleOf = (p) => p.getAttribute('data-title') || '';
    var next = document.getElementById('nextSec'),
      clear = document.getElementById('clearSec');
    boxes.forEach((b) => {
      if (saved[b.getAttribute('data-k')]) b.checked = true;
    });
    var progress = () => {
      var n = boxes.filter((b) => b.checked).length,
        pct = total ? Math.round((n / total) * 100) : 0;
      $('#ringFg').style.strokeDashoffset = String(314.16 * (1 - (total ? n / total : 0)));
      $('#ringPct').textContent = pct + '%';
      $('#packedCount').textContent = n + ' of ' + total + ' packed';
      var todo = panels.filter((p) => $$('input', p).some((b) => !b.checked))[0];
      $('#packedNext').textContent = todo
        ? 'Next up: ' + titleOf(todo) + '.'
        : 'Everything is packed. Have a good trip.';
      panels.forEach((p) => {
        var all = $$('input', p),
          done = all.filter((b) => b.checked).length,
          c = pack.querySelector('[data-c="' + p.id.slice(3) + '"]');
        if (c) c.textContent = done + '/' + all.length;
      });
      var p = panels[cur],
        all = $$('input', p);
      $('#secCount').textContent =
        all.filter((b) => b.checked).length + ' of ' + all.length + ' in ' + titleOf(p);
    };
    var render = () => {
      if (next) {
        next.textContent = '';
        next.appendChild(
          document.createTextNode(
            cur < panels.length - 1 ? 'Next: ' + titleOf(panels[cur + 1]) : 'Back to the start',
          ),
        );
      }
      progress();
    };
    pack.addEventListener('change', (e) => {
      var k = e.target.getAttribute && e.target.getAttribute('data-k');
      if (!k) return;
      if (e.target.checked) saved[k] = 1;
      else delete saved[k];
      store.set(KEY, saved);
      progress();
    });
    var tabList = $('[data-tabs="pack"]', pack);
    var tabs = tabList ? $$('[data-tab]', tabList) : [];
    if (tabList)
      tabList.addEventListener('fd-tab', (e) => {
        cur = Math.max(0, panels.indexOf(e.detail.panel));
        render();
      });
    if (next)
      next.addEventListener('click', (e) => {
        e.preventDefault();
        var t = tabs[(cur + 1) % tabs.length];
        if (!t) return;
        t.click();
        t.scrollIntoView({
          block: 'nearest',
          inline: 'center',
          behavior: motionOk() ? 'smooth' : 'auto',
        });
      });
    if (clear) {
      clear.hidden = false;
      clear.addEventListener('click', () => {
        var before = JSON.parse(JSON.stringify(saved));
        $$('input', panels[cur]).forEach((b) => {
          b.checked = false;
          delete saved[b.getAttribute('data-k')];
        });
        store.set(KEY, saved);
        progress();
        toast('Unticked ' + titleOf(panels[cur]), 'Undo', () => {
          saved = before;
          store.set(KEY, saved);
          boxes.forEach((b) => {
            b.checked = !!saved[b.getAttribute('data-k')];
          });
          progress();
        });
      });
    }
    render();
  }

  // ---------------------------------------------------------------- accordion: native <details>, with an eased height change
  $$('details > .acc-btn').forEach((sum) => {
    var det = sum.parentElement,
      panel = $('.acc-panel', det);
    sum.addEventListener('click', (e) => {
      if (!panel || !panel.animate || !motionOk()) return;
      e.preventDefault();
      if (det.open) {
        var a = panel.animate([{ height: panel.offsetHeight + 'px' }, { height: '0px' }], {
          duration: 250,
          easing: 'cubic-bezier(.4,0,1,1)',
        });
        a.onfinish = () => {
          det.open = false;
        };
      } else {
        det.open = true;
        panel.animate([{ height: '0px' }, { height: panel.offsetHeight + 'px' }], {
          duration: 350,
          easing: 'cubic-bezier(.22,1,.36,1)',
        });
      }
    });
  });

  // ---------------------------------------------------------------- smooth scrolling and the home page's motion
  if (window.Lenis && motionOk()) {
    lenis = new window.Lenis({ lerp: 0.11, anchors: true });
    var tick = (t) => {
      lenis.raf(t);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    if (calm && calm.addEventListener)
      calm.addEventListener('change', () => {
        if (calm.matches && lenis) lenis.destroy();
      });
  }

  var gsap = window.gsap;
  if (gsap && document.body.classList.contains('is-home')) {
    var plugins = [
      window.ScrollTrigger,
      window.SplitText,
      window.MotionPathPlugin,
      window.DrawSVGPlugin,
    ].filter(Boolean);
    gsap.registerPlugin.apply(gsap, plugins);
    if (lenis && window.ScrollTrigger) lenis.on('scroll', window.ScrollTrigger.update);
    // Everything is readable before any of this runs, and none of it runs for visitors who prefer reduced motion.
    // DrawSVG draws with a dash pattern of its own; once a line is drawn, hand it back to the stylesheet (dotted trails).
    var undash = function () {
      this.targets().forEach((t) => {
        t.style.strokeDasharray = '';
        t.style.strokeDashoffset = '';
      });
    };
    gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
      var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('.hero-photo img', { scale: 1.08, duration: 1.8, ease: 'power2.out' }, 0);
      if (window.SplitText && document.fonts)
        document.fonts.ready.then(() => {
          window.SplitText.create('#heroTitle', {
            type: 'lines',
            mask: 'lines',
            autoSplit: true,
            onSplit: (self) =>
              gsap.from(self.lines, {
                yPercent: 105,
                duration: 0.9,
                stagger: 0.08,
                ease: 'power4.out',
                delay: 0.1,
              }),
          });
        });
      tl.from(
        '.hero .kicker, .hero-lede',
        { y: 14, opacity: 0, duration: 0.7, stagger: 0.1 },
        0.25,
      ).from('.search-wrap', { y: 36, opacity: 0, duration: 0.8 }, 0.45);
      if (window.DrawSVGPlugin)
        tl.fromTo(
          '#heroPath',
          { drawSVG: '0%' },
          {
            drawSVG: '100%',
            duration: 1.6,
            ease: 'power2.inOut',
            onComplete: undash, // back to the dotted trail once drawn
          },
          0.5,
        );
      if (window.MotionPathPlugin)
        tl.fromTo('#heroPlane', { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0.5).to(
          '#heroPlane',
          {
            motionPath: {
              path: '#heroPath',
              align: '#heroPath',
              alignOrigin: [0.5, 0.5],
              autoRotate: true,
            },
            duration: 1.6,
            ease: 'power2.inOut',
          },
          0.5,
        );
      if (!window.ScrollTrigger) return;
      gsap.to('.hero-photo', {
        yPercent: 6,
        ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
      });
      gsap.utils.toArray('.dest img, .how-photo img').forEach((img) => {
        gsap.fromTo(
          img,
          { yPercent: -4 },
          {
            yPercent: 4,
            ease: 'none',
            scrollTrigger: {
              trigger: img.parentElement,
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
            },
          },
        );
      });
      gsap.fromTo(
        '.steps .prog',
        { scaleY: 0.08 },
        {
          scaleY: 1,
          ease: 'none',
          scrollTrigger: { trigger: '.steps ol', start: 'top 75%', end: 'bottom 55%', scrub: true },
        },
      );
      if (window.DrawSVGPlugin)
        gsap.fromTo(
          '.closing .close-art .arc',
          { drawSVG: '0%' },
          {
            drawSVG: '100%',
            duration: 1.4,
            stagger: 0.15,
            ease: 'power2.inOut',
            onComplete: undash, // the dotted arcs get their dots back once drawn
            scrollTrigger: { trigger: '.closing', start: 'top 80%', once: true },
          },
        );
      gsap.fromTo(
        '.fresh .rings circle',
        { scale: 0.6, transformOrigin: '50% 50%' },
        {
          scale: 1,
          duration: 1.2,
          stagger: 0.08,
          ease: 'power3.out',
          scrollTrigger: { trigger: '.fresh', start: 'top 80%', once: true },
        },
      );
    });
  }

  // Ad slots exist only when the owner has opened every condition of the ads gate (server config).
  var slots = document.querySelectorAll('ins.adsbygoogle');
  for (var s = 0; s < slots.length; s++) (window.adsbygoogle = window.adsbygoogle || []).push({});
})();
