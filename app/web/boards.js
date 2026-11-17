// Boards: free corkboards and mood boards. Notes, entry cards, images, color swatches and headings on an endless canvas,
// tied together with red strings. Stored in world.json (boards), so they travel with the world.
"use strict";

const Boards = {
  all: () => (M.world.boards = M.world.boards || []),
  get: id => Boards.all().find(b => b.id === id),
  noteColors: ["#E8D9A8", "#E3B7A0", "#B9D3B0", "#A9C4D9", "#CDB8DA", "#DDDDD5"],
  async create(kind = "cork", entry = "") {
    const name = await promptBox(kind === "mood" ? tf("Name of the mood board", "Име на таблото с настроение") : tf("Name of the board", "Име на таблото"),
      entry ? titleOf(entry) : kind === "mood" ? tf("Mood", "Настроение") : tf("Plot board", "Табло за сюжета"));
    if (name === null) return null;
    const b = { id: uid(), name: name || "Board", kind, entry, items: [], links: [], created: localStamp() };
    Boards.all().push(b); await saveWorld(); return b;
  },
  forEntry: id => Boards.all().filter(b => b.entry === id),
};

Views.boards = (el, r, pane) => {
  if (r.id && Boards.get(r.id)) return Views.board(el, r, pane);
  const list = Boards.all();
  const card = b => {
    const imgs = b.items.filter(i => i.kind === "image").slice(0, 4), cols = b.items.filter(i => i.kind === "color").slice(0, 6);
    return `<div class="ecard" data-b="${b.id}"><div class="thumb board-thumb">${imgs.map(i => `<span style="background-image:url('${img(i.image)}')"></span>`).join("")}${!imgs.length ? `<em>${b.kind === "mood" ? "❖" : "▤"}</em>` : ""}</div>
      ${cols.length ? `<div class="row" style="gap:3px;margin:6px 0 0">${cols.map(c => `<i class="swatch" style="background:${esc(c.color)}"></i>`).join("")}</div>` : ""}
      <div class="t">${esc(b.name)}</div><div class="d">${b.kind === "mood" ? tf("Mood board", "Табло с настроение") : tf("Corkboard", "Корково табло")} · ${b.items.length} ${tf("items", "неща")}${b.entry ? " · " + esc(titleOf(b.entry)) : ""}</div></div>`;
  };
  el.innerHTML = paneHead(`▤ ${tf("Boards", "Табла")}`, `<div class="row"><button class="btn small" data-new="mood">❖ ${tf("New mood board", "Ново табло с настроение")}</button><button class="btn small primary" data-new="cork">＋ ${tf("New corkboard", "Ново корково табло")}</button></div>`, pane) + `
    <div class="pane-body"><div class="wrap wide">
      <p class="muted">${tf("A <b>corkboard</b> is free space for plotting and thinking: notes, entries and pictures you can move around and tie together with string. A <b>mood board</b> collects pictures, colors and words for the feel of a place, a people or a whole book.", "<b>Корковото табло</b> е свободно място за сюжет и мисли: бележки, записи и картини, които местите и свързвате с конци. <b>Таблото с настроение</b> събира картини, цветове и думи за усещането на място, народ или книга.")}</p>
      ${list.length ? `<div class="grid auto">${list.map(card).join("")}</div>` : `<div class="empty">${tf("No boards yet.", "Още няма табла.")}</div>`}
    </div></div>`;
  $$("[data-b]", el).forEach(c => c.onclick = () => Panes.show({ view: "boards", id: c.dataset.b }, pane));
  $$("[data-new]", el).forEach(b => b.onclick = async () => { const nb = await Boards.create(b.dataset.new); if (nb) Panes.show({ view: "boards", id: nb.id }, pane); });
};

