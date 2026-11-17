// Startup, sidebar navigation, search palette, keyboard shortcuts.
"use strict";
// The sidebar stays short: the daily places, your world's types, and only the tools you pinned.
// Every tool is one click away on the All tools page (and in Ctrl+K). Sections fold, and remember it.
const TOOLS = [
  // [view, icon, en, bg, en description, bg description, group]
  ["timeline", "⟟", "Timeline", "Хроника", "Events in order, lanes, lifespans", "Събития по ред, ленти, живот", "time"],
  ["calendar", "☽", "Calendar", "Календар", "Months, moons, seasons, holidays", "Месеци, луни, сезони, празници", "time"],
  ["worldat", "⧗", "World at a time", "Светът в даден момент", "Who lived and what stood in a year", "Кой е живял и какво е имало в дадена година", "time"],
  ["story", "¶", "Manuscript", "Ръкопис", "Books, chapters, scenes, compile", "Книги, глави, сцени, компилиране", "write"],
  ["boards", "▤", "Boards", "Табла", "Corkboards and mood boards", "Коркови табла и табла с настроение", "write"],
  ["names", "✍", "Name generator", "Генератор на имена", "Names in your world's style", "Имена в стила на света", "write"],
  ["tables", "⚄", "Random tables", "Случайни таблици", "NPCs, taverns, rumours, hooks", "Хора, кръчми, слухове, идеи", "write"],
  ["maps", "⌖", "Maps", "Карти", "Your maps, pins and routes", "Карти, пинове и маршрути", "world"],
  ["mapmaker", "✦", "Map maker", "Създаване на карта", "Draw a map, or trace one you have", "Нарисувайте карта или прерисувайте ваша", "world"],
  ["heraldry", "⛨", "Heraldry", "Хералдика", "Coats of arms", "Гербове", "world"],
  ["alchemy", "⚗", "Alchemy & rituals", "Алхимия и ритуали", "Recipes, ingredients, rituals", "Рецепти, съставки, ритуали", "world"],
  ["relations", "☍", "Relationships", "Връзки", "Who is tied to whom", "Кой с кого е свързан", "world"],
  ["family", "⚭", "Family trees", "Родословия", "Parents, children, houses", "Родители, деца, родове", "world"],
  ["glossary", "Aa", "Glossary & languages", "Речник и езици", "Words, languages, sample names", "Думи, езици, примерни имена", "world"],
  ["gallery", "▦", "Gallery", "Галерия", "Every picture in the world", "Всички картини в света", "world"],
  ["gm", "⚄", "Game master", "Водещ на игра", "Sessions, encounters, initiative, dice", "Сесии, срещи, инициатива, зарове", "play"],
  ["contradictions", "⚖", "Contradictions", "Противоречия", "Things that don't add up", "Неща, които не се връзват", "keep"],
  ["milestones", "⚑", "Milestones", "Етапи", "Save, compare, go back", "Запазване, сравнение, връщане", "keep"],
  ["replace", "⇄", "Find & replace", "Търсене и замяна", "Change a word everywhere", "Смяна на дума навсякъде", "keep"],
  ["export", "⇪", "Export", "Износ", "Website, PDF, Word, World Bible", "Сайт, PDF, Word, Библия на света", "keep"],
  ["trash", "🗑", "Trash", "Кошче", "Deleted entries, to restore", "Изтрити записи за възстановяване", "keep"],
];
const TOOL_GROUPS = { time: ["Time", "Време"], write: ["Writing", "Писане"], world: ["Places and lore", "Места и знание"], play: ["Playing", "Игра"], keep: ["Keeping it tidy", "Поддръжка"] };
const DEFAULT_PINS = ["timeline", "calendar", "story", "maps", "boards"];
const Nav = {
  pins: () => Array.isArray(M.settings.navTools) ? M.settings.navTools : DEFAULT_PINS,
  async setPins(p) { M.settings = await api("settings", { navTools: p }); Nav.render(); },
  folded: k => (M.state.navFolded || []).includes(k),
  fold(k) { const f = new Set(M.state.navFolded || []); f.has(k) ? f.delete(k) : f.add(k); M.state.navFolded = [...f]; saveState(); Nav.render(); },
  go(view) { if (view === "export") return Exporter.dialog(); Panes.show({ view }); },
  render() {
    const n = Checks.openCount();
    const inbox = entriesOf("note").filter(e => (e.tags || []).includes("inbox")).length;
    const stuck = Checks.fleshOut().length;
    const item = (view, icon, label, extra = "", id = "") => `<button class="nav-item" data-view="${view}" data-id="${esc(id)}"><i>${icon}</i><span>${esc(label)}</span>${extra}</button>`;
    const group = (k, label, body, extra = "") => `<div class="nav-group fold ${Nav.folded(k) ? "folded" : ""}" data-fold="${k}"><span>${Nav.folded(k) ? "▸" : "▾"} ${esc(label)}</span>${extra}</div>${Nav.folded(k) ? "" : body}`;
    const types = M.world.types.filter(x => x.key !== "note" && x.key !== "map");
    const used = types.filter(ty => entriesOf(ty.key).length);
    const shown = used.length ? used : types.filter(ty => ["character", "location", "event", "faction"].includes(ty.key));
    const todos = Todos.open().length, smart = Smart.list();
    const pins = Nav.pins().map(v => TOOLS.find(x => x[0] === v)).filter(Boolean);
    $("#nav").innerHTML =
      item("dashboard", "⌂", t("Dashboard")) + item("build", "☾", tf("World-building path", "Пътят на света"), `<span class="count">${Path.overall()}%</span>`)
      + item("inbox", "✉", t("Inbox"), inbox ? `<span class="count">${inbox}</span>` : "") + item("todo", "☐", tf("To-do", "Задачи"), todos ? `<span class="count">${todos}</span>` : "")
      + item("stuck", "✦", t("I'm stuck"), (n ? `<span class="badge" data-contra title="${esc(t("Contradictions"))}">⚖ ${n}</span>` : "") + (stuck ? `<span class="count">${stuck}</span>` : ""))
      + group("world", t("World"), item("browse", "☰", t("Everything"), `<span class="count">${M.entries.size}</span>`)
          + shown.map(ty => item("browse", ty.icon, typeName(ty.key), `<span class="count">${entriesOf(ty.key).length || ""}</span>`, ty.key)).join("")
          + smart.map(x => item("smart", "☆", x.name, `<span class="count">${[...M.entries.values()].filter(e => Smart.match(e, x)).length}</span>`, x.id)).join(""),
        used.length < types.length ? `<button class="nav-mini" data-alltypes title="${tf("All types, including empty ones", "Всички видове, и празните")}">＋</button>` : "")
      + group("tools", t("Tools"), pins.map(x => item(x[0], x[1], tf(x[2], x[3]))).join("") + item("tools", "⋯", tf("All tools", "Всички инструменти")));
    $$("#nav [data-view]").forEach(b => b.onclick = ev => {
      if (ev.target.closest("[data-contra]")) { ev.stopPropagation(); return Panes.show({ view: "contradictions" }, ev.shiftKey ? 1 : 0); }
      if (b.dataset.view === "export") return Exporter.dialog();
      Panes.show(b.dataset.view === "smart" ? { view: "smart", id: b.dataset.id } : { view: b.dataset.view, type: b.dataset.id || undefined, id: undefined }, ev.shiftKey ? 1 : 0);
    });
    $$("#nav [data-fold]").forEach(g => g.onclick = ev => { if (!ev.target.closest("button")) Nav.fold(g.dataset.fold); });
    $("#nav [data-alltypes]")?.addEventListener("click", ev => { ev.stopPropagation(); Panes.show({ view: "tools", id: "types" }); });
    $$("[data-t]").forEach(x => x.textContent = t(x.dataset.t));
    Nav.mark(Panes.cur[0] || { view: "dashboard" });
  },
  mark(r) { $$("#nav [data-view]").forEach(b => b.classList.toggle("active", b.dataset.view === r.view && (r.view === "browse" ? (b.dataset.id || "") === (r.type || "") : r.view === "smart" ? b.dataset.id === r.id : true))); },
};

