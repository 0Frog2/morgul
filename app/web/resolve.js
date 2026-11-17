// Resolving a contradiction: a window asks how it was resolved, with suggestions that fit the kind of contradiction
// (and more from the AI helper if it's on). The answer is kept with the contradiction, and can become a to-do,
// an author-only note on both entries, or an alias. Nothing in the text changes by itself: the author decides canon.
"use strict";

const Resolve = {
  kind: c => (c.key.match(/^rule:([a-z-]+):/) || [])[1] || (c.source === "ai" ? "ai" : "other"),
  // [id, English, Bulgarian, action] — {A} / {B} are the two entry names
  suggestions(c, mode) {
    const k = Resolve.kind(c), two = c.a?.id && c.b?.id && c.a.id !== c.b.id;
    if (mode === "intentional") return [
      ["liar", "Someone in the story is lying or mistaken; the reader finds out later.", "Някой в историята лъже или греши; читателят ще разбере по-късно."],
      ["legend", "The two accounts are different legends or sources inside the world.", "Двете версии са различни легенди или източници в света."],
      ["mystery", "It is a mystery I will reveal later.", "Това е загадка, която ще разкрия по-късно."],
      ["magic", "Magic or the entities explain it.", "Магията или съществата го обясняват."],
    ];
    const date = ["after-death", "alive-but-died", "died-before-born", "before-birth", "before-founded", "ends-before", "cause-after", "parent-age", "parent-dead"].includes(k);
    const out = [];
    if (two) out.push(["a-right", "“{A}” is right; I will change “{B}”.", "„{A}“ е вярно; ще променя „{B}“.", "todo-b"], ["b-right", "“{B}” is right; I will change “{A}”.", "„{B}“ е вярно; ще променя „{A}“.", "todo-a"]);
    if (date) out.push(["date", "One of the dates was wrong, and I have corrected it.", "Една от датите беше грешна и я поправих."],
      ["other-person", "It was someone else with the same name.", "Беше друг човек със същото име."],
      ["returned", "They came back: undead, a spirit, or brought back by magic.", "Върна се: като нежить, дух или с магия."],
      ["records", "The records in the world are wrong; the truth is known to few.", "Записите в света грешат; истината знаят малцина."]);
    if (k === "same-name") out.push(["different", "They are two different things that share a name.", "Това са две различни неща със същото име."],
      ["same", "They are the same thing; I will merge them.", "Това е едно и също; ще ги обединя.", "todo-merge"]);
    if (k === "script-name") out.push(["alias", "Same thing: add “{B}” as another name of “{A}”.", "Едно и също: добави „{B}“ като друго име на „{A}“.", "alias"],
      ["different", "They are two different things.", "Това са две различни неща."]);
    if (k === "loop") out.push(["chain", "I have fixed which place is inside which.", "Поправих кое място в кое е."]);
    if (k === "missing-ingredient") out.push(["make", "I will make an entry for the missing ingredient.", "Ще създам запис за липсващата съставка.", "todo-make"],
      ["renamed", "It is the same ingredient under another name.", "Това е същата съставка под друго име."]);
    out.push(["both-true", "Both are true. Here is how:", "И двете са верни. Ето как:"],
      ["fixed", "I have already fixed it in the text.", "Вече го поправих в текста."],
      ["dropped", "It no longer matters: one of them was dropped.", "Вече няма значение: едното отпадна."]);
    return out;
  },
  fill: (s, c) => s.replaceAll("{A}", titleOf(c.a?.id) || "A").replaceAll("{B}", titleOf(c.b?.id) || "B"),
  async aiIdeas(c) {
    const lang = M.settings.language === "bg" ? "Write in Bulgarian." : "Write in the same language as the passages.";
    const r = await api("ai/chat", { temperature: 0.7, format: { type: "object", properties: { ideas: { type: "array", items: { type: "string" } } }, required: ["ideas"] },
      messages: [{ role: "system", content: `You help a fiction writer resolve contradictions in their world${M.world?.about ? ` (${M.world.about})` : ""}. Suggest ways it COULD be resolved; the author decides. Each idea is one or two sentences, concrete, fitting the world. ${lang} Answer as JSON: {"ideas": ["…", "…", "…"]}` },
        { role: "user", content: `Contradiction: ${c.why}\nPassage A${c.a?.id ? ` (${titleOf(c.a.id)})` : ""}: ${c.a?.text || ""}\nPassage B${c.b?.id ? ` (${titleOf(c.b.id)})` : ""}: ${c.b?.text || ""}\nGive 3 different ideas.` }] });
    try { return (JSON.parse(r.content).ideas || []).slice(0, 4); } catch { const m = String(r.content).match(/\{[\s\S]*\}/); try { return JSON.parse(m[0]).ideas.slice(0, 4); } catch { return []; } }
  },
  async open(key, mode = "resolved") {
    const c = Checks.contradictions().find(x => x.key === key); if (!c) return;
    const two = c.a?.id && c.b?.id && c.a.id !== c.b.id, sugg = Resolve.suggestions(c, mode);
    let picked = null;
    const res = await modal(mode === "intentional" ? tf("Why is it intentional?", "Защо е нарочно?") : tf("How was it resolved?", "Как беше решено?"), `
      <div class="small" style="margin-bottom:8px"><b>${esc(c.why)}</b></div>
      <div class="pair" style="margin-bottom:10px">${[c.a, c.b].map(s => `<div class="quote">${s?.id ? `<b>${esc(titleOf(s.id))}:</b> ` : ""}${esc(s?.text || "")}</div>`).join("")}</div>
      <div class="section-sub" style="margin-top:0">${tf("Suggestions — pick one, or write your own", "Предложения — изберете или напишете свое")}</div>
      <div class="res-sugg" data-sugg>${sugg.map(([id, en, bg]) => `<button class="res-opt" data-id="${id}">${esc(Resolve.fill(tf(en, bg), c))}</button>`).join("")}</div>
      ${M.settings.ai_enabled ? `<button class="btn small ghost" data-ai style="margin-top:6px">✦ ${tf("More ideas from the AI", "Още идеи от AI")}</button>` : ""}
      <div class="section-sub">${tf("How it is resolved (kept with the contradiction)", "Как е решено (пази се с противоречието)")}</div>
      <textarea class="input" data-note rows="3" placeholder="${tf("In your own words…", "С ваши думи…")}">${esc(c.resolution?.note || "")}</textarea>
      <div class="res-acts" style="margin-top:8px">
        ${two ? `<label class="small" style="display:block"><input type="checkbox" data-addnote> ${tf("Also add it to both entries as an author-only note", "Добави го и в двата записа като бележка само за автора")}</label>` : ""}
        <label class="small" style="display:block" data-todo-row hidden><input type="checkbox" data-todo checked> <span data-todo-txt></span></label>
        <label class="small" style="display:block" data-alias-row hidden><input type="checkbox" data-alias checked> <span data-alias-txt></span></label>
      </div>`, { wide: true,
      buttons: [{ label: t("Cancel"), value: null }, { label: mode === "intentional" ? tf("Mark as intentional", "Отбележи като нарочно") : tf("Mark as resolved", "Отбележи като решено"), cls: "primary",
        value: ov => ({ note: $("[data-note]", ov).value.trim(), picked, addNote: $("[data-addnote]", ov)?.checked, todoAct: ov._todo, todo: !$("[data-todo-row]", ov).hidden && $("[data-todo]", ov).checked, alias: !$("[data-alias-row]", ov).hidden && $("[data-alias]", ov).checked }) }],
      onOpen: ov => {
        const note = $("[data-note]", ov);
        const choose = (b, text, act) => {
          $$(".res-opt", ov).forEach(x => x.classList.toggle("on", x === b)); picked = b.dataset.id;
          note.value = text + (picked === "both-true" ? " " : ""); note.focus(); note.selectionStart = note.selectionEnd = note.value.length;
          const todoText = { "todo-a": tf(`Add a to-do: change “${titleOf(c.a?.id)}”`, `Добави задача: промени „${titleOf(c.a?.id)}“`), "todo-b": tf(`Add a to-do: change “${titleOf(c.b?.id)}”`, `Добави задача: промени „${titleOf(c.b?.id)}“`),
            "todo-merge": tf(`Add a to-do: merge “${titleOf(c.a?.id)}” and “${titleOf(c.b?.id)}”`, `Добави задача: обедини „${titleOf(c.a?.id)}“ и „${titleOf(c.b?.id)}“`),
            "todo-make": tf("Add a to-do: make the missing ingredient's entry", "Добави задача: създай запис за съставката") }[act];
          $("[data-todo-row]", ov).hidden = !todoText; if (todoText) { $("[data-todo-txt]", ov).textContent = todoText; ov._todo = { act, text: todoText.replace(/^[^:]+:\s*/, "") }; }
          $("[data-alias-row]", ov).hidden = act !== "alias";
          if (act === "alias") $("[data-alias-txt]", ov).textContent = tf(`Do it now: add “${titleOf(c.b?.id)}” as another name of “${titleOf(c.a?.id)}”`, `Направи го сега: добави „${titleOf(c.b?.id)}“ като друго име на „${titleOf(c.a?.id)}“`);
        };
        $$(".res-opt", ov).forEach(b => { const s = sugg.find(x => x[0] === b.dataset.id); b.onclick = () => choose(b, Resolve.fill(tf(s[1], s[2]), c), s[3]); });
        $("[data-ai]", ov)?.addEventListener("click", async ev => {
          const btn = ev.currentTarget; btn.disabled = true; btn.textContent = tf("✦ Thinking…", "✦ Мисля…");
          try {
            const ideas = await Resolve.aiIdeas(c);
            ideas.forEach(t2 => { const b = document.createElement("button"); b.className = "res-opt ai"; b.dataset.id = "ai"; b.textContent = "✦ " + t2; b.onclick = () => choose(b, t2); $("[data-sugg]", ov).append(b); });
            btn.remove();
          } catch (err) { btn.disabled = false; btn.textContent = "✦ " + err.message; }
        });
      } });
    if (!res) return false;
    // keep the answer with the contradiction
    const note = res.note || (mode === "intentional" ? tf("Intentional.", "Нарочно.") : tf("Resolved.", "Решено."));
    M.state.issueNotes = { ...(M.state.issueNotes || {}), [key]: { note, how: res.picked || "own", date: localStamp(), mode } };
    Checks.setStatus(key, mode);
    if (res.addNote) for (const id of [c.a?.id, c.b?.id]) {
      const e = M.entries.get(id); if (!e) continue;
      const line = `**${mode === "intentional" ? tf("Intentional contradiction", "Нарочно противоречие") : tf("Resolved contradiction", "Решено противоречие")}** (${new Date().toISOString().slice(0, 10)}): ${c.why} — ${note}`;
      await saveEntry({ ...e, secretNotes: [e.secretNotes, line].filter(Boolean).join("\n\n") }, null, true);
    }
    const td = res.todoAct;
    if (res.todo && td) {
      const target = td.act === "todo-a" ? c.a?.id : td.act === "todo-b" ? c.b?.id : c.a?.id || "";
      Todos.all().unshift({ id: uid(), text: `${td.text[0].toUpperCase()}${td.text.slice(1)} — ${c.why}`, kind: td.act === "todo-make" ? "write" : "fix", entry: target || "", done: false, created: localStamp() }); saveState();
    }
    if (res.alias && c.a?.id && c.b?.id) {
      const a = M.entries.get(c.a.id), bTitle = titleOf(c.b.id);
      if (a && !(a.aliases || []).includes(bTitle)) await saveEntry({ ...a, aliases: [...(a.aliases || []), bTitle] }, null, true);
      toast(tf(`Added “${bTitle}” as another name. You can delete the “${bTitle}” entry yourself if it is now empty.`, `„${bTitle}“ е добавено като друго име. Може сами да изтриете записа „${bTitle}“, ако вече е празен.`));
    }
    Nav.render(); return true;
  },
};

