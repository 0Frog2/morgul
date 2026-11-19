// Map maker: generate a world or region map (land, sea, mountains, hills, forests, rivers, regions, labels), paint it by hand,
// and save it as a Map entry. The recipe (seed, sliders, brush strokes, stamps, labels) is kept on the entry, so it can be reopened and changed.
"use strict";

const MK = {
  W: 1600, H: 1100, S: 4,                        // image size; one height cell = S×S pixels
  defaults: () => ({ seed: Math.floor(Math.random() * 1e9), shape: "continent", land: 42, rough: 50, mountains: 45, forests: 45, rivers: 7, regions: 6,
    style: "parchment", regionTint: true, borders: true, compass: true, grid: false, strokes: [], stamps: [], labels: [] }),
  rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; },
  noise(seed) {
    const hash = (x, y) => { let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const sm = t => t * t * (3 - 2 * t);
    const v = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
      const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1); return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf; };
    return (x, y, oct = 5, pers = .5) => { let s = 0, amp = 1, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += v(x * f + i * 17.3, y * f - i * 9.1) * amp; n += amp; amp *= pers; f *= 2; } return s / n; };
  },
  styles: {
    parchment: { paper: "#E6D9BC", sea: "#D3CDB4", deep: "#C2BEA6", land: ["#E9DDBF", "#DCCBA3", "#CDB98F", "#BFA97E"], ink: "#3B2F22", forest: "#9AA27A", river: "#5C6E78", region: ["#C9A27A", "#9DAF8A", "#A9A2C4", "#C48B8B", "#8FB3B8", "#C9B86F", "#B39177", "#8E9EC0"], label: "#2B2118", snow: "#F2EAD6" },
    atlas: { paper: "#F3EEDF", sea: "#7FA7C2", deep: "#3E6C8E", land: ["#9DBB7E", "#7F9F62", "#A99569", "#9B9488"], ink: "#33302A", forest: "#4E7A45", river: "#3E6C8E", region: ["#E2B27A", "#9CCB86", "#B7A6E0", "#E59A9A", "#86C3CB", "#E6D27A", "#C9A386", "#97A9DE"], label: "#1F1D18", snow: "#F4F4F0" },
    morgul: { paper: "#070D0B", sea: "#0C1A18", deep: "#06100F", land: ["#18241D", "#1F2E25", "#283A2F", "#33473A"], ink: "#8EB69B", forest: "#2E4A37", river: "#2F5F59", region: ["#8EB69B", "#C9A26A", "#8A7FB8", "#B86A6A", "#6AA3AD", "#B8B06A", "#A3866A", "#6A80B8"], label: "#DDE8E0", snow: "#A9BFB2" },
  },
  shapes: { continent: ["One continent", "Един континент"], islands: ["A few islands", "Няколко острова"], archipelago: ["Archipelago", "Архипелаг"], coast: ["Coast (sea on one side)", "Бряг (море от едната страна)"], inland: ["All land (a region)", "Само суша (област)"], lakes: ["Land with lakes", "Суша с езера"], blank: ["Empty sea (draw it yourself)", "Празно море (рисувате сами)"] },

  // ---------------------------------------------------------------- the height map
  _cache: null,
  base(o) {
    const key = [o.seed, o.shape, o.land, o.rough, o.trace?.id || ""].join("|");
    if (this._cache?.key === key) return this._cache;
    if (o.trace) return this._cache = { key, ...this.traceBase(o) };
    if (o.shape === "blank") {          // nothing but sea: you paint the land (over a reference picture, for instance)
      const GW = this.W / this.S, GH = this.H / this.S, n = this.noise(o.seed), h = new Float32Array(GW * GH);
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) h[y * GW + x] = .3 + n(x / GW * 5, y / GH * 5, 4) * .06;
      return this._cache = { key, GW, GH, h, sea: .5, top: 1.1 };
    }
    const GW = this.W / this.S, GH = this.H / this.S, n = this.noise(o.seed), r = this.rng(o.seed + 7);
    const h = new Float32Array(GW * GH), freq = 2.2 + o.rough / 100 * 5, oct = 4 + Math.round(o.rough / 34);
    const side = Math.floor(r() * 4), cx = .5 + (r() - .5) * .12, cy = .5 + (r() - .5) * .12;
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const nx = x / GW, ny = y / GH, dx = (nx - cx) / .5, dy = (ny - cy) / .5 * (GH / GW) * 1.35, d = Math.sqrt(dx * dx + dy * dy);
      let e = n(nx * freq * 1.45, ny * freq, oct);
      switch (o.shape) {
        case "continent": e = e * .62 + (1 - d) * .5; break;
        case "islands": e = n(nx * freq * 2.2, ny * freq * 1.5, oct) * .75 + (1 - d) * .32; break;
        case "archipelago": e = n(nx * freq * 3.4, ny * freq * 2.4, oct) * .9 + (1 - d) * .12; break;
        case "coast": { const t = [nx, 1 - nx, ny, 1 - ny][side]; e = e * .6 + (1 - t) * .55; break; }
        case "lakes": e = e * .7 + .3 + (n(nx * 9 + 40, ny * 6 + 40, 3) < .3 ? -.25 : 0); break;
        default: e = e * .7 + .3;
      }
      h[y * GW + x] = e;
    }
    // sea level from the land amount (inland maps keep only a few lakes)
    const sorted = Float32Array.from(h).sort(), land = o.shape === "inland" ? 97 : o.shape === "lakes" ? Math.max(75, o.land) : o.land;
    const sea = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * (1 - land / 100)))];
    const top = sorted[sorted.length - 1];
    return this._cache = { key, GW, GH, h, sea, top };
  },
  // a traced map: sea/land/forest/mountain cells -> heights by distance to the coast, so the coastline follows the picture
  traceBase(o) {
    const GW = this.W / this.S, GH = this.H / this.S, cls = Trace.decode(o.trace.cells, GW * GH), n = this.noise(o.seed);
    const dist = land => {            // cells to the nearest cell of the other kind (chamfer distance)
      const d = new Float32Array(GW * GH).fill(1e9);
      for (let i = 0; i < d.length; i++) if ((cls[i] > 0) !== land) d[i] = 0;
      const pass = (x, y, dx, dy, w) => { const j = (y + dy) * GW + x + dx; if (x + dx < 0 || x + dx >= GW || y + dy < 0 || y + dy >= GH) return; const i = y * GW + x; if (d[j] + w < d[i]) d[i] = d[j] + w; };
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { pass(x, y, -1, 0, 1); pass(x, y, 0, -1, 1); pass(x, y, -1, -1, 1.41); pass(x, y, 1, -1, 1.41); }
      for (let y = GH - 1; y >= 0; y--) for (let x = GW - 1; x >= 0; x--) { pass(x, y, 1, 0, 1); pass(x, y, 0, 1, 1); pass(x, y, 1, 1, 1.41); pass(x, y, -1, 1, 1.41); }
      return d;
    };
    const dl = dist(true), ds = dist(false), h = new Float32Array(GW * GH);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const i = y * GW + x, c = cls[i], nz = n(x / GW * 6, y / GH * 6, 4);
      if (c === 0) h[i] = .5 - .015 - Math.min(1, ds[i] / 22) * .4;
      else h[i] = .5 + .015 + Math.min(1, dl[i] / 30) * .3 + nz * .12 * Math.min(1, dl[i] / 5) + (c === 3 ? .55 : 0);
    }
    return { GW, GH, h, sea: .5, top: 1.5, forest: cls };
  },
  heights(o) {
    const b = this.base(o), h = Float32Array.from(b.h), { GW, GH } = b, span = Math.max(.05, b.top - b.sea);
    for (const s of o.strokes) {                 // hand-painted raise/lower, in image pixels
      const gx = s.x / this.S, gy = s.y / this.S, R = s.r / this.S, R2 = R * R, amt = s.a * span;
      if (s.poly) {                        // a drawn outline: inside it becomes land (or sea, for Cut sea)
        const c = this._polyCv || (this._polyCv = document.createElement("canvas")); c.width = GW; c.height = GH;
        const x = c.getContext("2d", { willReadFrequently: true }); x.beginPath(); s.poly.forEach(([px, py], i) => i ? x.lineTo(px / this.S, py / this.S) : x.moveTo(px / this.S, py / this.S)); x.closePath(); x.fill();
        const a = x.getImageData(0, 0, GW, GH).data, target = b.sea + (s.set > 0 ? .12 : -.25) * span;
        for (let i = 0; i < GW * GH; i++) { const w = a[i * 4 + 3] / 255; if (!w) continue; if (s.set > 0 ? h[i] < target : h[i] > target) h[i] += (target - h[i]) * w; }
        continue;
      }
      if (s.set !== undefined) {          // paint land / paint sea: pull the ground toward one level, with a soft edge
        const target = b.sea + s.set * span;
        for (let y = Math.max(0, Math.floor(gy - R)); y < Math.min(GH, gy + R); y++) for (let x = Math.max(0, Math.floor(gx - R)); x < Math.min(GW, gx + R); x++) {
          const d = Math.sqrt((x - gx) ** 2 + (y - gy) ** 2) / R; if (d >= 1) continue;
          const w = d < .7 ? 1 : 1 - (d - .7) / .3, i = y * GW + x;
          if (s.set > 0 ? h[i] < target : h[i] > target) h[i] += (target - h[i]) * w;
        }
        continue;
      }
      for (let y = Math.max(0, Math.floor(gy - R * 1.6)); y < Math.min(GH, gy + R * 1.6); y++) for (let x = Math.max(0, Math.floor(gx - R * 1.6)); x < Math.min(GW, gx + R * 1.6); x++) {
        const d2 = (x - gx) ** 2 + (y - gy) ** 2; h[y * GW + x] += amt * Math.exp(-d2 / R2 * 1.4);
      }
    }
    const el = new Float32Array(GW * GH);         // 0 = coast, 1 = highest
    for (let i = 0; i < h.length; i++) el[i] = (h[i] - b.sea) / span;
    return { GW, GH, el };
  },

  // ---------------------------------------------------------------- drawing
  render(canvas, o) {
    const W = this.W, H = this.H, S = this.S, st = this.styles[o.style] || this.styles.parchment;
    canvas.width = W; canvas.height = H; const ctx = canvas.getContext("2d");
    const { GW, GH, el } = this.heights(o), traced = o.trace ? this.base(o).forest : null, rnd = this.rng(o.seed + 99), moist = this.noise(o.seed + 31);
    const at = (x, y) => el[Math.min(GH - 1, Math.max(0, y)) * GW + Math.min(GW - 1, Math.max(0, x))];
    const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
    const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
    // 1. ground colors at cell size, scaled up smoothly
    const small = document.createElement("canvas"); small.width = GW; small.height = GH; const sc = small.getContext("2d"), id = sc.createImageData(GW, GH);
    const sea = hex(st.sea), deep = hex(st.deep), lands = st.land.map(hex);
    for (let i = 0; i < el.length; i++) {
      const e = el[i]; let c;
      if (e < 0) c = mix(sea, deep, Math.min(1, -e * 2.2));
      else { const t = Math.min(.999, e * 1.15) * (lands.length - 1), k = Math.floor(t); c = mix(lands[k], lands[k + 1], t - k); }
      id.data.set([c[0], c[1], c[2], 255], i * 4);
    }
    sc.putImageData(id, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"; ctx.drawImage(small, 0, 0, W, H);
    // 2. regions (nearest seed on land, with a little noise so borders wander)
    let region = null, seeds = [];
    if (o.regions > 0) {
      const rr = this.rng(o.seed + 5), wob = this.noise(o.seed + 77);
      for (let t = 0; t < 4000 && seeds.length < o.regions; t++) { const x = Math.floor(rr() * GW), y = Math.floor(rr() * GH); if (at(x, y) > .02 && seeds.every(s => (s.x - x) ** 2 + (s.y - y) ** 2 > (GW / (o.regions + 1)) ** 2)) seeds.push({ x, y }); }
      region = new Int16Array(GW * GH).fill(-1);
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { if (at(x, y) < 0) continue;
        let best = -1, bd = 1e12; const jx = (wob(x / 22, y / 22, 3) - .5) * 40, jy = (wob(x / 22 + 50, y / 22, 3) - .5) * 40;
        seeds.forEach((s, k) => { const d = (s.x - x - jx) ** 2 + (s.y - y - jy) ** 2; if (d < bd) { bd = d; best = k; } }); region[y * GW + x] = best; }
      if (o.regionTint) {
        const tint = document.createElement("canvas"); tint.width = GW; tint.height = GH; const tc = tint.getContext("2d"), ti = tc.createImageData(GW, GH);
        const cols = st.region.map(hex);
        for (let i = 0; i < region.length; i++) if (region[i] >= 0) { const c = cols[region[i] % cols.length]; ti.data.set([c[0], c[1], c[2], o.style === "morgul" ? 46 : 70], i * 4); }
        tc.putImageData(ti, 0, 0); ctx.drawImage(tint, 0, 0, W, H);
      }
    }
    // 3. coastline (marching squares on the height field) with ripple lines out at sea
    const contour = (lvl, width, color, alpha, dash = []) => {
      ctx.save(); ctx.strokeStyle = color; ctx.globalAlpha = alpha; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.lineJoin = ctx.lineCap = "round"; ctx.beginPath();
      const P = (x, y) => [(x + .5) * S, (y + .5) * S];
      for (let y = 0; y < GH - 1; y++) for (let x = 0; x < GW - 1; x++) {
        const a = el[y * GW + x] - lvl, b = el[y * GW + x + 1] - lvl, c = el[(y + 1) * GW + x + 1] - lvl, d = el[(y + 1) * GW + x] - lvl;
        const k = (a > 0) * 8 + (b > 0) * 4 + (c > 0) * 2 + (d > 0); if (k === 0 || k === 15) continue;
        const e = { t: [x + a / (a - b), y], r: [x + 1, y + b / (b - c)], b: [x + d / (d - c), y + 1], l: [x, y + a / (a - d)] };
        const seg = { 1: ["l", "b"], 2: ["b", "r"], 3: ["l", "r"], 4: ["t", "r"], 5: ["l", "t", "b", "r"], 6: ["t", "b"], 7: ["l", "t"], 8: ["l", "t"], 9: ["t", "b"], 10: ["t", "r", "l", "b"], 11: ["t", "r"], 12: ["l", "r"], 13: ["b", "r"], 14: ["l", "b"] }[k];
        for (let i = 0; i < seg.length; i += 2) { const p = P(...e[seg[i]]), q = P(...e[seg[i + 1]]); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); }
      }
      ctx.stroke(); ctx.restore();
    };
    if (o.style !== "atlas") { contour(-.06, 1.2, st.ink, .35); contour(-.13, 1, st.ink, .2); contour(-.22, 1, st.ink, .1, [4, 6]); }
    else contour(-.08, 1.5, "#ffffff", .25);
    contour(0, 2.2, st.ink, o.style === "morgul" ? .75 : .85);
    // 4. region borders
    if (region && o.borders) {
      ctx.save(); ctx.strokeStyle = st.ink; ctx.globalAlpha = .55; ctx.lineWidth = 1.6; ctx.setLineDash([7, 5]); ctx.beginPath();
      for (let y = 0; y < GH - 1; y++) for (let x = 0; x < GW - 1; x++) { const r0 = region[y * GW + x]; if (r0 < 0) continue;
        const r1 = region[y * GW + x + 1], r2 = region[(y + 1) * GW + x];
        if (r1 >= 0 && r1 !== r0) { ctx.moveTo((x + 1) * S, y * S); ctx.lineTo((x + 1) * S, (y + 1) * S); }
        if (r2 >= 0 && r2 !== r0) { ctx.moveTo(x * S, (y + 1) * S); ctx.lineTo((x + 1) * S, (y + 1) * S); } }
      ctx.stroke(); ctx.restore();
    }
    // 5. rivers: from high ground downhill to the sea
    const riverCells = new Set(), rivers = [], rr = this.rng(o.seed + 3);
    for (let t = 0; t < 600 && rivers.length < o.rivers; t++) {
      let x = Math.floor(rr() * GW), y = Math.floor(rr() * GH); if (at(x, y) < .3) continue;
      const path = [[x, y]], seen = new Set([y * GW + x]);
      for (let step = 0; step < 900; step++) {
        let bx = x, by = y, bv = at(x, y);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { const v = at(x + dx, y + dy); if (v < bv && !seen.has((y + dy) * GW + x + dx)) { bv = v; bx = x + dx; by = y + dy; } }
        if (bx === x && by === y) {                  // a hollow: spill over the lowest rim
          let lv = 9; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (y + dy) * GW + x + dx; if (!seen.has(k) && x + dx >= 0 && x + dx < GW && y + dy >= 0 && y + dy < GH && at(x + dx, y + dy) < lv) { lv = at(x + dx, y + dy); bx = x + dx; by = y + dy; } }
          if (lv === 9) break;
        }
        x = bx; y = by; seen.add(y * GW + x); path.push([x, y]);
        if (at(x, y) < 0 || riverCells.has(y * GW + x)) break;
      }
      if (path.length < 14 || at(...path[path.length - 1]) >= 0 && !riverCells.has(path[path.length - 1][1] * GW + path[path.length - 1][0])) continue;
      path.forEach(([px, py]) => riverCells.add(py * GW + px)); rivers.push(path);
    }
    ctx.save(); ctx.strokeStyle = st.river; ctx.lineCap = ctx.lineJoin = "round";
    for (const p of rivers) {
      const pts = p.map(([x, y]) => [(x + .5) * S, (y + .5) * S]);
      for (let i = 1; i < pts.length - 1; i += 2) {   // widen toward the mouth
        ctx.lineWidth = .8 + 2.6 * (i / pts.length); ctx.beginPath(); ctx.moveTo(...(i > 1 ? [(pts[i - 1][0] + pts[i][0]) / 2, (pts[i - 1][1] + pts[i][1]) / 2] : pts[0]));
        const nx = pts[i + 1]; ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + nx[0]) / 2, (pts[i][1] + nx[1]) / 2); ctx.stroke();
      }
    }
    ctx.restore();
    // 6. symbols: mountains, hills, forests (generated ones, then stamped ones; erased spots are skipped)
    const erased = (x, y) => o.stamps.some(s => s.k === "x" && (s.x - x) ** 2 + (s.y - y) ** 2 < s.r * s.r);
    const sym = [], mt = .8 - o.mountains / 100 * .5, gap = 9;
    for (let gy = 0; gy < H; gy += gap * S / 2.2) for (let gx = 0; gx < W; gx += gap * S / 2.2) {
      const x = gx + (rnd() - .5) * 14, y = gy + (rnd() - .5) * 14, cx = Math.floor(x / S), cy = Math.floor(y / S), e = at(cx, cy), r = rnd();
      if (e < .02 || riverCells.has(cy * GW + cx)) continue;
      if (e > mt) { if (r < .6) sym.push({ k: "m", x, y, s: .8 + Math.min(.9, (e - mt) * 1.6) + rnd() * .2 }); }
      else if (e > mt - .14 && r < .28) sym.push({ k: "h", x, y, s: .8 + rnd() * .3 });
      else if (e < mt - .05 && (traced ? traced[cy * GW + cx] === 2 : moist(x / 260, y / 260, 4) > 1 - o.forests / 100 * .72) && r < .85) sym.push({ k: "f", x, y, s: .8 + rnd() * .35 });
    }
    const all = [...sym.filter(s => !erased(s.x, s.y)), ...o.stamps.filter(s => s.k !== "x").map(s => ({ ...s, s: s.s || 1 }))].sort((a, b) => a.y - b.y);
    const landAt = (x, y) => { const e = at(Math.floor(x / S), Math.floor(y / S)); const t = Math.min(.999, Math.max(0, e) * 1.15) * (lands.length - 1), k = Math.floor(t); const c = mix(lands[k], lands[k + 1], t - k); return `rgb(${c})`; };
    for (const s of all) {
      ctx.save(); ctx.translate(s.x, s.y); ctx.scale(s.s, s.s); ctx.strokeStyle = st.ink; ctx.lineWidth = 1.3 / s.s; ctx.lineJoin = "round";
      if (s.k === "m") {
        ctx.beginPath(); ctx.moveTo(-13, 6); ctx.lineTo(-2, -14); ctx.lineTo(13, 6); ctx.closePath(); ctx.fillStyle = landAt(s.x, s.y); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-2, -14); ctx.lineTo(3, -2); ctx.lineTo(1, 6); ctx.lineTo(13, 6); ctx.closePath(); ctx.fillStyle = st.ink; ctx.globalAlpha = .28; ctx.fill(); ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.moveTo(-13, 6); ctx.lineTo(-2, -14); ctx.lineTo(13, 6); ctx.stroke();
        if (s.s > 1.35) { ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(-2, -14); ctx.lineTo(2, -7); ctx.fillStyle = st.snow; ctx.fill(); }
      } else if (s.k === "h") {
        ctx.beginPath(); ctx.moveTo(-10, 4); ctx.quadraticCurveTo(0, -9, 10, 4); ctx.fillStyle = landAt(s.x, s.y); ctx.fill(); ctx.stroke();
      } else if (s.k === "f") {
        ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, 1); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, -3, 5, 0, Math.PI * 2); ctx.fillStyle = st.forest; ctx.fill(); ctx.stroke();
      } else if (s.k === "t") {               // town
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fillStyle = st.paper; ctx.fill(); ctx.lineWidth = 2 / s.s; ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fillStyle = st.ink; ctx.fill();
      } else if (s.k === "c") {               // castle / city
        ctx.fillStyle = st.ink; ctx.fillRect(-8, -4, 16, 10); ctx.fillRect(-9, -10, 5, 6); ctx.fillRect(4, -10, 5, 6); ctx.fillRect(-2, -13, 4, 9);
      }
      ctx.restore();
    }
    // 7. grid, labels, compass, frame
    if (o.grid) { ctx.save(); ctx.strokeStyle = st.ink; ctx.globalAlpha = .12; ctx.lineWidth = 1; ctx.beginPath(); for (let x = 100; x < W; x += 100) { ctx.moveTo(x, 0); ctx.lineTo(x, H); } for (let y = 100; y < H; y += 100) { ctx.moveTo(0, y); ctx.lineTo(W, y); } ctx.stroke(); ctx.restore(); }
    const serif = (cssVar("serif") || "Georgia, serif");
    for (const l of o.labels) {
      const size = l.size || 22, kind = l.kind || "place";
      ctx.save(); ctx.translate(l.x, l.y); if (l.rot) ctx.rotate(l.rot * Math.PI / 180);
      ctx.font = `${kind === "region" ? "600" : kind === "sea" ? "italic 400" : "500"} ${size}px ${serif}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const text = kind === "region" ? [...l.text.toUpperCase()].join(String.fromCharCode(8202)) : l.text;
      ctx.lineWidth = Math.max(3, size / 6); ctx.strokeStyle = o.style === "morgul" ? "rgba(7,13,11,.85)" : "rgba(240,232,212,.85)"; ctx.strokeText(text, 0, 0);
      ctx.fillStyle = kind === "sea" ? st.river : st.label; ctx.fillText(text, 0, 0); ctx.restore();
    }
    if (o.compass) {
      ctx.save(); ctx.translate(W - 110, H - 120); ctx.strokeStyle = st.ink; ctx.fillStyle = st.ink; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(0, 0, 44, 0, Math.PI * 2); ctx.globalAlpha = .5; ctx.stroke(); ctx.globalAlpha = 1;
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, L = i % 2 ? 26 : 50; ctx.save(); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(0, -L); ctx.lineTo(5, 0); ctx.lineTo(-5, 0); ctx.closePath(); i === 0 ? ctx.fill() : ctx.stroke(); ctx.restore(); }
      ctx.font = `600 18px ${serif}`; ctx.textAlign = "center"; ctx.fillText(tf("N", "С"), 0, -60); ctx.restore();
    }
    ctx.save(); ctx.strokeStyle = st.ink; ctx.lineWidth = 6; ctx.strokeRect(3, 3, W - 6, H - 6); ctx.lineWidth = 1.2; ctx.strokeRect(12, 12, W - 24, H - 24); ctx.restore();
    return { seeds: seeds.map(s => ({ x: (s.x + .5) * S, y: (s.y + .5) * S })), rivers: rivers.length };
  },
};

// ---------------------------------------------------------------- tracing a map you already have
// The picture is shrunk to the maker's grid. Every cell gets the class of the nearest sample colour:
// 0 sea, 1 land, 2 forest, 3 mountains, 4 lines & writing (ink). Ink then takes the class around it, and tiny specks are cleaned up.
const Trace = {
  names: [["Sea", "Море"], ["Land", "Суша"], ["Forest", "Гора"], ["Mountains", "Планини"], ["Lines & writing", "Линии и надписи"]],
  colors: ["#3E6C8E", "#B9A77E", "#4E7A45", "#8C7B6B", "#E05050"],
  encode(cls) { let s = "", cur = cls[0], n = 0; for (let i = 0; i <= cls.length; i++) { if (i < cls.length && cls[i] === cur && n < 35) { n++; continue; } s += cur + n.toString(36); cur = cls[i]; n = 1; } return s; },
  decode(s, len) { const out = new Uint8Array(len); let p = 0; for (let i = 0; i + 1 < s.length; i += 2) { const c = +s[i], n = parseInt(s[i + 1], 36); out.fill(c, p, p + n); p += n; } return out; },
  // the picture fitted into the map (contain), the empty edges count as sea
  grid(imgEl, GW, GH) {
    const c = document.createElement("canvas"); c.width = GW; c.height = GH; const x = c.getContext("2d", { willReadFrequently: true });
    const k = Math.min(GW / imgEl.naturalWidth, GH / imgEl.naturalHeight), w = imgEl.naturalWidth * k, h = imgEl.naturalHeight * k;
    x.imageSmoothingQuality = "high"; x.drawImage(imgEl, (GW - w) / 2, (GH - h) / 2, w, h);
    const inside = (cx, cy) => cx >= (GW - w) / 2 && cx < (GW + w) / 2 && cy >= (GH - h) / 2 && cy < (GH + h) / 2;
    return { data: x.getImageData(0, 0, GW, GH).data, inside };
  },
  dist: (a, b) => { const r = (a[0] + b[0]) / 2, dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2]; return (2 + r / 256) * dr * dr + 4 * dg * dg + (2 + (255 - r) / 256) * db * db; },
  // first guess: the commonest colour along the picture's edge is sea; the commonest clearly different colour is land; the darkest is ink
  guess(imgEl) {
    const c = document.createElement("canvas"), W = 320, H = Math.max(40, Math.round(320 * imgEl.naturalHeight / imgEl.naturalWidth)); c.width = W; c.height = H;
    const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(imgEl, 0, 0, W, H); const d = x.getImageData(0, 0, W, H).data;
    const px = i => [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]], q = p => p.map(v => v >> 5).join(",");
    const count = idx => { const m = new Map(); for (const i of idx) { const k = q(px(i)); const e = m.get(k) || { n: 0, sum: [0, 0, 0] }; e.n++; px(i).forEach((v, j) => e.sum[j] += v); m.set(k, e); } return [...m.values()].sort((a, b) => b.n - a.n).map(e => e.sum.map(v => Math.round(v / e.n))); };
    const edge = []; for (let i = 0; i < W; i++) edge.push(i, (H - 1) * W + i); for (let j = 0; j < H; j++) edge.push(j * W, j * W + W - 1);
    const all = [...Array(W * H).keys()], sea = count(edge)[0], common = count(all);
    const land = common.find(cl => Tracer_far(cl, sea)) || [180, 160, 120];
    const lum = p => p[0] * .3 + p[1] * .59 + p[2] * .11, ink = all.map(px).sort((a, b) => lum(a) - lum(b))[Math.floor(all.length * .004)];
    const s = [{ k: 0, c: sea }, { k: 1, c: land }]; if (lum(ink) < Math.min(lum(sea), lum(land)) - 45) s.push({ k: 4, c: ink }, { k: 4, c: ink.map(v => Math.round(v * .5)) });
    // other big colour areas: green → forest, blue → sea, darker earth → mountains, anything else → land
    const area = W * H, counts = new Map(); for (const i of all) { const k = q(px(i)); counts.set(k, (counts.get(k) || 0) + 1); }
    for (const c of common.slice(0, 12)) {
      if ((counts.get(q(c)) || 0) < area * .004 || s.some(x => Trace.dist(x.c, c) < 9 * 28 * 28)) continue;
      const [r, g, b] = c, k = g > r + 12 && g > b + 5 ? 2 : b > r + 25 && b > g ? 0 : lum(c) < lum(land) - 25 && lum(c) > lum(ink) + 30 ? 3 : 1;
      s.push({ k, c });
    }
    return s;
  },
  classify(grid, samples, GW, GH, clean = 2) {
    const n = GW * GH, cls = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const x = i % GW, y = (i / GW) | 0; if (!grid.inside(x + .5, y + .5)) { cls[i] = 0; continue; }
      const p = [grid.data[i * 4], grid.data[i * 4 + 1], grid.data[i * 4 + 2]]; let best = 1, bd = 1e12;
      for (const s of samples) { const dd = this.dist(p, s.c); if (dd < bd) { bd = dd; best = s.k; } } cls[i] = best;
    }
    // ink (outlines, writing, symbols) becomes whatever surrounds it
    for (let pass = 0; pass < 12; pass++) { let left = 0; const nx = Uint8Array.from(cls);
      for (let i = 0; i < n; i++) if (cls[i] === 4) { const x = i % GW, y = (i / GW) | 0, votes = [0, 0, 0, 0];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < GW && yy < GH) { const c = cls[yy * GW + xx]; if (c < 4) votes[c]++; } }
        const m = Math.max(...votes); if (m) nx[i] = votes.indexOf(m); else left++; }
      cls.set(nx); if (!left) break; }
    for (let i = 0; i < n; i++) if (cls[i] === 4) cls[i] = 1;
    // smoothing: each cell takes the most common class around it
    for (let pass = 0; pass < clean; pass++) { const nx = Uint8Array.from(cls);
      for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) { const v = [0, 0, 0, 0];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) v[cls[(y + dy) * GW + x + dx]]++;
        const m = Math.max(...v), c = cls[y * GW + x]; if (v[c] < 4) nx[y * GW + x] = v.indexOf(m); }
      cls.set(nx); }
    // specks: land or sea patches smaller than a few cells join their surroundings
    const seen = new Uint8Array(n), min = 6 + clean * 4;
    for (let i = 0; i < n; i++) { if (seen[i]) continue; const isLand = cls[i] > 0, stack = [i], blob = []; seen[i] = 1;
      while (stack.length) { const j = stack.pop(); blob.push(j); const x = j % GW, y = (j / GW) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy, k = yy * GW + xx; if (xx >= 0 && yy >= 0 && xx < GW && yy < GH && !seen[k] && (cls[k] > 0) === isLand) { seen[k] = 1; stack.push(k); } } }
      if (blob.length < min) for (const j of blob) cls[j] = isLand ? 0 : 1; }
    return cls;
  },
  async pick(file) {
    const url = file ? URL.createObjectURL(file) : null;
    return url;
  },
  // the dialog: the picture with sample clicks, and a live preview of what Morgul understood
  async dialog(src) {
    const imgEl = new Image(); imgEl.src = src; await new Promise((ok, no) => { imgEl.onload = ok; imgEl.onerror = no; });
    const GW = MK.W / MK.S, GH = MK.H / MK.S, grid = this.grid(imgEl, GW, GH);
    let samples = this.guess(imgEl), cls = null, mode = 0, clean = 2, ink = Trace.inkLooks(imgEl), prep = null;
    const inkOpt = { sens: 4, gap: 1, small: 4, flips: [] };
    return modal(tf("Trace a map you have", "Прерисуване на ваша карта"), `<div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;align-items:start">
        <div><div class="small faint" style="margin-bottom:4px" data-srclbl></div><canvas data-src class="trace-src"></canvas></div>
        <div><div class="small faint" style="margin-bottom:4px">${tf("What Morgul sees", "Какво вижда Morgul")}</div><canvas data-prev class="trace-src"></canvas></div></div>
      <div class="row" style="margin-top:10px"><span class="small faint">${tf("Your map is", "Картата ви е")}</span>
        <span class="chip" data-kind="color">${tf("A coloured map", "Цветна карта")}</span><span class="chip" data-kind="ink">${tf("An ink drawing (lines on paper)", "Рисунка с мастило (линии на лист)")}</span></div>
      <div data-inkrow><div class="row" style="margin-top:8px;flex-wrap:wrap;gap:14px">
        <label class="small">${tf("Line sensitivity", "Чувствителност за линии")} <input type="range" min="1" max="7" value="4" data-sens style="width:100px"></label>
        <label class="small">${tf("Close small gaps", "Затвори малки пролуки")} <input type="range" min="0" max="4" value="1" data-gap style="width:100px"></label>
        <label class="small">${tf("Leave out small drawings", "Пропусни малки рисунки")} <input type="range" min="0" max="30" value="4" data-small style="width:100px"></label>
        <button class="btn small ghost" data-unflip>${tf("Undo clicks", "Отмени щракванията")}</button></div>
        <div class="faint small" style="margin-top:6px">${tf("Everything joined to the edge of the paper is sea; every area closed in by a line is land. Click any area in either picture to swap it between land and sea (a lake, a drawing in the sea, a title box). If land leaks into the sea, raise Close small gaps; if specks of land appear, raise Leave out small drawings. Symbols and writing are not read: add them afterwards with the stamps and labels.", "Всичко, свързано с ръба на листа, е море; всяка област, затворена с линия, е суша. Щракнете област в която и да е картина, за да я смените между суша и море (езеро, рисунка в морето, рамка за заглавие). Ако сушата „изтича“ в морето, увеличете Затвори малки пролуки; ако има петна суша, увеличете Пропусни малки рисунки. Символите и надписите не се четат.")}</div></div>
      <div data-colorrow><div class="row" style="margin-top:10px;flex-wrap:wrap"><span class="small faint">${tf("Next click is", "Следващото щракване е")}</span>${this.names.map((n, k) => `<span class="chip ${k === 0 ? "on" : ""}" data-k="${k}"><i class="swatch" style="background:${this.colors[k]}"></i> ${esc(tf(...n))}</span>`).join("")}
        <span class="spacer"></span><label class="small">${tf("Clean up", "Изчистване")} <input type="range" min="0" max="5" value="2" data-clean style="width:90px"></label><button class="btn small ghost" data-reset>${tf("Start over", "Отначало")}</button></div>
      <div class="small" data-samples style="margin-top:6px"></div>
      <div class="faint small" style="margin-top:6px">${tf("Morgul guessed sea and land from the colours. If something is wrong, pick what it should be and click on it in your map; click several spots if the sea or land has more than one colour. Writing, borders and symbols can be marked as “lines & writing” so they disappear. Names are not read: add them as labels afterwards.", "Morgul позна морето и сушата по цветовете. Ако нещо не е вярно, изберете какво трябва да е и щракнете върху него; щракнете няколко места, ако морето или сушата имат повече цветове. Надписите и линиите се маркират като „линии и надписи“, за да изчезнат. Имената не се четат: добавете ги после като надписи.")}</div></div>`,
      { wide: true, buttons: [{ label: t("Cancel"), value: null }, { label: tf("Use this", "Използвай това"), cls: "primary", value: () => ({ cells: Trace.encode(cls), id: uid(), nw: imgEl.naturalWidth, nh: imgEl.naturalHeight }) }],
        onOpen: ov => {
          ov.querySelector(".modal")?.classList.add("xwide");
          const src = $("[data-src]", ov), prev = $("[data-prev]", ov);
          src.width = MK.W / 2; src.height = MK.H / 2; prev.width = GW; prev.height = GH;
          const sx = src.getContext("2d", { willReadFrequently: true }), k = Math.min(src.width / imgEl.naturalWidth, src.height / imgEl.naturalHeight);
          const ox = (src.width - imgEl.naturalWidth * k) / 2, oy = (src.height - imgEl.naturalHeight * k) / 2;
          sx.fillStyle = "#000"; sx.fillRect(0, 0, src.width, src.height); sx.drawImage(imgEl, ox, oy, imgEl.naturalWidth * k, imgEl.naturalHeight * k);
          const orig = sx.getImageData(0, 0, src.width, src.height);
          const draw = () => {
            $$("[data-kind]", ov).forEach(c => c.classList.toggle("on", (c.dataset.kind === "ink") === ink));
            $("[data-inkrow]", ov).hidden = !ink; $("[data-colorrow]", ov).hidden = ink;
            $("[data-srclbl]", ov).textContent = ink ? tf("Your map — click an area to swap it between land and sea", "Вашата карта — щракнете област, за да я смените между суша и море") : tf("Your map — click to show Morgul what each colour is", "Вашата карта — щракнете, за да покажете какво е всеки цвят");
            if (ink) { prep = prep || Trace.inkPrep(imgEl, GW, GH); cls = Trace.inkClassify(prep, GW, GH, inkOpt).cls; }
            else cls = Trace.classify(grid, samples, GW, GH, clean);
            const px = prev.getContext("2d"), id = px.createImageData(GW, GH), cols = Trace.colors.map(c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)));
            for (let i = 0; i < cls.length; i++) id.data.set([...cols[cls[i]], 255], i * 4); px.putImageData(id, 0, 0);
            sx.putImageData(orig, 0, 0);
            if (ink) for (const f of inkOpt.flips) { sx.beginPath(); sx.arc(f.x * src.width / GW, f.y * src.height / GH, 6, 0, 7); sx.fillStyle = "#E0A040"; sx.fill(); sx.lineWidth = 2; sx.strokeStyle = "#fff"; sx.stroke(); }
            if (!ink) for (const s of samples) if (s.x != null) { sx.beginPath(); sx.arc(s.x, s.y, 6, 0, 7); sx.fillStyle = Trace.colors[s.k]; sx.fill(); sx.lineWidth = 2; sx.strokeStyle = "#fff"; sx.stroke(); }
            $("[data-samples]", ov).innerHTML = Trace.names.map((nm, kk) => { const ss = samples.filter(s => s.k === kk); return ss.length ? `<span style="margin-right:12px">${esc(tf(...nm))}: ${ss.map(s => `<i class="swatch" style="background:rgb(${s.c})"></i>`).join("")}</span>` : ""; }).join("");
          };
          const flipAt = (cv2, ev) => { const b = cv2.getBoundingClientRect(); inkOpt.flips.push({ x: (ev.clientX - b.left) / b.width * GW, y: (ev.clientY - b.top) / b.height * GH }); draw(); };
          prev.onclick = ev => { if (ink) flipAt(prev, ev); };
          src.onclick = ev => {
            if (ink) return flipAt(src, ev);
            const b = src.getBoundingClientRect(), x = (ev.clientX - b.left) * src.width / b.width, y = (ev.clientY - b.top) * src.height / b.height;
            const d = sx.getImageData(Math.max(0, x - 1), Math.max(0, y - 1), 3, 3).data, c = [0, 1, 2].map(j => Math.round((d[j] + d[4 + j] + d[8 + j] + d[12 + j] + d[16 + j] + d[20 + j] + d[24 + j] + d[28 + j] + d[32 + j]) / 9));
            const o2 = orig.data, ii = (Math.round(y) * src.width + Math.round(x)) * 4; const c0 = [o2[ii], o2[ii + 1], o2[ii + 2]];
            samples.push({ k: mode, c: Tracer_far(c, c0) ? c0 : c, x, y }); draw();
          };
          $$("[data-k]", ov).forEach(ch => ch.onclick = () => { mode = +ch.dataset.k; $$("[data-k]", ov).forEach(x => x.classList.toggle("on", x === ch)); });
          $("[data-clean]", ov).oninput = e => { clean = +e.target.value; draw(); };
          $("[data-reset]", ov).onclick = () => { samples = Trace.guess(imgEl); draw(); };
          $$("[data-kind]", ov).forEach(c => c.onclick = () => { ink = c.dataset.kind === "ink"; draw(); });
          $("[data-sens]", ov).oninput = e => { inkOpt.sens = +e.target.value; draw(); };
          $("[data-gap]", ov).oninput = e => { inkOpt.gap = +e.target.value; draw(); };
          $("[data-small]", ov).oninput = e => { inkOpt.small = +e.target.value; draw(); };
          $("[data-unflip]", ov).onclick = () => { inkOpt.flips = []; draw(); };
          draw();
        } });
  },
};
function Tracer_far(a, b) { return Trace.dist(a, b) > 9 * 50 * 50; }

// ---------------------------------------------------------------- ink drawings on paper (black lines, white everywhere)
// Lines are found against the local brightness (so shadows and uneven light don't matter), small gaps are closed,
// everything joined to the edge of the picture is sea, and every area closed in by a line is land.
Trace.inkLooks = imgEl => {        // mostly light with a few dark lines?
  const c = document.createElement("canvas"); c.width = 160; c.height = Math.max(20, Math.round(160 * imgEl.naturalHeight / imgEl.naturalWidth));
  const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(imgEl, 0, 0, c.width, c.height); const d = x.getImageData(0, 0, c.width, c.height).data;
  let light = 0, dark = 0, sat = 0; const n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) { const l = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11, mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
    if (l > 150) light++; if (l < 90) dark++; if (mx - mn > 50) sat++; }
  return light / n > .6 && dark / n < .2 && sat / n < .25;
};
Trace.inkPrep = (imgEl, GW, GH) => {
  // the picture at twice the grid size, fitted like the map (contain); outside the picture counts as paper
  const W2 = GW * 2, H2 = GH * 2, c = document.createElement("canvas"); c.width = W2; c.height = H2;
  const x = c.getContext("2d", { willReadFrequently: true }); x.fillStyle = "#fff"; x.fillRect(0, 0, W2, H2);
  const k = Math.min(W2 / imgEl.naturalWidth, H2 / imgEl.naturalHeight), w = imgEl.naturalWidth * k, h = imgEl.naturalHeight * k;
  x.imageSmoothingQuality = "high"; x.drawImage(imgEl, (W2 - w) / 2, (H2 - h) / 2, w, h);
  const d = x.getImageData(0, 0, W2, H2).data, lum = new Float32Array(W2 * H2);
  for (let i = 0; i < lum.length; i++) lum[i] = d[i * 4] * .3 + d[i * 4 + 1] * .59 + d[i * 4 + 2] * .11;
  // local average brightness (box blur through an integral image)
  const S = new Float64Array((W2 + 1) * (H2 + 1));
  for (let y = 0; y < H2; y++) { let row = 0; for (let xx = 0; xx < W2; xx++) { row += lum[y * W2 + xx]; S[(y + 1) * (W2 + 1) + xx + 1] = S[y * (W2 + 1) + xx + 1] + row; } }
  const R = 18, mean = new Float32Array(W2 * H2);
  for (let y = 0; y < H2; y++) for (let xx = 0; xx < W2; xx++) {
    const x0 = Math.max(0, xx - R), x1 = Math.min(W2, xx + R + 1), y0 = Math.max(0, y - R), y1 = Math.min(H2, y + R + 1);
    mean[y * W2 + xx] = (S[y1 * (W2 + 1) + x1] - S[y0 * (W2 + 1) + x1] - S[y1 * (W2 + 1) + x0] + S[y0 * (W2 + 1) + x0]) / ((x1 - x0) * (y1 - y0));
  }
  return { W2, H2, lum, mean };
};
Trace.inkClassify = (prep, GW, GH, opt) => {
  const { W2, H2, lum, mean } = prep, n = GW * GH, delta = 70 - opt.sens * 9;        // sensitivity 1–7
  const line = new Uint8Array(n);
  for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) { const i = y * W2 + x; if (lum[i] < mean[i] - delta && lum[i] < 215) line[(y >> 1) * GW + (x >> 1)] = 1; }
  // close small gaps: thicken the lines
  let thick = line;
  for (let r = 0; r < opt.gap; r++) { const nx = Uint8Array.from(thick);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (thick[y * GW + x]) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < GW && yy < GH) nx[yy * GW + xx] = 1; }
    thick = nx; }
  // areas between the lines
  const comp = new Int32Array(n).fill(-1), info = [];
  for (let i = 0; i < n; i++) { if (thick[i] || comp[i] >= 0) continue;
    const id = info.length, st = [i]; comp[i] = id; let size = 0, edge = false;
    while (st.length) { const j = st.pop(); size++; const x = j % GW, y = (j / GW) | 0; if (x === 0 || y === 0 || x === GW - 1 || y === GH - 1) edge = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy, k = yy * GW + xx; if (xx >= 0 && yy >= 0 && xx < GW && yy < GH && !thick[k] && comp[k] < 0) { comp[k] = id; st.push(k); } } }
    info.push({ size, edge }); }
  const minSize = n * opt.small / 1000;          // small drawings: 0–3 % of the map
  // big areas: joined to the edge = sea, closed in = land; small ones (trees, a fish, letters) take what is around them, below
  const land = info.map(c => !c.edge && c.size >= minSize), small = info.map(c => !c.edge && c.size < minSize);
  // clicked areas swap between land and sea
  for (const p of opt.flips) { const x = Math.min(GW - 1, Math.max(0, Math.round(p.x))), y = Math.min(GH - 1, Math.max(0, Math.round(p.y)));
    let id = comp[y * GW + x];
    if (id >= 0 && small[id]) continue;        // small ones are swapped after they take their surroundings, below
    if (id < 0) for (let r = 1; r < 6 && id < 0; r++) for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) { const k = (y + dy) * GW + x + dx; if (comp[k] >= 0) { id = comp[k]; break; } }
    if (id >= 0) land[id] = !land[id]; }
  // 255 = not decided yet: the ink, and small drawings that weren't clicked
  const cls = new Uint8Array(n).fill(255), flipped = new Set();
  for (const p of opt.flips) { const x = Math.min(GW - 1, Math.max(0, Math.round(p.x))), y = Math.min(GH - 1, Math.max(0, Math.round(p.y))); if (comp[y * GW + x] >= 0) flipped.add(comp[y * GW + x]); }
  for (let i = 0; i < n; i++) if (comp[i] >= 0 && !small[comp[i]]) cls[i] = land[comp[i]] ? 1 : 0;
  // everything undecided takes the most common kind around it, growing outward until all is decided
  for (let pass = 0, left = 1; left && pass < 400; pass++) { left = 0; const nx = Uint8Array.from(cls);
    for (let i = 0; i < n; i++) if (cls[i] === 255) { const x = i % GW, y = (i / GW) | 0; let l = 0, s = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < GW && yy < GH) { const c = cls[yy * GW + xx]; if (c === 1) l++; else if (c === 0) s++; } }
      if (l || s) nx[i] = l >= s ? 1 : 0; else left++; }
    cls.set(nx); }
  for (let i = 0; i < n; i++) if (cls[i] === 255) cls[i] = 0;
  // a clicked small drawing becomes the opposite of what surrounds it (a small lake in the land, a small island in the sea)
  const swap = new Map(); for (let i = 0; i < n; i++) { const c = comp[i]; if (c >= 0 && small[c] && flipped.has(c) && !swap.has(c)) swap.set(c, cls[i] ? 0 : 1); }
  for (let i = 0; i < n; i++) if (swap.has(comp[i])) cls[i] = swap.get(comp[i]);
  return { cls, line };
};

// ---------------------------------------------------------------- straighten a photo of a paper map
// Drag the four corners onto the paper's corners; Morgul flattens it as if scanned from above. Rotate turns it a quarter.
const Photo = {
  // a first guess at the paper: the largest bright area, and its four outermost corners
  guess(imgEl) {
    const W = 200, H = Math.round(200 * imgEl.naturalHeight / imgEl.naturalWidth), c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(imgEl, 0, 0, W, H); const d = x.getImageData(0, 0, W, H).data;
    const lum = i => d[i * 4] * .3 + d[i * 4 + 1] * .59 + d[i * 4 + 2] * .11, hist = new Array(256).fill(0);
    for (let i = 0; i < W * H; i++) hist[Math.round(lum(i))]++;
    let sum = 0, sumB = 0, wB = 0, best = 0, th = 128; for (let i = 0; i < 256; i++) sum += i * hist[i];   // Otsu's threshold
    for (let i = 0; i < 256; i++) { wB += hist[i]; if (!wB) continue; const wF = W * H - wB; if (!wF) break; sumB += i * hist[i]; const mB = sumB / wB, mF = (sum - sumB) / wF, v = wB * wF * (mB - mF) ** 2; if (v > best) { best = v; th = i; } }
    const seen = new Uint8Array(W * H); let bestBlob = [];
    for (let i = 0; i < W * H; i++) { if (seen[i] || lum(i) <= th) continue; const st = [i], blob = []; seen[i] = 1;
      while (st.length) { const j = st.pop(); blob.push(j); const xx = j % W, yy = (j / W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = xx + dx, b = yy + dy, k = b * W + a; if (a >= 0 && b >= 0 && a < W && b < H && !seen[k] && lum(k) > th - 25) { seen[k] = 1; st.push(k); } } }
      if (blob.length > bestBlob.length) bestBlob = blob; }
    if (bestBlob.length < W * H * .15) return [[0, 0], [1, 0], [1, 1], [0, 1]];
    // paper is light and nearly colourless; a light-coloured land in a digital map is not paper
    let sat = 0, l = 0; for (const j of bestBlob) { const r = d[j * 4], g = d[j * 4 + 1], b = d[j * 4 + 2]; sat += Math.max(r, g, b) - Math.min(r, g, b); l += lum(j); }
    if (sat / bestBlob.length > 32 || l / bestBlob.length < 140) return [[0, 0], [1, 0], [1, 1], [0, 1]];
    const pts = bestBlob.map(j => [j % W, (j / W) | 0]), pick = f => pts.reduce((a, p) => f(p) > f(a) ? p : a, pts[0]);
    return [pick(p => -p[0] - p[1]), pick(p => p[0] - p[1]), pick(p => p[0] + p[1]), pick(p => p[1] - p[0])].map(([px, py]) => [px / (W - 1), py / (H - 1)]);
  },
  // solve the 3×3 projective transform that takes the unit square to the four corners
  homography(q) {
    const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q, dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2, sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
    const det = dx1 * dy2 - dx2 * dy1, g = (sx * dy2 - dx2 * sy) / det, h = (dx1 * sy - sx * dy1) / det;
    return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h];
  },
  async flatten(imgEl, q, rot) {
    // q: corners in picture pixels (top-left, top-right, bottom-right, bottom-left of the paper)
    const side = (a, b) => Math.hypot(q[a][0] - q[b][0], q[a][1] - q[b][1]);
    let W = (side(0, 1) + side(3, 2)) / 2, H = (side(0, 3) + side(1, 2)) / 2; const k = Math.min(1, 1800 / Math.max(W, H)); W = Math.round(W * k); H = Math.round(H * k);
    const src = document.createElement("canvas"); src.width = imgEl.naturalWidth; src.height = imgEl.naturalHeight;
    const sx = src.getContext("2d", { willReadFrequently: true }); sx.drawImage(imgEl._c || imgEl, 0, 0); const sd = sx.getImageData(0, 0, src.width, src.height).data, SW = src.width, SH = src.height;
    const [a, b, c, d, e, f, g, h] = Photo.homography(q), out = document.createElement("canvas"); out.width = W; out.height = H;
    const ox = out.getContext("2d"), od = ox.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = x / (W - 1), v = y / (H - 1), z = g * u + h * v + 1, px = (a * u + b * v + c) / z, py = (d * u + e * v + f) / z;
      const ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy, o = (y * W + x) * 4;
      if (ix < 0 || iy < 0 || ix >= SW - 1 || iy >= SH - 1) { od.data[o] = od.data[o + 1] = od.data[o + 2] = 255; od.data[o + 3] = 255; continue; }
      for (let ch = 0; ch < 3; ch++) { const p = (iy * SW + ix) * 4 + ch;
        od.data[o + ch] = sd[p] * (1 - fx) * (1 - fy) + sd[p + 4] * fx * (1 - fy) + sd[p + SW * 4] * (1 - fx) * fy + sd[p + SW * 4 + 4] * fx * fy; }
      od.data[o + 3] = 255;
    }
    ox.putImageData(od, 0, 0);
    let res = out;
    if (rot % 4) { const r2 = document.createElement("canvas"), turn = rot % 4; r2.width = turn % 2 ? H : W; r2.height = turn % 2 ? W : H; const x2 = r2.getContext("2d");
      x2.translate(r2.width / 2, r2.height / 2); x2.rotate(turn * Math.PI / 2); x2.drawImage(out, -W / 2, -H / 2); res = r2; }
    return await new Promise(r => res.toBlob(r, "image/png"));
  },
  // the dialog; resolves with a PNG blob of the flattened picture, the original (Skip), or null
  async dialog(src, file) {
    const imgEl = new Image(); imgEl.src = src; await new Promise((ok, no) => { imgEl.onload = ok; imgEl.onerror = no; });
    const g0 = Photo.guess(imgEl);
    // already flat (a scan or a digital map): the "paper" is the whole picture, so there is nothing to straighten
    if ([[0, 0], [1, 0], [1, 1], [0, 1]].every(([cx, cy], i) => Math.abs(g0[i][0] - cx) < .04 && Math.abs(g0[i][1] - cy) < .04)) return file || await fetch(src).then(r => r.blob());
    let q = g0.map(([x, y]) => [x * imgEl.naturalWidth, y * imgEl.naturalHeight]), rot = 0;
    const res = await modal(tf("Straighten the photo", "Изправяне на снимката"), `
      <p class="small muted" style="margin-top:0">${tf("Drag the four round handles onto the corners of the paper. Morgul flattens it as if it were scanned from straight above, and leaves out everything around the paper. If the map was photographed sideways, turn it.", "Влачете четирите кръгчета до ъглите на листа. Morgul го изправя, все едно е сканиран отгоре, и изрязва всичко около листа. Ако картата е снимана настрани, завъртете я.")}</p>
      <div class="grid" style="grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:12px;align-items:start">
        <div class="photo-wrap" data-wrap><img data-img src="${src}" draggable="false"><svg data-svg></svg></div>
        <div><div class="small faint" style="margin-bottom:4px">${tf("Result", "Резултат")}</div><canvas data-out class="trace-src"></canvas>
          <div class="row" style="margin-top:8px"><button class="btn small ghost" data-rl>↺ ${tf("Turn left", "Завърти наляво")}</button><button class="btn small ghost" data-rr>↻ ${tf("Turn right", "Завърти надясно")}</button><button class="btn small ghost" data-auto>${tf("Find the paper again", "Намери листа пак")}</button></div></div></div>`,
      { wide: true, buttons: [{ label: t("Cancel"), value: null }, { label: tf("Use the photo as it is", "Използвай снимката както е"), value: "skip" }, { label: tf("Use the straightened map", "Използвай изправената карта"), cls: "primary", value: "ok" }],
        onOpen: ov => {
          ov.querySelector(".modal")?.classList.add("xwide");
          const svg = $("[data-svg]", ov), im = $("[data-img]", ov), out = $("[data-out]", ov);
          const preview = debounce(async () => { const blob = await Photo.flatten(Photo.small(imgEl), q.map(([x, y]) => [x * Photo.k, y * Photo.k]), rot); const u = URL.createObjectURL(blob), pi = new Image(); pi.onload = () => { out.width = pi.width; out.height = pi.height; out.getContext("2d").drawImage(pi, 0, 0); URL.revokeObjectURL(u); }; pi.src = u; }, 120);
          const draw = () => {
            const w = im.clientWidth, h = im.clientHeight, sc = w / imgEl.naturalWidth; svg.setAttribute("viewBox", `0 0 ${w} ${h}`); svg.style.width = w + "px"; svg.style.height = h + "px";
            const P = q.map(([x, y]) => [x * sc, y * sc]);
            svg.innerHTML = `<polygon points="${P.map(p => p.join(",")).join(" ")}" class="photo-quad"/>` + P.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="9" class="photo-h" data-i="${i}"/>`).join("");
            preview();
          };
          let dragI = -1;
          svg.onpointerdown = ev => { const c = ev.target.closest("[data-i]"); if (!c) return; dragI = +c.dataset.i; svg.setPointerCapture(ev.pointerId); };
          svg.onpointermove = ev => { if (dragI < 0) return; const b = im.getBoundingClientRect(), sc = imgEl.naturalWidth / b.width;
            q[dragI] = [Math.max(0, Math.min(imgEl.naturalWidth, (ev.clientX - b.left) * sc)), Math.max(0, Math.min(imgEl.naturalHeight, (ev.clientY - b.top) * sc))]; draw(); };
          svg.onpointerup = () => { dragI = -1; };
          $("[data-rl]", ov).onclick = () => { rot = (rot + 3) % 4; preview(); };
          $("[data-rr]", ov).onclick = () => { rot = (rot + 1) % 4; preview(); };
          $("[data-auto]", ov).onclick = () => { q = Photo.guess(imgEl).map(([x, y]) => [x * imgEl.naturalWidth, y * imgEl.naturalHeight]); draw(); };
          if (im.complete) setTimeout(draw, 30); else im.onload = draw;
          window.addEventListener("resize", draw, { once: true });
        } });
    if (!res) return null;
    if (res === "skip") return file || await fetch(src).then(r => r.blob());
    return await Photo.flatten(imgEl, q, rot);
  },
  // a smaller copy for the live preview
  small(imgEl) {
    const k = Math.min(1, 700 / Math.max(imgEl.naturalWidth, imgEl.naturalHeight)); Photo.k = k;
    if (Photo._img?.src === imgEl.src && Photo._k === k) return Photo._small;
    const c = document.createElement("canvas"); c.width = Math.round(imgEl.naturalWidth * k); c.height = Math.round(imgEl.naturalHeight * k); c.getContext("2d").drawImage(imgEl, 0, 0, c.width, c.height);
    const fake = { naturalWidth: c.width, naturalHeight: c.height, _c: c }; Photo._img = imgEl; Photo._k = k; Photo._small = fake; return fake;
  },
};

