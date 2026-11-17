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
  shapes: { continent: ["One continent", "Един континент"], islands: ["A few islands", "Няколко острова"], archipelago: ["Archipelago", "Архипелаг"], coast: ["Coast (sea on one side)", "Бряг (море от едната страна)"], inland: ["All land (a region)", "Само суша (област)"], lakes: ["Land with lakes", "Суша с езера"] },

  // ---------------------------------------------------------------- the height map
  _cache: null,
  base(o) {
    const key = [o.seed, o.shape, o.land, o.rough].join("|");
    if (this._cache?.key === key) return this._cache;
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
  heights(o) {
    const b = this.base(o), h = Float32Array.from(b.h), { GW, GH } = b, span = Math.max(.05, b.top - b.sea);
    for (const s of o.strokes) {                 // hand-painted raise/lower, in image pixels
      const gx = s.x / this.S, gy = s.y / this.S, R = s.r / this.S, R2 = R * R, amt = s.a * span;
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
    const { GW, GH, el } = this.heights(o), rnd = this.rng(o.seed + 99), moist = this.noise(o.seed + 31);
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
      else if (e < mt - .05 && moist(x / 260, y / 260, 4) > 1 - o.forests / 100 * .72 && r < .85) sym.push({ k: "f", x, y, s: .8 + rnd() * .35 });
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

// ---------------------------------------------------------------- the map maker page
Views.mapmaker = (el, r, pane) => {
  const entry = r.id ? M.entries.get(r.id) : null;
  const o = { ...MK.defaults(), ...structuredClone(entry?.map?.maker || {}) };
  let tool = "look", info = {}, dirty = false, drag = null;
  const undo = [];
  const push = () => { undo.push(JSON.stringify({ s: o.strokes, t: o.stamps, l: o.labels, seed: o.seed })); if (undo.length > 60) undo.shift(); dirty = true; };
  const tools = [["look", "✋", tf("Look / move labels", "Разгледай / мести надписи")], ["raise", "▲", tf("Raise land", "Повдигни суша")], ["lower", "▼", tf("Lower land / dig sea", "Сниши / изкопай море")],
    ["m", "⛰", tf("Mountains", "Планини")], ["h", "◠", tf("Hills", "Хълмове")], ["f", "♣", tf("Forest", "Гора")], ["t", "◉", tf("Town", "Град")], ["c", "♜", tf("City or castle", "Град или замък")],
    ["x", "⌫", tf("Erase symbols", "Изтрий символи")], ["label", "A", tf("Label", "Надпис")]];
  const slider = (k, en, bg, min = 0, max = 100) => `<label class="small">${tf(en, bg)} <span class="faint" data-v="${k}">${o[k]}</span><input type="range" min="${min}" max="${max}" value="${o[k]}" data-s="${k}" style="width:100%"></label>`;
  el.innerHTML = paneHead(`✦ ${tf("Map maker", "Създаване на карта")}${entry ? " · " + esc(entry.title) : ""}`, `<div class="row"><button class="btn small ghost" data-undo>↶ ${tf("Undo", "Отмени")}</button>
      ${entry ? `<button class="btn small ghost" data-back>${tf("Back to the map", "Обратно към картата")}</button>` : ""}<button class="btn small primary" data-save>${entry ? tf("Save map", "Запази картата") : tf("Save as a new map", "Запази като нова карта")}</button></div>`, pane) + `
    <div class="pane-body flush"><div class="mk">
      <div class="mk-side">
        <div class="section-sub" style="margin-top:0">${tf("World", "Свят")}</div>
        <select class="input" data-shape>${Object.entries(MK.shapes).map(([k, v]) => `<option value="${k}" ${o.shape === k ? "selected" : ""}>${esc(tf(...v))}</option>`).join("")}</select>
        <div class="row" style="margin:6px 0"><button class="btn small" data-new style="flex:1">🎲 ${tf("New land", "Нова суша")}</button></div>
        ${slider("land", "Land", "Суша", 10, 90)}${slider("rough", "Rough coasts", "Назъбени брегове")}${slider("mountains", "Mountains", "Планини")}${slider("forests", "Forests", "Гори")}
        ${slider("rivers", "Rivers", "Реки", 0, 30)}${slider("regions", "Regions", "Области", 0, 16)}
        <label class="small">${tf("Brush size", "Размер на четката")}<input type="range" min="20" max="200" value="${M.state.mkBrush || 70}" data-brush style="width:100%"></label>
        <div class="section-sub">${tf("Look", "Вид")}</div>
        <select class="input" data-style><option value="parchment">${tf("Old parchment", "Стар пергамент")}</option><option value="atlas">${tf("Atlas colors", "Цветен атлас")}</option><option value="morgul">${tf("Dark (Morgul)", "Тъмна (Morgul)")}</option></select>
        ${[["regionTint", "Region colors", "Цветове на областите"], ["borders", "Borders", "Граници"], ["compass", "Compass", "Компас"], ["grid", "Grid", "Мрежа"]].map(([k, en, bg]) => `<label class="small" style="display:block"><input type="checkbox" data-c="${k}" ${o[k] ? "checked" : ""}> ${tf(en, bg)}</label>`).join("")}
        <div class="section-sub">${tf("Names", "Имена")}</div>
        <button class="btn small" data-names style="width:100%">✦ ${tf("Name the regions", "Именувай областите")}</button>
        <div class="faint small" style="margin-top:6px">${tf("Names come from your Languages' sample names, or your characters'. Double-click a label to change or delete it.", "Имената идват от примерните имена на езиците ви или от персонажите. Двоен клик върху надпис го променя или трие.")}</div>
      </div>
      <div class="mk-main"><div class="toolbar">${tools.map(([k, i, l]) => `<button class="btn small ${k === tool ? "on" : ""}" data-tool="${k}" title="${esc(l)}">${i} <span class="small">${esc(l.split(" /")[0])}</span></button>`).join("")}
</div>
        <div class="mk-stage"><canvas data-cv></canvas></div>
        <div class="faint small mk-hint" data-hint></div></div>
    </div></div>`;
  $("[data-style]", el).value = o.style;
  const cv = $("[data-cv]", el);
  let raf = 0; const draw = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { info = MK.render(cv, o); hint(); }); };
  const hint = () => {
    const h = { look: tf("Drag labels to move them. Double-click one to change it.", "Влачете надписите. Двоен клик ги променя."), raise: tf("Paint to raise land out of the sea, or make high ground higher.", "Рисувайте, за да издигнете суша."),
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
    if (tool === "label") { const r = await editLabel(null); if (r && r !== "del" && r.text) { push(); o.labels.push({ id: uid(), x: Math.round(p.x), y: Math.round(p.y), ...r }); draw(); } return; }
    push(); drag = { last: null }; cv.setPointerCapture(ev.pointerId); paint(p);
  };
  const paint = p => {
    if (drag?.last && Math.hypot(p.x - drag.last.x, p.y - drag.last.y) < (["raise", "lower", "x"].includes(tool) ? brush() / 4 : 26)) return;
    drag.last = p; const R = brush();
    if (tool === "raise" || tool === "lower") o.strokes.push({ x: Math.round(p.x), y: Math.round(p.y), r: R, a: tool === "raise" ? .16 : -.2 });
    else if (tool === "x") { o.stamps = o.stamps.filter(s => s.k === "x" || (s.x - p.x) ** 2 + (s.y - p.y) ** 2 > R * R); o.stamps.push({ k: "x", x: Math.round(p.x), y: Math.round(p.y), r: R }); }
    else o.stamps.push({ k: tool, x: Math.round(p.x + (Math.random() - .5) * 6), y: Math.round(p.y + (Math.random() - .5) * 6), s: tool === "m" ? 1.1 + Math.random() * .4 : 1 });
    draw();
  };
  cv.onpointermove = ev => { if (!drag) return; const p = pos(ev); if (drag.l) { drag.l.x = Math.round(p.x - drag.dx); drag.l.y = Math.round(p.y - drag.dy); draw(); } else paint(p); };
  cv.onpointerup = () => { drag = null; };
  cv.ondblclick = async ev => { const l = labelAt(pos(ev)); if (!l) return; const r = await editLabel(l); if (!r) return; push(); if (r === "del") o.labels = o.labels.filter(x => x !== l); else Object.assign(l, r); draw(); };
  $$("[data-tool]", el).forEach(b => b.onclick = () => { tool = b.dataset.tool; $$("[data-tool]", el).forEach(x => x.classList.toggle("on", x === b)); cv.style.cursor = tool === "look" ? "grab" : "crosshair"; hint(); });
  $("[data-brush]", el).oninput = e => { M.state.mkBrush = +e.target.value; saveState(); };
  $$("[data-s]", el).forEach(s => s.oninput = () => { o[s.dataset.s] = +s.value; $(`[data-v="${s.dataset.s}"]`, el).textContent = s.value; dirty = true; draw(); });
  $$("[data-c]", el).forEach(c => c.onchange = () => { o[c.dataset.c] = c.checked; dirty = true; draw(); });
  $("[data-shape]", el).onchange = e => { o.shape = e.target.value; dirty = true; draw(); };
  $("[data-style]", el).onchange = e => { o.style = e.target.value; dirty = true; draw(); };
  $("[data-new]", el).onclick = async () => {
    if ((o.strokes.length || o.stamps.length) && !await modal(tf("New land", "Нова суша"), `<p>${tf("New land clears what you painted by hand (labels stay). ↶ Undo brings it back.", "Новата суша изчиства нарисуваното на ръка (надписите остават). ↶ Отмени го връща.")}</p>`,
      { buttons: [{ label: t("Cancel"), value: false }, { label: tf("New land", "Нова суша"), cls: "primary", value: true }] })) return;
    push(); o.seed = Math.floor(Math.random() * 1e9); o.strokes = []; o.stamps = []; draw();
  };
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
      if (cur) { await saveEntry({ ...cur, map: { ...(cur.map || {}), image: file, maker } }, null, true); dirty = false; toast(tf("Map saved. Pins, routes and layers are kept.", "Картата е запазена. Пиновете, маршрутите и слоевете са запазени.")); Panes.show({ view: "map", id: cur.id }, pane); }
      else { const e = await createEntry("map", name || "Map", { map: { image: file, pins: [], layers: [], routes: [], maker }, status: "canon" }); dirty = false;
        toast(tf("Saved. Now add pins for your places.", "Запазено. Сега добавете пинове за местата.")); Panes.show({ view: "map", id: e.id }, pane); }
    } finally { ev.target.disabled = false; }
  };
  draw();
};

