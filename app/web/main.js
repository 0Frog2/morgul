// Startup, sidebar navigation, search palette, keyboard shortcuts.
"use strict";
const Nav = {
  render() {
    const n = Checks.openCount();
    const inbox = entriesOf("note").filter(e => (e.tags || []).includes("inbox")).length;
    const stuck = Checks.fleshOut().length;
    const item = (view, icon, label, extra = "", id = "") => `<button class="nav-item" data-view="${view}" data-id="${esc(id)}"><i>${icon}</i><span>${esc(label)}</span>${extra}</button>`;
    const counts = M.world.types.filter(x => x.key !== "note" && x.key !== "map");
    $("#nav").innerHTML = item("dashboard", "⌂", t("Dashboard")) + item("stuck", "✦", t("I'm stuck"), stuck ? `<span class="count">${stuck}</span>` : "")
      + item("inbox", "✉", t("Inbox"), inbox ? `<span class="count">${inbox}</span>` : "") + item("contradictions", "⚖", t("Contradictions"), n ? `<span class="badge">${n}</span>` : "")
      + `<div class="nav-group">${t("World")}</div>` + item("browse", "☰", t("Everything"), `<span class="count">${M.entries.size}</span>`)
      + counts.map(ty => { const c = entriesOf(ty.key).length; return c || ["character", "location", "event", "faction"].includes(ty.key) ? item("browse", ty.icon, typeName(ty.key), `<span class="count">${c || ""}</span>`, ty.key) : ""; }).join("")
      + `<div class="nav-group">${t("Tools")}</div>` + item("timeline", "⟟", t("Timeline")) + item("story", "¶", t("Story")) + item("maps", "⌖", t("Maps"))
      + item("alchemy", "⚗", t("Alchemy & rituals")) + item("relations", "☍", t("Relationships")) + item("family", "⚭", t("Family trees"))
      + item("worldat", "⧗", t("World at a time")) + item("glossary", "Aa", t("Glossary & languages")) + item("names", "✍", t("Name generator"))
      + item("gallery", "▦", tf("Gallery", "Галерия")) + item("replace", "⇄", tf("Find & replace", "Търсене и замяна")) + item("trash", "🗑", tf("Trash", "Кошче"))
      + `<button class="nav-item" data-export><i>⇪</i><span>${esc(t("Export"))}</span></button>`;
    $$("#nav [data-view]").forEach(b => b.onclick = ev => Panes.show({ view: b.dataset.view, type: b.dataset.id || undefined, id: undefined }, ev.shiftKey ? 1 : 0));
    $("#nav [data-export]").onclick = () => Exporter.dialog();
    $$("[data-t]").forEach(x => x.textContent = t(x.dataset.t));
    Nav.mark(Panes.cur[0] || { view: "dashboard" });
  },
  mark(r) { $$("#nav [data-view]").forEach(b => b.classList.toggle("active", b.dataset.view === r.view && (r.view !== "browse" || (b.dataset.id || "") === (r.type || "")))); },
};

// ---------------- search palette (Ctrl+K)
function palette() {
  const cmds = [
    [t("New entry"), () => newEntryBox()], [t("Quick note"), () => Capture.open()], [t("I'm stuck"), () => Panes.show({ view: "stuck" })],
    [t("Timeline"), () => Panes.show({ view: "timeline" })], [t("Maps"), () => Panes.show({ view: "maps" })], [t("Relationships"), () => Panes.show({ view: "relations" })],
    [t("Contradictions"), () => Panes.show({ view: "contradictions" })], [t("Settings"), () => Panes.show({ view: "settings" })], [t("Export"), () => Exporter.dialog()],
    [tf("Help", "Помощ"), () => Panes.show({ view: "help" })], [tf("Import notes", "Внеси бележки"), () => Importer.open()], [tf("Find & replace", "Търсене и замяна"), () => Panes.show({ view: "replace" })],
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
