// yourFlorist: pick flowers, write a note, send the bouquet as a link.
// The bouquet itself is drawn in 3D ASCII by bouquet3d.js. The whole bouquet +
// note lives in the URL hash, so there is no server and nothing is stored anywhere.
(function () {
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const { SPECIES, WRAPS } = window.B3D;
  const MAX = 12;
  let plate3d = null, gift3d = null;

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
    gift3d = gift3d || new B3D.Renderer($('#g-art'), { yaw: 0.4, delay: 2000 });
    gift3d.setScene(B3D.build(b.ids, b.wrap, b.seed), true);
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
  try { const d = JSON.parse(localStorage.getItem(DRAFT) || 'null'); if (d && Array.isArray(d.ids)) state = { ...state, ...d, ids: d.ids.filter((i) => SPECIES[i]).slice(0, MAX) }; } catch {}
  const save = () => { try { localStorage.setItem(DRAFT, JSON.stringify(state)); } catch {} };

  function renderPlate(pop) {
    plate3d = plate3d || new B3D.Renderer($('#art'), { delay: 900 });
    plate3d.setScene(B3D.build(state.ids, state.wrap, state.seed), pop);
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
      return `<li class="sp-row" data-sp="${i}">
        <button class="sp" type="button" data-add="${i}" aria-label="Add a ${esc(sp.name)}">
          <canvas class="thumb" aria-hidden="true"></canvas>
          <span><b>${esc(sp.name)}</b><small>${esc(sp.sub)}</small></span>
          <span class="n">+</span>
        </button>
        <button class="minus" type="button" data-rm="${i}" aria-label="Remove a ${esc(sp.name)}">−</button>
      </li>`;
    }).join('');
    document.querySelectorAll('.thumb').forEach((c, i) => new B3D.Renderer(c, { thumb: true, yaw: 0, pitch: 0.3 }).setScene(B3D.single(i)));
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
