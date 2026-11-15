/*
 * data.js — كل محتوى التطبيق: التفاعلات، الأسماء، الأسئلة، الشارات.
 */
(function () {
  'use strict';
  var Chem = window.Chem;

  var NAMES = {
    H2: 'هيدروجين',
    O2: 'أكسجين',
    H2O: 'ماء',
    CH4: 'ميثان',
    CO2: 'ثاني أكسيد الكربون',
    Fe: 'حديد',
    Fe2O3: 'أكسيد الحديد الثلاثي (الصدأ)',
    N2: 'آزوت',
    NH3: 'أمونيا',
    CaCO3: 'كربونات الكالسيوم',
    CaO: 'أكسيد الكالسيوم (الكلس الحي)',
    Mg: 'مغنيزيوم',
    MgO: 'أكسيد المغنيزيوم',
    Na: 'صوديوم',
    Cl2: 'كلور',
    NaCl: 'كلوريد الصوديوم (ملح الطعام)',
    Zn: 'زنك',
    HCl: 'حمض كلور الماء',
    ZnCl2: 'كلوريد الزنك',
    C3H8: 'بروبان',
    Al: 'ألمنيوم',
    Al2O3: 'أكسيد الألمنيوم',
    KClO3: 'كلورات البوتاسيوم',
    KCl: 'كلوريد البوتاسيوم',
    C6H12O6: 'غلوكوز',
    C2H6: 'إيثان',
    H2SO4: 'حمض الكبريت',
    NaOH: 'هيدروكسيد الصوديوم',
    Na2SO4: 'كبريتات الصوديوم',
    'Ca(OH)2': 'هيدروكسيد الكالسيوم',
    H3PO4: 'حمض الفوسفور',
    'Ca3(PO4)2': 'فوسفات الكالسيوم',
    NaHCO3: 'بيكربونات الصوديوم',
    Na2CO3: 'كربونات الصوديوم',
    NO2: 'ثاني أكسيد الآزوت',
    NO: 'أكسيد الآزوت',
    Cu: 'نحاس',
    'Cu(NO3)2': 'نترات النحاس',
    HNO3: 'حمض الآزوت',
    SO2: 'ثاني أكسيد الكبريت',
    P4: 'فوسفور',
    P2O5: 'خامس أكسيد الفوسفور'
  };

  var rawReactions = [
    {
      id: 'water',
      title: 'تشكّل الماء',
      subtitle: 'هيدروجين + أكسجين ← ماء',
      eq: 'H2 + O2 -> H2O',
      tag: 'تكوين',
      accent: 'sky',
      icon: 'drop',
      story: 'عندما يحترق الهيدروجين في الأكسجين تتشكل قطرات ماء. هذه المعادلة هي أشهر مثال على مسألة السطرين.',
      fact: 'قطرة ماء واحدة تحتوي على أكثر من 10²¹ جزيء ماء!',
      given: 'H2',
      target: 'H2O',
      mass: 8,
      maxMass: 40
    },
    {
      id: 'methane',
      title: 'احتراق الميثان',
      subtitle: 'غاز الطبخ + أكسجين ← ماء + ثاني أكسيد الكربون',
      eq: 'CH4 + O2 -> CO2 + H2O',
      tag: 'احتراق',
      accent: 'coral',
      icon: 'flame',
      story: 'الميثان هو الغاز الذي يشتعل في مواقد المنازل. لاحظ أن الاحتراق الكامل ينتج ماءً أيضاً، لا ثاني أكسيد الكربون فقط.',
      fact: 'اللهب الأزرق يعني احتراقاً كاملاً. اللهب الأصفر يعني نقصاً في الأكسجين.',
      given: 'CH4',
      target: 'CO2',
      mass: 32,
      maxMass: 160
    },
    {
      id: 'rust',
      title: 'صدأ الحديد',
      subtitle: 'حديد + أكسجين ← أكسيد الحديد',
      eq: 'Fe + O2 -> Fe2O3',
      tag: 'تكوين',
      accent: 'amber',
      icon: 'shield',
      story: 'الصدأ تفاعل بطيء جداً بين الحديد وأكسجين الهواء. هذه المعادلة تحتاج موازنة لأن الحديد والأكسجين لا يتحدان بنسبة 1:1.',
      fact: 'طبقة الصدأ هشّة، لذلك تبقى أكسدة الحديد تتقدم داخل المعدن.',
      given: 'Fe',
      target: 'Fe2O3',
      mass: 56,
      maxMass: 560
    },
    {
      id: 'ammonia',
      title: 'تصنيع الأمونيا',
      subtitle: 'آزوت + هيدروجين ← أمونيا',
      eq: 'N2 + H2 -> NH3',
      tag: 'صناعة',
      accent: 'mint',
      icon: 'leaf',
      story: 'الأمونيا مادة أساسية في صناعة الأسمدة. تفاعل الآزوت مع الهيدروجين يحتاج حرارة وضغطاً مرتفعين.',
      fact: 'الهواء الذي نتنفسه نحو 78% آزوت، لكنه خامل ولا يتفاعل بسهولة.',
      given: 'N2',
      target: 'NH3',
      mass: 28,
      maxMass: 280
    },
    {
      id: 'limestone',
      title: 'حرق الكلس',
      subtitle: 'كربونات الكالسيوم ← كلس حي + ثاني أكسيد الكربون',
      eq: 'CaCO3 -> CaO + CO2',
      tag: 'تحلل',
      accent: 'sand',
      icon: 'mountain',
      story: 'في أفران الإسمنت تُحرّق كربونات الكالسيوم لتتحول إلى كلس حي. لاحظ أن التفاعل هنا تفكك لا اتحاد.',
      fact: 'الكلس الحي يستخدم في البناء وترميم التربة، وإذا أضفت إليه الماء يسخن بشدة.',
      given: 'CaCO3',
      target: 'CaO',
      mass: 200,
      maxMass: 1000
    },
    {
      id: 'magnesium',
      title: 'احتراق المغنيزيوم',
      subtitle: 'مغنيزيوم + أكسجين ← أكسيد المغنيزيوم',
      eq: 'Mg + O2 -> MgO',
      tag: 'احتراق',
      accent: 'violet',
      icon: 'spark',
      story: 'يحترق شريط المغنيزيوم بضوء أبيض مبهر. في المختبر يجب تغطية العينين عند إجراء هذه التجربة.',
      fact: 'أكسيد المغنيزيوم مسحوق أبيض يُستخدم في بعض الأدوية ومضادات الحموضة.',
      given: 'Mg',
      target: 'MgO',
      mass: 48,
      maxMass: 240
    },
    {
      id: 'salt',
      title: 'صناعة ملح الطعام',
      subtitle: 'صوديوم + كلور ← كلوريد الصوديوم',
      eq: 'Na + Cl2 -> NaCl',
      tag: 'تكوين',
      accent: 'mint',
      icon: 'salt',
      story: 'الصوديوم فلز لامع عنيف التفاعل، والكلور غاز سام. لكن اتحادهما يعطي ملح الطعام الذي نأكله.',
      fact: 'هذا التفاعل ناشر للحرارة بشدة، ولا يُجرى إلا بكميات صغيرة وتحت إشراف.',
      given: 'Na',
      target: 'NaCl',
      mass: 46,
      maxMass: 230
    },
    {
      id: 'zinc',
      title: 'الزنك مع الحمض',
      subtitle: 'زنك + حمض كلور الماء ← كلوريد الزنك + هيدروجين',
      eq: 'Zn + HCl -> ZnCl2 + H2',
      tag: 'حمض',
      accent: 'sky',
      icon: 'bubble',
      story: 'عند وضع قطعة زنك في حمض كلور الماء تتصاعد فقاعات الهيدروجين. يمكنك جمعها وإشعالها بفرقعة صغيرة.',
      fact: 'الزنك يُستخدم لحماية الحديد من الصدأ بعملية تسمى «الغلفنة».',
      given: 'Zn',
      target: 'H2',
      mass: 65,
      maxMass: 325
    },
    {
      id: 'propane',
      title: 'احتراق البروبان',
      subtitle: 'بروبان + أكسجين ← ماء + ثاني أكسيد الكربون',
      eq: 'C3H8 + O2 -> CO2 + H2O',
      tag: 'احتراق',
      accent: 'amber',
      icon: 'cylinder',
      story: 'البروبان هو غاز أسطوانات الطبخ. احتراقه الكامل يعطي حرارة كبيرة، ولهذا تُستخدم أسطوانة صغيرة لطهي وجبات كثيرة.',
      fact: 'معاملات المعادلة تخبرنا أن مولاً واحداً من البروبان يحتاج 5 مولات من الأكسجين.',
      given: 'C3H8',
      target: 'H2O',
      mass: 44,
      maxMass: 220
    },
    {
      id: 'oxygen',
      title: 'تحضير الأكسجين',
      subtitle: 'كلورات البوتاسيوم ← كلوريد البوتاسيوم + أكسجين',
      eq: 'KClO3 -> KCl + O2',
      tag: 'تحلل',
      accent: 'violet',
      icon: 'flask',
      story: 'في المختبر المدرسي نحضّر الأكسجين بتسخين كلورات البوتاسيوم مع قليل من ثاني أكسيد المنغنيز. الغاز المتصاعد يعيد إشعال عود ثقاب متوهج.',
      fact: 'هذه من أشهر تفاعلات التحلل الحراري، وتُستعمل لإنتاج الأكسجين في المختبر.',
      given: 'KClO3',
      target: 'O2',
      mass: 245,
      maxMass: 1225
    }
  ];

  var reactions = [];
  rawReactions.forEach(function (r) {
    try {
      var b = Chem.balance(r.eq);
      var species = b.species.map(function (s) {
        s.name = NAMES[s.formula] || s.formula;
        return s;
      });
      b.species = species;
      b.reactants = species.filter(function (s) {
        return s.side === 'left';
      });
      b.products = species.filter(function (s) {
        return s.side === 'right';
      });
      var given = species.filter(function (s) {
        return s.formula === r.given;
      })[0] || species[0];
      var target = species.filter(function (s) {
        return s.formula === r.target;
      })[0] || species[species.length - 1];
      reactions.push({
        id: r.id,
        title: r.title,
        subtitle: r.subtitle,
        eq: r.eq,
        tag: r.tag,
        accent: r.accent,
        icon: r.icon,
        story: r.story,
        fact: r.fact,
        givenId: given ? given.formula : species[0].formula,
        targetId: target ? target.formula : species[1].formula,
        defaultMass: r.mass,
        maxMass: r.maxMass,
        reactants: b.reactants,
        products: b.products,
        species: b.species,
        elements: b.elements,
        totalMass: Chem.totalMass(species)
      });
    } catch (e) {
      console.warn('تعذّر تحميل التفاعل', r.id, e);
    }
  });

  function findReaction(id) {
    return reactions.filter(function (r) {
      return r.id === id;
    })[0];
  }

  function speciesByName(reaction, formula) {
    return reaction.species.filter(function (s) {
      return s.formula === formula;
    })[0];
  }

  /* قاعدة بيانات صغيرة لأسئلة الكتل المولية */
  var molarPool = [
    'H2', 'O2', 'H2O', 'CH4', 'CO2', 'NaCl', 'CaCO3', 'CaO', 'NH3',
    'MgO', 'FeS', 'Al2O3', 'ZnCl2', 'HCl', 'KClO3', 'KCl', 'C3H8',
    'C6H12O6', 'H2SO4', 'NaOH', 'Na2SO4', 'Ca(OH)2', 'C2H6', 'NaHCO3',
    'Na2CO3', 'SO2', 'NO2', 'P2O5', 'Fe2O3', 'Ca3(PO4)2'
  ];

  var molarDb = molarPool.map(function (f) {
    return {
      formula: f,
      name: NAMES[f] || f,
      mass: Chem.molarMass(f),
      html: Chem.formatFormula(f)
    };
  });

  /* ترتيب خطوات الحل — لعبة الترتيب */
  var solutionSteps = [
    'اكتب المعادلة الصحيحة ووازنها.',
    'احسب الكتلة المولية لكل مادة في المعادلة.',
    'اكتب السطر الثاني: معامل كل مادة × كتلتها المولية.',
    'ضع كتلة المعطى تحت مادتها، والمجهول «س» تحت المادة المطلوبة.',
    'حل التناسب وتأكد من وحدات النتيجة.'
  ];

  /* صح أم خطأ */
  var trueFalse = [
    { text: 'الكتلة المولية للماء H₂O هي 18 غ/مول.', answer: true, why: '2×1 + 16 = 18 غ/مول.' },
    { text: 'المعامل 2 قبل H₂ يعني 2 غرام من الهيدروجين.', answer: false, why: 'المعامل يعني عدد المولات، وليس الغرامات.' },
    { text: 'في المعادلة الموزونة، عدد ذرات كل عنصر متساوٍ في الطرفين.', answer: true, why: 'هذا هو معنى الموازنة: حفظ المادة.' },
    { text: 'السطر الثاني يحتوي على كتل المواد = المعامل × الكتلة المولية.', answer: true, why: 'هذه هي فكرة السطر الثاني بالضبط.' },
    { text: 'يمكن حل مسألة السطرين دون موازنة المعادلة.', answer: false, why: 'بدون موازنة تكون النسب خاطئة، والنتيجة خاطئة.' },
    { text: 'الكتلة المولية لـ CO₂ هي 28 غ/مول.', answer: false, why: '12 + 32 = 44 غ/مول.' },
    { text: 'المول الواحد من أي غاز يشغل 22.4 لتر عند الشروط النظامية.', answer: true, why: 'حجم مول الغاز عند 0°س و1 ضغط جوي ≈ 22.4 لتر.' },
    { text: 'عند تفاعل 4 غ من H₂ مع أكسجين كافٍ نحصل على 36 غ ماء.', answer: true, why: 'السطر الثاني: 4غ ← 36غ، فالنسبة 1:9.' },
    { text: 'المعاملات في المعادلة تمثل نسب الحجوم للغازات أيضاً.', answer: true, why: 'حسب قانون أفوجادرو، نسب الحجوم = نسب المولات للغازات.' },
    { text: 'الكتلة المولية لـ NaCl هي 58.5 غ/مول.', answer: true, why: '23 + 35.5 = 58.5.' },
    { text: 'في 2H₂ + O₂ → 2H₂O، نسبة H₂ إلى O₂ هي 2:2.', answer: false, why: 'النسبة 2:1، لأن معامل O₂ هو 1.' },
    { text: 'يمكن التحقق من الحل بحساب عدد مولات الناتج.', answer: true, why: 'الرجوع إلى المولات طريقة تحقق ممتازة.' },
    { text: 'عند مضاعفة كمية المتفاعلات تتضاعف كمية النواتج.', answer: true, why: 'بشرط وجود الكمية الكافية من المتفاعل الآخر.' },
    { text: 'الكتلة المولية لـ O₂ هي 16 غ/مول.', answer: false, why: '16 هي كتلة ذرة الأكسجين، أما O₂ فكتلته 32.' },
    { text: 'كتلة الماء الناتجة عن احتراق الهيدروجين تساوي كتلة الهيدروجين فقط.', answer: false, why: 'الماء يحتوي أيضاً على أكسجين من الهواء، والكتلة محفوظة بمجموع المتفاعلات.' },
    { text: 'في مسألة السطرين نضع المعطى تحت مادته في السطر الثاني.', answer: true, why: 'المقابلة الصحيحة هي سر الحل.' },
    { text: 'الرقم 3 في 3H₂O يعني 3 جزيئات ماء.', answer: true, why: 'المعامل يضرب الصيغة كلها.' },
    { text: 'يمكن استخدام أي طرف في التناسب بشرط المقابلة الصحيحة.', answer: true, why: 'المهم أن تقابل كل كمية مادتها.' },
    { text: 'الكتلة المولية لـ CH₄ هي 16 غ/مول.', answer: true, why: '12 + 4 = 16.' },
    { text: 'المول هو عدد أفوجادرو من الجسيمات ≈ 6.02×10²³.', answer: true, why: 'هذا تعريف المول.' },
    { text: 'الكتلة لا تُحفظ في التفاعلات الكيميائية.', answer: false, why: 'الكتلة محفوظة دائماً في التفاعلات العادية.' },
    { text: 'في التناسب يجب أن تتقابل الوحدات: غرام مع غرام.', answer: true, why: 'الوحدات المتقابلة تحمي من الخطأ.' },
    { text: 'المعامل 1 لا يُكتب عادة قبل الصيغة.', answer: true, why: 'نكتب H₂O بدلاً من 1H₂O.' },
    { text: 'الكتلة المولية لـ CaCO₃ هي 100 غ/مول.', answer: true, why: '40 + 12 + 48 = 100.' }
  ];

  /* ألعاب */
  var games = [
    {
      id: 'balance',
      title: 'برق الموازنة',
      desc: 'اختر المعامل الناقص قبل أن ينطفئ اللهب.',
      icon: 'bolt',
      accent: 'amber',
      time: 60,
      tag: 'سرعة'
    },
    {
      id: 'molar',
      title: 'ميزان الكتل',
      desc: 'طابق كل صيغة مع كتلتها المولية.',
      icon: 'scale',
      accent: 'sky',
      time: 60,
      tag: 'ذاكرة'
    },
    {
      id: 'proportion',
      title: 'قنّاص التناسب',
      desc: 'احسب الكتلة المطلوبة من السطر الثاني.',
      icon: 'target',
      accent: 'coral',
      time: 90,
      tag: 'حساب'
    },
    {
      id: 'truefalse',
      title: 'صح أم خطأ',
      desc: 'احكم على العبارات بسرعة وبراعة.',
      icon: 'check',
      accent: 'mint',
      time: 45,
      tag: 'فهم'
    },
    {
      id: 'memory',
      title: 'ذاكرة الجزيئات',
      desc: 'اقلِب البطاقات وطابق الاسم مع الصيغة.',
      icon: 'brain',
      accent: 'violet',
      time: 0,
      tag: 'ذاكرة'
    },
    {
      id: 'steps',
      title: 'رتّب الخطة',
      desc: 'أعد ترتيب خطوات الحل الخمس.',
      icon: 'list',
      accent: 'sand',
      time: 0,
      tag: 'منطق'
    },
    {
      id: 'boss',
      title: 'التحدي الشامل',
      desc: '10 أسئلة مختلطة… هل تصمد؟',
      icon: 'trophy',
      accent: 'green',
      time: 180,
      tag: 'تحدٍ'
    }
  ];

  var badges = [
    { id: 'lesson', title: 'أول خطوة', desc: 'أكملت درس مسألة السطرين.', icon: 'book' },
    { id: 'firstSolve', title: 'معطف المختبر', desc: 'حللت أول مسألة في المختبر.', icon: 'flask' },
    { id: 'solver10', title: 'آلة الحساب', desc: 'حللت 10 مسائل في المختبر.', icon: 'calculator' },
    { id: 'blocks', title: 'بنّاء المعادلات', desc: 'أكملت ورشة المكعبات.', icon: 'blocks' },
    { id: 'balance5', title: 'موازن بارع', desc: 'وازنت 5 معادلات في الألعاب.', icon: 'scale' },
    { id: 'gameFirst', title: 'لاعب مجتهد', desc: 'لعبت أول لعبة تفاعلية.', icon: 'game' },
    { id: 'highScore', title: 'قنّاص النقاط', desc: 'سجلت 150 نقطة في لعبة.', icon: 'target' },
    { id: 'memory', title: 'ذاكرة فولاذية', desc: 'أكملت لعبة ذاكرة الجزيئات.', icon: 'brain' },
    { id: 'artist', title: 'فنان المختبر', desc: 'شغّلت تفاعلاً في المرسم.', icon: 'palette' },
    { id: 'level5', title: 'نجم الكيمياء', desc: 'وصلت إلى المستوى الخامس.', icon: 'star' },
    { id: 'boss', title: 'بطل التحدي', desc: 'أتممت التحدي الشامل.', icon: 'trophy' },
    { id: 'daily', title: 'مثابر', desc: 'حللت مسألة اليوم.', icon: 'calendar' }
  ];

  var levels = [
    { xp: 0, title: 'مبتدئ', icon: 'seed' },
    { xp: 120, title: 'متعلّم', icon: 'book' },
    { xp: 300, title: 'موازِن', icon: 'scale' },
    { xp: 560, title: 'كيميائي', icon: 'flask' },
    { xp: 900, title: 'خبير', icon: 'atom' },
    { xp: 1320, title: 'أسطورة المختبر', icon: 'crown' }
  ];

  var tips = [
    'ابدأ دائماً بموازنة المعادلة. معادلة غير موزونة = جواب غير صحيح.',
    'الكتلة المولية للماء 18 غ/مول، لأن 2×1 + 16 = 18.',
    'المعامل قبل الصيغة يضرب الكتلة المولية كلها: 2H₂O = 36 غ/مول.',
    'في التناسب، ضع الغرام فوق الغرام والمجهول فوق المجهول.',
    'تحقق من جوابك: هل الكتلة الناتجة معقولة مقارنة بالمعطى؟',
    'الوحدات أصدقاؤك: اكتب «غ» بجانب كل رقم حتى لا تضيع.',
    'إذا كان الجواب أصغر من المعطى بكثير، راجع موقع المجهول في التناسب.',
    'المول الواحد من أي غاز يشغل 22.4 لتر في الشروط النظامية.',
    'عدد أفوجادرو ≈ 6.02×10²³ جسيم في المول الواحد.'
  ];

  window.DATA = {
    NAMES: NAMES,
    reactions: reactions,
    rawReactions: rawReactions,
    findReaction: findReaction,
    speciesByName: speciesByName,
    molarDb: molarDb,
    solutionSteps: solutionSteps,
    trueFalse: trueFalse,
    games: games,
    badges: badges,
    levels: levels,
    tips: tips
  };
})();
