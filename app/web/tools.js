// Tools: importing existing notes, the example world, trash, gallery, find & replace, writing stats,
// global drag & drop, the save indicator, templates, "continue where you left off".
"use strict";

// ------------------------------------------------------------------ save indicator + words written today
const SaveDot = {
  set(state) {
    const d = $("#saveState"); if (!d) return;
    d.dataset.s = state;
    d.textContent = state === "saving" ? tf("Saving…", "Запазване…") : state === "error" ? tf("Not saved!", "Не е запазено!") : tf("All saved", "Всичко е запазено");
    d.title = state === "error" ? tf("Morgul couldn't save. Is it still running?", "Morgul не можа да запази. Още ли работи?") : tf("Everything you write is saved automatically.", "Всичко се запазва автоматично.");
  },
};
const today = () => localStamp().slice(0, 10);
const Bulk = { on: false };      // imports and the example world don't count as "written today"
function countWritten(before, after) {
  if (Bulk.on) return;
  const d = words(after) - words(before); if (d <= 0) return;
  const w = M.state.words = M.state.words || {};
  w[today()] = (w[today()] || 0) + d;
  const keys = Object.keys(w).sort(); for (const k of keys.slice(0, -400)) delete w[k];      // about a year of history
  saveState();
}
(() => {   // wrap saveEntry once: indicator, word count and templates without touching every caller
  const inner = saveEntry;
  saveEntry = async (e, prevTitle, snapshot = true) => {
    const before = M.entries.get(e.id)?.body || "";
    SaveDot.set("saving");
    try { const r = await inner(e, prevTitle, snapshot); SaveDot.set("ok"); countWritten(before, r.body); return r; }
    catch (err) { SaveDot.set("error"); toast(tf("Couldn't save: ", "Не можа да се запази: ") + err.message, "error"); throw err; }
  };
  const create = createEntry;
  createEntry = (type, title = "", extra = {}) => {
    const tpl = M.world.templates?.[type];
    if (tpl && extra.body === undefined && extra.fields === undefined) extra = { ...extra, body: tpl.body || "", fields: structuredClone(tpl.fields || {}) };
    return create(type, title, extra);
  };
})();
function streak() {
  const w = M.state.words || {}, goal = +M.settings.daily_goal || 1; let n = 0;
  const d = new Date(); if (!((w[today()] || 0) >= goal)) d.setDate(d.getDate() - 1);   // today still counts until midnight
  for (;;) { const k = localStamp(d).slice(0, 10); if ((w[k] || 0) >= goal) { n++; d.setDate(d.getDate() - 1); } else break; }
  return n;
}
function writingCard() {
  const w = M.state.words || {}, n = w[today()] || 0, goal = +M.settings.daily_goal || 0, st = streak();
  const pct = goal ? Math.min(100, Math.round(n / goal * 100)) : 0;
  return `<div class="card writing-card" data-goal-card style="margin-bottom:0">
    <div><div class="faint small">${tf("Written today", "Написано днес")}</div><div style="font:600 22px var(--serif)">${n} <span class="faint" style="font-size:13px">${t("words")}${goal ? ` / ${goal}` : ""}</span></div></div>
    ${goal ? `<div class="goal-bar"><i style="width:${pct}%"></i></div>` : `<button class="btn small ghost" data-set-goal>${tf("Set a daily goal", "Задай дневна цел")}</button>`}
    ${st > 1 ? `<div class="small" style="color:var(--accent)" title="${tf("Days in a row you reached your goal", "Поредни дни с изпълнена цел")}">✦ ${st} ${tf("days in a row", "поредни дни")}</div>` : ""}
  </div>`;
}
async function setGoal() {
  const v = await promptBox(tf("Daily writing goal (words, 0 = off)", "Дневна цел (думи, 0 = изключена)"), String(M.settings.daily_goal || 300));
  if (v === null) return;
  M.settings = await api("settings", { daily_goal: Math.max(0, parseInt(v, 10) || 0) }); Panes.refresh();
}

// ------------------------------------------------------------------ continue where you left off
const Resume = {
  remember(route) {
    if (!route || ["settings"].includes(route.view)) return;
    M.state.lastRoute = { view: route.view, id: route.id, type: route.type }; saveState();
  },
  route() {
    if (M.settings.resume === false) return null;
    const r = M.state.lastRoute; if (!r || !Views[r.view]) return null;
    if (r.view === "entry" && !M.entries.has(r.id)) return null;
    return r;
  },
};
(() => { const show = Panes.show; Panes.show = (route, pane = 0) => { show(route, pane); if (pane === 0) Resume.remember(route); }; })();

