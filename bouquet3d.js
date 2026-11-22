// ─────────────────────────────────────────────
//  3D ASCII BOUQUET
//
//  The garden3d approach from the Herbarium: every surface (petals, leaves,
//  stems, paper, ribbon) is a cloud of points with a normal. Each frame the
//  points are projected through an orbiting perspective camera into a
//  character grid with a depth buffer. Lighting picks the brightness, the
//  surface picks the glyph: petals carry the live 0/1 bit stream, lines pick
//  | / \ - from their on-screen direction, paper shades with a glyph ramp.
//
//    const r = new B3D.Renderer(canvas);
//    r.setScene(B3D.build(ids, wrap, seed), true);
// ─────────────────────────────────────────────
(function () {
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const seeded = (s) => { let x = [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7) || 1; return () => ((x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const TAU = Math.PI * 2;

  // ── Palette: the garden's colours × five brightness levels ──
  const BASE = {
    stem: '#6f9f6f', stemD: '#4f8a4f', leaf: '#5c9a5c', leafD: '#3f6b3f', gold: '#e6c34a', gold2: '#8a7428', brown: '#8a5a30', pollen: '#e6d27a',
    red: '#ff8a8a', red2: '#b35a5a', crimson: '#ff6b7f', white: '#f4f4f4', cream: '#cfc8b0', blush: '#ffc0d0', rose: '#c88a9a',
    violet: '#c49aff', violet2: '#7a62aa', lav: '#b39aff', orange: '#ffb070', orange2: '#c07040', ink: '#6a6a76', ink2: '#9a9aa8',
    kraft: '#c49a64', kraft2: '#e0bc88', linen: '#d8d4c4', fly: '#d4ff7a', sage: '#9fbf9a', night: '#4a4a58',
  };
  const CN = Object.keys(BASE), CI = Object.fromEntries(CN.map((k, i) => [k, i]));
  const LV = [0.24, 0.4, 0.58, 0.79, 1], NL = LV.length;
  const PAL = [];
  for (const k of CN) {
    const n = parseInt(BASE[k].slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    for (const l of LV) PAL.push(`rgb(${(r * l) | 0},${(g * l) | 0},${(b * l) | 0})`);
  }
  const CH = [' ', '.', ',', "'", ':', ';', '|', '/', '\\', '-', '_', '~', '0', '1', '@', 'o', '8', '*', '+', '°', '#', '%', '&', '=', '·'];
  const K = Object.fromEntries(CH.map((c, i) => [c, i]));
  const BIT = -1, LINE = -2, RAMP = -3;               // glyph slots chosen per frame
  // paper textures, shadow to light: RAMP - i picks RAMPS[i]
  const RAMPS = [
    ['.', '.', '.', ':', ':', ';'],          // 0 plain
    ['.', ',', ',', '~', '~', '='],          // 1 kraft: fibres
    ['.', ':', ':', ';', '*', '*'],          // 2 night: a glossy sheen where the light catches
    ['.', '+', '+', '#', '#', '#'],          // 3 linen: a weave
    ['.', '.', ':', 'o', 'o', 'o'],          // 4 blush: soft crepe
    [',', ';', ';', '%', '%', '&'],          // 5 moss: felt
    ['.', '.', ':', ':', '·', '·'],          // 6 tissue
  ].map((r) => r.map((c) => K[c]));
  // petals: shadow to light, the live 0/1 bits only where the light is strongest
  const PETALK = ['.', ':', '+', 'o'].map((c) => K[c]), PETAL_AT = [0.12, 0.22, 0.32, 0.46];
  const LINEK = new Set(['|', '-', '/', '\\'].map((c) => K[c]));
  const GREEN = -2;                                  // group id for stems and leaves (heads are 0, 1, 2…; paper is -1)
  const L0 = norm([0.5, 0.9, 0.6]);                    // a fixed light, used to orient line normals at build time

  // ── The scene: a flat list of points ──
  //   x y z  nx ny nz  colour glyph  tx ty tz (line tangent)  ao  sway phase  group
  const STRIDE = 15, STEP = 0.0125;
  class Cloud {
    constructor() { this.d = []; this.groups = []; }
    add(p, n, col, ch, o = {}) {
      const t = o.t || [0, 0, 0];
      this.d.push(p[0], p[1], p[2], n[0], n[1], n[2], CI[col], ch, t[0], t[1], t[2], o.ao ?? 1, o.sw ?? 0, o.ph ?? 0, o.g ?? -1);
    }
  }

  // A local frame for a flower head: c centre, d the way it faces, e1/e2 across its face
  function frame(c, d, k = 1) {
    d = norm(d);
    const a = Math.abs(d[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0], e1 = norm(cross(a, d)), e2 = cross(d, e1);
    return { c, d, e1, e2, k };
  }
  const loc = (F, u1, u2, h) => (u1 *= F.k, u2 *= F.k, h *= F.k, [
    F.c[0] + F.e1[0] * u1 + F.e2[0] * u2 + F.d[0] * h,
    F.c[1] + F.e1[1] * u1 + F.e2[1] * u2 + F.d[1] * h,
    F.c[2] + F.e1[2] * u1 + F.e2[2] * u2 + F.d[2] * h]);
  const dir = (F, u1, u2, h) => norm([
    F.e1[0] * u1 + F.e2[0] * u2 + F.d[0] * h, F.e1[1] * u1 + F.e2[1] * u2 + F.d[1] * h, F.e1[2] * u1 + F.e2[2] * u2 + F.d[2] * h]);

  // Sample a parametric surface W(t ∈ 0..1, s ∈ -1..1), normals by finite differences
  function surface(W, nt, ns, emit, fallback) {
    const e = 0.01;
    for (let i = 0; i <= nt; i++) {
      const t = i / nt;
      for (let j = 0; j <= ns; j++) {
        const s = ns ? -1 + (2 * j) / ns : 0, p = W(t, s);
        const n = cross(sub(W(t + e, s), W(t - e, s)), sub(W(t, s + e), W(t, s - e)));
        const l = Math.hypot(n[0], n[1], n[2]);
        emit(t, s, p, l > 1e-12 ? [n[0] / l, n[1] / l, n[2] / l] : fallback, i, j);
      }
    }
  }
  // A line of points: the glyph follows its direction on screen
  function curve(cl, P, len, col, o = {}) {
    const n = Math.max(2, Math.ceil(len / (STEP * 0.6)));
    for (let i = 0; i <= n; i++) {
      const t = i / n, p = P(t), tg = norm(sub(P(Math.min(1, t + 0.01)), P(Math.max(0, t - 0.01))));
      const nn = norm(cross(cross(tg, L0), tg));      // the side of the line that faces the light
      cl.add(p, nn, col, o.ch ?? LINE, { ...o, t: tg, sw: typeof o.sw === 'function' ? o.sw(t) : o.sw });
    }
  }

  // ── Petals: a curved blade around the head's axis ──
  //   a angle · r0 inner radius · len · w half-width · up lift · droop · inward curl
  //   cup across the width · ruffle · tip: point | round | notch
  function petal(cl, F, o) {
    const ca = Math.cos(o.a), sa = Math.sin(o.a), up = o.up ?? 0.3, len = o.len, w = o.w;
    const prof = (t) => {
      t = clamp(t, 0, 1);
      if (o.tip === 'point') return Math.pow(Math.sin(Math.PI * t), 0.7) * (1 - 0.3 * t);
      return Math.max(Math.sqrt(Math.max(0, 1 - ((t - 0.55) / 0.45) ** 2)), t < 0.2 ? 0.18 : 0);
    };
    const W = (t, s) => {
      const pr = prof(t), lat = s * w * pr;
      const rad = (o.r0 || 0) + t * len * Math.cos(up) - (o.inward || 0) * t * t;
      const h = (o.h0 || 0) + t * len * Math.sin(up) - (o.droop || 0) * t * t + (o.cup || 0) * s * s * w * pr
        + (o.ruffle ? o.ruffle * w * 0.3 * t * Math.sin(s * 6 + t * 8 + o.a * 5) : 0);
      return loc(F, rad * ca - lat * sa, rad * sa + lat * ca, h);
    };
    surface(W, Math.max(5, Math.ceil((len * F.k) / STEP)), Math.max(2, Math.ceil((2 * w * F.k) / STEP)), (t, s, p, n) => {
      if (o.tip === 'notch' && t > 0.86 && Math.abs(s) < 0.28) return;
      // the outline is drawn as a line along the petal's contour, in the rim colour
      const side = Math.abs(s) > 0.88, tip = t > 0.95, ao = (o.ao || 1) * 1.1 * (0.7 + 0.3 * t);
      if (side || tip) {
        const tg = side && !tip ? norm(sub(W(t + 0.01, s), W(t - 0.01, s))) : norm(sub(W(t, s + 0.01), W(t, s - 0.01)));
        cl.add(p, n, o.rim, LINE, { t: tg, ao: Math.min(1, ao * 1.15), sw: o.sw, ph: o.ph, g: o.g });
      } else cl.add(p, n, o.col, BIT, { ao, sw: o.sw, ph: o.ph, g: o.g });
    }, F.d);
  }
  function ring(cl, F, rnd, n, o) {
    for (let k = 0; k < n; k++) {
      petal(cl, F, { ...o, a: (o.a0 || 0) + (k / n) * TAU + (rnd() - 0.5) * (o.jit ?? 0.18), len: o.len * (0.92 + rnd() * 0.16) });
    }
  }
  // A domed centre: 'eye' rings of @8 / o, or 'seeds' in a sunflower's crossing spirals
  function dome(cl, F, r, h, col, col2, mode, o) {
    const st = (STEP * 0.7) / F.k;
    for (let rr = 0; rr <= r + 1e-9; rr += st) {
      const na = Math.max(1, Math.ceil((TAU * rr) / st));
      for (let k = 0; k < na; k++) {
        const a = (k / na) * TAU, q = rr / r, hh = h * Math.sqrt(Math.max(0, 1 - q * q));
        const u1 = rr * Math.cos(a), u2 = rr * Math.sin(a);
        let ch, c;
        if (mode === 'seeds') { const v = Math.sin(rr * 160 + a * 13) * Math.sin(rr * 160 - a * 21); ch = v > 0.15 ? K['@'] : v > -0.35 ? K.o : K['.']; c = v > 0 ? col : col2; }
        else { ch = q < 0.55 ? (k % 3 ? K['@'] : K['8']) : K.o; c = q < 0.55 ? col : col2; }
        cl.add(loc(F, u1, u2, hh + (o.h0 || 0)), dir(F, u1 / (r * r), u2 / (r * r), hh / (h * h)), c, ch, { ao: 0.75 + 0.25 * (1 - q), sw: o.sw, ph: o.ph, g: o.g });
      }
    }
  }
  function stamens(cl, F, n, r0, r1, h, col, tip, o) {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + k * 0.37, ca = Math.cos(a), sa = Math.sin(a);
      curve(cl, (t) => loc(F, (r0 + (r1 - r0) * t) * ca, (r0 + (r1 - r0) * t) * sa, h * t), Math.hypot(r1 - r0, h) * F.k, col, { ...o, ao: 0.8 });
      cl.add(loc(F, r1 * ca, r1 * sa, h), F.d, tip, K['°'], o);
    }
  }
  function sepals(cl, F, rnd, size, o) {
    ring(cl, F, rnd, 5, { ...o, r0: size * 0.08, len: size * 0.3, w: size * 0.09, up: -0.7, tip: 'point', col: 'stemD', rim: 'leafD', h0: -0.006, ao: 0.8 });
  }

  // ── The flowers ──
  function rose(cl, F, rnd, o) {
    [[3, 0.004, 0.04, 0.03, 1.5, 0.03], [4, 0.012, 0.06, 0.042, 1.35, 0.03], [5, 0.022, 0.08, 0.052, 1.15, 0.02], [5, 0.032, 0.1, 0.06, 0.95, 0.01], [6, 0.042, 0.115, 0.066, 0.72, 0]]
      .forEach(([n, r0, len, w, up, inward], k) => ring(cl, F, rnd, n, { ...o, a0: k * 0.9, r0, len, w, up, inward, cup: 0.7, droop: k > 3 ? 0.025 : 0, tip: 'round', col: 'red', rim: 'red2', ao: 0.72 + 0.07 * k, jit: 0.3 }));
    sepals(cl, F, rnd, 0.17, o);
  }
  function peony(cl, F, rnd, o) {
    for (let k = 0; k < 6; k++) {
      ring(cl, F, rnd, 5 + 2 * k, { ...o, a0: k * 0.7, r0: 0.004 + 0.012 * k, len: 0.04 + 0.027 * k, w: 0.03 + 0.011 * k, up: 1.5 - 0.23 * k, ruffle: 0.8, cup: 0.4, droop: k > 3 ? 0.03 : 0, tip: 'notch', col: 'blush', rim: 'rose', ao: 0.62 + 0.07 * k });
    }
    sepals(cl, F, rnd, 0.2, o);
  }
  function daisy(cl, F, rnd, o) {
    ring(cl, F, rnd, 21, { ...o, r0: 0.04, len: 0.13, w: 0.017, up: 0.12, droop: 0.035, tip: 'round', col: 'white', rim: 'cream', jit: 0.06 });
    dome(cl, F, 0.045, 0.028, 'gold', 'gold2', 'eye', o);
  }
  function sunflower(cl, F, rnd, o) {
    ring(cl, F, rnd, 20, { ...o, r0: 0.09, len: 0.14, w: 0.027, up: 0.18, droop: 0.05, tip: 'point', col: 'gold', rim: 'gold2', jit: 0.05 });
    ring(cl, F, rnd, 20, { ...o, a0: Math.PI / 20, r0: 0.085, len: 0.12, w: 0.025, up: 0.32, droop: 0.03, tip: 'point', col: 'gold', rim: 'orange2', jit: 0.05, h0: -0.004 });
    dome(cl, F, 0.095, 0.03, 'brown', 'gold2', 'seeds', o);
    sepals(cl, F, rnd, 0.3, o);
  }
  function poppy(cl, F, rnd, o) {
    ring(cl, F, rnd, 4, { ...o, r0: 0.015, len: 0.15, w: 0.12, up: 0.8, cup: 0.9, ruffle: 0.4, tip: 'round', col: 'orange', rim: 'orange2' });
    dome(cl, F, 0.025, 0.035, 'ink', 'ink2', 'eye', o);
    stamens(cl, F, 22, 0.022, 0.048, 0.024, 'ink', 'ink2', o);
  }
  function violet(cl, F, rnd, o) {
    [1.15, 1.15, 0.92, 0.92, 1.05].forEach((m, k) => petal(cl, F, { ...o, a: (k / 5) * TAU + 0.3, r0: 0.005, len: 0.07 * m, w: 0.04, up: 0.15, droop: 0.01, cup: 0.3, tip: 'round', col: 'violet', rim: 'violet2' }));
    dome(cl, F, 0.012, 0.01, 'gold', 'gold', 'eye', o);
  }
  function camellia(cl, F, rnd, o) {
    [[5, 0, 0.05, 0.04, 1.15], [7, 0.015, 0.085, 0.06, 0.75], [9, 0.03, 0.12, 0.075, 0.35]]
      .forEach(([n, r0, len, w, up], k) => ring(cl, F, rnd, n, { ...o, a0: k * 0.6, r0, len, w, up, cup: 0.5, tip: 'round', col: 'white', rim: 'cream', ao: 0.75 + 0.1 * k }));
    stamens(cl, F, 14, 0.008, 0.026, 0.03, 'gold', 'pollen', o);
    sepals(cl, F, rnd, 0.15, o);
  }
  function cosmos(cl, F, rnd, o) {
    ring(cl, F, rnd, 8, { ...o, r0: 0.025, len: 0.15, w: 0.05, up: 0.1, droop: 0.02, cup: 0.25, tip: 'notch', col: 'blush', rim: 'rose', jit: 0.08 });
    dome(cl, F, 0.028, 0.02, 'gold', 'gold2', 'eye', o);
  }
  function anemone(cl, F, rnd, o) {
    ring(cl, F, rnd, 6, { ...o, r0: 0.03, len: 0.13, w: 0.055, up: 0.25, cup: 0.35, tip: 'round', col: 'violet', rim: 'violet2', jit: 0.05 });
    dome(cl, F, 0.042, 0.028, 'ink', 'ink2', 'eye', o);
    stamens(cl, F, 18, 0.035, 0.055, 0.012, 'ink', 'ink2', o);
  }
  function tulip(cl, F, rnd, o) {
    ring(cl, F, rnd, 3, { ...o, r0: 0.015, len: 0.17, w: 0.075, up: 1.3, inward: 0.03, cup: 0.6, tip: 'round', col: 'crimson', rim: 'red', jit: 0.05, ao: 1.3 });
    ring(cl, F, rnd, 3, { ...o, a0: Math.PI / 3, r0: 0.02, len: 0.18, w: 0.08, up: 1.24, inward: 0.025, cup: 0.6, tip: 'round', col: 'crimson', rim: 'red', jit: 0.05, ao: 1.3 });
  }
  function babysBreath(cl, F, rnd, o) {
    for (let k = 0; k < 11; k++) {
      const a = rnd() * TAU, sp = 0.35 + rnd() * 0.75, len = 0.05 + rnd() * 0.06;
      const end = loc(F, Math.cos(a) * Math.sin(sp) * len, Math.sin(a) * Math.sin(sp) * len, Math.cos(sp) * len);
      curve(cl, (t) => add(mul(F.c, 1 - t), mul(end, t)), len * F.k, 'stem', { ...o, ao: 0.75 });
      for (let j = 0; j < 6; j++) {
        const p = add(end, mul([(rnd() - 0.5) * 0.028, (rnd() - 0.5) * 0.022, (rnd() - 0.5) * 0.028], F.k));
        cl.add(p, norm(sub(p, F.c)), j % 3 ? 'white' : 'cream', [K['°'], K.o, K['·']][j % 3], o);
      }
    }
  }
  function lavender(cl, F, rnd, o) {
    curve(cl, (t) => loc(F, 0, 0, t * 0.27), 0.27 * F.k, 'stem', o);
    for (let j = 0; j < 10; j++) {
      const h = j * 0.026, rad = 0.026 * (1 - j / 13) + 0.006;
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * TAU + j * 0.5;
        for (let q = 0; q < 3; q++) {
          const u1 = (rad + q * 0.004) * Math.cos(a), u2 = (rad + q * 0.004) * Math.sin(a);
          cl.add(loc(F, u1, u2, h + q * 0.004), dir(F, Math.cos(a), Math.sin(a), 0.3), (j + k) % 3 ? 'lav' : 'violet', [K.o, K['°'], K['0']][q], { ...o, ao: 1.25 });
        }
      }
    }
  }

  // Order matters: a flower's index is how it travels in the URL. New kinds go at the end.
  const SPECIES = [
    { name: 'Garden rose', sub: 'love, plainly said', size: 0.17, build: rose },
    { name: 'Peony', sub: 'a happy life', size: 0.2, build: peony },
    { name: 'Daisy', sub: 'innocence, new starts', size: 0.18, build: daisy },
    { name: 'Sunflower', sub: 'loyalty, warmth', size: 0.26, build: sunflower },
    { name: 'Poppy', sub: 'remembrance', size: 0.17, build: poppy },
    { name: 'Violet', sub: 'faithfulness', size: 0.09, build: violet },
    { name: 'Camellia', sub: 'longing', size: 0.15, build: camellia },
    { name: 'Cosmos', sub: 'order and harmony', size: 0.18, build: cosmos },
    { name: 'Anemone', sub: 'anticipation', size: 0.16, build: anemone },
    { name: "Baby's breath", sub: 'everlasting', size: 0.06, filler: true, build: babysBreath },
    { name: 'Tulip', sub: 'perfect love', size: 0.12, lift: 0.04, build: tulip },
    { name: 'Lavender', sub: 'devotion', size: 0.05, filler: true, lift: 0.06, build: lavender },
  ];
  const WRAPS = [
    { name: 'Kraft', paper: 'kraft', edge: 'kraft2', tissue: 'blush', ribbon: 'red', tex: 1, dot: '#c49a64' },
    { name: 'Night', paper: 'night', edge: 'ink2', tissue: 'gold', ribbon: 'gold', tex: 2, dot: '#8a8a9a' },
    { name: 'Linen', paper: 'linen', edge: 'white', tissue: 'sage', ribbon: 'red', tex: 3, dot: '#e8e4d0' },
    { name: 'Blush', paper: 'rose', edge: 'blush', tissue: 'white', ribbon: 'white', tex: 4, dot: '#ffc0d0' },
    { name: 'Moss', paper: 'leafD', edge: 'stem', tissue: 'cream', ribbon: 'blush', tex: 5, dot: '#5f8f5f' },
  ];

  // ── Leaves: a pointed blade with a midrib ──
  function leaf(cl, p0, d, side, len, w, col, o = {}) {
    const fn = norm(cross(d, side));
    const W = (t, s) => {
      const pr = Math.pow(Math.sin(Math.PI * clamp(t, 0, 1)), 0.8) * (1 - 0.25 * t);
      return add(add(add(p0, mul(d, t * len)), mul(side, s * w * pr)), add(mul(fn, 0.25 * s * s * w * pr), [0, -(o.droop ?? 0.06) * t * t, 0]));
    };
    surface(W, Math.ceil(len / STEP), Math.max(2, Math.ceil((2 * w) / STEP)), (t, s, p, n, i, j) => {
      const mid = Math.abs(s) < 0.15, edge = Math.abs(s) > 0.82;
      const tg = norm(sub(W(t + 0.01, 0), W(t - 0.01, 0)));
      cl.add(p, n, mid ? 'stemD' : col, mid ? LINE : edge ? K[':'] : (i + j) % 2 ? K['%'] : K['&'], { ...o, t: tg, ao: (o.ao ?? 1) * (0.6 + 0.4 * t) });
    }, fn);
  }

  // ── The wrap: folded sheets of paper round the back and sides (the front stays open),
  //    a tissue layer peeking between them, a ribbon with a bow, a gathered skirt below ──
  const R0 = 0.07;                                      // the waist, where everything is gathered at the ribbon
  const FRONT = Math.PI / 2;                            // +z: where the bow sits and the bouquet opens
  // One sheet: a square of paper folded so a corner points up. c centre azimuth, span half-width (radians),
  // h height of the corner, R radius at the top, lay a small outward offset so layers nest.
  function sheet(cl, o) {
    const W = (t, s) => {
      const top = o.h * (1 - 0.38 * Math.pow(Math.abs(s), 1.25));                  // a peak at the corner, lower at the sides
      const y = t * top, q = y / o.h;
      const ph = o.c + s * o.span * (0.3 + 0.7 * Math.sqrt(Math.max(0, q)));        // gathered at the waist, opening upward
      const r = (R0 + o.lay + (o.R - R0) * Math.max(0, q) + 0.06 * q * q * q)                    // a straight cone; the corner curls outward
        * (1 + 0.025 * Math.sin(9 * s + 5 * t + o.seed));                            // a little crumple
      return [r * Math.cos(ph), y, r * Math.sin(ph)];
    };
    const nt = Math.ceil(o.h / STEP) + 4, ns = Math.ceil((2 * o.span * o.R) / STEP) + 4;
    surface(W, nt, ns, (t, s, p, n) => {
      const g = o.g, ao = (0.55 + 0.45 * t) * (o.ao || 1);
      if (Math.abs(s) > 0.95 || t > 0.97) {             // the sheet's edges, drawn as lines
        const tg = Math.abs(s) > 0.95 && t <= 0.97 ? norm(sub(W(t + 0.01, s), W(t - 0.01, s))) : norm(sub(W(t, s + 0.01), W(t, s - 0.01)));
        cl.add(p, n, o.edge, LINE, { t: tg, ao: Math.min(1, ao * 1.6), g });
      } else if (Math.abs(s) < 0.035 && t > 0.15) {      // the fold, from the waist up to the corner
        cl.add(p, n, o.edge, LINE, { t: norm(sub(W(t + 0.01, s), W(t - 0.01, s))), ao: ao * 1.1, g });
      } else cl.add(p, n, o.col, RAMP - o.tex, { ao, g });
    }, [0, 1, 0]);
  }
  // fit: { h, tan } — how tall the paper stands and how fast it flares, measured from the flowers it holds
  function wrapping(cl, Wp, rnd, fit = { h: 0.9, tan: 0.8 }) {
    const R = (h) => R0 + h * fit.tan;                  // the cone's radius at a given height
    // the tissue: one wide, taller sheet behind, peeking above and between the paper
    const ht = fit.h * 1.12;
    sheet(cl, { c: FRONT + Math.PI, span: 2.05, h: ht + rnd() * 0.04, R: R(ht) * 0.93, lay: -0.012, col: Wp.tissue, edge: Wp.tissue, tex: 6, ao: 0.8, seed: rnd() * 9, g: -9 });
    // the paper: three sheets round the back and sides, each corner at its own height
    [[-1.45, 0.88], [0, 1], [1.45, 0.88]].forEach(([dc, f], k) => {
      const h = fit.h * f * (1 + (rnd() - 0.5) * 0.06);
      sheet(cl, { c: FRONT + Math.PI + dc + (rnd() - 0.5) * 0.12, span: 0.98, h, R: R(h) + 0.012 * k, lay: k === 1 ? 0.004 : 0.01,
        col: Wp.paper, edge: Wp.edge, tex: Wp.tex, seed: rnd() * 9, g: -10 - k });
    });
    // the skirt: paper gathered under the ribbon, flaring a little
    const pleat = (th) => 1 + 0.06 * Math.sin(9 * th + 1.3);
    surface((t, s) => { const th = (s + 1) * Math.PI, y = -0.18 * t, r = (R0 + 0.055 * Math.pow(Math.max(0, t), 1.3)) * pleat(th); return [r * Math.cos(th), y, r * Math.sin(th)]; },
      Math.ceil(0.18 / STEP) + 2, Math.ceil((TAU * 0.12) / STEP), (t, s, p, n) => {
        const th = (s + 1) * Math.PI;
        if (t > 0.94) cl.add(p, n, Wp.edge, K['~'], { ao: 0.7, g: -13 });
        else if (Math.sin(9 * th + 1.3) > 0.9) cl.add(p, n, Wp.edge, LINE, { t: [0, 1, 0], ao: 0.6, g: -13 });
        else cl.add(p, n, Wp.paper, RAMP - Wp.tex, { ao: 0.4 + 0.2 * t, g: -13 });
      }, [0, -1, 0]);
    // the ribbon: a wide band round the waist, lit like satin
    surface((t, s) => { const th = (s + 1) * Math.PI, y = -0.03 + 0.07 * t, r = R0 + 0.014 + 0.012 * (y / 0.07); return [r * Math.cos(th), y, r * Math.sin(th)]; },
      7, Math.ceil((TAU * 0.1) / STEP), (t, s, p, n) => cl.add(p, n, Wp.ribbon, t < 0.12 || t > 0.88 ? K['-'] : K['='], { ao: 0.75 + 0.25 * Math.sin(t * Math.PI), g: -14 }), [0, 0, 1]);
    // the bow: two wide loops and two long tails that curl
    const Pb = [0, 0.005, R0 + 0.035], T = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
    for (const side of [-1, 1]) {
      for (const dy of [-0.008, 0, 0.008]) for (const dz of [-0.006, 0.006]) {
        curve(cl, (a) => { a *= TAU; return add(Pb, add(add(mul(T, side * 0.085 * (1 - Math.cos(a))), mul(Y, 0.05 * Math.sin(a) + dy)), mul(Z, 0.018 * Math.sin(a / 2) + dz))); }, 0.4, Wp.ribbon, { g: -14 });
      }
      for (const dx of [-0.006, 0.006]) {
        curve(cl, (t) => add(Pb, add(add(mul(T, side * (0.02 + 0.07 * t) + dx), mul(Y, -0.27 * t)), mul(Z, 0.015 + 0.035 * Math.sin(t * 5 + side)))), 0.3, Wp.ribbon, { g: -14 });
      }
    }
    dome(cl, frame(Pb, Z), 0.02, 0.016, Wp.ribbon, Wp.ribbon, 'eye', { g: -14 });
  }

  // ── A whole bouquet: heads on a dome, stems gathered at the ribbon, leaves round the rim ──
  function build(ids, wrapIdx, seed) {
    const rnd = seeded('3d' + seed), cl = new Cloud(), Wp = WRAPS[wrapIdx] || WRAPS[0];
    const n = ids.length;
    if (!n) { wrapping(cl, Wp, seeded('wrap' + seed)); return { cl, target: [0, 0.15, 0] }; }
    const items = ids.map((id) => ({ sp: SPECIES[id], k: rnd() })).sort((a, b) => (b.sp.size - a.sp.size) || (a.k - b.k));
    const main = items.filter((it) => !it.sp.filler), fill = items.filter((it) => it.sp.filler);
    const Fp = [0, 0, 0], UP = [0, 1, 0], rot = rnd() * TAU, CAPMAX = 0.8;   // stems fan out from the tie, no wider than a hand holds them
    let hk = 1.7 + (12 - Math.max(1, main.length)) * 0.055;   // fewer flowers: bigger heads, so the paper doesn't dominate
    const Rd = 0.98 + (hk - 1.7) * 0.3;                        // the dome the heads sit on: the stems' length from the tie
    // too many big heads for the dome? shrink them all a little (12 sunflowers still fit)
    const need = main.reduce((a, it) => a + Math.PI * ((it.sp.size * hk) / Rd) ** 2, 0), room = 0.82 * TAU * (1 - Math.cos(CAPMAX));
    if (need > room) hk *= Math.sqrt(room / need);
    const ang = (it) => (it.sp.size * hk * 0.95) / Rd;          // a head's footprint on the dome, as an angle
    const angle = (a, b) => Math.acos(clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1));
    const onDome = (th, ph) => [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
    // start: a golden-angle spiral from the top, big heads first
    const cap0 = main.length <= 1 ? 0 : Math.min(0.7, 0.18 + 0.05 * main.length);
    const P = main.map((it, i) => ({ it, v: main.length === 1 ? [0, 1, 0] : onDome(Math.acos(1 - (1 - Math.cos(cap0)) * ((i + 0.5) / main.length)), rot + i * 2.39996 + rnd() * 0.4) }));
    // settle: heads that overlap push apart along the dome; a gentle pull keeps the dome compact
    for (let iter = 0; iter < 60; iter++) {
      for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
        const a = P[i], b = P[j], want = (ang(a.it) + ang(b.it)) * 0.88, d = angle(a.v, b.v);   // 0.88: let petals tuck a little
        if (d >= want) continue;
        let t = sub(a.v, b.v);
        if (Math.hypot(...t) < 1e-6) t = [rnd() - 0.5, 0, rnd() - 0.5];
        const push = (want - d) * 0.5;
        a.v = norm(add(a.v, mul(norm(t), push))); b.v = norm(sub(b.v, mul(norm(t), push)));
      }
      for (const q of P) {
        q.v = norm(add(q.v, mul(UP, 0.01)));
        const th = angle(q.v, UP);
        if (th > CAPMAX) q.v = onDome(CAPMAX, Math.atan2(q.v[2], q.v[0]));
      }
    }
    // fillers go into the biggest gaps between the heads, a little behind them
    const cand = Array.from({ length: 240 }, (_, k) => onDome(Math.acos(1 - (1 - Math.cos(CAPMAX + 0.1)) * ((k + 0.5) / 240)), k * 2.39996 + rot));
    const placed = P.map((q) => ({ v: q.v, a: ang(q.it) }));
    for (const it of fill) {
      let best = cand[0], bs = -Infinity;
      const reach = placed.reduce((r, q) => Math.max(r, angle(q.v, UP)), 0.15) + 0.1;   // stay inside the cluster
      const need = ang(it) * 1.2;
      for (const v of cand) {
        if (angle(v, UP) > reach) continue;
        let clear = Infinity;
        for (const q of placed) clear = Math.min(clear, angle(v, q.v) - q.a);
        const sc = Math.min(clear, need) - angle(v, UP) * 0.25;   // any gap big enough will do; prefer one nearer the top
        if (sc > bs) { bs = sc; best = v; }
      }
      placed.push({ v: best, a: ang(it) * 1.4 });
      P.push({ it, v: best, filler: true });
    }
    for (const [i, q] of P.entries()) q.c = add(Fp, mul(q.v, Rd + (q.filler ? -0.06 : (i % 2 ? -0.04 : 0.02)) + (rnd() - 0.5) * 0.03 + (q.it.sp.lift || 0)));
    // the paper: tall enough that only the crown of the bouquet rises above it, flared just enough
    // that every head's back half sits inside it, as florists wrap around what they've gathered
    let top = 0, tan = 0.35;
    for (const q of P) {
      const hr = q.it.sp.size * hk, y = Math.max(0.2, q.c[1]), rho = Math.hypot(q.c[0], q.c[2]);
      top = Math.max(top, q.c[1]);
      tan = Math.max(tan, (rho + 0.6 * hr - R0) / y);
    }
    const fit = { h: clamp(top * 0.8, 0.45, 1.5), tan: Math.min(tan, 1.3) };
    wrapping(cl, Wp, seeded('wrap' + seed), fit);
    const m = 3 + Math.ceil(n / 3);
    // greenery round the mouth of the paper, behind the heads
    for (let k = 0; k < m; k++) {
      const th = (k / m) * TAU + rnd() * 0.3, gy = fit.h * 0.6, gr = (R0 + gy * fit.tan) * 0.7, base = [Math.cos(th) * gr, gy, Math.sin(th) * gr];
      const d = norm([Math.cos(th) * 0.85, 0.45 + rnd() * 0.3, Math.sin(th) * 0.85]);
      leaf(cl, base, d, norm(cross(d, [0, 1, 0])), 0.16 + rnd() * 0.07, 0.04, k % 2 ? 'leaf' : 'leafD', { droop: 0.08, sw: 0.6, ph: k, g: GREEN, ao: 0.6 });
    }
    P.forEach(({ it, v: dv, c }, i) => {
      const ph = Math.atan2(dv[2], dv[0]);
      const F = frame(c, add(dv, [0, 0.2, 0.45]), hk), o = { g: cl.groups.length, sw: 1, ph: i * 1.7 };
      cl.groups.push(c);
      // the stem: straight from the cut end to the ribbon, then a soft curve up to the head
      const bind = [Math.cos(ph) * 0.03, 0, Math.sin(ph) * 0.03], foot = [Math.cos(ph) * 0.05, -0.4 - rnd() * 0.04, Math.sin(ph) * 0.05];
      const base = sub(c, mul(F.d, 0.02)), ctrl = [bind[0] + (base[0] - bind[0]) * 0.15, bind[1] + (base[1] - bind[1]) * 0.75, bind[2] + (base[2] - bind[2]) * 0.15];
      const B = (t) => add(add(mul(bind, (1 - t) * (1 - t)), mul(ctrl, 2 * (1 - t) * t)), mul(base, t * t));
      curve(cl, (t) => add(mul(foot, 1 - t), mul(bind, t)), 0.45, 'stem', { ao: 0.8, g: GREEN });
      curve(cl, B, Math.hypot(...sub(base, bind)) * 1.1, 'stem', { sw: (t) => t, ph: o.ph, g: GREEN, ao: 0.85 });
      if (!it.sp.filler && rnd() < 0.75) {
        const t = 0.5 + rnd() * 0.15, p = B(t), tg = norm(sub(B(t + 0.01), B(t - 0.01))), out = norm([p[0], 0, p[2]].map((v, q) => v + (q === 1 ? 0 : 1e-3)));
        const side = norm(cross(tg, out)), d = norm(add(mul(out, 0.8), mul(tg, 0.6)));
        leaf(cl, p, d, side, 0.12, 0.03, 'leaf', { droop: 0.05, sw: t, ph: o.ph, g: GREEN, ao: 0.8 });
      }
      it.sp.build(cl, F, rnd, o);
    });
    return { cl, target: [0, 0.45, 0] };
  }
  // One flower on its own, turned three-quarters toward the camera (the counter's thumbnails)
  function single(id) {
    const cl = new Cloud(), sp = SPECIES[id], k = 0.3 / sp.size, F = frame([0, 0, 0], [0, 0.75, 0.66], k);
    sp.build(cl, F, seeded('one' + id), {});
    return { cl, target: sp.build === lavender ? [0, 0.1 * k, 0.09 * k] : [0, 0, 0] };
  }

  // ════ The renderer ════
  class Renderer {
    constructor(canvas, o = {}) {
      this.c = canvas; this.ctx = canvas.getContext('2d');
      this.o = Object.assign({ thumb: false, yaw: 0.55, pitch: 0.45 }, o);
      this.yaw = this.o.yaw; this.pitch = this.o.pitch; this.t = 0; this.last = 0; this.idle = 9; this.grow = 1;
      this.bits = Uint8Array.from({ length: 8192 }, () => (Math.random() < 0.5 ? 1 : 0));
      this.buckets = PAL.map(() => []); this.visible = true; this.dirty = true;
      this.resize();
      if (document.fonts) document.fonts.ready.then(() => { this.resize(); this.draw(this.t); });
      if (this.o.thumb) return;
      new ResizeObserver(() => { this.resize(); this.draw(this.t); }).observe(canvas);
      new IntersectionObserver((es) => { this.visible = es[0].isIntersecting; }).observe(canvas);
      this.bindInput();
      const loop = (now) => {
        if (this.dead) return;
        requestAnimationFrame(loop);
        if (!this.visible || document.hidden || now - this.last < 33) return;
        const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
        if (REDUCED && !this.dirty) return;
        this.step(dt); this.draw(this.t); this.dirty = false;
      };
      setTimeout(() => { this.started = true; requestAnimationFrame(loop); }, this.o.delay || 0);   // a still frame first, so the page's own intro plays smoothly
    }
    destroy() { this.dead = true; }
    setScene(sc, animate) {
      this.pts = Float32Array.from(sc.cl.d); this.n = sc.cl.d.length / STRIDE;
      this.groups = Float32Array.from(sc.cl.groups.flat()); this.target = sc.target; this.hasFlowers = sc.cl.groups.length > 0;
      // the bouquet's real extent: how far it reaches out from the axis, and from top to bottom
      let fit = 0, rx = 0, y0 = Infinity, y1 = -Infinity;
      for (let o = 0; o < this.pts.length; o += STRIDE) {
        const x = this.pts[o] - sc.target[0], y = this.pts[o + 1], z = this.pts[o + 2] - sc.target[2];
        fit = Math.max(fit, Math.hypot(x, y - sc.target[1], z)); rx = Math.max(rx, Math.hypot(x, z)); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      this.fit = fit * 0.93;
      if (!this.o.thumb) { this.target = [sc.target[0], (y0 + y1) / 2, sc.target[2]]; this.zoom = 1; this.pan = [0, 0]; this.settle = 3; }
      // grow the heads in only once the loop is running; before that the still frame must show them at full size
      if (animate && !REDUCED && this.started) this.grow = 0;
      this.dirty = true; this.draw(this.t);
    }
    resize() {
      const r = this.c.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
      if (!r.width || !r.height) return;
      this.W = r.width; this.H = r.height;
      this.c.width = Math.round(r.width * d); this.c.height = Math.round(r.height * d);
      this.ctx.setTransform(d, 0, 0, d, 0, 0);
      this.fs = this.o.thumb ? clamp(r.width / 30 / 0.6, 3.2, this.o.maxFs || 6) : clamp(r.width / 112 / 0.6, 6, 10.5);
      this.cw = this.fs * 0.6; this.chH = this.fs * 1.12;
      this.COLS = Math.floor(r.width / this.cw); this.ROWS = Math.floor(r.height / this.chH);
      const N = this.COLS * this.ROWS;
      this.zb = new Float32Array(N); this.gl = new Int8Array(N); this.co = new Int16Array(N); this.cg = new Int16Array(N); this.gap = new Uint8Array(N);
      if (this.pan) { this.pan = [0, 0]; this.settle = 3; }
      this.ctx.font = `500 ${this.fs}px "JetBrains Mono", ui-monospace, monospace`; this.ctx.textBaseline = 'top';
      this.dirty = true;
    }
    bindInput() {
      const c = this.c;
      let drag = null;
      c.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; c.setPointerCapture(e.pointerId); this.idle = 0; c.classList.add('is-drag'); });
      c.addEventListener('pointermove', (e) => {
        if (!drag) return;
        this.yaw -= (e.clientX - drag.x) * 0.009;
        this.pitch = clamp(this.pitch + (e.clientY - drag.y) * 0.006, -0.15, 1.2);
        drag = { x: e.clientX, y: e.clientY }; this.idle = 0; this.dirty = true;
      });
      const end = () => { drag = null; c.classList.remove('is-drag'); };
      c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
      this.dragging = () => !!drag;
    }
    step(dt) {
      this.t += dt; this.idle += dt;
      if (!REDUCED) {
        for (let i = 0; i < 160; i++) this.bits[(Math.random() * 8192) | 0] ^= 1;
        if (!this.dragging() && this.idle > 2.5) {
          const off = Math.abs(Math.atan2(Math.sin(this.yaw), Math.cos(this.yaw)));   // 0 when the bow faces the viewer
          this.yaw += dt * 0.14 * (0.2 + 0.8 * Math.min(1, off / 0.9));
        }
      }
      if (this.grow < 1) this.grow = Math.min(1, this.grow + dt * 2.4);
    }
    draw(t) {
      if (!this.pts || !this.COLS) return;
      const { COLS, ROWS, zb, gl, co, cw, chH } = this, ctx = this.ctx;
      zb.fill(0);
      const tg = this.target, fit = this.fit, dist = fit * 3.4, cp = Math.cos(this.pitch);
      const cam = [tg[0] + dist * Math.sin(this.yaw) * cp, tg[1] + dist * Math.sin(this.pitch), tg[2] + dist * Math.cos(this.yaw) * cp];
      const f = norm(sub(tg, cam)), r = norm([-f[2], 0, f[0]]), u = cross(r, f);
      const FOC = 0.46 * Math.min(this.W, this.H) * 3.05 * (this.zoom || 1);   // the fit sphere fills ~46% of the shorter side, then auto-zoom
      const pan = this.pan || [0, 0], cwI = FOC / cw, chI = FOC / chH, hc = COLS / 2 + pan[0], hr = ROWS / 2 + pan[1], asp = chH / cw;
      const L = norm([-f[0] * 0.75 + u[0] * 0.55 + r[0] * 0.35, -f[1] * 0.75 + u[1] * 0.55 + r[1] * 0.35, -f[2] * 0.75 + u[2] * 0.55 + r[2] * 0.35]);   // from over the viewer's right shoulder
      const cg = this.cg;
      const P = this.pts, G = this.groups, bits = this.bits, anim = !REDUCED && !this.o.thumb;
      const gs = this.grow < 1 ? 1 - Math.pow(1 - this.grow, 3) : 1, gk = 0.35 + 0.65 * gs;
      const near = dist - fit;
      const put = (x, y, z, nx, ny, nz, col, ch, tx, ty, tz, ao, k, g = -1) => {
        const dx = x - cam[0], dy = y - cam[1], dz = z - cam[2];
        const zc = dx * f[0] + dy * f[1] + dz * f[2];
        if (zc < 0.05) return;
        const sx = Math.floor(hc + ((dx * r[0] + dy * r[1] + dz * r[2]) / zc) * cwI);
        const sy = Math.floor(hr - ((dx * u[0] + dy * u[1] + dz * u[2]) / zc) * chI);
        if (sx < 0 || sy < 0 || sx >= COLS || sy >= ROWS) return;
        const i = sy * COLS + sx, iz = 1 / (g === GREEN ? zc + 0.035 : zc);   // greenery yields to petals it overlaps
        if (iz <= zb[i]) return;
        zb[i] = iz; cg[i] = g;
        const fog = clamp(1.12 - ((zc - near) / (2 * fit)) * 0.55, 0.5, 1);
        const lum = (0.14 + 0.62 * Math.abs(nx * L[0] + ny * L[1] + nz * L[2]) + 0.3 * Math.abs(nx * f[0] + ny * f[1] + nz * f[2])) * ao * fog;
        if (ch === BIT) {
          let q = 0;
          while (q < 4 && lum >= PETAL_AT[q]) q++;
          ch = q < 4 ? PETALK[Math.max(0, q - 1)] : bits[k & 8191] ? K['1'] : K['0'];
        }
        else if (ch === LINE) {
          const ax = tx * r[0] + ty * r[1] + tz * r[2], ay = -(tx * u[0] + ty * u[1] + tz * u[2]) / asp;
          const aax = Math.abs(ax), aay = Math.abs(ay);
          ch = aay > aax * 2.2 ? K['|'] : aax > aay * 2.2 ? K['-'] : ax * ay < 0 ? K['/'] : K['\\'];
        } else if (ch <= RAMP) { const R = RAMPS[RAMP - ch]; ch = R[Math.min(R.length - 1, (lum * R.length * 1.05) | 0)]; }
        gl[i] = ch;
        co[i] = col * NL + clamp(((lum * NL * 1.35) - 0.15) | 0, 0, NL - 1);
      };
      for (let k = 0, o = 0; k < this.n; k++, o += STRIDE) {
        let x = P[o], y = P[o + 1], z = P[o + 2];
        const g = P[o + 14];
        if (g >= 0 && gk < 1) { const q = g * 3; x = G[q] + (x - G[q]) * gk; y = G[q + 1] + (y - G[q + 1]) * gk; z = G[q + 2] + (z - G[q + 2]) * gk; }
        const sw = P[o + 12];
        if (sw && anim) { const ph = P[o + 13]; x += Math.sin(t * 1.1 + ph) * 0.009 * sw; z += Math.cos(t * 0.8 + ph * 1.3) * 0.007 * sw; }
        put(x, y, z, P[o + 3], P[o + 4], P[o + 5], P[o + 6], P[o + 7], P[o + 8], P[o + 9], P[o + 10], P[o + 11], k, g);
      }
      // auto-frame (before the pollen, which drifts wide): measure what was drawn and ease zoom and centring toward filling ~88% of the frame
      if (!this.o.thumb && this.n) {
        let x0 = COLS, x1 = -1, y0 = ROWS, y1 = -1;
        for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (zb[y * COLS + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        if (x1 >= 0) {
          const want = Math.min((0.88 * COLS) / (x1 - x0 + 1), (0.88 * ROWS) / (y1 - y0 + 1));
          const k = this.settle > 0 ? 1 : 0.04;
          this.zoom = clamp(this.zoom * (1 + (want - 1) * k), 0.3, 4);
          this.pan[0] += (COLS / 2 - (x0 + x1 + 1) / 2) * k; this.pan[1] += (ROWS / 2 - (y0 + y1 + 1) / 2) * k;
          if (this.settle > 0) { this.settle--; return this.draw(t); }   // a couple of passes so the first frame is already framed
        }
      }
      // pollen drifting round the heads, and a firefly
      if (this.hasFlowers && !this.o.thumb) {
        for (let m = 0; m < 9; m++) {
          const a = t * (0.12 + m * 0.013) + m * 1.9, rr = 0.55 + 0.35 * Math.sin(m * 3.1), y = 0.55 + 0.45 * Math.sin(t * 0.21 + m * 2.3);
          const fly = m === 0, blink = !fly || Math.sin(t * 2.1) > -0.2;
          if (blink) put(Math.cos(a) * rr, y, Math.sin(a) * rr, 0, 1, 0, CI[fly ? 'fly' : 'pollen'], fly ? K['*'] : K['·'], 0, 0, 0, fly ? 1.3 : 1, 0);
        }
      }
      // fill pinholes: an empty cell between two cells of the same thing at about the same depth takes its neighbour's glyph
      for (let pass = 0; pass < 2; pass++) for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) {
        const i = y * COLS + x;
        if (zb[i]) continue;
        for (const [a, b] of [[i - 1, i + 1], [i - COLS, i + COLS]]) {
          if (zb[a] && zb[b] && cg[a] === cg[b] && Math.abs(1 / zb[a] - 1 / zb[b]) < 0.03) {
            zb[i] = Math.min(zb[a], zb[b]); cg[i] = cg[a]; co[i] = co[a]; gl[i] = LINEK.has(gl[a]) ? gl[b] : gl[a];   // don't stretch outlines into the fill
            break;
          }
        }
      }
      // silhouettes: where neighbouring cells belong to different things (or jump in depth), blank the farther one
      const gap = this.gap;
      gap.fill(0);
      if (!this.o.thumb) {
        const sep = (a, b) => {
          if (!zb[a] || !zb[b]) return;
          const da = 1 / zb[a], db = 1 / zb[b], d = db - da;
          if (Math.abs(d) < 0.02) return;
          const other = cg[a] !== cg[b];
          if (!(other || Math.abs(d) > 0.14) || (cg[a] === GREEN && cg[b] === GREEN)) return;
          gap[d > 0 ? b : a] = 1;
        };
        for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
          const i = y * COLS + x;
          if (x + 1 < COLS) sep(i, i + 1);
          if (y + 1 < ROWS) sep(i, i + COLS);
        }
      }
      // paint: one fill colour at a time
      const W = this.W, H = this.H, ox = (W - COLS * cw) / 2, oy = (H - ROWS * chH) / 2, B = this.buckets;
      ctx.clearRect(0, 0, W, H);
      for (const b of B) b.length = 0;
      const sp = K[' '];
      for (let i = 0, N = COLS * ROWS; i < N; i++) if (zb[i] > 0 && gl[i] !== sp && !gap[i]) B[co[i]].push(i);
      for (let c = 0; c < B.length; c++) {
        const b = B[c];
        if (!b.length) continue;
        ctx.fillStyle = PAL[c];
        for (let j = 0; j < b.length; j++) { const i = b[j]; ctx.fillText(CH[gl[i]], ox + (i % COLS) * cw, oy + ((i / COLS) | 0) * chH); }
      }
    }
  }

  window.B3D = { SPECIES, WRAPS, build, single, Renderer };
})();
