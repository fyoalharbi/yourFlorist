// A small animated-GIF encoder: one shared palette, LZW, and frames that may cover only part of
// the picture (the rest is left as the frame before drew it). No dependencies.
//    const blob = GIF.encode(W, H, [{ x, y, w, h, data }], delayInHundredths)
// The first frame must cover the whole W×H; `data` is RGBA, as from getImageData.
(function () {
  const bin = (d, i) => ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3);

  // the 256 most common colours, each the average of what fell into its 5-bit-a-channel bin
  function palette(frames) {
    const n = new Uint32Array(32768), s = new Float64Array(32768 * 3);
    for (const f of frames) for (let i = 0, d = f.data; i < d.length; i += 12) { const b = bin(d, i); n[b]++; s[b * 3] += d[i]; s[b * 3 + 1] += d[i + 1]; s[b * 3 + 2] += d[i + 2]; }
    const top = [...n.keys()].filter((b) => n[b]).sort((a, b) => n[b] - n[a]).slice(0, 256);
    const pal = new Uint8Array(768);
    top.forEach((b, j) => { for (let c = 0; c < 3; c++) pal[j * 3 + c] = Math.round(s[b * 3 + c] / n[b]); });
    // every bin maps to its nearest palette colour, worked out the first time it's seen
    const lut = new Int16Array(32768).fill(-1);
    const near = (b) => {
      const r = ((b >> 10) << 3) + 4, g = (((b >> 5) & 31) << 3) + 4, bl = ((b & 31) << 3) + 4;
      let best = 0, bd = Infinity;
      for (let j = 0; j < top.length; j++) { const dr = pal[j * 3] - r, dg = pal[j * 3 + 1] - g, db = pal[j * 3 + 2] - bl, dd = dr * dr * 2 + dg * dg * 3 + db * db; if (dd < bd) { bd = dd; best = j; } }
      return (lut[b] = best);
    };
    return { pal, index: (d, i) => { const b = bin(d, i); return lut[b] >= 0 ? lut[b] : near(b); } };
  }

  // LZW with 8-bit codes, packed into 255-byte sub-blocks
  const table = new Int16Array(4096 * 256);
  function lzw(px, out) {
    const MIN = 8, CLEAR = 256, EOI = 257, buf = new Uint8Array(px.length * 2 + 16);
    let size = MIN + 1, next = EOI + 1, cur = 0, bits = 0, p = 0;
    const emit = (c) => { cur |= c << bits; bits += size; while (bits >= 8) { buf[p++] = cur & 255; cur >>>= 8; bits -= 8; } };
    table.fill(-1); emit(CLEAR);
    let prefix = px[0];
    for (let i = 1; i < px.length; i++) {
      const k = px[i], key = prefix * 256 + k, v = table[key];
      if (v >= 0) { prefix = v; continue; }
      emit(prefix);
      if (next === 4096) { emit(CLEAR); table.fill(-1); size = MIN + 1; next = EOI + 1; }
      else { if (next >= 1 << size) size++; table[key] = next++; }
      prefix = k;
    }
    emit(prefix); emit(EOI);
    if (bits) buf[p++] = cur & 255;
    out.push(MIN);
    for (let i = 0; i < p; i += 255) { const m = Math.min(255, p - i); out.push(m); for (let j = 0; j < m; j++) out.push(buf[i + j]); }
    out.push(0);
  }

  function encode(W, H, frames, delay) {
    const { pal, index } = palette(frames), parts = [];
    const u16 = (v) => [v & 255, v >> 8];
    parts.push(new Uint8Array([
      ...'GIF89a'.split('').map((c) => c.charCodeAt(0)), ...u16(W), ...u16(H), 0xf7, 0, 0, ...pal,
      0x21, 0xff, 11, ...'NETSCAPE2.0'.split('').map((c) => c.charCodeAt(0)), 3, 1, 0, 0, 0,   // loop forever
    ]));
    for (const f of frames) {
      const px = new Uint8Array(f.w * f.h);
      for (let i = 0; i < px.length; i++) px[i] = index(f.data, i * 4);
      const out = [0x21, 0xf9, 4, 1 << 2, ...u16(delay), 0, 0, 0x2c, ...u16(f.x), ...u16(f.y), ...u16(f.w), ...u16(f.h), 0];
      lzw(px, out);
      parts.push(Uint8Array.from(out));
    }
    parts.push(new Uint8Array([0x3b]));
    return new Blob(parts, { type: 'image/gif' });
  }

  window.GIF = { encode };
})();
