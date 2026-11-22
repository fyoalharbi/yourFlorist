// yourFlorist: pick flowers, write a note, send the bouquet as a link.
// Flowers are drawn with the Herbarium garden's pieces: flowerCells heads (live
// 0/1 petals, gold @8 eye, ' . rim), stems that lean with | / \ and carry \_ _/
// leaves, & % # foliage, pollen motes. The whole bouquet + note lives in the URL
// hash, so there is no server and nothing is stored anywhere.
(function () {
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const seeded = (s) => { let x = [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7) || 1; return () => ((x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ── KIT.flowerCells: an ASCII head as [dx, dy, ch, tone]; tones c centre, d seed, p petal, r rim ──
  function flowerCells({ R = 5, petals = 6, rot = 0, open = 1, seed = 1, squash = 0.5 } = {}) {
    const rnd = seeded(seed), out = [], Rv = Math.max(1, Math.round(R * squash));
    for (let dy = -Rv; dy <= Rv; dy++) for (let dx = -R; dx <= R; dx++) {
      const nx = dx / R, ny = dy / (R * squash), r = Math.hypot(nx, ny), a = Math.atan2(ny, nx);
      const edge = (0.55 + 0.45 * Math.abs(Math.cos((petals * a) / 2 + rot))) * (0.35 + 0.65 * open);
      if (r < 0.26 * (0.6 + 0.4 * open)) out.push([dx, dy, rnd() < 0.3 ? '8' : '@', 'c']);
      else if (r < 0.36 && open > 0.3) out.push([dx, dy, rnd() < 0.5 ? 'o' : '.', 'd']);
      else if (r < edge - 0.14) out.push([dx, dy, rnd() < 0.5 ? '0' : '1', 'p']);
      else if (r < edge) out.push([dx, dy, rnd() < 0.5 ? "'" : '.', 'r']);
    }
    return out;
  }

  // ── The counter. Order matters: a flower's index is how it travels in the URL. ──
  const SPECIES = [
    { name: 'Garden rose', sub: 'love, plainly said', tone: 'red', R: 7, petals: 5, open: 0.8, rot: 0.3 },
    { name: 'Peony', sub: 'a happy life', tone: 'blush', R: 8, petals: 12, open: 1, rot: 0 },
    { name: 'Daisy', sub: 'innocence, new starts', tone: 'white', R: 6, petals: 9, open: 1, rot: 0.2 },
    { name: 'Sunflower', sub: 'loyalty, warmth', tone: 'gold', R: 8, petals: 14, open: 1, rot: 0, eye: 'brown', seedTone: 'orange2' },
    { name: 'Poppy', sub: 'remembrance', tone: 'orange', R: 7, petals: 4, open: 0.95, rot: 0.8 },
    { name: 'Violet', sub: 'faithfulness', tone: 'violet', R: 5, petals: 5, open: 1, rot: 0.5 },
    { name: 'Camellia', sub: 'longing', tone: 'red', R: 6, petals: 8, open: 0.7, rot: 0.1, eye: 'gold2' },
    { name: 'Cosmos', sub: 'order and harmony', tone: 'blush', R: 6, petals: 8, open: 1, rot: 0.4, eye: 'gold' },
    { name: 'Anemone', sub: 'anticipation', tone: 'violet', R: 7, petals: 6, open: 1, rot: 0, eye: 'ink2', seedTone: 'ink2' },
    { name: "Baby's breath", sub: 'everlasting', tone: 'white', R: 3, petals: 5, open: 1, rot: 0, filler: true },
  ];
  const WRAPS = [
    { name: 'Kraft', paper: 'kraft', edge: 'kraft2', ribbon: 'red', dot: '#c49a64' },
    { name: 'Night', paper: 'ink', edge: 'ink2', ribbon: 'gold', dot: '#8a8a9a' },
    { name: 'Linen', paper: 'paper', edge: 'paper2', ribbon: 'red', dot: '#e8e4d0' },
    { name: 'Blush', paper: 'rose', edge: 'rose2', ribbon: 'white', dot: '#ffc0d0' },
    { name: 'Moss', paper: 'g1', edge: 'stem', ribbon: 'blush', dot: '#5f8f5f' },
  ];
  const MAX = 12;

  const toneOf = (sp, tn) => tn === 'c' ? (sp.eye || 'gold') : tn === 'd' ? (sp.seedTone || 'gold2') : tn === 'r' ? sp.tone + '2' : 'p ' + sp.tone;

  // ── A character grid we draw the bouquet into ──
  class Grid {
    constructor(w, h) { this.w = w; this.h = h; this.g = Array.from({ length: h }, () => Array(w).fill(null)); }
    put(x, y, ch, tone) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.g[y][x] = [ch, tone]; }
    get(x, y) { return this.g[Math.round(y)]?.[Math.round(x)]; }
    head(x, y, sp, seed) {
      for (const [dx, dy, ch, tn] of flowerCells({ R: sp.R, petals: sp.petals, open: sp.open, rot: sp.rot, seed })) this.put(x + dx, y + dy, ch, toneOf(sp, tn));
    }
    // A stem from (x0, y0) down to (x1, y1), its glyph following the lean, a leaf now and then
    stem(x0, y0, x1, y1, leafy, stop = y1) {
      let prev = x0;
      for (let y = y0 + 1; y <= Math.min(y1, stop); y++) {
        const k = (y - y0) / Math.max(1, y1 - y0), x = Math.round(x0 + (x1 - x0) * k);
        if (!this.get(x, y)) this.put(x, y, x > prev ? '\\' : x < prev ? '/' : '|', 'stem');
        if (leafy && (y + x0) % 5 === 0 && k > 0.1 && k < 0.7) {
          const sd = (y + x0) % 10 ? 1 : -1;
          if (!this.get(x + sd, y)) { this.put(x + sd, y, sd > 0 ? '\\' : '/', 'leaf'); this.put(x + sd * 2, y, '_', 'leaf'); }
        }
        prev = x;
      }
    }
    // Crop to what is drawn, then serialise as coloured runs
    crop(pad = 1) {
      let x0 = this.w, x1 = -1, y0 = this.h, y1 = -1;
      this.g.forEach((row, y) => row.forEach((c, x) => { if (c) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }));
      if (x1 < 0) return;
      x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(this.w - 1, x1 + pad); y1 = Math.min(this.h - 1, y1 + pad);
      this.g = this.g.slice(y0, y1 + 1).map((r) => r.slice(x0, x1 + 1)); this.w = x1 - x0 + 1; this.h = y1 - y0 + 1;
    }
    html() {
      return this.g.map((row) => {
        let s = '', cur = null, run = '';
        const flush = () => { if (run) s += cur ? `<i class="${cur.split(' ').map((t) => 'a-' + t).join(' ')}">${esc(run)}</i>` : run; run = ''; };
        for (const c of row) { const t = c ? c[1] : null; if (t !== cur) { flush(); cur = t; } run += c ? c[0] : ' '; }
        flush();
        return s.replace(/\s+$/, '');
      }).join('\n');
    }
  }

  // ── Arrange a bouquet: heads in a staggered dome, stems gathered into a paper cone, a ribbon ──
  function arrange(ids, wrapIdx, seed) {
    const W = 100, H = 56, PX = 50, BOT = 52, TOP = BOT - 17, TIE = BOT - 7;
    const rnd = seeded('b' + seed), wrap = WRAPS[wrapIdx] || WRAPS[0], g = new Grid(W, H);
    const n = ids.length;
    const span = n <= 1 ? 0 : Math.min(30, 5 + n * 2.3);                 // half-width of the dome
    const coneHW = Math.max(11, Math.round(span * 0.72 + 6));              // half-width of the cone's mouth

    // big flowers to the middle, fillers to the edges, then spread across the dome
    const order = ids.map((id, i) => ({ id, sp: SPECIES[id], k: rnd() }))
      .sort((a, b) => (b.sp.R - a.sp.R) || (a.k - b.k));
    const slots = [];
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
      slots.push({ u, k: Math.abs(u) + (rnd() - 0.5) * 0.15 });
    }
    slots.sort((a, b) => a.k - b.k);                                      // centre slots first
    const tiers = n >= 8 ? 3 : n >= 3 ? 2 : 1;
    const heads = order.map((f, i) => {
      const s = slots[i], tier = tiers === 1 ? 0 : (i % tiers);
      const x = PX + s.u * span + (rnd() - 0.5) * 3;
      const y = TOP - 8 - tier * 5 + s.u * s.u * 5 - (f.sp.filler ? 2 + rnd() * 5 : 0) + (rnd() - 0.5) * 2;
      return { ...f, x: Math.round(x), y: Math.round(y), tier, seed: seed * 31 + i * 7 + f.id };
    });

    // stems first: the cone and heads cover them
    for (const h of heads) g.stem(h.x, h.y, PX + clamp(Math.round((h.x - PX) * 0.15), -3, 3), BOT, !h.sp.filler, TOP);

    // the paper cone, mouth at TOP, point at BOT
    for (let y = TOP; y <= BOT; y++) {
      const k = (y - TOP) / (BOT - TOP), hw = Math.round(coneHW * (1 - k) + 1.5 * k);
      for (let dx = -hw; dx <= hw; dx++) {
        const x = PX + dx;
        if (y === TOP) { g.put(x, y, dx === -hw || dx === hw ? '.' : (x % 3 ? '~' : '-'), wrap.edge); continue; }
        if (dx === -hw) g.put(x, y, '\\', wrap.edge);
        else if (dx === hw) g.put(x, y, '/', wrap.edge);
        else if (dx === Math.round(-hw * 0.35 + 1)) g.put(x, y, ':', wrap.edge);      // the front fold
        else g.put(x, y, (x * 7 + y * 3) % 11 === 0 ? ':' : (x + y) % 4 === 0 ? '.' : ' ', wrap.paper);
      }
    }
    // the ribbon and its bow
    const thw = Math.round(coneHW * (1 - (TIE - TOP) / (BOT - TOP)) + 1.5 * ((TIE - TOP) / (BOT - TOP)));
    for (let dx = -thw + 1; dx < thw; dx++) g.put(PX + dx, TIE, '=', wrap.ribbon);
    [['(', -3], ['(', -2], ['@', 0], [')', 2], [')', 3]].forEach(([c, dx]) => g.put(PX + dx, TIE, c, wrap.ribbon));
    g.put(PX - 1, TIE, '>', wrap.ribbon); g.put(PX + 1, TIE, '<', wrap.ribbon);
    g.put(PX - 1, TIE + 1, '/', wrap.ribbon); g.put(PX + 1, TIE + 1, '\\', wrap.ribbon);
    g.put(PX - 2, TIE + 2, '/', wrap.ribbon); g.put(PX + 2, TIE + 2, '\\', wrap.ribbon);

    // foliage spilling over the mouth of the cone
    if (n) {
      const lw = Math.round(coneHW * 0.95);
      for (let dx = -lw; dx <= lw; dx++) {
        const depth = 1 + Math.round(2.5 * (1 - Math.pow(dx / lw, 2)) + rnd() * 1.5);
        for (let k = 1; k <= depth; k++) {
          const x = PX + dx, y = TOP - k;
          if (g.get(x, y)?.[1] === 'stem' || !g.get(x, y)) {
            const top = k === depth;
            g.put(x, y, top ? (dx < 0 ? '(' : ')') : '&%#8@'[(Math.abs(dx * 31 + k * 17)) % 5], top ? 'g2' : (dx + k) % 3 ? 'leaf' : 'g2');
          }
        }
      }
    }

    // heads, back tier first so the front ones sit over them
    [...heads].sort((a, b) => b.tier - a.tier || a.y - b.y).forEach((h) => g.head(h.x, h.y, h.sp, h.seed));

    // pollen and a firefly in the air
    const motes = n ? 3 + Math.min(5, n) : 0, top = Math.min(...heads.map((h) => h.y - Math.round(h.sp.R / 2)));
    for (let i = 0; i < motes; i++) {
      const x = PX + Math.round((rnd() * 2 - 1) * (span + 9)), y = top - 3 + Math.round(rnd() * (TOP - top - 2));
      if (!g.get(x, y)) g.put(x, y, i === 0 ? '*' : '·', i === 0 ? 'fly' : 'pollen');
    }
    g.crop(1);
    return g;
  }

  // ── Live bits: petals keep flipping 0/1, the way the garden's do ──
  function mount(pre, grid) {
    clearInterval(pre._tick);
    const petals = [];
    grid.g.forEach((row, y) => row.forEach((c, x) => { if (c && c[1].startsWith('p ')) petals.push([x, y]); }));
    const draw = () => { pre.innerHTML = grid.html(); };
    pre.style.setProperty('--cols', grid.w); pre.style.setProperty('--rows', grid.h);
    draw();
    if (REDUCED || !petals.length) return;
    pre._tick = setInterval(() => {
      if (document.hidden) return;
      for (let i = 0; i < Math.max(2, petals.length * 0.03); i++) {
        const [x, y] = petals[(Math.random() * petals.length) | 0], c = grid.g[y][x];
        c[0] = c[0] === '0' ? '1' : '0';
      }
      draw();
    }, 140);
  }

  // ── KIT.decode: 0/1 noise resolving into letters ──
  function decode(el, text, o = {}) {
    cancelAnimationFrame(el._raf || 0);
    const chars = [...text], n = chars.length, at = chars.map((_, i) => (i / n) * 0.7 + Math.random() * 0.12);
    const t0 = performance.now() + (o.delay || 0), dur = REDUCED ? 0 : o.dur || Math.min(2400, 500 + n * 12);
    const frame = (now) => {
      const k = now < t0 ? 0 : dur ? (now - t0) / dur : 2; let out = '', done = true;
      for (let i = 0; i < n; i++) {
        if (/\s/.test(chars[i]) || k >= at[i] + 0.18) out += chars[i];
        else { out += Math.random() < 0.5 ? '0' : '1'; done = false; }
      }
      el.textContent = out;
      if (!done) el._raf = requestAnimationFrame(frame);
    };
    el._raf = requestAnimationFrame(frame);
  }

  // ── The URL: a compact JSON, UTF-8, base64url ──
  const ALPHA = '0123456789abcdefghijklmnopqrstuvwxyz';
  function pack(b) {
    const o = { v: 1, f: b.ids.map((i) => ALPHA[i]).join(''), w: b.wrap, s: b.seed };
    if (b.to) o.t = b.to; if (b.msg) o.m = b.msg; if (b.from) o.r = b.from;
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    let bin = ''; bytes.forEach((x) => (bin += String.fromCharCode(x)));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unpack(code) {
    try {
      const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
      const o = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
      const ids = [...String(o.f || '')].map((c) => ALPHA.indexOf(c)).filter((i) => i >= 0 && i < SPECIES.length).slice(0, MAX);
      return { ids, wrap: clamp(o.w | 0, 0, WRAPS.length - 1), seed: o.s | 0, to: String(o.t || '').slice(0, 40), msg: String(o.m || '').slice(0, 600), from: String(o.r || '').slice(0, 40) };
    } catch { return null; }
  }
  const linkFor = (b) => location.origin + location.pathname + '#b=' + pack(b);

  // ════ The recipient's view ════
  function showGift(b) {
    document.body.classList.add('is-gift');
    $('#shop').hidden = true; $('#gift').hidden = false;
    document.title = b.from ? `Flowers from ${b.from}` : 'Someone sent you flowers';
    $('#g-k').textContent = b.from ? `a delivery from ${b.from}` : 'a delivery';
    $('#g-to').innerHTML = b.to ? `For <em>${esc(b.to)}</em>` : `Flowers, <em>for you</em>`;
    mount($('#g-art'), arrange(b.ids, b.wrap, b.seed));
    const msg = $('#g-msg');
    if (b.msg) { msg.textContent = ''; setTimeout(() => decode(msg, b.msg), 900); } else $('#g-card').hidden = !b.from;
    $('#g-from').textContent = b.from ? '— ' + b.from : '';
    const counts = {};
    b.ids.forEach((i) => (counts[i] = (counts[i] || 0) + 1));
    $('#g-list').textContent = Object.entries(counts).map(([i, c]) => `${c} × ${SPECIES[i].name.toLowerCase()}`).join(' · ') + (b.ids.length ? ` · wrapped in ${WRAPS[b.wrap].name.toLowerCase()}` : '');
  }

  // ════ The florist ════
  const DRAFT = 'yourflorist:draft';
  let state = { ids: [], wrap: 0, seed: (Math.random() * 1e6) | 0, to: '', msg: '', from: '' };
  try { const d = JSON.parse(localStorage.getItem(DRAFT) || 'null'); if (d && Array.isArray(d.ids)) state = { ...state, ...d }; } catch {}
  const save = () => { try { localStorage.setItem(DRAFT, JSON.stringify(state)); } catch {} };

  function renderPlate(pop) {
    const pre = $('#art');
    mount(pre, arrange(state.ids, state.wrap, state.seed));
    if (pop) { pre.classList.remove('is-new'); void pre.offsetWidth; pre.classList.add('is-new'); }
    const n = state.ids.length;
    $('#tally').textContent = n ? `${n} stem${n > 1 ? 's' : ''}${n >= MAX ? ' · full' : ''}` : 'an empty wrap';
    $('#wrapname').textContent = WRAPS[state.wrap].name.toLowerCase() + ' paper';
    $('#plate').classList.toggle('is-pop', n > 0);
    $('#to2').disabled = !n;
    document.querySelectorAll('[data-step="2"], [data-step="3"]').forEach((b) => (b.disabled = !n));
    SPECIES.forEach((_, i) => {
      const c = state.ids.filter((x) => x === i).length, row = document.querySelector(`[data-sp="${i}"]`);
      row.querySelector('.n').textContent = c ? '×' + c : '+';
      row.querySelector('.n').classList.toggle('has', !!c);
      row.querySelector('.minus').classList.toggle('has', !!c);
    });
  }

  function buildCounter() {
    $('#species').innerHTML = SPECIES.map((sp, i) => {
      const g = new Grid(sp.R * 2 + 1, Math.max(1, Math.round(sp.R * 0.5)) * 2 + 1);
      const ox = sp.R, oy = Math.max(1, Math.round(sp.R * 0.5));
      g.head(ox, oy, sp, 3 + i);
      return `<li class="sp-row" data-sp="${i}">
        <button class="sp" type="button" data-add="${i}" aria-label="Add a ${esc(sp.name)}">
          <pre aria-hidden="true">${g.html()}</pre>
          <span><b>${esc(sp.name)}</b><small>${esc(sp.sub)}</small></span>
          <span class="n">+</span>
        </button>
        <button class="minus" type="button" data-rm="${i}" aria-label="Remove a ${esc(sp.name)}">−</button>
      </li>`;
    }).join('');
    $('#wraps').innerHTML = WRAPS.map((w, i) => `<button class="chip" type="button" data-wrap="${i}" aria-pressed="${i === state.wrap}"><i style="background:${w.dot}"></i>${w.name}</button>`).join('');
  }

  function go(step) {
    if (step > 1 && !state.ids.length) step = 1;
    document.querySelectorAll('[data-pane]').forEach((p) => (p.hidden = +p.dataset.pane !== step));
    document.querySelectorAll('#steps button').forEach((b) => b.classList.toggle('is-on', +b.dataset.step === step));
    if (step === 3) { const url = linkFor(state); $('#link').value = url; $('#open').href = url; $('#copied').textContent = ''; }
    if (step === 2) setTimeout(() => $(state.to ? '#msg' : '#to').focus({ preventScroll: true }), 50);
    if (innerWidth <= 900) scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' });
  }

  function startShop() {
    buildCounter();
    $('#to').value = state.to; $('#msg').value = state.msg; $('#from').value = state.from;
    $('#count').textContent = `${state.msg.length} / 600`;
    renderPlate(false);

    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-add], [data-rm], [data-wrap], [data-goto], [data-step]');
      if (!t || t.disabled) return;
      if (t.dataset.add != null) { if (state.ids.length < MAX) state.ids.push(+t.dataset.add); else flash('#tally'); renderPlate(true); }
      else if (t.dataset.rm != null) { const k = state.ids.lastIndexOf(+t.dataset.rm); if (k >= 0) state.ids.splice(k, 1); renderPlate(true); }
      else if (t.dataset.wrap != null) {
        state.wrap = +t.dataset.wrap;
        document.querySelectorAll('[data-wrap]').forEach((c) => c.setAttribute('aria-pressed', c === t));
        renderPlate(true);
      }
      else go(+(t.dataset.goto || t.dataset.step));
      save();
    });
    $('#shuffle').onclick = () => { state.seed = (Math.random() * 1e6) | 0; renderPlate(true); save(); };
    $('#clear').onclick = () => { state.ids = []; renderPlate(true); save(); };
    $('#card').addEventListener('input', () => {
      state.to = $('#to').value; state.msg = $('#msg').value; state.from = $('#from').value;
      $('#count').textContent = `${state.msg.length} / 600`;
      save();
    });
    $('#card').addEventListener('submit', (e) => { e.preventDefault(); go(3); });
    $('#copy').onclick = async () => {
      const inp = $('#link');
      try { await navigator.clipboard.writeText(inp.value); }
      catch { inp.select(); document.execCommand && document.execCommand('copy'); }
      $('#copied').textContent = 'copied. now send it to them.';
    };
    $('#link').addEventListener('focus', (e) => e.target.select());
    $('#again').onclick = () => {
      state = { ids: [], wrap: state.wrap, seed: (Math.random() * 1e6) | 0, to: '', msg: '', from: state.from };
      $('#to').value = ''; $('#msg').value = ''; $('#count').textContent = '0 / 600';
      save(); renderPlate(true); go(1);
    };
  }
  function flash(sel) { const el = $(sel); el.style.color = 'var(--red)'; setTimeout(() => (el.style.color = ''), 700); }

  // ── route ──
  function route() {
    const m = location.hash.match(/^#b=([A-Za-z0-9_-]+)/), b = m && unpack(m[1]);
    if (b) showGift(b);
    else { document.body.classList.remove('is-gift'); $('#gift').hidden = true; $('#shop').hidden = false; }
  }
  document.querySelectorAll('[data-home]').forEach((a) => a.addEventListener('click', (e) => {
    if (!location.hash) return;
    e.preventDefault(); history.pushState(null, '', location.pathname); route(); scrollTo(0, 0);
  }));
  addEventListener('hashchange', route);
  addEventListener('popstate', route);
  startShop();
  route();
})();