// entry points: Maps list and each map's page
(() => {
  const list = Views.maps;
  Views.maps = (el, r, pane) => {
    list(el, r, pane);
    const b = document.createElement("button"); b.className = "btn small"; b.innerHTML = `✦ ${tf("Make a map", "Създай карта")}`; b.onclick = () => Panes.show({ view: "mapmaker" }, pane);
    $("[data-new]", el)?.before(b);
    const empty = $(".empty", el); if (empty) empty.insertAdjacentHTML("beforeend", `<div style="margin-top:10px">${tf("No map yet? Press ✦ Make a map to draw one: land, sea, mountains, forests, rivers, regions and names.", "Нямате карта? ✦ Създай карта рисува една: суша, море, планини, гори, реки, области и имена.")}</div>`);
  };
  const one = Views.map;
  Views.map = (el, r, pane) => {
    one(el, r, pane);
    const e = M.entries.get(r.id); if (!e) return;
    const row = $(".pane-head .row", el) || $(".pane-head", el); if (!row) return;
    const b = document.createElement("button"); b.className = "btn small ghost";
    b.innerHTML = e.map?.maker ? `✦ ${tf("Edit in map maker", "Промени в създаването")}` : `✦ ${tf("Redraw in map maker", "Нарисувай наново")}`;
    b.title = e.map?.maker ? "" : tf("Makes a new drawn map for this entry; your picture stays in the entry's history and pins are kept.", "Прави нова нарисувана карта за този запис; пиновете остават.");
    b.onclick = () => Panes.show({ view: "mapmaker", id: e.id }, pane); row.prepend(b);
  };
})();
