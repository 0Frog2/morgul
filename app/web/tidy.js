// Tidy up: the AI turns rambling into tidy text (paragraphs, headings, lists, spelling) without adding or dropping anything.
// You see both side by side; Morgul itself checks that every name, number, date and link is still there.
// Nothing changes until you accept, and in an entry the old text is kept in its history.
"use strict";

const Tidy = {
  prompt() {
    return `You are a careful copy editor for a fiction writer's worldbuilding notes${M.world?.name ? ` for the world "${M.world.name}"` : ""}.
Clean up the text the author gives you:
- Fix spelling, grammar and punctuation.
- Split it into short paragraphs. Put sentences about the same thing together.
- Where it helps, add short "### " headings and use "- " bullet lists for lists of things.
- Keep the author's voice, their invented words and names exactly as written.
- Keep the SAME LANGUAGE as the text (English stays English, Bulgarian stays Bulgarian). Never translate.
- Do NOT add any fact, explanation, example or opinion. Do NOT remove or summarize anything: every fact, name, number and date must still be there.
- Keep every [[link]] exactly as written, and keep every ":::secret" … ":::" block, with its content, exactly.
- Output ONLY the cleaned text in Markdown. No introduction, no comments, no code fences.`;
  },
  chunks(text) {           // long texts go in parts of about 2,500 characters, split between paragraphs
    const paras = text.split(/\n\s*\n/), out = []; let cur = "";
    for (const p of paras) { if (cur && (cur + "\n\n" + p).length > 2500) { out.push(cur); cur = p; } else cur = cur ? cur + "\n\n" + p : p; }
    if (cur) out.push(cur); return out;
  },
  // what Morgul (not the AI) checks: names, numbers and dates, links, secrets
  missing(before, after) {
    const low = after.toLowerCase(), out = [];
    const add = (kind, x) => { if (!out.some(o => o.x.toLowerCase() === x.toLowerCase())) out.push({ kind, x }); };
    for (const m of before.matchAll(/\[\[([^\]]+)\]\]/g)) if (!after.includes(m[0])) add(tf("link", "връзка"), m[0]);
    for (const m of before.matchAll(/\d+(?:[.,:/]\d+)*(?:\s*(?:[A-ZА-Я]{1,3}\b))?/g)) if (!low.includes(m[0].toLowerCase()) && !low.includes(m[0].replace(/\s+/g, " ").split(" ")[0])) add(tf("number or date", "число или дата"), m[0]);
    // capitalised words that are not the first word of a sentence: names
    for (const m of before.matchAll(/(?<![.!?…:]\s|^|\n|["“„(])\b(\p{Lu}[\p{L}'’-]{2,})/gu)) if (!low.includes(m[1].toLowerCase())) add(tf("name", "име"), m[1]);
    const secrets = s => (s.match(/:::secret/g) || []).length;
    if (secrets(after) < secrets(before)) add(tf("secret block", "таен блок"), ":::secret");
    return out;
  },
  words: s => (String(s).match(/[\p{L}\p{N}]+/gu) || []).length,
  async ask(text, onText) {
    const r = await fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "system", content: Tidy.prompt() }, { role: "user", content: text }], temperature: 0.2 }) });
    if (!r.ok) { let m = "AI error"; try { m = (await r.json()).error; } catch {} throw new Error(m); }
    const rd = r.body.getReader(), dec = new TextDecoder(); let all = "";
    for (;;) { const { done, value } = await rd.read(); if (done) break; all += dec.decode(value, { stream: true }); onText?.(all); if (Tidy.stop) { rd.cancel(); break; } }
    return all.replace(/^\s*```(?:markdown|md)?\s*\n?/i, "").replace(/\n?```\s*$/, "").trim();
  },
  async run(ta) {
    if (!M.settings.ai_enabled) return toast(tf("Tidy up uses the AI helper. Turn it on in Settings → AI.", "Подреждането използва AI помощника. Включете го в Настройки → AI."), "error");
    const selected = ta.selectionEnd > ta.selectionStart, from = selected ? ta.selectionStart : 0, to = selected ? ta.selectionEnd : ta.value.length;
    const before = ta.value.slice(from, to);
    if (!before.trim()) return toast(tf("Nothing to tidy yet.", "Още няма какво да се подреди."));
    const parts = Tidy.chunks(before); Tidy.stop = false; let done = [];
    const res = await modal(`✦ ${tf("Tidy up", "Подреди")}${selected ? " · " + tf("selected text", "избрания текст") : ""}`, `
      <div class="small faint" data-prog>${tf("The AI is tidying… on your own computer this can take a minute or two for long texts.", "AI подрежда… при дълъг текст това може да отнеме минута-две.")}</div>
      <div class="grid c2" style="margin-top:8px"><div><div class="section-sub" style="margin-top:0">${tf("Your text", "Вашият текст")} · ${Tidy.words(before)} ${tf("words", "думи")}</div><div class="tidy-pane md" data-a></div></div>
        <div><div class="section-sub" style="margin-top:0">${tf("Tidied — you can still change it here", "Подредено — още може да го промените тук")} · <span data-wc>0</span> ${tf("words", "думи")}</div><textarea class="input tidy-pane" data-b spellcheck="true"></textarea></div></div>
      <div data-check style="margin-top:10px"></div>`,
      { wide: true, buttons: [{ label: t("Cancel"), value: null }, { label: tf("Use the tidied text", "Използвай подредения текст"), cls: "primary", value: ov => $("[data-b]", ov).value }],
        onOpen: async ov => {
          ov.querySelector(".modal")?.classList.add("xwide");
          $("[data-a]", ov).innerHTML = MD.render(before);
          const b = $("[data-b]", ov), ok = ov.querySelector(".mf .btn.primary"); ok.disabled = true;
          const check = () => {
            $("[data-wc]", ov).textContent = Tidy.words(b.value);
            const miss = Tidy.missing(before, b.value), shrink = Tidy.words(b.value) < Tidy.words(before) * .8;
            $("[data-check]", ov).innerHTML = miss.length || shrink ? `<div class="card warn-card"><b>${tf("Check these — they are in your text but not in the tidied one:", "Проверете — има ги във вашия текст, но не и в подредения:")}</b>
                <div class="row" style="flex-wrap:wrap;margin-top:6px">${miss.map(m => `<span class="chip" title="${esc(m.kind)}">${esc(m.x)}</span>`).join("")}</div>
                ${shrink ? `<div class="small" style="margin-top:6px">${tf("The tidied text is much shorter than yours. Something may have been summarized.", "Подреденият текст е доста по-кратък. Може нещо да е съкратено.")}</div>` : ""}</div>`
              : `<div class="small" style="color:var(--accent)">✓ ${tf("Every name, number, date, link and secret from your text is still there.", "Всички имена, числа, дати, връзки и тайни от текста са налице.")}</div>`;
          };
          b.oninput = check;
          try {
            for (let i = 0; i < parts.length; i++) {
              $("[data-prog]", ov).textContent = parts.length > 1 ? `${tf("Tidying part", "Подреждане на част")} ${i + 1} / ${parts.length}…` : tf("Tidying…", "Подреждане…");
              done[i] = await Tidy.ask(parts[i], txt => { b.value = [...done.slice(0, i), txt].join("\n\n"); b.scrollTop = b.scrollHeight; });
              if (Tidy.stop || !ov.isConnected) return;
            }
            b.value = done.join("\n\n"); $("[data-prog]", ov).textContent = tf("Done. Compare, change anything you like, then use it or cancel.", "Готово. Сравнете, променете каквото искате, после използвайте или откажете.");
            ok.disabled = false; check();
          } catch (err) { $("[data-prog]", ov).innerHTML = `<span style="color:var(--danger)">${esc(err.message)}</span>`; }
        } });
    Tidy.stop = true;
    if (typeof res !== "string") return;
    // in an entry, keep the untidied text in its history first
    const id = ta.dataset.entry, e = id && M.entries.get(id);
    if (e) await api("entry", { entry: { ...e, body: ta.value }, prevTitle: null, snapshot: "force" }).catch(() => {});
    ta.value = ta.value.slice(0, from) + res + ta.value.slice(to);
    ta.dispatchEvent(new Event("input", { bubbles: true })); ta.focus();
    toast(tf("Tidied. Your earlier text is in the entry's history.", "Подредено. Предишният текст е в историята на записа."));
  },
};

