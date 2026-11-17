// Pages: dashboard, browse, timeline, story, alchemy, glossary & languages, names, world at a time, inbox,
// contradictions, "I'm stuck", settings.
"use strict";
const cardFor = e => {
  const pic = (e.images || [])[0];
  return `<div class="ecard" data-open="${e.id}">${pic ? `<div class="thumb" style="background-image:url('${img(pic)}')"></div>` : ""}
    <div class="row" style="gap:6px"><span class="type-dot" style="background:${typeOf(e.type).color}"></span><span class="faint small">${esc(typeName(e.type))}</span>
    <span class="spacer"></span>${e.status !== "canon" ? `<span class="status ${e.status || "draft"}">${t({ draft: "Draft", scrapped: "Scrapped" }[e.status || "draft"] || "")}</span>` : ""}</div>
    <div class="t">${esc(e.title)}</div><div class="d">${esc(summary(e, 180))}</div></div>`;
};
const rowFor = (e, extra = "") => `<div class="li ${e.status === "scrapped" ? "scrapped" : ""}" data-open="${e.id}"><span class="type-dot" style="background:${typeOf(e.type).color}"></span>
  <div class="main"><div class="t">${esc(e.title)}</div><div class="d">${esc(summary(e, 140)) || "&nbsp;"}</div></div>${extra}</div>`;

// ------------------------------------------------------------------ dashboard
Views.dashboard = (el, r, pane) => {
  const recent = (M.state.recent || []).map(id => M.entries.get(id)).filter(Boolean).slice(0, 8);
  const pinned = (M.state.pinned || []).map(id => M.entries.get(id)).filter(Boolean);
  const fo = Checks.fleshOut().sort((a, b) => b.score - a.score).slice(0, 6);
  const issues = Checks.openCount();
  const counts = M.world.types.map(ty => [ty, entriesOf(ty.key).length]).filter(([, n]) => n);
  const inbox = entriesOf("note").filter(e => (e.tags || []).includes("inbox")).length;
  const total = M.entries.size, totalWords = [...M.entries.values()].reduce((s, e) => s + words(e.body), 0);
  el.innerHTML = paneHead(t("Dashboard"), `<button class="btn primary small" data-new>＋ ${t("New entry")}</button>`, pane) + `
    <div class="pane-body"><div class="wrap wide">
      <div class="grid c3" style="margin-bottom:6px">
        <div class="card"><div class="faint small">${tf("Your world", "Вашият свят")}</div><div style="font:600 26px var(--serif)">${total} <span class="faint" style="font-size:14px">${t("entries")}</span></div><div class="faint small">${totalWords.toLocaleString()} ${t("words")}</div></div>
        <div class="card" style="cursor:pointer" data-go="stuck"><div class="faint small">${t("To fill in")}</div><div style="font:600 26px var(--serif)">${Checks.fleshOut().length}</div><div class="faint small">${tf("things waiting to be fleshed out", "неща за доразвиване")}</div></div>
        <div class="card" style="cursor:pointer" data-go="contradictions"><div class="faint small">${t("Open contradictions")}</div><div style="font:600 26px var(--serif);color:${issues ? "var(--warn)" : "inherit"}">${issues}</div><div class="faint small">${inbox} ${tf("notes in the inbox", "бележки във входящи")}</div></div>
      </div>
      ${typeof onThisDayCard === "function" ? onThisDayCard() : ""}<div class="grid c2" style="margin-bottom:6px">${writingCard()}<div class="card writing-card" style="cursor:pointer" data-go="build"><div><div class="faint small">${tf("World built", "Изграден свят")}</div><div style="font:600 22px var(--serif)">${Path.overall()}%</div></div><div style="flex:1">${Path.meter(Path.overall())}</div><span class="faint small">${tf("World-building path", "Пътят на света")} ›</span></div></div>
      ${lastSessionCard()}
      <div class="grid c2">
        <div>
          <div class="section-title">${t("Recently edited")}</div>
          ${recent.length ? `<div class="list">${recent.map(e => rowFor(e)).join("")}</div>` : `<div class="empty">—</div>`}
          ${pinned.length ? `<div class="section-title">★ ${t("Pinned")}</div><div class="list">${pinned.map(e => rowFor(e)).join("")}</div>` : ""}
        </div>
        <div>
          <div class="section-title">${t("To fill in")} <button class="btn small ghost" data-go="stuck">${t("See all")}</button></div>
          <div class="grid">${fo.map(foCard).join("") || `<div class="empty">${tf("Nothing obvious — nice.", "Нищо очевидно — браво.")}</div>`}</div>
        </div>
      </div>
      <div class="section-title">${t("Types")}</div>
      <div class="row">${counts.map(([ty, n]) => `<button class="chip" data-type="${ty.key}">${ty.icon} ${esc(typeName(ty.key))} <b>${n}</b></button>`).join("")}</div>
    </div></div>`;
  $("[data-new]", el).onclick = () => newEntryBox();
  $$("[data-go]", el).forEach(b => b.onclick = () => Panes.show({ view: b.dataset.go }, pane));
  $$("[data-type]", el).forEach(b => b.onclick = () => Panes.show({ view: "browse", type: b.dataset.type }, pane));
  $("[data-set-goal]", el)?.addEventListener("click", setGoal);
  $("[data-hide-last]", el)?.addEventListener("click", () => { M.state.lastSessionHidden = M.state.lastSession?.start; saveState(); Panes.refresh(); });
  $$("[data-mk]", el).forEach(c => c.onclick = () => newEntryBoxWith(c.dataset.mk));
  bindFo(el, pane);
};

// "Last time": what the previous session added and changed, and which new names it mentioned without an entry yet
function lastSessionCard() {
  const ls = M.state.lastSession; if (!ls || M.state.lastSessionHidden === ls.start) return "";
  const created = (ls.created || []).filter(id => M.entries.has(id)), edited = (ls.edited || []).filter(id => M.entries.has(id));
  if (!created.length && !edited.length) return "";
  const ids = new Set([...created, ...edited]);
  const missing = [...Idx.missing.values()].filter(m => [...m.from].some(id => ids.has(id))).map(m => m.title).slice(0, 12);
  const when = ls.start.replace("T", " ").slice(0, 16);
  const chips = l => l.slice(0, 14).map(id => chipFor(id)).join("") + (l.length > 14 ? `<span class="faint small">+${l.length - 14}</span>` : "");
  return `<div class="section-title">${tf("Last time", "Миналия път")} <span class="faint" style="text-transform:none;letter-spacing:0">${esc(when)}</span>
      <button class="btn small ghost" data-hide-last>${t("Close")}</button></div>
    <div class="card" style="margin-bottom:6px">
      ${created.length ? `<div class="row" style="margin-bottom:6px"><span class="faint small" style="width:90px">${tf("Added", "Добавени")} (${created.length})</span>${chips(created)}</div>` : ""}
      ${edited.length ? `<div class="row" style="margin-bottom:6px"><span class="faint small" style="width:90px">${tf("Changed", "Променени")} (${edited.length})</span>${chips(edited)}</div>` : ""}
      ${missing.length ? `<div class="row"><span class="faint small" style="width:90px">${tf("New names", "Нови имена")}</span>${missing.map(n => `<span class="chip" data-mk="${esc(n)}" style="color:var(--warn)" title="${esc(tf("Mentioned, but no entry yet. Click to create it.", "Споменато, но още няма запис. Щракнете, за да го създадете."))}">＋ ${esc(n)}</span>`).join("")}</div>` : ""}
    </div>`;
}

