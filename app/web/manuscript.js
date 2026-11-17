// Manuscript: books → chapters → scenes, a scene board, outline templates, word goals,
// and Compile: the story as Word / e-book / PDF / Markdown, and the lore as a World Bible.
"use strict";

const MS = {
  byOrder: (a, b) => (+a.fields?.order || 999) - (+b.fields?.order || 999) || a.title.localeCompare(b.title),
  books() { return entriesOf("book").sort(this.byOrder); },
  chapters(bookId) { return entriesOf("chapter").filter(c => bookId === "*" || (c.fields?.book || "") === (bookId || "")).sort(this.byOrder); },
  scenes(chId) { return entriesOf("scene").filter(s => (s.fields?.chapter || "") === chId).sort(this.byOrder); },
  looseScenes() { const ch = new Set(entriesOf("chapter").map(c => c.id)); return entriesOf("scene").filter(s => !ch.has(s.fields?.chapter)).sort(this.byOrder); },
  chWords(ch) { return words(ch.body) + this.scenes(ch.id).reduce((a, s) => a + words(s.body), 0); },
  bookWords(bookId) { return this.chapters(bookId).reduce((a, c) => a + this.chWords(c), 0); },
  goalBar(n, goal) { if (!+goal) return ""; const p = Math.min(100, Math.round(n / goal * 100)); return `<div class="meter" title="${n} / ${goal}"><i style="width:${p}%"></i></div>`; },
  // text ready for readers: no secrets, links become plain words
  clean(text) {
    return String(text || "").replace(/^:::secret[\s\S]*?^:::\s*$/gim, "").replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g, (m, n, l) => (l || n).trim()).replace(/\n{3,}/g, "\n\n").trim();
  },
  chapterText(ch) {
    const parts = [this.clean(ch.body), ...this.scenes(ch.id).map(s => this.clean(s.body))].filter(Boolean);
    return parts.join("\n\n* * *\n\n");
  },
  async reorder(list, id, dir) {
    const i = list.findIndex(x => x.id === id), j = i + dir; if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    for (const [k, e] of list.entries()) if (+e.fields?.order !== k + 1) await saveEntry({ ...M.entries.get(e.id), fields: { ...(M.entries.get(e.id).fields || {}), order: k + 1 } }, null, false);
    Panes.refresh();
  },
};

const OUTLINES = {
  three: [["Three acts", "Три действия"], [
    ["Opening image", "The world and the hero before everything changes."], ["The inciting incident", "Something happens that the hero can't ignore."],
    ["Into the unknown", "The hero commits and crosses into act two."], ["Fun and games", "The promise of the premise: the new world, new rules, new allies and enemies."],
    ["Midpoint", "A false victory or false defeat raises the stakes."], ["The bad guys close in", "Pressure from outside and doubt from inside."],
    ["All is lost", "The lowest point; something or someone is lost."], ["The final battle", "The hero uses everything learned to face the antagonist."], ["Resolution", "The new normal. Mirror the opening image."] ] ],
  hero: [["Hero's journey", "Пътят на героя"], [
    ["The ordinary world", "Where the hero comes from and what they lack."], ["The call to adventure", "A problem or opportunity appears."], ["Refusal of the call", "Fear or duty holds them back."],
    ["Meeting the mentor", "Someone gives advice, a gift or a push."], ["Crossing the threshold", "The hero leaves the known world."], ["Tests, allies and enemies", "Learning the rules of the new world."],
    ["Approach to the inmost cave", "Preparing for the central ordeal."], ["The ordeal", "A brush with death; the hero is changed."], ["The reward", "What was won, and its price."],
    ["The road back", "Consequences follow them home."], ["Resurrection", "The final test, where everything learned is used."], ["Return with the elixir", "Home again, changed, bringing something back."] ] ],
  seven: [["Seven-point structure", "Седем точки"], [
    ["Hook", "Where the hero starts: the opposite of where they'll end."], ["First plot turn", "The call: the world changes and the conflict begins."], ["First pinch", "The antagonist applies pressure; things go wrong."],
    ["Midpoint", "The hero stops reacting and starts acting."], ["Second pinch", "Worse pressure; the hero loses something important."], ["Second plot turn", "The last piece of the puzzle: the hero has what they need."], ["Resolution", "The climax, and the hero's change completed."] ] ],
  kisho: [["Four acts (kishōtenketsu)", "Четири части (кишотенкецу)"], [
    ["Introduction (ki)", "Characters and setting, calmly."], ["Development (shō)", "Their lives deepen; no big conflict needed."], ["Twist (ten)", "Something unexpected changes how we see everything."], ["Reconciliation (ketsu)", "The parts come together in a new understanding."] ] ],
};

