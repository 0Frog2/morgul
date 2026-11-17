// Maps: image + pins (linked to entries, nested maps), layers (with eras), routes (distance + travel time).
"use strict";
Views.maps = (el, r, pane) => {
  const maps = sortByTitle(entriesOf("map"));
  el.innerHTML = paneHead(t("Maps"), `<button class="btn primary small" data-new>＋ ${tf("New map", "Нова карта")}</button>`, pane) + `<div class="pane-body"><div class="wrap wide">
    ${maps.length ? `<div class="grid auto">${maps.map(m => `<div class="ecard" data-map="${m.id}">${m.map?.image ? `<div class="thumb" style="height:150px;background-image:url('${img(m.map.image)}')"></div>` : ""}
      <div class="t">${esc(m.title)}</div><div class="d">${(m.map?.pins || []).length} ${tf("pins", "пина")}${m.fields?.of ? " · " + esc(titleOf(m.fields.of)) : ""}</div></div>`).join("")}</div>`
      : `<div class="empty">${tf("No maps yet. Add your map image and drop pins that open location pages. Maps can nest: world → region → city.", "Още няма карти. Добавете изображение и пинове, които отварят местата. Картите могат да се влагат: свят → регион → град.")}</div>`}
    </div></div>`;
  $$("[data-map]", el).forEach(c => c.onclick = () => Panes.show({ view: "map", id: c.dataset.map }, pane));
  $("[data-new]", el).onclick = () => newMap(pane);
};
async function newMap(pane, ofLocation = "") {
  const i = document.createElement("input"); i.type = "file"; i.accept = "image/*";
  i.onchange = async () => {
    const [file] = await Entry.upload([...i.files]); if (!file) return;
    const name = await promptBox(tf("Name of the map", "Име на картата"), ofLocation ? titleOf(ofLocation) : i.files[0].name.replace(/\.\w+$/, ""));
    if (name === null) return;
    const e = await createEntry("map", name || "Map", { fields: ofLocation ? { of: ofLocation } : {}, map: { image: file, pins: [], layers: [], routes: [] }, status: "canon" });
    Panes.show({ view: "map", id: e.id }, pane);
  };
  i.click();
}