// the contradictions page: Resolved and Intentional open the window; resolved ones show how
(() => {
  const view = Views.contradictions;
  Views.contradictions = (el, r, pane) => {
    view(el, r, pane);
    const list = $("[data-list]", el);
    const enhance = () => {
      $$("[data-s]", el).forEach(b => {
        if (b.dataset.s !== "resolved" && b.dataset.s !== "intentional") return;
        b.onclick = async () => { if (await Resolve.open(b.dataset.k, b.dataset.s)) Panes.refresh(pane); };
      });
      const notes = M.state.issueNotes || {};
      $$(".issue", el).forEach(card => {
        const k = card.querySelector("[data-k]")?.dataset.k, n = k && notes[k];
        if (!n || card.querySelector(".res-note") || !/resolved|intentional/.test(card.className)) return;
        const d = document.createElement("div"); d.className = "res-note small";
        d.innerHTML = `<b>${n.mode === "intentional" ? tf("Why it is intentional", "Защо е нарочно") : tf("How it was resolved", "Как беше решено")}</b> · <span class="faint">${esc(niceStamp(n.date))}</span><div>${esc(n.note)}</div>`;
        card.querySelector(".pair").after(d);
      });
    };
    new MutationObserver(enhance).observe(list, { childList: true }); enhance();
  };
})();