// ------------------------------------------------------------------ importing existing notes
const Importer = (() => {
  const ACCEPT = [".md", ".markdown", ".txt", ".text", ".docx"];
  const okFile = f => ACCEPT.some(x => f.name.toLowerCase().endsWith(x));
  const b64 = buf => { let s = ""; const a = new Uint8Array(buf); for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode(...a.subarray(i, i + 0x8000)); return btoa(s); };
  const baseName = n => n.split(/[\\/]/).pop().replace(/\.(md|markdown|txt|text|docx)$/i, "");
  // a heading named like a type ("Characters", "Места") decides the type of the entries under it
  const SYN = { character: "characters people persons cast heroes villains npcs персонажи герои хора", location: "places locations geography regions cities places and regions settlements места локации градове земи селища",
    deity: "gods deities pantheon богове божества пантеон", species: "species races peoples раси народи", culture: "cultures customs култури обичаи", religion: "religions faiths belief религии вери вяра",
    government: "governments realms kingdoms nations states управление държави царства", currency: "currencies money coins валути пари монети", holiday: "holidays festivals feasts празници",
    event: "events history timeline събития история", faction: "factions groups organizations organisations orders houses фракции групи организации ордени",
    item: "items objects artifacts artefacts relics предмети артефакти", creature: "creatures monsters beasts bestiary същества чудовища зверове",
    ritual: "rituals spells ритуали заклинания", rule: "rules magic system laws of magic правила магия", term: "terms glossary термини речник",
    language: "languages езици", chapter: "chapters глави", entity: "entities powers същности сили", potion: "potions отвари", ingredient: "ingredients съставки" };
  function guessType(h) {
    const s = norm(h).replace(/[^\p{L} ]/gu, "").trim(); if (!s) return "";
    for (const [k, v] of Object.entries(SYN)) if (M.world.types.some(x => x.key === k) && (v.split(" ").includes(s) || v.includes(" " + s + " "))) return k;
    for (const ty of M.world.types) {
      const names = [ty.name, ty.bg, ty.key].filter(Boolean).map(norm);
      if (names.some(n => s === n || s === n + "s" || s === n + "es" || s.replace(/ies$/, "y") === n || (n.length > 4 && s.startsWith(n.slice(0, -1))))) return ty.key;
    }
    return "";
  }
  // "automatic": a file with several ## headings splits at ##, with several # headings at #, otherwise stays one entry
  function autoLevel(text) {
    const n = l => (text.match(new RegExp(`^#{${l}}\\s`, "gm")) || []).length;
    return n(2) >= 2 ? 2 : n(1) >= 2 ? 1 : 0;
  }
  // split Markdown into entries at headings of level <= lvl (0 = one entry per file, "auto" = decide per file)
  function split(name, text, lvl, fallbackType, tags) {
    if (lvl === "auto") lvl = autoLevel(text);
    if (!lvl) return [{ title: baseName(name), body: text.trim(), type: fallbackType, tags }];
    const out = []; let cur = null, pre = [], group = "";
    for (const line of text.split("\n")) {
      const m = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (m && m[1].length <= lvl) {
        const title = m[2].replace(/\*\*|__|\*|_/g, "").trim();
        if (m[1].length < lvl) { group = title; if (cur) { out.push(cur); cur = null; } continue; }   // a parent heading: remember it, don't make an entry
        if (cur) out.push(cur);
        cur = { title, body: [], type: guessType(group) || fallbackType, tags: [...tags, ...(group && !guessType(group) ? [group.toLowerCase().replace(/\s+/g, "-")] : [])] };
      } else if (cur) cur.body.push(line); else pre.push(line);
    }
    if (cur) out.push(cur);
    const res = out.map(e => ({ ...e, body: e.body.join("\n").trim() }));
    const intro = pre.join("\n").trim();
    if (intro) res.unshift({ title: baseName(name), body: intro, type: fallbackType, tags });
    return res;
  }
  async function readFiles(files) {
    const list = [...files].filter(okFile);
    const skipped = files.length - list.length;
    const payload = [];
    for (const f of list) payload.push({ name: f.webkitRelativePath || f.name, data: b64(await f.arrayBuffer()) });
    const parsed = payload.length ? await api("import/parse", { files: payload }) : [];
    return { parsed, skipped };
  }

  async function open(initialFiles = null) {
    const st = { sources: [], lvl: "auto", type: "note", tag: true, rows: [] };
    const typeOpts = sel => M.world.types.filter(x => x.key !== "map").map(x => `<option value="${x.key}" ${x.key === sel ? "selected" : ""}>${x.icon} ${esc(typeName(x.key))}</option>`).join("");
    await modal(tf("Bring in your notes", "Внесете бележките си"), `
      <div class="import">
        <div class="row" style="margin-bottom:10px">
          <button class="btn" data-files>📄 ${tf("Choose files", "Избери файлове")}</button>
          <button class="btn" data-folder>📁 ${tf("Choose a folder", "Избери папка")}</button>
          <button class="btn ghost" data-paste>✎ ${tf("Paste text", "Постави текст")}</button>
          <span class="faint small">${tf(".md, .txt and Word (.docx). You can also drop files here.", ".md, .txt и Word (.docx). Може и да ги пуснете тук.")}</span>
        </div>
        <div class="dropzone" data-dz>${tf("Drop files or a folder here", "Пуснете файлове или папка тук")}</div>
        <div data-pastebox hidden><textarea class="input" rows="8" data-pastetext placeholder="${tf("Paste a document here. Headings (# Name, ## Name) can become separate entries.", "Поставете документ тук. Заглавията (# Име, ## Име) може да станат отделни записи.")}"></textarea>
          <div class="row" style="margin-top:6px"><span class="spacer"></span><button class="btn small" data-usepaste>${tf("Use this text", "Използвай този текст")}</button></div></div>
        <div data-opts hidden>
          <div class="form-grid" style="margin:12px 0">
            <label>${tf("Split into entries", "Раздели на записи")}</label>
            <select class="input" data-lvl>
              <option value="auto">${tf("Automatic: at the headings each file uses", "Автоматично: по заглавията на всеки файл")}</option>
              <option value="0">${tf("One entry per file", "Един запис на файл")}</option>
              <option value="1">${tf("At every # heading", "При всяко # заглавие")}</option>
              <option value="2">${tf("At every ## heading (# headings group them)", "При всяко ## заглавие (# ги групира)")}</option>
              <option value="3">${tf("At every ### heading", "При всяко ### заглавие")}</option>
            </select>
            <label>${tf("Type for new entries", "Вид на новите записи")}</label><select class="input" data-type>${typeOpts(st.type)}</select>
            <label></label><label class="small"><input type="checkbox" data-tag checked> ${tf("Tag them “imported” so they're easy to find", "Етикет „imported“, за да се намират лесно")}</label>
          </div>
          <div class="faint small" data-sum></div>
          <div class="list import-list" data-rows></div>
        </div>
      </div>`, {
      wide: true,
      buttons: [{ label: t("Cancel"), value: null }, { label: tf("Import", "Внеси"), cls: "primary", value: ov => ov }],
      onOpen: (ov, close) => {
        const go = $(".mf .btn.primary", ov); go.disabled = true;
        const pickFiles = folder => { const i = document.createElement("input"); i.type = "file"; i.multiple = true; if (folder) i.webkitdirectory = true; else i.accept = ACCEPT.join(","); i.onchange = () => add([...i.files]); i.click(); };
        $("[data-files]", ov).onclick = () => pickFiles(false);
        $("[data-folder]", ov).onclick = () => pickFiles(true);
        $("[data-paste]", ov).onclick = () => { $("[data-pastebox]", ov).hidden = false; $("[data-dz]", ov).hidden = true; $("[data-pastetext]", ov).focus(); };
        $("[data-usepaste]", ov).onclick = () => {
          const text = $("[data-pastetext]", ov).value.trim(); if (!text) return;
          const name = (text.match(/^#\s+(.+)$/m)?.[1] || tf("Pasted text", "Поставен текст")).trim();
          st.sources.push({ name, text, tags: [] });
          $("[data-pastebox]", ov).hidden = true; $("[data-pastetext]", ov).value = ""; build();
        };
        const dz = $("[data-dz]", ov);
        dz.onclick = () => pickFiles(false);
        dz.ondragover = ev => { ev.preventDefault(); dz.classList.add("over"); };
        dz.ondragleave = () => dz.classList.remove("over");
        dz.ondrop = ev => { ev.preventDefault(); ev.stopPropagation(); dz.classList.remove("over"); add([...ev.dataTransfer.files]); };
        $("[data-lvl]", ov).onchange = e => { st.lvl = e.target.value === "auto" ? "auto" : +e.target.value; build(); };
        $("[data-type]", ov).onchange = e => { st.type = e.target.value; build(); };
        $("[data-tag]", ov).onchange = e => { st.tag = e.target.checked; build(); };
        async function add(files) {
          if (!files.length) return;
          dz.textContent = tf("Reading…", "Четене…");
          try {
            const { parsed, skipped } = await readFiles(files);
            parsed.filter(p => p.error).forEach(p => toast(`${p.name}: ${p.error}`, "error"));
            parsed.filter(p => !p.error).forEach(p => st.sources.push(p));
            if (skipped) toast(tf(`${skipped} file(s) skipped (only .md, .txt and .docx).`, `${skipped} файл(а) пропуснати (само .md, .txt и .docx).`));
          } catch (err) { toast(err.message, "error"); }
          dz.textContent = tf("Drop more files here", "Пуснете още файлове тук"); build();
        }
        function build() {
          $("[data-lvl]", ov).value = String(st.lvl);
          const existing = new Set([...M.entries.values()].map(e => norm(e.title)));
          st.rows = st.sources.flatMap(src => split(src.name, src.text, st.lvl, st.type, [...(src.tags || []), ...(st.tag ? ["imported"] : [])]))
            .filter(r => r.title || r.body).map(r => ({ ...r, title: r.title || t("Untitled"), on: !existing.has(norm(r.title)), dup: existing.has(norm(r.title)) }));
          $("[data-opts]", ov).hidden = !st.sources.length;
          const draw = () => {
            const on = st.rows.filter(r => r.on).length;
            $("[data-sum]", ov).textContent = tf(`${st.rows.length} entries found · ${on} will be created. Untick any you don't want; change a type where needed.`, `Намерени ${st.rows.length} записа · ще се създадат ${on}. Махнете отметката на ненужните; сменете вида, където трябва.`);
            go.disabled = !on; go.textContent = on ? tf(`Import ${on}`, `Внеси ${on}`) : tf("Import", "Внеси");
          };
          $("[data-rows]", ov).innerHTML = st.rows.slice(0, 400).map((r, i) => `<div class="li"><input type="checkbox" data-on="${i}" ${r.on ? "checked" : ""}>
            <div class="main"><div class="t">${esc(r.title)}${r.dup ? ` <span class="small" style="color:var(--warn)">· ${tf("an entry with this name exists", "има запис с това име")}</span>` : ""}</div><div class="d">${words(r.body)} ${t("words")} · ${esc(summary({ body: r.body }, 90))}</div></div>
            <select class="input small" data-ty="${i}" style="width:150px">${typeOpts(r.type)}</select></div>`).join("");
          $$("[data-on]", ov).forEach(c => c.onchange = () => { st.rows[+c.dataset.on].on = c.checked; draw(); });
          $$("[data-ty]", ov).forEach(c => c.onchange = () => { st.rows[+c.dataset.ty].type = c.value; });
          draw();
        }
        if (initialFiles) add(initialFiles);
        go.onclick = async () => {
          const todo = st.rows.filter(r => r.on); if (!todo.length) return;
          go.disabled = true; let n = 0; Bulk.on = true;
          try { for (const r of todo) { await createEntry(r.type, r.title, { body: r.body, tags: [...new Set(r.tags)] }); n++; go.textContent = `${n} / ${todo.length}`; } }
          finally { Bulk.on = false; }
          close(); Nav.render(); Panes.show({ view: "browse" });
          toast(tf(`Imported ${n} entries.`, `Внесени ${n} записа.`));
        };
      },
    });
  }
  return { open, okFile, split, guessType };
})();

// drop files anywhere on the window: notes are imported, images join the open entry
document.addEventListener("dragover", ev => { if (ev.dataTransfer?.types?.includes("Files")) ev.preventDefault(); });
document.addEventListener("drop", async ev => {
  if (ev.defaultPrevented || !ev.dataTransfer?.files?.length || $("#overlay").innerHTML) return;
  ev.preventDefault();
  const files = [...ev.dataTransfer.files];
  const notes = files.filter(Importer.okFile), images = files.filter(f => f.type.startsWith("image/"));
  if (notes.length) return Importer.open(notes);
  const pane = ev.target.closest("#pane1") ? 1 : 0, r = Panes.cur[pane];
  if (images.length && r?.view === "entry") {
    const got = await Entry.upload(images);
    if (got.length) { const cur = M.entries.get(r.id); await saveEntry({ ...cur, images: [...(cur.images || []), ...got] }, null, false); Panes.refresh(); toast(tf(`Added ${got.length} image(s).`, `Добавени ${got.length} изображения.`)); }
  } else if (images.length) toast(tf("Open an entry first, then drop images on it.", "Първо отворете запис, после пуснете изображенията върху него."));
});

// ------------------------------------------------------------------ example world (a tiny one to explore, removable in one click)
const Example = {
  TAG: "example",
  has() { return [...M.entries.values()].some(e => (e.tags || []).includes(this.TAG)); },
  async add() { Bulk.on = true; try { await this._add(); } finally { Bulk.on = false; } },
  async _add() {
    const E = [
      ["location", "The Ashen Vale", "A valley of grey soil and black pines, where the [[Lantern Order]] keeps its watch. Its capital is [[Hollowmere]].\n\nNothing green grows here since [[The Long Dusk]].", { kind: "region", founded: "12 AF" }],
      ["location", "Hollowmere", "A walled lake town in [[The Ashen Vale]]. Fishermen here don't go out after dark.\n\n## Notable places\n- The Drowned Chapel\n- The Lantern Hall, seat of the [[Lantern Order]]", { kind: "town", partOf: "@The Ashen Vale", founded: "40 AF" }],
      ["faction", "Lantern Order", "Wardens who keep fires burning on the valley's edge. They believe the dark is a living thing, and they may be right.\n\nLed by [[Mira Vel]].", { kind: "order", leader: "@Mira Vel", base: "@Hollowmere", founded: "15 AF", goals: "Keep the lanterns lit. Find out what [[The Hollow King]] wants." }],
      ["character", "Mira Vel", "Warden-captain of the [[Lantern Order]]. Practical, tired, and keeping a secret about her brother.\n\n:::secret\nHer brother didn't die in [[The Long Dusk]]. He walked into the dark on purpose.\n:::", { species: "human", life: "alive", born: "171 AF", birthplace: "@Hollowmere", faction: "@Lantern Order", personality: "Dry humour, never sleeps more than four hours." }],
      ["character", "Old Tobin", "A ferryman in [[Hollowmere]] who claims he has seen [[The Hollow King]] twice.", { species: "human", life: "alive", born: "131 AF", birthplace: "@Hollowmere" }],
      ["entity", "The Hollow King", "Something that lives in the dark beyond the lanterns. Nobody agrees what it looks like. It has never spoken, but it answers.", { tier: "greater", domain: "darkness, forgetting" }],
      ["event", "The Long Dusk", "Forty days when the sun didn't fully rise over [[The Ashen Vale]]. The [[Lantern Order]] was born from it.\n\nWhy did it end? Nobody knows yet.", { date: "14 AF", where: "@The Ashen Vale" }],
      ["thread", "The Hollow King's Wish", "The central mystery. Every answer so far is a rumour.", { open: "open", question: "What does [[The Hollow King]] want, and why does it answer [[Mira Vel]]?" }],
    ];
    const ids = {}, made = [];
    for (const [type, title, body, fields] of E) {
      if (!typeOf(type).fields) continue;
      const e = await createEntry(type, title, { body, tags: [this.TAG], fields: {} }); ids[title] = e.id; made.push([e, fields]);
    }
    for (const [e, fields] of made) {      // second pass: link fields need the ids, date fields use your calendar
      const ty = typeOf(e.type), f = {};
      for (const [k, v] of Object.entries(fields)) {
        const fd = ty.fields.find(x => x.key === k); if (!fd) continue;
        if (fd.kind === "date") { const d = Cal.parse(v.replace(/\bAF\b/, M.world.calendar.eras.at(-1)?.abbr || "AF")); if (d) f[k] = d; }
        else if (typeof v === "string" && v.startsWith("@")) { const id = ids[v.slice(1)]; if (id) f[k] = fd.kind === "links" ? [id] : id; }
        else f[k] = v;
      }
      await saveEntry({ ...M.entries.get(e.id), fields: f }, null, false);
    }
    Nav.render(); toast(tf("Example world added. Explore it, then remove it from Help when you're ready.", "Примерният свят е добавен. Разгледайте го и го махнете от Помощ, когато сте готови."));
    open(ids["Mira Vel"]);
  },
  async remove() {
    const list = [...M.entries.values()].filter(e => (e.tags || []).includes(this.TAG));
    if (!list.length) return;
    if (!await confirmBox(tf(`Remove the ${list.length} example entries? Entries you made yourself stay. Removed entries go to the trash.`, `Да махна ли ${list.length}-те примерни записа? Вашите записи остават. Махнатите отиват в кошчето.`), tf("Remove", "Махни"))) return;
    for (const e of list) await deleteEntry(e.id);
    Nav.render(); Panes.show({ view: "dashboard" }); toast(tf("Example world removed.", "Примерният свят е махнат."));
  },
};

// ------------------------------------------------------------------ trash
Views.trash = (el, r, pane) => {
  el.innerHTML = paneHead(tf("Trash", "Кошче"), `<button class="btn small danger" data-empty>${tf("Empty trash", "Изпразни кошчето")}</button>`, pane) + `<div class="pane-body"><div class="wrap"><div data-list><div class="faint">…</div></div></div></div>`;
  const draw = async () => {
    const items = await api("trash");
    $("[data-list]", el).innerHTML = items.length ? `<div class="faint small" style="margin-bottom:8px">${tf("Deleted entries wait here until you restore them or empty the trash.", "Изтритите записи чакат тук, докато ги възстановите или изпразните кошчето.")}</div>
      <div class="list">${items.map(it => `<div class="li"><span class="type-dot" style="background:${typeOf(it.type).color}"></span><div class="main"><div class="t">${esc(it.title)}</div>
        <div class="d">${esc(typeName(it.type))} · ${it.words} ${t("words")} · ${tf("deleted", "изтрит")} ${esc(it.deleted.replace("T", " ").slice(0, 16))}</div></div>
        <button class="btn small" data-restore="${esc(it.file)}">↺ ${tf("Restore", "Възстанови")}</button><button class="btn small ghost danger" data-purge="${esc(it.file)}" title="${tf("Delete forever", "Изтрий завинаги")}">✕</button></div>`).join("")}</div>`
      : `<div class="empty">${tf("The trash is empty.", "Кошчето е празно.")}</div>`;
    $("[data-empty]", el).disabled = !items.length;
    $$("[data-restore]", el).forEach(b => b.onclick = async () => {
      const res = await api("trash/restore", { file: b.dataset.restore });
      M.entries.set(res.entry.id, res.entry); Idx.rebuild(); Bus.emit("entries"); Nav.render();
      toast(tf(`Restored “${res.entry.title}”.`, `Възстановен „${res.entry.title}“.`)); draw();
    });
    $$("[data-purge]", el).forEach(b => b.onclick = async () => {
      if (!await confirmBox(tf("Delete this entry forever? This can't be undone (your backups still have it).", "Да изтрия ли записа завинаги? Не може да се отмени (архивите още го пазят)."), tf("Delete forever", "Изтрий завинаги"))) return;
      await api("trash/purge", { file: b.dataset.purge }); draw();
    });
  };
  $("[data-empty]", el).onclick = async () => {
    if (!await confirmBox(tf("Delete everything in the trash forever? This can't be undone (your backups still have them).", "Да изтрия ли всичко в кошчето завинаги? Не може да се отмени (архивите още ги пазят)."), tf("Empty trash", "Изпразни"))) return;
    await api("trash/purge", { all: true }); draw();
  };
  draw();
};

// ------------------------------------------------------------------ gallery (all images and maps)
Views.gallery = (el, r, pane) => {
  el.innerHTML = paneHead(tf("Gallery", "Галерия"), `<input class="input" data-q placeholder="${t("Search")}…" style="width:220px">`, pane) + `<div class="pane-body"><div class="wrap wide" data-g><div class="faint">…</div></div></div>`;
  let assets = [];
  const draw = () => {
    const q = norm($("[data-q]", el).value);
    const used = new Map();
    for (const e of M.entries.values()) for (const f of e.images || []) (used.get(f) || used.set(f, []).get(f)).push(e);
    for (const e of M.entries.values()) if (e.type === "map" && e.fields?.image) (used.get(e.fields.image) || used.set(e.fields.image, []).get(e.fields.image)).push(e);
    const all = [...new Set([...used.keys(), ...assets])].filter(f => !q || norm(f).includes(q) || (used.get(f) || []).some(e => norm(e.title).includes(q)));
    const tile = f => `<div class="g-tile"><div class="img" style="background-image:url('${img(f)}')" data-lb="${esc(f)}"></div>
      <div class="g-cap">${(used.get(f) || []).map(e => chipFor(e.id)).join("") || `<span class="faint small">${tf("not used in any entry", "не се ползва в запис")}</span>`}</div></div>`;
    const inUse = all.filter(f => used.has(f)), loose = all.filter(f => !used.has(f));
    $("[data-g]", el).innerHTML = all.length ? `<div class="g-grid">${inUse.map(tile).join("")}</div>${loose.length ? `<div class="section-title">${tf("Not used yet", "Още неизползвани")}</div><div class="g-grid">${loose.map(tile).join("")}</div>` : ""}`
      : `<div class="empty">${tf("No images yet. Drop pictures onto any entry to add concept art.", "Още няма изображения. Пуснете картинки върху запис, за да добавите концепт арт.")}</div>`;
    $$("[data-lb]", el).forEach(d => d.onclick = () => lightbox(img(d.dataset.lb)));
  };
  $("[data-q]", el).oninput = debounce(draw, 150);
  api("assets").then(a => { assets = a; draw(); }).catch(draw);
};

// ------------------------------------------------------------------ find & replace across the whole world
Views.replace = (el, r, pane) => {
  el.innerHTML = paneHead(tf("Find & replace", "Търсене и замяна"), "", pane) + `<div class="pane-body"><div class="wrap">
    <div class="card"><div class="form-grid">
      <label>${tf("Find", "Търси")}</label><input class="input" data-f placeholder="${tf("word or phrase", "дума или фраза")}">
      <label>${tf("Replace with", "Замени с")}</label><input class="input" data-r>
      <label></label><div class="row small">
        <label><input type="checkbox" data-case> ${tf("Match case", "Главни/малки букви")}</label>
        <label><input type="checkbox" data-word checked> ${tf("Whole words only", "Само цели думи")}</label>
        <label><input type="checkbox" data-fields> ${tf("Also in text fields", "И в текстовите полета")}</label>
        <label><input type="checkbox" data-titles> ${tf("Also in titles", "И в заглавията")}</label>
      </div>
    </div></div>
    <div class="faint small" style="margin:10px 2px">${tf("Every changed entry keeps its previous version in History, so a replace can always be undone entry by entry.", "Всеки променен запис пази предишната си версия в Историята, така че всяка замяна може да се върне.")}</div>
    <div data-res></div></div></div>`;
  const q = k => $(`[data-${k}]`, el);
  let hits = [];
  const rx = () => {
    const f = q("f").value; if (!f) return null;
    const e = f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(q("word").checked ? `(?<![\\p{L}\\p{N}])${e}(?![\\p{L}\\p{N}])` : e, "gu" + (q("case").checked ? "" : "i"));
  };
  const textFields = e => typeOf(e.type).fields.filter(fd => ["text", "long"].includes(fd.kind) && typeof e.fields?.[fd.key] === "string").map(fd => fd.key);
  const search = () => {
    const re = rx(); hits = [];
    if (re) for (const e of M.entries.values()) {
      const parts = [["body", e.body || ""]];
      if (q("fields").checked) textFields(e).forEach(k => parts.push(["f:" + k, e.fields[k]]));
      if (q("titles").checked) parts.push(["title", e.title]);
      const found = parts.map(([k, s]) => [k, s, [...s.matchAll(re)]]).filter(x => x[2].length);
      if (found.length) hits.push({ e, found, on: true, n: found.reduce((a, x) => a + x[2].length, 0) });
    }
    const total = hits.reduce((a, h) => a + h.n, 0), rep = q("r").value;
    const ctx = (s, m) => esc(s.slice(Math.max(0, m.index - 40), m.index)) + `<mark>${esc(m[0])}</mark>${rep !== "" ? `<ins>${esc(rep)}</ins>` : ""}` + esc(s.slice(m.index + m[0].length, m.index + m[0].length + 40));
    q("res").innerHTML = !q("f").value ? "" : hits.length ? `<div class="row" style="margin-bottom:8px"><b>${total}</b> ${tf("matches in", "съвпадения в")} <b>${hits.length}</b> ${tf("entries", "записа")}<span class="spacer"></span>
        <button class="btn primary small" data-apply>${tf("Replace in ticked entries", "Замени в отметнатите")}</button></div>
      <div class="list">${hits.map((h, i) => `<div class="li" style="align-items:flex-start"><input type="checkbox" data-hit="${i}" checked style="margin-top:4px"><div class="main">
        <div class="t">${chipFor(h.e.id)} <span class="faint small">${h.n}×</span></div>
        ${h.found.flatMap(([k, s, ms]) => ms.slice(0, 3).map(m => `<div class="d replace-ctx">${k !== "body" ? `<span class="faint">${k === "title" ? t("Title") : esc(fieldLabel(typeOf(h.e.type).fields.find(f => "f:" + f.key === k)))}: </span>` : ""}…${ctx(s, m)}…</div>`)).join("")}
      </div></div>`).join("")}</div>` : `<div class="empty">${tf("Nothing found.", "Нищо не е намерено.")}</div>`;
    $$("[data-hit]", el).forEach(c => c.onchange = () => { hits[+c.dataset.hit].on = c.checked; });
    q("apply") && (q("apply").onclick = apply);
  };
  const apply = async () => {
    const re = rx(), rep = q("r").value, todo = hits.filter(h => h.on); if (!re || !todo.length) return;
    if (!await confirmBox(tf(`Replace in ${todo.length} entries?`, `Да заменя ли в ${todo.length} записа?`), tf("Replace", "Замени"))) return;
    let n = 0;
    for (const h of todo) {
      const e = structuredClone(M.entries.get(h.e.id)); const prev = e.title;
      for (const [k] of h.found) {
        if (k === "body") e.body = e.body.replace(re, () => rep);
        else if (k === "title") e.title = e.title.replace(re, () => rep);
        else { const fk = k.slice(2); e.fields[fk] = e.fields[fk].replace(re, () => rep); }
      }
      await saveEntry(e, e.title !== prev ? prev : null, "force"); n++;
    }
    toast(tf(`Replaced in ${n} entries.`, `Заменено в ${n} записа.`)); Nav.render(); search();
  };
  ["f", "r"].forEach(k => q(k).oninput = debounce(search, 250));
  ["case", "word", "fields", "titles"].forEach(k => q(k).onchange = search);
  q("f").focus();
};

// ------------------------------------------------------------------ entry from a selection (in the editor)
async function entryFromSelection(ta) {
  const a = ta.selectionStart, b = ta.selectionEnd, sel = ta.value.slice(a, b).trim();
  if (!sel || sel.length > 80 || sel.includes("\n")) { toast(tf("Select a name first (one line), then press Ctrl+Shift+L.", "Първо маркирайте име (един ред), после Ctrl+Shift+L.")); return; }
  ta.setRangeText(`[[${sel}]]`, a, b, "end"); ta.dispatchEvent(new Event("input"));
  if (Idx.find(sel)) { toast(tf(`Linked to “${sel}”.`, `Свързано с „${sel}“.`)); return; }
  const types = M.world.types.filter(x => x.key !== "map");
  const pick = await modal(tf(`New entry “${sel}”`, `Нов запис „${sel}“`), `<div class="row">${types.map(x => `<button class="chip" data-k="${x.key}">${x.icon} ${esc(typeName(x.key))}</button>`).join("")}</div>
    <div class="faint small" style="margin-top:8px">${tf("The link is already in your text. Pick a type to create the entry too, or press Esc to leave it as a link for later.", "Връзката вече е в текста. Изберете вид, за да създадете и записа, или Esc, за да остане само връзка.")}</div>`,
    { onOpen: (ov, close) => $$("[data-k]", ov).forEach(x => x.onclick = () => close(x.dataset.k)) });
  if (pick) { await createEntry(pick, sel); Nav.render(); toast(tf(`Created “${sel}”. It stays here; open it any time from the link.`, `Създаден „${sel}“. Отворете го по всяко време от връзката.`)); }
  ta.focus();
}
document.addEventListener("keydown", ev => {
  if (ev.ctrlKey && ev.shiftKey && ev.key.toLowerCase() === "l" && ev.target.matches?.("textarea.editor, .writing textarea, textarea")) { ev.preventDefault(); entryFromSelection(ev.target); }
});

// ------------------------------------------------------------------ templates per type
const Templates = {
  async setFrom(e) {
    const ty = typeOf(e.type);
    if (!await confirmBox(tf(`Use “${e.title}” as the starting text and fields for every new ${typeName(e.type)}?`, `Да използвам ли „${e.title}“ като начален текст и полета за всеки нов ${typeName(e.type)}?`), tf("Use as template", "Използвай като шаблон"))) return;
    const fields = {};
    for (const fd of ty.fields) if (["text", "long", "select", "list", "steps", "number"].includes(fd.kind) && e.fields?.[fd.key] !== undefined) fields[fd.key] = structuredClone(e.fields[fd.key]);
    M.world.templates = { ...(M.world.templates || {}), [e.type]: { body: e.body || "", fields, from: e.title } };
    await saveWorld(); toast(tf(`New ${typeName(e.type)} entries now start from “${e.title}”.`, `Новите записи ${typeName(e.type)} вече започват от „${e.title}“.`));
  },
  async clear(type) { if (M.world.templates) delete M.world.templates[type]; await saveWorld(); toast(tf("Template removed.", "Шаблонът е махнат.")); },
};