// a small "✦ Tidy up" button under every big writing box (entry editor, answers to questions, quick notes…)
(() => {
  const btn = document.createElement("button"); btn.className = "btn small tidy-btn"; btn.type = "button"; btn.hidden = true;
  btn.innerHTML = `✦ ${tf("Tidy up", "Подреди")}`; document.body.append(btn);
  let target = null;
  const place = () => { if (!target?.isConnected) { btn.hidden = true; return; } const r = target.getBoundingClientRect(); btn.style.left = (r.right - btn.offsetWidth - 10) + "px"; btn.style.top = (r.bottom - btn.offsetHeight - 8) + "px"; };
  document.addEventListener("focusin", ev => {
    const ta = ev.target;
    if (!(ta instanceof HTMLTextAreaElement) || !M.settings?.ai_enabled || ta.closest(".tidy-pane") || ta.classList.contains("tidy-pane")) return;
    if (!(ta.classList.contains("editor") || ta.rows >= 5 || ta.id === "pa")) return;
    target = ta; btn.innerHTML = `✦ ${tf("Tidy up", "Подреди")}`; btn.hidden = false; place();
  });
  document.addEventListener("focusout", ev => { setTimeout(() => { if (document.activeElement !== target && document.activeElement !== btn) btn.hidden = true; }, 150); });
  window.addEventListener("resize", place); document.addEventListener("scroll", place, true); document.addEventListener("input", place, true);
  btn.onmousedown = ev => ev.preventDefault();          // keep the text box focused (and its selection)
  btn.onclick = () => { if (target) { btn.hidden = true; Tidy.run(target); } };
})();
