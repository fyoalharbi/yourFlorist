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
      s1tag: 'step 01 · the counter', s1h: 'Pick your <em>flowers</em>', s1lead: 'Tap a flower to add a stem. Up to twelve fit in one bouquet. Drag a flower in the bouquet to move it, or drag around it to turn it.',
      wrapping: 'wrapping', center: 'in the centre', auto: 'let the florist choose', surprise: 'Surprise me', shuffle: 'Rearrange', clear: 'Clear', next1: 'Write a note →',
      s2tag: 'step 02 · the card', s2h: 'Write a <em>note</em>', s2lead: 'It travels inside the link, so only people you send it to will see it.',
      to: 'To', message: 'Message', from: 'From', toPh: 'their name', msgPh: 'something only you would say…', fromPh: 'your name',
      back1: '← Flowers', next2: 'Tie the ribbon →',
      s3tag: 'step 03 · delivery', s3h: 'Your bouquet is <em>ready</em>', s3lead: 'Send this link. The flowers and your note are packed into it.',
      linkAria: 'Bouquet link', copy: 'Copy link', copied: 'copied. now send it to them.', preview: 'Preview what they\'ll see ↗', back2: '← Edit note', again: 'Start a new bouquet',
      drag: 'drag a flower to move it', dragGift: 'drag the bouquet to turn it', read: 'Read the note ↑', hide: 'Hide the note ↓', save: 'Save as image', gif: 'Save as GIF',
      cardHint: 'tap the little card in the flowers', readHere: 'or read it here ↑', saving: 'Saving…', own: 'Send flowers of your own →',
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
      s1tag: 'الخطوة ١ · اختيار الورد', s1h: 'اختر <em>ورودك</em>', s1lead: 'اضغط على الوردة لتضيف غصنًا. تتسع الباقة لاثني عشر غصنًا. اسحب وردة في الباقة لتنقلها، أو اسحب حولها لتدويرها.',
      wrapping: 'التغليف', center: 'في الوسط', auto: 'يختار بائع الورد', surprise: 'فاجئني', shuffle: 'رتّبها من جديد', clear: 'إفراغ', next1: 'اكتب بطاقة ←',
      s2tag: 'الخطوة ٢ · البطاقة', s2h: 'اكتب <em>بطاقة</em>', s2lead: 'تُحفظ داخل الرابط، فلا يراها إلا من ترسله إليه.',
      to: 'إلى', message: 'الرسالة', from: 'من', toPh: 'اسم من ستهديه', msgPh: 'كلامٌ لا يقوله غيرك…', fromPh: 'اسمك',
      back1: '→ الورد', next2: 'اربط الشريطة ←',
      s3tag: 'الخطوة ٣ · التوصيل', s3h: 'باقتك <em>جاهزة</em>', s3lead: 'أرسل هذا الرابط؛ ففيه الورد وبطاقتك.',
      linkAria: 'رابط الباقة', copy: 'انسخ الرابط', copied: 'نُسخ الرابط. أرسله الآن.', preview: 'شاهد ما سيرونه ↗', back2: '→ عدّل البطاقة', again: 'باقة جديدة',
      drag: 'اسحب وردة لتنقلها', dragGift: 'اسحب الباقة لتدويرها', read: 'اقرأ البطاقة ↑', hide: 'أخفِ البطاقة ↓', save: 'احفظها صورة', gif: 'احفظها GIF متحركة',
      cardHint: 'اضغط على البطاقة الصغيرة بين الورد', readHere: 'أو اقرأها هنا ↑', saving: 'جارٍ الحفظ…', own: 'أرسل ورودك أنت ←',
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
  //   [2] [wrap:3 | ar:1 | deflated:1 | heads placed:1 | all placed:1] [count:4 | centre:4] [ids, 4 bits each…] [seed: 3 bytes]
  //   [if placed: each flower's spot on the dome (or only the big ones', in the first links that carried this), 2 bytes: 6 bits down from the top, 10 bits round] [to \0 from \0 message]
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
    const placed = b.place && b.place.length ? 1 : 0, spots = placed ? b.place.flatMap(([tq, pq]) => [(tq << 2) | (pq >> 8), pq & 255]) : [];
    const head = [2, (b.wrap & 7) | ((b.lang === 'ar' ? 1 : 0) << 3) | (deflated << 4) | (placed << 6), (n & 15) | ((b.center >= 0 ? b.center : AUTO) << 4)];
    const seed = [b.seed & 255, (b.seed >> 8) & 255, (b.seed >> 16) & 255];
    return b64(Uint8Array.from([...head, ...ids, ...seed, ...spots, ...text]));
  }
  async function unpackV2(code) {
    try {
      const a = unb64(code);
      if (a[0] !== 2) return null;
      const n = a[2] & 15, c = a[2] >> 4, nb = Math.ceil(n / 2);
      const ids = [];
      for (let i = 0; i < n; i++) ids.push((a[3 + (i >> 1)] >> ((i & 1) * 4)) & 15);
      const s0 = 3 + nb, seed = a[s0] | (a[s0 + 1] << 8) | (a[s0 + 2] << 16);
      let at = s0 + 3, place = null;
      if (a[1] & 96) {
        const m = a[1] & 64 ? ids.length : ids.filter((i) => SPECIES[i] && !SPECIES[i].filler).length;
        place = [];
        for (let k = 0; k < m; k++, at += 2) place.push([a[at] >> 2, ((a[at] & 3) << 8) | a[at + 1]]);
      }
      let text = a.slice(at);
      if (a[1] & 16) text = await pipe(text, DecompressionStream);
      const [to = '', from = '', msg = ''] = new TextDecoder().decode(text).split('\0');
      return clean({ ids, wrap: a[1] & 7, lang: a[1] & 8 ? 'ar' : 'en', center: c === AUTO ? -1 : c, seed, to, from, msg, place });
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
    center: SPECIES[b.center] ? b.center : -1, place: Array.isArray(b.place) ? b.place : null,
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
    $('#g-art').setAttribute('aria-label', t('bouquetAria', listOf(b.ids, b.wrap)));
    $('#g-read').textContent = hasCard(b) ? t('readHere') : t('read');
    $('#g-bar-hint').textContent = hasCard(b) ? t('cardHint') : t('dragGift');
    if (relabel) return;                      // a language switch: the words change, the bouquet and note stay put
    $('#g-msg-sr').textContent = b.msg;
    $('#g-card').hidden = !b.msg && !b.from;
    resetNote(b);
    // reveal: the bouquet grows in once the page's own intro has played
    gift3d = gift3d || new B3D.Renderer($('#g-art'), { yaw: 0.4, delay: 700, reveal: true });
    gift3d.setScene(B3D.build(b.ids, b.wrap, b.seed, b.center, { card: hasCard(b), place: b.place }), true);
    cardShown(true);
  }

  // ════ The note: a little card tucked into the bouquet. Tap it and it's taken out, the veil slides up and
  //   the note decodes; "— name" writes itself, a soft chime, a buzz on phones. The button below is a quiet
  //   fallback. With reduced motion the note is simply there; screen readers always get the words straight away.
  let note = null;
  const hasCard = (b) => !!(b.msg || b.from);
  // the card sits in the bouquet until the note is open, breathing gently so it gets noticed
  function cardShown(on) { if (gift3d) { gift3d.show(B3D.CARD, on); gift3d.glow = on; } }

  function resetNote(b) {
    if (note && note.L) note.L.end();
    const msg = $('#g-msg');
    $('#g-card').classList.remove('is-read');
    note = { L: b.msg ? letters(msg, b.msg) : null, done: false, started: false };
    if (!b.msg) msg.textContent = '';
    setNote(false);
  }

  function setNote(open) {
    const gift = $('#gift'), veil = $('#g-veil');
    gift.classList.toggle('is-open', open);
    veil.inert = !open;
    $('#g-read').setAttribute('aria-expanded', open);
    lean(open);
    cardShown(!open);
    if (!open) return;
    wake();
    if (note && !note.started) { note.started = true; setTimeout(begin, REDUCED ? 0 : 450); }
    setTimeout(() => $('#g-card').focus({ preventScroll: true }), REDUCED ? 0 : 500);
  }
  function begin() {
    const L = note.L;
    if (!L || REDUCED) { if (L) L.upto(1.01); return finish(); }
    sweep(L, Math.min(2400, 500 + L.cells.length * 12), finish);
  }
  function finish() {
    if (!note || note.done) return;
    note.done = true;
    if (note.L) note.L.end();
    $('#g-card').classList.add('is-read');
    chime();
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
  let state = { ids: [], wrap: 0, seed: (Math.random() * 1e6) | 0, to: '', msg: '', from: '', center: -1, place: null };
  try { const d = JSON.parse(localStorage.getItem(DRAFT) || 'null'); if (d && Array.isArray(d.ids)) state = { ...state, ...d, ids: d.ids.filter((i) => SPECIES[i]).slice(0, MAX) }; } catch {}
  const save = () => { try { localStorage.setItem(DRAFT, JSON.stringify(state)); } catch {} };
  let step = 1;

  // ── Moving a flower: it follows the pointer over the dome and the others make room; dropped, the arrangement is kept ──
  let plate = null, moving = null;
  function onGrab(g) {
    if (!plate || g >= plate.heads) return false;
    moving = { g, place: state.place || plate.place, v: null, raf: 0, sc: plate };
    return true;
  }
  function onMove(g, x, y) {
    if (!moving) return;
    moving.v = plate3d.domeAt(x, y, plate.dome.r, plate.dome.cap);
    if (moving.v && !moving.raf) moving.raf = requestAnimationFrame(() => {
      if (!moving) return;
      moving.raf = 0;
      const lay = B3D.arrange(state.ids, state.seed, state.center, { place: moving.place, pin: { i: g, v: moving.v } });
      moving.lay = lay; plate3d.setScene(B3D.shift(moving.sc, moving.sc.vs, lay.vs), false, true);
    });
  }
  function onDrop(g) {
    if (!moving) return;
    cancelAnimationFrame(moving.raf);
    if (moving.v) {
      state.place = B3D.arrange(state.ids, state.seed, state.center, { place: moving.place, pin: { i: g, v: moving.v } }).place;
      plate = B3D.build(state.ids, state.wrap, state.seed, state.center, { place: state.place });   // exactly what the link will carry
      plate3d.setScene(plate, false, true); save();
    }
    moving = null;
  }

  // ── Surprise me: a florist's pick. One to four kinds of flower; each stem takes room by its size (a sunflower
  //    as much as eight violets), and the bouquet is filled to a random fullness, from a single stem up to a dozen
  //    roses' worth, so big flowers come in ones and twos and small ones by the handful. Sometimes a filler or two. ──
  const ROOM = 12 * 0.17 ** 2;
  function surprise() {
    const R = (n) => (Math.random() * n) | 0, all = SPECIES.map((_, i) => i);
    const heads = all.filter((i) => !SPECIES[i].filler), fill = all.filter((i) => SPECIES[i].filler);
    for (let i = heads.length - 1; i > 0; i--) { const j = R(i + 1); [heads[i], heads[j]] = [heads[j], heads[i]]; }   // a fair shuffle
    const kinds = heads.slice(0, 1 + R(4)), want = ROOM * Math.random(), ids = [];
    let used = 0;
    for (let k = 0; ids.length < MAX; k++) {
      const id = k < kinds.length ? kinds[k] : kinds[R(kinds.length)], a = SPECIES[id].size ** 2;   // each kind once, then any
      if (ids.length && used + a > want) break;   // always at least one stem
      ids.push(id); used += a;
    }
    if (Math.random() < 0.6) for (let k = 1 + R(2); k > 0 && ids.length < MAX; k--) ids.push(fill[R(fill.length)]);
    return ids;
  }

  function renderPlate(pop) {
    if (!$('#species').children.length) return;
    if (!state.ids.some((i) => i === state.center && !SPECIES[i].filler)) state.center = -1;
    plate3d = plate3d || new B3D.Renderer($('#art'), { delay: 900, onGrab, onMove, onDrop });
    plate = B3D.build(state.ids, state.wrap, state.seed, state.center, { place: state.place });
    if (state.place && state.place.length !== plate.heads) state.place = null;   // the flowers changed: the florist arranges them again
    plate3d.setScene(plate, pop);
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
    $('#center').addEventListener('change', (e) => { state.center = +e.target.value; state.place = null; renderPlate(true); save(); });
    $('#surprise').onclick = () => {
      const ids = surprise(), R = (n) => (Math.random() * n) | 0;
      state = { ...state, ids, wrap: R(WRAPS.length), seed: (Math.random() * 1e6) | 0, center: -1, place: null };
      document.querySelectorAll('[data-wrap]').forEach((c) => c.setAttribute('aria-pressed', +c.dataset.wrap === state.wrap));
      renderPlate(true); save();
    };
    $('#shuffle').onclick = () => { state.seed = (Math.random() * 1e6) | 0; state.place = null; renderPlate(true); save(); };
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
      state = { ids: [], wrap: state.wrap, seed: (Math.random() * 1e6) | 0, to: '', msg: '', from: state.from, center: -1, place: null };
      $('#to').value = ''; $('#msg').value = ''; $('#count').textContent = '0 / 600';
      save(); renderPlate(true); go(1);
    };
    $('#save').onclick = saveImage;
    $('#gif').onclick = saveGif;
    $('#g-read').onclick = () => setNote(true);
    onTap($('#g-art'), (e) => { if (current && hasCard(current) && !$('#gift').classList.contains('is-open') && gift3d.hitCard(e.clientX, e.clientY)) setNote(true); });
    $('#g-art').addEventListener('pointermove', (e) => { if (gift3d && !e.buttons) $('#g-art').style.cursor = gift3d.hitCard(e.clientX, e.clientY) ? 'pointer' : ''; });
    $('#g-hide').onclick = () => { setNote(false); $('#g-read').focus({ preventScroll: true }); };
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#gift').classList.contains('is-open')) $('#g-hide').click(); });
    $('#lang').onclick = () => applyLang(lang === 'ar' ? 'en' : 'ar');
  }
  function flash(sel) { const el = $(sel); el.style.color = 'var(--red)'; setTimeout(() => (el.style.color = ''), 700); }

  // ── route ──
  async function route() {
    const m = location.hash.match(/^#([bg])=([A-Za-z0-9_-]+)/);
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