// ---------------------------------------------------------------- the map maker page
Views.mapmaker = (el, r, pane) => {
  const entry = r.id ? M.entries.get(r.id) : null;
  const o = Views.mapmaker.pending || { ...MK.defaults(), ...structuredClone(entry?.map?.maker || {}) }; Views.mapmaker.pending = null;
  let tool = "look", info = {}, dirty = false, drag = null;
  const undo = [];
  const push = () => { undo.push(JSON.stringify({ s: o.strokes, t: o.stamps, l: o.labels, seed: o.seed })); if (undo.length > 60) undo.shift(); dirty = true; };
  const tools = [["look", "✋", tf("Look / move labels", "Разгледай / мести надписи")], ["draw", "✎", tf("Draw land", "Начертай суша")], ["cut", "✂", tf("Cut sea", "Изрежи море")], ["land", "▰", tf("Paint land", "Рисувай суша")], ["sea", "≈", tf("Paint sea", "Рисувай море")], ["raise", "▲", tf("Raise land", "Повдигни суша")], ["lower", "▼", tf("Lower land / dig sea", "Сниши / изкопай море")],
    ["m", "⛰", tf("Mountains", "Планини")], ["h", "◠", tf("Hills", "Хълмове")], ["f", "♣", tf("Forest", "Гора")], ["t", "◉", tf("Town", "Град")], ["c", "♜", tf("City or castle", "Град или замък")],
    ["x", "⌫", tf("Erase symbols", "Изтрий символи")], ["label", "A", tf("Label", "Надпис")]];
  const slider = (k, en, bg, min = 0, max = 100) => `<label class="small">${tf(en, bg)} <span class="faint" data-v="${k}">${o[k]}</span><input type="range" min="${min}" max="${max}" value="${o[k]}" data-s="${k}" style="width:100%"></label>`;
  el.innerHTML = paneHead(`✦ ${tf("Map maker", "Създаване на карта")}${entry ? " · " + esc(entry.title) : ""}`, `<div class="row"><button class="btn small ghost" data-undo>↶ ${tf("Undo", "Отмени")}</button>
      ${entry ? `<button class="btn small ghost" data-back>${tf("Back to the map", "Обратно към картата")}</button>` : ""}<button class="btn small primary" data-save>${entry ? tf("Save map", "Запази картата") : tf("Save as a new map", "Запази като нова карта")}</button></div>`, pane) + `
    <div class="pane-body flush"><div class="mk">
      <div class="mk-side">
        <div class="section-sub" style="margin-top:0">${tf("World", "Свят")}</div>
        <select class="input" data-shape>${o.trace ? `<option value="traced" selected>${tf("Traced from your map", "Прерисувана от вашата карта")}</option>` : ""}${Object.entries(MK.shapes).map(([k, v]) => `<option value="${k}" ${o.shape === k ? "selected" : ""}>${esc(tf(...v))}</option>`).join("")}</select>
        <div class="row" style="margin:6px 0"><button class="btn small" data-new style="flex:1">🎲 ${tf("New land", "Нова суша")}</button></div>
        <button class="btn small" data-trace style="width:100%;margin-bottom:6px">⇪ ${tf("Trace a map you have…", "Прерисувай ваша карта…")}</button>
        ${o.trace ? `<div class="faint small" style="margin-bottom:6px">${tf("Traced from your map. Land, sea, forests and mountains follow it; brushes still work.", "Прерисувана от вашата карта. Четките още работят.")} <a href="#" data-untrace>${tf("Stop tracing", "Без прерисуване")}</a></div>` : ""}
        ${slider("land", "Land", "Суша", 10, 90)}${slider("rough", "Rough coasts", "Назъбени брегове")}${slider("mountains", "Mountains", "Планини")}${slider("forests", "Forests", "Гори")}
        ${slider("rivers", "Rivers", "Реки", 0, 30)}${slider("regions", "Regions", "Области", 0, 16)}
        <label class="small">${tf("Brush size", "Размер на четката")}<input type="range" min="10" max="200" value="${M.state.mkBrush || 70}" data-brush style="width:100%"></label>
        <label class="small">${tf("Brush strength", "Сила на четката")}<input type="range" min="1" max="10" value="${M.state.mkStrength || 3}" data-strength style="width:100%"></label>
        <div class="section-sub">${tf("Reference picture", "Картина за образец")}</div>
        ${o.ref ? `<label class="small" style="display:block"><input type="checkbox" data-refshow ${o.ref.show !== false ? "checked" : ""}> ${tf("Show it over the map", "Покажи я върху картата")}</label>
          <label class="small">${tf("See-through", "Прозрачност")}<input type="range" min="10" max="90" value="${Math.round((o.ref.opacity ?? .45) * 100)}" data-refop style="width:100%"></label>
          <div class="row"><button class="btn small ghost" data-ref>${tf("Change", "Смени")}</button><button class="btn small ghost" data-refoff>${tf("Remove", "Махни")}</button></div>`
          : `<button class="btn small" data-ref style="width:100%">▣ ${tf("Add a reference picture…", "Добави картина за образец…")}</button>
          <div class="faint small" style="margin-top:4px">${tf("Your own map, shown see-through over the drawing so you can paint along it. It is never part of the saved map.", "Вашата карта, показана прозрачно върху рисунката, за да рисувате по нея. Никога не влиза в запазената карта.")}</div>`}
        <div class="section-sub">${tf("Look", "Вид")}</div>
        <select class="input" data-style><option value="parchment">${tf("Old parchment", "Стар пергамент")}</option><option value="atlas">${tf("Atlas colors", "Цветен атлас")}</option><option value="morgul">${tf("Dark (Morgul)", "Тъмна (Morgul)")}</option></select>
        ${[["regionTint", "Region colors", "Цветове на областите"], ["borders", "Borders", "Граници"], ["compass", "Compass", "Компас"], ["grid", "Grid", "Мрежа"]].map(([k, en, bg]) => `<label class="small" style="display:block"><input type="checkbox" data-c="${k}" ${o[k] ? "checked" : ""}> ${tf(en, bg)}</label>`).join("")}
        <div class="section-sub">${tf("Names", "Имена")}</div>
        <button class="btn small" data-names style="width:100%">✦ ${tf("Name the regions", "Именувай областите")}</button>
        <div class="faint small" style="margin-top:6px">${tf("Names come from your Languages' sample names, or your characters'. Double-click a label to change or delete it.", "Имената идват от примерните имена на езиците ви или от персонажите. Двоен клик върху надпис го променя или трие.")}</div>
      </div>
      <div class="mk-main"><div class="toolbar">${tools.map(([k, i, l], n) => `<button class="btn small ${k === tool ? "on" : ""}" data-tool="${k}" title="${esc(l)}">${i}${n < 7 || k === "label" ? ` <span class="small">${esc(l.split(" /")[0])}</span>` : ""}</button>`).join("")}
</div>
        <div class="mk-stage"><div class="mk-frame"><canvas data-cv></canvas><svg class="mk-lasso" data-lasso viewBox="0 0 1600 1100" preserveAspectRatio="none"></svg>${o.ref?.image ? `<img class="mk-ref" data-refimg src="${img(o.ref.image)}" style="opacity:${o.ref.opacity ?? .45};${o.ref.show === false ? "display:none" : ""}">` : ""}</div></div>
        <div class="faint small mk-hint" data-hint></div></div>
    </div></div>`;
  $("[data-style]", el).value = o.style;
  const cv = $("[data-cv]", el);
  let raf = 0; const draw = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { info = MK.render(cv, o); hint(); }); };
  const hint = () => {
    const h = { draw: tf("Draw a loop around an island or a coast with the mouse; when you let go, the inside becomes land. Trace it over a reference picture to copy your own map.", "Начертайте с мишката линия около остров или бряг; когато пуснете, вътрешността става суша. Може да я начертаете върху картина за образец."),
      cut: tf("Draw a loop to cut sea out of the land: bays, lakes, channels between islands.", "Начертайте линия, за да изрежете море: заливи, езера, проливи."), land: tf("Paint land where your reference has land: it becomes plain lowland, however often you paint over it.", "Рисувайте суша там, където образецът има суша."),
      sea: tf("Paint sea to cut coasts, bays and lakes.", "Рисувайте море за брегове, заливи и езера."), look: tf("Drag labels to move them. Double-click one to change it.", "Влачете надписите. Двоен клик ги променя."), raise: tf("Paint to raise land out of the sea, or make high ground higher.", "Рисувайте, за да издигнете суша."),
      lower: tf("Paint to lower land, cut bays or dig lakes and channels.", "Рисувайте, за да снишите сушата, да направите заливи или езера."), x: tf("Paint over mountains, hills, forests and towns to clear them.", "Минете върху символи, за да ги изчистите."),
      label: tf("Click where the name should go.", "Щракнете къде да е името.") }[tool] || tf("Click or drag to place.", "Щракнете или влачете, за да поставите.");
    $("[data-hint]", el).textContent = `${h}  ·  ${info.rivers ?? 0} ${tf("rivers", "реки")}  ·  ${tf("Map", "Карта")} ${MK.W}×${MK.H}`;
  };
  const pos = ev => { const b = cv.getBoundingClientRect(); return { x: (ev.clientX - b.left) * MK.W / b.width, y: (ev.clientY - b.top) * MK.H / b.height }; };
  const brush = () => +$("[data-brush]", el).value;
  const labelAt = p => [...o.labels].reverse().find(l => { const w = (l.text.length * (l.size || 22)) * .3 + 10; return Math.abs(l.x - p.x) < w && Math.abs(l.y - p.y) < (l.size || 22) * .7; });
  const editLabel = async (l) => {
    const res = await modal(tf("Label", "Надпис"), `<div class="form-grid"><label>${tf("Text", "Текст")}</label><input class="input" id="lt" value="${esc(l?.text || "")}">
      <label>${tf("Kind", "Вид")}</label><select class="input" id="lk">${[["place", "Place", "Място"], ["region", "Region (spaced capitals)", "Област (раздалечени главни)"], ["sea", "Sea or river (italic)", "Море или река (курсив)"]].map(([k, en, bg]) => `<option value="${k}" ${(l?.kind || "place") === k ? "selected" : ""}>${tf(en, bg)}</option>`).join("")}</select>
      <label>${tf("Size", "Размер")}</label><input class="input" type="number" id="ls" value="${l?.size || 24}" style="width:90px"><label>${tf("Tilt", "Наклон")}</label><input class="input" type="number" id="lr" value="${l?.rot || 0}" style="width:90px"></div>`,
      { buttons: [{ label: t("Cancel"), value: null }, ...(l ? [{ label: t("Delete"), value: "del" }] : []), { label: t("Save"), cls: "primary", value: ov => ({ text: $("#lt", ov).value.trim(), kind: $("#lk", ov).value, size: +$("#ls", ov).value || 24, rot: +$("#lr", ov).value || 0 }) }] });
    return res;
  };
  cv.onpointerdown = async ev => {
    const p = pos(ev);
    if (tool === "look") { const l = labelAt(p); if (l) { push(); drag = { l, dx: p.x - l.x, dy: p.y - l.y }; cv.setPointerCapture(ev.pointerId); } return; }
    if (tool === "draw" || tool === "cut") { drag = { lasso: [[Math.round(p.x), Math.round(p.y)]] }; cv.setPointerCapture(ev.pointerId); return; }
    if (tool === "label") { const r = await editLabel(null); if (r && r !== "del" && r.text) { push(); o.labels.push({ id: uid(), x: Math.round(p.x), y: Math.round(p.y), ...r }); draw(); } return; }
    push(); drag = { last: null }; cv.setPointerCapture(ev.pointerId); paint(p);
  };
  const paint = p => {
    if (drag?.last && Math.hypot(p.x - drag.last.x, p.y - drag.last.y) < (["raise", "lower", "x", "land", "sea"].includes(tool) ? brush() / 4 : 26)) return;
    drag.last = p; const R = brush();
    if (tool === "land" || tool === "sea") { o.strokes.push({ x: Math.round(p.x), y: Math.round(p.y), r: R, set: tool === "land" ? .12 : -.25 }); draw(); return; }
    if (tool === "raise" || tool === "lower") { const k = (+M.state.mkStrength || 3) / 3; o.strokes.push({ x: Math.round(p.x), y: Math.round(p.y), r: R, a: (tool === "raise" ? .16 : -.2) * k }); }
    else if (tool === "x") { o.stamps = o.stamps.filter(s => s.k === "x" || (s.x - p.x) ** 2 + (s.y - p.y) ** 2 > R * R); o.stamps.push({ k: "x", x: Math.round(p.x), y: Math.round(p.y), r: R }); }
    else o.stamps.push({ k: tool, x: Math.round(p.x + (Math.random() - .5) * 6), y: Math.round(p.y + (Math.random() - .5) * 6), s: tool === "m" ? 1.1 + Math.random() * .4 : 1 });
    draw();
  };
  const lassoSvg = $("[data-lasso]", el);
  const showLasso = pts => { lassoSvg.innerHTML = pts ? `<polygon points="${pts.map(q => q.join(",")).join(" ")}" class="${tool === "cut" ? "cut" : ""}"/>` : ""; };
  cv.onpointermove = ev => { if (!drag) return; const p = pos(ev);
    if (drag.lasso) { const l = drag.lasso[drag.lasso.length - 1]; if (Math.hypot(p.x - l[0], p.y - l[1]) > 6) { drag.lasso.push([Math.round(p.x), Math.round(p.y)]); showLasso(drag.lasso); } return; } if (drag.l) { drag.l.x = Math.round(p.x - drag.dx); drag.l.y = Math.round(p.y - drag.dy); draw(); } else paint(p); };
  cv.onpointerup = () => {
    if (drag?.lasso) { const pts = drag.lasso; showLasso(null);
      if (pts.length > 4) { push(); o.strokes.push({ poly: pts, set: tool === "draw" ? 1 : -1 }); dirty = true; draw(); } }
    drag = null; };
  cv.ondblclick = async ev => { const l = labelAt(pos(ev)); if (!l) return; const r = await editLabel(l); if (!r) return; push(); if (r === "del") o.labels = o.labels.filter(x => x !== l); else Object.assign(l, r); draw(); };
  $$("[data-tool]", el).forEach(b => b.onclick = () => { tool = b.dataset.tool; $$("[data-tool]", el).forEach(x => x.classList.toggle("on", x === b)); cv.style.cursor = tool === "look" ? "grab" : "crosshair"; hint(); });
  $("[data-brush]", el).oninput = e => { M.state.mkBrush = +e.target.value; saveState(); };
  $("[data-strength]", el).oninput = e => { M.state.mkStrength = +e.target.value; saveState(); };
  const setRef = async file0 => { const flat = await straighten(file0); if (!flat) return;
    const file = flat instanceof File ? flat : new File([flat], file0.name.replace(/\.[^.]+$/, "") + " (straightened).png", { type: "image/png" });
    const [f] = await Entry.upload([file]); if (!f) return; o.ref = { image: f, opacity: .45, show: true }; dirty = true; rerender(); };
  $("[data-ref]", el).onclick = () => { const i = document.createElement("input"); i.type = "file"; i.accept = "image/*"; i.onchange = () => i.files[0] && setRef(i.files[0]); i.click(); };
  $("[data-refoff]", el)?.addEventListener("click", () => { delete o.ref; dirty = true; rerender(); });
  $("[data-refshow]", el)?.addEventListener("change", e => { o.ref.show = e.target.checked; $("[data-refimg]", el).style.display = e.target.checked ? "" : "none"; });
  $("[data-refop]", el)?.addEventListener("input", e => { o.ref.opacity = +e.target.value / 100; $("[data-refimg]", el).style.opacity = o.ref.opacity; });
  $$("[data-s]", el).forEach(s => s.oninput = () => { o[s.dataset.s] = +s.value; $(`[data-v="${s.dataset.s}"]`, el).textContent = s.value; dirty = true; draw(); });
  $$("[data-c]", el).forEach(c => c.onchange = () => { o[c.dataset.c] = c.checked; dirty = true; draw(); });
  $("[data-shape]", el).onchange = e => { if (o.trace && e.target.value !== "traced") { push(); delete o.trace; MK._cache = null; } o.shape = e.target.value; dirty = true; o.trace ? draw() : rerender(); };
  $("[data-style]", el).onchange = e => { o.style = e.target.value; dirty = true; draw(); };
  $("[data-new]", el).onclick = async () => {
    if ((o.strokes.length || o.stamps.length) && !await modal(tf("New land", "Нова суша"), `<p>${tf("New land clears what you painted by hand (labels stay). ↶ Undo brings it back.", "Новата суша изчиства нарисуваното на ръка (надписите остават). ↶ Отмени го връща.")}</p>`,
      { buttons: [{ label: t("Cancel"), value: false }, { label: tf("New land", "Нова суша"), cls: "primary", value: true }] })) return;
    push(); o.seed = Math.floor(Math.random() * 1e9); o.strokes = []; o.stamps = []; draw();
  };
  // a photo of a paper map is straightened first (corners of the paper, turn); a picture from a map entry is used as it is
  const straighten = async file => { const u = URL.createObjectURL(file); try { return await Photo.dialog(u, file); } finally { setTimeout(() => URL.revokeObjectURL(u), 5000); } };
  const trace = async (src, fromImage) => {
    const tr = await Trace.dialog(src); if (!tr) return;
    if (fromImage) tr.fit = fromImage;      // pins, routes and layers on that picture move with it when saved
    if (fromImage && !o.ref) o.ref = { image: fromImage, opacity: .45, show: false };
    push(); o.trace = tr; o.shape = "traced"; o.strokes = []; o.stamps = []; o.rivers = Math.min(o.rivers, 4); MK._cache = null;
    if (entry || r.id) dirty = true; rerender();
  };
  const rerender = () => { const keep = structuredClone(o); Views.mapmaker.pending = keep; Views.mapmaker(el, r, pane); };
  $("[data-trace]", el).onclick = () => { const i = document.createElement("input"); i.type = "file"; i.accept = "image/*";
    i.onchange = async () => { const f = i.files[0]; if (!f) return; const flat = await straighten(f); if (!flat) return;
      // keep the straightened picture as the reference too, hidden at first, so you can compare and correct
      const [saved] = await Entry.upload([new File([flat], f.name.replace(/\.[^.]+$/, "") + " (straightened).png", { type: "image/png" })]);
      if (saved && !o.ref) o.ref = { image: saved, opacity: .45, show: false };
      trace(URL.createObjectURL(flat)); };
    i.click(); };
  $("[data-untrace]", el)?.addEventListener("click", ev => { ev.preventDefault(); push(); delete o.trace; o.shape = "continent"; MK._cache = null; rerender(); });
  if (r.trace && !o.trace && entry?.map?.image) { r.trace = false; setTimeout(() => trace(img(entry.map.image), entry.map.image), 50); }
  $("[data-undo]", el).onclick = () => { const u = undo.pop(); if (!u) return; const x = JSON.parse(u); o.strokes = x.s; o.stamps = x.t; o.labels = x.l; o.seed = x.seed ?? o.seed; draw(); };
  $("[data-names]", el).onclick = () => {
    const seeds = info.seeds || []; if (!seeds.length) return toast(tf("Add some regions first (the Regions slider).", "Първо добавете области."), "error");
    const names = worldNames(seeds.length + 4).filter(n => !o.labels.some(l => l.text === n)); push();
    o.labels = o.labels.filter(l => !l.auto);
    seeds.forEach((s, i) => names[i] && o.labels.push({ id: uid(), x: Math.round(s.x), y: Math.round(s.y), text: names[i], kind: "region", size: 26, auto: true }));
    draw();
  };
  $("[data-back]", el)?.addEventListener("click", () => Panes.show({ view: "map", id: entry.id }, pane));
  $("[data-save]", el).onclick = async ev => {
    ev.target.disabled = true;
    try {
      MK.render(cv, o);
      const blob = await new Promise(r => cv.toBlob(r, "image/png"));
      const cur = entry ? M.entries.get(entry.id) : null;
      let name = cur?.title;
      if (!cur) { name = await promptBox(tf("Name of the map", "Име на картата"), tf("The known world", "Познатият свят")); if (name === null) return; }
      const [file] = await Entry.upload([new File([blob], `${name || "map"} (map maker).png`, { type: "image/png" })]); if (!file) return;
      const maker = structuredClone(o);
      let mp = { ...(cur?.map || {}) };
      if (cur && o.trace?.fit && mp.image === o.trace.fit) {          // first save after tracing this map's own picture
        const k = Math.min(MK.W / o.trace.nw, MK.H / o.trace.nh), ox = (MK.W - o.trace.nw * k) / 2, oy = (MK.H - o.trace.nh * k) / 2;
        const P = ([x, y]) => [Math.round(ox + x * k), Math.round(oy + y * k)];
        mp = { ...mp, pins: (mp.pins || []).map(p => { const [x, y] = P([p.x, p.y]); return { ...p, x, y }; }), routes: (mp.routes || []).map(rt => ({ ...rt, pts: (rt.pts || []).map(P) })),
          layers: (mp.layers || []).map(l => ({ ...l, shapes: (l.shapes || []).map(sh => ({ ...sh, pts: (sh.pts || []).map(P) })) })), ...(mp.scale ? { scale: mp.scale / k } : {}) };
        maker.trace = { ...maker.trace, fit: null };
      }
      if (cur) { await saveEntry({ ...cur, map: { ...mp, image: file, maker } }, null, true); dirty = false; toast(tf("Map saved. Pins, routes and layers are kept.", "Картата е запазена. Пиновете, маршрутите и слоевете са запазени.")); Panes.show({ view: "map", id: cur.id }, pane); }
      else { const e = await createEntry("map", name || "Map", { map: { image: file, pins: [], layers: [], routes: [], maker }, status: "canon" }); dirty = false;
        toast(tf("Saved. Now add pins for your places.", "Запазено. Сега добавете пинове за местата.")); Panes.show({ view: "map", id: e.id }, pane); }
    } finally { ev.target.disabled = false; }
  };
  draw();
};