Views.story = (el, r, pane) => {
  const books = MS.books();
  let book = r.id ?? M.state.msBook ?? (books[0]?.id || "");
  if (book !== "*" && book && !M.entries.has(book)) book = books[0]?.id || "";
  const board = !!M.state.msBoard;
  const chapters = MS.chapters(book), loose = MS.looseScenes();
  const B = M.entries.get(book), total = book === "*" ? MS.bookWords("*") : MS.bookWords(book);
  el.innerHTML = paneHead(`¶ ${tf("Manuscript", "Ръкопис")}`, `<div class="row">
      <select class="input" data-book style="width:auto">${books.length ? "" : `<option value="">${tf("Your story", "Вашата история")}</option>`}
        ${books.map(b => `<option value="${b.id}" ${b.id === book ? "selected" : ""}>${esc(b.title)}</option>`).join("")}${books.length ? `<option value="" ${book === "" ? "selected" : ""}>${tf("Chapters not in a book", "Глави без книга")}</option>` : ""}<option value="*" ${book === "*" ? "selected" : ""}>${tf("Everything", "Всичко")}</option></select>
      <button class="btn small ghost" data-newbook>＋ ${tf("Book", "Книга")}</button>
      <button class="btn small ghost" data-mode>${board ? "☰ " + tf("List", "Списък") : "▦ " + tf("Scene board", "Табло със сцени")}</button>
      <button class="btn small ghost" data-outline>✦ ${tf("Outline template", "Шаблон за структура")}</button>
      <button class="btn small" data-compile>⎙ ${tf("Compile", "Компилирай")}</button>
      <button class="btn primary small" data-newch>＋ ${tf("Chapter", "Глава")}</button></div>`, pane) + `
    <div class="pane-body"><div class="wrap ${board ? "full" : "wide"}">
      <div class="card ms-head"><div><div class="faint small">${B ? esc(B.fields?.subtitle || typeName("book")) : tf("Words", "Думи")}</div>
        <div style="font:600 24px var(--serif)">${total.toLocaleString()} <span class="faint" style="font-size:13px">${t("words")}${B?.fields?.wordGoal ? ` / ${(+B.fields.wordGoal).toLocaleString()}` : ""}</span></div></div>
        <div style="flex:1">${B ? MS.goalBar(total, B.fields?.wordGoal) : ""}<div class="faint small" style="margin-top:6px">${chapters.length} ${tf("chapters", "глави")} · ${chapters.reduce((a, c) => a + MS.scenes(c.id).length, 0)} ${tf("scenes", "сцени")}${B ? ` · <span class="link" data-open="${B.id}">${tf("book details", "подробности за книгата")}</span>` : ""}</div></div></div>
      <div data-body></div>
    </div></div>`;
  const body = $("[data-body]", el);
  const sceneCard = s => `<div class="scene-card" draggable="true" data-scene="${s.id}"><div class="row"><b class="t" data-open="${s.id}">${esc(s.title)}</b><span class="spacer"></span><span class="status ${["done", "revised"].includes(s.fields?.progress) ? "canon" : "draft"}">${esc(optLabel(s.fields?.progress || "idea"))}</span></div>
    ${s.fields?.summary ? `<div class="small muted">${esc(s.fields.summary.slice(0, 140))}</div>` : ""}
    <div class="row small faint" style="margin-top:4px">${s.fields?.pov ? `◉ ${esc(titleOf(s.fields.pov))}` : ""}${s.fields?.where ? ` ⌂ ${esc(titleOf(s.fields.where))}` : ""}${s.fields?.date ? ` ⟟ ${esc(Cal.format(s.fields.date))}` : ""}<span class="spacer"></span>${words(s.body)}${+s.fields?.wordGoal ? `/${s.fields.wordGoal}` : ""} ${t("words")}</div>
    ${MS.goalBar(words(s.body), s.fields?.wordGoal)}</div>`;
  if (board) {
    body.innerHTML = `<div class="board">${chapters.map(ch => `<div class="board-col" data-col="${ch.id}"><div class="board-head"><b data-open="${ch.id}">${ch.fields?.order != null ? ch.fields.order + ". " : ""}${esc(ch.title)}</b><span class="faint small">${MS.chWords(ch)}</span></div>
        <div class="board-cards" data-drop="${ch.id}">${MS.scenes(ch.id).map(sceneCard).join("")}</div><button class="btn small ghost" data-newsc="${ch.id}">＋ ${tf("Scene", "Сцена")}</button></div>`).join("")}
      ${loose.length ? `<div class="board-col"><div class="board-head"><b class="faint">${tf("Not in a chapter", "Без глава")}</b></div><div class="board-cards" data-drop="">${loose.map(sceneCard).join("")}</div></div>` : ""}
      ${chapters.length ? "" : `<div class="empty">${tf("Add a chapter, or start from an outline template.", "Добавете глава или започнете от шаблон.")}</div>`}</div>
      <div class="faint small" style="margin-top:8px">${tf("Drag scenes to reorder them or move them to another chapter.", "Плъзгайте сцените, за да ги подредите или преместите в друга глава.")}</div>`;
    let drag = null;
    $$("[data-scene]", body).forEach(c => { c.ondragstart = ev => { drag = c.dataset.scene; ev.dataTransfer.effectAllowed = "move"; c.classList.add("dragging"); }; c.ondragend = () => c.classList.remove("dragging"); });
    $$("[data-drop]", body).forEach(zone => {
      zone.ondragover = ev => { if (!drag) return; ev.preventDefault(); zone.classList.add("over"); };
      zone.ondragleave = () => zone.classList.remove("over");
      zone.ondrop = async ev => {
        ev.preventDefault(); ev.stopPropagation(); zone.classList.remove("over"); if (!drag) return;
        const target = zone.dataset.drop, cards = $$("[data-scene]", zone).filter(c => c.dataset.scene !== drag);
        const after = cards.find(c => ev.clientY < c.getBoundingClientRect().top + c.offsetHeight / 2);
        const ids = cards.map(c => c.dataset.scene); ids.splice(after ? ids.indexOf(after.dataset.scene) : ids.length, 0, drag);
        for (const [k, id] of ids.entries()) { const e = M.entries.get(id); if (+e.fields?.order !== k + 1 || (e.fields?.chapter || "") !== target) await saveEntry({ ...e, fields: { ...(e.fields || {}), order: k + 1, chapter: target } }, null, false); }
        drag = null; Panes.refresh();
      };
    });
  } else {
    body.innerHTML = chapters.length ? chapters.map((ch, i) => {
      const sc = MS.scenes(ch.id), n = MS.chWords(ch);
      const linked = new Set([...linksIn(ch.body), ...sc.flatMap(s => linksIn(s.body))].map(x => Idx.find(x)?.id).filter(Boolean));
      if (ch.fields?.pov) linked.add(ch.fields.pov);
      const who = [...linked].map(id => M.entries.get(id)).filter(e => e && ["character", "location"].includes(e.type));
      return `<div class="card ms-ch"><div class="row"><span class="ms-move"><button class="btn icon ghost small" data-up="${ch.id}" ${i ? "" : "disabled"}>↑</button><button class="btn icon ghost small" data-down="${ch.id}" ${i < chapters.length - 1 ? "" : "disabled"}>↓</button></span>
          <b style="font:600 17px var(--serif);cursor:pointer" data-open="${ch.id}">${ch.fields?.order != null ? ch.fields.order + ". " : ""}${esc(ch.title)}</b>
          <span class="status ${ch.fields?.progress === "done" ? "canon" : "draft"}">${esc(optLabel(ch.fields?.progress || "idea"))}</span><span class="spacer"></span>
          <span class="faint small">${n}${+ch.fields?.wordGoal ? ` / ${ch.fields.wordGoal}` : ""} ${t("words")}</span>
          <button class="btn small ghost" data-write="${ch.id}">✎ ${t("Writing mode")}</button><button class="btn small ghost" data-newsc="${ch.id}">＋ ${tf("Scene", "Сцена")}</button></div>
        ${MS.goalBar(n, ch.fields?.wordGoal)}
        ${ch.fields?.summary ? `<div class="muted small" style="margin-top:6px">${esc(ch.fields.summary)}</div>` : ""}
        ${who.length ? `<div class="row small" style="margin-top:6px">${who.map(x => chipFor(x.id)).join("")}</div>` : ""}
        ${sc.length ? `<div class="ms-scenes">${sc.map((s, k) => `<div class="li"><span class="ms-move"><button class="btn icon ghost small" data-sup="${s.id}" data-ch="${ch.id}" ${k ? "" : "disabled"}>↑</button><button class="btn icon ghost small" data-sdown="${s.id}" data-ch="${ch.id}" ${k < sc.length - 1 ? "" : "disabled"}>↓</button></span>
          <span class="faint">⁂</span><div class="main" data-open="${s.id}"><div class="t">${esc(s.title)}</div><div class="d">${esc(s.fields?.summary || summary(s, 100))}</div></div>
          <span class="faint small">${s.fields?.pov ? esc(titleOf(s.fields.pov)) + " · " : ""}${words(s.body)} ${t("words")}</span><button class="btn small ghost" data-write="${s.id}">✎</button></div>`).join("")}</div>` : ""}
      </div>`; }).join("")
      : `<div class="empty">${tf("No chapters yet. Add one, or start from an outline template (three acts, hero's journey…). Chapters can hold scenes; each scene has its own point of view, place, date and word goal.", "Още няма глави. Добавете или започнете от шаблон. Главите съдържат сцени със собствена гледна точка, място, дата и цел.")}</div>`;
    $$("[data-up]", body).forEach(b => b.onclick = () => MS.reorder(MS.chapters(book), b.dataset.up, -1));
    $$("[data-down]", body).forEach(b => b.onclick = () => MS.reorder(MS.chapters(book), b.dataset.down, 1));
    $$("[data-sup]", body).forEach(b => b.onclick = () => MS.reorder(MS.scenes(b.dataset.ch), b.dataset.sup, -1));
    $$("[data-sdown]", body).forEach(b => b.onclick = () => MS.reorder(MS.scenes(b.dataset.ch), b.dataset.sdown, 1));
    $$("[data-write]", body).forEach(b => b.onclick = () => Entry.writingMode(b.dataset.write, () => Panes.refresh()));
  }
  $$("[data-newsc]", el).forEach(b => b.onclick = async () => {
    const n = MS.scenes(b.dataset.newsc).length + 1;
    const e = await createEntry("scene", tf(`Scene ${n}`, `Сцена ${n}`), { fields: { chapter: b.dataset.newsc, order: n, progress: "idea" } }); Entry.editing.add(e.id); open(e.id, true);
  });
  $("[data-book]", el).onchange = ev => { M.state.msBook = ev.target.value; saveState(); Panes.show({ view: "story", id: ev.target.value || undefined }, pane); };
  $("[data-mode]", el).onclick = () => { M.state.msBoard = !board; saveState(); Panes.refresh(); };
  $("[data-newbook]", el).onclick = async () => {
    const t_ = await promptBox(tf("Book title", "Заглавие на книгата"), "", tf("Book One", "Книга първа")); if (!t_) return;
    const e = await createEntry("book", t_, { fields: { order: MS.books().length + 1, stage: "planning" } }); M.state.msBook = e.id; saveState(); Panes.show({ view: "story", id: e.id }, pane);
  };
  $("[data-newch]", el).onclick = async () => {
    const all = MS.chapters(book === "*" ? "*" : book), n = all.length ? Math.max(...all.map(c => +c.fields?.order || 0)) + 1 : 1;
    const e = await createEntry("chapter", tf(`Chapter ${n}`, `Глава ${n}`), { fields: { order: n, progress: "idea", ...(book && book !== "*" ? { book } : {}) } }); Entry.editing.add(e.id); open(e.id);
  };
  $("[data-outline]", el).onclick = () => outlineBox(book === "*" ? "" : book);
  $("[data-compile]", el).onclick = () => Compile.dialog(book === "*" ? "" : book);
};