Views.board = (el, r, pane) => {
  const b = Boards.get(r.id);
  const view = M.state.boardView?.[b.id] || { x: 40, y: 40, k: 1 };
  let sel = null, linking = null;
  const save = debounce(() => saveWorld(), 500);
  const keepView = debounce(() => { M.state.boardView = { ...(M.state.boardView || {}), [b.id]: view }; saveState(); }, 800);
  el.innerHTML = paneHead(`${b.kind === "mood" ? "❖" : "▤"} ${esc(b.name)}`, `<div class="row">${b.entry ? `<button class="btn small ghost" data-open="${b.entry}">${esc(titleOf(b.entry))}</button>` : ""}
      <button class="btn small ghost" data-more>⋯</button></div>`, pane) + `
    <div class="pane-body flush"><div class="toolbar">
      <button class="btn small" data-add="note">▢ ${tf("Note", "Бележка")}</button><button class="btn small" data-add="entry">◈ ${tf("Entry", "Запис")}</button>
      <button class="btn small" data-add="image">▣ ${tf("Picture", "Картина")}</button><button class="btn small" data-add="color">● ${tf("Color", "Цвят")}</button>
      <button class="btn small" data-add="text">T ${tf("Heading", "Заглавие")}</button><button class="btn small" data-link>〰 ${tf("String", "Конец")}</button>
      <span class="spacer"></span><span class="faint small" data-tip>${tf("Drag to move · drag empty space to pan · wheel to zoom · double-click to edit · Delete removes", "Влачете · влачете празно място за местене · колелце за мащаб · двоен клик за промяна · Delete маха")}</span>
      <button class="btn small ghost" data-fit>⤢</button></div>
      <div class="board-wrap ${b.kind}" data-wrap tabindex="0"><div class="board-world" data-world><svg class="board-links" data-links></svg><div data-items></div></div></div></div>`;
  const wrap = $("[data-wrap]", el), world = $("[data-world]", el);
  const apply = () => { world.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.k})`; wrap.style.backgroundPosition = `${view.x}px ${view.y}px`; wrap.style.backgroundSize = `${28 * view.k}px ${28 * view.k}px`; };
  const itemHtml = it => {
    const s = `left:${it.x}px;top:${it.y}px;${it.w ? `width:${it.w}px;` : ""}${it.h && it.kind === "image" ? `height:${it.h}px;` : ""}`;
    const on = sel === it.id ? " sel" : "";
    if (it.kind === "note") return `<div class="bi note${on}" data-i="${it.id}" style="${s}background:${esc(it.color || Boards.noteColors[0])}"><div class="pin"></div>${MD.inline(esc(it.text || ""), {}).replace(/\n/g, "<br>") || `<span class="faint">…</span>`}</div>`;
    if (it.kind === "text") return `<div class="bi text${on}" data-i="${it.id}" style="${s}font-size:${it.size || 30}px">${esc(it.text || tf("Heading", "Заглавие"))}</div>`;
    if (it.kind === "color") return `<div class="bi color${on}" data-i="${it.id}" style="${s}"><div class="sw" style="background:${esc(it.color)}"></div><div class="small">${esc(it.text || it.color)}</div></div>`;
    if (it.kind === "image") return `<div class="bi image${on}" data-i="${it.id}" style="${s}"><img src="${img(it.image)}" draggable="false">${it.text ? `<div class="cap">${esc(it.text)}</div>` : ""}<i class="rs" data-rs></i></div>`;
    const e = M.entries.get(it.entry);
    if (!e) return `<div class="bi entry${on}" data-i="${it.id}" style="${s}"><span class="faint">${tf("(entry deleted)", "(записът е изтрит)")}</span></div>`;
    const ty = typeOf(e.type), pic = e.images?.[0];
    return `<div class="bi entry${on}" data-i="${it.id}" style="${s}border-top:3px solid ${ty.color}">${pic ? `<div class="ph" style="background-image:url('${img(pic)}')"></div>` : ""}
      <div class="faint small">${ty.icon} ${esc(typeName(e.type))}</div><div class="t">${esc(e.title)}</div><div class="small muted">${esc(summary(e, 110))}</div></div>`;
  };
  const center = it => { const n = $(`[data-i="${it.id}"]`, el); return n ? [it.x + n.offsetWidth / 2, it.y + n.offsetHeight / 2] : [it.x, it.y]; };
  const drawLinks = () => {
    const svg = $("[data-links]", el); let h = "";
    for (const l of b.links) {
      const A = b.items.find(i => i.id === l.a), B = b.items.find(i => i.id === l.b); if (!A || !B) continue;
      const [x1, y1] = center(A), [x2, y2] = center(B), mx = (x1 + x2) / 2, my = (y1 + y2) / 2 + Math.min(60, Math.hypot(x2 - x1, y2 - y1) * .12);
      h += `<path d="M${x1},${y1} Q${mx},${my} ${x2},${y2}" class="str ${sel === l.id ? "sel" : ""}" data-l="${l.id}"/>${l.label ? `<text x="${mx}" y="${(y1 + y2) / 2 + Math.min(60, Math.hypot(x2 - x1, y2 - y1) * .12) / 2 - 6}" text-anchor="middle" data-l="${l.id}">${esc(l.label)}</text>` : ""}`;
    }
    svg.innerHTML = h;
  };
  const draw = () => { $("[data-items]", el).innerHTML = b.items.map(itemHtml).join(""); drawLinks(); };
  // the nearest free spot to the middle of the screen, so new things never land on top of each other
  const at = () => {
    const w = wrap.getBoundingClientRect(), cx = Math.round((w.width / 2 - view.x) / view.k - 100), cy = Math.round((w.height / 2 - view.y) / view.k - 70);
    const size = it => { const n = $(`[data-i="${it.id}"]`, el); return [n?.offsetWidth || it.w || 200, n?.offsetHeight || it.h || 140]; };
    const free = (x, y) => b.items.every(it => { const [iw, ih] = size(it); return x + 200 < it.x - 10 || x > it.x + iw + 10 || y + 140 < it.y - 10 || y > it.y + ih + 10; });
    for (let ring = 0; ring < 12; ring++) for (let dy = -ring; dy <= ring; dy++) for (let dx = -ring; dx <= ring; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
      const x = cx + dx * 230, y = cy + dy * 170; if (free(x, y)) return { x, y };
    }
    return { x: cx, y: cy };
  };
  const add = it => { b.items.push({ id: uid(), ...at(), ...it }); sel = b.items[b.items.length - 1].id; draw(); save(); };
  const editItem = async it => {
    if (it.kind === "entry") return open(it.entry);
    if (it.kind === "note" || it.kind === "text" || it.kind === "image") {
      const res = await modal(it.kind === "note" ? tf("Note", "Бележка") : it.kind === "text" ? tf("Heading", "Заглавие") : tf("Caption", "Надпис"),
        `<textarea class="input" id="bt" rows="${it.kind === "note" ? 6 : 2}">${esc(it.text || "")}</textarea>${it.kind === "note" ? `<div class="row" style="margin-top:8px">${Boards.noteColors.map(c => `<span class="her-tin ${c === it.color ? "on" : ""}" data-c="${c}" style="background:${c}"></span>`).join("")}</div>` : ""}
        ${it.kind === "text" ? `<label class="small">${tf("Size", "Размер")} <input type="range" id="bs" min="16" max="80" value="${it.size || 30}"></label>` : ""}`,
        { buttons: [{ label: t("Cancel"), value: null }, { label: t("Save"), cls: "primary", value: ov => ({ text: $("#bt", ov).value, color: $(".her-tin.on", ov)?.dataset.c || it.color, size: +($("#bs", ov)?.value || it.size || 30) }) }],
          onOpen: ov => { $("#bt", ov).focus(); $$("[data-c]", ov).forEach(s => s.onclick = () => { $$("[data-c]", ov).forEach(x => x.classList.remove("on")); s.classList.add("on"); }); } });
      if (res) { Object.assign(it, res); draw(); save(); }
    }
    if (it.kind === "color") { const v = await promptBox(tf("Color name or note", "Име или бележка за цвета"), it.text || ""); if (v !== null) { it.text = v; draw(); save(); } }
  };
  const pickImages = () => new Promise(res => { const i = document.createElement("input"); i.type = "file"; i.accept = "image/*"; i.multiple = true; i.onchange = async () => res(await Entry.upload([...i.files])); i.click(); });
  $$("[data-add]", el).forEach(btn => btn.onclick = async () => {
    const k = btn.dataset.add;
    if (k === "note") { add({ kind: "note", text: "", color: Boards.noteColors[b.items.length % Boards.noteColors.length], w: 190 }); editItem(b.items[b.items.length - 1]); }
    if (k === "text") { add({ kind: "text", text: "", size: 30 }); editItem(b.items[b.items.length - 1]); }
    if (k === "color") { const c = document.createElement("input"); c.type = "color"; c.value = "#8EB69B"; c.onchange = () => add({ kind: "color", color: c.value, text: "" }); c.click(); }
    if (k === "image") {
      const pics = [...new Set([...M.entries.values()].flatMap(e => e.images || []))];
      const res = await modal(tf("Add pictures", "Добави картини"), `<button class="btn" data-up>⇪ ${tf("From your computer…", "От компютъра…")}</button>
        ${pics.length ? `<div class="section-sub">${tf("Or pictures already in your world", "Или картини, които вече са в света")}</div><div class="pick-grid">${pics.slice(0, 120).map(p => `<span data-p="${esc(p)}" style="background-image:url('${img(p)}')"></span>`).join("")}</div>` : ""}`,
        { wide: true, buttons: [{ label: t("Cancel"), value: null }, { label: tf("Add", "Добави"), cls: "primary", value: ov => $$("[data-p].on", ov).map(x => x.dataset.p) }],
          onOpen: (ov, close) => { $("[data-up]", ov).onclick = async () => close(await pickImages()); $$("[data-p]", ov).forEach(x => x.onclick = () => x.classList.toggle("on")); } });
      (res || []).forEach(f => add({ kind: "image", image: f, w: 200 }));
    }
    if (k === "entry") {
      const res = await modal(tf("Add entries", "Добави записи"), `<div data-lp></div>`, { buttons: [{ label: t("Cancel"), value: null }, { label: tf("Add", "Добави"), cls: "primary", value: ov => ov._ids || [] }],
        onOpen: ov => { Entry.linkPicker($("[data-lp]", ov), [], null, ids => { ov._ids = ids; }); setTimeout(() => $("[data-lp] input", ov)?.focus(), 50); } });
      (res || []).forEach(id => add({ kind: "entry", entry: id, w: 200 }));
    }
  });
  $("[data-link]", el).onclick = () => { linking = { from: sel && b.items.some(i => i.id === sel) ? sel : null }; $("[data-link]", el).classList.add("on"); $("[data-tip]", el).textContent = linking.from ? tf("Now click the item to tie it to.", "Щракнете нещото, с което да се свърже.") : tf("Click the first item, then the second.", "Щракнете първото, после второто."); };
  $("[data-fit]", el).onclick = () => {
    if (!b.items.length) return; const w = wrap.getBoundingClientRect();
    const xs = b.items.map(i => i.x), ys = b.items.map(i => i.y), x0 = Math.min(...xs) - 40, y0 = Math.min(...ys) - 40, x1 = Math.max(...xs) + 320, y1 = Math.max(...ys) + 300;
    view.k = Math.max(.2, Math.min(1.5, Math.min(w.width / (x1 - x0), w.height / (y1 - y0)))); view.x = -x0 * view.k; view.y = -y0 * view.k; apply(); keepView();
  };
  $("[data-more]", el).onclick = async () => {
    const r2 = await modal(esc(b.name), `<div class="form-grid"><label>${t("Name")}</label><input class="input" id="bn" value="${esc(b.name)}">
        <label>${tf("Belongs to", "Принадлежи на")}</label><div data-lp></div>
        <label>${tf("Kind", "Вид")}</label><select class="input" id="bk"><option value="cork" ${b.kind !== "mood" ? "selected" : ""}>${tf("Corkboard", "Корково табло")}</option><option value="mood" ${b.kind === "mood" ? "selected" : ""}>${tf("Mood board", "Табло с настроение")}</option></select></div>`,
      { buttons: [{ label: tf("Delete board", "Изтрий таблото"), value: "del" }, { label: t("Cancel"), value: null }, { label: t("Save"), cls: "primary", value: ov => ({ name: $("#bn", ov).value.trim(), kind: $("#bk", ov).value, entry: ov._ids?.[0] ?? b.entry }) }],
        onOpen: ov => Entry.linkPicker($("[data-lp]", ov), b.entry ? [b.entry] : [], null, ids => { ov._ids = ids; }, true) });
    if (r2 === "del") { if (!await confirmBox(tf(`Delete the board “${b.name}”? The entries and pictures on it are not deleted.`, `Да изтрия ли таблото „${b.name}“? Записите и картините в него не се трият.`))) return; M.world.boards = Boards.all().filter(x => x !== b); await saveWorld(); Panes.show({ view: "boards" }, pane); return; }
    if (r2) { Object.assign(b, { ...r2, entry: r2.entry || "" }); await saveWorld(); Panes.refresh(); }
  };
  // pointer: drag items, pan, link, resize images
  let drag = null;
  wrap.onpointerdown = ev => {
    if (ev.button !== 0) return; wrap.focus();
    const node = ev.target.closest("[data-i]"), lk = ev.target.closest("[data-l]");
    if (lk && !node) { sel = lk.dataset.l; draw(); return; }
    if (node) {
      const it = b.items.find(i => i.id === node.dataset.i);
      if (linking) {
        if (!linking.from) { linking.from = it.id; $("[data-tip]", el).textContent = tf("Now click the item to tie it to.", "Щракнете нещото, с което да се свърже."); return; }
        if (linking.from !== it.id) { b.links.push({ id: uid(), a: linking.from, b: it.id, label: "" }); save(); }
        linking = null; $("[data-link]", el).classList.remove("on"); draw(); return;
      }
      sel = it.id; $$(".bi.sel", el).forEach(x => x.classList.remove("sel")); node.classList.add("sel");
      drag = { it, node, sx: ev.clientX, sy: ev.clientY, ox: it.x, oy: it.y, ow: it.w || node.offsetWidth, oh: it.h || node.offsetHeight, rs: !!ev.target.closest("[data-rs]") };
    } else { sel = null; $$(".bi.sel", el).forEach(x => x.classList.remove("sel")); drag = { pan: true, sx: ev.clientX, sy: ev.clientY, ox: view.x, oy: view.y }; }
    wrap.setPointerCapture(ev.pointerId);
  };
  wrap.onpointermove = ev => {
    if (!drag) return; const dx = ev.clientX - drag.sx, dy = ev.clientY - drag.sy;
    if (drag.pan) { view.x = drag.ox + dx; view.y = drag.oy + dy; apply(); return; }
    if (drag.rs) { drag.it.w = Math.max(80, Math.round(drag.ow + dx / view.k)); drag.it.h = Math.max(60, Math.round(drag.oh * drag.it.w / drag.ow)); drag.node.style.width = drag.it.w + "px"; drag.node.style.height = drag.it.h + "px"; }
    else { drag.it.x = Math.round(drag.ox + dx / view.k); drag.it.y = Math.round(drag.oy + dy / view.k); drag.node.style.left = drag.it.x + "px"; drag.node.style.top = drag.it.y + "px"; }
    drag.moved = true; drawLinks();
  };
  wrap.onpointerup = () => { if (drag?.pan) keepView(); else if (drag?.moved) save(); drag = null; };
  wrap.ondblclick = ev => { const node = ev.target.closest("[data-i]"); if (node) return editItem(b.items.find(i => i.id === node.dataset.i));
    const lk = ev.target.closest("[data-l]"); if (lk) { const l = b.links.find(x => x.id === lk.dataset.l); promptBox(tf("Label on the string", "Надпис на конеца"), l.label || "").then(v => { if (v !== null) { l.label = v; draw(); save(); } }); return; }
    const w = wrap.getBoundingClientRect(); b.items.push({ id: uid(), kind: "note", text: "", color: Boards.noteColors[0], w: 190, x: Math.round((ev.clientX - w.left - view.x) / view.k), y: Math.round((ev.clientY - w.top - view.y) / view.k) }); draw(); editItem(b.items[b.items.length - 1]); };
  wrap.onwheel = ev => { ev.preventDefault(); const w = wrap.getBoundingClientRect(), mx = ev.clientX - w.left, my = ev.clientY - w.top, k2 = Math.max(.15, Math.min(3, view.k * (ev.deltaY < 0 ? 1.1 : 1 / 1.1)));
    view.x = mx - (mx - view.x) * k2 / view.k; view.y = my - (my - view.y) * k2 / view.k; view.k = k2; apply(); keepView(); };
  wrap.onkeydown = ev => {
    if ((ev.key === "Delete" || ev.key === "Backspace") && sel && !ev.target.closest("input,textarea")) {
      b.items = b.items.filter(i => i.id !== sel); b.links = b.links.filter(l => l.id !== sel && l.a !== sel && l.b !== sel); sel = null; draw(); save();
    }
    if (ev.key === "Escape" && linking) { linking = null; $("[data-link]", el).classList.remove("on"); }
  };
  // drop pictures from the computer straight onto the board
  wrap.ondragover = ev => ev.preventDefault();
  wrap.ondrop = async ev => { ev.preventDefault(); ev.stopPropagation(); const files = [...ev.dataTransfer.files].filter(f => f.type.startsWith("image/")); if (!files.length) return;
    const got = await Entry.upload(files), w = wrap.getBoundingClientRect();
    got.forEach((f, i) => b.items.push({ id: uid(), kind: "image", image: f, w: 240, x: Math.round((ev.clientX - w.left - view.x) / view.k) + i * 30, y: Math.round((ev.clientY - w.top - view.y) / view.k) + i * 30 })); draw(); save(); };
  apply(); draw();
  // links need the items' real sizes once images have loaded
  $$("img", el).forEach(i => i.onload = drawLinks);
};

// boards on entry pages
(() => {
  const view = Views.entry;
  Views.entry = (el, route, pane) => {
    view(el, route, pane);
    const e = M.entries.get(route.id); if (!e || Entry.editing.has(e.id)) return;
    const side = $(".entry-side", el); if (!side) return;
    const bs = Boards.forEntry(e.id);
    const box = document.createElement("div"); box.className = "card";
    box.innerHTML = `<h3>${tf("Boards", "Табла")}</h3>${bs.map(b => `<div class="li" data-b="${b.id}" style="cursor:pointer"><div class="main"><div class="t">${b.kind === "mood" ? "❖" : "▤"} ${esc(b.name)}</div><div class="d">${b.items.length} ${tf("items", "неща")}</div></div></div>`).join("")}
      <button class="btn small ghost" data-nb>❖ ${tf("Make a mood board for this", "Табло с настроение за това")}</button>`;
    const images = [...side.querySelectorAll(".card")].find(c => c.querySelector("h3")?.textContent === t("Images"));
    images ? images.after(box) : side.append(box);
    $$("[data-b]", box).forEach(x => x.onclick = () => Panes.show({ view: "boards", id: x.dataset.b }, pane));
    $("[data-nb]", box).onclick = async () => {
      const b = await Boards.create("mood", e.id); if (!b) return;
      (e.images || []).slice(0, 8).forEach((f, i) => b.items.push({ id: uid(), kind: "image", image: f, w: 220, x: 40 + (i % 4) * 250, y: 80 + Math.floor(i / 4) * 260 }));
      b.items.push({ id: uid(), kind: "text", text: e.title, size: 40, x: 40, y: 10 }); await saveWorld();
      Panes.show({ view: "boards", id: b.id }, pane);
    };
  };
})();