// All tools: every tool in one place, with ☆ to pin it to the sidebar; and every entry type.
Views.tools = (el, r, pane) => {
  const pins = new Set(Nav.pins());
  const tile = x => `<div class="tool-tile" data-go="${x[0]}"><i>${x[1]}</i><div class="main"><div class="t">${esc(tf(x[2], x[3]))}</div><div class="d">${esc(tf(x[4], x[5]))}</div></div>
    <button class="pin ${pins.has(x[0]) ? "on" : ""}" data-pin="${x[0]}" title="${pins.has(x[0]) ? tf("Unpin from the sidebar", "Махни от страничната лента") : tf("Pin to the sidebar", "Закачи в страничната лента")}">${pins.has(x[0]) ? "★" : "☆"}</button></div>`;
  const types = M.world.types.filter(x => x.key !== "note" && x.key !== "map");
  el.innerHTML = paneHead(`⋯ ${tf("All tools", "Всички инструменти")}`, "", pane) + `<div class="pane-body"><div class="wrap wide">
    <p class="muted">${tf("☆ pins a tool to the sidebar, so the sidebar only holds what you use. Everything is also in Ctrl+K.", "☆ закача инструмент в страничната лента, за да има там само това, което ползвате. Всичко е и в Ctrl+K.")}</p>
    ${Object.entries(TOOL_GROUPS).map(([g, [en, bg]]) => `<div class="section-sub">${esc(tf(en, bg))}</div><div class="tool-grid">${TOOLS.filter(x => x[6] === g).map(tile).join("")}</div>`).join("")}
    <div class="section-sub" id="types">${tf("Entry types", "Видове записи")}</div>
    <div class="tool-grid">${types.map(ty => { const c = entriesOf(ty.key).length; return `<div class="tool-tile" data-type="${ty.key}"><i style="color:${ty.color}">${ty.icon}</i><div class="main"><div class="t">${esc(typeName(ty.key))}</div><div class="d">${c} ${tf("entries", "записа")}</div></div>
      <button class="pin" data-newt="${ty.key}" title="${tf("New", "Нов")}">＋</button></div>`; }).join("")}</div>
    <div class="faint small" style="margin-top:8px">${tf("Types with entries show in the sidebar by themselves.", "Видовете със записи се показват в страничната лента сами.")}</div>
  </div></div>`;
  $$("[data-go]", el).forEach(x => x.onclick = ev => { if (ev.target.closest("[data-pin]")) return; x.dataset.go === "export" ? Exporter.dialog() : Panes.show({ view: x.dataset.go }, pane); });
  $$("[data-pin]", el).forEach(b => b.onclick = async ev => { ev.stopPropagation(); const p = Nav.pins().filter(v => v !== b.dataset.pin); if (!pins.has(b.dataset.pin)) p.push(b.dataset.pin);
    await Nav.setPins(TOOLS.map(x => x[0]).filter(v => p.includes(v))); Panes.refresh(); });
  $$("[data-type]", el).forEach(x => x.onclick = ev => { if (ev.target.closest("[data-newt]")) return; Panes.show({ view: "browse", type: x.dataset.type }, pane); });
  $$("[data-newt]", el).forEach(b => b.onclick = async ev => { ev.stopPropagation(); const e = await createEntry(b.dataset.newt, ""); Entry.editing.add(e.id); open(e.id); });
  if (r.id === "types") setTimeout(() => $("#types", el)?.scrollIntoView({ block: "start" }), 50);
};

