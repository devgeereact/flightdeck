(() => {
  var root = document.getElementById('packing-board');
  if (!root) return;
  var secs = [].slice.call(root.querySelectorAll('.ck-sec')),
    items = [].slice.call(root.querySelectorAll('.ck-rail-item'));
  var all = document.getElementById('packing-show-all'),
    total = document.getElementById('packing-total');
  var KEY = 'flightdeck-public-packing',
    saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch (e) {}
  var active = (location.hash || '').slice(1) || secs[0].id;
  function show(id, push) {
    if (!secs.some((s) => s.id === id)) id = secs[0].id;
    active = id;
    secs.forEach((s) => {
      s.hidden = !(all && all.checked) && s.id !== id;
    });
    items.forEach((a) => {
      var on = a.getAttribute('data-sec') === id;
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
    if (push && window.history && history.replaceState) history.replaceState(null, '', '#' + id);
  }
  function count() {
    var done = 0,
      size = 0;
    secs.forEach((s, i) => {
      var boxes = s.querySelectorAll('input[type=checkbox]'),
        n = 0;
      [].forEach.call(boxes, (b) => {
        if (b.checked) n++;
      });
      done += n;
      size += boxes.length;
      var t = n + '/' + boxes.length;
      s.querySelector('.ck-sec-count').textContent = t;
      var a = items[i];
      a.querySelector('.ck-rail-count').textContent = t;
      a.querySelector('.ck-rail-bar b').style.width =
        (boxes.length ? (n / boxes.length) * 100 : 0) + '%';
      a.classList.toggle('full', boxes.length > 0 && n === boxes.length);
    });
    if (total) total.textContent = done + ' of ' + size + ' packed';
  }
  [].forEach.call(root.querySelectorAll('input[type=checkbox]'), (b) => {
    var k = b.getAttribute('data-k');
    if (saved[k]) b.checked = true;
    b.addEventListener('change', () => {
      if (b.checked) saved[k] = 1;
      else delete saved[k];
      try {
        localStorage.setItem(KEY, JSON.stringify(saved));
      } catch (e) {}
      count();
    });
  });
  if (all)
    all.addEventListener('change', () => {
      show(active, false);
    });
  root.addEventListener('click', (e) => {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href').slice(1);
    if (!secs.some((s) => s.id === id)) return;
    e.preventDefault();
    if (all) all.checked = false;
    show(id, true);
    var top = root.getBoundingClientRect().top + window.scrollY - 16;
    if (window.scrollY > top) window.scrollTo(0, top);
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest && e.target.closest('[data-print-blank]')) {
      root.classList.add('ck-print-blank');
      window.print();
    }
  });
  window.addEventListener('afterprint', () => {
    root.classList.remove('ck-print-blank');
  });
  window.addEventListener('hashchange', () => {
    show((location.hash || '').slice(1), false);
  });
  count();
  show(active, false);
})();