// ------------------------------------------------------------------ browse (filters by type, tag, status)
Views.browse = (el, r, pane) => {
  const st = { type: r.type || "", tag: r.tag || "", status: r.status || "", q: r.q || "", sort: r.sort || "name", missing: r.missing || "", grid: !!M.state.browseGrid };
  const tags = [...new Set([...M.entries.values()].flatMap(e => e.tags || []))].sort();
  const title = r.smart ? `☆ ${esc(r.smart.name)}` : st.type ? `${typeOf(st.type).icon} ${esc(typeName(st.type))}` : t("Everything");
  const fieldsOf = st.type ? typeOf(st.type).fields.filter(f => !["relations", "knowers"].includes(f.kind)) : [];
  el.innerHTML = paneHead(title, `${r.smart ? `<button class="btn small ghost danger" data-unsmart title="${tf("Delete this smart list (entries stay)", "Изтрий умния списък (записите остават)")}">✕</button>` : ""}
    <button class="btn small ghost" data-smart title="${tf("Save these filters as a smart list in the sidebar", "Запази филтрите като умен списък в страничната лента")}">☆ ${r.smart ? tf("Update smart list", "Обнови умния списък") : tf("Save as smart list", "Запази като умен списък")}</button>
    <button class="btn primary small" data-new>＋ ${t("New")}</button>`, pane) + `
    <div class="pane-body"><div class="wrap wide">
      <div class="row" style="margin-bottom:10px">
        <input class="input" data-q placeholder="${t("Filter…")}" style="max-width:280px">
        <select class="input" data-type style="width:auto"><option value="">${t("All types")}</option>${M.world.types.map(x => `<option value="${x.key}" ${x.key === st.type ? "selected" : ""}>${esc(typeName(x.key))}</option>`).join("")}</select>
        <select class="input" data-status style="width:auto"><option value="">${tf("Any status", "Всеки статус")}</option><option value="canon">${t("Canon")}</option><option value="draft">${t("Draft")}</option><option value="scrapped">${t("Scrapped")}</option></select>
        <select class="input" data-sort style="width:auto"><option value="name">${t("Name")}</option><option value="updated">${t("Updated")}</option><option value="created">${t("Created")}</option><option value="words">${t("words")}</option><option value="links">${tf("Most linked", "Най-свързани")}</option></select>
        ${fieldsOf.length ? `<select class="input" data-missing style="width:auto"><option value="">${tf("Any fields", "Всички полета")}</option>${fieldsOf.map(f => `<option value="${f.key}" ${f.key === st.missing ? "selected" : ""}>${tf("Missing:", "Липсва:")} ${esc(fieldLabel(f))}</option>`).join("")}</select>` : ""}
        <span class="spacer"></span><button class="btn small ghost" data-grid>${st.grid ? "☰" : "▦"}</button>
      </div>
      ${tags.length ? `<div class="row" style="margin-bottom:12px" data-tags>${tags.map(x => `<span class="chip ${x === st.tag ? "on" : ""}" data-tag="${esc(x)}">#${esc(x)}</span>`).join("")}</div>` : ""}
      <div data-list></div>
    </div></div>`;
  const draw = () => {
    let list = [...M.entries.values()].filter(e => Smart.match(e, st));
    const key = { name: e => e.title.toLowerCase(), updated: e => -new Date(e.updated || 0), created: e => -new Date(e.created || 0), words: e => -words(e.body), links: e => -(Idx.backlinks.get(e.id) || []).length }[st.sort];
    list.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
    $("[data-list]", el).innerHTML = list.length ? (st.grid ? `<div class="grid auto">${list.map(cardFor).join("")}</div>` : `<div class="list">${list.map(e => rowFor(e, `<span class="faint small">${esc(typeName(e.type))}</span>`)).join("")}</div>`)
      : `<div class="empty">${t("Nothing here yet.")}</div>`;
  };
  $("[data-q]", el).value = st.q;
  $('[data-status]', el).value = st.status; $('[data-sort]', el).value = st.sort;
  $("[data-missing]", el)?.addEventListener("change", ev => { st.missing = ev.target.value; draw(); });
  $("[data-smart]", el).onclick = () => Smart.save({ id: r.smart?.id, name: r.smart?.name, type: st.type, tag: st.tag, status: st.status, q: st.q, sort: st.sort, missing: st.missing });
  $("[data-unsmart]", el)?.addEventListener("click", async () => { if (await confirmBox(tf(`Delete the smart list “${r.smart.name}”? The entries stay.`, `Да изтрия ли умния списък „${r.smart.name}“? Записите остават.`))) Smart.remove(r.smart.id); });
  $("[data-q]", el).oninput = ev => { st.q = ev.target.value; draw(); };
  $("[data-type]", el).onchange = ev => r.smart ? (st.type = ev.target.value, Views.browse(el, { ...r, ...st, type: ev.target.value, missing: "" }, pane)) : Panes.show({ view: "browse", type: ev.target.value, tag: st.tag }, pane);
  $("[data-status]", el).onchange = ev => { st.status = ev.target.value; draw(); };
  $("[data-sort]", el).onchange = ev => { st.sort = ev.target.value; draw(); };
  $("[data-grid]", el).onclick = () => { M.state.browseGrid = !st.grid; saveState(); Panes.show({ view: "browse", type: st.type, tag: st.tag }, pane); };
  $$("[data-tag]", el).forEach(c => c.onclick = () => Panes.show({ view: "browse", type: st.type, tag: c.dataset.tag === st.tag ? "" : c.dataset.tag }, pane));
  $("[data-new]", el).onclick = () => newEntryBox(st.type);
  draw();
};

async function newEntryBox(type = "", title = "") {
  const types = M.world.types;
  const res = await modal(t("New entry"), `<input class="input" id="nt" value="${esc(title)}" placeholder="${t("Name")}" style="font-size:16px;margin-bottom:10px">
    <div class="row">${types.map(x => `<button class="chip ${x.key === (type || "character") ? "on" : ""}" data-k="${x.key}">${x.icon} ${esc(typeName(x.key))}</button>`).join("")}</div>`, {
    buttons: [{ label: t("Cancel"), value: null }, { label: t("Create"), cls: "primary", value: ov => ({ title: $("#nt", ov).value.trim(), type: $(".chip.on", ov).dataset.k }) }],
    onOpen: (ov, close) => {
      $$("[data-k]", ov).forEach(b => b.onclick = () => { $$("[data-k]", ov).forEach(x => x.classList.remove("on")); b.classList.add("on"); $("#nt", ov).focus(); });
      $("#nt", ov).focus(); $("#nt", ov).onkeydown = e => { if (e.key === "Enter") close({ title: e.target.value.trim(), type: $(".chip.on", ov).dataset.k }); };
    },
  });
  if (!res) return;
  const e = await createEntry(res.type, res.title);
  Entry.editing.add(e.id); open(e.id);
}

// ------------------------------------------------------------------ timeline (with ages)
Views.timeline = (el, r, pane) => {
  const st = { who: "", where: "", tag: "", scrapped: false };
  el.innerHTML = paneHead(t("Timeline"), `<button class="btn primary small" data-new>＋ ${tf("Event", "Събитие")}</button>`, pane) + `
    <div class="pane-body"><div class="wrap">
      <div class="row" style="margin-bottom:14px">
        <div style="width:240px" data-who></div><div style="width:240px" data-where></div>
        <label class="small muted"><input type="checkbox" data-scr> ${tf("show scrapped", "покажи отхвърлени")}</label>
      </div>
      <div data-tl></div>
    </div></div>`;
  Entry.linkPicker($("[data-who]", el), [], ["character", "faction", "entity", "creature"], ids => { st.who = ids[0] || ""; draw(); }, true);
  Entry.linkPicker($("[data-where]", el), [], ["location"], ids => { st.where = ids[0] || ""; draw(); }, true);
  $("[data-who] input", el).placeholder = tf("Filter by who…", "Филтър по кой…");
  $("[data-where] input", el).placeholder = tf("Filter by place…", "Филтър по място…");
  $("[data-scr]", el).onchange = ev => { st.scrapped = ev.target.checked; draw(); };
  $("[data-new]", el).onclick = async () => { const e = await createEntry("event", ""); Entry.editing.add(e.id); open(e.id); };
  const inside = (loc, target) => { let c = loc; const seen = new Set(); while (c && !seen.has(c)) { if (c === target) return true; seen.add(c); c = M.entries.get(c)?.fields?.partOf; } return false; };
  function draw() {
    const items = [];
    for (const e of M.entries.values()) {
      if (!st.scrapped && e.status === "scrapped") continue;
      const add = (date, label, kind) => date && items.push({ e, date, label, kind });
      if (e.type === "event") add(e.fields?.date, "", "event");
      if (e.type === "chapter") add(e.fields?.date, tf("chapter", "глава"), "chapter");
      if (e.type === "character") { add(e.fields?.born, tf("born", "роден"), "life"); add(e.fields?.died, tf("died", "умира"), "life"); }
      if (e.type === "faction") { add(e.fields?.founded, tf("founded", "основана"), "life"); add(e.fields?.dissolved, tf("dissolved", "разпусната"), "life"); }
      if (e.type === "location") { add(e.fields?.founded, tf("founded", "основано"), "life"); add(e.fields?.destroyed, tf("destroyed", "разрушено"), "life"); }
      if (e.type === "entity" && e.fields?.crossed) { const fd = typeOf("entity").fields.find(x => x.key === "crossed"); add(e.fields.crossed, fd ? fieldLabel(fd).toLowerCase() : "arrives", "life"); }
    }
    const filtered = items.filter(x => {
      if (st.who) { const ps = [...(x.e.fields?.participants || []), x.e.fields?.pov]; if (x.e.id !== st.who && !ps.includes(st.who)) return false; }
      if (st.where && !(x.e.fields?.where && inside(x.e.fields.where, st.where))) return false;
      return true;
    }).sort((a, b) => Cal.key(a.date) - Cal.key(b.date));
    const undated = entriesOf("event").filter(e => !e.fields?.date && (st.scrapped || e.status !== "scrapped"));
    let html = "", lastEra = null;
    for (const x of filtered) {
      const era = Cal.eraOf(Cal.parts(x.date).y);
      if (era !== lastEra) { html += `<div class="tl-era">${esc(era.name)}</div>`; lastEra = era; }
      const ps = (x.e.fields?.participants || []).map(id => M.entries.get(id)).filter(p => p?.type === "character");
      const ages = ps.map(p => { if (!p.fields?.born) return null; if (p.fields?.died && Cal.key(p.fields.died) < Cal.key(x.date)) return `${p.title} †`; const a = Cal.yearsBetween(p.fields.born, x.date); return a !== null && a >= 0 ? `${p.title} ${a}` : null; }).filter(Boolean);
      html += `<div class="tl-item"><div class="card" data-open="${x.e.id}">
        <div class="tl-date">${esc(Cal.format(x.date))}${x.label ? ` · <span class="faint">${esc(x.label)}</span>` : ""}</div>
        <div style="font:600 15px var(--serif)">${esc(x.e.title)}</div>${x.kind === "event" ? `<div class="faint small">${esc(summary(x.e, 160))}</div>` : ""}
        ${ages.length ? `<div class="tl-ages">${tf("Ages", "Възрасти")}: ${ages.map(esc).join(" · ")}</div>` : ""}</div></div>`;
    }
    $("[data-tl]", el).innerHTML = (html ? `<div class="tl">${html}</div>` : `<div class="empty">${tf("No dated events yet. Give events a date (e.g. 512 AF) and they appear here.", "Още няма събития с дата. Дайте дата (напр. 512 AF) и ще се появят тук.")}</div>`)
      + (undated.length ? `<div class="section-title">${t("Undated")} (${undated.length})</div><div class="list">${undated.map(e => rowFor(e)).join("")}</div>` : "");
  }
  draw();
};

