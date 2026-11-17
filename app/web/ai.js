// AI helper — always optional, lives in the side panel. Uses a local model through Ollama, loaded only while used.
"use strict";
const AI = (() => {
  const panel = $("#ai");
  let tab = "questions", session = null, busy = false, cancel = false, chat = [], checkMsg = "";

  // ---------------- plumbing
  async function stream(messages, onText, opts = {}) {
    const r = await fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages, ...opts }) });
    if (!r.ok) { let m = "AI error"; try { m = (await r.json()).error; } catch {} throw new Error(m); }
    const rd = r.body.getReader(), dec = new TextDecoder(); let all = "";
    for (;;) { const { done, value } = await rd.read(); if (done) break; all += dec.decode(value, { stream: true }); onText?.(all); if (cancel) { rd.cancel(); break; } }
    return all;
  }
  async function json(messages, schema) {
    const r = await api("ai/chat", { messages, format: schema, temperature: 0.3 });
    try { return JSON.parse(r.content); } catch { const m = r.content.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; }
  }
  const langRule = () => M.settings.language === "bg" ? "Write in Bulgarian." : "Write in the same language as the author's text (English or Bulgarian).";
  const about = () => { const w = M.world || {}; const d = [w.name, w.about].filter(x => String(x || "").trim()).join(": "); return d ? ` (${d})` : ""; };
  const SYSTEM = () => `You are a quiet assistant inside Morgul, the author's private worldbuilding compendium${about()}.
The author owns the world. Never decide canon, never invent facts as if they were true, never write their story for them. Ask, point out, suggest options only when asked. Be concise. ${langRule()}`;

  function entryText(e, full = true) {
    if (!e) return "";
    const ty = typeOf(e.type);
    const fl = ty.fields.map(fd => {
      const v = e.fields?.[fd.key]; if (!Checks.has(v)) return null;
      let s = v;
      if (fd.kind === "link") s = titleOf(v); if (fd.kind === "links") s = v.map(titleOf).join(", "); if (fd.kind === "date") s = Cal.format(v);
      if (fd.kind === "relations") s = v.map(r => `${r.kind}: ${titleOf(r.to)}`).join("; ");
      if (fd.kind === "knowers") s = v.map(r => `${titleOf(r.who)}${r.since ? " (since " + titleOf(r.since) + ")" : ""}`).join("; ");
      return `${fd.label}: ${s}`;
    }).filter(Boolean);
    const body = String(e.body || "").replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g, (_, a, b) => b || a);
    const notes = (e.notes || []).map(n => `Q: ${n.q}\nA: ${n.a}`).join("\n");
    return `### ${e.title} (${ty.name}${e.status ? ", " + e.status : ""})\n${fl.join("\n")}${fl.length ? "\n" : ""}${full ? body : body.slice(0, 600)}${notes ? "\nAuthor's recent answers:\n" + notes : ""}`.slice(0, full ? 7000 : 900);
  }
  function related(e, n = 8) {
    const ids = new Set();
    for (const name of linksIn(e.body)) { const x = Idx.find(name); if (x) ids.add(x.id); }
    for (const fd of typeOf(e.type).fields) { const v = e.fields?.[fd.key]; if (fd.kind === "link" && v) ids.add(v); if (fd.kind === "links") (v || []).forEach(x => ids.add(x)); if (fd.kind === "relations") (v || []).forEach(r => ids.add(r.to)); }
    (Idx.backlinks.get(e.id) || []).forEach(b => ids.add(b.from));
    ids.delete(e.id);
    return [...ids].map(id => M.entries.get(id)).filter(Boolean).slice(0, n);
  }

  // ---------------- panel
  function openPanel(which) {
    if (!M.settings.ai_enabled) { toast(tf("The AI helper is turned off in Settings.", "AI помощникът е изключен в Настройки."), "warn"); return false; }
    if (which) tab = which;
    if (panel.hidden) api("ai/warm", {}).catch(() => {});     // start loading the model now, so the first answer is quicker
    panel.hidden = false; $("#app").classList.add("ai-open"); $("#aiToggle").classList.add("on"); render(); return true;
  }
  function close() { panel.hidden = true; $("#app").classList.remove("ai-open"); $("#aiToggle").classList.remove("on"); cancel = true; api("ai/unload", {}).catch(() => {}); }
  function toggle() { panel.hidden ? openPanel() : close(); }
  function syncToggle() { $("#aiToggle").hidden = !M.settings.ai_enabled; if (!M.settings.ai_enabled) close(); }

  function render() {
    panel.innerHTML = `<div class="ai-head"><h3>✦ ${t("AI helper")}</h3><button class="btn icon ghost" data-x title="${t("Close")}">✕</button></div>
      <div class="ai-tabs">${[["questions", tf("Questions", "Въпроси")], ["ask", t("Ask about your world")], ["checks", tf("Checks", "Проверки")]].map(([k, l]) => `<span class="chip ${k === tab ? "on" : ""}" data-tab="${k}">${l}</span>`).join("")}</div>
      <div class="ai-body" data-body></div><div class="ai-foot" data-foot></div>`;
    $("[data-x]", panel).onclick = close;
    $$("[data-tab]", panel).forEach(c => c.onclick = () => { tab = c.dataset.tab; render(); });
    ({ questions: renderQuestions, ask: renderAsk, checks: renderChecks })[tab]();
  }
  const body = () => $("[data-body]", panel), foot = () => $("[data-foot]", panel);
  const scroll = () => { const b = body(); b.scrollTop = b.scrollHeight; };
  const msg = (cls, html) => `<div class="ai-msg ${cls}">${html}</div>`;

  // ---------------- question sessions ("I'm stuck")
  function renderQuestions() {
    if (!session) {
      const cur = Panes.cur[0]?.view === "entry" ? M.entries.get(Panes.cur[0].id) : null;
      body().innerHTML = `<div class="muted small">${tf("Pick something from “I'm stuck” or open an entry, and I'll ask you questions about it one at a time. Your answers are saved as notes on that entry.",
        "Изберете нещо от „Заседнах“ или отворете запис и ще ви задавам въпроси за него един по един. Отговорите се пазят като бележки в записа.")}</div>
        ${cur ? `<button class="btn primary" data-cur>✦ ${tf("Ask me about", "Питай ме за")} “${esc(cur.title)}”</button>` : ""}
        <button class="btn" data-stuck>${tf("Show what needs fleshing out", "Покажи какво трябва да се доразвие")}</button>
        <button class="btn" data-world>${tf("Questions about the whole world", "Въпроси за целия свят")}</button>
        ${session === null && M.state.worldQs?.length ? `<div class="section-title">${tf("Last world questions", "Последни въпроси за света")}</div>${worldQsHtml()}` : ""}`;
      $("[data-cur]", panel)?.addEventListener("click", () => startSession(cur.id));
      $("[data-stuck]", panel).onclick = () => Panes.show({ view: "stuck" }, 0);
      $("[data-world]", panel).onclick = worldQuestions;
      bindWorldQs();
      foot().innerHTML = "";
      return;
    }
    const e = M.entries.get(session.id);
    body().innerHTML = `<div class="row small"><span class="muted">${tf("Fleshing out", "Доразвиваме")}</span> ${chipFor(session.id)}<span class="spacer"></span><span class="faint">${session.answered} ${tf("answered", "отговора")}</span></div>`
      + session.log.map(x => "q" in x ? msg("bot q", esc(x.q)) + (x.a ? msg("me", esc(x.a)) : x.skipped ? `<div class="faint small" style="align-self:flex-end">${tf(x.saved ? "saved for later" : "skipped", x.saved ? "запазен за по-късно" : "пропуснат")}</div>` : "") : msg("bot", esc(x.info))).join("")
      + (busy ? msg("bot", `<span class="dots">${tf("thinking", "мисля")}</span>`) : "");
    const waiting = session.log.length && !session.log[session.log.length - 1].a && !session.log[session.log.length - 1].skipped && session.log[session.log.length - 1].q;
    foot().innerHTML = waiting ? `<textarea class="input" data-ans placeholder="${tf("Your answer… (Ctrl+Enter)", "Вашият отговор… (Ctrl+Enter)")}"></textarea>
      <div class="row"><button class="btn primary small" data-send>${t("Answer")}</button><button class="btn small ghost" data-skip>${t("Skip")}</button><button class="btn small ghost" data-later>${tf("Save for later", "Запази за после")}</button><span class="spacer"></span><button class="btn small ghost" data-stop>${t("Stop")}</button></div>`
      : `<div class="row"><span class="spacer"></span><button class="btn small ghost" data-stop>${t("Stop")}</button></div>`;
    scroll();
    const ta = $("[data-ans]", panel);
    if (ta) { ta.focus(); ta.onkeydown = ev => { if (ev.key === "Enter" && ev.ctrlKey) answer(ta.value); }; $("[data-send]", panel).onclick = () => answer(ta.value);
      $("[data-skip]", panel).onclick = () => skip(false); $("[data-later]", panel).onclick = () => skip(true); }
    $("[data-stop]", panel).onclick = () => { session = null; cancel = true; render(); Panes.refresh(); };
  }

  async function startSession(id, kind = "", firstQuestion = "") {
    if (!openPanel("questions")) return;
    const e = M.entries.get(id); if (!e) return;
    cancel = false;
    const saved = (e.questions || []).filter(q => !q.done);
    session = { id, kind, log: [], answered: 0, asked: [], offline: false };
    if (firstQuestion) session.log.push({ q: firstQuestion });
    else if (saved.length) { session.log.push({ info: tf(`You saved ${saved.length} questions for later. Starting with those.`, `Имате ${saved.length} запазени въпроса. Започваме с тях.`) }); session.queue = saved.map(q => q.q); session.log.push({ q: session.queue.shift() }); }
    render();
    if (!session.log.some(x => x.q)) await nextQuestion();
  }
  function templateQuestions(e) {     // works without the AI
    const ty = typeOf(e.type); const imp = M.world.important?.[e.type] || [];
    const FQ = {
      born: ["When was {t} born?", "Кога е роден {t}?"], died: ["When did {t} die — and how?", "Кога и как е умрял {t}?"],
      appearance: ["What does {t} look like?", "Как изглежда {t}?"], personality: ["What is {t} like as a person?", "Какъв човек е {t}?"],
      faction: ["Which faction does {t} belong to, if any?", "Към коя фракция принадлежи {t}, ако изобщо?"],
      kind: ["What kind of thing is {t}?", "Какъв вид е {t}?"], partOf: ["Where is {t} — what is it part of?", "Къде се намира {t} — част от какво е?"],
      date: ["When did {t} happen?", "Кога се е случило {t}?"], participants: ["Who took part in {t}?", "Кой е участвал в {t}?"],
      leader: ["Who leads {t}?", "Кой води {t}?"], base: ["Where is {t} based?", "Къде е базата на {t}?"], goals: ["What does {t} want?", "Какво иска {t}?"],
      tier: ["Is {t} a warlord, roaming or helpful entity?", "{t} властваща, скитаща или помагаща същност ли е?"],
      domain: ["What is {t} the entity of — which domain?", "На какво е същност {t} — коя сфера?"], form: ["What does {t} look like in the physical world?", "Как изглежда {t} във физическия свят?"],
      abilities: ["What can {t} do?", "Какво може {t}?"], weaknesses: ["What are the weaknesses of {t}?", "Какви са слабостите на {t}?"],
      ingredients: ["What goes into {t}?", "Какво влиза в {t}?"], effects: ["What does {t} do?", "Какво прави {t}?"], sideEffects: ["What are the side effects of {t}?", "Какви са страничните ефекти на {t}?"],
      components: ["What is needed to perform {t}?", "Какво е нужно, за да се изпълни {t}?"], steps: ["What are the steps of {t}, in order?", "Какви са стъпките на {t}, по ред?"],
      consequences: ["What does {t} cost, and what follows from it?", "Какво струва {t} и какво следва от него?"], properties: ["What are the properties of {t}?", "Какви са свойствата на {t}?"],
      summary: ["What happens in {t}?", "Какво се случва в {t}?"], meaning: ["What does {t} mean?", "Какво означава {t}?"], pronunciation: ["How is {t} pronounced?", "Как се произнася {t}?"],
      roots: ["What are the first words of {t}?", "Кои са първите думи на {t}?"], knownBy: ["Who knows this secret — and since when?", "Кой знае тази тайна — и откога?"],
      powers: ["What can {t} do?", "Какво може {t}?"],
    };
    const qs = imp.filter(k => !Checks.has(e.fields?.[k])).map(k => {
      const l = fieldLabel(ty.fields.find(f => f.key === k) || { label: k });
      const q = FQ[k] ? tf(FQ[k][0], FQ[k][1]) : tf(`What should “${l}” be for {t}?`, `Какво е „${l}“ за {t}?`);
      return q.replace(/\{t\}/g, e.title);
    });
    const generic = {
      character: [tf("What does {t} want more than anything?", "Какво иска {t} повече от всичко?"), tf("What is {t} afraid of?", "От какво се страхува {t}?"), tf("Who would betray {t}, and why?", "Кой би предал {t} и защо?"), tf("What secret does {t} keep?", "Каква тайна пази {t}?")],
      location: [tf("What does {t} smell and sound like?", "Как мирише и звучи {t}?"), tf("Who holds power in {t}, and who resents it?", "Кой държи властта в {t} и кой я мрази?"), tf("What happened here that people still whisper about?", "Какво се е случило тук, за което още се шепне?")],
      faction: [tf("How does someone join {t} — and how do they leave?", "Как се влиза в {t} — и как се излиза?"), tf("What does {t} disagree about internally?", "За какво спорят вътре в {t}?"), tf("What does {t} need that it can't get?", "От какво се нуждае {t}, което не може да получи?")],
      ritual: [tf("What goes wrong if {t} is done badly?", "Какво се обърква, ако {t} се изпълни лошо?"), tf("Who first performed {t}, and what did it cost them?", "Кой пръв е изпълнил {t} и какво му е струвало?")],
      potion: [tf("How does {t} taste and look?", "Какъв вкус и вид има {t}?"), tf("What happens with too much {t}?", "Какво става при прекалено много {t}?")],
      event: [tf("Who benefited from {t}?", "Кой спечели от {t}?"), tf("What do ordinary people remember about {t}?", "Какво помнят обикновените хора за {t}?")],
      entity: [tf("What does {t} want from humans?", "Какво иска {t} от хората?"), tf("What is {t}'s weakness, and who knows it?", "Каква е слабостта на {t} и кой я знае?")],
    }[e.type] || [tf("What is the most important thing about {t} that isn't written yet?", "Кое е най-важното за {t}, което още не е написано?"), tf("Where does {t} come from?", "Откъде идва {t}?")];
    return [...qs, ...generic.map(g => g.replace(/\{t\}/g, e.title))];
  }
  async function nextQuestion() {
    if (!session) return;
    const e = M.entries.get(session.id);
    if (session.queue?.length) { session.log.push({ q: session.queue.shift() }); return render(); }
    const asked = session.log.filter(x => x.q).map(x => x.q);
    if (!session.offline) {
      busy = true; render();
      const focus = { thin: "The entry is very thin — help the author find its core.", fields: "Some key fields are empty — ask about those first.", forgotten: "The author wrote this long ago and may have forgotten it — start by gently reminding them what it says in one short sentence, then ask.",
        unnamed: "It has no real name yet — ask what it's called and why.", thread: "It's an open plot thread — ask about setup, stakes and payoff.", questions: "" }[session.kind] || "";
      const ctx = [entryText(e), ...related(e, 6).map(x => entryText(x, false))].join("\n\n");
      const messages = [{ role: "system", content: SYSTEM() },
        { role: "user", content: `Here is the entry being fleshed out and what it connects to:\n\n${ctx}\n\n${focus}\nAsk the author ONE question that would most help develop "${e.title}" further — about something unfinished, unclear, missing, or a consequence they may not have thought about. Make it specific to what is written, not generic. Questions already asked (don't repeat): ${asked.join(" | ") || "none"}.\nReply with only the question.` }];
      let q = "";
      try {
        const idx = session.log.push({ q: "" }) - 1;
        q = await stream(messages, txt => { session.log[idx].q = txt.trim(); const last = $$(".ai-msg.q", panel).pop(); if (last) last.textContent = txt.trim(); else render(); });
        busy = false; session.log[idx].q = q.trim().replace(/^["“]|["”]$/g, "");
        if (!session.log[idx].q) session.log.splice(idx, 1);
      } catch (err) {
        busy = false; session.offline = true; session.log = session.log.filter(x => x.q !== "");
        session.log.push({ info: tf(`The AI isn't available (${err.message}). I'll use built-in questions instead.`, `AI не е наличен (${err.message}). Ще използвам вградени въпроси.`) });
      }
    }
    if (session.offline) {
      const pool = templateQuestions(e).filter(q => !asked.includes(q));
      if (pool.length) session.log.push({ q: pool[0] }); else session.log.push({ info: tf("That's all the built-in questions for this one.", "Това са всички вградени въпроси за този запис.") });
    }
    render();
  }
  async function answer(text) {
    text = text.trim(); if (!text || !session) return;
    const last = session.log[session.log.length - 1]; last.a = text; session.answered++;
    const e = M.entries.get(session.id);
    const notes = [...(e.notes || []), { id: uid(), q: last.q, a: text, at: new Date().toISOString() }];
    const questions = (e.questions || []).map(q => q.q === last.q ? { ...q, done: true } : q);
    await saveEntry({ ...e, notes, questions }, null, false);
    if (Panes.cur[0]?.view === "entry" && Panes.cur[0].id === e.id && !Entry.editing.has(e.id)) Panes.refresh(0);
    await nextQuestion();
  }
  async function skip(later) {
    const last = session.log[session.log.length - 1]; last.skipped = true; last.saved = later;
    if (later) { const e = M.entries.get(session.id); await saveEntry({ ...e, questions: [...(e.questions || []).filter(q => q.q !== last.q), { q: last.q, done: false }] }, null, false); }
    await nextQuestion();
  }

  // ---------------- whole-world questions
  const worldQsHtml = () => (M.state.worldQs || []).map((q, i) => `<div class="ai-msg bot q" style="cursor:pointer" data-wq="${i}">${esc(q.q)}${q.about ? `<div class="faint small" style="margin-top:4px">→ ${esc(q.about)}</div>` : ""}</div>`).join("");
  function bindWorldQs() {
    $$("[data-wq]", panel).forEach(d => d.onclick = async () => {
      const q = M.state.worldQs[+d.dataset.wq]; let e = Idx.find(q.about || "");
      if (!e) { e = await createEntry("note", q.about || tf("World question", "Въпрос за света"), { body: "" }); }
      open(e.id); startSession(e.id, "", q.q);
    });
  }
  async function worldQuestions() {
    if (!openPanel("questions")) return;
    session = null; busy = true;
    body().innerHTML = msg("bot", `<span class="dots">${tf("Reading your world", "Чета света ви")}</span>`); foot().innerHTML = "";
    const all = [...M.entries.values()].filter(e => e.status !== "scrapped" && e.type !== "map" && e.type !== "note");
    const fo = Checks.fleshOut().slice(0, 25).map(c => `- ${c.id ? titleOf(c.id) : c.title}: ${c.why}`).join("\n");
    const digest = all.map(e => `- ${e.title} [${typeOf(e.type).name}]: ${summary(e, 160)}`).join("\n").slice(0, 14000);
    try {
      const r = await json([{ role: "system", content: SYSTEM() }, { role: "user", content: `The world so far (one line per entry):\n${digest}\n\nKnown gaps:\n${fo}\n\nAsk the author 8 sharp questions about loose ends, unexplained causes, missing consequences, or things that don't seem to fit together yet. Each question should be about one specific entry (give its exact title as "about").` }],
        { type: "object", properties: { questions: { type: "array", items: { type: "object", properties: { q: { type: "string" }, about: { type: "string" } }, required: ["q", "about"] } } }, required: ["questions"] });
      M.state.worldQs = (r?.questions || []).slice(0, 10); saveState();
    } catch (err) {
      M.state.worldQs = Checks.fleshOut().sort((a, b) => b.score - a.score).slice(0, 8).map(c => ({ q: c.why + " " + tf("What should it be?", "Какво трябва да бъде?"), about: c.id ? titleOf(c.id) : c.title }));
      toast(tf("AI not available — showing the built-in list instead.", "AI не е наличен — показвам вградения списък."), "warn");
    }
    busy = false; tab = "questions"; render();
  }

  // ---------------- ask about your world (with sources)
  function renderAsk() {
    body().innerHTML = (chat.length ? chat.map(m => msg(m.role === "user" ? "me" : "bot md", (m.role === "user" ? esc(m.content) : `<div data-txt>${MD.render(m.content)}</div>`) + (m.sources?.length ? `<div class="row" style="margin-top:6px">${m.sources.map(id => chipFor(id)).join("")}</div>` : ""))).join("")
      : `<div class="muted small">${tf(`Ask anything about your own world, e.g. “What do I know about ${esc([...M.entries.values()].find(e => e.type !== "note")?.title || "…")}?” Answers only use what you've written and show which entries they come from.`,
        "Питайте каквото искате за вашия свят. Отговорите ползват само написаното от вас и показват от кои записи идват.")}</div>`) + (busy ? msg("bot", `<span class="dots">…</span>`) : "");
    foot().innerHTML = `<textarea class="input" data-q placeholder="${tf("Ask… (Ctrl+Enter)", "Питайте… (Ctrl+Enter)")}"></textarea><div class="row"><button class="btn primary small" data-go>${tf("Ask", "Питай")}</button><span class="spacer"></span>${chat.length ? `<button class="btn small ghost" data-clear>${tf("Clear", "Изчисти")}</button>` : ""}</div>`;
    const ta = $("[data-q]", panel); ta.focus();
    ta.onkeydown = ev => { if (ev.key === "Enter" && ev.ctrlKey) ask(ta.value); };
    $("[data-go]", panel).onclick = () => ask(ta.value);
    $("[data-clear]", panel)?.addEventListener("click", () => { chat = []; render(); });
    scroll();
  }
  function retrieve(q, n = 7) {
    const terms = norm(q).split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 2);
    const scored = [...M.entries.values()].map(e => {
      const hay = norm(e.title + " " + (e.aliases || []).join(" ") + " " + e.body + " " + JSON.stringify(e.fields || {}));
      let s = 0; for (const w of terms) { if (norm(e.title).includes(w)) s += 6; const c = hay.split(w).length - 1; s += Math.min(c, 6); }
      return [s, e];
    }).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]);
    return scored.slice(0, n).map(([, e]) => e);
  }
  async function ask(q) {
    q = q.trim(); if (!q || busy) return;
    const src = retrieve(q);
    chat.push({ role: "user", content: q }); busy = true; render();
    const ctx = src.map(e => entryText(e)).join("\n\n").slice(0, 16000);
    const messages = [{ role: "system", content: SYSTEM() + "\nAnswer ONLY from the entries given. If they don't say, say it isn't written yet (and that could be worth fleshing out). Mention which entries you used by title." },
      ...chat.slice(-6, -1).map(m => ({ role: m.role, content: m.content })), { role: "user", content: `Entries:\n${ctx || "(nothing relevant found)"}\n\nQuestion: ${q}` }];
    const m = { role: "assistant", content: "", sources: src.map(e => e.id) }; chat.push(m);
    try { await stream(messages, txt => { m.content = txt; if (busy) { busy = false; render(); } const last = $$(".ai-msg.bot [data-txt]", panel).pop(); if (last) last.innerHTML = MD.render(txt); scroll(); }); }
    catch (err) { m.content = err.message; }
    busy = false; render();
  }

  // ---------------- contradiction checks with the AI
  function renderChecks() {
    const n = Checks.openCount();
    body().innerHTML = `<div class="muted small">${tf("Hard facts (dates, deaths, ages, causes, duplicate names…) are checked automatically every time you save — no AI needed. Here the AI also reads the actual text of connected entries and points out passages that seem to disagree. It can miss things or be wrong; you decide.",
      "Твърдите факти се проверяват автоматично при всеки запис — без AI. Тук AI чете и текста на свързани записи и посочва пасажи, които изглеждат противоречиви. Може да греши — вие решавате.")}</div>
      <div class="card small">${t("Open contradictions")}: <b>${n}</b> <a class="wl" data-go>${t("See all")}</a></div>
      ${checkMsg ? msg("bot", esc(checkMsg)) : ""}`;
    const cur = Panes.cur[0]?.view === "entry" ? Panes.cur[0].id : null;
    foot().innerHTML = `<div class="row">${cur ? `<button class="btn small" data-one>${t("Check this entry")}</button>` : ""}<button class="btn small" data-all>${t("Check whole world")}</button>${busy ? `<span class="spacer"></span><button class="btn small ghost" data-cancel>${t("Stop")}</button>` : ""}</div>`;
    $("[data-go]", panel).onclick = () => Panes.show({ view: "contradictions" }, 0);
    $("[data-one]", panel)?.addEventListener("click", () => checkEntry(cur));
    $("[data-all]", panel).onclick = checkWorld;
    $("[data-cancel]", panel)?.addEventListener("click", () => { cancel = true; });
  }
  const overlap = (quote, text) => { const q = norm(quote).split(/\s+/).filter(w => w.length > 2); if (!q.length) return 0; const T = norm(text); return q.filter(w => T.includes(w)).length / q.length; };
  async function comparePair(a, b) {
    const schema = { type: "object", properties: { contradictions: { type: "array", items: { type: "object", properties: { quote_a: { type: "string" }, quote_b: { type: "string" }, why: { type: "string" } }, required: ["quote_a", "quote_b", "why"] } } }, required: ["contradictions"] };
    const ta = entryText(a), tb = entryText(b);
    const r = await json([{ role: "system", content: SYSTEM() }, { role: "user", content: `Compare these two entries from the same fictional world. List only REAL contradictions: statements that cannot both be true (different facts about the same thing). Do NOT list missing details, vagueness, style, or things that are merely surprising. Quote the exact short passages. If there are none, return an empty list.\n\nENTRY A\n${ta}\n\nENTRY B\n${tb}` }], schema);
    return (r?.contradictions || []).filter(c => overlap(c.quote_a, ta) > .6 && overlap(c.quote_b, tb) > .6).map(c => ({
      key: "ai:" + [a.id, b.id].sort().join(":") + ":" + norm(c.quote_a).slice(0, 40), source: "ai", status: "open",
      a: { id: a.id, text: c.quote_a }, b: { id: b.id, text: c.quote_b }, why: c.why }));
  }
  function store(found) {
    const list = M.state.contradictions || []; let added = 0;
    for (const c of found) if (!list.some(x => x.key === c.key)) { list.push(c); added++; }
    M.state.contradictions = list; saveState(); Nav.render(); Bus.emit("issues");
    return added;
  }
  async function runPairs(pairs) {
    if (!openPanel("checks")) return;
    busy = true; cancel = false; checkMsg = ""; let added = 0;
    for (let i = 0; i < pairs.length && !cancel; i++) {
      const [a, b] = pairs[i];
      checkMsg = tf(`Comparing ${i + 1} of ${pairs.length}: “${a.title}” ↔ “${b.title}”…`, `Сравнявам ${i + 1} от ${pairs.length}: „${a.title}“ ↔ „${b.title}“…`); render();
      try { added += store(await comparePair(a, b)); }
      catch (err) { checkMsg = err.message; busy = false; render(); return; }
    }
    busy = false;
    checkMsg = added ? tf(`Found ${added} possible contradictions. They're in the Contradictions list.`, `Намерени ${added} възможни противоречия. Те са в списъка с противоречия.`) : tf("No new contradictions found.", "Не са открити нови противоречия.");
    render(); if (added) toast(checkMsg, "warn");
  }
  function checkEntry(id) {
    const e = M.entries.get(id); if (!e) return;
    const rel = related(e, 12).filter(x => words(x.body) > 15 || Object.keys(x.fields || {}).length > 1);
    if (!rel.length) return toast(tf("This entry isn't connected to anything with enough text to compare yet.", "Този запис още не е свързан с нищо с достатъчно текст за сравнение."), "warn");
    runPairs(rel.map(x => [e, x]));
  }
  function checkWorld() {
    const seen = new Set(), pairs = [];
    const rich = [...M.entries.values()].filter(e => e.status !== "scrapped" && words(e.body) > 25);
    for (const e of rich) for (const x of related(e, 20)) {
      if (words(x.body) <= 25 || x.status === "scrapped") continue;
      const k = [e.id, x.id].sort().join(); if (seen.has(k)) continue; seen.add(k); pairs.push([e, x]);
    }
    if (!pairs.length) return toast(tf("Not enough connected text to compare yet.", "Още няма достатъчно свързан текст за сравнение."), "warn");
    const limit = 40;
    if (pairs.length > limit) toast(tf(`Checking the ${limit} most connected pairs (of ${pairs.length}). Run it again later for more.`, `Проверявам ${limit} най-свързани двойки (от ${pairs.length}).`));
    pairs.sort((p, q) => ((Idx.backlinks.get(q[0].id) || []).length + (Idx.backlinks.get(q[1].id) || []).length) - ((Idx.backlinks.get(p[0].id) || []).length + (Idx.backlinks.get(p[1].id) || []).length));
    const done = new Set(M.state.checkedPairs || []);
    const todo = [...pairs.filter(p => !done.has(p.map(x => x.id).sort().join())), ...pairs.filter(p => done.has(p.map(x => x.id).sort().join()))].slice(0, limit);
    M.state.checkedPairs = [...new Set([...done, ...todo.map(p => p.map(x => x.id).sort().join())])]; saveState();
    runPairs(todo);
  }
  async function resolveHelp(key) {
    const c = Checks.contradictions().find(x => x.key === key); if (!c) return;
    if (!openPanel("ask")) return;
    const q = tf(`Help me resolve this contradiction: “${c.why}”. Passage A (${titleOf(c.a?.id)}): “${c.a?.text}”. Passage B (${titleOf(c.b?.id)}): “${c.b?.text}”. Give me 2–3 different ways it could be resolved (or made intentional), without picking for me.`,
      `Помогни ми да реша това противоречие: „${c.why}“. Пасаж А (${titleOf(c.a?.id)}): „${c.a?.text}“. Пасаж Б (${titleOf(c.b?.id)}): „${c.b?.text}“. Дай ми 2–3 различни начина да се реши (или да е нарочно), без да избираш вместо мен.`);
    ask(q);
  }

  $("#aiToggle").onclick = toggle;
  return { openPanel, close, toggle, syncToggle, startSession, worldQuestions, checkEntry, checkWorld, resolveHelp };
})();