Views.map = (el, r, pane) => {
  const entry = M.entries.get(r.id);
  if (!entry) return Views.maps(el, r, pane);
  const m = structuredClone(entry.map || { pins: [], layers: [], routes: [] });
  m.pins = m.pins || []; m.layers = m.layers || []; m.routes = m.routes || [];
  let tool = "move", sel = null, temp = [], year = r.year ?? null, activeLayer = m.layers[0]?.id || null;
  const view = { x: 0, y: 0, k: 1 };
  const parentMaps = entriesOf("map").filter(x => x.id !== entry.id && entry.fields?.of && (x.map?.pins || []).some(p => p.entry === entry.fields.of));
  el.innerHTML = paneHead(`⌖ ${esc(entry.title)}`, `<div class="row">${parentMaps.map(p => `<button class="btn small ghost" data-up="${p.id}">↖ ${esc(p.title)}</button>`).join("")}
      <button class="btn small ghost" data-open="${entry.id}">${tf("Map page", "Страница")}</button></div>`, pane) + `
    <div class="pane-body flush"><div class="toolbar">
      ${[["move", "✋", tf("Move / select", "Премести / избери")], ["pin", "📍", tf("Add pin", "Добави пин")], ["route", "⤳", tf("Draw route", "Начертай маршрут")],
         ["line", "╱", tf("Draw line on layer (borders, rivers)", "Линия в слой (граници, реки)")], ["area", "⬠", tf("Draw area on layer", "Област в слой")], ["measure", "📏", tf("Set the scale", "Задай мащаба")]]
        .map(([k, i, l]) => `<button class="btn small ${k === tool ? "on" : ""}" data-tool="${k}" title="${esc(l)}">${i} <span class="small">${esc(l.split(" (")[0])}</span></button>`).join("")}
      <span class="spacer"></span>
      <span class="faint small">${t("Year")}</span><input class="input" data-year style="width:110px;padding:3px 8px" placeholder="${tf("all eras", "всички епохи")}" value="${year !== null ? esc(Cal.yearLabel(year)) : ""}">
      <button class="btn small ghost" data-fit>⤢</button><button class="btn small ghost" data-img title="${tf("Replace image", "Смени изображението")}">🖼</button>
    </div>
    <div style="display:flex;flex:1;min-height:0">
      <div class="canvas-wrap" data-wrap><div class="map-stage" data-stage>${m.image ? `<img src="${img(m.image)}" data-imgel>` : ""}<svg data-svg></svg></div>
        ${!m.image ? `<div class="empty" style="position:absolute;inset:40% 0 auto">${tf("No image — click 🖼 to add one.", "Няма изображение — щракнете 🖼.")}</div>` : ""}</div>
      <div class="map-side" data-side></div>
    </div></div>`;
  const wrap = $("[data-wrap]", el), stage = $("[data-stage]", el), svg = $("[data-svg]", el), imgEl = $("[data-imgel]", el), side = $("[data-side]", el);
  const unit = M.world.travel.unit;
  const save = debounce(async () => { const cur = M.entries.get(entry.id); await saveEntry({ ...cur, map: m }, null, false); }, 600);
  const changed = () => { draw(); save(); };
  const apply = () => { stage.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.k})`; draw(); };
  const fit = () => { if (!m.w) return; const W = wrap.clientWidth, H = wrap.clientHeight; view.k = Math.min(W / m.w, H / m.h) * .96; view.x = (W - m.w * view.k) / 2; view.y = (H - m.h * view.k) / 2; apply(); };
  if (imgEl) imgEl.onload = () => { const first = !m.w; m.w = imgEl.naturalWidth; m.h = imgEl.naturalHeight; svg.setAttribute("width", m.w); svg.setAttribute("height", m.h); fit(); if (first) save(); };
  const toImg = ev => { const r0 = wrap.getBoundingClientRect(); return [(ev.clientX - r0.left - view.x) / view.k, (ev.clientY - r0.top - view.y) / view.k]; };
  const dist = pts => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
  const realDist = pts => m.scale ? dist(pts) * m.scale : null;
  const layerVisible = l => l.visible !== false && (year === null || ((l.from === undefined || l.from === "" || l.from <= year) && (l.to === undefined || l.to === "" || l.to >= year)));

  function draw() {
    const s = 1 / view.k;
    const path = pts => pts.map(p => p.join(",")).join(" ");
    let h = "";
    for (const l of m.layers.filter(layerVisible)) for (const sh of l.shapes || [])
      h += sh.kind === "area" ? `<polygon points="${path(sh.pts)}" fill="${l.color}" fill-opacity=".18" stroke="${l.color}" stroke-width="${2 * s}"/>`
        : `<polyline points="${path(sh.pts)}" fill="none" stroke="${l.color}" stroke-width="${2.5 * s}" stroke-linejoin="round" stroke-linecap="round"/>`;
    for (const rt of m.routes) h += `<polyline data-route="${rt.id}" points="${path(rt.pts)}" fill="none" stroke="${sel?.route === rt.id ? cssVar("text") : cssVar("warn")}" stroke-width="${3 * s}" stroke-dasharray="${8 * s} ${5 * s}" stroke-linecap="round" style="cursor:pointer"/>`;
    if (temp.length) h += `<polyline points="${path(temp)}" fill="none" stroke="${cssVar("text")}" stroke-width="${2 * s}" stroke-dasharray="${4 * s} ${4 * s}"/>` + temp.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="${3.5 * s}" fill="${cssVar("text")}"/>`).join("");
    for (const p of m.pins) {
      const e = M.entries.get(p.entry); const c = e ? typeOf(e.type).color : "#D9A65A"; const on = sel?.pin === p.id;
      const hasMap = e && entriesOf("map").some(x => x.fields?.of === e.id && x.id !== entry.id);
      h += `<g data-pin="${p.id}" transform="translate(${p.x},${p.y}) scale(${s})" style="cursor:pointer">
        <path d="M0 0 C-7 -10 -11 -15 -11 -21 A11 11 0 1 1 11 -21 C11 -15 7 -10 0 0Z" fill="${on ? cssVar("text") : cssVar("panel")}" stroke="${c}" stroke-width="2.4"/>
        <circle cy="-21" r="${hasMap ? 5 : 3.5}" fill="${hasMap ? "#D9A65A" : c}"/>
        <text class="pin-label" y="14" text-anchor="middle">${esc(p.label || e?.title || "?")}</text></g>`;
    }
    svg.innerHTML = h;
  }
  function sideHtml() {
    if (sel?.pin) {
      const p = m.pins.find(x => x.id === sel.pin); if (!p) { sel = null; return sideHtml(); }
      const e = M.entries.get(p.entry); const sub = e ? entriesOf("map").filter(x => x.fields?.of === e.id && x.id !== entry.id) : [];
      side.innerHTML = `<h3 style="margin:0 0 8px">📍 ${tf("Pin", "Пин")}</h3><div class="form-grid" style="grid-template-columns:70px 1fr">
        <label>${tf("Entry", "Запис")}</label><div data-pe></div><label>${tf("Label", "Надпис")}</label><input class="input" data-pl value="${esc(p.label || "")}" placeholder="${esc(e?.title || "")}"></div>
        <div class="row" style="margin-top:10px">${e ? `<button class="btn small" data-open="${e.id}">${tf("Open page", "Отвори")}</button>` : ""}
        ${sub.map(s => `<button class="btn small primary" data-sub="${s.id}">↘ ${esc(s.title)}</button>`).join("")}
        ${e && e.type === "location" && !sub.length ? `<button class="btn small ghost" data-mk>＋ ${tf("Map for this place", "Карта за мястото")}</button>` : ""}
        <span class="spacer"></span><button class="btn small danger ghost" data-del>✕</button></div>
        ${e ? `<div class="faint small" style="margin-top:10px">${esc(summary(e, 260))}</div>` : ""}`;
      Entry.linkPicker($("[data-pe]", side), p.entry ? [p.entry] : [], ["location", "event", "character", "faction", "entity", "creature", "item"], ids => { p.entry = ids[0] || ""; changed(); sideHtml(); }, true);
      $("[data-pl]", side).oninput = ev => { p.label = ev.target.value; changed(); };
      $("[data-del]", side).onclick = () => { m.pins = m.pins.filter(x => x !== p); sel = null; changed(); sideHtml(); };
      $$("[data-sub]", side).forEach(b => b.onclick = () => Panes.show({ view: "map", id: b.dataset.sub, year }, pane));
      $("[data-mk]", side)?.addEventListener("click", () => newMap(pane, e.id));
      return;
    }
    if (sel?.route) {
      const rt = m.routes.find(x => x.id === sel.route); if (!rt) { sel = null; return sideHtml(); }
      const d = realDist(rt.pts);
      side.innerHTML = `<h3 style="margin:0 0 8px">⤳ ${tf("Route", "Маршрут")}</h3><input class="input" data-rn value="${esc(rt.name || "")}" placeholder="${tf("Name", "Име")}">
        <div style="margin:10px 0">${d !== null ? `<div style="font:600 20px var(--serif)">${d.toFixed(d < 10 ? 1 : 0)} ${esc(unit)}</div>
          ${M.world.travel.speeds.map(sp => `<div class="small"><span class="muted">${esc(sp.name)}</span> · <b>${fmtDays(d / sp.perDay)}</b></div>`).join("")}`
          : `<div class="faint small">${tf("Set the scale first (📏) to see distance and travel time.", "Първо задайте мащаба (📏), за да видите разстоянието и времето.")}</div>`}</div>
        <div class="row"><span class="spacer"></span><button class="btn small danger ghost" data-del>✕</button></div>`;
      $("[data-rn]", side).oninput = ev => { rt.name = ev.target.value; save(); };
      $("[data-del]", side).onclick = () => { m.routes = m.routes.filter(x => x !== rt); sel = null; changed(); sideHtml(); };
      return;
    }
    // default: layers + legend
    side.innerHTML = `<div class="row"><h3 style="margin:0;flex:1">${t("Layers")}</h3><button class="btn small" data-addl>＋</button></div>
      <div class="faint small" style="margin:4px 0 8px">${tf("Lines and areas go on the selected layer. Give a layer years to show it only in that era.", "Линиите и областите отиват в избрания слой. Дайте години, за да се вижда само в тази епоха.")}</div>
      ${m.layers.map(l => `<div class="card" style="padding:8px 10px;margin-bottom:6px;${l.id === activeLayer ? "border-color:var(--accent)" : ""}" data-lay="${l.id}">
        <div class="row" style="flex-wrap:nowrap"><input type="checkbox" data-vis ${l.visible !== false ? "checked" : ""}><input type="color" data-col value="${l.color}" style="width:26px;height:22px;border:0;background:none;padding:0">
        <input class="input" data-ln value="${esc(l.name)}" style="padding:2px 6px"><button class="btn small ghost danger" data-dl>✕</button></div>
        <div class="row small" style="margin-top:4px;flex-wrap:nowrap"><input class="input" data-lf placeholder="${tf("from", "от")}" value="${l.from !== undefined && l.from !== "" ? esc(Cal.yearLabel(l.from)) : ""}" style="padding:2px 6px">
        <input class="input" data-lt placeholder="${tf("to", "до")}" value="${l.to !== undefined && l.to !== "" ? esc(Cal.yearLabel(l.to)) : ""}" style="padding:2px 6px"><span class="faint">${(l.shapes || []).length}</span>
        ${(l.shapes || []).length ? `<button class="btn small ghost" data-undo title="${tf("Remove last shape", "Махни последната фигура")}">↶</button>` : ""}</div></div>`).join("") || `<div class="faint small">—</div>`}
      <div class="section-title">${t("Routes")}</div>${m.routes.map(rt => { const d = realDist(rt.pts); return `<div class="li" data-rsel="${rt.id}"><div class="main"><div class="t">${esc(rt.name || tf("Route", "Маршрут"))}</div><div class="d">${d !== null ? d.toFixed(0) + " " + esc(unit) : "—"}</div></div></div>`; }).join("") || `<div class="faint small">—</div>`}
      <div class="section-title">${t("Measure")}</div><div class="faint small">${m.scale ? tf(`1 px = ${m.scale.toFixed(3)} ${unit}. Use 📏 to change.`, `1 px = ${m.scale.toFixed(3)} ${unit}. 📏 за промяна.`) : tf("Not set. Use 📏: click two points and enter the real distance between them.", "Не е зададен. 📏: щракнете две точки и въведете реалното разстояние.")}</div>
      <div class="section-title">${t("Pins")} (${m.pins.length})</div>${m.pins.map(p => `<div class="li" data-psel="${p.id}"><div class="main"><div class="t">${esc(p.label || titleOf(p.entry) || "?")}</div></div></div>`).join("")}`;
    $("[data-addl]", side).onclick = () => { const l = { id: uid(), name: tf("Layer", "Слой") + " " + (m.layers.length + 1), color: ["#C8685E", "#7FB0C9", "#D9A65A", "#9DB86E", "#B79CD9"][m.layers.length % 5], shapes: [], visible: true }; m.layers.push(l); activeLayer = l.id; changed(); sideHtml(); };
    $$("[data-lay]", side).forEach(card => {
      const l = m.layers.find(x => x.id === card.dataset.lay);
      card.onclick = ev => { if (ev.target.closest("input,button")) return; activeLayer = l.id; sideHtml(); };
      $("[data-vis]", card).onchange = ev => { l.visible = ev.target.checked; changed(); };
      $("[data-col]", card).oninput = ev => { l.color = ev.target.value; changed(); };
      $("[data-ln]", card).oninput = ev => { l.name = ev.target.value; save(); };
      const yr = v => { const p = Cal.parse(v); return p ? Cal.parts(p).y : ""; };
      $("[data-lf]", card).onchange = ev => { l.from = yr(ev.target.value); changed(); };
      $("[data-lt]", card).onchange = ev => { l.to = yr(ev.target.value); changed(); };
      $("[data-dl]", card).onclick = async () => { if (await confirmBox(tf("Delete this layer and its shapes?", "Да изтрия ли слоя и фигурите му?"))) { m.layers = m.layers.filter(x => x !== l); activeLayer = m.layers[0]?.id || null; changed(); sideHtml(); } };
      $("[data-undo]", card)?.addEventListener("click", () => { l.shapes.pop(); changed(); sideHtml(); });
    });
    $$("[data-rsel]", side).forEach(x => x.onclick = () => { sel = { route: x.dataset.rsel }; draw(); sideHtml(); });
    $$("[data-psel]", side).forEach(x => x.onclick = () => { sel = { pin: x.dataset.psel }; const p = m.pins.find(q => q.id === sel.pin); view.x = wrap.clientWidth / 2 - p.x * view.k; view.y = wrap.clientHeight / 2 - p.y * view.k; apply(); sideHtml(); });
  }
  const fmtDays = d => d < 1 ? `${Math.max(1, Math.round(d * 24))} ${tf("hours", "часа")}` : `${d.toFixed(d < 3 ? 1 : 0)} ${tf("days", "дни")}`;

  // tools
  $$("[data-tool]", el).forEach(b => b.onclick = () => {
    finishTemp(); tool = b.dataset.tool; $$("[data-tool]", el).forEach(x => x.classList.toggle("on", x === b));
    if ((tool === "line" || tool === "area") && !m.layers.length) { m.layers.push({ id: uid(), name: tf("Borders", "Граници"), color: "#C8685E", shapes: [], visible: true }); activeLayer = m.layers[0].id; save(); sideHtml(); }
    if (tool !== "move" && tool !== "pin" && !Views.map._hinted && (Views.map._hinted = true)) toast(tf("Click to add points. Double-click or Enter to finish, Esc to cancel.", "Щракайте за точки. Двоен клик или Enter за край, Esc за отказ."));
  });
  async function finishTemp() {
    if (temp.length < 2) { temp = []; draw(); return; }
    const pts = temp.map(p => p.map(Math.round)); temp = [];
    if (tool === "route") { const rt = { id: uid(), name: "", pts }; m.routes.push(rt); sel = { route: rt.id }; }
    if (tool === "line" || tool === "area") { const l = m.layers.find(x => x.id === activeLayer) || m.layers[0]; l.shapes = l.shapes || []; l.shapes.push({ kind: tool, pts }); }
    if (tool === "measure") {
      const px = dist(pts);
      const v = await promptBox(tf(`Real distance between these points (${unit})`, `Реално разстояние между точките (${unit})`), "", "100");
      if (v && +v > 0) { m.scale = +v / px; toast(tf("Scale set.", "Мащабът е зададен.")); }
    }
    changed(); sideHtml();
  }
  let pan = null, moved = false, dragPin = null;
  wrap.onmousedown = ev => {
    moved = false;
    const pinEl = ev.target.closest("[data-pin]");
    if (tool === "move" && pinEl) { const p = m.pins.find(x => x.id === pinEl.dataset.pin); dragPin = { p, sx: ev.clientX, sy: ev.clientY, ox: p.x, oy: p.y }; return; }
    if (tool === "move" || ev.button === 1) { pan = { sx: ev.clientX, sy: ev.clientY, ox: view.x, oy: view.y }; wrap.classList.add("drag"); }
  };
  const mm = ev => {
    if (dragPin) { const dx = (ev.clientX - dragPin.sx) / view.k, dy = (ev.clientY - dragPin.sy) / view.k; if (Math.abs(dx) + Math.abs(dy) > 2) moved = true; dragPin.p.x = Math.round(dragPin.ox + dx); dragPin.p.y = Math.round(dragPin.oy + dy); draw(); }
    if (pan) { moved = moved || Math.abs(ev.clientX - pan.sx) + Math.abs(ev.clientY - pan.sy) > 3; view.x = pan.ox + ev.clientX - pan.sx; view.y = pan.oy + ev.clientY - pan.sy; apply(); }
  };
  const mu = ev => {
    if (dragPin) { if (moved) save(); else if (ev.shiftKey && M.entries.has(dragPin.p.entry)) open(dragPin.p.entry, true); else { sel = { pin: dragPin.p.id }; draw(); sideHtml(); } dragPin = null; return; }
    if (pan) { wrap.classList.remove("drag"); const wasMoved = moved; pan = null; if (!wasMoved && tool === "move") { const rt = ev.target.closest?.("[data-route]"); sel = rt ? { route: rt.dataset.route } : null; draw(); sideHtml(); } }
  };
  window.addEventListener("mousemove", mm); window.addEventListener("mouseup", mu);
  wrap.onclick = async ev => {
    if (!m.w || tool === "move") return;
    const [x, y] = toImg(ev);
    if (tool === "pin") {
      const p = { id: uid(), x: Math.round(x), y: Math.round(y), entry: "", label: "" }; m.pins.push(p); sel = { pin: p.id }; changed(); sideHtml();
      setTimeout(() => $("[data-pe] input", side)?.focus(), 30); tool = "move"; $$("[data-tool]", el).forEach(b => b.classList.toggle("on", b.dataset.tool === "move")); return;
    }
    temp.push([x, y]); draw();
    if (tool === "measure" && temp.length === 2) finishTemp();
  };
  wrap.ondblclick = ev => { if (tool !== "move") { ev.preventDefault(); temp.pop(); finishTemp(); } else { const pinEl = ev.target.closest("[data-pin]"); const p = pinEl && m.pins.find(x => x.id === pinEl.dataset.pin);
    if (p) { const sub = entriesOf("map").find(x => x.fields?.of === p.entry && x.id !== entry.id); if (sub) Panes.show({ view: "map", id: sub.id, year }, pane); else if (M.entries.has(p.entry)) open(p.entry, true); } } };
  wrap.onwheel = ev => { ev.preventDefault(); const k = Math.max(.05, Math.min(8, view.k * (ev.deltaY < 0 ? 1.15 : 1 / 1.15))); const r0 = wrap.getBoundingClientRect();
    const mx = ev.clientX - r0.left, my = ev.clientY - r0.top; view.x = mx - (mx - view.x) * k / view.k; view.y = my - (my - view.y) * k / view.k; view.k = k; apply(); };
  const key = ev => { if (!el.isConnected) return document.removeEventListener("keydown", key);
    if (ev.target.matches("input,textarea")) return;
    if (ev.key === "Enter" && temp.length) finishTemp(); if (ev.key === "Escape" && temp.length) { temp = []; draw(); ev.stopPropagation(); }
    if ((ev.key === "Delete" || ev.key === "Backspace") && sel?.pin) { m.pins = m.pins.filter(p => p.id !== sel.pin); sel = null; changed(); sideHtml(); } };
  document.addEventListener("keydown", key);
  $("[data-year]", el).onchange = ev => { const v = Cal.parse(ev.target.value); year = v ? Cal.parts(v).y : null; ev.target.value = year !== null ? Cal.yearLabel(year) : ""; draw(); };
  $("[data-fit]", el).onclick = fit;
  $("[data-img]", el).onclick = () => { const i = document.createElement("input"); i.type = "file"; i.accept = "image/*"; i.onchange = async () => { const [f] = await Entry.upload([...i.files]); if (f) { m.image = f; delete m.w; await saveEntry({ ...M.entries.get(entry.id), map: m }, null, false); Panes.refresh(pane); } }; i.click(); };
  $$("[data-up]", el).forEach(b => b.onclick = () => Panes.show({ view: "map", id: b.dataset.up, year }, pane));
  const obs = new MutationObserver(() => { if (!el.contains(wrap)) { window.removeEventListener("mousemove", mm); window.removeEventListener("mouseup", mu); document.removeEventListener("keydown", key); obs.disconnect(); } });
  obs.observe(el, { childList: true });
  sideHtml();
  if (imgEl?.complete && imgEl.naturalWidth) imgEl.onload();
};