// ------------------------------------------------------------------ story / chapters
Views.story = (el, r, pane) => {
  const chapters = entriesOf("chapter").sort((a, b) => (a.fields?.order ?? 999) - (b.fields?.order ?? 999) || a.title.localeCompare(b.title));
  const appear = ch => {
    const ids = new Set(linksIn(ch.body).map(n => Idx.find(n)?.id).filter(Boolean)); if (ch.fields?.pov) ids.add(ch.fields.pov);
    const es = [...ids].map(id => M.entries.get(id)).filter(Boolean);
    return { chars: es.filter(e => e.type === "character"), places: es.filter(e => e.type === "location") };
  };
  const totalW = chapters.reduce((s, c) => s + words(c.body), 0);
  el.innerHTML = paneHead(t("Story"), `<span class="faint small">${totalW.toLocaleString()} ${t("words")}</span><button class="btn primary small" data-new>＋ ${tf("Chapter", "Глава")}</button>`, pane) + `
    <div class="pane-body"><div class="wrap">
      ${chapters.length ? chapters.map(ch => { const a = appear(ch); return `<div class="card" style="margin-bottom:10px">
        <div class="row"><b style="font:600 16px var(--serif);cursor:pointer" data-open="${ch.id}">${ch.fields?.order != null ? ch.fields.order + ". " : ""}${esc(ch.title)}</b>
        <span class="status ${ch.fields?.progress === "done" ? "canon" : "draft"}">${esc(optLabel(ch.fields?.progress || "idea"))}</span><span class="spacer"></span>
        <span class="faint small">${words(ch.body)} ${t("words")}</span><button class="btn small ghost" data-write="${ch.id}">✎ ${t("Writing mode")}</button></div>
        ${ch.fields?.summary ? `<div class="muted small" style="margin-top:4px">${esc(ch.fields.summary)}</div>` : ""}
        <div class="row small" style="margin-top:6px">${a.chars.map(x => chipFor(x.id)).join("")}${a.places.map(x => chipFor(x.id)).join("")}${!a.chars.length && !a.places.length ? `<span class="faint">${tf("No characters or places linked yet", "Още няма свързани персонажи или места")}</span>` : ""}</div></div>`; }).join("")
        : `<div class="empty">${tf("No chapters yet. Chapters list which characters and places appear in them automatically from your [[links]].", "Още няма глави. Главите показват автоматично кои персонажи и места се появяват в тях от вашите [[връзки]].")}</div>`}
    </div></div>`;
  $("[data-new]", el).onclick = async () => { const n = chapters.length ? Math.max(...chapters.map(c => +c.fields?.order || 0)) + 1 : 1;
    const e = await createEntry("chapter", tf(`Chapter ${n}`, `Глава ${n}`), { fields: { order: n, progress: "idea" } }); Entry.editing.add(e.id); open(e.id); };
  $$("[data-write]", el).forEach(b => b.onclick = () => Entry.writingMode(b.dataset.write, () => Panes.refresh()));
};

// ------------------------------------------------------------------ alchemy & rituals
Views.alchemy = (el, r, pane) => {
  const ings = sortByTitle(entriesOf("ingredient")), pots = sortByTitle(entriesOf("potion")), rits = sortByTitle(entriesOf("ritual")), rules = sortByTitle(entriesOf("rule"));
  let sel = r.id || "";
  el.innerHTML = paneHead(t("Alchemy & rituals"), `<div class="row"><button class="btn small" data-new="ingredient">＋ ${esc(typeName("ingredient"))}</button><button class="btn small" data-new="potion">＋ ${esc(typeName("potion"))}</button><button class="btn small" data-new="ritual">＋ ${esc(typeName("ritual"))}</button><button class="btn small" data-new="rule">＋ ${esc(typeName("rule"))}</button></div>`, pane) + `
    <div class="pane-body"><div class="wrap wide"><div class="grid" style="grid-template-columns:240px minmax(0,1fr) minmax(0,1fr);align-items:start">
      <div class="card"><h3>❦ ${tf("Ingredients", "Съставки")}</h3><div class="faint small" style="margin-bottom:6px">${tf("Click one to see everything that uses it.", "Щракнете, за да видите всичко, което я използва.")}</div><div data-ings></div></div>
      <div><div class="section-title" style="margin-top:0">⚗ ${tf("Potions", "Отвари")}</div><div data-pots></div></div>
      <div><div class="section-title" style="margin-top:0">☽ ${tf("Rituals", "Ритуали")}</div><div data-rits></div>
        <div class="section-title">§ ${tf("Rules of magic", "Правила на магията")}</div><div class="list">${rules.map(e => rowFor(e)).join("") || `<div class="empty">—</div>`}</div></div>
    </div></div></div>`;
  const uses = (e, id) => [...(e.fields?.ingredients || []), ...(e.fields?.components || [])].includes(id);
  const draw = () => {
    $("[data-ings]", el).innerHTML = `<div class="list">${ings.map(i => { const n = [...pots, ...rits].filter(p => uses(p, i.id)).length;
      return `<div class="li" data-sel="${i.id}" style="${sel === i.id ? "background:var(--accent-soft)" : ""}"><div class="main"><div class="t">${esc(i.title)}</div></div><span class="faint small">${n}</span></div>`; }).join("") || `<div class="empty">—</div>`}</div>
      ${sel ? `<button class="btn small ghost" data-clear style="margin-top:6px">${tf("Show all", "Покажи всички")}</button>` : ""}`;
    const block = p => `<div class="card" style="margin-bottom:8px;cursor:pointer" data-open="${p.id}"><div class="row"><b>${esc(p.title)}</b>${p.fields?.risk ? `<span class="status ${p.fields.risk === "minor" ? "canon" : "draft"}">${esc(optLabel(p.fields.risk))}</span>` : ""}</div>
      <div class="row small" style="margin-top:4px">${[...(p.fields?.ingredients || []), ...(p.fields?.components || [])].map(id => chipFor(id)).join("") || `<span class="faint">${tf("no ingredients yet", "още няма съставки")}</span>`}</div>
      <div class="faint small" style="margin-top:4px">${esc(summary({ body: p.fields?.effects || p.fields?.consequences || p.body }, 140))}</div></div>`;
    $("[data-pots]", el).innerHTML = pots.filter(p => !sel || uses(p, sel)).map(block).join("") || `<div class="empty">—</div>`;
    $("[data-rits]", el).innerHTML = rits.filter(p => !sel || uses(p, sel)).map(block).join("") || `<div class="empty">—</div>`;
    $$("[data-sel]", el).forEach(x => x.onclick = ev => { if (ev.detail === 2) return open(x.dataset.sel); sel = sel === x.dataset.sel ? "" : x.dataset.sel; draw(); });
    $("[data-clear]", el)?.addEventListener("click", () => { sel = ""; draw(); });
  };
  $$("[data-new]", el).forEach(b => b.onclick = async () => { const e = await createEntry(b.dataset.new, ""); Entry.editing.add(e.id); open(e.id); });
  draw();
};

