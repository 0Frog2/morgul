// Saved answers: every answer from question sessions, from every entry, in one place to keep or discard.
"use strict";

const Answers = {
  all() {        // [{e, n}] newest first
    const out = [];
    for (const e of M.entries.values()) for (const n of e.notes || []) if (!n.kept) out.push({ e, n });
    return out.sort((a, b) => String(b.n.at || "").localeCompare(String(a.n.at || "")));
  },
  count: () => Answers.all().length,
  async keep(id, nid) {
    const e = M.entries.get(id), n = (e?.notes || []).find(x => x.id === nid); if (!n) return;
    await saveEntry({ ...e, body: (e.body || "").trimEnd() + `\n\n${n.a}`, notes: e.notes.filter(x => x.id !== nid) });
  },
  async discard(id, nid) {
    const e = M.entries.get(id); if (!e) return;
    await saveEntry({ ...e, notes: (e.notes || []).filter(x => x.id !== nid) }, null, false);
  },
};

Views.answers = (el, r, pane) => {
  let type = M.state.ansType || "", q = "";
  el.innerHTML = paneHead(`✎ ${tf("Saved answers", "Запазени отговори")}`, "", pane) + `<div class="pane-body"><div class="wrap">
    <p class="muted">${tf("Your answers to Morgul's questions, from every entry. Nothing here is part of your text yet. <b>Keep in text</b> adds an answer to the end of its entry; <b>Discard</b> throws it away. <b>Open</b> shows the entry beside this list.", "Отговорите ви на въпросите на Morgul от всички записи. Нищо тук още не е част от текста. <b>Запази в текста</b> добавя отговора в края на записа; <b>Отхвърли</b> го изхвърля. <b>Отвори</b> показва записа до списъка.")}</p>
    <div class="row" style="margin-bottom:12px"><select class="input" data-type style="width:auto"></select><input class="input" data-q placeholder="${tf("Search answers…", "Търсене в отговорите…")}" style="max-width:280px"><span class="spacer"></span><span class="faint small" data-n></span></div>
    <div data-list></div></div></div>`;
  const draw = () => {
    const all = Answers.all(), types = [...new Set(all.map(x => x.e.type))];
    $("[data-type]", el).innerHTML = `<option value="">${tf("All types", "Всички видове")}</option>` + types.map(k => `<option value="${k}" ${k === type ? "selected" : ""}>${esc(typeName(k))}</option>`).join("");
    const ql = q.toLowerCase();
    const shown = all.filter(x => (!type || x.e.type === type) && (!ql || (x.n.q + " " + x.n.a + " " + x.e.title).toLowerCase().includes(ql)));
    $("[data-n]", el).textContent = `${shown.length} ${tf("waiting", shown.length === 1 ? "чака" : "чакат")}`;
    const groups = new Map(); shown.forEach(x => (groups.get(x.e.id) || groups.set(x.e.id, []).get(x.e.id)).push(x));
    $("[data-list]", el).innerHTML = groups.size ? [...groups.values()].map(list => { const e = list[0].e;
      return `<div class="card ans-group"><div class="row"><span style="color:${typeOf(e.type).color}">${typeOf(e.type).icon}</span><b class="ans-title" data-open="${e.id}">${esc(e.title)}</b><span class="faint small">${esc(typeName(e.type))} · ${list.length}</span>
          <span class="spacer"></span><button class="btn small ghost" data-beside="${e.id}">${tf("Open", "Отвори")} ⇥</button></div>
        ${list.map(({ n }) => `<div class="notes-box"><div class="q">✦ ${esc(n.q)}</div><div>${esc(n.a)}</div>
          <div class="row" style="margin-top:6px"><button class="btn small" data-keep="${e.id}|${n.id}">${t("Keep in text")}</button><button class="btn small ghost" data-discard="${e.id}|${n.id}">${t("Discard")}</button>
          <span class="spacer"></span><span class="faint small">${esc(niceStamp(n.at))}</span></div></div>`).join("")}</div>`; }).join("")
      : `<div class="empty">${all.length ? tf("Nothing matches.", "Нищо не съвпада.") : tf("No saved answers waiting. Answer questions from “I'm stuck” or “Ask me questions” on an entry, and they collect here.", "Няма чакащи отговори. Отговорете на въпроси от „Блокирах“ или „Задай ми въпроси“ и те ще се съберат тук.")}</div>`;
    $$("[data-beside]", el).forEach(b => b.onclick = () => Panes.show({ view: "entry", id: b.dataset.beside }, pane === 0 ? 1 : 0));
    $$("[data-keep]", el).forEach(b => b.onclick = async () => { const [id, nid] = b.dataset.keep.split("|"); await Answers.keep(id, nid); toast(tf("Added to the end of the entry.", "Добавено в края на записа.")); after(); });
    $$("[data-discard]", el).forEach(b => b.onclick = async () => {
      if (!await confirmBox(tf("Throw this answer away? It is not in your text, so it will be gone.", "Да изхвърля ли този отговор? Не е в текста, така че ще изчезне."), t("Discard"))) return;
      const [id, nid] = b.dataset.discard.split("|"); await Answers.discard(id, nid); after(); });
  };
  const after = () => { draw(); Nav.render(); Panes.cur.forEach((c, i) => { if (c?.view === "entry" && i !== pane) Panes.refresh(i); }); };
  $("[data-type]", el).onchange = e => { type = e.target.value; M.state.ansType = type; saveState(); draw(); };
  $("[data-q]", el).oninput = e => { q = e.target.value; draw(); };
  draw();
};

// a reminder card on I'm stuck
(() => {
  const view = Views.stuck;
  Views.stuck = (el, r, pane) => {
    view(el, r, pane);
    const n = Answers.count(); if (!n) return;
    const c = document.createElement("div"); c.className = "card ans-remind";
    c.innerHTML = `<div class="row"><span>✎</span><div style="flex:1"><b>${n} ${n === 1 ? tf("saved answer is waiting", "запазен отговор чака") : tf("saved answers are waiting", "запазени отговора чакат")}</b><div class="faint small">${tf("Keep them in your text or discard them.", "Запазете ги в текста или ги отхвърлете.")}</div></div><button class="btn small primary">${tf("Review", "Прегледай")}</button></div>`;
    $("button", c).onclick = () => Panes.show({ view: "answers" }, pane);
    $(".pane-body .wrap", el)?.prepend(c);
  };
})();
