/*
 * chemistry.js
 * محرّك كيميائي صغير: قراءة الصيغ، حساب الكتل المولية، وموازنة المعادلات.
 * يعمل في المتصفح (window.Chem) وفي Node (module.exports) للاختبار.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Chem = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* الكتل الذرية المدرسية (مقرّبة كما في الكتاب) */
  var ATOMIC = {
    H: { mass: 1, ar: 'هيدروجين', color: '#F5F0E1' },
    He: { mass: 4, ar: 'هيليوم', color: '#D9F2C4' },
    Li: { mass: 7, ar: 'ليثيوم', color: '#F2A3A3' },
    Be: { mass: 9, ar: 'بيريليوم', color: '#C6E3B0' },
    B: { mass: 11, ar: 'بورون', color: '#E8B7A0' },
    C: { mass: 12, ar: 'كربون', color: '#2F3B38' },
    N: { mass: 14, ar: 'آزوت', color: '#7C9BFF' },
    O: { mass: 16, ar: 'أكسجين', color: '#F0603C' },
    F: { mass: 19, ar: 'فليور', color: '#A9E5A0' },
    Ne: { mass: 20, ar: 'نيون', color: '#F6C1C1' },
    Na: { mass: 23, ar: 'صوديوم', color: '#B58CFF' },
    Mg: { mass: 24, ar: 'مغنيزيوم', color: '#8FD14F' },
    Al: { mass: 27, ar: 'ألمنيوم', color: '#B9C6CF' },
    Si: { mass: 28, ar: 'سيليسيوم', color: '#D9B382' },
    P: { mass: 31, ar: 'فوسفور', color: '#FF9F45' },
    S: { mass: 32, ar: 'كبريت', color: '#F2C94C' },
    Cl: { mass: 35.5, ar: 'كلور', color: '#6FD08C' },
    Ar: { mass: 40, ar: 'أرغون', color: '#C4D7E0' },
    K: { mass: 39, ar: 'بوتاسيوم', color: '#9A7BFF' },
    Ca: { mass: 40, ar: 'كالسيوم', color: '#7ED6C4' },
    Ti: { mass: 48, ar: 'تيتانيوم', color: '#AFC3CC' },
    Cr: { mass: 52, ar: 'كروم', color: '#9BB7C9' },
    Mn: { mass: 55, ar: 'منغنيز', color: '#C77DBB' },
    Fe: { mass: 56, ar: 'حديد', color: '#C97A4A' },
    Co: { mass: 59, ar: 'كوبالت', color: '#7A9CC6' },
    Ni: { mass: 59, ar: 'نيكل', color: '#A8B8A0' },
    Cu: { mass: 63.5, ar: 'نحاس', color: '#D98A5F' },
    Zn: { mass: 65, ar: 'زنك', color: '#8FB3C9' },
    Br: { mass: 80, ar: 'بروم', color: '#B85C38' },
    Ag: { mass: 108, ar: 'فضة', color: '#CFD8DC' },
    Sn: { mass: 119, ar: 'قصدير', color: '#B8C4C9' },
    I: { mass: 127, ar: 'يود', color: '#8E6BC7' },
    Ba: { mass: 137, ar: 'باريوم', color: '#8ED08A' },
    Pt: { mass: 195, ar: 'بلاتين', color: '#D7DEE2' },
    Au: { mass: 197, ar: 'ذهب', color: '#F0C24B' },
    Hg: { mass: 201, ar: 'زئبق', color: '#AEB9BE' },
    Pb: { mass: 207, ar: 'رصاص', color: '#7C8A96' },
    U: { mass: 238, ar: 'يورانيوم', color: '#8FAF8A' }
  };

  function round1(x) {
    return Math.round(x * 10) / 10;
  }

  function gcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) {
      var t = a % b;
      a = b;
      b = t;
    }
    return a || 1;
  }

  function lcm(a, b) {
    return Math.abs(a * b) / gcd(a, b);
  }

  /* ---------- كسور دقيقة ---------- */
  function F(n, d) {
    d = d === undefined ? 1 : d;
    if (d === 0) throw new Error('قسمة على صفر');
    if (d < 0) {
      n = -n;
      d = -d;
    }
    var g = gcd(n, d);
    return { n: n / g, d: d / g };
  }
  function fadd(a, b) {
    return F(a.n * b.d + b.n * a.d, a.d * b.d);
  }
  function fsub(a, b) {
    return F(a.n * b.d - b.n * a.d, a.d * b.d);
  }
  function fmul(a, b) {
    return F(a.n * b.n, a.d * b.d);
  }
  function fdiv(a, b) {
    return F(a.n * b.d, a.d * b.n);
  }
  function fneg(a) {
    return F(-a.n, a.d);
  }
  function fisInt(a) {
    return a.d === 1;
  }

  /* ---------- قراءة الصيغة ---------- */
  function parseFormula(formula) {
    if (typeof formula !== 'string') throw new Error('صيغة غير صالحة');
    var f = formula.replace(/\s+/g, '').replace(/[٠-٩]/g, function (c) {
      return String('٠١٢٣٤٥٦٧٨٩'.indexOf(c));
    });
    if (!f) throw new Error('صيغة فارغة');
    if (!/^[A-Za-z0-9()]+$/.test(f)) throw new Error('رمز غير مسموح في الصيغة: ' + formula);

    var stack = [{}];
    var i = 0;
    function readNumber() {
      var s = '';
      while (i < f.length && /[0-9]/.test(f[i])) {
        s += f[i];
        i++;
      }
      if (s === '') return 1;
      var n = parseInt(s, 10);
      if (!n) throw new Error('رقم غير صالح في ' + formula);
      return n;
    }
    function add(el, n) {
      var top = stack[stack.length - 1];
      top[el] = (top[el] || 0) + n;
    }

    while (i < f.length) {
      var ch = f[i];
      if (ch === '(') {
        if (i === 0) throw new Error('قوس في بداية الصيغة');
        stack.push({});
        i++;
      } else if (ch === ')') {
        i++;
        var mult = readNumber();
        if (stack.length === 1) throw new Error('قوس غير متوازن في ' + formula);
        var group = stack.pop();
        var keys = Object.keys(group);
        if (!keys.length) throw new Error('مجموعة فارغة في ' + formula);
        for (var k = 0; k < keys.length; k++) add(keys[k], group[keys[k]] * mult);
      } else if (/[A-Z]/.test(ch)) {
        var sym = ch;
        i++;
        while (i < f.length && /[a-z]/.test(f[i])) {
          sym += f[i];
          i++;
        }
        if (!ATOMIC[sym]) throw new Error('العنصر «' + sym + '» غير موجود في جدولنا المصغّر');
        var n = readNumber();
        add(sym, n);
      } else {
        throw new Error('صيغة غير مفهومة: ' + formula + ' (الرمز ' + ch + ')');
      }
    }
    if (stack.length !== 1) throw new Error('أقواس غير متوازنة في ' + formula);
    var result = stack[0];
    if (!Object.keys(result).length) throw new Error('صيغة بلا عناصر');
    return result;
  }

  function formulaElements(formula) {
    return Object.keys(parseFormula(formula));
  }

  function molarMass(formula) {
    var counts = parseFormula(formula);
    var total = 0;
    for (var el in counts) {
      if (!ATOMIC[el]) throw new Error('كتلة ذرية مجهولة للعنصر ' + el);
      total += ATOMIC[el].mass * counts[el];
    }
    return round1(total);
  }

  function elementMass(formula, el) {
    var counts = parseFormula(formula);
    return round1((counts[el] || 0) * ATOMIC[el].mass);
  }

  function formatFormula(formula) {
    var safe = String(formula)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return safe.replace(/([A-Za-z)])(\d+)/g, '$1<sub>$2</sub>');
  }

  /* ---------- قراءة المعادلة ---------- */
  function splitSide(side, which) {
    var tokens = side.split('+');
    var out = [];
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i].trim();
      if (!t) continue;
      var m = t.match(/^(\d*)\s*([A-Za-z0-9()]+)$/);
      if (!m) throw new Error('مكوّن غير مفهوم: «' + t + '»');
      var givenCoef = m[1] ? parseInt(m[1], 10) : 1;
      if (givenCoef < 1) throw new Error('معامل غير صالح في «' + t + '»');
      var formula = m[2];
      out.push({
        formula: formula,
        givenCoef: givenCoef,
        counts: parseFormula(formula),
        side: which,
        molarMass: molarMass(formula)
      });
    }
    if (!out.length) throw new Error('أحد طرفي المعادلة فارغ');
    return out;
  }

  function parseEquation(equation) {
    if (typeof equation !== 'string') throw new Error('معادلة غير صالحة');
    var parts = equation.split(/->|→|=>|=/);
    if (parts.length !== 2) throw new Error('ضع سهماً واحداً بين المتفاعلات والنواتج: →');
    var reactants = splitSide(parts[0], 'left');
    var products = splitSide(parts[1], 'right');
    return { reactants: reactants, products: products };
  }

  function allElements(parsed) {
    var seen = {};
    var order = [];
    parsed.reactants.concat(parsed.products).forEach(function (sp) {
      Object.keys(sp.counts).forEach(function (el) {
        if (!seen[el]) {
          seen[el] = true;
          order.push(el);
        }
      });
    });
    return order;
  }

  function speciesOf(parsed) {
    return parsed.reactants.concat(parsed.products);
  }

  /*
   * موازنة المعادلة عبر اختزال غاوس-جوردان على الكسور.
   * نبحث عن أصغر معاملات صحيحة موجبة.
   */
  function balance(equation) {
    var parsed = parseEquation(equation);
    var species = speciesOf(parsed);
    var elements = allElements(parsed);
    if (!elements.length) throw new Error('لا عناصر في المعادلة');
    if (species.length > 14) throw new Error('المعادلة طويلة جداً لهذا المحرّك الصغير');

    var m = elements.length;
    var n = species.length;
    var rows = [];
    for (var r = 0; r < m; r++) {
      var row = [];
      for (var c = 0; c < n; c++) {
        var sp = species[c];
        var count = sp.counts[elements[r]] || 0;
        row.push(F(sp.side === 'left' ? count : -count));
      }
      rows.push(row);
    }

    /* اختزال */
    var pivotRow = 0;
    var pivotCols = [];
    var pivotAt = [];
    for (var col = 0; col < n && pivotRow < m; col++) {
      var sel = -1;
      for (var rr = pivotRow; rr < m; rr++) {
        if (rows[rr][col].n !== 0) {
          sel = rr;
          break;
        }
      }
      if (sel === -1) continue;
      var tmp = rows[pivotRow];
      rows[pivotRow] = rows[sel];
      rows[sel] = tmp;
      var p = rows[pivotRow][col];
      for (var cc = 0; cc < n; cc++) rows[pivotRow][cc] = fdiv(rows[pivotRow][cc], p);
      for (var r2 = 0; r2 < m; r2++) {
        if (r2 !== pivotRow && rows[r2][col].n !== 0) {
          var factor = rows[r2][col];
          for (var c2 = 0; c2 < n; c2++) {
            rows[r2][c2] = fsub(rows[r2][c2], fmul(factor, rows[pivotRow][c2]));
          }
        }
      }
      pivotCols.push(col);
      pivotAt[col] = pivotRow;
      pivotRow++;
    }

    var isPivot = new Array(n).fill(false);
    pivotCols.forEach(function (pc) {
      isPivot[pc] = true;
    });
    var freeCols = [];
    for (var f = 0; f < n; f++) if (!isPivot[f]) freeCols.push(f);
    if (!freeCols.length) throw new Error('هذه المعادلة لا تحتاج موازنة أو لا تملك حلاً غير الصفر');

    if (freeCols.length > 4) throw new Error('المعادلة تحتاج معلومات إضافية للموازنة');

    var best = null;
    var ranges = [];
    var totalCombos = 1;
    for (var fi = 0; fi < freeCols.length; fi++) {
      ranges.push(6);
      totalCombos *= 6;
    }
    if (totalCombos > 3000) throw new Error('المعادلة معقّدة أكثر من اللازم');

    var assignment = new Array(freeCols.length).fill(1);

    function evaluate() {
      var x = new Array(n);
      for (var z = 0; z < n; z++) x[z] = F(0);
      for (var q = 0; q < freeCols.length; q++) x[freeCols[q]] = F(assignment[q]);
      for (var pr = 0; pr < pivotCols.length; pr++) {
        var pc = pivotCols[pr];
        var sum = F(0);
        for (var q2 = 0; q2 < freeCols.length; q2++) {
          sum = fadd(sum, fmul(rows[pr][freeCols[q2]], x[freeCols[q2]]));
        }
        x[pc] = fneg(sum);
      }
      for (var v = 0; v < n; v++) {
        if (x[v].n <= 0) return;
      }
      var L = 1;
      for (var v2 = 0; v2 < n; v2++) L = lcm(L, x[v2].d);
      var ints = [];
      var g = 0;
      for (var v3 = 0; v3 < n; v3++) {
        var k = (x[v3].n * L) / x[v3].d;
        ints.push(k);
        g = gcd(g, k);
      }
      for (var v4 = 0; v4 < n; v4++) ints[v4] = ints[v4] / g;
      var sumInts = ints.reduce(function (a, b) {
        return a + b;
      }, 0);
      if (!best || sumInts < best.sum || (sumInts === best.sum && Math.max.apply(null, ints) < best.max)) {
        best = {
          sum: sumInts,
          max: Math.max.apply(null, ints),
          ints: ints.slice()
        };
      }
    }

    function walk(idx) {
      if (idx === freeCols.length) {
        evaluate();
        return;
      }
      for (var v = 1; v <= ranges[idx]; v++) {
        assignment[idx] = v;
        walk(idx + 1);
      }
    }
    walk(0);

    if (!best) throw new Error('لم أجد معاملات موجبة توازن هذه المعادلة');

    /* تحقّق نهائي */
    var totals = {};
    species.forEach(function (sp, idx2) {
      var coef = best.ints[idx2];
      Object.keys(sp.counts).forEach(function (el) {
        var sign = sp.side === 'left' ? 1 : -1;
        totals[el] = (totals[el] || 0) + sign * coef * sp.counts[el];
      });
    });
    for (var el2 in totals) {
      if (totals[el2] !== 0) throw new Error('فشل التحقق من الموازنة عند العنصر ' + el2);
    }

    var out = species.map(function (sp, idx3) {
      return {
        formula: sp.formula,
        coef: best.ints[idx3],
        counts: sp.counts,
        side: sp.side,
        molarMass: sp.molarMass,
        lineMass: round1(best.ints[idx3] * sp.molarMass)
      };
    });
    return {
      reactants: out.filter(function (s) {
        return s.side === 'left';
      }),
      products: out.filter(function (s) {
        return s.side === 'right';
      }),
      species: out,
      elements: elements
    };
  }

  function verify(equation) {
    try {
      var b = balance(equation);
      return { ok: true, balanced: b };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  function totalMass(species) {
    return round1(
      species.reduce(function (sum, sp) {
        return sum + sp.coef * sp.molarMass;
      }, 0)
    );
  }

  function moleCount(mass, formula) {
    return mass / molarMass(formula);
  }

  return {
    ATOMIC: ATOMIC,
    parseFormula: parseFormula,
    formulaElements: formulaElements,
    molarMass: molarMass,
    elementMass: elementMass,
    formatFormula: formatFormula,
    parseEquation: parseEquation,
    balance: balance,
    verify: verify,
    totalMass: totalMass,
    moleCount: moleCount,
    round1: round1
  };
});