// ------------------------------------------------------------------ glossary, languages, translation
Views.glossary = (el, r, pane) => {
  const terms = sortByTitle(entriesOf("term")), langs = sortByTitle(entriesOf("language"));
  el.innerHTML = paneHead(t("Glossary & languages"), `<div class="row"><button class="btn small" data-new="term">＋ ${esc(typeName("term"))}</button><button class="btn small" data-new="language">＋ ${esc(typeName("language"))}</button></div>`, pane) + `
    <div class="pane-body"><div class="wrap wide"><div class="grid" style="grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);align-items:start">
      <div><input class="input" data-q placeholder="${t("Filter…")}" style="margin-bottom:10px"><div data-terms></div></div>
      <div>
        <div class="card" ${langs.length ? "" : "hidden"}><h3>${t("Translate")}</h3>
          <div class="row" style="flex-wrap:nowrap"><select class="input" data-lang style="width:auto">${langs.map(l => `<option value="${l.id}">${esc(l.title)}</option>`).join("")}</select>
          <input class="input" data-tr placeholder="${tf("a word or phrase, either way", "дума или фраза, в двете посоки")}"></div><div data-tro style="margin-top:8px"></div></div>
        <div class="section-title">${tf("Languages", "Езици")}</div><div class="list">${langs.map(l => rowFor(l, `<span class="faint small">${(l.fields?.roots || "").split("\n").filter(Boolean).length} ${tf("words", "думи")}</span>`)).join("") || `<div class="empty">${tf("No languages yet. A language has a dictionary (word = meaning), sound rules and syllables for the name generator.", "Още няма езици. Езикът има речник (дума = значение), звукови правила и срички за генератора на имена.")}</div>`}</div>
      </div></div></div></div>`;
  const drawTerms = q => {
    const list = terms.filter(x => !q || norm(x.title).includes(norm(q)) || norm(x.fields?.meaning).includes(norm(q)));
    let last = "";
    $("[data-terms]", el).innerHTML = list.map(x => { const L = x.title[0]?.toUpperCase() || "#"; const head = L !== last ? `<div class="section-title">${esc(L)}</div>` : ""; last = L;
      return head + `<div class="li" data-open="${x.id}"><div class="main"><div class="t">${esc(x.title)} ${x.fields?.pronunciation ? `<span class="faint small">/${esc(x.fields.pronunciation)}/</span>` : ""}</div>
        <div class="d">${esc(x.fields?.meaning || summary(x, 120))}</div></div>${x.fields?.language ? `<span class="faint small">${esc(titleOf(x.fields.language))}</span>` : ""}</div>`; }).join("") || `<div class="empty">${tf("No glossary terms yet.", "Още няма термини.")}</div>`;
  };
  const translate = () => {
    const l = M.entries.get($("[data-lang]", el)?.value); const q = norm($("[data-tr]", el).value); const out = $("[data-tro]", el);
    if (!l || !q) { out.innerHTML = ""; return; }
    const dict = (l.fields?.roots || "").split("\n").map(x => x.split("=").map(s => s.trim())).filter(x => x.length === 2 && x[0]);
    const res = q.split(/\s+/).map(w => {
      const fwd = dict.find(([a]) => norm(a) === w), back = dict.find(([, b]) => norm(b).split(/[,;/]/).map(s => s.trim()).includes(w));
      const part = dict.filter(([a, b]) => norm(a).includes(w) || norm(b).includes(w)).slice(0, 4);
      return `<div class="small"><b>${esc(w)}</b> → ${fwd ? esc(fwd[1]) : back ? esc(back[0]) : `<span class="faint">${tf("not in the dictionary", "не е в речника")}</span>`}
        ${!fwd && !back && part.length ? `<div class="faint">${tf("close", "близки")}: ${part.map(p => esc(p[0] + " = " + p[1])).join(" · ")}</div>` : ""}</div>`;
    });
    out.innerHTML = res.join("");
  };
  $("[data-q]", el).oninput = ev => drawTerms(ev.target.value);
  $("[data-tr]", el).oninput = translate; $("[data-lang]", el)?.addEventListener("change", translate);
  $$("[data-new]", el).forEach(b => b.onclick = async () => { const e = await createEntry(b.dataset.new, ""); Entry.editing.add(e.id); open(e.id); });
  drawTerms("");
};

// ------------------------------------------------------------------ name generator (offline)
const Names = {
  markov(samples, n = 12) {
    const names = samples.map(s => s.trim().toLowerCase()).filter(s => s.length > 1);
    if (names.length < 3) return [];
    const order = 2, chain = {};
    for (const nm of names) { const s = "^^" + nm + "$"; for (let i = 0; i < s.length - order; i++) { const k = s.slice(i, i + order); (chain[k] = chain[k] || []).push(s[i + order]); } }
    const out = new Set(); let tries = 0;
    while (out.size < n && tries++ < 2000) {
      let k = "^^", w = "";
      for (let i = 0; i < 14; i++) { const opts = chain[k]; if (!opts) break; const c = opts[Math.floor(Math.random() * opts.length)]; if (c === "$") break; w += c; k = k.slice(1) + c; }
      if (w.length >= 3 && w.length <= 12 && !names.includes(w)) out.add(w[0].toUpperCase() + w.slice(1));
    }
    return [...out];
  },
  syllables(spec, n = 12) {
    const parts = spec.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
    const starts = parts.filter(p => !p.startsWith("-")), ends = parts.filter(p => p.startsWith("-")).map(p => p.slice(1));
    if (!starts.length) return [];
    const pick = a => a[Math.floor(Math.random() * a.length)];
    const out = new Set(); let tries = 0;
    while (out.size < n && tries++ < 500) {
      const k = 1 + Math.floor(Math.random() * 2); let w = ""; for (let i = 0; i <= k; i++) w += pick(starts);
      if (ends.length && Math.random() < .6) w += pick(ends);
      w = w.replace(/(.)\1\1+/g, "$1$1"); out.add(w[0].toUpperCase() + w.slice(1));
    }
    return [...out];
  },
};
// Built-in name styles. Samples are historical Slavic and Old Bulgarian names; the generator makes new ones that sound alike.
const NAME_STYLES = {
  "sl-m": ["Slavic / Old Bulgarian — men", "Славянски / старобългарски — мъжки", "Boris, Simeon, Petar, Samuil, Gavril, Radomir, Ivan, Asen, Kaloyan, Boril, Smilets, Svetoslav, Shishman, Sratsimir, Dobromir, Radoslav, Borislav, Vladislav, Stoyan, Bogomil, Dragomir, Velislav, Momchil, Rayko, Tihomir, Yaroslav, Mstislav, Rostislav, Vsevolod, Lyuboslav, Miroslav, Desislav, Gorazd, Kliment, Naum, Presian, Malamir, Zhelyo, Dobri, Milko, Vlad, Bozhidar, Dragan, Lyuben, Ognyan, Krasimir, Zvezdomir, Velichko, Tsvetan, Zhivko"],
  "sl-f": ["Slavic / Old Bulgarian — women", "Славянски / старобългарски — женски", "Elena, Irina, Mara, Desislava, Kerka, Dragana, Radka, Stoyanka, Bozhana, Zlatka, Milena, Vladislava, Lyudmila, Dobromira, Svetlana, Bogdana, Yana, Zhivka, Rada, Neda, Vela, Velika, Yarmila, Zorka, Snezhana, Mladena, Grozda, Tsveta, Kalina, Boyana, Dragomira, Radoslava, Lyubava, Mila, Stana, Vesela, Dobrava, Ognyana, Rusana, Zvezdelina, Lada, Vida, Militsa, Zhelyazka, Bisera"],
  "bulgar": ["Old Bulgar (khans' names)", "Прабългарски (имена на ханове)", "Kubrat, Asparuh, Tervel, Kormisosh, Vinekh, Telets, Sabin, Umor, Toktu, Pagan, Telerig, Kardam, Krum, Omurtag, Malamir, Persian, Organa, Kotrag, Kuber, Batbayan, Altsek, Gostun, Bezmer, Avitohol, Irnik, Isbul, Tsok, Ishbara, Kavkhan, Sevar, Bayan, Ochir, Enravota, Zvinitsa, Kartal"],
  "sl-family": ["Slavic family names", "Славянски фамилии", ""],
  "sl-full": ["Slavic full names", "Славянски пълни имена", ""],
  "sl-place": ["Slavic / Old Bulgarian places", "Славянски / старобългарски места", "Pliska, Preslav, Ohrid, Tarnovo, Vidin, Drastar, Serdika, Melnik, Lovech, Cherven, Kaliakra, Belograd, Vratsa, Smolyan, Bdin, Prilep, Devol, Moglena, Mesemvria, Anhialo, Boruy, Provadia, Madara, Shumen, Vodena, Strumitsa, Skopie, Velbazhd, Zemen, Rila, Pernik, Sredets, Kostur, Lyutitsa, Ostrovo, Glavinitsa, Dristra, Tsepina, Mezek, Krichim"],
};
const CYR = [["sht", "щ"], ["zh", "ж"], ["ch", "ч"], ["sh", "ш"], ["ts", "ц"], ["yu", "ю"], ["ya", "я"], ["yo", "йо"], ["a", "а"], ["b", "б"], ["v", "в"], ["g", "г"], ["d", "д"], ["e", "е"], ["z", "з"], ["i", "и"], ["y", "й"], ["k", "к"], ["l", "л"], ["m", "м"], ["n", "н"], ["o", "о"], ["p", "п"], ["r", "р"], ["s", "с"], ["t", "т"], ["u", "у"], ["f", "ф"], ["h", "х"], ["c", "ц"], ["w", "в"], ["x", "кс"], ["q", "к"], ["j", "дж"]];
function toCyrillic(name) {
  let out = "", s = name.toLowerCase()
    .replace(/([^aeiouy])yo/g, "$1ьo")                       // Velyo → Вельо
    .replace(/([^aeiouy])y(?=[^aeiouy]|$)/g, "$1i");          // a stray y between consonants reads as и
  for (let i = 0; i < s.length;) { const m = CYR.find(([l]) => s.startsWith(l, i)); if (m) { out += m[1]; i += m[0].length; } else { out += s[i]; i++; } }
  return out ? out[0].toUpperCase() + out.slice(1) : out;
}
Names.style = (key, n = 16) => {
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const list = k => NAME_STYLES[k][2].split(/,\s*/);
  // good shapes only: long enough, women's names end in -a/-ya, men's don't, no clusters of three consonants at the end
  const ok = k => w => w.length >= 4 && w.length <= 11 && /[aeiou]/i.test(w) && !/[^aeiouy]{3}$/i.test(w)
    && (k === "sl-f" ? /a$/.test(w) : k === "sl-m" ? !/a$/.test(w) : true);
  const gen = (k, m) => { const g = Names.markov(list(k), m * 4).filter(ok(k)).slice(0, m); return g.length ? g : list(k).slice(0, m); };
  const family = (fem) => { const base = pick(gen("sl-m", 6)).replace(/[aeiouy]$/, ""); const suf = pick(fem ? ["ova", "eva", "ska", "ina"] : ["ov", "ev", "ski", "in"]);
    return base + (/[aeiou]$/.test(base) && suf[0] === "e" ? suf.slice(1) : base.endsWith("k") && suf === "ski" ? "i" : suf); };
  if (key === "sl-family") return Array.from({ length: n }, (_, i) => family(i % 2 === 1));
  if (key === "sl-full") return Array.from({ length: n }, (_, i) => { const fem = i % 2 === 1; return `${pick(gen(fem ? "sl-f" : "sl-m", 8))} ${family(fem)}`; });
  if (key === "sl-place") { const roots = gen("sl-place", n); const sufs = ["grad", "ovo", "evo", "ets", "ishte", "nik", "ina", "sko", "bor", "dol", "ovets", "itsa"];
    return roots.map((r, i) => i % 3 === 2 ? r.replace(/[aeiouy]$/, "") + pick(sufs) : r).map(x => x[0].toUpperCase() + x.slice(1)); }
  return gen(key, n);
};
Views.names = (el, r, pane) => {
  const langs = sortByTitle(entriesOf("language"));
  el.innerHTML = paneHead(t("Name generator"), "", pane) + `<div class="pane-body"><div class="wrap">
    <div class="card"><div class="form-grid">
      <label>${tf("Culture / language", "Култура / език")}</label><select class="input" data-l><option value="">${tf("— use the box below —", "— използвай полето отдолу —")}</option>
        <optgroup label="${tf("Built in", "Вградени")}">${Object.entries(NAME_STYLES).map(([k, v]) => `<option value="bi:${k}">${esc(tf(v[0], v[1]))}</option>`).join("")}</optgroup>
        ${langs.length ? `<optgroup label="${tf("Your languages", "Вашите езици")}">${langs.map(l => `<option value="${l.id}">${esc(l.title)}</option>`).join("")}</optgroup>` : ""}</select>
      <label>${tf("Letters", "Букви")}</label><select class="input" data-script style="width:auto"><option value="lat">${tf("Latin (Dragomir)", "Латиница (Dragomir)")}</option><option value="cyr" ${(M.state.nameScript || (M.settings.language === "bg" ? "cyr" : "lat")) === "cyr" ? "selected" : ""}>${tf("Cyrillic (Драгомир)", "Кирилица (Драгомир)")}</option></select>
      <label>${tf("Sample names", "Примерни имена")}</label><textarea class="input" data-s rows="3" placeholder="${tf("A few names that sound right, comma or line separated (best results)", "Няколко имена, които звучат правилно, със запетая или на ред")}"></textarea>
      <label>${tf("…or syllables", "…или срички")}</label><input class="input" data-y placeholder="mor, vel, dra, ka, -ov, -ina">
    </div><div class="row" style="margin-top:10px"><span class="spacer"></span><button class="btn primary" data-g>${t("Generate")}</button></div></div>
    <div data-out style="margin-top:14px"></div>
    <div class="faint small" style="margin-top:10px">${tf("Works offline. Save sample names and syllables on a Language entry to reuse them. Click a name to create a character with it.", "Работи без интернет. Запазете примерните имена и срички в запис Език. Щракнете име, за да създадете персонаж с него.")}</div></div></div>`;
  const fill = () => { const v = $("[data-l]", el).value;
    if (v.startsWith("bi:")) { const st = NAME_STYLES[v.slice(3)]; $("[data-s]", el).value = st[2] || ""; $("[data-y]", el).value = ""; $("[data-s]", el).placeholder = st[2] ? "" : tf("Made from the Slavic men's and women's names", "Прави се от славянските мъжки и женски имена"); return; }
    const l = M.entries.get(v); if (!l) return; $("[data-s]", el).value = (l.fields?.sampleNames || "").replace(/\n/g, ", "); $("[data-y]", el).value = l.fields?.syllables || ""; };
  $("[data-l]", el).onchange = fill;
  $("[data-g]", el).onclick = () => {
    const samples = $("[data-s]", el).value.split(/[,\n]/).filter(Boolean), styleKey = $("[data-l]", el).value.startsWith("bi:") ? $("[data-l]", el).value.slice(3) : "";
    const builtin = styleKey && samples.join(",").replace(/\s/g, "") === (NAME_STYLES[styleKey][2] || "").replace(/\s/g, "");
    let names = builtin || (styleKey && !NAME_STYLES[styleKey][2]) ? Names.style(styleKey, 16) : Names.markov(samples, 16);
    if (names.length < 6) names = [...names, ...Names.syllables($("[data-y]", el).value, 16 - names.length)];
    const script = $("[data-script]", el).value; M.state.nameScript = script; saveState();
    if (script === "cyr") names = names.map(n => n.split(" ").map(toCyrillic).join(" "));
    $("[data-out]", el).innerHTML = names.length ? `<div class="row">${names.map(n => `<button class="chip" data-n="${esc(n)}" style="font-size:14px;padding:4px 12px">${esc(n)}</button>`).join("")}</div>`
      : `<div class="empty">${tf("Add at least 3 sample names or a few syllables.", "Добавете поне 3 примерни имена или няколко срички.")}</div>`;
    $$("[data-n]", el).forEach(b => b.onclick = async () => { const e = await createEntry("character", b.dataset.n); open(e.id); });
  };
};