async function outlineBox(book) {
  const pick = await modal(tf("Start from an outline", "Започнете от структура"), `<div class="muted small" style="margin-bottom:10px">${tf("Creates chapters with a short note on what each one should do. Rename, merge or delete them freely; nothing you've written is changed.", "Създава глави с кратка бележка какво трябва да прави всяка. Преименувайте, сливайте или трийте свободно; нищо написано не се променя.")}</div>
    <div class="list">${Object.entries(OUTLINES).map(([k, [name, beats]]) => `<div class="li" data-k="${k}" style="cursor:pointer"><div class="main"><div class="t">${esc(tf(...name))}</div><div class="d">${beats.map(b => b[0]).join(" · ")}</div></div><span class="faint small">${beats.length}</span></div>`).join("")}</div>`,
    { wide: true, onOpen: (ov, close) => $$("[data-k]", ov).forEach(x => x.onclick = () => close(x.dataset.k)) });
  if (!pick) return;
  const start = MS.chapters(book || "").length;
  for (const [i, [title, note]] of OUTLINES[pick][1].entries())
    await createEntry("chapter", title, { fields: { order: start + i + 1, progress: "outline", summary: note, ...(book ? { book } : {}) }, tags: ["outline"] });
  toast(tf(`Added ${OUTLINES[pick][1].length} chapters.`, `Добавени ${OUTLINES[pick][1].length} глави.`)); Panes.refresh();
}

