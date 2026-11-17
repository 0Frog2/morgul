// Entry page: view, edit (fields per type), images, history, where-used, writing mode.
"use strict";
const Entry = (() => {
  const editing = new Set();       // ids currently in edit mode

  // ---------- read-only field display
  function fieldValue(fd, v) {
    if (!Checks.has(v)) return "";
    switch (fd.kind) {
      case "link": return chipFor(v, { missing: "?" });
      case "links": return v.map(id => chipFor(id)).join("");
      case "date": return `<span title="${esc(Cal.input(v))}">${esc(Cal.format(v))}</span>`;
      case "long": return `<div class="md small">${MD.render(v)}</div>`;
      case "list": return `<div class="small">${v.split("\n").filter(Boolean).map(x => `<div>• ${MD.inline(x, {})}</div>`).join("")}</div>`;
      case "steps": return `<ol class="small" style="margin:0;padding-left:18px">${v.split("\n").filter(Boolean).map(x => `<li>${MD.inline(x, {})}</li>`).join("")}</ol>`;
      case "relations": return v.map(r => `<div class="small">${esc(r.kind)} · ${chipFor(r.to, { missing: "?" })}</div>`).join("");
      case "knowers": return v.map(r => `<div class="small">${chipFor(r.who, { missing: "?" })}${r.since ? ` <span class="faint">${tf("since", "от")}</span> ${chipFor(r.since)}` : ""}</div>`).join("");
      default: return MD.inline(String(v), {});
    }
  }

  // reverse relations (if A says "parent of"... B shows it too)
  const REV = { parent: "child", child: "parent", spouse: "spouse", sibling: "sibling", lover: "lover", friend: "friend", ally: "ally",
    mentor: "student", student: "mentor", master: "servant", servant: "master", rival: "rival", enemy: "enemy", other: "other" };
  function relationsOf(e) {
    const out = (e.fields?.relations || []).map(r => ({ ...r }));
    for (const o of M.entries.values()) for (const r of o.fields?.relations || [])
      if (r.to === e.id && !out.some(x => x.to === o.id)) out.push({ kind: REV[r.kind] || r.kind, to: o.id, mirrored: true });
    return out;
  }

  // things computed from other entries, shown in the side column
  function derived(e) {
    const blocks = [];
    const list = (title, ids) => ids.length && blocks.push(`<div class="card"><h3>${esc(title)}</h3>${ids.map(id => chipFor(id)).join(" ")}</div>`);
    const by = (type, key) => [...M.entries.values()].filter(x => x.type === type && [].concat(x.fields?.[key] || []).includes(e.id)).map(x => x.id);
    if (e.type === "location") { list(tf("Places inside", "Места вътре"), by("location", "partOf")); list(tf("Events here", "Събития тук"), by("event", "where"));
      list(tf("Maps", "Карти"), by("map", "of")); list(tf("Born here", "Родени тук"), by("character", "birthplace")); }
    if (e.type === "faction") { list(tf("Members", "Членове"), by("character", "faction")); list(tf("Events", "Събития"), by("event", "participants")); }
    if (e.type === "ingredient") { list(tf("Used in potions", "Използва се в отвари"), by("potion", "ingredients")); list(tf("Used in rituals", "Използва се в ритуали"), by("ritual", "components")); }
    if (e.type === "language") list(tf("Glossary terms", "Термини"), by("term", "language"));
    if (e.type === "character") {
      const evs = by("event", "participants").map(id => M.entries.get(id)).filter(x => x.fields?.date).sort((a, b) => Cal.key(a.fields.date) - Cal.key(b.fields.date));
      if (evs.length) blocks.push(`<div class="card"><h3>${tf("Life events", "Събития в живота")}</h3>${evs.map(ev => {
        const age = e.fields?.born ? Cal.yearsBetween(e.fields.born, ev.fields.date) : null;
        return `<div class="small" style="margin-bottom:4px"><span class="faint">${esc(Cal.format(ev.fields.date))}${age !== null ? ` · ${tf("age", "на")} ${age}` : ""}</span><br>${chipFor(ev.id)}</div>`;
      }).join("")}</div>`);
      const rel = relationsOf(e);
      if (rel.length) blocks.push(`<div class="card"><h3>${tf("Relationships", "Връзки")}</h3>${rel.map(r => `<div class="small">${esc(r.kind)} · ${chipFor(r.to, { missing: "?" })}</div>`).join("")}</div>`);
      const age = e.fields?.born && !e.fields?.died ? Cal.yearsBetween(e.fields.born, String(Cal.present())) : null;
      if (age !== null && age >= 0) blocks.unshift(`<div class="card small">${tf("Age in the present", "Възраст в настоящето")} (${esc(Cal.yearLabel(Cal.present()))}): <b>${age}</b></div>`);
    }
    const secrets = [...M.entries.values()].filter(x => x.type === "secret" && (x.fields?.knownBy || []).some(k => k.who === e.id));
    list(tf("Secrets they know", "Тайни, които знае"), secrets.map(x => x.id));
    return blocks.join("");
  }

  // ---------- VIEW
  function view(el, route, pane) {
    const e = M.entries.get(route.id);
    if (!e) { el.innerHTML = paneHead(tf("Not found", "Не е намерено"), "", pane) + `<div class="pane-body"><div class="empty">${tf("This entry was deleted or moved.", "Записът е изтрит или преместен.")}</div></div>`; return; }
    if (editing.has(e.id)) return edit(el, e, pane);
    const ty = typeOf(e.type);
    const pinned = (M.state.pinned || []).includes(e.id);
    const actions = `<div class="row">
      <button class="btn small" data-a="edit" title="Ctrl+E">${t("Edit")}</button>
      ${pane === 0 ? `<button class="btn small ghost" data-a="beside" title="Shift+click any link">${t("Open beside")}</button>` : ""}
      <button class="btn small ghost" data-a="ask" title="${t("AI helper")}">✦ ${t("Ask me questions")}</button>
      <button class="btn small ghost" data-a="more">⋯</button></div>`;
    const filled = ty.fields.filter(fd => Checks.has(e.fields?.[fd.key]));
    const back = Idx.backlinks.get(e.id) || [];
    const groups = {};
    back.forEach(b => (groups[b.via] = groups[b.via] || []).push(b.from));
    const notes = (e.notes || []).filter(n => !n.kept);
    el.innerHTML = paneHead(`<span class="faint" style="font-size:14px">${ty.icon} ${esc(typeName(e.type))}</span>`, actions, pane) + `
      <div class="pane-body"><div class="wrap wide">
        <div class="entry-head"><h1 class="entry-title">${esc(e.title)}</h1></div>
        <div class="entry-meta">
          <span class="status ${e.status || "draft"}">${t({ canon: "Canon", draft: "Draft", scrapped: "Scrapped" }[e.status || "draft"])}</span>
          ${e.secret ? `<span class="status draft">🔒 ${tf("secret", "таен")}</span>` : ""}
          ${(e.aliases || []).length ? `<span>${tf("also", "също")}: ${e.aliases.map(esc).join(", ")}</span>` : ""}
          ${(e.tags || []).map(x => `<span class="chip" data-tag="${esc(x)}">#${esc(x)}</span>`).join("")}
          <span class="spacer"></span>
          <button class="chip" data-a="pin">${pinned ? "★ " + t("Unpin") : "☆ " + t("Pin")}</button>
          <span class="faint">${words(e.body)} ${t("words")} · ${t("Updated")} ${esc((e.updated || "").replace("T", " ").slice(0, 16))}</span>
        </div>
        <div class="entry-layout">
          <div>
            ${e.type === "map" ? `<div class="card" style="margin-bottom:14px"><div class="row"><b>${tf("Interactive map", "Интерактивна карта")}</b><span class="spacer"></span><button class="btn primary small" data-a="map">${tf("Open map", "Отвори картата")}</button></div></div>` : ""}
            <div class="md" data-body>${MD.render(e.body) || `<p class="faint">${tf("Nothing written yet. Press Edit (Ctrl+E) to start, or ✦ Ask me questions.", "Още нищо не е написано. Натиснете Редактирай (Ctrl+E) или ✦ Задай ми въпроси.")}</p>`}</div>
            ${notes.length ? `<div class="section-title">${t("Notes from question sessions")}</div>${notes.map(n => `<div class="notes-box" data-note="${n.id}">
              <div class="q">✦ ${esc(n.q)}</div><div>${esc(n.a)}</div>
              <div class="row" style="margin-top:6px"><button class="btn small" data-keep="${n.id}">${t("Keep in text")}</button><button class="btn small ghost" data-discard="${n.id}">${t("Discard")}</button></div></div>`).join("")}` : ""}
            ${e.secretNotes ? `<div class="section-title">🔒 ${t("Author-only notes")}</div><div class="md secret">${MD.render(e.secretNotes)}</div>` : ""}
          </div>
          <div class="entry-side">
            ${filled.length ? `<div class="card"><div class="fields">${filled.map(fd => `<div class="k">${esc(fieldLabel(fd))}</div><div class="v">${fieldValue(fd, e.fields[fd.key])}</div>`).join("")}</div></div>` : ""}
            <div class="card"><h3>${t("Images")}</h3>${gallery(e)}</div>
            ${derived(e)}
            <div class="card"><h3>${t("Links here")} <span class="faint small">${back.length || ""}</span></h3>
              ${back.length ? Object.entries(groups).map(([via, ids]) => `<div class="small faint" style="margin-top:4px">${esc(via === "text" ? tf("mentioned in", "споменато в") : via)}</div>${ids.map(id => chipFor(id)).join(" ")}`).join("") : `<div class="faint small">${t("Nothing links here yet.")}</div>`}
            </div>
          </div>
        </div>
      </div></div>`;
    bindImages(el, e);
    $$("[data-zoom]", el).forEach(i => i.onclick = () => lightbox(i.src));
    $$("[data-tag]", el).forEach(c => c.onclick = () => Panes.show({ view: "browse", tag: c.dataset.tag }, pane));
    el.querySelector('[data-a="edit"]').onclick = () => { editing.add(e.id); Panes.show({ view: "entry", id: e.id }, pane); };
    el.querySelector('[data-a="beside"]')?.addEventListener("click", () => open(e.id, true));
    el.querySelector('[data-a="ask"]').onclick = () => AI.startSession(e.id);
    el.querySelector('[data-a="map"]')?.addEventListener("click", () => Panes.show({ view: "map", id: e.id }, pane));
    el.querySelector('[data-a="pin"]').onclick = () => {
      const p = new Set(M.state.pinned || []); p.has(e.id) ? p.delete(e.id) : p.add(e.id); M.state.pinned = [...p]; saveState(); Panes.refresh(); Nav.render();
    };
    el.querySelector('[data-a="more"]').onclick = ev => moreMenu(ev.target, e, pane);
    $$("[data-keep]", el).forEach(b => b.onclick = () => keepNote(e, b.dataset.keep));
    $$("[data-discard]", el).forEach(b => b.onclick = async () => { const x = { ...e, notes: (e.notes || []).filter(n => n.id !== b.dataset.discard) }; await saveEntry(x, null, false); Panes.refresh(); });
  }

  async function keepNote(e, nid) {
    const n = (e.notes || []).find(x => x.id === nid); if (!n) return;
    const body = (e.body || "").trimEnd() + `\n\n${n.a}`;
    await saveEntry({ ...e, body, notes: e.notes.filter(x => x.id !== nid) });
    Panes.refresh(); toast(t("Saved"));
  }

  function moreMenu(anchor, e, pane) {
    const items = [
      ["writing", "✎ " + t("Writing mode")], ["history", "⟲ " + t("History")], ["used", "⌕ " + t("Where is this used?")],
      ["check", "⚖ " + t("Check this entry")], ["print", "⎙ " + t("Print / PDF")], ["export", "⇪ " + tf("Export as web page", "Експорт като уеб страница")],
      ["todo", "☐ " + tf("Add a to-do for this entry", "Добави задача към записа")], ["dup", "⧉ " + tf("Duplicate", "Дублирай")],
      M.world.templates?.[e.type]?.from === e.title ? ["untpl", "▭ " + tf("Stop using as template", "Спри да е шаблон")] : ["tpl", "▭ " + tf(`Use as template for new ${typeName(e.type)} entries`, `Шаблон за нови записи „${typeName(e.type)}“`)],
      ["delete", "🗑 " + t("Delete")],
    ];
    modal("", `<div class="list">${items.map(([k, l]) => `<div class="li" data-k="${k}">${l}</div>`).join("")}</div>`, {
      onOpen: (ov, close) => $$("[data-k]", ov).forEach(x => x.onclick = () => close(x.dataset.k)),
    }).then(async k => {
      if (k === "writing") writingMode(e.id);
      if (k === "history") historyBox(e.id);
      if (k === "used") whereUsed(e.id);
      if (k === "check") AI.checkEntry(e.id);
      if (k === "print") Exporter.print([e.id]);
      if (k === "export") Exporter.site([e.id], e.title);
      if (k === "todo") Todos.add(e.id);
      if (k === "tpl") Templates.setFrom(e);
      if (k === "untpl") Templates.clear(e.type);
      if (k === "dup") { const c = await createEntry(e.type, e.title + " (copy)", { fields: structuredClone(e.fields || {}), body: e.body, tags: e.tags }); open(c.id); }
      if (k === "delete" && await confirmBox(t("Delete this entry?") + " " + tf("It goes to the Trash (sidebar → Trash), where you can restore it.", "Отива в Кошчето (отстрани → Кошче), откъдето може да се възстанови."))) {
        await deleteEntry(e.id); Panes.show({ view: "dashboard" }, 0); if (pane === 1) Panes.closeSide();
      }
    });
  }

  // ---------- images
  function gallery(e) {
    return `<div class="gallery">${(e.images || []).map(f => `<div class="img" style="background-image:url('${img(f)}')" data-img="${esc(f)}"><button class="btn small danger rm" data-rm="${esc(f)}">✕</button></div>`).join("")}</div>
      <div class="dropzone" style="margin-top:8px" data-drop>${t("Drop images here or click")}</div>`;
  }
  async function upload(files) {
    const out = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      const r = await fetch("/api/upload?name=" + encodeURIComponent(file.name), { method: "POST", body: file });
      const d = await r.json(); if (d.file) out.push(d.file); else toast(d.error || "Upload failed", "error");
    }
    return out;
  }
  function bindImages(el, e) {
    const dz = $("[data-drop]", el); if (!dz) return;
    const add = async files => { const got = await upload(files); if (got.length) { const cur = M.entries.get(e.id); await saveEntry({ ...cur, images: [...(cur.images || []), ...got] }, null, false); Panes.refresh(); } };
    dz.onclick = () => { const i = document.createElement("input"); i.type = "file"; i.accept = "image/*"; i.multiple = true; i.onchange = () => add([...i.files]); i.click(); };
    dz.ondragover = ev => { ev.preventDefault(); dz.classList.add("over"); };
    dz.ondragleave = () => dz.classList.remove("over");
    dz.ondrop = ev => { ev.preventDefault(); dz.classList.remove("over"); add([...ev.dataTransfer.files]); };
    $$("[data-img]", el).forEach(d => d.onclick = ev => { if (!ev.target.closest("[data-rm]")) lightbox(img(d.dataset.img)); });
    $$("[data-rm]", el).forEach(b => b.onclick = async () => { const cur = M.entries.get(e.id); await saveEntry({ ...cur, images: (cur.images || []).filter(x => x !== b.dataset.rm) }, null, false); Panes.refresh(); });
  }

  // ---------- EDIT
  function edit(el, e, pane) {
    let draft = structuredClone(e);
    draft.fields = draft.fields || {};
    let committedTitle = e.title;
    const ty = () => typeOf(draft.type);
    const save = debounce(async () => { const s = await saveEntry(draft, null); draft.updated = s.updated; status.textContent = t("Saved"); }, 900);
    const changed = () => { status.textContent = "…"; save(); };

    el.innerHTML = paneHead(`<span class="faint" style="font-size:14px">${t("Edit")}</span>`,
      `<div class="row"><span class="faint small" id="st${pane}"></span><button class="btn small ghost" data-a="fromsel" title="Ctrl+Shift+L">⤷ ${tf("Selection → entry", "Избор → запис")}</button><button class="btn small ghost" data-a="writing">✎ ${t("Writing mode")}</button><button class="btn primary small" data-a="done" title="Ctrl+E">${t("Done")}</button></div>`, pane) + `
      <div class="pane-body"><div class="wrap wide">
        <input class="input" data-k="title" value="${esc(draft.title)}" style="font:600 26px var(--serif);padding:6px 10px;margin-bottom:10px" placeholder="${t("Title")}">
        <div class="entry-layout editing">
          <div>
            <div class="picker" style="position:relative">
              <textarea class="editor" data-k="body" spellcheck="true" placeholder="${tf("Write freely. Type [[ to link to another entry. Wrap author-only parts in :::secret … :::", "Пишете свободно. Напишете [[ за връзка към друг запис. Тайни части: :::secret … :::")}">${esc(draft.body || "")}</textarea>
            </div>
            <div class="faint small" style="margin:6px 2px 0">${tf("Formatting: # Heading · **bold** · *italic* · - list · > quote · [[Link]] · [[Link|shown text]]", "Форматиране: # Заглавие · **удебелено** · *курсив* · - списък · > цитат · [[Връзка]]")}</div>
            <div class="section-title">🔒 ${t("Author-only notes")}</div>
            <textarea class="input" data-k="secretNotes" rows="3" placeholder="${tf("Never included when you export or share.", "Никога не се включва при експорт.")}">${esc(draft.secretNotes || "")}</textarea>
          </div>
          <div class="entry-side">
            <div class="card"><div class="form-grid">
              <label>${t("Type")}</label><select class="input" data-k="type">${M.world.types.map(x => `<option value="${x.key}" ${x.key === draft.type ? "selected" : ""}>${x.icon} ${esc(typeName(x.key))}</option>`).join("")}</select>
              <label>${t("Status")}</label><select class="input" data-k="status">${["canon", "draft", "scrapped"].map(s => `<option value="${s}" ${s === (draft.status || "draft") ? "selected" : ""}>${t(s[0].toUpperCase() + s.slice(1))}</option>`).join("")}</select>
              <label>${t("Aliases")}</label><input class="input" data-k="aliases" value="${esc((draft.aliases || []).join(", "))}" placeholder="${tf("other names, comma separated", "други имена, със запетая")}">
              <label>${t("Tags")}</label><input class="input" data-k="tags" value="${esc((draft.tags || []).join(", "))}" placeholder="north, war, …">
              <label style="display:flex;gap:6px;align-items:center;padding-top:10px"><input type="checkbox" data-k="secret" ${draft.secret ? "checked" : ""}> ${t("Secret entry (never exported)")}</label>
            </div></div>
            <div class="card" data-fields></div>
          </div>
        </div>
      </div></div>`;
    const status = $(`#st${pane}`, el);
    const q = k => $(`[data-k="${k}"]`, el);
    q("title").oninput = () => { draft.title = q("title").value; changed(); };
    q("title").onblur = async () => {
      if (norm(draft.title) && norm(draft.title) !== norm(committedTitle)) {
        const old = committedTitle; committedTitle = draft.title;
        await saveEntry(draft, old);
      }
    };
    q("title").onkeydown = ev => { if (ev.key === "Enter") q("body").focus(); };
    const body = q("body");
    body.oninput = () => { draft.body = body.value; changed(); };
    linkAutocomplete(body);
    q("secretNotes").oninput = () => { draft.secretNotes = q("secretNotes").value; changed(); };
    q("type").onchange = () => { draft.type = q("type").value; renderFields(); changed(); };
    q("status").onchange = () => { draft.status = q("status").value; changed(); };
    q("aliases").oninput = () => { draft.aliases = q("aliases").value.split(",").map(x => x.trim()).filter(Boolean); changed(); };
    q("tags").oninput = () => { draft.tags = q("tags").value.split(",").map(x => x.trim().replace(/^#/, "")).filter(Boolean); changed(); };
    q("secret").onchange = () => { draft.secret = q("secret").checked; changed(); };

    function renderFields() {
      const box = $("[data-fields]", el);
      const fs = ty().fields;
      box.innerHTML = fs.length ? `<div class="form-grid">${fs.map(fd => `<label>${esc(fieldLabel(fd))}</label><div data-f="${fd.key}"></div>`).join("")}</div>` : `<div class="faint small">${tf("This type has no extra fields. You can add some in Settings → Types.", "Този вид няма допълнителни полета. Можете да добавите в Настройки → Видове.")}</div>`;
      fs.forEach(fd => fieldEditor($(`[data-f="${fd.key}"]`, box), fd, draft.fields[fd.key], v => { if (Checks.has(v)) draft.fields[fd.key] = v; else delete draft.fields[fd.key]; changed(); }, draft));
    }
    renderFields();
    const finish = async () => {
      save.flush?.();
      await saveEntry(draft, norm(draft.title) !== norm(committedTitle) ? committedTitle : null);
      editing.delete(e.id); Panes.show({ view: "entry", id: e.id }, pane);
    };
    el.querySelector('[data-a="done"]').onclick = finish;
    el.querySelector('[data-a="writing"]').onclick = async () => { await saveEntry(draft, null); writingMode(e.id, () => Panes.refresh()); };
    el._finish = finish;
    el.querySelector('[data-a="fromsel"]').onmousedown = ev => { ev.preventDefault(); entryFromSelection(body); };
    if (!e.body && e.title === t("Untitled")) setTimeout(() => { q("title").focus(); q("title").select(); }, 30); else setTimeout(() => body.focus(), 30);
  }

  // ---------- field editors
  function fieldEditor(box, fd, value, set, draft) {
    const kinds = {
      text: () => { box.innerHTML = `<input class="input" value="${esc(value || "")}" placeholder="${esc(fd.hint || "")}">`; $("input", box).oninput = ev => set(ev.target.value); },
      number: () => { box.innerHTML = `<input class="input" type="number" value="${esc(value ?? "")}">`; $("input", box).oninput = ev => set(ev.target.value === "" ? "" : +ev.target.value); },
      long: () => { box.innerHTML = `<textarea class="input" rows="3">${esc(value || "")}</textarea>`; $("textarea", box).oninput = ev => set(ev.target.value); linkAutocomplete($("textarea", box)); },
      list: () => { box.innerHTML = `<textarea class="input" rows="4" placeholder="${tf("one per line", "по един на ред")}">${esc(value || "")}</textarea>`; $("textarea", box).oninput = ev => set(ev.target.value); },
      steps: () => { box.innerHTML = `<textarea class="input" rows="5" placeholder="${tf("one step per line", "по една стъпка на ред")}">${esc(value || "")}</textarea>`; $("textarea", box).oninput = ev => set(ev.target.value); },
      select: () => { box.innerHTML = `<select class="input"><option value=""></option>${fd.options.map(o => `<option ${o === value ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`; $("select", box).onchange = ev => set(ev.target.value); },
      date: () => {
        box.innerHTML = `<input class="input" value="${esc(Cal.input(value))}" placeholder="${tf("e.g. 512 AF or 14.3.512 AF", "напр. 512 AF или 14.3.512 AF")}"><div class="faint small" style="margin-top:2px"></div>`;
        const i = $("input", box), hint = $("div", box);
        const show = v => { hint.textContent = v === null ? tf("Can't read this date", "Не мога да разчета датата") : v ? Cal.format(v) : ""; hint.style.color = v === null ? "var(--warn)" : ""; };
        show(value || "");
        i.oninput = () => { const v = Cal.parse(i.value); show(v); if (v !== null) set(v); };
      },
      link: () => linkPicker(box, value ? [value] : [], fd.to, ids => set(ids[ids.length - 1] || ""), true),
      links: () => linkPicker(box, value || [], fd.to, ids => set(ids)),
      relations: () => rows(box, value || [], set, (row, r, upd) => {
        row.innerHTML = `<select class="input" style="width:110px">${M.world.relationKinds.map(k => `<option ${k === r.kind ? "selected" : ""}>${k}</option>`).join("")}</select><div class="pk" style="flex:1"></div>`;
        $("select", row).onchange = ev => upd({ ...r, kind: ev.target.value });
        linkPicker($(".pk", row), r.to ? [r.to] : [], ["character", "entity", "creature"], ids => upd({ ...r, to: ids[ids.length - 1] || "" }), true);
      }, () => ({ kind: "friend", to: "" })),
      knowers: () => rows(box, value || [], set, (row, r, upd) => {
        row.innerHTML = `<div class="pk1" style="flex:1"></div><span class="faint small">${tf("since", "от")}</span><div class="pk2" style="flex:1"></div>`;
        linkPicker($(".pk1", row), r.who ? [r.who] : [], ["character", "faction", "entity"], ids => upd({ ...r, who: ids[ids.length - 1] || "" }), true);
        linkPicker($(".pk2", row), r.since ? [r.since] : [], ["event", "chapter"], ids => upd({ ...r, since: ids[ids.length - 1] || "" }), true);
      }, () => ({ who: "", since: "" })),
    };
    (kinds[fd.kind] || kinds.text)();
  }
  function rows(box, list, set, renderRow, blank) {
    let items = list.map(x => ({ ...x }));
    const draw = () => {
      box.innerHTML = `<div class="rows"></div><button class="btn small ghost" style="margin-top:4px">＋ ${t("Add")}</button>`;
      const wrap = $(".rows", box);
      items.forEach((r, i) => {
        const row = document.createElement("div"); row.className = "row"; row.style.marginBottom = "4px"; row.style.flexWrap = "nowrap";
        wrap.appendChild(row);
        renderRow(row, r, nv => { items[i] = nv; set(items.filter(x => x.to || x.who)); });
        const rm = document.createElement("button"); rm.className = "btn small ghost danger"; rm.textContent = "✕";
        rm.onclick = () => { items.splice(i, 1); set(items.filter(x => x.to || x.who)); draw(); }; row.appendChild(rm);
      });
      $("button.ghost:last-child", box).onclick = () => { items.push(blank()); draw(); };
    };
    draw();
  }

  // pick one or more entries, with "create new" from what you typed
  function linkPicker(box, ids, types, onChange, single = false) {
    let cur = [...ids].filter(Boolean);
    box.classList.add("picker");
    const draw = () => {
      box.innerHTML = `<div class="chips">${cur.map(id => chipFor(id, { x: true, missing: "?" })).join("")}</div>
        <input class="input" placeholder="${single && cur.length ? tf("change…", "смени…") : tf("type to find…", "пишете, за да намерите…")}">`;
      $$("[data-x]", box).forEach(x => x.onclick = ev => { ev.stopPropagation(); cur = cur.filter(i => i !== x.dataset.x); onChange(cur); draw(); });
      const input = $("input", box);
      suggestFor(input, box, types, id => { cur = single ? [id] : [...new Set([...cur, id])]; onChange(cur); draw(); $("input", box).focus(); });
    };
    draw();
  }
  function suggestFor(input, box, types, pick) {
    let list = null, sel = 0, items = [];
    const close = () => { list?.remove(); list = null; };
    const show = () => {
      const qv = norm(input.value);
      const pool = [...M.entries.values()].filter(e => !types?.length || types.includes(e.type));
      items = pool.filter(e => !qv || norm(e.title).includes(qv) || (e.aliases || []).some(a => norm(a).includes(qv)))
        .sort((a, b) => (norm(a.title).startsWith(qv) ? 0 : 1) - (norm(b.title).startsWith(qv) ? 0 : 1) || a.title.localeCompare(b.title)).slice(0, 12)
        .map(e => ({ id: e.id, label: e.title, type: e.type }));
      if (input.value.trim() && !items.some(i => norm(i.label) === qv)) items.push({ create: input.value.trim() });
      close(); if (!items.length) return;
      list = document.createElement("div"); list.className = "suggest";
      list.innerHTML = items.map((i, n) => i.create
        ? `<div data-n="${n}" class="${n === sel ? "on" : ""}">＋ ${tf("Create", "Създай")} “${esc(i.create)}”<small>${types?.[0] ? esc(typeName(types[0])) : ""}</small></div>`
        : `<div data-n="${n}" class="${n === sel ? "on" : ""}"><span class="type-dot" style="background:${typeOf(i.type).color}"></span>${esc(i.label)}<small>${esc(typeName(i.type))}</small></div>`).join("");
      box.appendChild(list);
      $$("[data-n]", list).forEach(d => d.onmousedown = ev => { ev.preventDefault(); choose(+d.dataset.n); });
    };
    const choose = async n => {
      const i = items[n]; if (!i) return; close();
      if (i.create) { const e = await createEntry(types?.[0] || "note", i.create); pick(e.id); } else pick(i.id);
    };
    input.onfocus = () => { sel = 0; show(); };
    input.oninput = () => { sel = 0; show(); };
    input.onblur = () => setTimeout(close, 120);
    input.onkeydown = ev => {
      if (!list) return;
      if (ev.key === "ArrowDown") { sel = Math.min(sel + 1, items.length - 1); show(); ev.preventDefault(); }
      if (ev.key === "ArrowUp") { sel = Math.max(sel - 1, 0); show(); ev.preventDefault(); }
      if (ev.key === "Enter") { ev.preventDefault(); choose(sel); }
      if (ev.key === "Escape") close();
    };
  }

  // [[ autocomplete inside any textarea
  function caretXY(ta) {
    const div = document.createElement("div"); const cs = getComputedStyle(ta);
    for (const p of ["fontFamily", "fontSize", "fontWeight", "lineHeight", "padding", "border", "width", "letterSpacing", "wordWrap", "whiteSpace"]) div.style[p] = cs[p];
    Object.assign(div.style, { position: "absolute", visibility: "hidden", whiteSpace: "pre-wrap", wordWrap: "break-word", top: 0, left: 0 });
    div.textContent = ta.value.slice(0, ta.selectionStart); const span = document.createElement("span"); span.textContent = "|"; div.appendChild(span);
    document.body.appendChild(div); const x = span.offsetLeft, y = span.offsetTop; div.remove();
    return { x, y: y - ta.scrollTop + parseFloat(cs.lineHeight || 20) };
  }
  function linkAutocomplete(ta) {
    let list = null, items = [], sel = 0, start = -1;
    const close = () => { list?.remove(); list = null; };
    const box = ta.parentElement; if (getComputedStyle(box).position === "static") box.style.position = "relative";
    const show = () => {
      const before = ta.value.slice(0, ta.selectionStart);
      const m = before.match(/\[\[([^\]\[\n|]{0,40})$/);
      if (!m) return close();
      start = ta.selectionStart - m[1].length;
      const qv = norm(m[1]);
      items = [...M.entries.values()].filter(e => !qv || norm(e.title).includes(qv) || (e.aliases || []).some(a => norm(a).includes(qv)))
        .sort((a, b) => (norm(a.title).startsWith(qv) ? 0 : 1) - (norm(b.title).startsWith(qv) ? 0 : 1)).slice(0, 8);
      if (m[1].trim() && !items.some(e => norm(e.title) === qv)) items.push({ newTitle: m[1].trim() });
      close(); if (!items.length) return;
      list = document.createElement("div"); list.className = "suggest";
      const p = caretXY(ta);
      Object.assign(list.style, { left: Math.min(p.x + ta.offsetLeft, box.clientWidth - 280) + "px", top: (p.y + ta.offsetTop + 4) + "px", right: "auto", width: "280px" });
      list.innerHTML = items.map((e, n) => e.newTitle ? `<div data-n="${n}" class="${n === sel ? "on" : ""}">＋ ${tf("Link to new", "Връзка към нов")} “${esc(e.newTitle)}”</div>`
        : `<div data-n="${n}" class="${n === sel ? "on" : ""}"><span class="type-dot" style="background:${typeOf(e.type).color}"></span>${esc(e.title)}<small>${esc(typeName(e.type))}</small></div>`).join("");
      box.appendChild(list);
      $$("[data-n]", list).forEach(d => d.onmousedown = ev => { ev.preventDefault(); choose(+d.dataset.n); });
    };
    const choose = n => {
      const e = items[n]; if (!e) return;
      const title = e.newTitle || e.title;
      const after = ta.value.slice(ta.selectionStart).replace(/^[^\]\n]*\]\]/, "");
      ta.value = ta.value.slice(0, start) + title + "]]" + after;
      const pos = start + title.length + 2; ta.setSelectionRange(pos, pos);
      ta.dispatchEvent(new Event("input")); close();
    };
    ta.addEventListener("input", () => { sel = 0; show(); });
    ta.addEventListener("keydown", ev => {
      if (!list) return;
      if (ev.key === "ArrowDown") { sel = Math.min(sel + 1, items.length - 1); show(); ev.preventDefault(); }
      else if (ev.key === "ArrowUp") { sel = Math.max(sel - 1, 0); show(); ev.preventDefault(); }
      else if (ev.key === "Enter" || ev.key === "Tab") { ev.preventDefault(); choose(sel); }
      else if (ev.key === "Escape") { ev.stopPropagation(); close(); }
    });
    ta.addEventListener("blur", () => setTimeout(close, 150));
  }

  // ---------- writing mode
  function writingMode(id, after) {
    const e = M.entries.get(id); if (!e) return;
    const startWords = words(e.body);
    const d = document.createElement("div"); d.className = "writing";
    d.innerHTML = `<div class="picker" style="flex:1;display:flex;width:100%;justify-content:center"><textarea spellcheck="true">${esc(e.body || "")}</textarea></div>
      <div class="bar"><span>${esc(e.title)}</span><span data-wc></span><span>Esc ${tf("to leave", "за изход")}</span></div>`;
    document.body.appendChild(d);
    const ta = $("textarea", d), wc = $("[data-wc]", d);
    const upd = () => { const n = words(ta.value); wc.textContent = `${n} ${t("words")} · ${n - startWords >= 0 ? "+" : ""}${n - startWords} ${tf("this session", "тази сесия")}`; };
    let cur = e;
    const save = debounce(async () => { cur = await saveEntry({ ...M.entries.get(id), body: ta.value }); }, 1000);
    ta.oninput = () => { upd(); save(); };
    linkAutocomplete(ta); upd(); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
    const key = async ev => { if (ev.key === "Escape" && !$(".suggest", d)) { document.removeEventListener("keydown", key, true); await saveEntry({ ...M.entries.get(id), body: ta.value }); d.remove(); after ? after() : Panes.refresh(); } };
    document.addEventListener("keydown", key, true);
  }

  // ---------- version history
  async function historyBox(id) {
    const vs = await api("history/" + id);
    const cur = M.entries.get(id);
    const label = v => v.v.replace(/^(\d{4})(\d\d)(\d\d)-(\d\d)(\d\d)(\d\d)$/, "$3.$2.$1 $4:$5");
    if (!vs.length) return modal(t("History"), `<div class="empty">${tf("No older versions yet. A version is kept every time you change the entry (at most one per 10 minutes).", "Още няма стари версии. Пази се версия при всяка промяна (най-много една на 10 минути).")}</div>`, { buttons: [{ label: t("Close") }] });
    modal(t("History") + " — " + cur.title, `<div class="row" style="align-items:flex-start;flex-wrap:nowrap;gap:14px">
      <div class="list" style="width:190px;flex:0 0 auto;max-height:55vh;overflow:auto">${vs.map((v, i) => `<div class="li ${i === 0 ? "on" : ""}" data-v="${v.v}">${label(v)}</div>`).join("")}</div>
      <div style="flex:1;min-width:0"><div class="faint small" style="margin-bottom:6px">${tf("Changes from that version to now:", "Промени от тази версия до сега:")}</div><div class="diff" data-diff></div>
      <div class="row" style="margin-top:8px"><span class="spacer"></span><button class="btn primary small" data-restore>${t("Restore")}</button></div></div></div>`, {
      wide: true, buttons: [{ label: t("Close") }],
      onOpen: (ov, close) => {
        let chosen = null;
        const load = async v => {
          $$("[data-v]", ov).forEach(x => x.style.background = x.dataset.v === v ? "var(--accent-soft)" : "");
          chosen = await api(`history/${id}/${v}`);
          $("[data-diff]", ov).innerHTML = diff(`# ${chosen.title}\n${chosen.body || ""}`, `# ${cur.title}\n${cur.body || ""}`);
        };
        $$("[data-v]", ov).forEach(x => x.onclick = () => load(x.dataset.v));
        load(vs[0].v);
        $("[data-restore]", ov).onclick = async () => {
          if (!chosen) return;
          const { body, ...rest } = chosen;
          await saveEntry({ ...rest, body, id }, null, true);
          close(); Panes.refresh(); toast(tf("Version restored. The version before it was kept too.", "Версията е възстановена. Предишната също е запазена."));
        };
      },
    });
  }
  function diff(a, b) {     // line diff (LCS)
    const A = a.split("\n"), B = b.split("\n");
    const n = A.length, m = B.length;
    if (n * m > 400000) return esc(b);
    const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const out = []; let i = 0, j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && A[i] === B[j]) { out.push(esc(A[i]) + "\n"); i++; j++; }
      else if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) { out.push(`<span class="add">${esc(B[j]) || " "}</span>`); j++; }
      else { out.push(`<span class="del">${esc(A[i]) || " "}</span>`); i++; }
    }
    return out.join("");
  }

  // ---------- where is this used (+ unlinked mentions)
  function whereUsed(id) {
    const e = M.entries.get(id);
    const back = Idx.backlinks.get(id) || [];
    const names = [e.title, ...(e.aliases || [])].filter(n => n.length > 2);
    const mentions = [];
    for (const o of M.entries.values()) {
      if (o.id === id) continue;
      const plain = (o.body || "").replace(/\[\[[^\]]*\]\]/g, " ");
      for (const n of names) {
        const rx = new RegExp(`(^|[^\\p{L}])(${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?=[^\\p{L}]|$)`, "iu");
        const mm = plain.match(rx);
        if (mm) { const at = mm.index; mentions.push({ id: o.id, name: n, snippet: plain.slice(Math.max(0, at - 50), at + 70).replace(/\s+/g, " ") }); break; }
      }
    }
    modal(t("Where is this used?") + " — " + e.title, `
      <div class="section-title" style="margin-top:0">${t("Links here")} (${back.length})</div>
      ${back.length ? back.map(b => `<div class="li" data-go="${b.from}"><div class="main"><div class="t">${esc(titleOf(b.from))}</div><div class="d">${esc(b.via === "text" ? tf("linked in the text", "връзка в текста") : b.via)}</div></div></div>`).join("") : `<div class="faint">${t("Nothing links here yet.")}</div>`}
      <div class="section-title">${t("Mentioned without a link")} (${mentions.length})</div>
      ${mentions.length ? mentions.map(m => `<div class="li"><div class="main" data-go="${m.id}"><div class="t">${esc(titleOf(m.id))}</div><div class="d">…${esc(m.snippet)}…</div></div><button class="btn small" data-link="${m.id}" data-name="${esc(m.name)}">${tf("Link it", "Свържи")}</button></div>`).join("") : `<div class="faint">—</div>`}
      <div class="faint small" style="margin-top:14px">${tf("Renaming this entry updates every [[link]] to it automatically.", "Преименуването обновява автоматично всички [[връзки]] към него.")}</div>`,
      { wide: true, buttons: [{ label: t("Close") }], onOpen: (ov, close) => {
        $$("[data-go]", ov).forEach(x => x.onclick = () => { close(); open(x.dataset.go); });
        $$("[data-link]", ov).forEach(b => b.onclick = async () => {
          const o = M.entries.get(b.dataset.link); const n = b.dataset.name;
          const rx = new RegExp(`(^|[^\\p{L}\\[])(${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?=[^\\p{L}\\]]|$)`, "iu");
          const body = o.body.replace(rx, (all, pre, word) => `${pre}[[${e.title}${word === e.title ? "" : "|" + word}]]`);
          await saveEntry({ ...o, body }); b.textContent = "✓"; b.disabled = true;
        });
      } });
  }

  return { view, editing, writingMode, historyBox, whereUsed, linkPicker, linkAutocomplete, relationsOf, upload };
})();
Views.entry = Entry.view;