// ------------------------------------------------------------------ world at a point in time
Views.worldat = (el, r, pane) => {
  let year = M.state.worldYear ?? Cal.present();
  el.innerHTML = paneHead(t("World at a time"), "", pane) + `<div class="pane-body"><div class="wrap wide">
    <div class="card row" style="margin-bottom:12px"><b>${t("Year")}</b><input class="input" data-y style="width:160px" value="${esc(Cal.yearLabel(year))}">
      <input type="range" data-r min="-200" max="${Cal.present() + 50}" value="${year}" style="flex:1"><span class="faint small" data-lbl></span>
      <button class="btn small ghost" data-now>${tf("Present", "Настояще")}</button></div>
    <div data-out></div></div></div>`;
  const yi = $("[data-y]", el), rg = $("[data-r]", el);
  const within = (from, to) => (from === undefined || from === "" || Cal.parts(from).y <= year) && (to === undefined || to === "" || Cal.parts(to).y >= year);
  const draw = () => {
    M.state.worldYear = year; saveState();
    $("[data-lbl]", el).textContent = Cal.eraOf(year).name;
    const live = [...M.entries.values()].filter(e => e.status !== "scrapped");
    const chars = live.filter(e => e.type === "character" && e.fields?.born && within(e.fields.born, e.fields.died));
    const dead = live.filter(e => e.type === "character" && e.fields?.died && Cal.parts(e.fields.died).y < year).length;
    const facs = live.filter(e => e.type === "faction" && (e.fields?.founded || e.fields?.dissolved) && within(e.fields.founded, e.fields.dissolved));
    const places = live.filter(e => e.type === "location" && (e.fields?.founded || e.fields?.destroyed) && within(e.fields.founded, e.fields.destroyed));
    const evs = live.filter(e => e.type === "event" && e.fields?.date && (Cal.parts(e.fields.date).y === year || (e.fields?.endDate && within(e.fields.date, e.fields.endDate))));
    const maps = entriesOf("map").filter(m => (m.map?.layers || []).some(l => l.from !== undefined || l.to !== undefined));
    const col = (title, list, extra = () => "") => `<div class="card"><h3>${title} <span class="faint small">${list.length}</span></h3>${list.length ? `<div class="list">${list.map(e => rowFor(e, extra(e))).join("")}</div>` : `<div class="faint small">—</div>`}</div>`;
    $("[data-out]", el).innerHTML = `<div class="grid c2">
      ${col(tf("Alive", "Живи"), chars, e => `<span class="faint small">${tf("age", "на")} ${Cal.yearsBetween(e.fields.born, String(year))}</span>`)}
      ${col(tf("Events this year", "Събития тази година"), evs)}
      ${col(tf("Factions that exist", "Съществуващи фракции"), facs)}
      ${col(tf("Places that exist (with dates)", "Съществуващи места (с дати)"), places)}</div>
      <div class="faint small" style="margin-top:10px">${dead} ${tf("characters have died by then. Only entries with dates are counted.", "персонажа са починали дотогава. Броят се само записи с дати.")}
      ${maps.length ? `<br>${tf("Maps with era layers", "Карти със слоеве по епохи")}: ${maps.map(m => `<a class="wl" data-map="${m.id}">${esc(m.title)}</a>`).join(", ")}` : ""}</div>`;
    $$("[data-map]", el).forEach(a => a.onclick = ev => { ev.stopPropagation(); Panes.show({ view: "map", id: a.dataset.map, year }, pane); });
  };
  yi.onchange = () => { const v = Cal.parse(yi.value); if (v !== null && v !== "") { year = Cal.parts(v).y; rg.value = year; yi.value = Cal.yearLabel(year); draw(); } };
  rg.oninput = () => { year = +rg.value; yi.value = Cal.yearLabel(year); draw(); };
  $("[data-now]", el).onclick = () => { year = Cal.present(); rg.value = year; yi.value = Cal.yearLabel(year); draw(); };
  draw();
};

