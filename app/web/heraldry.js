// Heraldry: a coat-of-arms maker. Arms are stored on the entry (e.arms) and drawn as SVG, so they stay sharp anywhere.
"use strict";

const HER = {
  tinctures: {
    or: ["#D9B24C", "Or", "златно"], argent: ["#E9E6DD", "Argent", "сребърно"], gules: ["#A3262A", "Gules", "червено"], azure: ["#2B4C8C", "Azure", "синьо"],
    vert: ["#2F6B3A", "Vert", "зелено"], sable: ["#1B1B1B", "Sable", "черно"], purpure: ["#6B3A78", "Purpure", "пурпурно"], tenne: ["#B5652B", "Tenné", "оранжево"],
    sanguine: ["#6E1F23", "Sanguine", "кърваво"], cendree: ["#7D8A86", "Cendrée", "пепеляво"],
  },
  shields: {
    heater: ["Heater", "Класически", "M10,10 H190 V110 C190,175 140,210 100,232 C60,210 10,175 10,110 Z"],
    round: ["Round", "Кръгъл", "M100,12 A108,108 0 1,1 99.9,12 Z"],
    kite: ["Kite", "Норманско", "M100,8 C160,8 190,30 190,70 C190,140 140,200 100,236 C60,200 10,140 10,70 C10,30 40,8 100,8 Z"],
    square: ["Square", "Квадратен", "M14,12 H186 V200 Q100,236 14,200 Z"],
    banner: ["Banner", "Знаме", "M20,6 H180 V236 L100,196 L20,236 Z"],
    lozenge: ["Lozenge", "Ромб", "M100,4 L194,120 L100,236 L6,120 Z"],
  },
  divisions: {
    plain: ["Plain", "Едноцветен", ""],
    pale: ["Per pale", "Разделен вертикално", "M100,0 H200 V240 H100 Z"],
    fess: ["Per fess", "Разделен хоризонтално", "M0,120 H200 V240 H0 Z"],
    bend: ["Per bend", "Разделен диагонално", "M0,0 L200,240 H0 Z"],
    bendSinister: ["Per bend sinister", "Разделен обратно диагонално", "M200,0 L0,240 H200 Z"],
    chevron: ["Per chevron", "Разделен с шеврон", "M0,240 L100,110 L200,240 Z"],
    quarterly: ["Quarterly", "Четвъртит", "M100,0 H200 V120 H100 Z M0,120 H100 V240 H0 Z"],
    saltire: ["Per saltire", "Разделен кръстосано", "M0,0 L100,120 L0,240 Z M200,0 L100,120 L200,240 Z"],
    gyronny: ["Gyronny", "Лъчист", "M100,120 L100,0 H200 Z M100,120 L200,120 V240 Z M100,120 L100,240 H0 Z M100,120 L0,120 V0 Z"],
    paly: ["Paly", "Ивичест вертикално", "M33,0 H66 V240 H33 Z M100,0 H133 V240 H100 Z M166,0 H200 V240 H166 Z"],
    barry: ["Barry", "Ивичест хоризонтално", "M0,30 H200 V60 H0 Z M0,90 H200 V120 H0 Z M0,150 H200 V180 H0 Z M0,210 H200 V240 H0 Z"],
    chequy: ["Chequy", "Шахматен", Array.from({ length: 48 }, (_, i) => { const x = i % 6, y = Math.floor(i / 6); return (x + y) % 2 ? `M${x * 34},${y * 30} h34 v30 h-34 Z` : ""; }).join(" ")],
  },
  ordinaries: {
    none: ["None", "Без", ""],
    fess: ["A fess", "хоризонтална лента", "M0,92 H200 V148 H0 Z"],
    pale: ["A pale", "вертикална лента", "M72,0 H128 V240 H72 Z"],
    bend: ["A bend", "диагонална лента", "M-10,18 L18,-10 L210,222 L182,250 Z"],
    chevron: ["A chevron", "шеврон", "M0,190 L100,80 L200,190 L200,225 L100,115 L0,225 Z"],
    cross: ["A cross", "кръст", "M80,0 H120 V100 H200 V140 H120 V240 H80 V140 H0 V100 H80 Z"],
    saltire: ["A saltire", "андреевски кръст", "M-10,14 L14,-10 L100,96 L186,-10 L210,14 L124,120 L210,226 L186,250 L100,144 L14,250 L-10,226 L76,120 Z"],
    chief: ["A chief", "глава на щита", "M0,0 H200 V64 H0 Z"],
    bordure: ["A bordure", "кайма", "bordure"],
    pile: ["A pile", "клин", "M40,0 H160 L100,170 Z"],
    pall: ["A pall", "вилица", "M-10,14 L14,-10 L100,82 L186,-10 L210,14 L120,108 V240 H80 V108 Z"],
  },
  // simple original shapes, drawn around 0,0 within about ±22
  charges: {
    none: ["None", "Без", ""],
    star: ["star", "звезда", '<path d="M0,-22 L6,-7 L21,-7 L9,3 L13,19 L0,9 L-13,19 L-9,3 L-21,-7 L-6,-7 Z"/>'],
    mullet6: ["six-pointed star", "шестолъчна звезда", '<path d="M0,-22 L6,-10 L19,-11 L12,0 L19,11 L6,10 L0,22 L-6,10 L-19,11 L-12,0 L-19,-11 L-6,-10 Z"/>'],
    crescent: ["crescent", "полумесец", '<path d="M-14,-14 A20,20 0 1,0 14,-14 A15,15 0 1,1 -14,-14 Z"/>'],
    sun: ["sun", "слънце", '<circle r="10"/><path d="' + Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6, b = a + .13, c = a - .13; return `M${(Math.cos(c) * 12).toFixed(1)},${(Math.sin(c) * 12).toFixed(1)} L${(Math.cos(a) * 22).toFixed(1)},${(Math.sin(a) * 22).toFixed(1)} L${(Math.cos(b) * 12).toFixed(1)},${(Math.sin(b) * 12).toFixed(1)} Z`; }).join(" ") + '"/>'],
    tower: ["tower", "кула", '<path fill-rule="evenodd" d="M-14,22 V-12 H-18 V-22 H-11 V-17 H-4 V-22 H4 V-17 H11 V-22 H18 V-12 H14 V22 Z M-5,22 V10 A5,5 0 0,1 5,10 V22 Z M-3,-6 h6 v8 h-6 Z"/>'],
    sword: ["sword", "меч", '<path d="M-2.5,-24 L0,-28 L2.5,-24 V8 H-2.5 Z M-12,8 H12 V12 H-12 Z M-2,12 H2 V22 H-2 Z"/><circle cy="25" r="3.5"/>'],
    key: ["key", "ключ", '<path fill-rule="evenodd" d="M-2.5,-12 V24 H6 V19 H2 V15 H7 V10 H2.5 V-12 A10,10 0 1,0 -2.5,-12 Z M0,-28 A6,6 0 1,1 -0.1,-28 Z" transform="translate(0,6)"/>'],
    crown: ["crown", "корона", '<path d="M-20,14 V-10 L-10,2 L0,-16 L10,2 L20,-10 V14 Z"/><circle cx="-20" cy="-12" r="3"/><circle cy="-18" r="3"/><circle cx="20" cy="-12" r="3"/>'],
    tree: ["tree", "дърво", '<path d="M-3,22 V4 H3 V22 Z"/><circle cy="-6" r="15"/>'],
    eye: ["eye", "око", '<path fill-rule="evenodd" d="M-24,0 Q0,-22 24,0 Q0,22 -24,0 Z M0,-9 A9,9 0 1,0 0.1,-9 Z"/><circle r="4"/>'],
    skull: ["skull", "череп", '<path fill-rule="evenodd" d="M-16,0 A16,16 0 1,1 16,0 V8 H8 V18 H-8 V8 H-16 Z M-10,-2 A5,5 0 1,0 -0.1,-2 Z M10,-2 A5,5 0 1,1 0.1,-2 Z M-1.5,6 h3 v5 h-3 Z"/>'],
    roundel: ["roundel", "кръг", '<circle r="18"/>'],
    lozenge: ["lozenge", "ромб", '<path d="M0,-22 L15,0 L0,22 L-15,0 Z"/>'],
    cross: ["cross", "кръст", '<path d="M-5,-22 H5 V-5 H22 V5 H5 V22 H-5 V5 H-22 V-5 H-5 Z"/>'],
    mountain: ["mountain", "планина", '<path d="M-24,18 L-6,-14 L2,-2 L10,-18 L26,18 Z"/>'],
    flame: ["flame", "пламък", '<path d="M0,-24 C8,-12 18,-4 14,10 C11,20 -11,20 -14,10 C-17,-1 -6,-6 -4,-14 C0,-8 2,-6 0,-24 Z"/>'],
    wing: ["wing", "крило", '<path d="M-18,18 C-20,-4 -6,-20 20,-22 C12,-14 14,-12 8,-8 C14,-8 14,-4 6,0 C12,0 10,4 2,6 C6,8 2,12 -4,12 Z"/>'],
    hand: ["hand", "ръка", '<path d="M-10,22 V2 L-16,-6 L-12,-9 L-6,-2 V-18 A3,3 0 0,1 0,-18 V-4 V-22 A3,3 0 0,1 6,-22 V-4 V-18 A3,3 0 0,1 12,-18 V8 C12,16 8,22 4,22 Z"/>'],
    anchor: ["anchor", "котва", '<path fill-rule="evenodd" d="M-2.5,-14 V14 C-10,13 -15,8 -16,2 L-20,4 L-16,-6 L-10,0 L-13,1 C-12,6 -8,9 -2.5,10 Z M2.5,-14 V14 C10,13 15,8 16,2 L20,4 L16,-6 L10,0 L13,1 C12,6 8,9 2.5,10 Z M-10,-14 H10 V-10 H-10 Z M0,-26 A5,5 0 1,1 -0.1,-26 Z M0,-23 A2.5,2.5 0 1,0 0.1,-23 Z"/>'],
    bird: ["bird", "птица", '<path d="M-22,-4 C-12,-14 -4,-10 0,-2 C4,-10 12,-14 22,-4 C14,-6 8,-2 4,4 L8,16 L0,10 L-8,16 L-4,4 C-8,-2 -14,-6 -22,-4 Z"/>'],
    wolf: ["wolf's head", "вълча глава", '<path d="M-14,-20 L-6,-8 H6 L14,-20 L16,-2 L24,10 L8,14 L4,22 H-4 L-8,14 L-24,10 L-16,-2 Z"/>'],
  },
  counts: { 1: [[100, 122, 1.45]], 2: [[66, 112, 1], [134, 112, 1]], 3: [[64, 88, .9], [136, 88, .9], [100, 162, .9]], 4: [[64, 82, .78], [136, 82, .78], [64, 150, .78], [136, 150, .78]] },
  defaults: () => ({ shield: "heater", division: "plain", t1: "sable", t2: "argent", ordinary: "none", ot: "or", charge: "star", ct: "argent", count: 1, motto: "",
    dx: 0, dy: 0, size: 1, chargeImg: "", recolor: true, full: "" }),
  // where the figures sit (before moving): the middle of their layout
  centerOf(a) { let pos = HER.counts[a.count] || HER.counts[1]; if (a.ordinary === "chief") pos = pos.map(([x, y, s]) => [x, y + 18, s * .9]);
    return [pos.reduce((t, p) => t + p[0], 0) / pos.length, pos.reduce((t, p) => t + p[1], 0) / pos.length]; },
  color: k => (HER.tinctures[k] || HER.tinctures.sable)[0],
  svg(a, size = 120) {
    a = { ...HER.defaults(), ...(a || {}) };
    const id = "h" + Math.random().toString(36).slice(2, 8), shield = (HER.shields[a.shield] || HER.shields.heater)[2];
    const div = (HER.divisions[a.division] || ["", "", ""])[2];
    const ord = (HER.ordinaries[a.ordinary] || ["", "", ""])[2];
    let ordSvg = "";
    if (ord === "bordure") ordSvg = `<path d="${shield}" fill="none" stroke="${HER.color(a.ot)}" stroke-width="34"/>`;
    else if (ord) ordSvg = `<path d="${ord}" fill="${HER.color(a.ot)}"/>`;
    // the figure: a built-in shape, or your own picture (kept in its colours, or painted in the chosen colour through its transparency)
    const own = a.charge === "img" && a.chargeImg;
    let ch = own ? (a.recolor ? `<rect x="-22" y="-22" width="44" height="44" fill="${HER.color(a.ct)}" mask="url(#${id}k)"/>` : `<image href="${img(a.chargeImg)}" x="-22" y="-22" width="44" height="44" preserveAspectRatio="xMidYMid meet"/>`)
      : (HER.charges[a.charge] || ["", "", ""])[2];
    let pos = HER.counts[a.count] || HER.counts[1];
    if (a.ordinary === "chief") pos = pos.map(([x, y, s]) => [x, y + 18, s * .9]);
    const [gx, gy] = HER.centerOf(a), sz = +a.size || 1;
    const charges = ch ? `<g data-charges="1" transform="translate(${gx + (+a.dx || 0)},${gy + (+a.dy || 0)}) scale(${sz}) translate(${-gx},${-gy})">${pos.map(([x, y, s]) => `<g transform="translate(${x},${y}) scale(${s})" fill="${HER.color(a.ct)}" stroke="${own ? "none" : "#0007"}" stroke-width="1">${ch}</g>`).join("")}</g>` : "";
    const motto = a.motto ? `<path id="${id}m" d="M20,254 Q100,272 180,254" fill="none"/><path d="M8,244 Q100,266 192,244 L196,262 Q100,284 4,262 Z" fill="#E9E6DD" stroke="#3b2f22" stroke-width="1.5"/>
      <text font-family="Georgia, serif" font-size="13" font-style="italic" fill="#2b2118" text-anchor="middle"><textPath href="#${id}m" startOffset="50%">${esc(a.motto)}</textPath></text>` : "";
    if (a.full) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 ${a.motto ? 284 : 240}" width="${size}" height="${Math.round(size * (a.motto ? 284 : 240) / 200)}" class="arms">
      <image href="${img(a.full)}" x="0" y="0" width="200" height="240" preserveAspectRatio="xMidYMid meet"/>${motto}</svg>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 ${a.motto ? 284 : 240}" width="${size}" height="${Math.round(size * (a.motto ? 284 : 240) / 200)}" class="arms">
      <defs><clipPath id="${id}"><path d="${shield}"/></clipPath>${own && a.recolor ? `<mask id="${id}k" maskUnits="userSpaceOnUse" x="-23" y="-23" width="46" height="46" style="mask-type:alpha"><image href="${img(a.chargeImg)}" x="-22" y="-22" width="44" height="44" preserveAspectRatio="xMidYMid meet"/></mask>` : ""}<linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient></defs>
      <g clip-path="url(#${id})"><rect width="200" height="240" fill="${HER.color(a.t1)}"/>${div ? `<path d="${div}" fill="${HER.color(a.t2)}"/>` : ""}${ordSvg}${charges}<rect width="200" height="240" fill="url(#${id}g)"/></g>
      <path d="${shield}" fill="none" stroke="#000" stroke-opacity=".7" stroke-width="3"/>${motto}</svg>`;
  },
  // the written description (blazon); English uses heraldic terms, Bulgarian plain words
  blazon(a) {
    a = { ...HER.defaults(), ...(a || {}) }; const bg = M.settings.language === "bg";
    if (a.full) return tf("Your own picture", "Ваша картина") + (a.motto ? ` · “${a.motto}”` : "");
    if (a.charge === "img") a = { ...a, charge: "none", _own: true };
    const T = k => { const x = HER.tinctures[k] || HER.tinctures.sable; return bg ? x[2] : x[1].toLowerCase(); };
    const parts = [];
    const d = HER.divisions[a.division] || HER.divisions.plain;
    if (bg) {          // plain Bulgarian: "Поле: синьо · диагонална лента в сребърно · вълча глава ×3 в зелено"
      parts.push(a.division === "plain" ? `Поле: ${T(a.t1)}` : `${d[1]}: ${T(a.t1)} и ${T(a.t2)}`);
      if (a.ordinary !== "none") parts.push(`${HER.ordinaries[a.ordinary][1]} в ${T(a.ot)}`);
      if (a.charge !== "none") parts.push(`${HER.charges[a.charge][1]}${+a.count > 1 ? " ×" + a.count : ""} в ${T(a.ct)}`);
      return parts.join(" · ") + (a.motto ? ` · „${a.motto}“` : "");
    }
    parts.push(a.division === "plain" ? (bg ? `Щит ${T(a.t1)}` : T(a.t1)[0].toUpperCase() + T(a.t1).slice(1)) : `${bg ? d[1] : d[0]} ${T(a.t1)} ${bg ? "и" : "and"} ${T(a.t2)}`);
    if (a.ordinary !== "none") { const o = HER.ordinaries[a.ordinary]; parts.push(`${bg ? o[1] : o[0].toLowerCase()} ${T(a.ot)}`); }
    if (a.charge !== "none") {
      const c = HER.charges[a.charge], n = +a.count;
      const plural = w => w === "wolf's head" ? "wolves' heads" : /(s|sh|ch|x)$/.test(w) ? w + "es" : w + "s";
      const word = bg ? c[1] : n > 1 ? plural(c[0]) : c[0];
      const num = bg ? ["", "", "две", "три", "четири"][n] : ["", "a", "two", "three", "four"][n];
      parts.push(`${n === 1 && bg ? "" : num + " "}${word} ${T(a.ct)}`.trim());
    }
    if (a._own) parts.push(`${["", "", tf("two", "две"), tf("three", "три"), tf("four", "четири")][+a.count] || ""} ${tf("figures of your own", "ваши фигури")}${a.recolor ? " " + T(a.ct) : ""}`.trim());
    return parts.join(", ") + (a.motto ? ` · “${a.motto}”` : "");
  },
  random(seedTitle = "") {
    const pick = o => { const k = Object.keys(o); return k[Math.floor(Math.random() * k.length)]; };
    const metals = ["or", "argent"], colors = ["gules", "azure", "vert", "sable", "purpure", "sanguine", "tenne", "cendree"];
    const one = arr => arr[Math.floor(Math.random() * arr.length)];
    // the old rule of tincture: metal on colour, colour on metal
    const fieldMetal = Math.random() < .4, t1 = fieldMetal ? one(metals) : one(colors);
    const division = Math.random() < .3 ? "plain" : Math.random() < .6 ? one(["pale", "fess", "bend", "quarterly", "chevron", "saltire"]) : pick(HER.divisions);
    const t2 = fieldMetal ? one(colors) : one(metals);
    const ordinary = Math.random() < .45 ? "none" : one(Object.keys(HER.ordinaries).filter(k => k !== "none"));
    const ot = fieldMetal ? one(colors) : one(metals);
    const charge = Math.random() < .12 ? "none" : one(Object.keys(HER.charges).filter(k => k !== "none"));
    const ct = ordinary === "none" ? (fieldMetal ? one(colors) : one(metals)) : (fieldMetal ? one(metals.filter(m => m !== t1)) || "argent" : one(colors));
    const count = ordinary === "cross" || ordinary === "saltire" ? one([1, 4]) : one([1, 1, 1, 2, 3, 3]);
    return { shield: Math.random() < .7 ? "heater" : pick(HER.shields), division, t1, t2, ordinary, ot, charge, ct, count, motto: "" };
  },
  types: ["faction", "character", "location", "government", "religion", "culture", "deity", "species"],
  // the editor; resolves with the arms (or null)
  async edit(start, title = "") {
    let a = { ...HER.defaults(), ...(start || HER.random()) };
    const sel = (key, table, bgIdx = 1) => `<select class="input" data-k="${key}">${Object.entries(table).map(([k, v]) => `<option value="${k}" ${String(a[key]) === k ? "selected" : ""}>${esc(M.settings.language === "bg" ? v[bgIdx] : v[0])}</option>`).join("")}</select>`;
    const tin = key => `<div class="her-tins" data-t="${key}">${Object.entries(HER.tinctures).map(([k, v]) => `<span class="her-tin ${a[key] === k ? "on" : ""}" data-v="${k}" title="${esc(M.settings.language === "bg" ? v[2] : v[1])}" style="background:${v[0]}"></span>`).join("")}</div>`;
    const res = await modal(`⛨ ${tf("Coat of arms", "Герб")}${title ? " · " + esc(title) : ""}`, `<div class="grid" style="grid-template-columns:220px minmax(0,1fr);gap:18px;align-items:start">
        <div style="text-align:center"><div data-prev class="her-prev"></div><div class="small faint" data-blz style="margin-top:6px"></div>
          <button class="btn small" data-rand style="margin-top:8px">🎲 ${tf("Random", "Случаен")}</button>
          <div style="margin-top:10px"><button class="btn small ghost" data-full>▣ ${a.full ? tf("Design it instead", "Създай го тук") : tf("Use a picture of the whole arms…", "Цял герб от картина…")}</button></div></div>
        <div class="form-grid her-form">
          <label>${tf("Shape", "Форма")}</label>${sel("shield", HER.shields)}
          <label>${tf("Field", "Поле")}</label><div>${sel("division", HER.divisions)}${tin("t1")}${tin("t2")}</div>
          <label>${tf("Band or cross", "Лента или кръст")}</label><div>${sel("ordinary", HER.ordinaries)}${tin("ot")}</div>
          <label>${tf("Charge", "Фигура")}</label><div class="row"><select class="input" data-k="charge">${Object.entries(HER.charges).map(([k, v]) => `<option value="${k}" ${a.charge === k ? "selected" : ""}>${esc(M.settings.language === "bg" ? v[1] : v[0])}</option>`).join("")}<option value="img" ${a.charge === "img" ? "selected" : ""}>${tf("My own picture…", "Моя картина…")}</option></select><select class="input" data-k="count" style="width:auto">${[1, 2, 3, 4].map(n => `<option ${+a.count === n ? "selected" : ""}>${n}</option>`).join("")}</select></div><div></div>${tin("ct")}
          <label class="her-own">${tf("Own picture", "Моя картина")}</label><div class="her-own"><div class="row"><button class="btn small" data-chimg>⇪ ${tf("Choose PNG or SVG…", "Избери PNG или SVG…")}</button>
            <label class="small"><input type="checkbox" data-recolor ${a.recolor ? "checked" : ""}> ${tf("Paint it in the chosen colour", "Оцвети в избрания цвят")}</label></div>
            <div class="faint small">${tf("Painting works best for pictures with a transparent background; unticked, your picture keeps its own colours.", "Оцветяването работи най-добре с прозрачен фон; без отметка картината пази цветовете си.")}</div></div>
          <label>${tf("Position", "Позиция")}</label><div><div class="row"><button class="btn small ghost" data-cx>⇔ ${tf("Center horizontally", "Центрирай хоризонтално")}</button><button class="btn small ghost" data-cy>⇕ ${tf("Center vertically", "Центрирай вертикално")}</button><button class="btn small ghost" data-c0>${tf("Reset", "Нулирай")}</button></div>
            <label class="small">${tf("Size", "Размер")} <input type="range" min="40" max="220" value="${Math.round((+a.size || 1) * 100)}" data-size style="width:160px"></label>
            <div class="faint small">${tf("Drag the figures on the preview to move them.", "Влачете фигурите в прегледа, за да ги местите.")}</div></div>
          <label class="her-motto">${tf("Motto", "Девиз")}</label><input class="input her-motto" data-k="motto" value="${esc(a.motto)}" placeholder="${tf("optional", "по избор")}">
        </div></div>
        <div class="faint small" style="margin-top:8px">${tf("Old heralds kept metals (gold, silver) off metals and colours off colours so arms read from far away. 🎲 follows that rule; you don't have to.", "Старите хералдици не слагат метал върху метал и цвят върху цвят, за да се вижда отдалеч. 🎲 следва правилото; вие не сте длъжни.")}</div>`,
      { wide: true, buttons: [{ label: t("Cancel"), value: null }, ...(start ? [{ label: tf("Remove", "Премахни"), value: "remove" }] : []), { label: t("Save"), cls: "primary", value: "save" }],
        onOpen: ov => {
          const draw = () => {
            $("[data-prev]", ov).innerHTML = HER.svg(a, 190); $("[data-blz]", ov).textContent = HER.blazon(a);
            $$("[data-t]", ov).forEach(g => $$(".her-tin", g).forEach(s => s.classList.toggle("on", s.dataset.v === a[g.dataset.t])));
            $$("[data-k]", ov).forEach(i => { if (i.value !== String(a[i.dataset.k])) i.value = a[i.dataset.k]; });
            $("[data-t=t2]", ov).style.display = a.division === "plain" ? "none" : "";
            $("[data-t=ot]", ov).style.display = a.ordinary === "none" ? "none" : "";
            $("[data-t=ct]", ov).style.display = a.charge === "none" || (a.charge === "img" && !a.recolor) ? "none" : "";
            $$(".her-own", ov).forEach(x => x.style.display = a.charge === "img" ? "" : "none");
            $$(".her-form > :not(.her-motto)", ov).forEach(x => x.classList.toggle("dim", !!a.full));
            $("[data-full]", ov).innerHTML = `▣ ${a.full ? tf("Design it instead", "Създай го тук") : tf("Use a picture of the whole arms…", "Цял герб от картина…")}`;
            $("[data-size]", ov).value = Math.round((+a.size || 1) * 100);
            // drag the figures
            const svg = $("[data-prev] svg", ov), g = svg?.querySelector("[data-charges]");
            if (g) { svg.style.cursor = "grab"; svg.onpointerdown = ev => { ev.preventDefault(); const k = 200 / svg.getBoundingClientRect().width, sx = ev.clientX, sy = ev.clientY, ox = +a.dx || 0, oy = +a.dy || 0;
              const mv = e2 => { a.dx = Math.round(ox + (e2.clientX - sx) * k); a.dy = Math.round(oy + (e2.clientY - sy) * k); g.setAttribute("transform", g.getAttribute("transform").replace(/^translate\([^)]*\)/, `translate(${HER.centerOf(a)[0] + a.dx},${HER.centerOf(a)[1] + a.dy})`)); };
              const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); draw(); };
              window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); }; }
          };
          const pickFile = () => new Promise(res => { const i = document.createElement("input"); i.type = "file"; i.accept = ".png,.svg,image/png,image/svg+xml"; i.onchange = async () => res(i.files[0] ? (await Entry.upload([i.files[0]]))[0] : null); i.click(); });
          $("[data-chimg]", ov).onclick = async () => { const f = await pickFile(); if (f) { a.chargeImg = f; a.charge = "img"; draw(); } };
          $("[data-recolor]", ov).onchange = e => { a.recolor = e.target.checked; draw(); };
          $("[data-cx]", ov).onclick = () => { a.dx = 100 - HER.centerOf(a)[0]; draw(); };
          $("[data-cy]", ov).onclick = () => { a.dy = 118 - HER.centerOf(a)[1]; draw(); };
          $("[data-c0]", ov).onclick = () => { a.dx = 0; a.dy = 0; a.size = 1; draw(); };
          $("[data-size]", ov).oninput = e => { a.size = +e.target.value / 100; draw(); };
          $("[data-full]", ov).onclick = async () => { if (a.full) { a.full = ""; draw(); return; } const f = await pickFile(); if (f) { a.full = f; draw(); } };
          $$("[data-k]", ov).forEach(i => i.oninput = async () => { a[i.dataset.k] = i.dataset.k === "count" ? +i.value : i.value;
            if (i.dataset.k === "charge" && i.value === "img" && !a.chargeImg) { const f = await pickFile(); if (f) a.chargeImg = f; else a.charge = "star"; }
            draw(); });
          $$("[data-t]", ov).forEach(g => g.onclick = ev => { const s = ev.target.closest(".her-tin"); if (s) { a[g.dataset.t] = s.dataset.v; draw(); } });
          $("[data-rand]", ov).onclick = () => { a = { ...HER.defaults(), ...HER.random(), motto: a.motto, shield: a.shield, chargeImg: a.chargeImg, recolor: a.recolor }; draw(); };
          draw();
        } });
    if (res === "remove") return "remove";
    return res === "save" ? a : null;
  },
  async editEntry(id) {
    const e = M.entries.get(id); if (!e) return;
    const a = await HER.edit(e.arms, e.title); if (!a) return;
    const cur = M.entries.get(id), next = { ...cur }; if (a === "remove") delete next.arms; else next.arms = a;
    await saveEntry(next, null, false); Panes.refresh();
  },
  // a PNG of the arms, added to the entry's images (so it shows in the gallery, exports and the World Bible)
  async toImage(id) {
    const e = M.entries.get(id); if (!e?.arms) return;
    let svg = HER.svg(e.arms, 600);
    for (const m of [...new Set(svg.match(/href="([^"#][^"]*)"/g) || [])]) {
      const u = m.slice(6, -1), b = await fetch(u).then(r => r.blob()), d = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
      svg = svg.split(`href="${u}"`).join(`href="${d}"`);
    }
    const blob = new Blob([svg], { type: "image/svg+xml" }), url = URL.createObjectURL(blob);
    const im = new Image(); await new Promise((ok, no) => { im.onload = ok; im.onerror = no; im.src = url; });
    const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; c.getContext("2d").drawImage(im, 0, 0); URL.revokeObjectURL(url);
    const png = await new Promise(r => c.toBlob(r, "image/png"));
    const [file] = await Entry.upload([new File([png], `${e.title} arms.png`, { type: "image/png" })]); if (!file) return;
    const cur = M.entries.get(id); await saveEntry({ ...cur, images: [...(cur.images || []), file] }, null, false);
    toast(tf("Added to the entry's images.", "Добавено към изображенията на записа.")); Panes.refresh();
  },
};

// arms on entry pages
(() => {
  const view = Views.entry;
  Views.entry = (el, route, pane) => {
    view(el, route, pane);
    const e = M.entries.get(route.id); if (!e || Entry.editing.has(e.id) || !HER.types.includes(e.type)) return;
    const side = $(".entry-side", el); if (!side) return;
    const box = document.createElement("div"); box.className = "card arms-card";
    box.innerHTML = e.arms ? `<div class="row" style="align-items:flex-start;gap:12px"><div data-her style="cursor:pointer" title="${tf("Edit", "Промени")}">${HER.svg(e.arms, 86)}</div>
        <div style="flex:1"><div class="small faint">${tf("Coat of arms", "Герб")}</div><div class="small" style="margin:4px 0 8px">${esc(HER.blazon(e.arms))}</div>
        <button class="btn small ghost" data-her>✎ ${tf("Edit", "Промени")}</button> <button class="btn small ghost" data-herimg title="${tf("Adds a picture of the arms to Images, so it is in the gallery, exports and the World Bible", "Добавя картина на герба към изображенията")}">▣ ${tf("As image", "Като изображение")}</button></div></div>`
      : `<button class="btn small ghost" data-her style="width:100%">⛨ ${tf("Add a coat of arms", "Добави герб")}</button>`;
    side.prepend(box);
    $$("[data-her]", box).forEach(b => b.onclick = () => HER.editEntry(e.id));
    $("[data-herimg]", box)?.addEventListener("click", () => HER.toImage(e.id));
  };
})();

// a page with every coat of arms in the world
Views.heraldry = (el, r, pane) => {
  const withArms = sortByTitle([...M.entries.values()].filter(e => e.arms));
  const without = sortByTitle([...M.entries.values()].filter(e => !e.arms && HER.types.includes(e.type) && e.status !== "scrapped" && ["faction", "government", "location"].includes(e.type)));
  el.innerHTML = paneHead(`⛨ ${tf("Heraldry", "Хералдика")}`, "", pane) + `<div class="pane-body"><div class="wrap wide">
    <p class="muted">${tf("Coats of arms for factions, houses, places, rulers and gods. Make one from any entry's page, or here.", "Гербове за фракции, родове, места, владетели и богове. Създават се от страницата на записа или оттук.")}</p>
    ${withArms.length ? `<div class="her-grid">${withArms.map(e => `<div class="her-item" data-her="${e.id}">${HER.svg(e.arms, 110)}<div class="t">${esc(e.title)}</div><div class="faint small">${esc(typeName(e.type))}</div></div>`).join("")}</div>`
      : `<div class="empty">${tf("No coats of arms yet.", "Още няма гербове.")}</div>`}
    ${without.length ? `<div class="section-title">${tf("Without arms", "Без герб")} (${without.length})</div><div class="row" style="flex-wrap:wrap;gap:6px">${without.slice(0, 60).map(e => `<span class="chip" data-add="${e.id}">⛨ ${esc(e.title)}</span>`).join("")}</div>` : ""}
    </div></div>`;
  $$("[data-her]", el).forEach(x => x.onclick = () => HER.editEntry(x.dataset.her).then(() => Panes.refresh()));
  $$("[data-add]", el).forEach(x => x.onclick = () => HER.editEntry(x.dataset.add).then(() => Panes.refresh()));
};