// deleting a map: asks first, then moves it to the Trash (Trash → Restore brings it back with its pins, routes and layers)
async function deleteMap(id, pane) {
  const e = M.entries.get(id); if (!e) return false;
  const pins = (e.map?.pins || []).length;
  if (!await confirmBox(tf(`Delete the map “${e.title}”${pins ? ` and its ${pins} ${pins === 1 ? "pin" : "pins"}` : ""}? It goes to the Trash, where you can restore it. The places on it are not deleted.`,
    `Да изтрия ли картата „${e.title}“${pins ? (pins === 1 ? " и нейния пин" : ` и нейните ${pins} пина`) : ""}? Отива в кошчето, откъдето може да се върне. Местата на нея не се трият.`), t("Delete"))) return false;
  await deleteEntry(id); toast(tf("Moved to the Trash.", "Преместено в кошчето.")); Nav.render();
  Panes.show({ view: "maps" }, pane); return true;
}

// entry points: Maps list and each map's page
(() => {
  const list = Views.maps;
  Views.maps = (el, r, pane) => {
    list(el, r, pane);
    const b = document.createElement("button"); b.className = "btn small"; b.innerHTML = `✦ ${tf("Make a map", "Създай карта")}`; b.onclick = () => Panes.show({ view: "mapmaker" }, pane);
    $("[data-new]", el)?.before(b);
    // a delete button on each map card
    $$("[data-map]", el).forEach(card => {
      const d = document.createElement("button"); d.className = "map-del"; d.innerHTML = "🗑"; d.dataset.tip = tf("Delete this map (it goes to the Trash)", "Изтрий картата (отива в кошчето)");
      d.onclick = ev => { ev.stopPropagation(); deleteMap(card.dataset.map, pane); }; card.append(d);
    });
    const empty = $(".empty", el); if (empty) empty.insertAdjacentHTML("beforeend", `<div style="margin-top:10px">${tf("No map yet? Press ✦ Make a map to draw one: land, sea, mountains, forests, rivers, regions and names.", "Нямате карта? ✦ Създай карта рисува една: суша, море, планини, гори, реки, области и имена.")}</div>`);
  };
  const one = Views.map;
  Views.map = (el, r, pane) => {
    one(el, r, pane);
    const e = M.entries.get(r.id); if (!e) return;
    const row = $(".pane-head .row", el) || $(".pane-head", el); if (!row) return;
    const b = document.createElement("button"); b.className = "btn small ghost";
    b.innerHTML = e.map?.maker ? `✦ ${tf("Edit in map maker", "Промени в създаването")}` : `⇪ ${tf("Trace into map maker", "Прерисувай в създаването")}`;
    b.title = e.map?.maker ? "" : tf("Reads land, sea, forests and mountains from this picture and makes an editable map. Pins are kept; your picture stays in the entry's history.", "Чете суша, море, гори и планини от картината и прави карта за редактиране. Пиновете остават.");
    b.onclick = () => Panes.show({ view: "mapmaker", id: e.id, trace: !e.map?.maker }, pane); row.prepend(b);
    const d = document.createElement("button"); d.className = "btn small ghost danger"; d.innerHTML = `🗑 ${t("Delete")}`; d.dataset.tip = tf("Delete this map; it goes to the Trash, where you can restore it.", "Изтрий картата; отива в кошчето, откъдето може да се върне.");
    d.onclick = () => deleteMap(e.id, pane); row.append(d);
  };
})();