// ------------------------------------------------------------------ inbox (quick notes)
Views.inbox = (el, r, pane) => {
  const notes = entriesOf("note").filter(e => (e.tags || []).includes("inbox")).sort((a, b) => new Date(b.created) - new Date(a.created));
  el.innerHTML = paneHead(t("Inbox"), `<button class="btn primary small" data-cap>＋ ${t("Quick note")}</button>`, pane) + `<div class="pane-body"><div class="wrap">
    <div class="faint small" style="margin-bottom:12px">${tf("Ideas you jotted down with Ctrl+Space. Turn each into a proper entry when you're ready.", "Идеи, записани с Ctrl+Space. Превърнете всяка в истински запис, когато сте готови.")}</div>
    ${notes.map(n => `<div class="card" style="margin-bottom:8px"><div class="md">${MD.render(n.body || n.title)}</div>
      <div class="row" style="margin-top:6px"><span class="faint small">${esc((n.created || "").replace("T", " ").slice(0, 16))}</span><span class="spacer"></span>
      <select class="input" data-conv="${n.id}" style="width:auto"><option value="">${tf("Turn into…", "Превърни в…")}</option>${M.world.types.filter(x => x.key !== "note").map(x => `<option value="${x.key}">${x.icon} ${esc(typeName(x.key))}</option>`).join("")}</select>
      <button class="btn small ghost" data-open="${n.id}">${t("Edit")}</button><button class="btn small ghost danger" data-del="${n.id}">✕</button></div></div>`).join("") || `<div class="empty">${tf("Inbox is empty.", "Входящите са празни.")}</div>`}
    </div></div>`;
  $("[data-cap]", el).onclick = () => Capture.open();
  $$("[data-conv]", el).forEach(s => s.onchange = async () => {
    const n = M.entries.get(s.dataset.conv); if (!s.value) return;
    const title = await promptBox(tf("Name for the new entry", "Име на новия запис"), n.title !== n.body ? n.title : (n.body || "").split("\n")[0].slice(0, 60));
    if (title === null) { s.value = ""; return; }
    const e = await saveEntry({ ...n, type: s.value, title: title || n.title, tags: (n.tags || []).filter(x => x !== "inbox") });
    Entry.editing.add(e.id); open(e.id);
  });
  $$("[data-del]", el).forEach(b => b.onclick = async () => { await deleteEntry(b.dataset.del); Panes.refresh(pane); });
};
const Capture = {
  open() {
    modal(t("Quick note"), `<textarea class="input" id="cap" rows="5" placeholder="${tf("Jot it down — sort it out later. Ctrl+Enter to save.", "Запишете го — подредете по-късно. Ctrl+Enter за запис.")}"></textarea>`, {
      buttons: [{ label: t("Cancel"), value: null }, { label: t("Save"), cls: "primary", value: ov => $("#cap", ov).value }],
      onOpen: (ov, close) => { const ta = $("#cap", ov); ta.focus(); Entry.linkAutocomplete(ta); ta.onkeydown = e => { if (e.key === "Enter" && e.ctrlKey) close(ta.value); }; },
    }).then(async text => {
      if (!text || !text.trim()) return;
      const first = text.trim().split("\n")[0].replace(/\[\[|\]\]/g, "");
      await createEntry("note", first.slice(0, 60), { body: text.trim(), tags: ["inbox"] });
      toast(tf("Saved to the inbox", "Запазено във входящи")); Nav.render();
      if (Panes.cur[0]?.view === "inbox") Panes.refresh(0);
    });
  },
};

// ------------------------------------------------------------------ contradictions
Views.contradictions = (el, r, pane) => {
  let filter = r.id || "open";
  el.innerHTML = paneHead(t("Contradictions"), `<div class="row"><button class="btn small" data-ai>✦ ${t("Check whole world")}</button></div>`, pane) + `<div class="pane-body"><div class="wrap">
    <div class="row" style="margin-bottom:12px">${["open", "intentional", "resolved"].map(s => `<span class="chip ${s === filter ? "on" : ""}" data-f="${s}">${t(s === "open" ? tf("Open", "Отворени") : s === "intentional" ? "Intentional" : "Resolved")}</span>`).join("")}
    <span class="spacer"></span><span class="faint small">${tf("Hard facts are checked automatically every time you save. ✦ also compares the text with the AI.", "Твърдите факти се проверяват автоматично при всеки запис. ✦ сравнява и текста с AI.")}</span></div>
    <div data-list></div></div></div>`;
  const draw = () => {
    const list = Checks.contradictions().filter(c => c.status === filter);
    $("[data-list]", el).innerHTML = list.map(c => `<div class="issue ${c.status}">
      <div class="row"><b>${esc(c.why)}</b><span class="spacer"></span><span class="faint small">${c.source === "rule" ? tf("automatic check", "автоматична проверка") : c.source === "ai" ? "✦ AI" : tf("found when importing", "открито при импорта")}</span></div>
      <div class="pair">${[c.a, c.b].map(s => `<div class="quote">${s?.id ? `<b data-open="${s.id}">${esc(titleOf(s.id))}</b>` : ""}${esc(s?.text || "")}</div>`).join("")}</div>
      ${c.note ? `<div class="faint small" style="margin-bottom:6px">${esc(c.note)}</div>` : ""}
      <div class="row">${c.status === "open" ? `<button class="btn small" data-s="resolved" data-k="${esc(c.key)}">✓ ${t("Resolved")}</button><button class="btn small ghost" data-s="intentional" data-k="${esc(c.key)}">${t("Intentional")}</button>`
        : `<button class="btn small ghost" data-s="open" data-k="${esc(c.key)}">${t("Reopen")}</button>`}
        ${c.a?.id && c.b?.id && c.a.id !== c.b.id ? `<button class="btn small ghost" data-both="${c.a.id}|${c.b.id}">${tf("Open both side by side", "Отвори двете едно до друго")}</button>` : ""}
        ${c.source !== "rule" ? `<button class="btn small ghost" data-ask="${esc(c.key)}">✦ ${tf("Help me resolve it", "Помогни ми да го реша")}</button>` : ""}</div></div>`).join("")
      || `<div class="empty">${filter === "open" ? tf("No open contradictions.", "Няма отворени противоречия.") : "—"}</div>`;
    $$("[data-s]", el).forEach(b => b.onclick = () => { Checks.setStatus(b.dataset.k, b.dataset.s); draw(); Nav.render(); });
    $$("[data-both]", el).forEach(b => b.onclick = () => { const [a, c] = b.dataset.both.split("|"); open(a); open(c, true); });
    $$("[data-ask]", el).forEach(b => b.onclick = () => AI.resolveHelp(b.dataset.ask));
  };
  $$("[data-f]", el).forEach(c => c.onclick = () => { filter = c.dataset.f; $$("[data-f]", el).forEach(x => x.classList.toggle("on", x === c)); draw(); });
  $("[data-ai]", el).onclick = () => AI.checkWorld();
  draw();
};

// ------------------------------------------------------------------ I'm stuck — what needs fleshing out
const FO_KIND = () => ({ thin: tf("Thin entry", "Оскъден запис"), fields: tf("Empty fields", "Празни полета"), forgotten: tf("Forgotten", "Забравено"),
  unnamed: tf("Needs a name", "Без име"), thread: tf("Open thread", "Отворена нишка"), missing: tf("Mentioned but missing", "Споменато, но липсва"),
  contradiction: tf("Contradiction", "Противоречие"), questions: tf("Saved questions", "Запазени въпроси") });