// ---------------- search palette (Ctrl+K)
function palette() {
  const cmds = [
    [t("New entry"), () => newEntryBox()], [t("Quick note"), () => Capture.open()], [t("I'm stuck"), () => Panes.show({ view: "stuck" })],
    [tf("All tools", "Всички инструменти"), () => Panes.show({ view: "tools" })], [t("Timeline"), () => Panes.show({ view: "timeline" })], [tf("Calendar", "Календар"), () => Panes.show({ view: "calendar" })], [tf("Date calculator", "Калкулатор за дати"), () => dateCalculator()], [t("Maps"), () => Panes.show({ view: "maps" })], [tf("Make a map", "Създай карта"), () => Panes.show({ view: "mapmaker" })], [tf("Heraldry", "Хералдика"), () => Panes.show({ view: "heraldry" })], [tf("Boards", "Табла"), () => Panes.show({ view: "boards" })], [tf("Game master", "Водещ на игра"), () => Panes.show({ view: "gm" })], [tf("Roll dice", "Хвърли зарове"), () => Panes.show({ view: "gm", id: "dice" })], [tf("Milestones", "Етапи"), () => Panes.show({ view: "milestones" })], [tf("Save a milestone", "Запази етап"), () => Panes.show({ view: "milestones" })], [tf("Save this world as one file", "Запази света като един файл"), () => WorldFile.save()], [t("Relationships"), () => Panes.show({ view: "relations" })],
    [t("Contradictions"), () => Panes.show({ view: "contradictions" })], [t("Settings"), () => Panes.show({ view: "settings" })], [t("Export"), () => Exporter.dialog()],
    [tf("Help", "Помощ"), () => Panes.show({ view: "help" })], [tf("World-building path", "Пътят на света"), () => Panes.show({ view: "build" })],
    [tf("To-do", "Задачи"), () => Panes.show({ view: "todo" })], [tf("New to-do", "Нова задача"), () => Todos.add()], [tf("Random tables", "Случайни таблици"), () => Panes.show({ view: "tables" })],
    [tf("Manuscript", "Ръкопис"), () => Panes.show({ view: "story" })], [tf("Compile a book or World Bible", "Компилирай книга или Библия на света"), () => Compile.dialog()], [tf("Import notes", "Внеси бележки"), () => Importer.open()], [tf("Find & replace", "Търсене и замяна"), () => Panes.show({ view: "replace" })],
    [tf("Gallery", "Галерия"), () => Panes.show({ view: "gallery" })], [tf("Trash", "Кошче"), () => Panes.show({ view: "trash" })], [tf("Check for updates", "Провери за обновления"), () => Updates.check(true, false)],
    [tf("Welcome tour", "Обиколка"), () => startTour()], [tf("Copy problem report", "Копирай отчет за проблем"), () => copyReport()],
  ];
  modal("", `<div class="palette"><input id="pq" placeholder="${tf("Search everything… (Shift+Enter opens beside)", "Търсете всичко… (Shift+Enter отваря отстрани)")}" autocomplete="off"><div class="results" id="pr"></div></div>`, {
    onOpen: (ov, close) => {
      const q = $("#pq", ov), out = $("#pr", ov); let sel = 0, items = [];
      $(".modal", ov).style.padding = "0";
      const draw = () => {
        const s = norm(q.value);
        if (!s) items = (M.state.recent || []).map(id => M.entries.get(id)).filter(Boolean).slice(0, 8).map(e => ({ e }));
        else {
          const scored = [];
          for (const e of M.entries.values()) {
            const ti = norm(e.title); let sc = 0;
            if (ti === s) sc = 100; else if (ti.startsWith(s)) sc = 80; else if (ti.includes(s)) sc = 60;
            else if ((e.aliases || []).some(a => norm(a).includes(s))) sc = 55; else if ((e.tags || []).some(x => norm(x) === s.replace(/^#/, ""))) sc = 50;
            else { const b = norm(summary(e, 100000)); const i = b.indexOf(s); if (i >= 0) { sc = 20; e._snip = b.slice(Math.max(0, i - 30), i + 60); } }
            if (sc) scored.push({ e, sc, snip: sc === 20 ? e._snip : "" });
          }
          items = scored.sort((a, b) => b.sc - a.sc || a.e.title.localeCompare(b.e.title)).slice(0, 14);
          cmds.filter(([l]) => norm(l).includes(s)).forEach(([l, f]) => items.push({ cmd: l, f }));
          if (!items.some(i => i.e && norm(i.e.title) === s)) items.push({ create: q.value.trim() });
        }
        sel = Math.min(sel, Math.max(0, items.length - 1));
        out.innerHTML = items.map((it, i) => it.e ? `<div class="r ${i === sel ? "on" : ""}" data-i="${i}"><span class="type-dot" style="background:${typeOf(it.e.type).color}"></span><span>${esc(it.e.title)}</span><span class="d">${it.snip ? "…" + esc(it.snip) + "…" : esc(typeName(it.e.type))}</span></div>`
          : it.cmd ? `<div class="r ${i === sel ? "on" : ""}" data-i="${i}"><span class="faint">›</span>${esc(it.cmd)}</div>`
          : `<div class="r ${i === sel ? "on" : ""}" data-i="${i}"><span class="faint">＋</span>${tf("Create", "Създай")} “${esc(it.create)}”</div>`).join("")
          || `<div class="faint" style="padding:10px 12px">${tf("Type to search titles, aliases, tags and text.", "Пишете, за да търсите в заглавия, имена, етикети и текст.")}</div>`;
        $$("[data-i]", out).forEach(d => d.onclick = ev => go(+d.dataset.i, ev.shiftKey));
      };
      const go = async (i, side) => {
        const it = items[i]; if (!it) return; close();
        if (it.e) open(it.e.id, side); else if (it.cmd) it.f(); else if (it.create) newEntryBoxWith(it.create);
      };
      q.oninput = () => { sel = 0; draw(); };
      q.onkeydown = ev => {
        if (ev.key === "ArrowDown") { sel = Math.min(sel + 1, items.length - 1); draw(); ev.preventDefault(); }
        if (ev.key === "ArrowUp") { sel = Math.max(sel - 1, 0); draw(); ev.preventDefault(); }
        if (ev.key === "Enter") { ev.preventDefault(); go(sel, ev.shiftKey); }
      };
      q.focus(); draw();
    },
  });
}
const newEntryBoxWith = title => newEntryBox("", title);

// ---------------- keyboard
document.addEventListener("keydown", ev => {
  const k = ev.key.toLowerCase();
  if (ev.ctrlKey && k === "k") { ev.preventDefault(); if (!$("#overlay").innerHTML) palette(); }
  else if (ev.ctrlKey && (k === " " || ev.code === "Space")) { ev.preventDefault(); if (!$("#overlay").innerHTML) Capture.open(); }
  else if (ev.ctrlKey && k === "n") { ev.preventDefault(); newEntryBox(); }
  else if (ev.ctrlKey && k === "j") { ev.preventDefault(); AI.toggle(); }
  else if (ev.ctrlKey && (k === "e" || k === "s")) {
    ev.preventDefault();
    const r = Panes.cur[0]; if (r?.view !== "entry") return;
    const el = $("#pane0");
    if (Entry.editing.has(r.id)) el._finish?.(); else if (k === "e") { Entry.editing.add(r.id); Panes.show(r, 0); }
  }
});
$("#searchBtn").onclick = palette;
$("#captureBtn").onclick = () => Capture.open();
$("#settingsBtn").onclick = () => Panes.show({ view: "settings" });
$("#helpBtn").onclick = () => Panes.show({ view: "help" });
$("#backBtn").onclick = () => history.back();
$("#fwdBtn").onclick = () => history.forward();

// ---------------- start
(async () => {
  try {
    const b = await api("bootstrap");
    M.root = b.root; M.settings = b.settings; M.state = b.state || {};
    M.version = b.version || { version: "0.0.0", date: "", repo: "0Frog2/morgul" }; M.worldPath = b.worldPath || ""; M.worldMissing = b.worldMissing || "";
    applyTheme();
    M.world = b.world || structuredClone(DEFAULT_WORLD);
    // worlds made before "Settings → World" existed: keep the description the AI always used for them
    if (b.world && M.world.about === undefined) M.world.about = LEGACY_ABOUT;
    if (M.world.about === undefined) M.world.about = "";
    // add any built-in types/fields that are new in this version, keep the author's changes
    for (const ty of DEFAULT_WORLD.types) {
      const cur = M.world.types.find(x => x.key === ty.key);
      if (!cur) M.world.types.push(structuredClone(ty));
      else for (const f of ty.fields) if (!cur.fields.some(x => x.key === f.key)) cur.fields.push(structuredClone(f));
    }
    for (const k of ["important", "relationKinds", "travel", "calendar"]) if (!M.world[k]) M.world[k] = structuredClone(DEFAULT_WORLD[k]);
    if (!b.world) await saveWorld();
    b.entries.forEach(e => M.entries.set(e.id, e));
    // "last time" summary: what changed during the previous session (shown on the dashboard)
    const prev = M.state.visit;
    const changedSince = since => [...M.entries.values()].filter(e => (e.updated || e.created || "") >= since);
    if (prev?.start && changedSince(prev.start).length) {       // a session with no edits (or a quick restart) keeps the older summary
      const since = prev.start, changed = changedSince(since);
      M.state.lastSession = { start: since, end: prev.seen || since,
        created: changed.filter(e => (e.created || "") >= since).map(e => e.id), edited: changed.filter(e => (e.created || "") < since).map(e => e.id) };
    }
    M.state.visit = { start: localStamp() };       // same local "YYYY-MM-DDTHH:MM:SS" format the server stamps entries with
    saveState();
    setInterval(() => { M.state.visit.seen = localStamp(); saveState(); }, 120000);
    Idx.rebuild();
    document.documentElement.lang = M.settings.language;
    Nav.render(); AI.syncToggle();
    Bus.on("entries", debounce(() => Nav.render(), 250));
    Bus.on("issues", () => { Nav.render(); });
    Panes.show(location.hash.length > 1 ? decodeRoute(location.hash) : (Resume.route() || { view: "dashboard" }), 0);
    SaveDot.set("ok");
    afterStart();
  } catch (err) {
    document.body.innerHTML = `<div style="padding:40px;font:16px var(--sans)">Morgul couldn't start: ${esc(err.message)}</div>`;
  }
})();
window.addEventListener("beforeunload", () => navigator.sendBeacon("/api/ping"));
