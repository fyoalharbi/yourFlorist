// yourFlorist: pick flowers, write a note, send the bouquet as a link.
// The bouquet itself is drawn in 3D ASCII by bouquet3d.js. The whole bouquet +
// note lives in the URL hash, so there is no server and nothing is stored anywhere.
(function () {
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const { SPECIES, WRAPS } = window.B3D;
  const MAX = 12, AUTO = 15;            // AUTO: no centre flower chosen (fits the 4 bits it travels in)
  let plate3d = null, gift3d = null, current = null;

  // ════ Words, in English and Arabic ════
  const T = {
    en: {
      steps: 'Steps', nav1: 'Flowers', nav2: 'Note', nav3: 'Send', other: 'العربية',
      s1tag: 'step 01 · the counter', s1h: 'Pick your <em>flowers</em>', s1lead: 'Tap a flower to add a stem. Up to twelve fit in one bouquet. Drag the bouquet to turn it.',
      wrapping: 'wrapping', center: 'in the centre', auto: 'let the florist choose', shuffle: 'Rearrange', clear: 'Clear', next1: 'Write a note →',
      s2tag: 'step 02 · the card', s2h: 'Write a <em>note</em>', s2lead: 'It travels inside the link, so only people you send it to will see it.',
      to: 'To', message: 'Message', from: 'From', toPh: 'their name', msgPh: 'something only you would say…', fromPh: 'your name',
      back1: '← Flowers', next2: 'Tie the ribbon →',
      s3tag: 'step 03 · delivery', s3h: 'Your bouquet is <em>ready</em>', s3lead: 'Send this link. The flowers and your note are packed into it.',
      linkAria: 'Bouquet link', copy: 'Copy link', copied: 'copied. now send it to them.', preview: 'Preview what they\'ll see ↗', back2: '← Edit note', again: 'Start a new bouquet',
      drag: 'drag to turn', dragGift: 'drag the bouquet to turn it', read: 'Read the note ↑', readFrom: (f) => `Read ${f}'s note ↑`, hide: 'Hide the note ↓', save: 'Save as image', gif: 'Save as GIF',
      pull: 'Pull the card up ↑', rub: 'Rub the note to read it', petals: 'Tap the flowers to let the words fall', more: (i, n) => `Tap for more ↓  ${i} / ${n}`, all: 'show it all',
      concept: 'note concept', modes: ['Pull up', 'Rub', 'Petals', 'Line by line', 'Classic'], saving: 'Saving…', own: 'Send flowers of your own →',
      add: (n) => `Add a ${n}`, rm: (n) => `Remove a ${n}`,
      tally: (n) => (n ? `${n} stem${n > 1 ? 's' : ''}${n >= MAX ? ' · full' : ''}` : 'an empty wrap'),
      paper: (w) => `${w.toLowerCase()} paper`,
      deliveryFrom: (f) => `a delivery from ${f}`, delivery: 'a delivery',
      forName: (t) => `For <em>${esc(t)}</em>`, forYou: 'Flowers, <em>for you</em>', title: (f) => (f ? `Flowers from ${f}` : 'Someone sent you flowers'),
      count: (c, n) => `${c} × ${n.toLowerCase()}`, wrapped: (w) => `wrapped in ${w.toLowerCase()}`,
      bouquetAria: (list) => `A bouquet: ${list}. Drag to turn it.`, yourAria: (list) => (list ? `Your bouquet: ${list}. Drag to turn it.` : 'An empty wrap.'),
    },
    ar: {
      steps: 'الخطوات', nav1: 'الورد', nav2: 'البطاقة', nav3: 'الإرسال', other: 'English',
      s1tag: 'الخطوة ١ · اختيار الورد', s1h: 'اختر <em>ورودك</em>', s1lead: 'اضغط على الوردة لتضيف غصنًا. تتسع الباقة لاثني عشر غصنًا. اسحب الباقة لتدويرها.',
      wrapping: 'التغليف', center: 'في الوسط', auto: 'يختار بائع الورد', shuffle: 'رتّبها من جديد', clear: 'إفراغ', next1: 'اكتب بطاقة ←',
      s2tag: 'الخطوة ٢ · البطاقة', s2h: 'اكتب <em>بطاقة</em>', s2lead: 'تُحفظ داخل الرابط، فلا يراها إلا من ترسله إليه.',
      to: 'إلى', message: 'الرسالة', from: 'من', toPh: 'اسم من ستهديه', msgPh: 'كلامٌ لا يقوله غيرك…', fromPh: 'اسمك',
      back1: '→ الورد', next2: 'اربط الشريطة ←',
      s3tag: 'الخطوة ٣ · التوصيل', s3h: 'باقتك <em>جاهزة</em>', s3lead: 'أرسل هذا الرابط؛ ففيه الورد وبطاقتك.',
      linkAria: 'رابط الباقة', copy: 'انسخ الرابط', copied: 'نُسخ الرابط. أرسله الآن.', preview: 'شاهد ما سيرونه ↗', back2: '→ عدّل البطاقة', again: 'باقة جديدة',
      drag: 'اسحب للتدوير', dragGift: 'اسحب الباقة لتدويرها', read: 'اقرأ البطاقة ↑', readFrom: (f) => `اقرأ بطاقة ${f} ↑`, hide: 'أخفِ البطاقة ↓', save: 'احفظها صورة', gif: 'احفظها GIF متحركة',
      pull: 'اسحب البطاقة للأعلى ↑', rub: 'امسح على البطاقة لتقرأها', petals: 'اضغط على الورد لتتساقط الكلمات', more: (i, n) => `اضغط للمزيد ↓  ${i} / ${n}`, all: 'أظهرها كلها',
      concept: 'طريقة فتح البطاقة', modes: ['السحب', 'المسح', 'البتلات', 'سطرًا سطرًا', 'الأصلية'], saving: 'جارٍ الحفظ…', own: 'أرسل ورودك أنت ←',
      add: (n) => `أضف ${n}`, rm: (n) => `احذف ${n}`,
      tally: (n) => (n ? `الأغصان: ${n}${n >= MAX ? ' · ممتلئة' : ''}` : 'غلاف فارغ'),
      paper: (w) => `ورق ${w}`,
      deliveryFrom: (f) => `هدية من ${f}`, delivery: 'هدية',
      forName: (t) => `إلى <em>${esc(t)}</em>`, forYou: 'ورودٌ <em>لك</em>', title: (f) => (f ? `ورود من ${f}` : 'أرسل لك أحدهم وردًا'),
      count: (c, n) => `${n} × ${c}`, wrapped: (w) => `مغلّفة بورق ${w}`,
      bouquetAria: (list) => `باقة ورد: ${list}. اسحبها لتدويرها.`, yourAria: (list) => (list ? `باقتك: ${list}. اسحبها لتدويرها.` : 'غلاف فارغ.'),
    },
  };
  const PREF = 'yourflorist:lang';
  // a saved choice wins; otherwise follow the browser
  let lang = (navigator.language || '').startsWith('ar') ? 'ar' : 'en';
  try { lang = localStorage.getItem(PREF) || lang; } catch {}
  const t = (k, ...a) => { const v = T[lang][k]; return typeof v === 'function' ? v(...a) : v; };
  const spName = (sp) => (lang === 'ar' ? sp.ar : sp.name), spSub = (sp) => (lang === 'ar' ? sp.subAr : sp.sub), wrapName = (w) => (lang === 'ar' ? w.ar : w.name);

  function applyLang(l, persist = true) {
    lang = l === 'ar' ? 'ar' : 'en';
    if (persist) try { localStorage.setItem(PREF, lang); } catch {}
    const html = document.documentElement;
    html.lang = lang; html.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-i18n]').forEach((el) => { const v = t(el.dataset.i18n); if (v) el.textContent = v; });
    document.querySelectorAll('[data-i18n-html]').forEach((el) => (el.innerHTML = t(el.dataset.i18nHtml)));
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => (el.placeholder = t(el.dataset.i18nPh)));
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
    const b = $('#lang');
    b.textContent = t('other'); b.lang = lang === 'ar' ? 'en' : 'ar';
    buildCounter(); renderPlate(false);
    if (current) showGift(current, true);
  }

  // ── The note as one span per character, each either 0/1 noise or itself, so it can be revealed in any order ──
  function letters(el, text) {
    el.textContent = '';
    const cells = [...text].map((ch) => {
      const s = document.createElement('span'), on = /\s/.test(ch);
      s.textContent = on ? ch : '0'; el.appendChild(s);
      return { s, ch, on };
    });
    const at = cells.map((_, i) => (i / cells.length) * 0.82 + Math.random() * 0.18);   // when each letter resolves in a sweep
    const total = cells.filter((c) => !c.on).length;
    let raf = 0, last = 0;
    const L = {
      cells, k: 0, over: false,
      show(i) { const c = cells[i]; if (c && !c.on) { c.on = true; c.s.textContent = c.ch; c.s.classList.add('is-on'); } },
      upto(k) { L.k = Math.max(L.k, k); for (let i = 0; i < cells.length; i++) if (at[i] <= L.k) L.show(i); },
      share: () => 1 - cells.filter((c) => !c.on).length / (total || 1),   // how much is readable
      end() { L.over = true; cancelAnimationFrame(raf); el.textContent = text; },   // plain text again, so Arabic joins up
    };
    const tick = (now) => {
      if (L.over) return;
      raf = requestAnimationFrame(tick);
      if (now - last < 50) return;
      last = now;
      for (const c of cells) if (!c.on && Math.random() < 0.35) c.s.textContent = Math.random() < 0.5 ? '0' : '1';
    };
    if (!REDUCED) raf = requestAnimationFrame(tick);
    return L;
  }
  // resolve whatever is left, from where it got to
  function sweep(L, dur, then) {
    const k0 = L.k, t0 = performance.now();
    const f = (now) => { const q = REDUCED ? 1 : Math.min(1, (now - t0) / dur); L.upto(k0 + (1.01 - k0) * q); if (q < 1) requestAnimationFrame(f); else then(); };
    requestAnimationFrame(f);
  }

  // ════ The link ════
  // v2 (#g=): a few bytes of header, the flowers packed two per byte, then the words, deflated when that's shorter.
  //   [2] [wrap:3 | ar:1 | deflated:1] [count:4 | centre:4] [ids, 4 bits each…] [seed: 3 bytes] [to \0 from \0 message]
  // v1 (#b=) was base64 JSON; those links still open.
  const b64 = (bytes) => { let bin = ''; bytes.forEach((x) => (bin += String.fromCharCode(x))); return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  async function pipe(bytes, Stream) {
    const out = new Response(new Blob([bytes]).stream().pipeThrough(new Stream('deflate-raw')));
    return new Uint8Array(await out.arrayBuffer());
  }
  async function pack(b) {
    let text = new TextEncoder().encode([b.to || '', b.from || '', b.msg || ''].join('\0'));
    let deflated = 0;
    if (window.CompressionStream && text.length > 40) {
      try { const z = await pipe(text, CompressionStream); if (z.length < text.length) { text = z; deflated = 1; } } catch {}
    }
    const n = b.ids.length, ids = new Uint8Array(Math.ceil(n / 2));
    b.ids.forEach((id, i) => (ids[i >> 1] |= id << ((i & 1) * 4)));
    const head = [2, (b.wrap & 7) | ((b.lang === 'ar' ? 1 : 0) << 3) | (deflated << 4), (n & 15) | ((b.center >= 0 ? b.center : AUTO) << 4)];
    const seed = [b.seed & 255, (b.seed >> 8) & 255, (b.seed >> 16) & 255];
    return b64(Uint8Array.from([...head, ...ids, ...seed, ...text]));
  }
  async function unpackV2(code) {
    try {
      const a = unb64(code);
      if (a[0] !== 2) return null;
      const n = a[2] & 15, c = a[2] >> 4, nb = Math.ceil(n / 2);
      const ids = [];
      for (let i = 0; i < n; i++) ids.push((a[3 + (i >> 1)] >> ((i & 1) * 4)) & 15);
      const s0 = 3 + nb, seed = a[s0] | (a[s0 + 1] << 8) | (a[s0 + 2] << 16);
      let text = a.slice(s0 + 3);
      if (a[1] & 16) text = await pipe(text, DecompressionStream);
      const [to = '', from = '', msg = ''] = new TextDecoder().decode(text).split('\0');
      return clean({ ids, wrap: a[1] & 7, lang: a[1] & 8 ? 'ar' : 'en', center: c === AUTO ? -1 : c, seed, to, from, msg });
    } catch { return null; }
  }
  const ALPHA = '0123456789abcdefghijklmnopqrstuvwxyz';
  function unpackV1(code) {
    try {
      const o = JSON.parse(new TextDecoder().decode(unb64(code)));
      return clean({ ids: [...String(o.f || '')].map((c) => ALPHA.indexOf(c)), wrap: o.w | 0, seed: o.s | 0, to: o.t, msg: o.m, from: o.r, center: -1, lang: null });
    } catch { return null; }
  }
  const clean = (b) => ({
    ...b, ids: b.ids.filter((i) => i >= 0 && i < SPECIES.length).slice(0, MAX), wrap: clamp(b.wrap | 0, 0, WRAPS.length - 1),
    to: String(b.to || '').slice(0, 40), from: String(b.from || '').slice(0, 40), msg: String(b.msg || '').slice(0, 600),
    center: SPECIES[b.center] ? b.center : -1,
  });
  const linkFor = async (b) => location.origin + location.pathname + '#g=' + (await pack({ ...b, lang }));

  const listOf = (ids, wrap) => {
    const counts = new Map();
    ids.forEach((i) => counts.set(i, (counts.get(i) || 0) + 1));
    return [...counts].map(([i, c]) => t('count', c, spName(SPECIES[i]))).join(' · ') + (ids.length ? ` · ${t('wrapped', wrapName(WRAPS[wrap]))}` : '');
  };

  // ════ The recipient's view ════
  function showGift(b, relabel) {
    current = b;
    document.body.classList.add('is-gift');
    $('#shop').hidden = true; $('#gift').hidden = false;
    document.title = t('title', b.from);
    $('#g-k').textContent = b.from ? t('deliveryFrom', b.from) : t('delivery');
    $('#g-to').innerHTML = b.to ? t('forName', b.to) : t('forYou');
    $('#g-from').textContent = b.from ? '— ' + b.from : '';
    $('#g-list').textContent = listOf(b.ids, b.wrap);
    $('#g-art').setAttribute('aria-label', t('bouquetAria', listOf(b.ids, b.wrap)));
    $('#g-read-l').textContent = mode === 'pull' ? t('pull') : b.from ? t('readFrom', b.from) : t('read');
    $('#g-mode').innerHTML = MODES.map((m, i) => `<option value="${m}"${m === mode ? ' selected' : ''}>${i + 1} · ${t('modes')[i]}</option>`).join('');
    hint();
    if (relabel) return;                      // a language switch: the words change, the bouquet and note stay put
    $('#g-msg-sr').textContent = b.msg;
    $('#g-card').hidden = !b.msg && !b.from;
    resetNote(b);
    // reveal: the bouquet grows in once the page's own intro has played
    gift3d = gift3d || new B3D.Renderer($('#g-art'), { yaw: 0.4, delay: 700, reveal: true });
    gift3d.setScene(B3D.build(b.ids, b.wrap, b.seed, b.center), true);
  }

  // ════ The note: five ways to open it. A concept picker on the gift page switches between them (?note=…) ════
  //   pull     drag the sealed card up; the veil follows your finger and the words resolve as it rises
  //   rub      the note stays as flickering bits until you rub over it
  //   petals   tap the flowers and petals fall into place as the letters
  //   lines    a sentence at a time, a tap for each
  //   classic  the veil slides up and the whole note decodes by itself
  // Every way ends the same: "— name" writes itself, a soft chime, a buzz on phones.
  // With reduced motion the note is simply there; screen readers always get the words straight away.
  const MODES = ['pull', 'rub', 'petals', 'lines', 'classic'];
  let mode = new URLSearchParams(location.search).get('note');
  if (!MODES.includes(mode)) mode = 'pull';
  let note = null;

  function resetNote(b) {
    if (note && note.L) note.L.end();
    const msg = $('#g-msg');
    $('#gift').dataset.note = mode;
    $('#g-card').classList.remove('is-read');
    note = { L: b.msg ? letters(msg, b.msg) : null, done: false, started: false, part: 0, parts: 1 };
    if (!b.msg) msg.textContent = '';
    if (mode === 'lines' && note.L) {
      // a new part starts at the first letter after . ! ? or a line break
      let n = 0, brk = false;
      for (const c of note.L.cells) { if (brk && !/\s/.test(c.ch)) { n++; brk = false; } c.part = n; if (/[.!?؟…\n]/.test(c.ch)) brk = true; c.s.classList.toggle('is-later', n > 0); }
      note.parts = n + 1;
    }
    hint();
    setNote(false);
  }

  function setNote(open) {
    const gift = $('#gift'), veil = $('#g-veil');
    gift.classList.toggle('is-open', open);
    veil.inert = !open;
    $('#g-read').setAttribute('aria-expanded', open);
    lean(open);
    if (!open) return;
    wake();
    if (note && !note.started) { note.started = true; setTimeout(begin, REDUCED ? 0 : 450); }
    setTimeout(() => $('#g-card').focus({ preventScroll: true }), REDUCED ? 0 : 500);
  }
  function begin() {
    const L = note.L;
    if (!L || REDUCED) { if (L) L.upto(1.01); return finish(); }
    if (mode === 'pull' || mode === 'classic') sweep(L, Math.min(2400, 500 + L.cells.length * 12) * (1 - L.k), finish);
    else if (mode === 'lines') nextLine();
    hint();   // rub and petals wait for the reader
  }
  function finish() {
    if (!note || note.done) return;
    note.done = true;
    if (note.L) note.L.end();
    $('#g-card').classList.add('is-read');
    hint(); chime();
  }
  function revealAll() {
    if (!note || note.done) return;
    if (note.L) note.L.cells.forEach((c, i) => { c.s.classList.remove('is-later'); note.L.show(i); });
    finish();
  }
  function hint() {
    let s = '';
    if (current && current.msg && note && note.started && !note.done) s = mode === 'rub' ? t('rub') : mode === 'petals' ? t('petals') : mode === 'lines' ? t('more', note.part, note.parts) : '';
    $('#g-hint-t').textContent = s;
    $('#g-hint').hidden = !s;
  }

  // pull: the card follows the finger up, and lets go past a third of the way
  function bindPull() {
    const btn = $('#g-read'), veil = $('#g-veil');
    let d = null;
    btn.addEventListener('pointerdown', (e) => {
      if (mode !== 'pull' || $('#gift').classList.contains('is-open')) return;
      d = { y: e.clientY, k: 0, moved: false }; btn.setPointerCapture(e.pointerId);
    });
    btn.addEventListener('pointermove', (e) => {
      if (!d) return;
      const dy = d.y - e.clientY;
      if (!d.moved && Math.abs(dy) < 6) return;
      d.moved = true;
      const k = (d.k = clamp(dy / (innerHeight * 0.4), 0, 1));
      veil.style.transition = 'none'; veil.style.visibility = 'visible'; veil.style.transform = `translateY(${(1 - k) * 105}%)`;
      btn.style.transform = `translateY(${-Math.max(0, dy) * 0.6}px)`;
      if (note && note.L) note.L.upto(k * 0.8);
    });
    const up = () => {
      if (!d) return;
      const { k, moved } = d;
      d = null;
      if (!moved) return;   // a plain tap opens it like a button
      btn.dataset.pulled = '1';
      veil.style.transition = ''; btn.style.transform = '';
      void veil.offsetWidth;
      veil.style.transform = ''; veil.style.visibility = '';
      if (k > 0.33) setNote(true);
    };
    btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up);
  }

  // rub: letters under the finger (or the mouse) resolve; most of the way there, the rest follow
  function rub(e) {
    if (mode !== 'rub' || !note || !note.L || note.done || !note.started) return;
    const L = note.L;
    L.cells.forEach((c, i) => {
      if (c.on) return;
      const r = c.s.getBoundingClientRect();
      if (Math.hypot(r.x + r.width / 2 - e.clientX, r.y + r.height / 2 - e.clientY) < 36) L.show(i);
    });
    if (L.share() > 0.88) { L.upto(1.01); finish(); }
  }

  // petals: each tap lets the next few words fall from where you tapped
  const PETAL = ['0', '1', '@', '*', '·', '1', '0'];
  function fall(x, y) {
    if (mode !== 'petals' || !note || !note.L || note.done || !note.started) return;
    const L = note.L, todo = [];
    L.cells.forEach((c, i) => { if (!c.on && !c.falling) todo.push(i); });
    const want = Math.max(10, Math.ceil(todo.length / 5));
    let n = Math.min(want, todo.length);
    while (n < todo.length && todo[n] === todo[n - 1] + 1) n++;   // finish the word
    todo.slice(0, n).forEach((i, j) => {
      const c = L.cells[i], r = c.s.getBoundingClientRect(), f = document.createElement('span');
      c.falling = true;
      f.className = 'petal'; f.textContent = PETAL[(Math.random() * PETAL.length) | 0]; f.setAttribute('aria-hidden', 'true');
      document.body.appendChild(f);
      const sx = x + (Math.random() - 0.5) * 70, sy = y + (Math.random() - 0.5) * 40, drift = (Math.random() - 0.5) * 180;
      const a = f.animate([
        { transform: `translate(${sx}px, ${sy}px) rotate(0deg)`, opacity: 0 },
        { opacity: 1, offset: 0.08 },
        { transform: `translate(${(sx + r.x) / 2 + drift}px, ${(sy + r.y) / 2}px) rotate(${(Math.random() - 0.5) * 540}deg)`, offset: 0.55 },
        { transform: `translate(${r.x}px, ${r.y}px) rotate(0deg)`, opacity: 1 },
      ], { duration: 1000 + Math.random() * 800, delay: j * 22, easing: 'cubic-bezier(.35, .05, .35, 1)', fill: 'both' });
      a.onfinish = () => { f.remove(); c.falling = false; L.show(i); if (L.share() >= 1) finish(); };
    });
  }

  // lines: the next sentence decodes; the last one ends it
  function nextLine() {
    if (mode !== 'lines' || !note || !note.L || note.done || note.part >= note.parts) return;
    const L = note.L, n = note.part++, mine = [];
    L.cells.forEach((c, i) => { if (c.part === n) { mine.push(i); c.s.classList.remove('is-later'); } });
    hint();
    const t0 = performance.now(), dur = Math.min(1400, 300 + mine.length * 14);
    const f = (now) => {
      const q = Math.min(1, (now - t0) / dur);
      mine.forEach((i, j) => { if (j / mine.length <= q) L.show(i); });
      if (q < 1) requestAnimationFrame(f); else if (note.part >= note.parts) finish();
    };
    requestAnimationFrame(f);
  }

  // a tap is a press that didn't move (so dragging the bouquet still turns it)
  function onTap(el, fn) {
    let d = null;
    el.addEventListener('pointerdown', (e) => (d = [e.clientX, e.clientY]));
    el.addEventListener('pointerup', (e) => { if (d && Math.hypot(e.clientX - d[0], e.clientY - d[1]) < 8) fn(e); d = null; });
  }

  // the bouquet leans in toward the note while it's open
  let leanBase = null, leanRaf = 0;
  function lean(open) {
    const r = gift3d;
    if (!r || REDUCED) return;
    if (leanBase === null) leanBase = r.pitch;
    cancelAnimationFrame(leanRaf);
    const p0 = r.pitch, p1 = open ? Math.min(1.15, leanBase + 0.32) : leanBase, t0 = performance.now();
    const f = (now) => { const q = Math.min(1, (now - t0) / 900), e = 1 - Math.pow(1 - q, 3); r.pitch = p0 + (p1 - p0) * e; if (q < 1) leanRaf = requestAnimationFrame(f); };
    leanRaf = requestAnimationFrame(f);
    if (!open) leanBase = null;
  }

  // a soft three-note chime and a little buzz when the note is all there
  let audio = null;
  const wake = () => { try { audio = audio || new AudioContext(); audio.resume(); } catch {} };
  function chime() {
    if (REDUCED) return;
    try { navigator.vibrate && navigator.vibrate([16, 70, 16]); } catch {}
    if (!audio) return;
    const now = audio.currentTime;
    [[1046.5, 0], [1568, 0.09], [2093, 0.2]].forEach(([hz, d]) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = 'sine'; o.frequency.value = hz;
      g.gain.setValueAtTime(0, now + d); g.gain.linearRampToValueAtTime(0.04, now + d + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, now + d + 1.4);
      o.connect(g).connect(audio.destination); o.start(now + d); o.stop(now + d + 1.5);
    });
  }

  // ── Saving: the bouquet with the name and the note, in a portrait card, as a still or a turning GIF ──
  // The card without the bouquet; returns it and the box the bouquet goes in
  async function card(b) {
    const ar = lang === 'ar', serif = ar ? '"Amiri", "IBM Plex Serif", serif' : '"IBM Plex Serif", serif', mono = '"JetBrains Mono", monospace';
    await Promise.all([`italic 64px ${serif}`, `34px ${serif}`, `22px ${mono}`].map((f) => document.fonts.load(f, b.msg + b.to + b.from).catch(() => {})));
    const W = 1080, H = 1350, c = document.createElement('canvas'), x = c.getContext('2d');
    c.width = W; c.height = H;
    x.fillStyle = '#0b0c0e'; x.fillRect(0, 0, W, H);
    const g = x.createRadialGradient(W * 0.85, -80, 0, W * 0.85, -80, 700); g.addColorStop(0, '#1a1f1a'); g.addColorStop(1, '#0b0c0e00');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.textAlign = 'center'; x.direction = ar ? 'rtl' : 'ltr';
    x.fillStyle = '#8a8a9a'; x.font = `500 22px ${mono}`;
    x.fillText((b.from ? t('deliveryFrom', b.from) : t('delivery')).toUpperCase(), W / 2, 110);
    x.font = `italic 64px ${serif}`; x.fillStyle = '#ff8a8a';
    x.fillText(b.to ? (ar ? `إلى ${b.to}` : `For ${b.to}`) : (ar ? 'ورودٌ لك' : 'Flowers, for you'), W / 2, 200);
    const box = { x: 70, y: 250, w: W - 140, h: b.msg ? 630 : 880 };
    // the note and who it is from, wrapped to the card and centred under the bouquet
    let y = box.y + box.h + 50;
    const rtl = ar || /[֐-ࣿ]/.test(b.msg), tx = W / 2;
    x.textAlign = 'center'; x.direction = rtl ? 'rtl' : 'ltr';
    x.font = `34px ${serif}`; x.fillStyle = '#cfcfcf';
    for (const para of b.msg.split('\n')) {
      let line = '';
      for (const word of para.split(' ')) {
        const test = line ? line + ' ' + word : word;
        if (x.measureText(test).width > W - 260 && line) { x.fillText(line, tx, y); y += 54; line = word; } else line = test;
        if (y > H - 190) break;
      }
      if (y > H - 190) { x.fillText(line + '…', tx, y); break; }
      x.fillText(line, tx, y); y += 54;
    }
    if (b.from) { x.font = `italic 40px ${serif}`; x.fillStyle = '#e8e4d0'; x.fillText('— ' + b.from, tx, Math.min(y + 30, H - 120)); }
    x.textAlign = 'center'; x.direction = 'ltr'; x.font = `20px ${mono}`; x.fillStyle = '#5a5a66';
    x.fillText('yourFlorist', W / 2, H - 50);
    return { c, box };
  }
  // what's actually drawn on the bouquet's canvas, as a crop rectangle (padded by a share of its size)
  function drawn(src, pad = 0) {
    const px = src.getContext('2d').getImageData(0, 0, src.width, src.height).data;
    let x0 = src.width, x1 = 0, y0 = src.height, y1 = 0;
    for (let yy = 0; yy < src.height; yy += 2) for (let xx = 0; xx < src.width; xx += 2) if (px[(yy * src.width + xx) * 4 + 3]) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
    if (x1 <= x0) return { x: 0, y: 0, w: src.width, h: src.height };
    const dx = (x1 - x0) * pad, dy = (y1 - y0) * pad * 0.4;
    x0 = Math.max(0, x0 - dx); y0 = Math.max(0, y0 - dy); x1 = Math.min(src.width - 2, x1 + dx); y1 = Math.min(src.height - 2, y1 + dy);
    return { x: x0, y: y0, w: x1 - x0 + 2, h: y1 - y0 + 2 };
  }
  // the crop, scaled to fill the box
  function place(x, src, r, box) {
    const k = Math.min(box.w / r.w, box.h / r.h);
    x.drawImage(src, r.x, r.y, r.w, r.h, box.x + (box.w - r.w * k) / 2, box.y + (box.h - r.h * k) / 2, r.w * k, r.h * k);
  }
  async function deliver(blob, ext) {
    const b = current, name = `bouquet${b.to ? '-for-' + b.to.replace(/[^\p{L}\p{N}]+/gu, '-') : ''}.${ext}`;
    const file = new File([blob], name, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && matchMedia('(pointer: coarse)').matches) await navigator.share({ files: [file] }).catch(() => {});
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
  }

  async function saveImage() {
    const b = current, src = $('#g-art'), btn = $('#save');
    if (!b) return;
    btn.disabled = true; btn.textContent = t('saving');
    try {
      const { c, box } = await card(b);
      place(c.getContext('2d'), src, drawn(src), box);
      await deliver(await new Promise((r) => c.toBlob(r, 'image/png')), 'png');
    } finally { btn.disabled = false; btn.textContent = t('save'); }
  }

  // The GIF: one full turn of the bouquet, bits flickering, on the same card at two-thirds the size
  async function saveGif() {
    const b = current, src = $('#g-art'), btn = $('#gif'), r3d = gift3d;
    if (!b || !r3d) return;
    btn.disabled = true; btn.textContent = t('saving');
    const tick = () => new Promise((r) => requestAnimationFrame(r));
    try {
      const { c: base, box } = await card(b);
      const S = 2 / 3, W = 720, H = 900, out = document.createElement('canvas'), x = out.getContext('2d', { willReadFrequently: true });
      out.width = W; out.height = H;
      const bx = { x: Math.floor(box.x * S), y: Math.floor(box.y * S), w: Math.ceil(box.w * S), h: Math.ceil(box.h * S) };
      const N = 40, yaw0 = r3d.yaw, frames = [];
      r3d.hold(true);
      try {
        r3d.shot(yaw0, 0);
        const crop = drawn(src, 0.12);
        for (let i = 0; i < N; i++) {
          r3d.shot(yaw0 + (i / N) * Math.PI * 2, 0.08);
          x.drawImage(base, 0, 0, W, H);
          place(x, src, crop, bx);
          // after the first frame only the bouquet's box changes
          frames.push(i ? { ...bx, data: x.getImageData(bx.x, bx.y, bx.w, bx.h).data } : { x: 0, y: 0, w: W, h: H, data: x.getImageData(0, 0, W, H).data });
          if (i % 4 === 3) { btn.textContent = `${t('saving')} ${Math.round((i / N) * 80)}%`; await tick(); }
        }
      } finally { r3d.hold(false); }
      btn.textContent = `${t('saving')} 80%`; await tick();
      await deliver(GIF.encode(W, H, frames, 8), 'gif');
    } finally { btn.disabled = false; btn.textContent = t('gif'); }
  }

  // ════ The florist ════
  const DRAFT = 'yourflorist:draft';
  let state = { ids: [], wrap: 0, seed: (Math.random() * 1e6) | 0, to: '', msg: '', from: '', center: -1 };
  try { const d = JSON.parse(localStorage.getItem(DRAFT) || 'null'); if (d && Array.isArray(d.ids)) state = { ...state, ...d, ids: d.ids.filter((i) => SPECIES[i]).slice(0, MAX) }; } catch {}
  const save = () => { try { localStorage.setItem(DRAFT, JSON.stringify(state)); } catch {} };
  let step = 1;

  function renderPlate(pop) {
    if (!$('#species').children.length) return;
    if (!state.ids.some((i) => i === state.center && !SPECIES[i].filler)) state.center = -1;
    plate3d = plate3d || new B3D.Renderer($('#art'), { delay: 900 });
    plate3d.setScene(B3D.build(state.ids, state.wrap, state.seed, state.center), pop);
    const n = state.ids.length;
    $('#tally').textContent = t('tally', n);
    $('#wrapname').textContent = t('paper', wrapName(WRAPS[state.wrap]));
    $('#art').setAttribute('aria-label', t('yourAria', n ? listOf(state.ids, state.wrap) : ''));
    $('#plate').classList.toggle('is-pop', n > 0);
    $('#to2').disabled = !n;
    document.querySelectorAll('[data-step="2"], [data-step="3"]').forEach((b) => (b.disabled = !n));
    SPECIES.forEach((_, i) => {
      const c = state.ids.filter((x) => x === i).length, row = document.querySelector(`[data-sp="${i}"]`);
      row.querySelector('.n').textContent = c ? '×' + c : '+';
      row.querySelector('.n').classList.toggle('has', !!c);
      row.querySelector('.minus').classList.toggle('has', !!c);
    });
    // the centre flower can be any main flower in the bouquet
    const kinds = [...new Set(state.ids)].filter((i) => !SPECIES[i].filler);
    $('#center-row').hidden = kinds.length < 2;
    $('#center').innerHTML = `<option value="-1">${esc(t('auto'))}</option>` + kinds.map((i) => `<option value="${i}"${i === state.center ? ' selected' : ''}>${esc(spName(SPECIES[i]))}</option>`).join('');
    peek();
  }
  // the note as they'll read it, laid over the bouquet while writing
  function peek() {
    const on = step > 1 && (state.to || state.msg || state.from);
    $('#peek').hidden = !on;
    if (!on) return;
    $('#peek-to').innerHTML = state.to ? t('forName', state.to) : t('forYou');
    $('#peek-msg').textContent = state.msg;
    $('#peek-from').textContent = state.from ? '— ' + state.from : '';
  }

  let thumbs = [];
  function buildCounter() {
    $('#species').innerHTML = SPECIES.map((sp, i) => `<li class="sp-row" data-sp="${i}">
        <button class="sp" type="button" data-add="${i}" aria-label="${esc(t('add', spName(sp)))}">
          <canvas class="thumb" aria-hidden="true"></canvas>
          <span><b>${esc(spName(sp))}</b><small>${esc(spSub(sp))}</small></span>
          <span class="n">+</span>
        </button>
        <button class="minus" type="button" data-rm="${i}" aria-label="${esc(t('rm', spName(sp)))}">−</button>
      </li>`).join('');
    thumbs = [...document.querySelectorAll('.thumb')].map((c, i) => { const r = new B3D.Renderer(c, { thumb: true, yaw: 0, pitch: 0.3 }); r.setScene(B3D.single(i)); return r; });
    $('#wraps').innerHTML = WRAPS.map((w, i) => `<button class="chip" type="button" data-wrap="${i}" aria-pressed="${i === state.wrap}"><i style="background:${w.dot}"></i>${esc(wrapName(w))}</button>`).join('');
  }

  async function go(s) {
    step = s > 1 && !state.ids.length ? 1 : s;
    document.querySelectorAll('[data-pane]').forEach((p) => (p.hidden = +p.dataset.pane !== step));
    document.querySelectorAll('#steps button').forEach((b) => b.classList.toggle('is-on', +b.dataset.step === step));
    peek();
    if (step === 3) { $('#copied').textContent = ''; const url = await linkFor(state); $('#link').value = url; $('#open').href = url; }
    if (step === 2) setTimeout(() => $(state.to ? '#msg' : '#to').focus({ preventScroll: true }), 50);
    if (innerWidth <= 900) scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' });
  }

  function startShop() {
    $('#to').value = state.to; $('#msg').value = state.msg; $('#from').value = state.from;
    $('#count').textContent = `${state.msg.length} / 600`;

    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-add], [data-rm], [data-wrap], [data-goto], [data-step]');
      if (!el || el.disabled) return;
      if (el.dataset.add != null) { if (state.ids.length < MAX) state.ids.push(+el.dataset.add); else flash('#tally'); renderPlate(true); }
      else if (el.dataset.rm != null) { const k = state.ids.lastIndexOf(+el.dataset.rm); if (k >= 0) state.ids.splice(k, 1); renderPlate(true); }
      else if (el.dataset.wrap != null) {
        state.wrap = +el.dataset.wrap;
        document.querySelectorAll('[data-wrap]').forEach((c) => c.setAttribute('aria-pressed', c === el));
        renderPlate(true);
      }
      else go(+(el.dataset.goto || el.dataset.step));
      save();
    });
    $('#center').addEventListener('change', (e) => { state.center = +e.target.value; renderPlate(true); save(); });
    $('#shuffle').onclick = () => { state.seed = (Math.random() * 1e6) | 0; renderPlate(true); save(); };
    $('#clear').onclick = () => { state.ids = []; renderPlate(true); save(); };
    $('#card').addEventListener('input', () => {
      state.to = $('#to').value; state.msg = $('#msg').value; state.from = $('#from').value;
      $('#count').textContent = `${state.msg.length} / 600`;
      peek(); save();
    });
    $('#card').addEventListener('submit', (e) => { e.preventDefault(); go(3); });
    $('#copy').onclick = async () => {
      const inp = $('#link');
      try { await navigator.clipboard.writeText(inp.value); }
      catch { inp.select(); document.execCommand && document.execCommand('copy'); }
      $('#copied').textContent = t('copied');
    };
    $('#link').addEventListener('focus', (e) => e.target.select());
    $('#again').onclick = () => {
      state = { ids: [], wrap: state.wrap, seed: (Math.random() * 1e6) | 0, to: '', msg: '', from: state.from, center: -1 };
      $('#to').value = ''; $('#msg').value = ''; $('#count').textContent = '0 / 600';
      save(); renderPlate(true); go(1);
    };
    $('#save').onclick = saveImage;
    $('#gif').onclick = saveGif;
    $('#g-read').onclick = () => { const b = $('#g-read'); if (b.dataset.pulled) { delete b.dataset.pulled; return; } setNote(true); };
    bindPull();
    $('#g-msg').addEventListener('pointermove', rub); $('#g-msg').addEventListener('pointerdown', rub);
    onTap($('#g-art'), (e) => fall(e.clientX, e.clientY));
    onTap($('#g-veil'), (e) => { if (e.target.closest('button, a, select')) return; fall(e.clientX, e.clientY); nextLine(); });
    $('#g-all').onclick = revealAll;
    $('#g-mode').onchange = (e) => {
      mode = e.target.value;
      history.replaceState(null, '', `?note=${mode}${location.hash.replace(/[?&]note=\w+/, '')}`);
      resetNote(current); showGift(current, true);
    };
    $('#g-hide').onclick = () => { setNote(false); $('#g-read').focus({ preventScroll: true }); };
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#gift').classList.contains('is-open')) $('#g-hide').click(); });
    $('#lang').onclick = () => applyLang(lang === 'ar' ? 'en' : 'ar');
  }
  function flash(sel) { const el = $(sel); el.style.color = 'var(--red)'; setTimeout(() => (el.style.color = ''), 700); }

  // ── route ──
  async function route() {
    const m = location.hash.match(/^#([bg])=([A-Za-z0-9_-]+)/);
    const nm = location.hash.match(/[?&]note=(\w+)/);   // ?note= also works when it's put after the bouquet
    if (nm && MODES.includes(nm[1])) mode = nm[1];
    const b = m && (m[1] === 'g' ? await unpackV2(m[2]) : unpackV1(m[2]));
    if (b) {
      if (b.lang) applyLang(b.lang, false);   // the recipient sees the page in the sender's language (the toggle still works)
      showGift(b);
    } else { current = null; document.body.classList.remove('is-gift'); $('#gift').hidden = true; $('#shop').hidden = false; document.title = 'yourFlorist'; }
  }
  document.querySelectorAll('[data-home]').forEach((a) => a.addEventListener('click', (e) => {
    if (!location.hash) return;
    e.preventDefault(); history.pushState(null, '', location.pathname); route(); scrollTo(0, 0);
  }));
  addEventListener('hashchange', route);
  addEventListener('popstate', route);
  startShop();
  applyLang(lang, false);
  route();
})();