const foCard = (c, i) => {
  const e = c.id ? M.entries.get(c.id) : null;
  return `<div class="fo-card" data-fo="${i}" data-foid="${esc(c.id || "")}" data-fotitle="${esc(c.title || "")}" data-fokind="${c.kind}">
    <div class="row"><span class="kind">${esc(FO_KIND()[c.kind] || c.kind)}</span><span class="spacer"></span>${e ? `<span class="faint small">${esc(typeName(e.type))}</span>` : ""}</div>
    <div style="font:600 15px var(--serif)">${esc(e?.title || c.title || "?")}</div><div class="why">${esc(c.why)}</div></div>`;
};
function bindFo(el, pane) {
  $$("[data-fo]", el).forEach(d => d.onclick = async () => {
    if (d.dataset.fokind === "missing") return createFromMissing(d.dataset.fotitle);
    if (d.dataset.fokind === "contradiction") return Panes.show({ view: "contradictions" }, pane);
    const id = d.dataset.foid;
    open(id);
    AI.startSession(id, d.dataset.fokind);
  });
}
Views.stuck = (el, r, pane) => {
  let sort = M.state.stuckSort || "score", kind = "";
  el.innerHTML = paneHead("✦ " + t("I'm stuck"), `<div class="row"><button class="btn small" data-world>✦ ${tf("Questions about the whole world", "Въпроси за целия свят")}</button></div>`, pane) + `<div class="pane-body"><div class="wrap wide">
    <div class="faint" style="margin-bottom:12px">${tf("Pick something to work on. Morgul opens it and starts asking you questions about it, one at a time. Your answers are saved as notes on the entry — nothing goes into your text unless you keep it.",
      "Изберете нещо, върху което да работите. Morgul го отваря и започва да ви задава въпроси, един по един. Отговорите се пазят като бележки — нищо не влиза в текста, освен ако не го запазите.")}</div>
    <div class="row" style="margin-bottom:12px" data-kinds></div>
    <div class="row" style="margin-bottom:14px"><span class="faint small">${t("Sort")}:</span>${[["score", tf("Most useful", "Най-полезни")], ["oldest", tf("Oldest", "Най-стари")], ["mentioned", tf("Most mentioned", "Най-споменавани")], ["random", tf("Random", "Случайно")]].map(([k, l]) => `<span class="chip ${k === sort ? "on" : ""}" data-sort="${k}">${l}</span>`).join("")}</div>
    <div class="grid auto" data-cards></div></div></div>`;
  const all = Checks.fleshOut();
  const kinds = [...new Set(all.map(c => c.kind))];
  $("[data-kinds]", el).innerHTML = `<span class="chip on" data-k="">${tf("All", "Всички")} ${all.length}</span>` + kinds.map(k => `<span class="chip" data-k="${k}">${esc(FO_KIND()[k])} ${all.filter(c => c.kind === k).length}</span>`).join("");
  const draw = () => {
    let list = all.filter(c => !kind || c.kind === kind);
    const upd = c => new Date(M.entries.get(c.id)?.updated || 0).getTime();
    const ment = c => c.from?.length || (Idx.backlinks.get(c.id) || []).length;
    if (sort === "score") list.sort((a, b) => b.score - a.score);
    if (sort === "oldest") list.sort((a, b) => upd(a) - upd(b));
    if (sort === "mentioned") list.sort((a, b) => ment(b) - ment(a));
    if (sort === "random") list.sort(() => Math.random() - .5);
    // one card per entry is enough: merge reasons
    const seen = new Map(); const merged = [];
    for (const c of list) { const k = c.id || "m:" + c.title; if (seen.has(k)) { seen.get(k).why += " " + c.why; continue; } const cc = { ...c }; seen.set(k, cc); merged.push(cc); }
    $("[data-cards]", el).innerHTML = merged.map(foCard).join("") || `<div class="empty">${tf("Nothing to flesh out right now.", "Няма нищо за доразвиване в момента.")}</div>`;
    bindFo(el, pane);
  };
  $$("[data-k]", el).forEach(c => c.onclick = () => { kind = c.dataset.k; $$("[data-k]", el).forEach(x => x.classList.toggle("on", x === c)); draw(); });
  $$("[data-sort]", el).forEach(c => c.onclick = () => { sort = c.dataset.sort; M.state.stuckSort = sort; saveState(); $$("[data-sort]", el).forEach(x => x.classList.toggle("on", x === c)); draw(); });
  $("[data-world]", el).onclick = () => AI.worldQuestions();
  draw();
};