// ------------------------------------------------------------------ compile
const Compile = {
  fieldRows(e) {
    return typeOf(e.type).fields.map(fd => {
      const v = e.fields?.[fd.key]; if (!Checks.has(v) || fd.kind === "knowers") return null;
      const T = id => titleOf(id) || "";
      const s = fd.kind === "link" ? T(v) : fd.kind === "links" ? v.map(T).filter(Boolean).join(", ") : fd.kind === "date" ? Cal.format(v)
        : fd.kind === "relations" ? v.map(r => `${r.kind}: ${T(r.to)}`).join("\n") : String(v);
      return s ? [fieldLabel(fd), MS.clean(s)] : null;
    }).filter(Boolean);
  },
  manuscript(book) {
    const chs = MS.chapters(book || "").map(ch => ({ title: ch.title, level: 1, text: MS.chapterText(ch) }));
    return chs.filter(c => c.text);          // chapters with nothing written yet stay out of the book
  },
  bible(opts) {
    const order = ["concept", ...PATH.flatMap(s => (s.types || []).map(t => t[0])), ...M.world.types.map(t => t.key)];
    const skip = new Set(["note", "secret", "chapter", "scene", "book", "map"].filter(k => !(k === "map" && opts.maps)));
    const ok = e => !e.secret && e.status !== "scrapped" && !(opts.canon && e.status !== "canon") && !skip.has(e.type);
    const out = [];
    if (M.world.about) out.push({ title: tf("About this world", "За този свят"), level: 1, text: MS.clean(M.world.about) });
    const notes = [...M.entries.values()].filter(e => (e.tags || []).includes("worldbuilding") && ok(e));
    if (notes.length) { out.push({ title: tf("Foundations", "Основи"), level: 1, text: "" }); notes.forEach(e => out.push({ title: e.title.replace(/\s*\(.*\)$/, ""), level: 2, text: MS.clean(e.body) })); }
    for (const key of [...new Set(order)]) {
      const list = sortByTitle(entriesOf(key).filter(e => ok(e) && !(e.tags || []).includes("worldbuilding"))); if (!list.length) continue;
      out.push({ title: typeName(key), level: 1, text: "" });
      for (const e of list) out.push({ title: e.title, level: 2, kindLabel: typeName(e.type) + ((e.aliases || []).length ? " · " + e.aliases.join(", ") : ""), fields: this.fieldRows(e),
        text: MS.clean(e.body), images: opts.images ? [...(e.images || []), ...(e.type === "map" && e.fields?.image ? [e.fields.image] : [])] : [] });
    }
    return out;
  },
  async dialog(book = "") {
    const B = M.entries.get(book), books = MS.books();
    const r = await modal(tf("Compile", "Компилиране"), `
      <div class="form-grid">
        <label>${tf("What", "Какво")}</label><select class="input" data-what>
          ${books.map(b => `<option value="ms:${b.id}" ${b.id === book ? "selected" : ""}>${tf("Manuscript:", "Ръкопис:")} ${esc(b.title)}</option>`).join("")}
          ${MS.chapters("").length || !books.length ? `<option value="ms:" ${!book ? "selected" : ""}>${tf("Manuscript", "Ръкопис")}${books.length ? tf(" (chapters not in a book)", " (глави без книга)") : ""}</option>` : ""}
          <option value="bible">${tf("World Bible: the whole world as a book", "Библия на света: целият свят като книга")}</option></select>
        <label>${tf("Format", "Формат")}</label><div class="row" data-fmt>
          <span class="chip on" data-f="docx">Word (.docx)</span><span class="chip" data-f="pdf">PDF</span><span class="chip" data-f="epub">${tf("E-book", "Е-книга")} (.epub)</span><span class="chip" data-f="md">Markdown</span></div>
        <label>${tf("Title", "Заглавие")}</label><input class="input" data-title value="${esc(B?.title || M.world.name || "")}">
        <label>${tf("Author", "Автор")}</label><input class="input" data-author value="${esc(B?.fields?.author || M.settings.authorName || "")}">
        <label data-bopt></label><div class="small" data-bopt><label><input type="checkbox" data-canon> ${tf("Only canon entries", "Само записи канон")}</label> &nbsp; <label><input type="checkbox" data-images checked> ${tf("Include images and maps", "С изображения и карти")}</label></div>
      </div>
      <div class="faint small" style="margin-top:10px">${tf("Secret entries, author-only notes and :::secret parts are always left out. [[Links]] become plain words. Files go to the Exports folder; PDF opens the print window, where you pick “Save as PDF”.", "Тайните записи, бележките на автора и :::secret частите винаги се пропускат. [[Връзките]] стават обикновени думи. Файловете отиват в папка Exports; PDF отваря прозореца за печат, където изберете „Запиши като PDF“.")}</div>`,
      { wide: true, buttons: [{ label: t("Cancel"), value: null }, { label: tf("Create", "Създай"), cls: "primary", value: ov => ({
          what: $("[data-what]", ov).value, fmt: $("[data-fmt] .on", ov).dataset.f, title: $("[data-title]", ov).value.trim(), author: $("[data-author]", ov).value.trim(),
          canon: $("[data-canon]", ov).checked, images: $("[data-images]", ov).checked }) }],
        onOpen: ov => {
          $$("[data-f]", ov).forEach(c => c.onclick = () => { $$("[data-f]", ov).forEach(x => x.classList.remove("on")); c.classList.add("on"); });
          const sync = () => { const bible = $("[data-what]", ov).value === "bible"; $$("[data-bopt]", ov).forEach(x => x.style.visibility = bible ? "" : "hidden");
            if (bible && !$("[data-title]", ov).dataset.touched) $("[data-title]", ov).value = M.world.name || tf("World Bible", "Библия на света"); };
          $("[data-what]", ov).onchange = sync; $("[data-title]", ov).oninput = e => e.target.dataset.touched = 1; sync();
        } });
    if (!r) return;
    if (r.author && r.author !== M.settings.authorName) api("settings", { authorName: r.author }).then(s => M.settings = s);
    const bible = r.what === "bible";
    const sections = bible ? this.bible(r) : this.manuscript(r.what.slice(3));
    if (!sections.length || sections.every(s => !s.text && !s.fields?.length)) return toast(tf("There's nothing to compile yet.", "Още няма какво да се компилира."), "error");
    const title = r.title || (bible ? tf("World Bible", "Библия на света") : tf("Manuscript", "Ръкопис"));
    if (r.fmt === "pdf") return this.print(title, r.author, sections, bible);
    try {
      const res = await api("compile", { format: r.fmt, title, author: r.author, kind: bible ? "bible" : "manuscript", sections, lang: M.settings.language });
      toast(tf("Created: ", "Създадено: ") + res.file);
      api("open", { path: res.file.replace(/[\\/][^\\/]+$/, "") }).catch(() => {});
    } catch (err) { toast(err.message, "error"); }
  },
  print(title, author, sections, bible) {
    const md = s => MD.render(s, { noSecrets: true, link: (n, label) => esc(label) });
    const toc = sections.filter(s => s.level === 1);
    $("#print").innerHTML = `<div class="book ${bible ? "bible" : "novel"}"><div class="b-title"><h1>${esc(title)}</h1>${author ? `<div class="b-author">${esc(author)}</div>` : ""}</div>
      ${toc.length > 1 ? `<div class="b-toc"><h2>${tf("Contents", "Съдържание")}</h2>${toc.map(s => `<div>${esc(s.title)}</div>`).join("")}</div>` : ""}
      ${sections.map(s => `<section class="b-${s.level === 1 ? "part" : "entry"}"><${s.level === 1 ? "h2" : "h3"}>${esc(s.title)}</${s.level === 1 ? "h2" : "h3"}>
        ${s.kindLabel ? `<div class="b-kind">${esc(s.kindLabel)}</div>` : ""}
        ${s.fields?.length ? `<table>${s.fields.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v).replace(/\n/g, "<br>")}</td></tr>`).join("")}</table>` : ""}
        ${md(s.text || "").replace(/<p>\s*(\*\s*){3}<\/p>|<hr>/g, '<p class="b-break">*&nbsp;&nbsp;&nbsp;*&nbsp;&nbsp;&nbsp;*</p>')}
        ${(s.images || []).map(f => `<img src="${img(f)}">`).join("")}</section>`).join("")}</div>`;
    setTimeout(() => window.print(), 300);
  },
};
