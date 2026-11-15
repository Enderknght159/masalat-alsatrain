/*
 * app.js — مسألة السطرين
 * تطبيق تعليمي تفاعلي للصف التاسع.
 */
(function () {
  'use strict';

  /* ======================================================================
     أدوات عامة
     ====================================================================== */

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function icon(name, cls) {
    return '<svg class="ic ' + (cls || '') + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  }

  function round(n, d) {
    var p = Math.pow(10, d == null ? 1 : d);
    return Math.round(n * p) / p;
  }

  function num(n) {
    var r = round(n, 2);
    return String(r);
  }

  function massNum(n) {
    var r = round(n, 1);
    return String(r);
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function pick(arr, rng) {
    return arr[Math.floor((rng ? rng() : Math.random()) * arr.length)];
  }

  function unique(arr) {
    return arr.filter(function (v, i) { return arr.indexOf(v) === i; });
  }

  function speciesName(sp) {
    return sp.name || DATA.NAMES[sp.formula] || sp.formula;
  }

  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function localDateKey(d) {
    d = d || new Date();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }

  function formatDate(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleDateString('ar-SY', { day: 'numeric', month: 'short' });
    } catch (e) {
      return '';
    }
  }

  function seeded(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return function () {
      h += 0x6D2B79F5;
      var t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ======================================================================
     الحالة والتخزين
     ====================================================================== */

  var STORAGE_KEY = 'satrain.v1';

  function defaultState() {
    return {
      xp: 0,
      name: '',
      theme: 'light',
      sound: true,
      badges: [],
      saved: [],
      best: {},
      totalScore: 0,
      counters: {
        solved: 0,
        games: 0,
        correct: 0,
        attempts: 0,
        balanceCorrect: 0,
        blocks: 0,
        memoryWins: 0
      },
      lesson: { step: 0, visited: [] },
      lessonQuiz: {},
      lessonBonus: false,
      dailyDays: [],
      daily: { date: '', done: false, answer: 0 },
      lab: { reactionId: 'water', given: 'H2', target: 'H2O', mass: 8, moles: false },
      art: { reactionId: 'water', played: false },
      blocks: { reactionId: 'water', stage: 1 }
    };
  }

  var state = defaultState();

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      var base = defaultState();
      if (saved && typeof saved === 'object') {
        Object.keys(base).forEach(function (k) {
          if (saved[k] === undefined) return;
          if (k === 'counters' || k === 'lesson' || k === 'daily' || k === 'lab' || k === 'art' || k === 'blocks') {
            base[k] = Object.assign({}, base[k], saved[k]);
          } else {
            base[k] = saved[k];
          }
        });
        if (!Array.isArray(base.badges)) base.badges = [];
        if (!Array.isArray(base.saved)) base.saved = [];
        if (!Array.isArray(base.dailyDays)) base.dailyDays = [];
        if (!Array.isArray(base.lesson.visited)) base.lesson.visited = [];
      }
      state = base;
    } catch (e) {
      /* تجاهل أي تخزين تالف */
    }
  }

  var saveTimer = null;
  function persist() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) { /* التخزين قد يكون معطلاً */ }
    }, 80);
  }

  var LEVELS = DATA.levels;

  function levelIndex(xp) {
    var idx = 0;
    for (var i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i].xp) idx = i;
    return idx;
  }

  function levelInfo(xp) {
    var i = levelIndex(xp);
    var cur = LEVELS[i];
    var next = LEVELS[i + 1] || null;
    var pct = next ? clamp(((xp - cur.xp) / (next.xp - cur.xp)) * 100, 0, 100) : 100;
    return { index: i, level: cur, next: next, pct: pct };
  }

  /* ======================================================================
     الصوت
     ====================================================================== */

  var audioCtx = null;

  function getAudio() {
    if (audioCtx) return audioCtx;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try {
      audioCtx = new Ctx();
    } catch (e) {
      return null;
    }
    return audioCtx;
  }

  function tone(freq, dur, type, vol, delay) {
    if (!state.sound) return;
    var ctx = getAudio();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      try { ctx.resume(); } catch (e) { /* لا شيء */ }
    }
    try {
      var t = ctx.currentTime + (delay || 0);
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(vol || 0.04, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.08));
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + (dur || 0.08) + 0.03);
    } catch (e) { /* صوت غير متاح */ }
  }

  var SFX = {
    click: function () { tone(540, 0.05, 'triangle', 0.025); },
    pop: function () { tone(760, 0.06, 'sine', 0.04); },
    ok: function () { tone(680, 0.09, 'sine', 0.05); tone(920, 0.13, 'sine', 0.04, 0.08); },
    bad: function () { tone(190, 0.16, 'sawtooth', 0.03); tone(140, 0.2, 'sawtooth', 0.025, 0.05); },
    win: function () {
      [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.16, 'triangle', 0.045, i * 0.09); });
    },
    tick: function () { tone(440, 0.04, 'square', 0.02); }
  };

  /* ======================================================================
     القصاصات والتنبيهات
     ====================================================================== */

  var confettiCanvas = $('#confetti');
  var confettiCtx = confettiCanvas ? confettiCanvas.getContext('2d') : null;
  var confettiParts = [];
  var confettiRaf = null;

  function sizeConfetti() {
    if (!confettiCanvas) return;
    var dpr = window.devicePixelRatio || 1;
    confettiCanvas.width = window.innerWidth * dpr;
    confettiCanvas.height = window.innerHeight * dpr;
    if (confettiCtx) confettiCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function burst(count) {
    if (!confettiCtx || reducedMotion()) return;
    sizeConfetti();
    var colors = ['#f36b45', '#ffc94a', '#d8f27e', '#106b57', '#a9dcf1', '#c3b2f7', '#fff9ec'];
    var cx = window.innerWidth / 2;
    var cy = window.innerHeight * 0.38;
    var n = count || 90;
    for (var i = 0; i < n; i++) {
      var ang = Math.random() * Math.PI * 2;
      var sp = 4 + Math.random() * 9;
      confettiParts.push({
        x: cx + (Math.random() - 0.5) * 80,
        y: cy + (Math.random() - 0.5) * 40,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 3,
        w: 5 + Math.random() * 7,
        h: 3 + Math.random() * 5,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1
      });
    }
    if (!confettiRaf) confettiRaf = requestAnimationFrame(drawConfetti);
  }

  function drawConfetti() {
    if (!confettiCtx) return;
    confettiCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    var alive = 0;
    for (var i = 0; i < confettiParts.length; i++) {
      var p = confettiParts[i];
      p.vy += 0.18;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life -= 0.006;
      if (p.life > 0 && p.y < window.innerHeight + 40) {
        alive++;
        confettiCtx.save();
        confettiCtx.translate(p.x, p.y);
        confettiCtx.rotate(p.rot);
        confettiCtx.globalAlpha = Math.max(0, p.life);
        confettiCtx.fillStyle = p.color;
        confettiCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        confettiCtx.restore();
      }
    }
    confettiParts = confettiParts.filter(function (p) { return p.life > 0 && p.y < window.innerHeight + 40; });
    if (alive > 0) {
      confettiRaf = requestAnimationFrame(drawConfetti);
    } else {
      confettiCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      confettiParts = [];
      confettiRaf = null;
    }
  }

  window.addEventListener('resize', function () {
    if (confettiParts.length) sizeConfetti();
  });

  function toast(message, kind, ic) {
    var stack = $('#toastStack');
    if (!stack) return;
    var div = document.createElement('div');
    div.className = 'toast ' + (kind || '');
    div.innerHTML = icon(ic || 'check') + '<span>' + esc(message) + '</span>';
    stack.appendChild(div);
    setTimeout(function () {
      div.classList.add('is-out');
      setTimeout(function () { div.remove(); }, 260);
    }, 3200);
  }

  function say(text) {
    var r = $('#liveRegion');
    if (r) r.textContent = text;
  }

  /* ======================================================================
     الخبرة والشارات
     ====================================================================== */

  function awardXP(amount, label) {
    if (!amount) return;
    var before = levelIndex(state.xp);
    state.xp += amount;
    var after = levelIndex(state.xp);
    persist();
    updateXP();
    toast('+' + amount + ' نقطة خبرة' + (label ? ' · ' + label : ''), 'is-xp', 'star');
    if (after > before) {
      setTimeout(function () {
        toast('ترقية! أصبحت «' + LEVELS[after].title + '»', 'is-badge', 'crown');
        SFX.win();
        burst(140);
      }, 320);
      if (after >= 4) unlockBadge('level5');
    }
  }

  function hasBadge(id) {
    return state.badges.indexOf(id) !== -1;
  }

  function unlockBadge(id) {
    if (hasBadge(id)) return false;
    var badge = DATA.badges.filter(function (b) { return b.id === id; })[0];
    if (!badge) return false;
    state.badges.push(id);
    persist();
    toast('شارة جديدة: ' + badge.title, 'is-badge', badge.icon);
    SFX.win();
    burst(110);
    updateXP();
    if (currentView === 'me') renderMe();
    return true;
  }

  function updateXP() {
    var info = levelInfo(state.xp);
    var chipLevel = $('#xpChipLevel');
    var chipTitle = $('#xpChipTitle');
    var chipBar = $('#xpChipBar');
    var chipXp = $('#xpChipXp');
    if (chipLevel) chipLevel.textContent = info.index + 1;
    if (chipTitle) chipTitle.textContent = info.level.title;
    if (chipBar) chipBar.style.width = info.pct + '%';
    if (chipXp) chipXp.textContent = state.xp + ' XP';

    var pLevel = $('#profileLevel');
    var pXp = $('#profileXpText');
    var pBar = $('#profileXpBar');
    var pNext = $('#profileNextText');
    var pPct = $('#profileLevelPct');
    if (pLevel) pLevel.textContent = 'المستوى ' + (info.index + 1) + ' · ' + info.level.title;
    if (pXp) pXp.textContent = state.xp + ' XP';
    if (pBar) pBar.style.width = info.pct + '%';
    if (pNext) pNext.textContent = info.next ? (info.next.xp - state.xp) + ' XP للمستوى التالي' : 'أعلى مستوى!';
    if (pPct) pPct.textContent = Math.round(info.pct) + '%';

    var nextCard = $('#nextLevelCard');
    if (nextCard) {
      if (info.next) {
        nextCard.innerHTML =
          '<div class="next-level-icon">' + icon(info.next.icon) + '</div>' +
          '<div><h3>التالي: ' + esc(info.next.title) + '</h3>' +
          '<p>تحتاج ' + (info.next.xp - state.xp) + ' نقطة خبرة إضافية للوصول إلى المستوى ' + (info.index + 2) + '.</p></div>' +
          '<div class="next-level-goal">هدفك القادم: <b>' + info.next.xp + ' XP</b></div>';
      } else {
        nextCard.innerHTML =
          '<div class="next-level-icon">' + icon('crown') + '</div>' +
          '<div><h3>أنت في القمة</h3><p>وصلت إلى أعلى مستوى في مسألة السطرين. علّم غيرك الآن!</p></div>' +
          '<div class="next-level-goal">مجموع نقاطك: <b>' + state.xp + ' XP</b></div>';
      }
    }
    var bCount = $('#badgesCount');
    if (bCount) bCount.textContent = state.badges.length + ' من ' + DATA.badges.length + ' شارة';
  }

  /* ======================================================================
     رسم المعادلات والجزيئات
     ====================================================================== */

  function eqTokens(reaction) {
    var seq = [];
    reaction.reactants.forEach(function (sp, i) {
      if (i) seq.push({ t: 'op', v: '+' });
      seq.push({ t: 'sp', sp: sp });
    });
    seq.push({ t: 'op', v: '→', arrow: true });
    reaction.products.forEach(function (sp, i) {
      if (i) seq.push({ t: 'op', v: '+' });
      seq.push({ t: 'sp', sp: sp });
    });
    return seq;
  }

  function eqSequenceHTML(reaction, opts) {
    opts = opts || {};
    var masses = !!opts.masses;
    var animate = !!opts.animate;
    var given = opts.given || null;
    var target = opts.target || null;
    var blankIndex = typeof opts.blankIndex === 'number' ? opts.blankIndex : -1;
    var species = reaction.species;
    var html = '<div class="eq-row' + (masses && !animate ? ' show-masses' : '') + '"' +
      (animate ? ' data-animate-masses="1"' : '') + ' dir="ltr">';
    eqTokens(reaction).forEach(function (tok) {
      if (tok.t === 'op') {
        html += '<div class="eq-op' + (tok.arrow ? ' eq-arrow' : '') + '">' + tok.v + '</div>';
        return;
      }
      var sp = tok.sp;
      var idx = species.indexOf(sp);
      var cls = 'eq-term';
      if (given && sp.formula === given) cls += ' is-given';
      if (target && sp.formula === target) cls += ' is-target';
      var coefHTML;
      if (idx === blankIndex) {
        coefHTML = '<span class="quiz-missing">؟</span>';
      } else {
        coefHTML = sp.coef > 1 ? '<span class="eq-coef">' + sp.coef + '</span>' : '';
      }
      html += '<div class="' + cls + '">' +
        '<span class="eq-formula">' + coefHTML + Chem.formatFormula(sp.formula) + '</span>' +
        (masses ? '<span class="eq-mass">' + massNum(sp.lineMass) + ' غ</span>' : '') +
        '</div>';
    });
    html += '</div>';
    return html;
  }

  function massRowHTML(reaction) {
    var html = '<div class="eq-row is-static" dir="ltr">';
    eqTokens(reaction).forEach(function (tok) {
      if (tok.t === 'op') {
        html += '<div class="eq-op' + (tok.arrow ? ' eq-arrow' : '') + '">' + tok.v + '</div>';
        return;
      }
      html += '<div class="eq-term"><span class="eq-mass">' + massNum(tok.sp.lineMass) + ' غ</span></div>';
    });
    html += '</div>';
    return html;
  }

  function proportionHTML(givenSp, givenMass, targetSp, targetSymbol, hideTarget) {
    return '<div class="proportion">' +
      '<div class="frac"><span class="num">' + massNum(givenMass) + ' غ <small>' + Chem.formatFormula(givenSp.formula) + '</small></span><span class="den">' + massNum(givenSp.lineMass) + ' غ <small>سطر 2</small></span></div>' +
      '<span class="prop-eq">=</span>' +
      '<div class="frac"><span class="num">' + (targetSymbol || 'س') + ' <small>' + Chem.formatFormula(targetSp.formula) + '</small></span><span class="den">' + (hideTarget ? '؟' : massNum(targetSp.lineMass) + ' غ') + ' <small>سطر 2</small></span></div>' +
      '</div>';
  }

  var DARK_ELEMENTS = ['C', 'Fe', 'Cu', 'Pb', 'I', 'Br', 'Mn', 'Au', 'Hg', 'Ag'];

  function atomRadius(el, size) {
    var base = { H: 0.1, C: 0.155, N: 0.15, O: 0.15, Na: 0.17, Mg: 0.165, Al: 0.16, Si: 0.16, P: 0.16, S: 0.16, Cl: 0.165, K: 0.175, Ca: 0.18, Fe: 0.17, Cu: 0.17, Zn: 0.17, Ba: 0.185, Pb: 0.185 }[el] || 0.14;
    return base * size;
  }

  function moleculeSVG(formula, size, opts) {
    opts = opts || {};
    size = size || 64;
    var counts;
    try {
      counts = Chem.parseFormula(formula);
    } catch (e) {
      return '';
    }
    var atoms = [];
    Object.keys(counts).forEach(function (el) {
      var n = Math.min(counts[el], 5);
      for (var i = 0; i < n; i++) atoms.push(el);
    });
    if (atoms.length > 6) atoms = atoms.slice(0, 6);
    atoms.sort(function (a, b) {
      return (Chem.ATOMIC[b] ? Chem.ATOMIC[b].mass : 0) - (Chem.ATOMIC[a] ? Chem.ATOMIC[a].mass : 0);
    });
    var cx = size / 2;
    var cy = size / 2;
    var pos = [];
    if (atoms.length === 1) {
      pos = [[cx, cy]];
    } else if (atoms.length === 2) {
      pos = [[cx - size * 0.19, cy], [cx + size * 0.19, cy]];
    } else if (atoms.length === 3) {
      pos = [[cx, cy - size * 0.03], [cx - size * 0.23, cy + size * 0.2], [cx + size * 0.23, cy + size * 0.2]];
    } else {
      pos.push([cx, cy]);
      var ring = size * (atoms.length <= 5 ? 0.25 : 0.29);
      for (var i = 1; i < atoms.length; i++) {
        var ang = -Math.PI / 2 + (i - 1) * (Math.PI * 2) / (atoms.length - 1);
        pos.push([cx + Math.cos(ang) * ring, cy + Math.sin(ang) * ring]);
      }
    }
    var ink = opts.light ? '#10241e' : '#fff9ec';
    var bond = opts.light ? 'rgba(16,36,30,.35)' : 'rgba(255,249,236,.42)';
    var svg = '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" aria-hidden="true" focusable="false">';
    for (var b = 1; b < pos.length; b++) {
      if (atoms.length > 2) {
        svg += '<line x1="' + pos[0][0] + '" y1="' + pos[0][1] + '" x2="' + pos[b][0] + '" y2="' + pos[b][1] + '" stroke="' + bond + '" stroke-width="' + Math.max(1.4, size * 0.026) + '" stroke-linecap="round"/>';
      } else {
        svg += '<line x1="' + pos[0][0] + '" y1="' + pos[0][1] + '" x2="' + pos[1][0] + '" y2="' + pos[1][1] + '" stroke="' + bond + '" stroke-width="' + Math.max(1.4, size * 0.026) + '" stroke-linecap="round"/>';
      }
    }
    atoms.forEach(function (el, i) {
      var info = Chem.ATOMIC[el] || { color: '#cfd8dc' };
      var r = atomRadius(el, size);
      var fill = info.color;
      var label = DARK_ELEMENTS.indexOf(el) !== -1 ? '#fff9ec' : '#10241e';
      if (el === 'H' && !opts.light) label = '#10241e';
      svg += '<circle cx="' + pos[i][0] + '" cy="' + pos[i][1] + '" r="' + r + '" fill="' + fill + '" stroke="#10241e" stroke-width="' + Math.max(1, size * 0.018) + '"/>';
      if (r > size * 0.09) {
        svg += '<text x="' + pos[i][0] + '" y="' + (pos[i][1] + r * 0.34) + '" text-anchor="middle" font-family="Tahoma, sans-serif" font-size="' + (r * 0.92) + '" font-weight="700" fill="' + label + '">' + el + '</text>';
      }
    });
    svg += '</svg>';
    return svg;
  }

  /* ======================================================================
     التنقل والوضع
     ====================================================================== */

  var VIEWS = ['home', 'learn', 'lab', 'blocks', 'games', 'art', 'me'];
  var currentView = 'home';

  function navigate(view, skipScroll) {
    if (VIEWS.indexOf(view) === -1) view = 'home';
    currentView = view;
    $$('.view').forEach(function (v) {
      v.classList.toggle('is-active', v.id === 'view-' + view);
    });
    $$('.navbtn').forEach(function (b) {
      var on = b.getAttribute('data-view') === view;
      b.classList.toggle('is-active', on);
      if (on) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    if (location.hash !== '#' + view) {
      try { history.replaceState(null, '', '#' + view); } catch (e) { location.hash = view; }
    }
    if (!skipScroll) {
      window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
    }
    if (view === 'learn') renderLesson();
    if (view === 'lab') renderLab();
    if (view === 'blocks') renderBlocks();
    if (view === 'games') renderGames();
    if (view === 'art') renderArt();
    if (view === 'me') renderMe();
    if (view === 'home') renderDaily();
    say('تم الانتقال إلى ' + view);
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    var btn = $('#themeBtn');
    if (btn) {
      btn.innerHTML = icon(state.theme === 'dark' ? 'sun' : 'moon');
      btn.setAttribute('aria-label', state.theme === 'dark' ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي');
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', state.theme === 'dark' ? '#081a16' : '#0B4F43');
  }

  function applySound() {
    var btn = $('#soundBtn');
    if (!btn) return;
    btn.innerHTML = icon(state.sound ? 'sound' : 'mute');
    btn.setAttribute('aria-pressed', state.sound ? 'true' : 'false');
    btn.setAttribute('aria-label', state.sound ? 'إيقاف الأصوات' : 'تشغيل الأصوات');
  }

  /* ======================================================================
     الرئيسية
     ====================================================================== */

  function renderHome() {
    var water = DATA.findReaction('water');
    if (!water) return;

    var board = $('#heroBoard');
    if (board) {
      board.innerHTML = eqSequenceHTML(water, { masses: true, given: 'H2', target: 'H2O' });
    }
    var whyEq = $('#whyEq');
    if (whyEq) whyEq.innerHTML = eqSequenceHTML(water, {});
    var whyMass = $('#whyMass');
    if (whyMass) whyMass.innerHTML = massRowHTML(water);

    var stats = $('#homeStats');
    if (stats) {
      stats.innerHTML =
        statItem(DATA.reactions.length, 'تفاعل جاهز للحل') +
        statItem(DATA.games.length, 'لعبة تفاعلية') +
        statItem(DATA.badges.length, 'شارة للإنجاز') +
        statItem('6', 'خطوات في الدرس');
    }

    var pathArt = $('#pathArt');
    if (pathArt) pathArt.innerHTML = moleculeSVG('H2O', 150);

    var tip = $('#tipText');
    if (tip) tip.textContent = DATA.tips[0];

    renderDaily();
  }

  function statItem(n, lbl) {
    return '<div class="stat-item"><span class="stat-num">' + n + '</span><span class="stat-lbl">' + esc(lbl) + '</span></div>';
  }

  var tipIndex = 0;
  function nextTip() {
    tipIndex = (tipIndex + 1) % DATA.tips.length;
    var t = $('#tipText');
    if (t) {
      t.textContent = DATA.tips[tipIndex];
      t.animate ? t.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 250 }) : null;
    }
    SFX.click();
  }

  function dailyConfig() {
    var key = localDateKey();
    var rng = seeded('satrain-' + key);
    var reaction = DATA.reactions[Math.floor(rng() * DATA.reactions.length)] || DATA.reactions[0];
    var species = reaction.species;
    var gi = Math.floor(rng() * species.length);
    var ti = (gi + 1 + Math.floor(rng() * (species.length - 1))) % species.length;
    var given = species[gi];
    var target = species[ti];
    var factors = [0.5, 1, 1.5, 2];
    var mass = round(reaction.defaultMass * factors[Math.floor(rng() * factors.length)], 1);
    if (mass < 0.5) mass = 1;
    var answer = round(mass * target.lineMass / given.lineMass, 2);
    return { key: key, reaction: reaction, given: given, target: target, mass: mass, answer: answer };
  }

  function renderDaily() {
    var box = $('#dailyCard');
    if (!box) return;
    var cfg = dailyConfig();
    var done = state.daily.date === cfg.key && state.daily.done;
    var streak = dailyStreak();

    var streakBox = $('#dailyStreak');
    if (streakBox) {
      var dots = '';
      var today = new Date();
      for (var i = 6; i >= 0; i--) {
        var d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
        var on = state.dailyDays.indexOf(localDateKey(d)) !== -1;
        dots += '<span class="streak-dot' + (on ? ' is-on' : '') + '" title="' + localDateKey(d) + '"></span>';
      }
      streakBox.innerHTML = dots + '<span class="streak-label">' + (streak > 0 ? streak + ' يوم متتابع' : 'ابدأ سلسلتك اليوم') + '</span>';
    }

    if (done) {
      box.innerHTML =
        '<div class="daily-card-top"><h3>أنجزت مسألة اليوم</h3><span class="tag">✓ مكتملة</span></div>' +
        '<div class="daily-eq">' + eqSequenceHTML(cfg.reaction, { given: cfg.given.formula, target: cfg.target.formula }) + '</div>' +
        '<p class="daily-question">الجواب الصحيح: <b>' + massNum(cfg.answer) + ' غ</b> من ' + esc(speciesName(cfg.target)) + '. عد غداً لمسألة جديدة.</p>' +
        '<div class="check-row"><span>' + icon('check') + ' +40 نقطة خبرة</span><span>' + icon('calendar') + ' سلسلة ' + streak + ' يوم</span></div>';
      return;
    }

    box.innerHTML =
      '<div class="daily-card-top"><h3>مسألة اليوم</h3><span class="tag">' + esc(cfg.reaction.title) + '</span></div>' +
      '<div class="daily-eq">' + eqSequenceHTML(cfg.reaction, { given: cfg.given.formula, target: cfg.target.formula }) + '</div>' +
      '<p class="daily-question">إذا تفاعل <b>' + massNum(cfg.mass) + ' غ</b> من ' + esc(speciesName(cfg.given)) +
      '، فما كتلة <b>' + esc(speciesName(cfg.target)) + '</b> الناتجة؟</p>' +
      '<form class="daily-form" id="dailyForm">' +
      '<input id="dailyInput" type="number" inputmode="decimal" step="0.1" min="0" placeholder="الجواب بالغرام" aria-label="جواب مسألة اليوم">' +
      '<button class="btn btn-primary btn-sm" type="submit">تحقّق</button>' +
      '</form>' +
      '<div class="daily-feedback" id="dailyFeedback"></div>';

    var form = $('#dailyForm');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var input = $('#dailyInput');
        var val = parseFloat(input.value);
        var fb = $('#dailyFeedback');
        if (!isFinite(val)) {
          fb.textContent = 'اكتب رقماً أولاً.';
          fb.className = 'daily-feedback is-bad';
          return;
        }
        var tol = Math.max(0.15, cfg.answer * 0.01);
        if (Math.abs(val - cfg.answer) <= tol) {
          state.daily = { date: cfg.key, done: true, answer: cfg.answer };
          if (state.dailyDays.indexOf(cfg.key) === -1) state.dailyDays.push(cfg.key);
          state.counters.solved++;
          persist();
          awardXP(40, 'مسألة اليوم');
          unlockBadge('daily');
          burst(120);
          SFX.win();
          renderDaily();
        } else {
          fb.textContent = 'ليست الإجابة الصحيحة. جرّب أن تكتب السطر الثاني أولاً.';
          fb.className = 'daily-feedback is-bad';
          SFX.bad();
        }
      });
    }
  }

  function dailyStreak() {
    var days = unique(state.dailyDays).sort();
    if (!days.length) return 0;
    var d = new Date();
    if (days.indexOf(localDateKey(d)) === -1) d.setDate(d.getDate() - 1);
    var count = 0;
    while (days.indexOf(localDateKey(d)) !== -1) {
      count++;
      d.setDate(d.getDate() - 1);
    }
    return count;
  }

  /* ======================================================================
     جدول العناصر
     ====================================================================== */

  var ELEMENT_ORDER = ['H', 'He', 'Li', 'B', 'C', 'N', 'O', 'F', 'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'K', 'Ca', 'Fe', 'Cu', 'Zn', 'Br', 'Ag', 'I', 'Ba', 'Pb', 'Mn', 'Hg', 'Au'];

  function openElements() {
    var grid = $('#elementsGrid');
    if (!grid) return;
    grid.innerHTML = ELEMENT_ORDER.map(function (el) {
      var info = Chem.ATOMIC[el];
      if (!info) return '';
      return '<button class="element-cell" type="button" data-el="' + el + '">' +
        '<span class="element-sym">' + el + '</span>' +
        '<span class="element-mass">' + info.mass + '</span>' +
        '<span class="element-name">' + esc(info.ar) + '</span>' +
        '</button>';
    }).join('');
    grid.onclick = function (e) {
      var cell = e.target.closest('[data-el]');
      if (!cell) return;
      var el = cell.getAttribute('data-el');
      var info = Chem.ATOMIC[el];
      toast(el + ' · ' + info.ar + ' — الكتلة الذرية ' + info.mass, '', 'atom');
      SFX.click();
    };
    var dlg = $('#elementsDialog');
    if (dlg.showModal) dlg.showModal();
  }

  /* ======================================================================
     الدرس التفاعلي
     ====================================================================== */

  var LESSON = [
    { key: 'idea', short: 'الفكرة الكبرى', title: 'المعادلة تحكي بالمولات' },
    { key: 'molar', short: 'الكتلة المولية', title: 'احسب كتلة المول' },
    { key: 'line', short: 'السطر الثاني', title: 'اكتب سطر الكميات' },
    { key: 'prop', short: 'التناسب', title: 'ضع الأرقام في التناسب' },
    { key: 'check', short: 'التحقق', title: 'اضرب… ثم تحقّق' },
    { key: 'done', short: 'الخلاصة', title: 'خمس خطوات إلى الإتقان' }
  ];

  function quizBox(stepKey, question, options, correct, explain) {
    return '<div class="quiz-box" data-quiz="' + stepKey + '" data-correct="' + correct + '">' +
      '<div class="quiz-head">' + icon('bulb') + ' تحقّق من فهمك</div>' +
      '<p class="quiz-q">' + question + '</p>' +
      '<div class="quiz-options">' +
      options.map(function (o, i) {
        return '<button class="quiz-opt" type="button" data-opt="' + i + '">' + o + '</button>';
      }).join('') +
      '</div>' +
      '<div class="quiz-feedback" aria-live="polite"></div>' +
      '<div class="sr-only">' + esc(explain || '') + '</div>' +
      '</div>';
  }

  function lessonStepHTML(i) {
    var water = DATA.findReaction('water');
    var h2 = water.reactants[0];
    var o2 = water.reactants[1];
    var h2o = water.products[0];
    var givenMass = 8;
    var answer = round(givenMass * h2o.lineMass / h2.lineMass, 2);

    if (i === 0) {
      return '<span class="step-kicker">الفكرة الكبرى</span>' +
        '<h3 class="step-title">المعادلة تحكي بالمولات، لا بالغرامات</h3>' +
        '<p class="step-lead">المعاملات الصغيرة قبل الصيغ في المعادلة الموزونة تعني <strong>عدد المولات</strong>. لكن الميزان في المختبر يعطيك غرامات، والسطر الثاني هو الجسر بين الاثنين.</p>' +
        '<div class="lesson-visual is-green">' +
        '<div class="visual-label">2H₂ + O₂ → 2H₂O</div>' +
        eqSequenceHTML(water, {}) +
        '<div class="eq-caption">2 مول هيدروجين + 1 مول أكسجين → 2 مول ماء</div>' +
        '</div>' +
        '<div class="note-box">' + icon('atom') +
        '<div><b>المول</b> هو كمية مادة تحتوي على 6.02×10²³ جسيم. لا تحفظ الرقم الآن؛ المهم أن المعامل يعني مولات، لا غرامات.</div>' +
        '</div>' +
        quizBox('idea', 'ماذا يعني المعامل 2 قبل H₂ في المعادلة؟',
          ['2 غرام من الهيدروجين', '2 مول من الهيدروجين', 'ذرتان فقط من الهيدروجين'], 1,
          'المعامل يعني عدد المولات. الكتلة تعتمد على الكتلة المولية أيضاً.');
    }

    if (i === 1) {
      var rows = water.species.map(function (sp) {
        var counts = sp.counts;
        var calc = Object.keys(counts).map(function (el) {
          return (counts[el] > 1 ? counts[el] + '×' : '') + Chem.ATOMIC[el].mass;
        }).join(' + ');
        return '<tr>' +
          '<td class="cell-formula">' + Chem.formatFormula(sp.formula) + '</td>' +
          '<td class="cell-calc">' + calc + '</td>' +
          '<td class="cell-mass">' + massNum(sp.molarMass) + ' غ/مول</td>' +
          '</tr>';
      }).join('');

      return '<span class="step-kicker">الكتلة المولية</span>' +
        '<h3 class="step-title">لكل مادة كتلة مول واحدة</h3>' +
        '<p class="step-lead">الكتلة المولية هي كتلة <strong>مول واحد</strong> بالغرام. نحسبها بجمع كتل الذرات في الصيغة. استخدم القيم المقرّبة في كتابك: H=1 وO=16.</p>' +
        '<div class="lesson-visual">' +
        '<div class="visual-label">حساب الكتلة المولية</div>' +
        '<table class="molar-table"><thead><tr><th>المادة</th><th>الحساب</th><th>الكتلة المولية</th></tr></thead><tbody>' + rows + '</tbody></table>' +
        '</div>' +
        '<div class="note-box is-mint">' + icon('balance') +
        '<div>لاحظ الفرق: الكتلة المولية لـ H₂ هي 2 غ/مول، لكن كتلة <b>جزيء</b> واحد منه صغيرة جداً. نحن نعمل دائماً بالمولات والغرامات.</div>' +
        '</div>' +
        quizBox('molar', 'ما الكتلة المولية لثاني أكسيد الكربون CO₂؟',
          ['28 غ/مول', '44 غ/مول', '32 غ/مول'], 1,
          '12 + (2×16) = 44 غ/مول.');
    }

    if (i === 2) {
      return '<span class="step-kicker">السطر الثاني</span>' +
        '<h3 class="step-title">اضرب المعامل في الكتلة المولية</h3>' +
        '<p class="step-lead">هذه هي الخطوة التي يعرفها الجميع: <strong>معامل كل مادة × كتلتها المولية</strong>. الناتج هو سطر الكميات تحت المعادلة.</p>' +
        '<div class="lesson-visual">' +
        '<div class="visual-label">السطر الأول والسطر الثاني</div>' +
        eqSequenceHTML(water, { masses: true, animate: true }) +
        '<div class="visual-note">2×2 = 4 غ &nbsp;·&nbsp; 1×32 = 32 غ &nbsp;·&nbsp; 2×18 = 36 غ</div>' +
        '</div>' +
        '<div class="note-box">' + icon('info') +
        '<div>لا تنسَ المعامل! 2H₂O تعني 2×18 = 36 غ، وليس 18 غ. هذا أكثر خطأ شائع عند الطلاب.</div>' +
        '</div>' +
        quizBox('line', 'ماذا نكتب تحت O₂ في معادلة الماء؟',
          ['16 غ', '32 غ', '36 غ'], 1,
          'معامل O₂ هو 1، وكتلته المولية 32، لذلك نكتب 32 غ.');
    }

    if (i === 3) {
      return '<span class="step-kicker">التناسب</span>' +
        '<h3 class="step-title">ضع كل رقم تحت مادته</h3>' +
        '<p class="step-lead">المعطى هو <strong>8 غ من H₂</strong>. نضع 8 فوق 4، والمجهول «س» فوق 36. المقابلة الصحيحة هي نصف الحل.</p>' +
        '<div class="lesson-visual is-mint">' +
        '<div class="visual-label">تناسب مسألة الماء</div>' +
        proportionHTML(h2, givenMass, h2o) +
        '<div class="visual-note">8 غ H₂ تقابل 4 غ H₂ في السطر الثاني… و«س» تقابل 36 غ H₂O.</div>' +
        '</div>' +
        '<div class="note-box is-coral">' + icon('target') +
        '<div>القاعدة: ضع المعطى فوق كميته في السطر الثاني، والمجهول فوق كمية المادة المطلوبة. لا تخلط بين مادتين مختلفتين.</div>' +
        '</div>' +
        quizBox('prop', 'إذا كان 4 غ من H₂ تعطي 36 غ ماء، فكم تعطي 8 غ؟',
          ['36 غ', '54 غ', '72 غ'], 2,
          'ضاعفنا المعطى من 4 إلى 8، لذلك يتضاعف الناتج من 36 إلى 72 غ.');
    }

    if (i === 4) {
      return '<span class="step-kicker">الحساب والتحقق</span>' +
        '<h3 class="step-title">اضرب بالتقاطع… ثم اطمئن</h3>' +
        '<p class="step-lead">نضرب الطرفين بالتقاطع: <strong>س = (8 × 36) ÷ 4 = 72 غ</strong>. وبعد الحساب نتحقق بعدد المولات، لا بالحدس فقط.</p>' +
        '<div class="lesson-visual is-green">' +
        '<div class="visual-label">النتيجة</div>' +
        '<div class="result-big"><strong>' + massNum(answer) + '</strong><span>غرام من الماء</span></div>' +
        '<div class="eq-caption">س = (8 × 36) ÷ 4</div>' +
        '<div class="check-row">' +
        '<span>' + icon('check') + ' 8 غ H₂ = 4 مول</span>' +
        '<span>' + icon('check') + ' 72 غ H₂O = 4 مول</span>' +
        '<span>' + icon('check') + ' الكتلة محفوظة</span>' +
        '</div>' +
        '</div>' +
        '<div class="note-box">' + icon('shield') +
        '<div>تحقق سريع: عدد مولات الماء الناتج يجب أن يحقق نسبة المعاملات. هنا 2H₂ → 2H₂O، أي 1:1، و4 مول تعطي 4 مول.</div>' +
        '</div>' +
        quizBox('check', 'ما أفضل طريقة للتحقق من صحة الجواب؟',
          ['مقارنة الرقم بالمعطى فقط', 'إعادة الحساب بعدد المولات', 'حذف الوحدات'], 1,
          'حساب المولات والرجوع إلى نسبة المعاملات يثبت أن الجواب متسق.');
    }

    var stepsList = DATA.solutionSteps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    return '<span class="step-kicker">الخلاصة</span>' +
      '<h3 class="step-title">خمس خطوات، وكل معادلة تصبح سهلة</h3>' +
      '<p class="step-lead">أعد ترتيب ذاكرتك: <strong>وازن، احسب الكتلة المولية، اكتب السطر الثاني، ضع التناسب، ثم تحقق</strong>. هذه هي مسألة السطرين كاملة.</p>' +
      '<div class="lesson-visual">' +
      '<div class="visual-label">وصفة الحل</div>' +
      '<ol class="solution-mini">' + stepsList + '</ol>' +
      '</div>' +
      '<div class="note-box is-mint">' + icon('flask') +
      '<div>الآن جرّب بنفسك: انتقل إلى المختبر لتغيير الكتلة والمادة، أو ابنِ الحل بالمكعبات في ورشة المكعبات.</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">' +
      '<button class="btn btn-primary" data-view="lab">' + icon('flask') + ' إلى المختبر</button>' +
      '<button class="btn btn-ghost" data-view="blocks">' + icon('blocks') + ' ورشة المكعبات</button>' +
      '</div>' +
      quizBox('done', 'ما أول خطوة في حل مسألة السطرين؟',
        ['كتابة التناسب', 'موازنة المعادلة', 'اختيار المادة المطلوبة'], 1,
        'بدون معادلة موزونة تكون النسب خاطئة، وكل ما بعدها خاطئ.');
  }

  function renderLesson() {
    var stage = $('#lessonStage');
    if (!stage) return;
    var idx = clamp(state.lesson.step || 0, 0, LESSON.length - 1);
    state.lesson.step = idx;
    if (state.lesson.visited.indexOf(idx) === -1) state.lesson.visited.push(idx);
    persist();

    stage.innerHTML = lessonStepHTML(idx);
    var row = stage.querySelector('[data-animate-masses]');
    if (row) {
      requestAnimationFrame(function () {
        setTimeout(function () { row.classList.add('show-masses'); }, 380);
      });
    }

    var list = $('#lessonStepList');
    if (list) {
      list.innerHTML = LESSON.map(function (s, i) {
        var done = state.lesson.visited.indexOf(i) !== -1;
        var cls = 'lesson-step-btn' + (i === idx ? ' is-active' : '') + (done ? ' is-done' : '');
        return '<li><button class="' + cls + '" type="button" data-step="' + i + '">' +
          '<span class="lesson-step-num"><span>' + (i + 1) + '</span></span>' +
          '<span class="lesson-step-txt"><strong>' + esc(s.title) + '</strong><small>' + esc(s.short) + '</small></span>' +
          '</button></li>';
      }).join('');
    }

    $('#lessonStepNum').textContent = idx + 1;
    var prog = (state.lesson.visited.length / LESSON.length) * 100;
    $('#lessonProgressBar').style.width = prog + '%';
    $('#lessonPrev').disabled = idx === 0;
    $('#lessonNext').innerHTML = idx === LESSON.length - 1
      ? 'إلى المختبر ' + icon('flask')
      : 'التالي ' + icon('chevron');
    $('#lessonStage').scrollTop = 0;

    if (state.lesson.visited.length === LESSON.length && !state.lessonBonus) {
      state.lessonBonus = true;
      persist();
      setTimeout(function () {
        unlockBadge('lesson');
        awardXP(50, 'أكملت الدرس');
        burst(100);
      }, 500);
    }
  }

  function goLesson(i) {
    state.lesson.step = clamp(i, 0, LESSON.length - 1);
    persist();
    renderLesson();
    SFX.click();
  }

  function bindLesson() {
    var stage = $('#lessonStage');
    if (!stage) return;

    stage.addEventListener('click', function (e) {
      var opt = e.target.closest('.quiz-opt');
      if (opt) {
        var box = opt.closest('.quiz-box');
        if (!box || box.dataset.done === '1') return;
        var correct = Number(box.dataset.correct);
        var val = Number(opt.getAttribute('data-opt'));
        var stepKey = box.getAttribute('data-quiz');
        var fb = box.querySelector('.quiz-feedback');
        if (val === correct) {
          opt.classList.add('is-correct');
          box.dataset.done = '1';
          fb.className = 'quiz-feedback ok';
          fb.textContent = 'أحسنت! إجابة صحيحة.';
          SFX.ok();
          burst(35);
          if (!state.lessonQuiz[stepKey]) {
            state.lessonQuiz[stepKey] = true;
            persist();
            awardXP(10, 'إجابة صحيحة');
          }
        } else {
          opt.classList.add('is-wrong');
          opt.disabled = true;
          fb.className = 'quiz-feedback bad';
          fb.textContent = 'ليست هذه. أعد قراءة السطر الثاني وجرّب مرة أخرى.';
          SFX.bad();
        }
        return;
      }
      var stepBtn = e.target.closest('[data-step]');
      if (stepBtn) {
        goLesson(Number(stepBtn.getAttribute('data-step')));
      }
    });

    $('#lessonPrev').addEventListener('click', function () {
      if (state.lesson.step > 0) goLesson(state.lesson.step - 1);
    });
    $('#lessonNext').addEventListener('click', function () {
      if (state.lesson.step < LESSON.length - 1) {
        goLesson(state.lesson.step + 1);
      } else {
        navigate('lab');
      }
    });
  }

  /* ======================================================================
     المختبر
     ====================================================================== */

  function labReaction() {
    return DATA.findReaction(state.lab.reactionId) || DATA.reactions[0];
  }

  function labGiven(reaction) {
    var sp = reaction.species.filter(function (s) { return s.formula === state.lab.given; })[0];
    return sp || reaction.species[0];
  }

  function labTarget(reaction, given) {
    var sp = reaction.species.filter(function (s) { return s.formula === state.lab.target; })[0];
    if (!sp || sp.formula === given.formula) {
      sp = reaction.species.filter(function (s) { return s.formula !== given.formula; })[0];
    }
    return sp;
  }

  function labMass(reaction) {
    var m = Number(state.lab.mass);
    if (!isFinite(m) || m <= 0) m = reaction.defaultMass;
    return clamp(m, 0.1, reaction.maxMass);
  }

  function labAnswer() {
    var reaction = labReaction();
    var given = labGiven(reaction);
    var target = labTarget(reaction, given);
    var mass = labMass(reaction);
    return {
      reaction: reaction,
      given: given,
      target: target,
      mass: mass,
      answer: round(mass * target.lineMass / given.lineMass, 2),
      givenMoles: mass / given.molarMass,
      targetMoles: (mass * target.lineMass / given.lineMass) / target.molarMass
    };
  }

  function renderLabReactions() {
    var strip = $('#labReactionStrip');
    if (!strip) return;
    strip.innerHTML = DATA.reactions.map(function (r) {
      return '<button class="reaction-chip" type="button" role="tab" data-reaction="' + r.id + '" aria-selected="false">' +
        '<span class="chip-icon">' + icon(r.icon) + '</span>' +
        '<span class="chip-txt"><strong>' + esc(r.title) + '</strong><small>' + Chem.formatFormula(r.eq.split('->')[0].trim().split(' ')[0] || '') + ' →</small></span>' +
        '</button>';
    }).join('');
  }

  function populateLabSelects() {
    var reaction = labReaction();
    var given = labGiven(reaction);
    var target = labTarget(reaction, given);
    var gs = $('#givenSelect');
    var ts = $('#targetSelect');
    if (!gs || !ts) return;

    function opts(list) {
      return list.map(function (s) {
        return '<option value="' + s.formula + '">' + s.formula + ' — ' + esc(speciesName(s)) + '</option>';
      }).join('');
    }
    gs.innerHTML = '<optgroup label="المتفاعلات">' + opts(reaction.reactants) + '</optgroup>' +
      '<optgroup label="النواتج">' + opts(reaction.products) + '</optgroup>';
    ts.innerHTML = '<optgroup label="المتفاعلات">' + opts(reaction.reactants) + '</optgroup>' +
      '<optgroup label="النواتج">' + opts(reaction.products) + '</optgroup>';
    gs.value = given.formula;
    ts.value = target.formula;

    var range = $('#massRange');
    var input = $('#massInput');
    var m = labMass(reaction);
    if (range) {
      range.min = reaction.maxMass <= 60 ? 0.5 : 1;
      range.max = reaction.maxMass;
      range.step = reaction.maxMass <= 100 ? 0.5 : reaction.maxMass <= 400 ? 1 : 5;
      range.value = m;
    }
    if (input) {
      input.max = reaction.maxMass;
      input.value = m;
    }
    var rm = $('#rangeMax');
    if (rm) rm.textContent = reaction.maxMass + ' غ';
  }

  function setLabReaction(id, extra) {
    var reaction = DATA.findReaction(id);
    if (!reaction) return;
    state.lab.reactionId = id;
    if (extra && extra.given) state.lab.given = extra.given;
    else state.lab.given = reaction.givenId;
    if (extra && extra.target && extra.target !== state.lab.given) state.lab.target = extra.target;
    else state.lab.target = reaction.targetId;
    if (state.lab.target === state.lab.given) {
      var alt = reaction.species.filter(function (s) { return s.formula !== state.lab.given; })[0];
      if (alt) state.lab.target = alt.formula;
    }
    state.lab.mass = extra && extra.mass ? extra.mass : reaction.defaultMass;
    persist();
    populateLabSelects();
    renderLab();
  }

  function renderLabMain() {
    var reaction = labReaction();
    var given = labGiven(reaction);
    var target = labTarget(reaction, given);
    var mass = labMass(reaction);
    var answer = round(mass * target.lineMass / given.lineMass, 2);

    var board = $('#labBoard');
    if (board) {
      board.innerHTML = eqSequenceHTML(reaction, {
        masses: true,
        given: given.formula,
        target: target.formula
      });
    }
    var title = $('#labReactionTitle');
    if (title) title.textContent = reaction.title;
    var tag = $('#labTag');
    if (tag) tag.textContent = reaction.tag;
    var fact = $('#labFact');
    if (fact) fact.textContent = reaction.fact;

    var ratio = round(target.lineMass / given.lineMass, 2);
    var why = $('#labWhy');
    if (why) {
      why.textContent = 'في المعادلة، كل ' + massNum(given.lineMass) + ' غ من ' + speciesName(given) +
        ' تقابل ' + massNum(target.lineMass) + ' غ من ' + speciesName(target) + '. كتلتك المعطاة ' +
        massNum(mass) + ' غ، لذلك نضرب ' + massNum(mass) + ' × (' + massNum(target.lineMass) + ' ÷ ' + massNum(given.lineMass) + ').';
    }

    renderLabViz(given, target, mass, answer);

    var ansBox = $('#labAnswer');
    if (ansBox) {
      ansBox.innerHTML =
        '<div class="answer-label"><small>كتلة المادة المطلوبة</small><strong>' + esc(speciesName(target)) + '</strong></div>' +
        '<div class="answer-value"><b>' + massNum(answer) + '</b><span>غرام</span></div>' +
        '<div class="answer-sub">تعادل ' + num(answer / target.molarMass) + ' مول من ' + Chem.formatFormula(target.formula) +
        (state.lab.moles ? '<br>و' + num(mass / given.molarMass) + ' مول من المعطى' : '') + '</div>';
    }

    renderLabSteps(reaction, given, target, mass, answer);
    renderLabMeta(reaction, given, target, mass, answer);
  }

  function renderLabViz(given, target, mass, answer) {
    var box = $('#labViz');
    if (!box) return;
    var max = Math.max(mass, answer, 0.0001);
    var gH = 18 + (mass / max) * 62;
    var tH = 18 + (answer / max) * 62;
    box.innerHTML =
      '<div class="viz-row">' +
      '<div class="viz-bubble-wrap">' + moleculeSVG(given.formula, 42) +
      '<div class="viz-bubble is-given"><i style="height:' + gH + '%"></i></div>' +
      '<div class="viz-bubble-label"><b>' + massNum(mass) + ' غ</b>' + esc(speciesName(given)) + '</div></div>' +
      '<div class="viz-arrow">→</div>' +
      '<div class="viz-bubble-wrap">' + moleculeSVG(target.formula, 42) +
      '<div class="viz-bubble is-target"><i style="height:' + tH + '%"></i></div>' +
      '<div class="viz-bubble-label"><b>' + massNum(answer) + ' غ</b>' + esc(speciesName(target)) + '</div></div>' +
      '</div>';
  }

  function renderLabSteps(reaction, given, target, mass, answer) {
    var box = $('#labSteps');
    if (!box) return;
    var steps = [];

    steps.push({
      title: 'اكتب المعادلة الموزونة',
      body: '<div class="eq-showcase">' + eqSequenceHTML(reaction, {}) + '</div>' +
        '<p>المعاملات تعطينا النِّسَب: ' + reaction.species.map(function (s) {
          return (s.coef > 1 ? s.coef + ' ' : '') + Chem.formatFormula(s.formula);
        }).join(' + ') + '.</p>'
    });

    steps.push({
      title: 'اكتب السطر الثاني',
      body: '<div class="eq-showcase">' + eqSequenceHTML(reaction, { masses: true }) + '</div>' +
        '<p>' + reaction.species.map(function (s) {
          return '<span dir="ltr">' + s.coef + ' × ' + massNum(s.molarMass) + ' = ' + massNum(s.lineMass) + ' غ</span>';
        }).join(' &nbsp;·&nbsp; ') + '</p>'
    });

    steps.push({
      title: 'ضع المعطى والمجهول',
      body: proportionHTML(given, mass, target) +
        '<p>المعطى ' + massNum(mass) + ' غ من ' + esc(speciesName(given)) + '، والمجهول س كتلة ' +
        esc(speciesName(target)) + '.</p>'
    });

    steps.push({
      title: 'حل التناسب',
      body: '<div class="math-line">س = (' + massNum(mass) + ' × ' + massNum(target.lineMass) + ') ÷ ' +
        massNum(given.lineMass) + ' = <b>' + massNum(answer) + ' غ</b></div>' +
        '<p>نضرب الطرفين بالتقاطع ثم نقسم على الكمية المقابلة للمادة المعطاة.</p>'
    });

    if (state.lab.moles) {
      var gm = mass / given.molarMass;
      var tm = answer / target.molarMass;
      steps.push({
        title: 'طريق ثانٍ: المولات',
        body: '<div class="math-line">n(' + Chem.formatFormula(given.formula) + ') = ' + massNum(mass) + ' ÷ ' +
          massNum(given.molarMass) + ' = ' + num(gm) + ' مول</div>' +
          '<div class="math-line">n(' + Chem.formatFormula(target.formula) + ') = ' + num(gm) + ' × (' +
          target.coef + ' ÷ ' + given.coef + ') = ' + num(tm) + ' مول</div>' +
          '<div class="math-line">m = ' + num(tm) + ' × ' + massNum(target.molarMass) + ' = <b>' +
          massNum(answer) + ' غ</b></div>' +
          '<p>الطريقان يجب أن يعطيا النتيجة نفسها. هذه أفضل طريقة للتحقق.</p>'
      });
    }

    steps.push({
      title: 'تحقق من النتيجة',
      body: '<div class="check-row" style="justify-content:flex-start">' +
        '<span>' + icon('check') + ' مولات المعطى: ' + num(mass / given.molarMass) + '</span>' +
        '<span>' + icon('check') + ' مولات الناتج: ' + num(answer / target.molarMass) + '</span>' +
        '<span>' + icon('check') + ' الكتلة محفوظة</span>' +
        '</div>' +
        '<p>كتلة المعادلة كاملة (بالنسب): ' + massNum(reaction.totalMass) + ' غ. النسبة بين السطرين ثابتة مهما تغيّر المعطى.</p>'
    });

    box.innerHTML = steps.map(function (s, i) {
      return '<li><details class="sol-step"' + (i < 3 ? ' open' : '') + '>' +
        '<summary><span class="sol-num">' + (i + 1) + '</span>' + esc(s.title) + '</summary>' +
        '<div class="sol-body">' + s.body + '</div>' +
        '</details></li>';
    }).join('');
  }

  function renderLabMeta(reaction, given, target, mass, answer) {
    var box = $('#labMeta');
    if (!box) return;
    box.innerHTML =
      '<span class="meta-chip">' + icon('atom') + ' مولات المعطى <b>' + num(mass / given.molarMass) + '</b></span>' +
      '<span class="meta-chip">' + icon('drop') + ' مولات الناتج <b>' + num(answer / target.molarMass) + '</b></span>' +
      '<span class="meta-chip">' + icon('scale') + ' كتلة المعادلة <b>' + massNum(reaction.totalMass) + ' غ</b></span>' +
      '<span class="meta-chip">' + icon('check') + ' ' + (Math.abs((mass / given.molarMass) - (answer / target.molarMass) * (given.coef / target.coef)) < 0.0001 ? 'النسبة سليمة' : 'راجع الحساب') + '</span>';
  }

  var labFrame = null;
  function scheduleLab() {
    if (labFrame) return;
    labFrame = requestAnimationFrame(function () {
      labFrame = null;
      renderLabMain();
    });
  }

  function renderLab() {
    if (!$('#labBoard')) return;
    var reaction = labReaction();
    var given = labGiven(reaction);
    var target = labTarget(reaction, given);
    if (!$$('#labReactionStrip .reaction-chip').length) renderLabReactions();

    if (state.lab.given !== given.formula) state.lab.given = given.formula;
    if (state.lab.target !== target.formula) state.lab.target = target.formula;
    state.lab.mass = labMass(reaction);

    $$('#labReactionStrip .reaction-chip').forEach(function (c) {
      var on = c.getAttribute('data-reaction') === reaction.id;
      c.classList.toggle('is-active', on);
      c.setAttribute('aria-selected', on ? 'true' : 'false');
    });

    var gs = $('#givenSelect');
    var ts = $('#targetSelect');
    if (gs && !gs.options.length) populateLabSelects();
    if (gs) gs.value = given.formula;
    if (ts) ts.value = target.formula;
    var range = $('#massRange');
    if (range && document.activeElement !== range) range.value = state.lab.mass;
    var input = $('#massInput');
    if (input && document.activeElement !== input) input.value = state.lab.mass;
    var maxEl = $('#rangeMax');
    if (maxEl) maxEl.textContent = reaction.maxMass + ' غ';
    var molesBtn = $('#labMolesBtn');
    if (molesBtn) {
      molesBtn.setAttribute('aria-pressed', state.lab.moles ? 'true' : 'false');
      molesBtn.innerHTML = state.lab.moles ? 'بالمولات ✓' : 'بالمولات';
    }

    renderLabMain();
  }

  function saveLabProblem() {
    var data = labAnswer();
    var record = {
      id: Date.now(),
      reactionId: data.reaction.id,
      reactionTitle: data.reaction.title,
      eq: data.reaction.eq,
      given: data.given.formula,
      givenName: speciesName(data.given),
      target: data.target.formula,
      targetName: speciesName(data.target),
      mass: data.mass,
      answer: data.answer,
      date: new Date().toISOString()
    };
    state.saved.unshift(record);
    if (state.saved.length > 30) state.saved = state.saved.slice(0, 30);
    persist();
    toast('حُفظت المسألة في دفترك', 'is-badge', 'book');
    SFX.ok();
    if (currentView === 'me') renderMe();
  }

  function bindLab() {
    var strip = $('#labReactionStrip');
    if (strip) {
      strip.addEventListener('click', function (e) {
        var chip = e.target.closest('[data-reaction]');
        if (!chip) return;
        setLabReaction(chip.getAttribute('data-reaction'));
        SFX.click();
      });
    }

    $('#givenSelect').addEventListener('change', function () {
      state.lab.given = this.value;
      var reaction = labReaction();
      if (this.value === state.lab.target) {
        var alt = reaction.species.filter(function (s) { return s.formula !== this.value; }, this)[0];
        if (alt) {
          state.lab.target = alt.formula;
          $('#targetSelect').value = alt.formula;
        }
      }
      persist();
      renderLab();
    });

    $('#targetSelect').addEventListener('change', function () {
      state.lab.target = this.value;
      var reaction = labReaction();
      if (this.value === state.lab.given) {
        var alt = reaction.species.filter(function (s) { return s.formula !== this.value; }, this)[0];
        if (alt) {
          state.lab.given = alt.formula;
          $('#givenSelect').value = alt.formula;
        }
      }
      persist();
      renderLab();
    });

    $('#massInput').addEventListener('input', function () {
      var v = parseFloat(this.value);
      if (!isFinite(v) || v <= 0) return;
      state.lab.mass = v;
      var range = $('#massRange');
      if (range) range.value = clamp(v, Number(range.min), Number(range.max));
      persist();
      scheduleLab();
    });

    $('#massRange').addEventListener('input', function () {
      state.lab.mass = parseFloat(this.value);
      var input = $('#massInput');
      if (input) input.value = this.value;
      persist();
      scheduleLab();
    });

    $('#labMolesBtn').addEventListener('click', function () {
      state.lab.moles = !state.lab.moles;
      this.setAttribute('aria-pressed', state.lab.moles ? 'true' : 'false');
      persist();
      renderLabMain();
      SFX.click();
    });

    $('#labSolveBtn').addEventListener('click', function () {
      var data = labAnswer();
      state.counters.solved++;
      persist();
      if (state.counters.solved === 1) unlockBadge('firstSolve');
      if (state.counters.solved >= 10) unlockBadge('solver10');
      awardXP(5, 'مسألة محلولة');
      SFX.ok();
      var ans = $('#labAnswer');
      if (ans) {
        ans.classList.remove('is-pulse');
        void ans.offsetWidth;
        ans.classList.add('is-pulse');
        ans.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
      }
      burst(30);
      toast('الجواب: ' + massNum(data.answer) + ' غ من ' + speciesName(data.target), '', 'check');
    });

    $('#labRandomBtn').addEventListener('click', function () {
      var r = pick(DATA.reactions);
      var species = r.species;
      var gi = Math.floor(Math.random() * species.length);
      var ti = (gi + 1 + Math.floor(Math.random() * (species.length - 1))) % species.length;
      var factors = [0.5, 1, 1.5, 2, 2.5];
      var m = round(r.defaultMass * pick(factors), 1);
      setLabReaction(r.id, {
        given: species[gi].formula,
        target: species[ti].formula,
        mass: clamp(m, 0.5, r.maxMass)
      });
      SFX.pop();
      toast('مسألة جديدة: ' + r.title, '', 'refresh');
      var panel = $('.lab-panel');
      if (panel && window.innerWidth < 1024) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    $('#labSaveBtn').addEventListener('click', saveLabProblem);

    $$('[data-close-confirm]').forEach(function (b) {
      b.addEventListener('click', function () {
        var d = $('#confirmDialog');
        if (d) d.close();
      });
    });
  }

  /* ======================================================================
     ورشة المكعبات
     ====================================================================== */

  var blockState = {
    reactionId: 'water',
    stage: 1,
    coef: [],
    coefSel: null,
    mass: [],
    massSel: null,
    prop: [null, null, null],
    propSel: null,
    answer: '',
    done: { 1: false, 2: false, 3: false }
  };

  function blockReaction() {
    return DATA.findReaction(blockState.reactionId) || DATA.reactions[0];
  }

  function resetBlockStage(stageOnly) {
    var reaction = blockReaction();
    if (!stageOnly) {
      blockState.done = { 1: false, 2: false, 3: false };
      blockState.stage = 1;
    }
    blockState.coef = reaction.species.map(function () { return null; });
    blockState.coefSel = null;
    blockState.mass = reaction.species.map(function () { return null; });
    blockState.massSel = null;
    blockState.prop = [null, null, null];
    blockState.propSel = null;
    blockState.answer = '';
    blockState.feedback = '';
    state.blocks.reactionId = reaction.id;
    state.blocks.stage = blockState.stage;
    persist();
  }

  function resetBlockReaction(id) {
    blockState.reactionId = id;
    resetBlockStage(false);
    renderBlocks();
  }

  function blockProgress() {
    return [1, 2, 3].filter(function (s) { return blockState.done[s]; }).length;
  }

  function blockTrayValues() {
    var reaction = blockReaction();
    if (blockState.stage === 1) {
      var max = Math.max.apply(null, reaction.species.map(function (s) { return s.coef; }).concat([3]));
      var vals = [];
      for (var i = 1; i <= Math.max(4, max); i++) vals.push(i);
      return shuffle(vals);
    }
    if (blockState.stage === 2) {
      var correct = reaction.species.map(function (s) { return s.lineMass; });
      var extras = [];
      reaction.species.forEach(function (s) {
        extras.push(s.molarMass);
        extras.push(s.lineMass * 2);
      });
      extras.push(reaction.totalMass);
      var all = unique(correct.concat(extras)).filter(function (v) { return v > 0; });
      var wrong = shuffle(all.filter(function (v) { return correct.indexOf(v) === -1; })).slice(0, 4);
      return shuffle(correct.concat(wrong));
    }
    var given = reaction.species.filter(function (s) { return s.formula === reaction.givenId; })[0] || reaction.species[0];
    var target = reaction.species.filter(function (s) { return s.formula === reaction.targetId; })[0] || reaction.species[1];
    var vals2 = [reaction.defaultMass, given.lineMass, target.lineMass];
    var distractor = target.molarMass;
    if (vals2.indexOf(distractor) !== -1) distractor = given.molarMass;
    if (vals2.indexOf(distractor) !== -1) distractor = reaction.totalMass;
    return shuffle(vals2.concat([distractor]));
  }

  function blockBoardHTML(reaction) {
    var html = '<div class="balance-row" dir="ltr">';
    eqTokens(reaction).forEach(function (tok) {
      if (tok.t === 'op') {
        html += '<div class="balance-op' + (tok.arrow ? ' balance-arrow' : '') + '">' + tok.v + '</div>';
        return;
      }
      var idx = reaction.species.indexOf(tok.sp);
      if (blockState.stage === 1) {
        var v = blockState.coef[idx];
        html += '<div class="balance-term">' +
          '<button class="coef-slot' + (v != null ? ' is-filled' : '') + '" type="button" data-coef-slot="' + idx + '" aria-label="معامل ' + esc(tok.sp.formula) + '">' +
          (v != null ? v : '؟') + '</button>' +
          '<span class="balance-formula">' + Chem.formatFormula(tok.sp.formula) + '</span>' +
          '</div>';
      } else {
        var mv = blockState.mass[idx];
        html += '<div class="balance-term">' +
          '<span class="balance-formula"><span class="eq-coef">' + tok.sp.coef + '</span>' + Chem.formatFormula(tok.sp.formula) + '</span>' +
          '<button class="mass-slot' + (mv != null ? ' is-filled' : '') + '" type="button" data-mass-slot="' + idx + '" aria-label="كتلة ' + esc(tok.sp.formula) + '">' +
          (mv != null ? massNum(mv) + ' غ' : '؟') + '</button>' +
          '</div>';
      }
    });
    html += '</div>';
    return html;
  }

  function blockTrayHTML(reaction) {
    var vals = blockTrayValues();
    var kind = blockState.stage === 1 ? 'coef' : 'mass';
    return '<div class="block-tray">' +
      '<div class="tray-label">' + (kind === 'coef' ? 'مكعبات المعاملات — اختر ثم اضغط الفراغ' : 'مكعبات الكتل — اختر ثم اضغط الفراغ') + '</div>' +
      vals.map(function (v) {
        var selected = kind === 'coef' ? blockState.coefSel === v : blockState.massSel === v;
        return '<button class="block-tile' + (kind === 'mass' ? ' mass' : '') + (selected ? ' is-selected' : '') + '" type="button" draggable="true" data-tile="' + kind + '" data-val="' + v + '">' +
          (kind === 'coef' ? v : massNum(v) + ' غ') + '</button>';
      }).join('') +
      '</div>';
  }

  function elementBalance(reaction, coefs) {
    var totals = {};
    reaction.species.forEach(function (sp, i) {
      var c = coefs[i] == null ? 0 : coefs[i];
      Object.keys(sp.counts).forEach(function (el) {
        if (!totals[el]) totals[el] = { left: 0, right: 0 };
        totals[el][sp.side === 'left' ? 'left' : 'right'] += c * sp.counts[el];
      });
    });
    return totals;
  }

  function stageOneHTML(reaction) {
    return '<div class="stage-head"><span class="stage-head-num">1</span><div>' +
      '<h3>وازن المعادلة</h3>' +
      '<p>ضع المعامل الصحيح أمام كل مادة. تذكّر: عدد ذرات كل عنصر يجب أن يتساوى في الطرفين.</p>' +
      '</div></div>' +
      '<div class="balance-board">' + blockBoardHTML(reaction) + '</div>' +
      blockTrayHTML(reaction) +
      '<div class="stage-actions">' +
      '<span class="stage-status">' + (blockState.coef.filter(function (v) { return v != null; }).length + ' / ' + reaction.species.length + ' فراغات مملوءة') + '</span>' +
      '<button class="btn btn-primary btn-sm" type="button" data-check="1">' + icon('check') + ' تحقق من الموازنة</button>' +
      '</div>';
  }

  function stageTwoHTML(reaction) {
    return '<div class="stage-head"><span class="stage-head-num">2</span><div>' +
      '<h3>اكتب السطر الثاني</h3>' +
      '<p>ضع تحت كل مادة كتلتها في السطر الثاني: المعامل × الكتلة المولية.</p>' +
      '</div></div>' +
      '<div class="balance-board">' + blockBoardHTML(reaction) + '</div>' +
      blockTrayHTML(reaction) +
      '<div class="stage-actions">' +
      '<span class="stage-status">' + (blockState.mass.filter(function (v) { return v != null; }).length + ' / ' + reaction.species.length + ' فراغات مملوءة') + '</span>' +
      '<button class="btn btn-primary btn-sm" type="button" data-check="2">' + icon('check') + ' تحقق من السطر الثاني</button>' +
      '</div>';
  }

  function stageThreeHTML(reaction) {
    var given = reaction.species.filter(function (s) { return s.formula === reaction.givenId; })[0] || reaction.species[0];
    var target = reaction.species.filter(function (s) { return s.formula === reaction.targetId; })[0] || reaction.species[1];
    var givenMass = reaction.defaultMass;
    var vals = blockTrayValues();
    return '<div class="stage-head"><span class="stage-head-num">3</span><div>' +
      '<h3>ركّب التناسب واحسب س</h3>' +
      '<p>المعطى: <b>' + massNum(givenMass) + ' غ</b> من ' + esc(speciesName(given)) + '. ضع الأرقام في أماكنها ثم احسب كتلة ' + esc(speciesName(target)) + '.</p>' +
      '</div></div>' +
      '<div class="prop-builder">' +
      '<div class="prop-frac">' +
      '<button class="prop-slot' + (blockState.prop[0] != null ? ' is-filled' : '') + '" type="button" data-prop-slot="0">' +
      (blockState.prop[0] != null ? massNum(blockState.prop[0]) + ' غ' : '؟') + '</button>' +
      '<div class="prop-bar"></div>' +
      '<button class="prop-slot' + (blockState.prop[1] != null ? ' is-filled' : '') + '" type="button" data-prop-slot="1">' +
      (blockState.prop[1] != null ? massNum(blockState.prop[1]) + ' غ' : '؟') + '</button>' +
      '</div>' +
      '<span class="prop-eq-sign">=</span>' +
      '<div class="prop-frac">' +
      '<span class="prop-slot is-fixed">س</span>' +
      '<div class="prop-bar"></div>' +
      '<button class="prop-slot' + (blockState.prop[2] != null ? ' is-filled' : '') + '" type="button" data-prop-slot="2">' +
      (blockState.prop[2] != null ? massNum(blockState.prop[2]) + ' غ' : '؟') + '</button>' +
      '</div>' +
      '</div>' +
      '<div class="block-tray">' +
      '<div class="tray-label">مكعبات التناسب</div>' +
      vals.map(function (v) {
        var selected = blockState.propSel === v;
        return '<button class="block-tile mass' + (selected ? ' is-selected' : '') + '" type="button" draggable="true" data-tile="prop" data-val="' + v + '">' + massNum(v) + ' غ</button>';
      }).join('') +
      '</div>' +
      '<div class="answer-input-row">' +
      '<label for="blockAnswer">س =</label>' +
      '<input id="blockAnswer" type="number" step="0.1" min="0" value="' + esc(blockState.answer) + '" placeholder="؟">' +
      '<span class="unit">غرام</span>' +
      '</div>' +
      '<div class="stage-actions">' +
      '<span class="stage-status">' + (blockState.prop.filter(function (v) { return v != null; }).length + ' / 3 أرقام موضوعة') + '</span>' +
      '<button class="btn btn-primary btn-sm" type="button" data-check="3">' + icon('check') + ' تحقق من الحل</button>' +
      '</div>';
  }

  function completionHTML(reaction) {
    var given = reaction.species.filter(function (s) { return s.formula === reaction.givenId; })[0] || reaction.species[0];
    var target = reaction.species.filter(function (s) { return s.formula === reaction.targetId; })[0] || reaction.species[1];
    var answer = reaction.defaultMass * target.lineMass / given.lineMass;
    return '<div class="workshop-done">' +
      '<div class="done-medal">' + icon('crown') + '</div>' +
      '<h3>أكملت الورشة</h3>' +
      '<p>وازنت المعادلة، كتبت السطر الثاني، وركّبت التناسب. هذه هي مسألة السطرين كاملة.</p>' +
      '<div class="done-eq">' + eqSequenceHTML(reaction, { masses: true }) + '</div>' +
      '<div class="done-answer">الجواب: <b>' + massNum(answer) + ' غ</b> من ' + esc(speciesName(target)) + '</div>' +
      '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:16px">' +
      '<button class="btn btn-primary btn-sm" type="button" data-new-block="1">' + icon('refresh') + ' تفاعل جديد</button>' +
      '<button class="btn btn-ghost btn-sm" data-view="lab">' + icon('flask') + ' جرّب في المختبر</button>' +
      '</div></div>';
  }

  function renderBlocks() {
    var host = $('#blocksStage');
    if (!host) return;
    var reaction = blockReaction();
    if (!host.dataset.init) {
      host.dataset.init = '1';
      var stored = DATA.findReaction(state.blocks.reactionId);
      blockState.reactionId = stored ? stored.id : 'water';
      blockState.stage = 1;
      resetBlockStage(false);
      reaction = blockReaction();
    }
    if (!$$('#blockReactions .reaction-chip').length) renderBlockReactions();
    if (blockState.coef.length !== reaction.species.length) resetBlockStage(false);

    $$('#blockReactions .reaction-chip').forEach(function (c) {
      var on = c.getAttribute('data-reaction') === reaction.id;
      c.classList.toggle('is-active', on);
      c.setAttribute('aria-selected', on ? 'true' : 'false');
    });

    $$('#stageTrack .stage-pill').forEach(function (p) {
      var s = Number(p.getAttribute('data-stage'));
      p.classList.toggle('is-active', s === blockState.stage);
      p.classList.toggle('is-done', !!blockState.done[s]);
    });

    var count = blockProgress();
    var xpBadge = $('#blocksXp');
    if (xpBadge) xpBadge.innerHTML = icon('blocks') + ' <span>' + count + '/3 مراحل</span>';

    var allDone = blockState.done[1] && blockState.done[2] && blockState.done[3];
    if (allDone) {
      host.innerHTML = completionHTML(reaction);
    } else if (blockState.stage === 1) {
      host.innerHTML = stageOneHTML(reaction);
    } else if (blockState.stage === 2) {
      host.innerHTML = stageTwoHTML(reaction);
    } else {
      host.innerHTML = stageThreeHTML(reaction);
    }

    var fb = $('#blocksFeedback');
    if (fb) {
      fb.className = 'blocks-feedback' + (blockState.feedbackKind ? ' ' + blockState.feedbackKind : '');
      fb.innerHTML = blockState.feedback || '';
    }

    var ansInput = $('#blockAnswer');
    if (ansInput) {
      ansInput.addEventListener('input', function () { blockState.answer = this.value; });
    }
  }

  function renderBlockReactions() {
    var host = $('#blockReactions');
    if (!host) return;
    host.innerHTML = DATA.reactions.slice(0, 8).map(function (r) {
      return '<button class="reaction-chip" type="button" role="tab" data-reaction="' + r.id + '">' +
        '<span class="chip-icon">' + icon(r.icon) + '</span>' +
        '<span class="chip-txt"><strong>' + esc(r.title) + '</strong><small>' + Chem.formatFormula(r.eq.split('->')[0].trim()) + ' →</small></span>' +
        '</button>';
    }).join('');
  }

  function blockSetFeedback(text, kind) {
    blockState.feedback = text;
    blockState.feedbackKind = kind || '';
  }

  function checkStageOne() {
    var reaction = blockReaction();
    if (blockState.coef.indexOf(null) !== -1) {
      blockSetFeedback('املأ كل الفراغات أولاً. عندك ' + blockState.coef.filter(function (v) { return v != null; }).length + ' من ' + reaction.species.length + '.', 'bad');
      SFX.bad();
      return;
    }
    var expected = reaction.species.map(function (s) { return s.coef; });
    var ok = blockState.coef.every(function (v, i) { return v === expected[i]; });
    var slots = $$('#blocksStage [data-coef-slot]');
    if (ok) {
      blockState.done[1] = true;
      blockSetFeedback('موازنة صحيحة! انتقل للسطر الثاني.', 'ok');
      state.counters.blocks++;
      persist();
      awardXP(25, 'وازنت المعادلة');
      SFX.win();
      burst(70);
      blockState.stage = 2;
      state.blocks.stage = 2;
      persist();
      renderBlocks();
      return;
    }
    blockState.coef.forEach(function (v, i) {
      if (slots[i]) slots[i].classList.add(v === expected[i] ? 'is-right' : 'is-wrong');
    });
    var totals = elementBalance(reaction, blockState.coef);
    var bad = Object.keys(totals).filter(function (el) { return totals[el].left !== totals[el].right; });
    var detail = bad.slice(0, 3).map(function (el) {
      return '<span dir="ltr">' + el + ': ' + totals[el].left + ' ← / → ' + totals[el].right + '</span>';
    }).join(' &nbsp;·&nbsp; ');
    blockSetFeedback('ليست موزونة بعد. ' + (detail ? 'اختلّت هذه العناصر: ' + detail : 'راجع المعاملات.'), 'bad');
    SFX.bad();
  }

  function checkStageTwo() {
    var reaction = blockReaction();
    if (blockState.mass.indexOf(null) !== -1) {
      blockSetFeedback('املأ كل فراغات الكتل أولاً.', 'bad');
      SFX.bad();
      return;
    }
    var expected = reaction.species.map(function (s) { return s.lineMass; });
    var ok = blockState.mass.every(function (v, i) { return Math.abs(v - expected[i]) < 0.001; });
    var slots = $$('#blocksStage [data-mass-slot]');
    if (ok) {
      blockState.done[2] = true;
      blockSetFeedback('سطر الكميات صحيح! الآن ركّب التناسب.', 'ok');
      awardXP(30, 'كتبت السطر الثاني');
      SFX.win();
      burst(70);
      blockState.stage = 3;
      state.blocks.stage = 3;
      persist();
      renderBlocks();
      return;
    }
    blockState.mass.forEach(function (v, i) {
      if (slots[i]) slots[i].classList.add(Math.abs(v - expected[i]) < 0.001 ? 'is-right' : 'is-wrong');
    });
    blockSetFeedback('راجع الضرب: الكتلة = المعامل × الكتلة المولية. لا تنسَ المعامل!', 'bad');
    SFX.bad();
  }

  function checkStageThree() {
    var reaction = blockReaction();
    var given = reaction.species.filter(function (s) { return s.formula === reaction.givenId; })[0] || reaction.species[0];
    var target = reaction.species.filter(function (s) { return s.formula === reaction.targetId; })[0] || reaction.species[1];
    var expected = [reaction.defaultMass, given.lineMass, target.lineMass];
    var answer = round(reaction.defaultMass * target.lineMass / given.lineMass, 2);

    if (blockState.prop.indexOf(null) !== -1) {
      blockSetFeedback('ضع الأرقام الثلاثة في أماكنها أولاً.', 'bad');
      SFX.bad();
      return;
    }
    var propOk = blockState.prop.every(function (v, i) { return Math.abs(v - expected[i]) < 0.001; });
    var slots = $$('#blocksStage [data-prop-slot]');
    if (!propOk) {
      blockState.prop.forEach(function (v, i) {
        if (slots[i]) slots[i].classList.add(Math.abs(v - expected[i]) < 0.001 ? 'is-right' : 'is-wrong');
      });
      blockSetFeedback('التناسب غير مرتّب. المعطى فوق كميته في السطر الثاني، والمجهول فوق كتلة المطلوب.', 'bad');
      SFX.bad();
      return;
    }
    var val = parseFloat(blockState.answer);
    if (!isFinite(val) || Math.abs(val - answer) > Math.max(0.1, answer * 0.01)) {
      var inp = $('#blockAnswer');
      if (inp) inp.classList.add('is-wrong');
      blockSetFeedback('التناسب صحيح، لكن الحساب النهائي غير دقيق. س = (' + massNum(reaction.defaultMass) + ' × ' + massNum(target.lineMass) + ') ÷ ' + massNum(given.lineMass) + '.', 'bad');
      SFX.bad();
      return;
    }
    blockState.done[3] = true;
    state.counters.blocks++;
    persist();
    unlockBadge('blocks');
    awardXP(50, 'أكملت ورشة المكعبات');
    SFX.win();
    burst(140);
    renderBlocks();
  }

  function blockHint() {    var reaction = blockReaction();
    if (blockState.stage === 1) {
      var idx = blockState.coef.findIndex(function (v, i) { return v !== reaction.species[i].coef; });
      if (idx === -1) idx = 0;
      blockSetFeedback('تلميح: معامل ' + Chem.formatFormula(reaction.species[idx].formula) + ' هو ' + reaction.species[idx].coef + '.', '');
    } else if (blockState.stage === 2) {
      var j = blockState.mass.findIndex(function (v, i) { return v !== reaction.species[i].lineMass; });
      if (j === -1) j = 0;
      var sp = reaction.species[j];
      blockSetFeedback('تلميح: كتلة ' + Chem.formatFormula(sp.formula) + ' = ' + sp.coef + ' × ' + massNum(sp.molarMass) + ' = ' + massNum(sp.lineMass) + ' غ.', '');
    } else {
      var given = reaction.species.filter(function (s) { return s.formula === reaction.givenId; })[0] || reaction.species[0];
      var target = reaction.species.filter(function (s) { return s.formula === reaction.targetId; })[0] || reaction.species[1];
      blockSetFeedback('تلميح: ضع ' + massNum(reaction.defaultMass) + ' غ فوق ' + massNum(given.lineMass) + ' غ، و«س» فوق ' + massNum(target.lineMass) + ' غ.', '');
    }
    renderBlocks();
    SFX.click();
  }

  function goBlockStage(target) {
    if (target === 1 || (target === 2 && blockState.done[1]) || (target === 3 && blockState.done[2])) {
      blockState.stage = target;
      state.blocks.stage = target;
      persist();
      blockSetFeedback('', '');
      renderBlocks();
      SFX.click();
    } else {
      toast('أكمل المرحلة السابقة أولاً', '', 'lock');
      SFX.bad();
    }
  }

  function bindBlocks() {
    var host = $('#blockReactions');
    if (host) {
      host.addEventListener('click', function (e) {
        var chip = e.target.closest('[data-reaction]');
        if (!chip) return;
        if (chip.getAttribute('data-reaction') === blockState.reactionId) return;
        resetBlockReaction(chip.getAttribute('data-reaction'));
        SFX.click();
      });
    }

    var track = $('#stageTrack');
    if (track) {
      track.addEventListener('click', function (e) {
        var pill = e.target.closest('[data-stage]');
        if (!pill) return;
        goBlockStage(Number(pill.getAttribute('data-stage')));
      });
    }

    var stage = $('#blocksStage');
    if (!stage) return;

    stage.addEventListener('click', function (e) {
      var tile = e.target.closest('.block-tile');
      if (tile) {
        var kind = tile.getAttribute('data-tile');
        var val = parseFloat(tile.getAttribute('data-val'));
        if (kind === 'coef') blockState.coefSel = blockState.coefSel === val ? null : val;
        if (kind === 'mass') blockState.massSel = blockState.massSel === val ? null : val;
        if (kind === 'prop') blockState.propSel = blockState.propSel === val ? null : val;
        renderBlocks();
        SFX.click();
        return;
      }

      var coefSlot = e.target.closest('[data-coef-slot]');
      if (coefSlot) {
        var ci = Number(coefSlot.getAttribute('data-coef-slot'));
        if (blockState.coefSel != null) {
          blockState.coef[ci] = blockState.coefSel;
          blockState.coefSel = null;
          blockSetFeedback('', '');
          renderBlocks();
          SFX.pop();
        } else if (blockState.coef[ci] != null) {
          blockState.coef[ci] = null;
          renderBlocks();
          SFX.click();
        } else {
          blockSetFeedback('اختر مكعباً من الأسفل أولاً.', '');
          renderBlocks();
        }
        return;
      }

      var massSlot = e.target.closest('[data-mass-slot]');
      if (massSlot) {
        var mi = Number(massSlot.getAttribute('data-mass-slot'));
        if (blockState.massSel != null) {
          blockState.mass[mi] = blockState.massSel;
          blockState.massSel = null;
          blockSetFeedback('', '');
          renderBlocks();
          SFX.pop();
        } else if (blockState.mass[mi] != null) {
          blockState.mass[mi] = null;
          renderBlocks();
          SFX.click();
        } else {
          blockSetFeedback('اختر مكعب كتلة من الأسفل أولاً.', '');
          renderBlocks();
        }
        return;
      }

      var propSlot = e.target.closest('[data-prop-slot]');
      if (propSlot) {
        var pi = Number(propSlot.getAttribute('data-prop-slot'));
        if (blockState.propSel != null) {
          blockState.prop[pi] = blockState.propSel;
          blockState.propSel = null;
          blockSetFeedback('', '');
          renderBlocks();
          SFX.pop();
        } else if (blockState.prop[pi] != null) {
          blockState.prop[pi] = null;
          renderBlocks();
          SFX.click();
        } else {
          blockSetFeedback('اختر مكعباً من أسفل التناسب.', '');
          renderBlocks();
        }
        return;
      }

      var check = e.target.closest('[data-check]');
      if (check) {
        var s = Number(check.getAttribute('data-check'));
        if (s === 1) checkStageOne();
        if (s === 2) checkStageTwo();
        if (s === 3) checkStageThree();
        return;
      }

      var newBlock = e.target.closest('[data-new-block]');
      if (newBlock) {
        var r = pick(DATA.reactions);
        resetBlockReaction(r.id);
        SFX.pop();
        return;
      }

      var stagePill = e.target.closest('[data-stage]');
      if (stagePill) {
        goBlockStage(Number(stagePill.getAttribute('data-stage')));
      }
    });

    stage.addEventListener('dragstart', function (e) {
      var tile = e.target.closest('.block-tile');
      if (!tile) return;
      try {
        e.dataTransfer.setData('text/plain', JSON.stringify({
          kind: tile.getAttribute('data-tile'),
          val: Number(tile.getAttribute('data-val'))
        }));
        e.dataTransfer.effectAllowed = 'copy';
      } catch (err) { /* تجاهل */ }
      tile.classList.add('is-dragging');
    });

    stage.addEventListener('dragend', function (e) {
      var tile = e.target.closest('.block-tile');
      if (tile) tile.classList.remove('is-dragging');
    });

    stage.addEventListener('dragover', function (e) {
      var slot = e.target.closest('[data-coef-slot],[data-mass-slot],[data-prop-slot]');
      if (!slot) return;
      e.preventDefault();
      slot.style.background = 'var(--mint)';
    });

    stage.addEventListener('dragleave', function (e) {
      var slot = e.target.closest('[data-coef-slot],[data-mass-slot],[data-prop-slot]');
      if (!slot) return;
      slot.style.background = '';
    });

    stage.addEventListener('drop', function (e) {
      var slot = e.target.closest('[data-coef-slot],[data-mass-slot],[data-prop-slot]');
      if (!slot) return;
      e.preventDefault();
      slot.style.background = '';
      var payload;
      try { payload = JSON.parse(e.dataTransfer.getData('text/plain')); } catch (err) { return; }
      if (!payload) return;
      if (slot.hasAttribute('data-coef-slot') && payload.kind === 'coef') {
        blockState.coef[Number(slot.getAttribute('data-coef-slot'))] = payload.val;
      } else if (slot.hasAttribute('data-mass-slot') && payload.kind === 'mass') {
        blockState.mass[Number(slot.getAttribute('data-mass-slot'))] = payload.val;
      } else if (slot.hasAttribute('data-prop-slot') && payload.kind === 'prop') {
        blockState.prop[Number(slot.getAttribute('data-prop-slot'))] = payload.val;
      } else {
        return;
      }
      blockState.coefSel = null;
      blockState.massSel = null;
      blockState.propSel = null;
      blockSetFeedback('', '');
      renderBlocks();
      SFX.pop();
    });

    $('#blocksHintBtn').addEventListener('click', blockHint);
    $('#blocksResetBtn').addEventListener('click', function () {
      resetBlockStage(true);
      blockSetFeedback('', '');
      renderBlocks();
      SFX.click();
    });
  }

  /* ======================================================================
     الألعاب
     ====================================================================== */

  var gameSession = null;
  var gameInterval = null;
  var gameTimeout = null;

  function gameById(id) {
    return DATA.games.filter(function (g) { return g.id === id; })[0];
  }

  function formatTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    if (sec >= 60) {
      var m = Math.floor(sec / 60);
      var s = sec % 60;
      return m + ':' + (s < 10 ? '0' : '') + s;
    }
    return String(sec);
  }

  function updateGameHUD(score, time) {
    var sc = $('#gameScoreChip');
    var tm = $('#gameTimeChip');
    if (sc) sc.innerHTML = '<b>' + (score || 0) + '</b> نقطة';
    if (tm) tm.innerHTML = '<b>' + (time == null ? '0' : time) + '</b> ث';
  }

  function stopGameTimers() {
    if (gameInterval) {
      clearInterval(gameInterval);
      gameInterval = null;
    }
    if (gameTimeout) {
      clearTimeout(gameTimeout);
      gameTimeout = null;
    }
  }

  function renderGames() {
    var grid = $('#gamesGrid');
    if (!grid) return;
    var boss = gameById('boss');
    var list = [boss].concat(DATA.games.filter(function (g) { return g.id !== 'boss'; }));
    grid.innerHTML = list.map(function (g) {
      var best = state.best[g.id] || 0;
      var featured = g.id === 'boss';
      return '<button class="game-card' + (featured ? ' is-featured' : '') + '" type="button" data-play="' + g.id + '">' +
        '<div class="game-card-head">' +
        '<span class="game-card-icon">' + icon(g.icon) + '</span>' +
        '<span class="game-tag">' + esc(g.tag) + '</span>' +
        '</div>' +
        '<h3>' + esc(g.title) + '</h3>' +
        '<p>' + esc(g.desc) + '</p>' +
        '<span class="game-art" aria-hidden="true">' + moleculeSVG(featured ? 'H2O' : (g.id === 'molar' ? 'CO2' : 'O2'), featured ? 210 : 140) + '</span>' +
        '<div class="game-card-foot">' +
        '<span class="game-best">' + (best ? 'أفضل نتيجة: ' + best : 'لم تلعب بعد') + '</span>' +
        '<span class="game-play">' + icon('play') + ' العب</span>' +
        '</div>' +
        '</button>';
    }).join('');

    var xp = $('#gamesXp');
    if (xp) xp.innerHTML = icon('trophy') + ' <span>' + state.totalScore + ' نقطة</span>';
    var goal = $('#gamesGoalBar');
    var goalVal = $('#gamesGoalValue');
    if (goal) goal.style.width = clamp((state.totalScore / 300) * 100, 0, 100) + '%';
    if (goalVal) goalVal.textContent = Math.min(state.totalScore, 300) + ' / 300';
  }

  function openGame(id) {
    var game = gameById(id);
    if (!game) return;
    stopGameTimers();
    gameSession = { id: id, game: game, started: false, finished: false };
    var dlg = $('#gameDialog');
    var title = $('#gameTitle');
    var sub = $('#gameSub');
    var ic = $('#gameIcon');
    if (title) title.textContent = game.title;
    if (sub) sub.textContent = game.desc;
    if (ic) ic.innerHTML = icon(game.icon);
    updateGameHUD(0, game.time || 0);
    var best = state.best[id] || 0;
    $('#gameBody').innerHTML =
      '<div class="game-result">' +
      '<div class="result-medal ' + (game.id === 'boss' ? 'is-gold' : 'is-silver') + '">' + icon(game.icon) + '</div>' +
      '<h3>' + esc(game.title) + '</h3>' +
      '<p>' + esc(game.desc) + '</p>' +
      '<div class="result-stats">' +
      '<div class="result-stat"><b>' + (game.time ? formatTime(game.time) : '∞') + '</b><span>الوقت</span></div>' +
      '<div class="result-stat"><b>' + (best || '—') + '</b><span>أفضل نتيجة</span></div>' +
      '<div class="result-stat"><b>' + (game.id === 'boss' ? '10' : game.id === 'memory' ? '6' : game.id === 'steps' ? '5' : '∞') + '</b><span>' + (game.id === 'boss' ? 'أسئلة' : game.id === 'memory' ? 'أزواج' : game.id === 'steps' ? 'خطوات' : 'جولات') + '</span></div>' +
      '</div>' +
      '<div class="result-actions">' +
      '<button class="btn btn-primary" type="button" data-game-start="1">' + icon('play') + ' ابدأ اللعب</button>' +
      '<button class="btn btn-ghost" type="button" data-game-exit="1">' + icon('close') + ' لاحقاً</button>' +
      '</div>' +
      '</div>';
    var foot = $('#gameFoot');
    if (foot) foot.innerHTML = '<span>النقاط تُضاف إلى رصيدك مباشرة. حاول تحطيم رقمك!</span><span>' + icon('star') + ' قصيرة وممتعة</span>';
    if (dlg.showModal) dlg.showModal();
    SFX.pop();
  }

  function beginGame() {
    if (!gameSession) return;
    stopGameTimers();
    gameSession.started = true;
    gameSession.finished = false;
    if (gameSession.id === 'memory') {
      startMemory();
    } else if (gameSession.id === 'steps') {
      startOrderGame();
    } else {
      startMCQ();
    }
  }

  /* ---------- مولّدات الأسئلة ---------- */

  function optionSet(correct, pool, count, fmt) {
    var vals = [correct];
    var shuffledPool = shuffle(pool);
    for (var i = 0; i < shuffledPool.length && vals.length < (count || 4); i++) {
      var v = shuffledPool[i];
      if (vals.indexOf(v) === -1) vals.push(v);
    }
    var n = 1;
    while (vals.length < (count || 4) && n < 40) {
      var add = correct + n * (n % 2 === 0 ? 1 : -1);
      if (add > 0 && vals.indexOf(add) === -1) vals.push(add);
      n++;
    }
    vals = shuffle(vals);
    return {
      options: vals.map(fmt || function (v) { return String(v); }),
      correct: vals.indexOf(correct)
    };
  }

  function qBalance() {
    var r = pick(DATA.reactions);
    var idx = Math.floor(Math.random() * r.species.length);
    var correct = r.species[idx].coef;
    var pool = [1, 2, 3, 4, 5, 6].filter(function (v) { return v !== correct; });
    var set = optionSet(correct, pool, 4, function (v) { return String(v); });
    return {
      promptHTML: '<p class="quiz-stage-q">ما المعامل الصحيح أمام ' + Chem.formatFormula(r.species[idx].formula) + '؟</p>' +
        '<div class="quiz-stage-eq">' + eqSequenceHTML(r, { blankIndex: idx }) + '</div>' +
        '<p class="muted" style="font-size:11px;text-align:center">' + esc(r.title) + '</p>',
      options: set.options,
      correct: set.correct,
      explain: 'المعامل الصحيح هو ' + correct + '. تأكد من تساوي ذرات كل عنصر في الطرفين.'
    };
  }

  function qMolar() {
    var item = pick(DATA.molarDb);
    var pool = [];
    DATA.molarDb.forEach(function (m) {
      if (Math.abs(m.mass - item.mass) > 0.01) pool.push(m.mass);
    });
    pool.push(item.mass + 16, item.mass + 12, item.mass - 12, item.mass * 2);
    var set = optionSet(item.mass, pool, 4, function (v) { return massNum(v) + ' غ/مول'; });
    return {
      promptHTML: '<p class="quiz-stage-q">ما الكتلة المولية لهذه المادة؟</p>' +
        '<div class="quiz-stage-eq"><span style="font-size:32px;font-weight:700">' + item.html + '</span>' +
        '<div style="font-size:12px;color:var(--muted);margin-top:6px">' + esc(item.name) + '</div></div>',
      options: set.options,
      correct: set.correct,
      explain: 'الكتلة المولية لـ ' + item.formula + ' هي ' + massNum(item.mass) + ' غ/مول.'
    };
  }

  function qProportion() {
    var r = pick(DATA.reactions);
    var given = pick(r.species);
    var others = r.species.filter(function (s) { return s.formula !== given.formula; });
    var target = pick(others);
    var mass = round(r.defaultMass * pick([0.5, 1, 1.5, 2, 2.5]), 1);
    var answer = round(mass * target.lineMass / given.lineMass, 1);
    var pool = [
      round(mass * given.lineMass / target.lineMass, 1),
      round(mass * target.molarMass / given.molarMass, 1),
      round(answer * 1.5, 1),
      r.totalMass,
      answer + mass
    ].filter(function (v) { return v > 0 && Math.abs(v - answer) > 0.05; });
    var set = optionSet(answer, pool, 4, function (v) { return massNum(v) + ' غ'; });
    return {
      promptHTML: '<p class="quiz-stage-q">إذا تفاعل <b>' + massNum(mass) + ' غ</b> من ' + esc(speciesName(given)) +
        '، فما كتلة <b>' + esc(speciesName(target)) + '</b>؟</p>' +
        '<div class="quiz-stage-eq">' + eqSequenceHTML(r, { masses: true, given: given.formula, target: target.formula }) + '</div>',
      options: set.options,
      correct: set.correct,
      explain: 'الجواب = ' + massNum(mass) + ' × ' + massNum(target.lineMass) + ' ÷ ' + massNum(given.lineMass) + ' = ' + massNum(answer) + ' غ.'
    };
  }

  function qTrueFalse() {
    var q = pick(DATA.trueFalse);
    return {
      promptHTML: '<p class="quiz-stage-q" style="max-width:34ch">' + esc(q.text) + '</p>' +
        '<div style="text-align:center;font-size:38px;margin:6px 0 0">' + icon(q.answer ? 'check' : 'x') + '</div>',
      options: ['صح', 'خطأ'],
      correct: q.answer ? 0 : 1,
      explain: q.why
    };
  }

  function qBoss(i) {
    var kind = i % 4;
    if (kind === 0) return qBalance();
    if (kind === 1) return qProportion();
    if (kind === 2) return qMolar();
    return qTrueFalse();
  }

  /* ---------- محرّك الأسئلة ---------- */

  function startMCQ() {
    var s = gameSession;
    var id = s.id;
    var duration = id === 'boss' ? 180 : id === 'truefalse' ? 45 : id === 'balance' ? 60 : id === 'molar' ? 60 : 90;
    var max = id === 'boss' ? 10 : 20;
    s.mode = 'mcq';
    s.score = 0;
    s.correctCount = 0;
    s.wrongCount = 0;
    s.asked = 0;
    s.combo = 0;
    s.bestCombo = 0;
    s.locked = false;
    s.timeLeft = duration;
    s.duration = duration;
    s.max = max;
    s.make = function (i) {
      if (id === 'balance') return qBalance();
      if (id === 'molar') return qMolar();
      if (id === 'proportion') return qProportion();
      if (id === 'truefalse') return qTrueFalse();
      return qBoss(i);
    };
    updateGameHUD(0, formatTime(duration));
    nextMCQ();
    if (gameInterval) clearInterval(gameInterval);
    gameInterval = setInterval(function () {
      if (!gameSession || gameSession.finished) return;
      gameSession.timeLeft--;
      updateGameHUD(gameSession.score, formatTime(Math.max(0, gameSession.timeLeft)));
      var bar = $('#mcqTimer');
      if (bar) {
        bar.style.width = clamp((gameSession.timeLeft / gameSession.duration) * 100, 0, 100) + '%';
        var wrap = bar.closest('.timer-bar');
        if (wrap) wrap.classList.toggle('is-low', gameSession.timeLeft <= 10);
      }
      if (gameSession.timeLeft <= 0) finishMCQ();
    }, 1000);
  }

  function nextMCQ() {
    var s = gameSession;
    if (!s || s.finished) return;
    if (s.asked >= s.max) {
      finishMCQ();
      return;
    }
    s.asked++;
    s.locked = false;
    s.q = s.make(s.asked - 1);
    var body = $('#gameBody');
    if (!body) return;
    body.innerHTML =
      '<div class="timer-bar' + (s.timeLeft <= 10 ? ' is-low' : '') + '"><span id="mcqTimer" style="width:' +
      clamp((s.timeLeft / s.duration) * 100, 0, 100) + '%"></span></div>' +
      '<div class="quiz-progress"><span>سؤال <b>' + s.asked + '</b> من ' + s.max + '</span>' +
      '<span>سلسلة: <b>' + s.combo + '×</b></span></div>' +
      s.q.promptHTML +
      '<div class="quiz-options game-options">' +
      s.q.options.map(function (o, i) {
        return '<button class="quiz-opt" type="button" data-game-answer="' + i + '">' + o + '</button>';
      }).join('') +
      '</div>' +
      '<div id="mcqFeedback" aria-live="polite"></div>';
  }

  function answerMCQ(i) {
    var s = gameSession;
    if (!s || s.mode !== 'mcq' || s.locked || s.finished) return;
    s.locked = true;
    var ok = i === s.q.correct;
    var opts = $$('#gameBody .quiz-opt');
    opts.forEach(function (b, j) {
      b.disabled = true;
      if (j === s.q.correct) b.classList.add('is-correct');
      if (j === i && !ok) b.classList.add('is-wrong');
    });
    var fb = $('#mcqFeedback');
    if (ok) {
      s.score += 10 + Math.min(s.combo, 6) * 2;
      s.correctCount++;
      s.combo++;
      s.bestCombo = Math.max(s.bestCombo, s.combo);
      SFX.ok();
      if (fb) fb.innerHTML = '<div class="feedback-banner ok">' + icon('check') + ' إجابة صحيحة! ' + esc(s.q.explain) + '</div>';
    } else {
      s.wrongCount++;
      s.combo = 0;
      SFX.bad();
      if (fb) fb.innerHTML = '<div class="feedback-banner bad">' + icon('x') + ' ليست صحيحة. ' + esc(s.q.explain) + '</div>';
    }
    updateGameHUD(s.score, formatTime(Math.max(0, s.timeLeft)));
    if (gameTimeout) clearTimeout(gameTimeout);
    gameTimeout = setTimeout(nextMCQ, ok ? 950 : 1700);
  }

  function finishMCQ() {
    var s = gameSession;
    if (!s || s.finished) return;
    s.finished = true;
    stopGameTimers();
    var total = s.asked;
    var accuracy = total ? s.correctCount / total : 0;
    var xp = clamp(8 + Math.round(s.score / 5), 8, 60);
    commitGameResult(s, s.score, xp);
    showGameResult({
      game: s.game,
      score: s.score,
      correct: s.correctCount,
      total: total,
      accuracy: accuracy,
      xp: xp,
      extra: 'أفضل سلسلة: ' + s.bestCombo + '×'
    });
  }

  function commitGameResult(s, score, xp) {
    var id = s.id;
    state.best[id] = Math.max(state.best[id] || 0, score);
    state.totalScore += score;
    state.counters.games++;
    state.counters.correct += s.correctCount || 0;
    state.counters.attempts += s.asked || s.moves || 0;
    if (id === 'balance') {
      state.counters.balanceCorrect += s.correctCount || 0;
      if (state.counters.balanceCorrect >= 5) unlockBadge('balance5');
    }
    if (score >= 150) unlockBadge('highScore');
    if (id === 'boss' && (s.correctCount || 0) >= 5) unlockBadge('boss');
    if (id === 'memory') {
      state.counters.memoryWins++;
      unlockBadge('memory');
    }
    unlockBadge('gameFirst');
    persist();
    awardXP(xp, 'نتيجة اللعبة');
    updateXP();
    renderGames();
  }

  function showGameResult(opts) {
    var body = $('#gameBody');
    if (!body) return;
    var accuracy = Math.round((opts.accuracy || 0) * 100);
    var medal = accuracy >= 80 ? 'is-gold' : accuracy >= 50 ? 'is-silver' : 'is-bronze';
    body.innerHTML =
      '<div class="game-result">' +
      '<div class="result-medal ' + medal + '">' + icon(accuracy >= 80 ? 'trophy' : accuracy >= 50 ? 'medal' : 'spark') + '</div>' +
      '<h3>' + esc(accuracy >= 80 ? 'أداء رائع!' : accuracy >= 50 ? 'عمل جيد!' : 'المحاولة القادمة أفضل') + '</h3>' +
      '<p>' + (opts.game ? esc(opts.game.title) : '') + ' — ' + esc(opts.extra || '') + '</p>' +
      '<div class="result-stats">' +
      '<div class="result-stat"><b>' + opts.score + '</b><span>نقاط اللعبة</span></div>' +
      '<div class="result-stat"><b>' + (opts.correct != null ? opts.correct + '/' + opts.total : '—') + '</b><span>إجابات صحيحة</span></div>' +
      '<div class="result-stat"><b>+' + opts.xp + '</b><span>خبرة</span></div>' +
      '</div>' +
      '<div class="result-actions">' +
      '<button class="btn btn-primary" type="button" data-game-replay="1">' + icon('refresh') + ' العب مرة أخرى</button>' +
      '<button class="btn btn-ghost" type="button" data-game-exit="1">' + icon('game') + ' ألعاب أخرى</button>' +
      '</div>' +
      '</div>';
    var foot = $('#gameFoot');
    if (foot) foot.innerHTML = '<span>أفضل نتيجة: ' + (state.best[opts.game.id] || 0) + '</span><span>+ ' + opts.xp + ' XP</span>';
    if (accuracy >= 80) burst(120);
    SFX.win();
  }

  /* ---------- لعبة الذاكرة ---------- */

  function startMemory() {
    var s = gameSession;
    s.mode = 'memory';
    s.score = 0;
    s.moves = 0;
    s.matched = 0;
    s.open = [];
    s.elapsed = 0;
    s.correctCount = 6;
    var pool = shuffle(DATA.molarDb).slice(0, 6);
    var cards = [];
    pool.forEach(function (item, i) {
      cards.push({ pid: i, kind: 'formula', text: item.html, sub: 'الصيغة' });
      cards.push({ pid: i, kind: 'name', text: esc(item.name), sub: item.formula });
    });
    s.cards = shuffle(cards);
    updateGameHUD(0, '0');
    renderMemoryGrid();
    if (gameInterval) clearInterval(gameInterval);
    gameInterval = setInterval(function () {
      if (!gameSession || gameSession.finished) return;
      gameSession.elapsed++;
      updateGameHUD(gameSession.score, formatTime(gameSession.elapsed));
    }, 1000);
  }

  function renderMemoryGrid() {
    var s = gameSession;
    if (!s || s.mode !== 'memory') return;
    var body = $('#gameBody');
    body.innerHTML =
      '<div class="quiz-progress"><span>الأزواج: <b>' + s.matched + ' / 6</b></span><span>المحاولات: <b>' + s.moves + '</b></span></div>' +
      '<div class="memory-grid">' +
      s.cards.map(function (c, i) {
        var open = s.open.indexOf(i) !== -1 || c.matched;
        return '<button class="mem-card' + (open ? ' is-open' : '') + (c.matched ? ' is-matched' : '') + '" type="button" data-mem-card="' + i + '" aria-label="بطاقة مغلقة">' +
          '<span class="mem-face mem-front">؟</span>' +
          '<span class="mem-face mem-back">' + c.text + '<small>' + c.sub + '</small></span>' +
          '</button>';
      }).join('') +
      '</div>' +
      '<div id="memoryFeedback" style="text-align:center;margin-top:14px;font-size:12px;font-weight:600;color:var(--muted)">اقلِب بطاقتين وطابق الاسم مع الصيغة.</div>';
    var foot = $('#gameFoot');
    if (foot) foot.innerHTML = '<span>الكتلة المولية = مجموع كتل الذرات</span><span>الزوج الصحيح = +20 نقطة</span>';
  }

  function clickMemory(i) {
    var s = gameSession;
    if (!s || s.mode !== 'memory' || s.finished) return;
    var card = s.cards[i];
    if (!card || card.matched || s.open.indexOf(i) !== -1) return;
    if (s.open.length >= 2) return;
    s.open.push(i);
    SFX.pop();
    var el = $('[data-mem-card="' + i + '"]');
    if (el) el.classList.add('is-open');
    if (s.open.length === 2) {
      s.moves++;
      var a = s.cards[s.open[0]];
      var b = s.cards[s.open[1]];
      var fb = $('#memoryFeedback');
      if (a.pid === b.pid) {
        a.matched = true;
        b.matched = true;
        s.score += 20;
        s.matched++;
        s.open = [];
        SFX.ok();
        if (fb) fb.textContent = 'زوج صحيح! +20 نقطة';
        updateGameHUD(s.score, formatTime(s.elapsed));
        $$('[data-mem-card]').forEach(function (bEl, j) {
          if (s.cards[j].matched) bEl.classList.add('is-matched');
        });
        var prog = $('.quiz-progress b');
        if (prog) prog.textContent = s.matched + ' / 6';
        if (s.matched === 6) {
          s.finished = true;
          stopGameTimers();
          var xp = clamp(15 + s.score / 5, 15, 50);
          commitGameResult(s, s.score, Math.round(xp));
          showGameResult({
            game: s.game,
            score: s.score,
            correct: 6,
            total: 6,
            accuracy: 1,
            xp: Math.round(xp),
            extra: 'أكملت الذاكرة في ' + s.moves + ' محاولة'
          });
        }
      } else {
        s.score = Math.max(0, s.score - 2);
        SFX.bad();
        if (fb) fb.textContent = 'ليست زوجاً… حاول مرة أخرى.';
        var openNow = s.open.slice();
        gameTimeout = setTimeout(function () {
          if (!gameSession || gameSession.id !== 'memory') return;
          openNow.forEach(function (idx) {
            var e2 = $('[data-mem-card="' + idx + '"]');
            if (e2) e2.classList.remove('is-open');
          });
          gameSession.open = [];
        }, 850);
        s.open = [];
        // نُبقي البطاقتين مفتوحتين بصرياً حتى المهلة
        s.open = openNow;
      }
      updateGameHUD(s.score, formatTime(s.elapsed));
    }
  }

  /* ---------- لعبة الترتيب ---------- */

  function startOrderGame() {
    var s = gameSession;
    s.mode = 'order';
    s.score = 100;
    s.attempts = 0;
    s.elapsed = 0;
    s.selected = null;
    s.correctCount = 5;
    s.order = shuffle(DATA.solutionSteps.map(function (txt, i) { return { txt: txt, i: i }; }));
    updateGameHUD(100, '0');
    renderOrderList();
    if (gameInterval) clearInterval(gameInterval);
    gameInterval = setInterval(function () {
      if (!gameSession || gameSession.finished) return;
      gameSession.elapsed++;
      updateGameHUD(gameSession.score, formatTime(gameSession.elapsed));
    }, 1000);
  }

  function renderOrderList() {
    var s = gameSession;
    if (!s || s.mode !== 'order') return;
    $('#gameBody').innerHTML =
      '<p class="quiz-stage-q" style="font-size:18px;margin-bottom:6px">رتّب خطوات حل مسألة السطرين</p>' +
      '<p style="text-align:center;font-size:11px;color:var(--muted);margin-bottom:14px">اضغط خطوة ثم اضغط الأخرى لتبديل مكانيهما.</p>' +
      '<div class="order-list">' +
      s.order.map(function (item, i) {
        return '<button class="order-item' + (s.selected === i ? ' is-selected' : '') + '" type="button" data-order-item="' + i + '">' +
          '<span class="order-num">' + (i + 1) + '</span>' +
          '<span>' + esc(item.txt) + '</span>' +
          '<span class="order-grip">⠿</span>' +
          '</button>';
      }).join('') +
      '</div>' +
      '<div class="stage-actions" style="justify-content:center;margin-top:16px">' +
      '<button class="btn btn-primary btn-sm" type="button" data-game-check-order="1">' + icon('check') + ' تحقق من الترتيب</button>' +
      '</div>' +
      '<div id="orderFeedback" class="feedback-banner" style="display:none"></div>';
    var foot = $('#gameFoot');
    if (foot) foot.innerHTML = '<span>المحاولات: ' + s.attempts + '</span><span>كل محاولة خاطئة تنقص 10 نقاط</span>';
  }

  function clickOrder(i) {
    var s = gameSession;
    if (!s || s.mode !== 'order') return;
    if (s.selected == null) {
      s.selected = i;
      SFX.click();
      renderOrderList();
    } else if (s.selected === i) {
      s.selected = null;
      renderOrderList();
    } else {
      var a = s.order[s.selected];
      s.order[s.selected] = s.order[i];
      s.order[i] = a;
      s.selected = null;
      SFX.pop();
      renderOrderList();
    }
  }

  function checkOrder() {
    var s = gameSession;
    if (!s || s.mode !== 'order' || s.finished) return;
    var ok = s.order.every(function (item, i) { return item.i === i; });
    var fb = $('#orderFeedback');
    if (ok) {
      var xp = clamp(Math.round(s.score / 3), 10, 35);
      s.finished = true;
      stopGameTimers();
      commitGameResult(s, s.score, xp);
      showGameResult({
        game: s.game,
        score: s.score,
        correct: 5,
        total: 5,
        accuracy: 1,
        xp: xp,
        extra: 'أتممت الترتيب في ' + formatTime(s.elapsed)
      });
      return;
    }
    s.attempts++;
    s.score = Math.max(10, s.score - 10);
    updateGameHUD(s.score, formatTime(s.elapsed));
    if (fb) {
      fb.style.display = 'block';
      fb.className = 'feedback-banner bad';
      fb.innerHTML = 'الترتيب غير صحيح. ابدأ بموازنة المعادلة، وانتهِ بالتحقق.';
    }
    SFX.bad();
    renderOrderList();
    var fb2 = $('#orderFeedback');
    if (fb2) {
      fb2.style.display = 'block';
      fb2.className = 'feedback-banner bad';
      fb2.innerHTML = 'الترتيب غير صحيح. ابدأ بموازنة المعادلة، وانتهِ بالتحقق.';
    }
    SFX.bad();
  }

  /* ---------- تفاعلات نافذة اللعبة ---------- */

  function closeGame() {
    var dlg = $('#gameDialog');
    stopGameTimers();
    if (dlg && dlg.open) dlg.close();
  }

  function bindGames() {
    var grid = $('#gamesGrid');
    if (grid) {
      grid.addEventListener('click', function (e) {
        var card = e.target.closest('[data-play]');
        if (!card) return;
        openGame(card.getAttribute('data-play'));
      });
    }

    var body = $('#gameBody');
    if (body) {
      body.addEventListener('click', function (e) {
        if (e.target.closest('[data-game-start]')) {
          beginGame();
          return;
        }
        if (e.target.closest('[data-game-replay]')) {
          var id = gameSession ? gameSession.id : null;
          if (id) {
            gameSession = { id: id, game: gameById(id), started: false, finished: false };
            updateGameHUD(0, gameById(id).time || 0);
            beginGame();
          }
          return;
        }
        if (e.target.closest('[data-game-exit]')) {
          closeGame();
          navigate('games');
          return;
        }
        var ans = e.target.closest('[data-game-answer]');
        if (ans) {
          answerMCQ(Number(ans.getAttribute('data-game-answer')));
          return;
        }
        var mem = e.target.closest('[data-mem-card]');
        if (mem) {
          clickMemory(Number(mem.getAttribute('data-mem-card')));
          return;
        }
        var ord = e.target.closest('[data-order-item]');
        if (ord) {
          clickOrder(Number(ord.getAttribute('data-order-item')));
          return;
        }
        if (e.target.closest('[data-game-check-order]')) {
          checkOrder();
        }
      });
    }

    $$('[data-close-game]').forEach(function (b) {
      b.addEventListener('click', closeGame);
    });

    var dlg = $('#gameDialog');
    if (dlg) {
      dlg.addEventListener('cancel', function (e) {
        e.preventDefault();
        closeGame();
      });
      dlg.addEventListener('close', function () {
        stopGameTimers();
        gameSession = null;
        renderGames();
      });
      dlg.addEventListener('click', function (e) {
        if (e.target === dlg) closeGame();
      });
    }
  }

  /* ======================================================================
     المرسم
     ====================================================================== */

  var artTimeout = null;

  function artReaction() {
    return DATA.findReaction(state.art.reactionId) || DATA.reactions[0];
  }

  function renderArtReactions() {
    var host = $('#artReactions');
    if (!host) return;
    host.innerHTML = DATA.reactions.map(function (r) {
      return '<button class="reaction-chip" type="button" role="tab" data-reaction="' + r.id + '">' +
        '<span class="chip-icon">' + icon(r.icon) + '</span>' +
        '<span class="chip-txt"><strong>' + esc(r.title) + '</strong><small>' + Chem.formatFormula(r.eq.split('->')[0].trim()) + ' →</small></span>' +
        '</button>';
    }).join('');
  }

  function artSpeciesHTML(sp) {
    var n = Math.min(sp.coef, 4);
    var mols = '';
    for (var i = 0; i < n; i++) {
      mols += '<div class="art-molecule" style="--i:' + i + '">' + moleculeSVG(sp.formula, 58) + '</div>';
    }
    if (sp.coef > 4) {
      mols += '<div class="art-molecule" style="--i:4;font-size:18px;color:var(--lime);align-self:center">+' + (sp.coef - 4) + '</div>';
    }
    return '<div class="art-species">' +
      '<div class="art-molecules">' + mols + '</div>' +
      '<div class="mol-count"><b>' + sp.coef + '</b> × ' + Chem.formatFormula(sp.formula) + '</div>' +
      '</div>';
  }

  function renderArt() {
    var host = $('#artStage');
    if (!host) return;
    var r = artReaction();
    if (!$('#artReactions .reaction-chip')) renderArtReactions();
    $$('#artReactions .reaction-chip').forEach(function (c) {
      var on = c.getAttribute('data-reaction') === r.id;
      c.classList.toggle('is-active', on);
      c.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    var title = $('#artReactionTitle');
    if (title) title.textContent = r.title;

    host.innerHTML =
      '<div class="art-stage-inner">' +
      '<div class="art-side-group reactants">' +
      '<span class="art-side-label">المتفاعلات</span>' +
      '<div class="art-molecules">' + r.reactants.map(artSpeciesHTML).join('') + '</div>' +
      '</div>' +
      '<div class="art-arrow">→<small>تفاعل</small></div>' +
      '<div class="art-side-group products">' +
      '<span class="art-side-label">النواتج</span>' +
      '<div class="art-molecules">' + r.products.map(artSpeciesHTML).join('') + '</div>' +
      '</div>' +
      '</div>';

    var elements = unique(reactionElements(r));
    var legend = $('#artLegend');
    if (legend) {
      legend.innerHTML = elements.map(function (el) {
        var info = Chem.ATOMIC[el] || { color: '#ccc', ar: el };
        return '<span><i class="legend-dot" style="background:' + info.color + '"></i>' + el + ' · ' + esc(info.ar) + '</span>';
      }).join('') + '<span><i class="legend-dot" style="background:var(--lime)"></i>تمثيل مبسّط للجزيئات</span>';
    }

    var tally = $('#artTally');
    if (tally) {
      var totals = {};
      r.species.forEach(function (sp) {
        Object.keys(sp.counts).forEach(function (el) {
          if (!totals[el]) totals[el] = { left: 0, right: 0 };
          totals[el][sp.side === 'left' ? 'left' : 'right'] += sp.coef * sp.counts[el];
        });
      });
      tally.innerHTML = Object.keys(totals).map(function (el) {
        var info = Chem.ATOMIC[el] || { color: '#ccc' };
        return '<div class="tally-row">' +
          '<span class="tally-el"><i class="tally-dot" style="background:' + info.color + '"></i>' + el + '</span>' +
          '<span class="tally-num">' + totals[el].left + '</span>' +
          '<span class="tally-eq">=</span>' +
          '<span class="tally-num">' + totals[el].right + '</span>' +
          '<span class="tally-eq">' + icon('check') + '</span>' +
          '</div>';
      }).join('');
    }

    var chart = $('#artChart');
    if (chart) {
      var max = Math.max.apply(null, r.species.map(function (s) { return s.lineMass; }));
      chart.innerHTML = r.species.map(function (sp) {
        return '<div class="chart-row">' +
          '<span class="chart-label">' + Chem.formatFormula(sp.formula) + '</span>' +
          '<span class="chart-track"><span class="chart-fill' + (sp.side === 'right' ? ' is-product' : '') + '" style="width:' +
          clamp((sp.lineMass / max) * 100, 3, 100) + '%"></span></span>' +
          '<span class="chart-value">' + massNum(sp.lineMass) + ' غ</span>' +
          '</div>';
      }).join('');
    }

    var story = $('#artStory');
    if (story) {
      story.innerHTML = '<div><h3>ماذا يحدث في هذا التفاعل؟</h3><p>' + esc(r.story) + '</p></div>' +
        '<div class="fact">' + icon('bulb') + ' ' + esc(r.fact) + '</div>';
    }
  }

  function reactionElements(r) {
    var out = [];
    r.species.forEach(function (sp) {
      Object.keys(sp.counts).forEach(function (el) {
        if (out.indexOf(el) === -1) out.push(el);
      });
    });
    return out;
  }

  function playArt() {
    var stage = $('#artStage');
    if (!stage) return;
    stage.classList.remove('is-playing');
    void stage.offsetWidth;
    stage.classList.add('is-playing');
    SFX.pop();
    setTimeout(function () { SFX.ok(); }, 750);
    if (artTimeout) clearTimeout(artTimeout);
    artTimeout = setTimeout(function () {
      if (stage) stage.classList.remove('is-playing');
    }, 3600);
    if (!state.art.played) {
      state.art.played = true;
      persist();
      awardXP(10, 'شغّلت التفاعل');
      unlockBadge('artist');
      burst(70);
    }
  }

  function eqStringHTML(r) {
    function term(s) {
      return (s.coef > 1 ? s.coef : '') + Chem.formatFormula(s.formula);
    }
    return r.reactants.map(term).join(' + ') + ' → ' + r.products.map(term).join(' + ');
  }

  /* ---------- بطاقة التفاعل (Canvas) ---------- */

  function drawCanvasDots(ctx, W, H, color) {
    ctx.fillStyle = color;
    for (var x = 55; x < W - 40; x += 34) {
      for (var y = 55; y < H - 40; y += 34) {
        ctx.beginPath();
        ctx.arc(x, y, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function canvasRound(ctx, x, y, w, h, r) {
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      return;
    }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function tokenizeFormula(f) {
    return f.match(/[A-Z][a-z]?|\(|\)|\d+/g) || [f];
  }

  function canvasTermWidth(ctx, sp, size, font) {
    var w = 0;
    if (sp.coef > 1) {
      ctx.font = '700 ' + (size * 0.86) + 'px ' + font;
      w += ctx.measureText(String(sp.coef)).width + size * 0.06;
    }
    tokenizeFormula(sp.formula).forEach(function (t) {
      var digit = /^\d+$/.test(t);
      ctx.font = (digit ? '600 ' : '600 ') + (digit ? size * 0.6 : size) + 'px ' + font;
      w += ctx.measureText(t).width;
    });
    return w;
  }

  function drawChemicalTerm(ctx, sp, x, y, size, font, color) {
    if (sp.coef > 1) {
      ctx.font = '700 ' + (size * 0.86) + 'px ' + font;
      ctx.fillStyle = '#0f7b63';
      ctx.textAlign = 'left';
      ctx.fillText(String(sp.coef), x, y);
      x += ctx.measureText(String(sp.coef)).width + size * 0.06;
    }
    tokenizeFormula(sp.formula).forEach(function (t) {
      var digit = /^\d+$/.test(t);
      ctx.font = '600 ' + (digit ? size * 0.6 : size) + 'px ' + font;
      ctx.fillStyle = color;
      ctx.textAlign = 'left';
      ctx.fillText(t, x, digit ? y + size * 0.2 : y);
      x += ctx.measureText(t).width;
    });
    return x;
  }

  function drawEquationCanvas(ctx, r, cx, y, size, font) {
    ctx.direction = 'ltr';
    ctx.textBaseline = 'alphabetic';
    var parts = [];
    r.reactants.forEach(function (sp, i) {
      if (i) parts.push({ t: 'plus' });
      parts.push({ t: 'sp', sp: sp });
    });
    parts.push({ t: 'arrow' });
    r.products.forEach(function (sp, i) {
      if (i) parts.push({ t: 'plus' });
      parts.push({ t: 'sp', sp: sp });
    });
    var gap = size * 0.3;
    var total = 0;
    parts.forEach(function (p) {
      if (p.t === 'sp') p.w = canvasTermWidth(ctx, p.sp, size, font);
      else if (p.t === 'plus') {
        ctx.font = '500 ' + size * 0.8 + 'px ' + font;
        p.w = ctx.measureText('+').width;
      } else {
        ctx.font = '600 ' + size * 0.95 + 'px ' + font;
        p.w = ctx.measureText('→').width;
      }
      total += p.w;
    });
    total += gap * (parts.length - 1);
    var x = cx - total / 2;
    parts.forEach(function (p, i) {
      if (i) x += gap;
      if (p.t === 'sp') {
        x = drawChemicalTerm(ctx, p.sp, x, y, size, font, '#10241e');
      } else if (p.t === 'plus') {
        ctx.font = '500 ' + size * 0.8 + 'px ' + font;
        ctx.fillStyle = '#6b7f75';
        ctx.textAlign = 'left';
        ctx.fillText('+', x, y);
        x += p.w;
      } else {
        ctx.font = '600 ' + size * 0.95 + 'px ' + font;
        ctx.fillStyle = '#f36b45';
        ctx.textAlign = 'left';
        ctx.fillText('→', x, y);
        x += p.w;
      }
    });
    return total;
  }

  function wrapCanvasText(ctx, text, maxWidth) {
    var words = String(text).split(/\s+/);
    var lines = [];
    var line = '';
    words.forEach(function (w) {
      var test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
    return lines;
  }

  function downloadCanvas(canvas, filename) {
    if (!canvas.toBlob) {
      var a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = filename;
      a.click();
      return;
    }
    canvas.toBlob(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }, 'image/png');
  }

  function makePoster() {
    var r = artReaction();
    var run = function () {
      var W = 1080;
      var H = 1350;
      var font = '"IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif';
      var display = '"Baloo Bhaijaan 2", "Segoe UI", Tahoma, sans-serif';
      var c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      var ctx = c.getContext('2d');

      ctx.fillStyle = '#f7f2e3';
      ctx.fillRect(0, 0, W, H);
      drawCanvasDots(ctx, W, H, 'rgba(16,36,30,.08)');

      ctx.fillStyle = '#0c4a3f';
      ctx.fillRect(30, 30, W - 60, 250);
      ctx.strokeStyle = '#10241e';
      ctx.lineWidth = 8;
      ctx.strokeRect(30, 30, W - 60, H - 60);

      ctx.direction = 'rtl';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff9ec';
      ctx.font = '800 62px ' + display;
      ctx.fillText('بطاقة تفاعل', W / 2, 150);
      ctx.fillStyle = '#d8f27e';
      ctx.font = '600 30px ' + font;
      ctx.fillText('مسألة السطرين · كيمياء الصف التاسع', W / 2, 215);

      ctx.fillStyle = '#10241e';
      ctx.font = '800 48px ' + display;
      ctx.fillText(r.title, W / 2, 360);

      var eqY = 500;
      drawEquationCanvas(ctx, r, W / 2, eqY, 52, font);

      ctx.fillStyle = '#cdecdc';
      canvasRound(ctx, 130, eqY + 45, W - 260, 100, 18);
      ctx.fill();
      ctx.strokeStyle = '#10241e';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.direction = 'ltr';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#10241e';
      ctx.font = '600 30px ' + font;
      var masses = r.reactants.map(function (s) { return massNum(s.lineMass) + ' g'; }).join(' + ') +
        '   →   ' + r.products.map(function (s) { return massNum(s.lineMass) + ' g'; }).join(' + ');
      ctx.fillText(masses, W / 2, eqY + 110);

      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#106b57';
      ctx.font = '800 30px ' + display;
      ctx.fillText('ماذا يحدث؟', W - 110, 780);
      ctx.fillStyle = '#10241e';
      ctx.font = '400 25px ' + font;
      var lines = wrapCanvasText(ctx, r.story, W - 220).slice(0, 5);
      lines.forEach(function (line, i) {
        ctx.fillText(line, W - 110, 830 + i * 43);
      });

      /* رسم عناصر التفاعل */
      var els = unique(reactionElements(r)).slice(0, 6);
      var startX = W - 130;
      ctx.textAlign = 'center';
      els.forEach(function (el, i) {
        var info = Chem.ATOMIC[el] || { color: '#ccc' };
        var x = startX - i * 140;
        ctx.beginPath();
        ctx.arc(x, 1100, 34, 0, Math.PI * 2);
        ctx.fillStyle = info.color;
        ctx.fill();
        ctx.strokeStyle = '#10241e';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = el === 'C' || el === 'Fe' || el === 'Cu' ? '#fff9ec' : '#10241e';
        ctx.font = '700 20px ' + font;
        ctx.textBaseline = 'middle';
        ctx.fillText(el, x, 1100);
        ctx.textBaseline = 'alphabetic';
      });

      ctx.fillStyle = '#0c4a3f';
      ctx.fillRect(30, H - 210, W - 60, 180);
      ctx.direction = 'rtl';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff9ec';
      ctx.font = '600 26px ' + font;
      ctx.fillText('وازن المعادلة · اكتب السطر الثاني · اضرب بالتقاطع', W / 2, H - 140);
      ctx.fillStyle = '#d8f27e';
      ctx.font = '800 30px ' + display;
      ctx.fillText('مسألة السطرين', W / 2, H - 85);

      downloadCanvas(c, 'satrain-poster-' + r.id + '.png');
      toast('نُزّلت بطاقة التفاعل', 'is-badge', 'download');
    };
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(run).catch(run);
    } else {
      run();
    }
  }

  function bindArt() {
    var strip = $('#artReactions');
    if (strip) {
      strip.addEventListener('click', function (e) {
        var chip = e.target.closest('[data-reaction]');
        if (!chip) return;
        state.art.reactionId = chip.getAttribute('data-reaction');
        persist();
        renderArt();
        SFX.click();
      });
    }
    $('#artPlayBtn').addEventListener('click', playArt);
    $('#artReplayBtn').addEventListener('click', playArt);
    $('#artPosterBtn').addEventListener('click', makePoster);
  }

  /* ======================================================================
     جوائزي
     ====================================================================== */

  var badgeFilter = 'all';
  var confirmAction = null;

  function askConfirm(text, action) {
    var dlg = $('#confirmDialog');
    if (!dlg) return;
    $('#confirmText').textContent = text;
    confirmAction = action;
    if (dlg.showModal) dlg.showModal();
  }

  function renderMe() {
    if (!$('#badgesGrid')) return;
    var info = levelInfo(state.xp);
    var nameInput = $('#studentName');
    if (nameInput && document.activeElement !== nameInput) nameInput.value = state.name;
    var avatar = $('#profileAvatar');
    if (avatar) avatar.innerHTML = icon(info.level.icon);

    var stats = $('#profileStats');
    if (stats) {
      stats.innerHTML =
        '<div class="profile-stat"><b>' + state.counters.solved + '</b><span>مسائل محلولة</span></div>' +
        '<div class="profile-stat"><b>' + state.counters.balanceCorrect + '</b><span>معادلات موزونة</span></div>' +
        '<div class="profile-stat"><b>' + state.counters.games + '</b><span>ألعاب مكتملة</span></div>';
    }

    renderBadges();
    renderSaved();
    updateXP();
  }

  function renderBadges() {
    var grid = $('#badgesGrid');
    if (!grid) return;
    var list = DATA.badges.filter(function (b) {
      if (badgeFilter === 'unlocked') return hasBadge(b.id);
      if (badgeFilter === 'locked') return !hasBadge(b.id);
      return true;
    });
    if (!list.length) {
      grid.innerHTML = '<div class="badge-empty">لا توجد شارات في هذا التصنيف بعد. العب أو حلّ مسألة لتفتح شارة!</div>';
      return;
    }
    grid.innerHTML = list.map(function (b) {
      var open = hasBadge(b.id);
      return '<article class="badge-card' + (open ? '' : ' is-locked') + '">' +
        (open ? '<span class="badge-unlocked-tag">مفتوحة</span>' : '<span class="badge-lock">' + icon('lock') + '</span>') +
        '<span class="badge-icon">' + icon(b.icon) + '</span>' +
        '<h3>' + esc(b.title) + '</h3>' +
        '<p>' + esc(b.desc) + '</p>' +
        '</article>';
    }).join('');
    $('#badgesCount').textContent = state.badges.length + ' من ' + DATA.badges.length + ' شارة';
  }

  function renderSaved() {
    var host = $('#savedList');
    if (!host) return;
    if (!state.saved.length) {
      host.innerHTML = '<div class="saved-empty">دفترك فارغ. احل مسألة في المختبر ثم اضغط «احفظ المسألة».</div>';
      return;
    }
    host.innerHTML = state.saved.map(function (s) {
      var reaction = DATA.findReaction(s.reactionId);
      var eq = reaction ? eqStringHTML(reaction) : s.eq;
      return '<div class="saved-item">' +
        '<div class="saved-main">' +
        '<div class="saved-eq" dir="ltr">' + eq + '</div>' +
        '<div class="saved-meta">' + massNum(s.mass) + ' غ من ' + esc(s.givenName) + ' → <b>' + massNum(s.answer) + ' غ</b> من ' + esc(s.targetName) + ' · ' + formatDate(s.date) + '</div>' +
        '</div>' +
        '<div class="saved-tools">' +
        '<button class="iconbtn" type="button" data-saved-open="' + s.id + '" aria-label="افتح المسألة في المختبر">' + icon('arrow') + '</button>' +
        '<button class="iconbtn" type="button" data-saved-del="' + s.id + '" aria-label="احذف المسألة">' + icon('trash') + '</button>' +
        '</div>' +
        '</div>';
    }).join('');
  }

  function makeCertificate() {
    var name = (state.name || '').trim();
    if (!name) {
      toast('اكتب اسمك أولاً لتظهر في الشهادة', '', 'info');
      var input = $('#studentName');
      if (input) {
        input.focus();
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    var run = function () {
      var W = 1600;
      var H = 1130;
      var font = '"IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif';
      var display = '"Baloo Bhaijaan 2", "Segoe UI", Tahoma, sans-serif';
      var c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      var ctx = c.getContext('2d');

      ctx.fillStyle = '#f7f2e3';
      ctx.fillRect(0, 0, W, H);
      drawCanvasDots(ctx, W, H, 'rgba(16,36,30,.07)');

      ctx.strokeStyle = '#10241e';
      ctx.lineWidth = 12;
      ctx.strokeRect(40, 40, W - 80, H - 80);
      ctx.strokeStyle = '#0c4a3f';
      ctx.lineWidth = 3;
      ctx.strokeRect(66, 66, W - 132, H - 132);

      ctx.fillStyle = '#0c4a3f';
      ctx.fillRect(67, 67, W - 134, 190);

      ctx.direction = 'rtl';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#d8f27e';
      ctx.font = '800 34px ' + display;
      ctx.fillText('مسألة السطرين · كيمياء الصف التاسع', W / 2, 135);
      ctx.fillStyle = '#fff9ec';
      ctx.font = '800 66px ' + display;
      ctx.fillText('شهادة إنجاز', W / 2, 215);

      ctx.fillStyle = '#106b57';
      ctx.font = '600 26px ' + font;
      ctx.fillText('تشهد بأن الطالب/الطالبة', W / 2, 355);

      ctx.fillStyle = '#10241e';
      var nameSize = 82;
      ctx.font = '800 ' + nameSize + 'px ' + display;
      while (ctx.measureText(name).width > W - 380 && nameSize > 42) {
        nameSize -= 2;
        ctx.font = '800 ' + nameSize + 'px ' + display;
      }
      ctx.fillText(name, W / 2, 470);

      ctx.fillStyle = '#10241e';
      ctx.font = '400 31px ' + font;
      var lines = wrapCanvasText(ctx, 'قد أتمّ رحلة تعلّم مسألة السطرين في الكيمياء: موازنة المعادلات، حساب الكتل المولية، بناء السطر الثاني، وحل التناسبات بدقة.', W - 400);
      lines.forEach(function (line, i) {
        ctx.fillText(line, W / 2, 555 + i * 48);
      });

      var info = levelInfo(state.xp);
      var stats = [
        { v: info.index + 1, l: 'المستوى' },
        { v: state.xp, l: 'نقطة خبرة' },
        { v: state.counters.solved, l: 'مسألة محلولة' },
        { v: state.badges.length, l: 'شارة' }
      ];
      var boxW = 250;
      var gap = 26;
      var start = W / 2 - (boxW * 4 + gap * 3) / 2;
      stats.forEach(function (s, i) {
        var x = start + i * (boxW + gap);
        ctx.fillStyle = '#cdecdc';
        canvasRound(ctx, x, 690, boxW, 130, 18);
        ctx.fill();
        ctx.strokeStyle = '#10241e';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = '#0c4a3f';
        ctx.font = '800 46px ' + display;
        ctx.fillText(String(s.v), x + boxW / 2, 755);
        ctx.fillStyle = '#3d5a4f';
        ctx.font = '600 22px ' + font;
        ctx.fillText(s.l, x + boxW / 2, 795);
      });

      var date = new Date().toLocaleDateString('ar-SY', { year: 'numeric', month: 'long', day: 'numeric' });
      ctx.fillStyle = '#3d5a4f';
      ctx.font = '500 24px ' + font;
      ctx.fillText(date, W / 2, 910);
      ctx.fillText('معلّم الكيمياء', 310, 1010);
      ctx.fillStyle = '#10241e';
      ctx.fillRect(180, 1035, 260, 2);
      ctx.fillStyle = '#3d5a4f';
      ctx.font = '500 20px ' + font;
      ctx.fillText('التوقيع', 310, 1075);

      ctx.fillStyle = '#d8f27e';
      ctx.beginPath();
      ctx.arc(1390, 960, 62, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#10241e';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.fillStyle = '#10241e';
      ctx.font = '800 22px ' + display;
      ctx.fillText('إنجاز', 1390, 955);
      ctx.font = '600 15px ' + font;
      ctx.fillText('معتمد', 1390, 978);

      downloadCanvas(c, 'satrain-certificate-' + name.replace(/\s+/g, '-') + '.png');
      burst(100);
      toast('نُزّلت شهادة الإنجاز', 'is-badge', 'download');
    };
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(run).catch(run);
    } else {
      run();
    }
  }

  function makeWorksheet() {
    var chosen = shuffle(DATA.reactions).slice(0, 6);
    var questions = '';
    var answers = '';
    chosen.forEach(function (r, idx) {
      var given = r.species[0];
      var target = r.species[r.species.length - 1];
      var mass = r.defaultMass;
      var answer = round(mass * target.lineMass / given.lineMass, 2);
      questions += '<div class="ws-question">' +
        '<h3>المسألة ' + (idx + 1) + ' — ' + esc(r.title) + '</h3>' +
        '<div class="ws-eq">' + eqStringHTML(r) + '</div>' +
        '<p>إذا تفاعل <b>' + massNum(mass) + ' غ</b> من ' + esc(speciesName(given)) + '، فما كتلة <b>' +
        esc(speciesName(target)) + '</b> الناتجة؟ (اكتب الحل بالسطرين)</p>' +
        '<div class="ws-answer">الجواب: ................................ غ</div>' +
        '</div>';
      answers += '<li>المسألة ' + (idx + 1) + ': ' + massNum(answer) + ' غ — (' + massNum(mass) + ' × ' +
        massNum(target.lineMass) + ' ÷ ' + massNum(given.lineMass) + ')</li>';
    });

    var ws = $('#worksheet');
    if (!ws) return;
    ws.innerHTML = '<div class="ws-head"><h1>ورقة عمل — مسألة السطرين</h1>' +
      '<p>الكيمياء · الصف التاسع · وازن المعادلة، اكتب السطر الثاني، ثم حل التناسب.</p></div>' +
      '<div class="ws-name"><span>الاسم: ..........................</span><span>الصف: ................</span><span>التاريخ: ................</span></div>' +
      questions +
      '<div class="ws-key"><h2>مفتاح الإجابات (للمعلّم)</h2><ol>' + answers + '</ol></div>';

    setTimeout(function () { window.print(); }, 150);
    toast('ورقة عمل جاهزة للطباعة', '', 'print');
  }

  function doReset() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* تجاهل */ }
    state = defaultState();
    blockState = {
      reactionId: 'water', stage: 1, coef: [], coefSel: null, mass: [], massSel: null,
      prop: [null, null, null], propSel: null, answer: '', done: { 1: false, 2: false, 3: false }
    };
    applyTheme();
    applySound();
    updateXP();
    renderHome();
    renderGames();
    renderMe();
    renderArt();
    populateLabSelects();
    renderLab();
    resetBlockStage(false);
    renderBlocks();
    navigate('home');
    toast('بدأت من جديد. رحلة سعيدة!', '', 'seed');
    SFX.win();
    burst(60);
  }

  function bindMe() {
    var nameInput = $('#studentName');
    if (nameInput) {
      nameInput.addEventListener('input', function () {
        state.name = this.value.slice(0, 40);
        persist();
      });
    }

    $$('.filter-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        $$('.filter-btn').forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        badgeFilter = btn.getAttribute('data-filter') || 'all';
        renderBadges();
        SFX.click();
      });
    });

    $('#certBtn').addEventListener('click', makeCertificate);
    $('#worksheetBtn').addEventListener('click', makeWorksheet);

    $('#clearSavedBtn').addEventListener('click', function () {
      if (!state.saved.length) {
        toast('الدفتر فارغ أصلاً', '', 'info');
        return;
      }
      askConfirm('سيتم مسح كل المسائل المحفوظة. هل تريد المتابعة؟', function () {
        state.saved = [];
        persist();
        renderMe();
        toast('مُسح دفتر المسائل', '', 'trash');
      });
    });

    $('#resetBtn').addEventListener('click', function () {
      askConfirm('سيتم حذف كل تقدمك: النقاط، الشارات، والمسائل المحفوظة. هل أنت متأكد؟', doReset);
    });

    var yes = $('#confirmYes');
    if (yes) {
      yes.addEventListener('click', function () {
        var fn = confirmAction;
        confirmAction = null;
        var dlg = $('#confirmDialog');
        if (dlg) dlg.close();
        if (fn) fn();
      });
    }

    var saved = $('#savedList');
    if (saved) {
      saved.addEventListener('click', function (e) {
        var open = e.target.closest('[data-saved-open]');
        if (open) {
          var id = Number(open.getAttribute('data-saved-open'));
          var rec = state.saved.filter(function (s) { return s.id === id; })[0];
          if (rec) {
            setLabReaction(rec.reactionId, { given: rec.given, target: rec.target, mass: rec.mass });
            navigate('lab');
            SFX.pop();
          }
          return;
        }
        var del = e.target.closest('[data-saved-del]');
        if (del) {
          var did = Number(del.getAttribute('data-saved-del'));
          state.saved = state.saved.filter(function (s) { return s.id !== did; });
          persist();
          renderMe();
          toast('حُذفت المسألة', '', 'trash');
          SFX.click();
        }
      });
    }

    $$('[data-close-confirm]').forEach(function (b) {
      b.addEventListener('click', function () {
        var d = $('#confirmDialog');
        if (d) d.close();
      });
    });
  }

  function renderMePlaceholder() {}

  /* ======================================================================
     الإقلاع
     ====================================================================== */

  function bindGlobal() {
    document.addEventListener('click', function (e) {
      var nav = e.target.closest('[data-view]');
      if (nav && !e.target.closest('dialog')) {
        e.preventDefault();
        navigate(nav.getAttribute('data-view'));
        SFX.click();
      }
    });

    window.addEventListener('hashchange', function () {
      var h = (location.hash || '#home').replace('#', '');
      if (VIEWS.indexOf(h) !== -1 && h !== currentView) navigate(h, true);
    });

    $('#themeBtn').addEventListener('click', function () {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      persist();
      applyTheme();
      SFX.click();
    });

    $('#soundBtn').addEventListener('click', function () {
      state.sound = !state.sound;
      persist();
      applySound();
      if (state.sound) SFX.ok();
    });

    $('#nextTipBtn').addEventListener('click', nextTip);
    $('#elementsBtn').addEventListener('click', openElements);

    $$('[data-close-dialog]').forEach(function (b) {
      b.addEventListener('click', function () {
        var d = b.closest('dialog');
        if (d) d.close();
      });
    });

    var elementsDlg = $('#elementsDialog');
    if (elementsDlg) {
      elementsDlg.addEventListener('click', function (e) {
        if (e.target === elementsDlg) elementsDlg.close();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var game = $('#gameDialog');
        if (game && game.open) closeGame();
      }
    });
  }

  function init() {
    loadState();
    applyTheme();
    applySound();
    updateXP();
    bindGlobal();
    bindLesson();
    bindLab();
    bindBlocks();
    bindGames();
    bindArt();
    bindMe();
    renderHome();
    renderGames();
    renderMe();
    renderArt();
    renderLab();
    renderBlocks();

    var initial = (location.hash || '').replace('#', '');
    navigate(VIEWS.indexOf(initial) !== -1 ? initial : 'home', true);
    document.documentElement.classList.add('is-ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