// ------------------------------------------------------------------ settings
Views.settings = (el, r, pane) => {
  const s = M.settings, w = M.world;
  el.innerHTML = paneHead(t("Settings"), "", pane) + `<div class="pane-body"><div class="wrap">
    <div class="section-title" style="margin-top:0">${tf("General", "Общи")}</div>
    <div class="card"><div class="form-grid">
      <label>${tf("Interface language", "Език на интерфейса")}</label><select class="input" data-s="language"><option value="en">English</option><option value="bg">Български</option></select>
      <label>${tf("Backups", "Архиви")}</label><div><input class="input" data-s="backup_dir" value="${esc(s.backup_dir)}"><div class="faint small" style="margin-top:4px">${tf("A zip of the whole world is made when you close Morgul (at most once a day). The last", "При затваряне се прави zip на целия свят (най-много веднъж на ден). Пазят се последните")} <input class="input" data-s="backup_keep" type="number" min="1" value="${s.backup_keep}" style="width:60px;display:inline-block;padding:1px 6px"> ${tf("are kept.", ".")}</div>
        <button class="btn small" data-backup style="margin-top:6px">${t("Back up now")}</button></div>
      <label>${tf("Second copy", "Второ копие")}</label><div><input class="input" data-s="backup_dir2" value="${esc(s.backup_dir2 || "")}" placeholder="${tf("Optional: a USB stick, another drive or a synced folder", "По избор: флашка, друг диск или синхронизирана папка")}"><div class="faint small" style="margin-top:4px">${tf("Each backup is also copied here, so one broken drive can't take all of them.", "Всеки архив се копира и тук, така че една повреда на диск не може да ги унищожи всичките.")}</div></div>
      <label>${tf("Daily writing goal", "Дневна цел")}</label><div><input class="input" type="number" min="0" step="50" data-s="daily_goal" value="${+s.daily_goal || 0}" style="width:120px"> <span class="faint small">${tf("words a day, shown on the dashboard (0 = off)", "думи на ден, на таблото (0 = изключена)")}</span></div>
      <label>${tf("On start", "При стартиране")}</label><label class="small" style="padding-top:7px"><input type="checkbox" data-s="resume" ${s.resume === false ? "" : "checked"}> ${tf("Continue where I left off", "Продължи откъдето спрях")}</label>
    </div></div>
    <div class="section-title">${t("World")}</div>
    <div class="card"><div class="form-grid">
      <label>${t("Name")}</label><input class="input" data-wname value="${esc(w.name || "")}" placeholder="${tf("Your world's name (used for exports)", "Името на света ви (за експорта)")}">
      <label>${tf("What it's like", "Какъв е")}</label><div><textarea class="input" data-wabout rows="2" placeholder="${tf("One or two sentences: genre, mood, inspirations.", "Едно-две изречения: жанр, настроение, вдъхновение.")}">${esc(w.about || "")}</textarea>
        <div class="faint small">${tf("The AI helper reads this so its questions fit your world. It never treats it as canon.", "AI помощникът чете това, за да пасват въпросите му на света ви. Никога не го приема за канон.")}</div></div>
    </div><div class="row" style="margin-top:8px"><span class="spacer"></span><button class="btn small primary" data-wsave>${t("Save")}</button></div></div>
    <div class="section-title">${tf("Theme", "Тема")}</div>
    <div class="card" data-theme-editor></div>
    <div class="section-title">✦ ${t("AI helper")}</div>
    <div class="card"><div class="form-grid">
      <label>${tf("Enabled", "Включен")}</label><label style="padding:7px 0 0"><input type="checkbox" data-s="ai_enabled" ${s.ai_enabled ? "checked" : ""}> ${tf("Show the ✦ side panel and AI buttons", "Показвай страничния панел ✦ и бутоните за AI")}</label>
      <label>${tf("Model", "Модел")}</label><input class="input" data-s="ai_model" value="${esc(s.ai_model)}">
      <label>${tf("Unload after", "Разтовари след")}</label><select class="input" data-s="ai_keep_alive">${["0", "30s", "60s", "3m", "10m"].map(v => `<option ${v === s.ai_keep_alive ? "selected" : ""}>${v}</option>`).join("")}</select>
    </div><div class="faint small" style="margin-top:8px" data-aistat></div></div>
    <div class="section-title">${tf("World calendar", "Календар на света")}</div>
    <div class="card"><div class="form-grid">
      <label>${tf("Eras", "Епохи")}</label><div><textarea class="input" data-eras rows="3">${esc(w.calendar.eras.map(e => `${e.name} | ${e.abbr} | ${e.start}${e.backwards ? " | backwards" : ""}`).join("\n"))}</textarea>
        <div class="faint small">${tf("One per line: Name | ABBR | start year (absolute) | backwards (counts down to the next era).", "По една на ред: Име | СЪКР | начална година | backwards (брои надолу до следващата епоха).")}</div></div>
      <label>${tf("Months", "Месеци")}</label><div><textarea class="input" data-months rows="4">${esc(w.calendar.months.map(m => `${m.name} | ${m.days}`).join("\n"))}</textarea><div class="faint small">${tf("One per line: Name | days", "По един на ред: Име | дни")}</div></div>
      <label>${tf("Present day", "Настояще")}</label><div><input class="input" data-present value="${esc(Cal.yearLabel(w.calendar.present))}" style="width:180px"><span class="faint small"> ${tf("used for ages and “World at a time”", "за възрасти и „Светът в даден момент“")}</span></div>
    </div><div class="row" style="margin-top:8px"><span class="spacer"></span><button class="btn small primary" data-cal>${t("Save")}</button></div></div>
    <div class="section-title">${tf("Travel speeds (maps)", "Скорости (карти)")}</div>
    <div class="card"><textarea class="input" data-travel rows="3">${esc(w.travel.speeds.map(x => `${x.name} | ${x.perDay}`).join("\n"))}</textarea>
      <div class="row" style="margin-top:6px"><span class="faint small">${tf("One per line: name | distance per day. Unit:", "По един на ред: име | разстояние на ден. Мярка:")}</span><input class="input" data-unit value="${esc(w.travel.unit)}" style="width:70px"><span class="spacer"></span><button class="btn small primary" data-tsave>${t("Save")}</button></div></div>
    <div class="section-title">${t("Types")}</div>
    <div class="card"><div class="faint small" style="margin-bottom:8px">${tf("Add your own types or fields. Field kinds: text, long, number, date, select (options after a colon: select:a,b,c), link, links (target types after a colon: links:character,faction), list, steps.",
      "Добавете свои видове или полета. Видове полета: text, long, number, date, select (select:a,b,c), link, links (links:character,faction), list, steps.")}</div>
      <div class="list">${w.types.map((ty, i) => `<div class="li" data-ty="${i}"><span style="width:22px;text-align:center">${esc(ty.icon)}</span><div class="main"><div class="t">${esc(ty.name)}${ty.bg ? ` <span class="faint small">/ ${esc(ty.bg)}</span>` : ""}</div><div class="d">${ty.fields.map(f => esc(f.label)).join(", ") || "—"}</div></div><span class="faint small">${entriesOf(ty.key).length}</span></div>`).join("")}</div>
      <button class="btn small" data-addtype style="margin-top:8px">＋ ${tf("New type", "Нов вид")}</button></div>
    <div class="section-title">${tf("Worlds", "Светове")}</div>
    <div class="card" data-worlds><div class="faint">…</div></div>
    <div class="section-title">Morgul <span class="faint" style="text-transform:none;letter-spacing:0">${esc(M.version.version)}</span></div>
    <div class="card"><div class="form-grid">
      <label>${tf("Updates", "Обновления")}</label><div><div class="row"><button class="btn small" data-upcheck>${tf("Check for updates", "Провери за обновления")}</button><button class="btn small ghost" data-whatsnew>${tf("What's new", "Какво ново")}</button><button class="btn small ghost" data-rollback>↺ ${tf("Go back to the previous version", "Върни предишната версия")}</button></div>
        <label class="small" style="display:block;margin-top:6px"><input type="checkbox" data-s="update_check" ${s.update_check === false ? "" : "checked"}> ${tf("Check for updates when Morgul opens (only reads a tiny version file online; everything else stays offline)", "Проверявай за обновления при отваряне (чете само малък файл с версията; всичко друго остава офлайн)")}</label></div>
      <label>${tf("Restart", "Рестарт")}</label><div><button class="btn small" data-restart>↻ ${tf("Restart Morgul", "Рестартирай Morgul")}</button>
        <div class="faint small" style="margin-top:4px">${tf("Loads app updates without closing the window. Your world is saved as you type, so nothing is lost.", "Зарежда обновления на приложението, без да затваря прозореца. Светът ви се запазва, докато пишете, така че нищо не се губи.")}</div></div>
      <label>${tf("Share the tool", "Сподели инструмента")}</label><div><button class="btn small" data-share>⇪ ${tf("Make a shareable copy", "Направи копие за споделяне")}</button>
        <div class="faint small" style="margin-top:4px">${tf(`Creates Morgul-Setup.zip in the Exports folder: the app with its installer and README. None of your worlds are included. Others can also download it from github.com/${M.version.repo}.`, "Създава Morgul-Setup.zip в папка Exports: приложението с инсталатор и празен свят. Нищо от вашия свят не се включва.")}</div></div>
    </div></div>
    <div class="section-title">${tf("Keyboard", "Клавиатура")}</div>
    <div class="card small muted">Ctrl+K ${t("Search")} · Ctrl+Space ${t("Quick note")} · Ctrl+N ${t("New entry")} · Ctrl+E ${t("Edit")} / ${t("Done")} · Ctrl+J ${t("AI helper")} · Shift+${tf("click a link: open beside", "клик на връзка: отвори до")} · Esc ${t("Close")}</div>
  </div></div>`;
  $('[data-s="language"]', el).value = s.language;
  const setS = async (k, v) => { M.settings = await api("settings", { [k]: v }); if (k === "language") { Nav.render(); Panes.refresh(); } if (k === "ai_enabled") AI.syncToggle(); };
  $$("[data-s]", el).forEach(i => i.onchange = () => setS(i.dataset.s, i.type === "checkbox" ? i.checked : i.type === "number" ? +i.value : i.value));
  $("[data-backup]", el).onclick = async () => { const r = await api("backup", {}); toast(r.file ? tf("Backup saved: ", "Архивът е запазен: ") + r.file : tf("Backup failed — check the folder.", "Архивирането не успя — проверете папката."), r.file ? "" : "error"); };
  api("ai/status").then(st => { $("[data-aistat]", el).textContent = !st.enabled ? tf("Turned off.", "Изключен.") : !st.installed ? tf("Ollama isn't installed, so the AI helper can't run. Everything else works.", "Ollama не е инсталиран, така че AI помощникът не може да работи. Всичко друго работи.")
    : st.running ? tf("Ollama is running. Models: ", "Ollama работи. Модели: ") + (st.models.join(", ") || "—") : tf("Ollama starts only when you use the AI and stops when Morgul closes.", "Ollama се пуска само когато ползвате AI и спира при затваряне на Morgul."); }).catch(() => {});
  $("[data-wsave]", el).onclick = async () => { w.name = $("[data-wname]", el).value.trim(); w.about = $("[data-wabout]", el).value.trim(); await saveWorld(); toast(t("Saved")); };
  ThemeEditor.render($("[data-theme-editor]", el));
  $("[data-restart]", el).onclick = () => restartMorgul();
  $("[data-share]", el).onclick = async ev => {
    ev.target.disabled = true;
    try { const r = await api("share/build", {}); toast(tf("Ready: ", "Готово: ") + r.file); api("open", { path: r.file.replace(/[\\/][^\\/]+$/, "") }).catch(() => {}); }
    catch (err) { toast(err.message, "error"); }
    ev.target.disabled = false;
  };
  $("[data-cal]", el).onclick = async () => {
    const eras = $("[data-eras]", el).value.split("\n").map(l => l.split("|").map(x => x.trim())).filter(p => p[0] && p[1]).map(p => ({ name: p[0], abbr: p[1], start: +p[2] || 0, backwards: /back/i.test(p[3] || "") }));
    const months = $("[data-months]", el).value.split("\n").map(l => l.split("|").map(x => x.trim())).filter(p => p[0]).map(p => ({ name: p[0], days: +p[1] || 30 }));
    if (!eras.length || !months.length) return toast(tf("Need at least one era and one month.", "Нужна е поне една епоха и един месец."), "error");
    w.calendar.eras = eras.sort((a, b) => a.start - b.start); w.calendar.months = months;
    const p = Cal.parse($("[data-present]", el).value); if (p) w.calendar.present = Cal.parts(p).y;
    await saveWorld(); toast(t("Saved")); Panes.refresh();
  };
  $("[data-tsave]", el).onclick = async () => {
    w.travel.speeds = $("[data-travel]", el).value.split("\n").map(l => l.split("|").map(x => x.trim())).filter(p => p[0] && +p[1]).map(p => ({ name: p[0], perDay: +p[1] }));
    w.travel.unit = $("[data-unit]", el).value.trim() || "km"; await saveWorld(); toast(t("Saved"));
  };
  const typeBox = async (ty) => {
    const isNew = !ty; ty = ty || { key: "", name: "", bg: "", icon: "•", color: "#8EB69B", fields: [] };
    const lines = ty.fields.map(f => `${f.label} | ${f.kind}${f.options ? ":" + f.options.join(",") : f.to ? ":" + f.to.join(",") : ""}`).join("\n");
    const res = await modal(isNew ? tf("New type", "Нов вид") : ty.name, `<div class="form-grid">
      <label>${t("Name")}</label><input class="input" id="tn" value="${esc(ty.name)}"><label>${tf("Name in Bulgarian", "Име на български")}</label><input class="input" id="tb" value="${esc(ty.bg || "")}">
      <label>${tf("Icon", "Икона")}</label><input class="input" id="ti" value="${esc(ty.icon)}" style="width:70px"><label>${tf("Colour", "Цвят")}</label><input type="color" id="tc" value="${esc(ty.color)}">
      <label>${tf("Fields", "Полета")}</label><textarea class="input" id="tf" rows="8" placeholder="Label | kind">${esc(lines)}</textarea></div>`, {
      wide: true, buttons: [{ label: t("Cancel"), value: null }, { label: t("Save"), cls: "primary", value: ov => ({ name: $("#tn", ov).value.trim(), bg: $("#tb", ov).value.trim(), icon: $("#ti", ov).value.trim() || "•", color: $("#tc", ov).value, fields: $("#tf", ov).value }) }],
    });
    if (!res || !res.name) return;
    const fields = res.fields.split("\n").map(l => l.split("|").map(x => x.trim())).filter(p => p[0]).map(([label, kindSpec = "text"]) => {
      const [kind, arg] = kindSpec.split(":"); const old = ty.fields.find(f => f.label === label);
      const key = old?.key || label.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_|_$/g, "") || uid();
      const fd = { key, label, kind: kind.trim() || "text" };
      if (fd.kind === "select") fd.options = (arg || "").split(",").map(x => x.trim()).filter(Boolean);
      if ((fd.kind === "link" || fd.kind === "links") && arg) fd.to = arg.split(",").map(x => x.trim()).filter(Boolean);
      return fd;
    });
    Object.assign(ty, { name: res.name, bg: res.bg, icon: res.icon, color: res.color, fields });
    if (isNew) { ty.key = res.name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-"); if (w.types.some(x => x.key === ty.key)) ty.key += "-" + uid().slice(0, 3); w.types.push(ty); }
    await saveWorld(); Nav.render(); Panes.refresh();
  };
  $$("[data-ty]", el).forEach(d => d.onclick = () => typeBox(w.types[+d.dataset.ty]));
  $("[data-addtype]", el).onclick = () => typeBox(null);
  Worlds.section($("[data-worlds]", el));
  $("[data-upcheck]", el).onclick = () => Updates.check(true, false);
  $("[data-whatsnew]", el).onclick = () => WhatsNew.show(null);
  $("[data-rollback]", el).onclick = () => Updates.rollbackBox();
};
