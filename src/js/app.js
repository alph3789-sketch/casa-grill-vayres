/* Casa Grill Vayres — site vitrine + commande WhatsApp. JS vanilla, sans dépendance. */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  var DAY_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var CART_KEY = 'cg-cart-v1';
  var BANNER_KEY = 'cg-banner-closed';
  var THEME_KEY = 'cg-theme';

  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  var euro = function (n) { return n.toFixed(2).replace('.', ',') + '\u00a0€'; };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };

  /* ------------------------------------------------------------------
   * Heure de Paris. On travaille en « heure murale » : un objet Date
   * dont les champs UTC valent l'heure affichée à Paris.
   * Test : ajoutez ?simnow=2026-11-16T15:30 à l'URL.
   * ------------------------------------------------------------------ */
  var TZ = 'Europe/Paris';
  var simBase = null, simStart = 0;
  (function () {
    var m = /[?&]simnow=([0-9T:\-]+)/.exec(location.search);
    if (m) { var d = parseWall(decodeURIComponent(m[1])); if (d) { simBase = d.getTime(); simStart = Date.now(); } }
  })();
  var fmtParts;
  function parisNow() {
    if (simBase !== null) return new Date(simBase + (Date.now() - simStart));
    try {
      fmtParts = fmtParts || new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
      var p = {}; fmtParts.formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
      return new Date(Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second));
    } catch (e) {
      var n = new Date(); return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate(), n.getHours(), n.getMinutes(), n.getSeconds()));
    }
  }
  function parseWall(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(s || '');
    return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0))) : null;
  }
  var toMin = function (hhmm) { var a = hhmm.split(':'); return +a[0] * 60 + +a[1]; };
  var dayStart = function (d) { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); };
  var addDays = function (d, n) { return new Date(d.getTime() + n * 864e5); };
  var ymd = function (d) { return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); };
  var minOfDay = function (d) { return d.getUTCHours() * 60 + d.getUTCMinutes(); };
  var hLabel = function (min) { var h = Math.floor(min / 60) % 24, m = min % 60; return h + 'h' + (m ? pad(m) : ''); };
  var dLabel = function (d) { return DAY_FR[d.getUTCDay()] + ' ' + pad(d.getUTCDate()) + '/' + pad(d.getUTCMonth() + 1); };

  var DATA = null, CONF = null;

  function closureFor(day) {
    var k = ymd(day), list = (CONF && CONF.closures) || [];
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.date === k || (c.from && c.to && k >= c.from && k <= c.to)) return c;
    }
    return null;
  }
  // Intervalles d'ouverture d'un jour, en minutes [début, fin].
  function intervals(day) {
    if (closureFor(day)) return [];
    var list = (DATA.hours[DAYS[day.getUTCDay()]] || []).map(function (r) { return [toMin(r[0]), toMin(r[1])]; });
    var b = CONF && CONF.banner;
    if (b && b.blockOrdersBeforeStart && b.startDate) {
      var st = parseWall(b.startDate), sd = dayStart(st);
      if (day < sd) return [];
      if (+day === +sd) list = list.map(function (r) { return [Math.max(r[0], minOfDay(st)), r[1]]; }).filter(function (r) { return r[0] < r[1]; });
    }
    return list;
  }
  function getStatus(now) {
    var today = dayStart(now), m = minOfDay(now), iv = intervals(today);
    for (var i = 0; i < iv.length; i++) {
      if (m >= iv[i][0] && m < iv[i][1]) return { open: true, closesAt: iv[i][1], left: iv[i][1] - m };
    }
    for (var k = 0; k < 15; k++) {
      var d = addDays(today, k), list = intervals(d);
      for (var j = 0; j < list.length; j++) {
        if (k > 0 || list[j][0] > m) return { open: false, next: { day: d, k: k, min: list[j][0] }, closure: closureFor(today) };
      }
    }
    return { open: false, next: null, closure: closureFor(today) };
  }
  function statusText(st) {
    if (st.open) {
      if (st.left <= 30) return { cls: 'is-soon', txt: 'Ferme bientôt · ' + hLabel(st.closesAt) };
      return { cls: 'is-open', txt: 'Ouvert · jusqu\u2019à ' + hLabel(st.closesAt) };
    }
    var pre = st.closure ? 'Fermé exceptionnellement' : 'Fermé';
    if (!st.next) return { cls: 'is-closed', txt: pre };
    var n = st.next, when = n.k === 0 ? '' : n.k === 1 ? 'demain ' : DAY_FR[n.day.getUTCDay()] + ' ';
    return { cls: 'is-closed', txt: pre + ' · ouvre ' + when + 'à ' + hLabel(n.min) };
  }

  // Créneaux de retrait : toutes les 15 min, ≥ 20 min dans le futur.
  function getSlots(now) {
    var R = DATA.restaurant, step = R.slotStepMinutes || 15, lead = R.minLeadMinutes || 20;
    var st = getStatus(now), out = { asap: st.open, day: null, k: 0, slots: [] };
    var earliest = new Date(now.getTime() + lead * 60000);
    var today = dayStart(now);
    for (var k = 0; k < 15 && !out.slots.length; k++) {
      var d = addDays(today, k), iv = intervals(d);
      iv.forEach(function (r) {
        for (var t = r[0] + step; t <= r[1] - step; t += step) {
          var at = new Date(d.getTime() + t * 60000);
          if (at >= earliest) out.slots.push({ at: at, min: t });
        }
      });
      if (out.slots.length) { out.day = d; out.k = k; }
    }
    return out;
  }
  function isStudentTime(at) {
    var dow = at.getUTCDay(), m = minOfDay(at);
    return dow >= 1 && dow <= 5 && m >= 660 && m < 900;
  }

  /* ------------------------------------------------------------------
   * Chargement des données
   * ------------------------------------------------------------------ */
  function getJSON(u) { return fetch(u, { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error(u); return r.json(); }); }

  function start(menu, conf) {
    DATA = menu; CONF = conf || {};
    renderMenu(); initTabs(); renderLinks(); initBanner(); initAnalytics();
    loadCart(); renderCart(); tick(); setInterval(tick, 1000);
  }
  function failed(e) {
    console.warn(e);
    $('#menu').insertAdjacentHTML('beforeend', '<p class="notice">La carte n\u2019a pas pu être chargée. Appelez-nous au <a href="tel:+33754762724">07 54 76 27 24</a>.</p>');
  }


  /* ------------------------------------------------------------------
   * Statut + horaires + compte à rebours (mis à jour chaque seconde)
   * ------------------------------------------------------------------ */
  var lastMinute = -1;
  function tick() {
    var now = parisNow();
    updateCountdown(now);
    var mk = Math.floor(now.getTime() / 60000);
    if (mk === lastMinute) return;
    lastMinute = mk;
    var s = statusText(getStatus(now)), el = $('#status');
    el.className = 'status ' + s.cls;
    $('.status__text', el).textContent = s.txt;
    var key = DAYS[now.getUTCDay()];
    $$('#hours-table tr').forEach(function (tr) {
      var on = tr.dataset.day === key;
      tr.classList.toggle('is-today', on);
      if (on) tr.setAttribute('aria-current', 'date'); else tr.removeAttribute('aria-current');
    });
    var upcoming = [];
    for (var k = 0; k < 21; k++) { var d = addDays(dayStart(now), k), c = closureFor(d); if (c) upcoming.push(dLabel(d) + (c.label ? ' (' + c.label + ')' : '')); }
    var cl = $('#closures');
    cl.hidden = !upcoming.length;
    if (upcoming.length) cl.textContent = 'Fermeture exceptionnelle : ' + upcoming.slice(0, 4).join(', ') + (upcoming.length > 4 ? '…' : '');
    if (!cartSheet.open) refreshSlots();
    updateBannerVisibility(now);
  }

  /* ------------------------------------------------------------------
   * Bandeau « Spéciale ouverture »
   * ------------------------------------------------------------------ */
  var bannerReady = false;
  function bannerActive(now) {
    var b = CONF.banner;
    if (!b || !b.enabled || !(b.messages || []).length) return false;
    var from = parseWall(b.announceFrom || b.startDate), to = parseWall(b.endDate);
    if (from && now < from) return false;
    if (to && now > to) return false;
    return true;
  }
  function initBanner() {
    var b = CONF.banner; if (!b) return;
    var msgs = b.messages || [];
    var group = function () {
      var html = '';
      for (var r = 0; r < 2; r++) msgs.forEach(function (m) { html += '<span class="marquee__item">' + esc(m) + '</span><span class="marquee__sep">✦</span>'; });
      return '<div class="marquee__group">' + html + '</div>';
    };
    var mq = $('#marquee'), track = $('#marquee-track');
    $('#marquee-sr').textContent = msgs.join(' • ');
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
    var build = function () {
      if (reduce && reduce.matches) {
        mq.classList.add('is-static');
        track.innerHTML = '<span class="marquee__item">' + msgs.map(esc).join(' <span class="marquee__sep">✦</span> ') + '</span>';
      } else {
        mq.classList.remove('is-static');
        track.innerHTML = group() + group();
        requestAnimationFrame(function () {
          var w = track.firstChild.getBoundingClientRect().width;
          track.style.setProperty('--marquee-dur', Math.max(12, w / 55) + 's');
        });
      }
    };
    build();
    if (reduce && reduce.addEventListener) reduce.addEventListener('change', build);
    // Pause au toucher (le survol est géré en CSS).
    mq.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse' && !e.target.closest('.marquee__close')) mq.classList.toggle('is-paused'); });
    $('#marquee-close').addEventListener('click', function () { store.set(BANNER_KEY, String(Date.now())); mq.hidden = true; });
    $('#hero-badge').textContent = b.heroBadge || 'Nouveau à Vayres';
    $('#hero-news-msg').textContent = msgs[0];
    $('#countdown-label').textContent = b.countdownLabel || 'Grande ouverture dans';
    bannerReady = true;
    updateBannerVisibility(parisNow());
  }
  function updateBannerVisibility(now) {
    if (!bannerReady) return;
    var active = bannerActive(now);
    var closedAt = +store.get(BANNER_KEY) || 0;
    $('#marquee').hidden = !active || (Date.now() - closedAt < 864e5);
    $('#hero-news').hidden = !active;
  }
  function updateCountdown(now) {
    var cd = $('#countdown'), b = CONF && CONF.banner;
    var st = b && b.startDate && parseWall(b.startDate);
    var diff = st ? st - now : 0;
    if (!st || diff <= 0 || !bannerActive(now)) { cd.hidden = true; return; }
    cd.hidden = false;
    var s = Math.floor(diff / 1000);
    $('#cd-d').textContent = Math.floor(s / 86400);
    $('#cd-h').textContent = pad(Math.floor(s % 86400 / 3600));
    $('#cd-m').textContent = pad(Math.floor(s % 3600 / 60));
    $('#cd-s').textContent = pad(s % 60);
  }

  /* ------------------------------------------------------------------
   * Carte interactive
   * ------------------------------------------------------------------ */
  var ITEMS = {};
  function pic(name, w, h, cls, sizes) {
    var sm = 'img/' + name + '-sm', lg = 'img/' + name;
    var set = sizes ? { avif: sm + '.avif 320w, ' + lg + '.avif 640w', webp: sm + '.webp 320w, ' + lg + '.webp 640w' } : { avif: sm + '.avif', webp: sm + '.webp' };
    var sz = sizes ? ' sizes="' + sizes + '"' : '';
    return '<picture class="' + cls + '"><source type="image/avif" srcset="' + set.avif + '"' + sz + '><img src="' + sm + '.webp" srcset="' + set.webp + '"' + sz + ' width="' + w + '" height="' + h + '" alt="" loading="lazy" decoding="async"></picture>';
  }
  function renderMenu() {
    var html = '';
    DATA.categories.forEach(function (cat) {
      html += '<section class="cat" id="cat-' + cat.id + '" aria-labelledby="h-' + cat.id + '"><h3 class="cat__title" id="h-' + cat.id + '">' + esc(cat.name) + '</h3>';
      if (cat.note) html += '<p class="cat__note">' + esc(cat.note) + '</p>';
      if (cat.banner) html += pic(cat.banner, 640, cat.banner === 'boissons' ? 239 : 281, 'cat__banner cat__banner--' + cat.banner, '(min-width: 1100px) 1068px, calc(100vw - 32px)');
      html += '<ul class="items">';
      cat.items.forEach(function (it) {
        ITEMS[it.id] = it; it.cat = cat.id;
        html += '<li class="item' + (it.img ? '' : ' item--noimg') + '">';
        if (it.img) html += pic(it.img, 104, 78, 'item__img');
        html += '<div class="item__body"><h4 class="item__name">' + esc(it.name) + '</h4>' + (it.desc ? '<p class="item__desc">' + esc(it.desc) + '</p>' : '') + '</div><div class="item__acts">';
        it.variants.forEach(function (v) {
          var unique = v.id === 'unique';
          html += '<button type="button" class="add' + (v.id === 'menu' ? ' add--menu' : '') + '" data-item="' + it.id + '" data-variant="' + v.id + '">' +
            '<span class="sr-only">' + (unique ? esc(v.label) + ' ' + esc(it.name) : 'Ajouter ' + esc(it.name)) + ' </span><span class="add__label"' + (unique ? ' aria-hidden="true"' : '') + '>' + esc(v.label) + '</span><span class="add__price">' + euro(v.price) + '</span><span class="add__plus" aria-hidden="true">+</span></button>';
        });
        html += '</div></li>';
      });
      html += '</ul></section>';
    });
    $('#menu').insertAdjacentHTML('beforeend', html);
    $('#menu').addEventListener('click', function (e) {
      var b = e.target.closest('.add'); if (!b) return;
      var it = ITEMS[b.dataset.item], v = it.variants.filter(function (x) { return x.id === b.dataset.variant; })[0];
      if (v.choices && v.choices.length) openChoice(it, v, b);
      else { addLine(it, v, []); flash(b); }
    });
  }
  function flash(b) {
    b.classList.add('is-added');
    setTimeout(function () { b.classList.remove('is-added'); }, 700);
  }

  // Onglets collants : fondu sur les bords + onglet actif recentré.
  function initTabs() {
    var sc = $('#tabs-scroller');
    sc.innerHTML = DATA.categories.map(function (c) { return '<a class="tab" href="#cat-' + c.id + '" data-cat="' + c.id + '">' + esc(c.name) + '</a>'; }).join('');
    var fades = function () {
      sc.classList.toggle('at-start', sc.scrollLeft <= 2);
      sc.classList.toggle('at-end', sc.scrollLeft + sc.clientWidth >= sc.scrollWidth - 2);
    };
    sc.addEventListener('scroll', fades, { passive: true });
    window.addEventListener('resize', fades);
    fades();
    var current = null;
    var setActive = function (id) {
      if (id === current) return; current = id;
      $$('.tab', sc).forEach(function (t) {
        var on = t.dataset.cat === id;
        if (on) {
          t.setAttribute('aria-current', 'true');
          var left = t.offsetLeft - (sc.clientWidth - t.offsetWidth) / 2;
          sc.scrollTo({ left: Math.max(0, left), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        } else t.removeAttribute('aria-current');
      });
    };
    var secs = DATA.categories.map(function (c) { return document.getElementById('cat-' + c.id); });
    var onScroll = function () {
      var line = $('.site-header').offsetHeight + $('#tabs').offsetHeight + 24, id = DATA.categories[0].id;
      secs.forEach(function (s) { if (s.getBoundingClientRect().top <= line) id = s.id.slice(4); });
      setActive(id);
    };
    var raf = 0;
    window.addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(function () { raf = 0; onScroll(); }); }, { passive: true });
    onScroll();
  }

  /* ------------------------------------------------------------------
   * Fenêtre de choix (boisson, parfum, formule…)
   * ------------------------------------------------------------------ */
  var choiceSheet = $('#choice-sheet'), choiceCtx = null;
  function resolveGroup(g) {
    var def = typeof g === 'string' ? Object.assign({ id: g }, DATA.choiceGroups[g]) : g;
    def.options = def.options.map(function (o) { return typeof o === 'string' ? { label: o, price: 0 } : { label: o.label, price: o.price || 0 }; });
    def.priced = def.options.some(function (o) { return o.price; });
    return def;
  }
  function openChoice(it, v, btn) {
    var groups = v.choices.map(resolveGroup);
    choiceCtx = { it: it, v: v, groups: groups, btn: btn };
    $('#choice-title').textContent = it.name + (v.id === 'unique' ? '' : ' · ' + v.label);
    $('#choice-body').innerHTML = groups.map(function (g, gi) {
      var wide = g.options.some(function (o) { return o.label.length > 16; });
      return '<fieldset class="choice-group"><legend>' + esc(g.label) + '</legend><div class="choice-opts' + (wide ? ' choice-opts--wide' : '') + '">' +
        g.options.map(function (o, oi) {
          return '<label class="opt"><input type="radio" name="g' + gi + '" value="' + oi + '"' + (g.priced && oi === 0 ? ' checked' : '') + ' required><span>' + esc(o.label) + (o.price ? ' <small>+' + euro(o.price) + '</small>' : '') + '</span></label>';
        }).join('') + '</div><p class="choice-err" hidden>Faites un choix.</p></fieldset>';
    }).join('');
    updateChoicePrice();
    choiceSheet.showModal();
  }
  function choiceSelection() {
    var sel = [], price = choiceCtx.v.price, missing = [];
    choiceCtx.groups.forEach(function (g, gi) {
      var r = $('input[name="g' + gi + '"]:checked', choiceSheet);
      if (!r) { missing.push(gi); return; }
      var o = g.options[+r.value]; sel.push(o.label); price += o.price;
    });
    return { sel: sel, price: price, missing: missing };
  }
  function updateChoicePrice() {
    $('#choice-submit').textContent = 'Ajouter · ' + euro(choiceSelection().price);
  }
  $('#choice-form').addEventListener('change', function (e) {
    updateChoicePrice();
    var fs = e.target.closest('.choice-group'); if (fs) $('.choice-err', fs).hidden = true;
  });
  $('#choice-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var s = choiceSelection();
    if (s.missing.length) {
      var fss = $$('.choice-group', choiceSheet);
      s.missing.forEach(function (gi) { $('.choice-err', fss[gi]).hidden = false; });
      $('input', fss[s.missing[0]]).focus();
      return;
    }
    addLine(choiceCtx.it, choiceCtx.v, s.sel, s.price);
    choiceSheet.close();
    flash(choiceCtx.btn);
  });

  /* ------------------------------------------------------------------
   * Panier
   * ------------------------------------------------------------------ */
  var cart = [], backup = null;
  function loadCart() {
    try { var c = JSON.parse(store.get(CART_KEY) || '[]'); if (Array.isArray(c)) cart = c.filter(function (l) { return ITEMS[l.item] && l.qty > 0; }); } catch (e) { cart = []; }
  }
  function saveCart() { store.set(CART_KEY, JSON.stringify(cart)); }
  function addLine(it, v, sel, price) {
    var key = [it.id, v.id].concat(sel).join('|');
    var ex = cart.filter(function (l) { return l.key === key; })[0];
    if (ex) ex.qty++;
    else cart.push({ key: key, item: it.id, name: it.name, variant: v.id === 'unique' ? '' : v.label, opts: sel, unit: price == null ? v.price : price, qty: 1, ask: it.askDetails || '', student: !!it.student });
    saveCart(); renderCart(true);
    toast('Ajouté : ' + it.name + (v.id === 'unique' ? '' : ' (' + v.label + ')') + (it.askDetails ? ' · ' + it.askDetails.toLowerCase() + ' dans « Précisions »' : ''));
  }
  var totals = function () { return cart.reduce(function (a, l) { a.n += l.qty; a.t += l.qty * l.unit; return a; }, { n: 0, t: 0 }); };
  function renderCart(bump) {
    var t = totals(), bar = $('#cartbar');
    bar.hidden = !t.n;
    $('#cart-count').textContent = t.n;
    $('#cart-count').setAttribute('aria-label', t.n + (t.n > 1 ? ' articles' : ' article'));
    $('#cart-total').textContent = euro(t.t);
    $('#sheet-total').textContent = euro(t.t);
    if (bump) { bar.classList.remove('bump'); void bar.offsetWidth; bar.classList.add('bump'); }
    $('#cart-empty').hidden = !!t.n;
    $('#order-form').hidden = !t.n;
    $('#cart-lines').innerHTML = cart.map(function (l, i) {
      var sub = [l.variant].concat(l.opts).filter(Boolean).join(' · ');
      return '<li class="line"><span class="line__name">' + esc(l.name) + '</span><span class="line__price">' + euro(l.unit * l.qty) + '</span>' +
        '<span class="line__opts">' + esc(sub) + (l.ask ? (sub ? '<br>' : '') + '→ ' + esc(l.ask) + ' dans « Précisions »' : '') + '</span>' +
        '<span class="qty"><button type="button" data-dec="' + i + '" aria-label="Retirer un ' + esc(l.name) + '">−</button><output aria-label="Quantité">' + l.qty + '</output><button type="button" data-inc="' + i + '" aria-label="Ajouter un ' + esc(l.name) + '">+</button></span></li>';
    }).join('');
    checkStudent(); updateWaLink();
  }
  $('#cart-lines').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var i = +(b.dataset.inc != null ? b.dataset.inc : b.dataset.dec);
    if (b.dataset.inc != null) cart[i].qty++; else cart[i].qty--;
    if (cart[i].qty <= 0) cart.splice(i, 1);
    saveCart(); renderCart();
    var again = $$('#cart-lines button')[Math.min($$('#cart-lines button').length - 1, i * 2 + (b.dataset.inc != null ? 1 : 0))];
    if (again) again.focus(); else if (!cart.length) $('#cart-sheet [data-close]').focus();
  });

  var cartSheet = $('#cart-sheet');
  $('#open-cart').addEventListener('click', function () { refreshSlots(); renderCart(); cartSheet.showModal(); });

  /* Créneaux dans le formulaire */
  function refreshSlots() {
    if (!DATA) return;
    var now = parisNow(), s = getSlots(now), sel = $('#f-time'), prev = sel.value;
    var dayTxt = s.day ? (s.k === 0 ? 'Aujourd\u2019hui' : s.k === 1 ? 'Demain (' + dLabel(s.day) + ')' : dLabel(s.day).replace(/^./, function (c) { return c.toUpperCase(); })) : '';
    var html = s.asap ? '<option value="asap">Dès que possible</option>' : '';
    if (s.slots.length) {
      html += '<optgroup label="' + esc(dayTxt) + '">' + s.slots.map(function (x) {
        var v = ymd(x.at) + 'T' + pad(Math.floor(x.min / 60)) + ':' + pad(x.min % 60);
        return '<option value="' + v + '">' + (s.k === 0 ? '' : (s.k === 1 ? 'Demain' : DAY_FR[x.at.getUTCDay()].replace(/^./, function (c) { return c.toUpperCase(); })) + ' ') + hLabel(x.min) + '</option>';
      }).join('') + '</optgroup>';
    }
    if (!html) html = '<option value="">Aucun créneau disponible — appelez-nous</option>';
    sel.innerHTML = html;
    if (prev && $('option[value="' + prev + '"]', sel)) sel.value = prev;
    $('#time-hint').textContent = s.asap ? 'Retrait au plus tôt dans ' + (DATA.restaurant.minLeadMinutes || 20) + ' min environ.' :
      (s.day ? 'Le restaurant est fermé : créneaux de la prochaine ouverture (' + (s.k === 0 ? 'aujourd\u2019hui' : s.k === 1 ? 'demain' : DAY_FR[s.day.getUTCDay()]) + ').' : '');
    checkStudent();
  }
  function chosenTime() {
    var v = $('#f-time').value;
    if (v === 'asap') return { label: 'Dès que possible', at: parisNow() };
    var at = parseWall(v); if (!at) return null;
    var k = Math.round((dayStart(at) - dayStart(parisNow())) / 864e5);
    return { label: (k === 0 ? 'aujourd\u2019hui' : k === 1 ? 'demain, ' + dLabel(at) : dLabel(at)) + ' à ' + hLabel(minOfDay(at)), at: at };
  }
  function checkStudent() {
    var has = cart.some(function (l) { return l.student; }), t = chosenTime();
    $('#student-warn').hidden = !(has && t && !isStudentTime(t.at));
  }

  /* Validation */
  var normPhone = function (v) { return v.replace(/[\s.\-()]/g, ''); };
  var phoneOk = function (v) { var p = normPhone(v); return /^0[67]\d{8}$/.test(p) || /^(\+33|0033)[1-9]\d{8}$/.test(p); };
  var prettyPhone = function (v) {
    var p = normPhone(v);
    if (/^0\d{9}$/.test(p)) return p.replace(/(\d{2})(?=\d)/g, '$1 ');
    if (/^(\+33|0033)\d{9}$/.test(p)) { var r = p.replace(/^(\+33|0033)/, ''); return '+33 ' + r[0] + ' ' + r.slice(1).replace(/(\d{2})(?=\d)/g, '$1 '); }
    return v.trim();
  };
  function setErr(input, errEl, bad) { input.setAttribute('aria-invalid', bad ? 'true' : 'false'); $(errEl).hidden = !bad; }
  function validate(show) {
    var name = $('#f-name'), phone = $('#f-phone'), ok = true, first = null;
    var nBad = !name.value.trim(), pBad = !phoneOk(phone.value), tBad = !$('#f-time').value;
    if (show) { setErr(name, '#e-name', nBad); setErr(phone, '#e-phone', pBad); }
    if (nBad) { ok = false; first = first || name; }
    if (pBad) { ok = false; first = first || phone; }
    if (tBad) { ok = false; first = first || $('#f-time'); }
    if (!cart.length) ok = false;
    return { ok: ok, first: first };
  }
  $('#f-phone').addEventListener('blur', function () { if (this.value) setErr(this, '#e-phone', !phoneOk(this.value)); });
  $('#f-name').addEventListener('blur', function () { if (this.getAttribute('aria-invalid') === 'true') setErr(this, '#e-name', !this.value.trim()); });
  $('#f-phone').addEventListener('input', function () { if (this.getAttribute('aria-invalid') === 'true' && phoneOk(this.value)) setErr(this, '#e-phone', false); });
  $('#order-form').addEventListener('input', function () { checkStudent(); updateWaLink(); });
  $('#order-form').addEventListener('change', function () { checkStudent(); updateWaLink(); });
  $('#order-form').addEventListener('submit', function (e) { e.preventDefault(); });

  /* Message WhatsApp */
  function buildMessage() {
    var f = $('#order-form'), t = chosenTime(), tot = totals();
    var L = ['Bonjour Casa Grill ! Voici ma commande :', ''];
    cart.forEach(function (l) {
      L.push('• ' + l.qty + ' × ' + l.name + (l.variant ? ' — ' + l.variant : '') + ' — ' + euro(l.unit * l.qty).replace('\u00a0', ' '));
      if (l.opts.length) L.push('   ↳ ' + l.opts.join(', '));
    });
    L.push('', 'Total : ' + euro(tot.t).replace('\u00a0', ' '), '');
    L.push('Mode : ' + f.mode.value);
    L.push('Heure : ' + (t ? t.label : '—'));
    L.push('Prénom : ' + (f.name.value.trim() || '—'));
    L.push('Tél : ' + (f.phone.value ? prettyPhone(f.phone.value) : '—'));
    var notes = f.notes.value.trim();
    if (notes) L.push('Précisions : ' + notes);
    L.push('', 'Paiement au restaurant.');
    return L.join('\n');
  }
  function updateWaLink() {
    if (!DATA) return;
    var a = $('#wa-link');
    a.href = 'https://wa.me/' + DATA.restaurant.whatsapp + '?text=' + encodeURIComponent(buildMessage());
  }
  $('#wa-link').addEventListener('click', function (e) {
    var v = validate(true);
    if (!v.ok) {
      e.preventDefault();
      if (v.first) v.first.focus();
      toast(cart.length ? 'Complétez le prénom et le téléphone' : 'Votre panier est vide');
      return;
    }
    updateWaLink(); // href à jour avant que le navigateur suive le lien
    backup = cart.slice();
    setTimeout(function () {
      cart = []; saveCart(); renderCart();
      cartSheet.close();
      $('#sent-sheet').showModal();
    }, 400);
  });
  $('#restore-cart').addEventListener('click', function () {
    if (backup) { cart = backup; backup = null; saveCart(); renderCart(); }
    $('#sent-sheet').close(); cartSheet.showModal();
  });
  $('#copy-order').addEventListener('click', function () {
    var txt = buildMessage();
    var done = function () { toast('Commande copiée'); };
    var fallback = function () {
      var ta = document.createElement('textarea'); ta.value = txt; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      cartSheet.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (err) { toast('Copie impossible'); }
      ta.remove();
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(done, fallback); else fallback();
  });

  /* ------------------------------------------------------------------
   * Divers : thème, carte, affiches, liens, analytics, toast
   * ------------------------------------------------------------------ */
  function initTheme() {
    var btn = $('#theme-toggle'), root = document.documentElement;
    var sync = function () {
      var light = root.dataset.theme === 'light';
      btn.setAttribute('aria-pressed', String(light));
      btn.setAttribute('aria-label', light ? 'Passer en mode sombre' : 'Passer en mode clair');
      $('meta[name="theme-color"]').setAttribute('content', light ? '#faf4ea' : '#120d09');
    };
    btn.addEventListener('click', function () {
      root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
      store.set(THEME_KEY, root.dataset.theme); sync();
    });
    sync();
  }
  function initMap() {
    $('#map-load').addEventListener('click', function () {
      var f = document.createElement('iframe');
      f.src = 'https://maps.google.com/maps?q=' + encodeURIComponent('Casa Grill, 1 avenue de Libourne, 33870 Vayres') + '&z=16&output=embed';
      f.title = 'Plan d\u2019accès : 1 avenue de Libourne, Vayres';
      f.loading = 'lazy'; f.referrerPolicy = 'no-referrer-when-downgrade'; f.allowFullscreen = true;
      $('#map').appendChild(f); this.remove();
    });
  }
  function initPosters() {
    var dlg = $('#posters');
    $('#open-posters').addEventListener('click', function () {
      $$('img[data-src]', dlg).forEach(function (im) { im.src = im.dataset.src; im.removeAttribute('data-src'); });
      dlg.showModal();
    });
    $('#posters-track').addEventListener('click', function (e) {
      var z = e.target.closest('.zoomable'); if (!z) return;
      var fig = z.parentNode, r = z.getBoundingClientRect();
      var fx = (e.clientX - r.left) / r.width || .5, fy = (e.clientY - r.top) / r.height || .3;
      var on = z.classList.toggle('is-zoomed');
      z.setAttribute('aria-label', (on ? 'Dézoomer' : 'Zoomer') + z.getAttribute('aria-label').replace(/^\S+/, ''));
      if (on) requestAnimationFrame(function () {
        fig.scrollLeft = fx * fig.scrollWidth - fig.clientWidth / 2;
        fig.scrollTop = fy * fig.scrollHeight - fig.clientHeight / 2;
      });
    });
  }
  function initDialogs() {
    $$('dialog').forEach(function (d) {
      d.addEventListener('click', function (e) {
        if (e.target.closest('[data-close]')) d.close();
        else if (e.target === d) d.close(); // clic sur le fond
      });
    });
  }
  var ICONS = {
    ubereats: ['Uber Eats', '<path fill="currentColor" d="M4 5h2v7a3 3 0 0 0 6 0V5h2v7a5 5 0 0 1-10 0z"/><path fill="currentColor" d="M16 9h4v2h-4v3h4v2h-6V7h6v2h-4z"/>'],
    deliveroo: ['Deliveroo', '<path fill="currentColor" d="M15.6 2l-1 9.4-1.8-8.5-5.6 1.2 1.8 8.5-6.9 1.4 1.2 6.6 12.1 2.4 2.7-6.1L20 2.8z"/>'],
    facebook: ['Facebook', '<path fill="currentColor" d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.5 1.6-1.5h1.7V4.4c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1v2.4H7.7V14h2.7v8z"/>'],
    instagram: ['Instagram', '<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.3" cy="6.7" r="1.2" fill="currentColor"/>'],
    tiktok: ['TikTok', '<path fill="currentColor" d="M16.5 3c.3 2.2 1.6 3.6 3.8 3.8v3a7 7 0 0 1-3.8-1.2v6.2A5.9 5.9 0 1 1 10.6 9v3.1a2.9 2.9 0 1 0 2.9 2.8V3z"/>']
  };
  function renderLinks() {
    var L = CONF.links || {};
    var mk = function (k) {
      if (!L[k]) return '';
      return '<a class="btn btn--ghost btn--sm" href="' + esc(L[k]) + '" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">' + ICONS[k][1] + '</svg>' + ICONS[k][0] + '</a>';
    };
    var del = mk('ubereats') + mk('deliveroo'), soc = mk('facebook') + mk('instagram') + mk('tiktok');
    $('#delivery-links').innerHTML = del; $('#footer-delivery').hidden = !del;
    $('#social-links').innerHTML = soc; $('#footer-social').hidden = !soc;
  }
  function initAnalytics() {
    var a = CONF.analytics || {}, s;
    if (a.provider === 'plausible' && a.plausibleDomain) {
      s = document.createElement('script'); s.defer = true; s.dataset.domain = a.plausibleDomain; s.src = a.plausibleSrc || 'https://plausible.io/js/script.js';
    } else if (a.provider === 'umami' && a.umamiSrc && a.umamiWebsiteId) {
      s = document.createElement('script'); s.defer = true; s.dataset.websiteId = a.umamiWebsiteId; s.src = a.umamiSrc;
    }
    if (s) document.head.appendChild(s);
  }
  var toastT = 0;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('is-on');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('is-on'); }, 2600);
  }

  initTheme(); initMap(); initPosters(); initDialogs();

  // En production, build.mjs insère menu.json et config.json dans la page (pas de requête, pas de décalage d'affichage).
  var inline = document.getElementById('cg-data');
  if (inline) {
    try { var d = JSON.parse(inline.textContent); start(d.menu, d.config); } catch (e) { failed(e); }
  } else {
    Promise.all([getJSON('data/menu.json'), getJSON('data/config.json').catch(function () { return {}; })])
      .then(function (res) { start(res[0], res[1]); }, failed);
  }
  $('#year').textContent = parisNow().getUTCFullYear();

  // Exposé pour les tests automatisés.
  window.__casa = { getStatus: function (d) { return statusText(getStatus(d || parisNow())); }, getSlots: getSlots, parseWall: parseWall, buildMessage: buildMessage, phoneOk: phoneOk };
})();
