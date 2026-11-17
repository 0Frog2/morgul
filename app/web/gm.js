// Game master tools (sessions, stat blocks, encounters, initiative, dice), world milestones, and a world as one file.
"use strict";

// ------------------------------------------------------------------ dice
const Dice = {
  roll(expr) {
    const s = String(expr || "").replace(/\s+/g, "").toLowerCase(); if (!s) return null;
    const parts = s.match(/[+-]?[^+-]+/g); if (!parts) return null;
    let total = 0; const shown = [];
    for (const p of parts) {
      const sign = p[0] === "-" ? -1 : 1, body = p.replace(/^[+-]/, "");
      const m = body.match(/^(\d*)d(\d+)(kh\d+|kl\d+)?$/);
      if (m) {
        const n = Math.min(100, +m[1] || 1), sides = +m[2]; if (!sides) return null;
        let rolls = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * sides)), kept = rolls;
        if (m[3]) { const k = +m[3].slice(2), sorted = [...rolls].sort((a, b) => b - a); kept = m[3][1] === "h" ? sorted.slice(0, k) : sorted.slice(-k); }
        total += sign * kept.reduce((a, b) => a + b, 0); shown.push(`${sign < 0 ? "−" : shown.length ? "+" : ""}[${rolls.join(", ")}]`);
      } else if (/^\d+$/.test(body)) { total += sign * +body; shown.push(`${sign < 0 ? "−" : "+"}${body}`); }
      else return null;
    }
    return { total, detail: shown.join(" ") };
  },
  mod: v => Math.floor((+v - 10) / 2),
};

// ------------------------------------------------------------------ stat blocks (on characters, creatures, entities, species)
const Stats = {
  types: ["character", "creature", "entity", "species"],
  abil: () => String(M.world.gm?.abilities || "STR DEX CON INT WIS CHA").split(/[\s,]+/).filter(Boolean),
  html(e) {
    const s = e.stats; if (!s) return "";
    const ab = Stats.abil(), fmtMod = v => v === "" || v == null || isNaN(+v) ? "" : ` (${Dice.mod(v) >= 0 ? "+" : ""}${Dice.mod(v)})`;
    return `<div class="statblock"><div class="sb-name">${esc(e.title)}</div>${s.kind ? `<div class="sb-kind">${esc(s.kind)}</div>` : ""}<hr>
      ${[["ac", tf("Armor", "Броня")], ["hp", tf("Health", "Живот")], ["speed", tf("Speed", "Скорост")], ["level", tf("Level / threat", "Ниво / заплаха")]].filter(([k]) => s[k]).map(([k, l]) => `<div><b>${l}</b> ${esc(s[k])}</div>`).join("")}
      ${ab.some(a => s.abil?.[a] !== undefined && s.abil[a] !== "") ? `<hr><div class="sb-abil">${ab.map(a => `<div><b>${esc(a)}</b><span>${esc(s.abil?.[a] ?? "–")}${fmtMod(s.abil?.[a])}</span></div>`).join("")}</div>` : ""}
      ${s.text ? `<hr><div class="md sb-text">${MD.render(s.text)}</div>` : ""}</div>`;
  },
  async edit(id) {
    const e = M.entries.get(id); const s = { abil: {}, ...(e.stats || {}) }, ab = Stats.abil();
    const res = await modal(`${tf("Stat block", "Характеристики")} · ${esc(e.title)}`, `<div class="form-grid">
        <label>${tf("What it is", "Какво е")}</label><input class="input" id="sk" value="${esc(s.kind || "")}" placeholder="${tf("Medium undead, chaotic", "Нежить, хаотична")}">
        <label>${tf("Armor", "Броня")}</label><input class="input" id="sac" value="${esc(s.ac || "")}" style="width:140px">
        <label>${tf("Health", "Живот")}</label><input class="input" id="shp" value="${esc(s.hp || "")}" style="width:140px" placeholder="27 (5d8+5)">
        <label>${tf("Speed", "Скорост")}</label><input class="input" id="ssp" value="${esc(s.speed || "")}" style="width:140px">
        <label>${tf("Level / threat", "Ниво / заплаха")}</label><input class="input" id="slv" value="${esc(s.level || "")}" style="width:140px">
        <label>${tf("Abilities", "Способности")}</label><div class="row" style="flex-wrap:wrap">${ab.map(a => `<label class="small" style="text-align:center">${esc(a)}<br><input class="input" data-ab="${esc(a)}" value="${esc(s.abil?.[a] ?? "")}" style="width:58px;text-align:center"></label>`).join("")}</div>
        <label>${tf("Traits & actions", "Черти и действия")}</label><textarea class="input" id="stx" rows="7" placeholder="${tf("**Bite.** +4 to hit, 1d6+2 piercing.\n**Pack hunter.** …", "**Ухапване.** +4 за удар, 1d6+2.\n…")}">${esc(s.text || "")}</textarea>
      </div><div class="faint small" style="margin-top:6px">${tf("Works with any game: leave out what your system doesn't use. Ability names are set on the GM page.", "Работи с всяка игра: пропуснете ненужното. Имената на способностите са в страницата за водещия.")}</div>`,
      { wide: true, buttons: [...(e.stats ? [{ label: tf("Remove", "Премахни"), value: "del" }] : []), { label: t("Cancel"), value: null }, { label: t("Save"), cls: "primary", value: ov => ({
        kind: $("#sk", ov).value.trim(), ac: $("#sac", ov).value.trim(), hp: $("#shp", ov).value.trim(), speed: $("#ssp", ov).value.trim(), level: $("#slv", ov).value.trim(),
        abil: Object.fromEntries($$("[data-ab]", ov).map(i => [i.dataset.ab, i.value.trim()]).filter(([, v]) => v !== "")), text: $("#stx", ov).value.trim() }) }] });
    if (!res) return;
    const cur = { ...M.entries.get(id) }; if (res === "del") delete cur.stats; else cur.stats = res;
    await saveEntry(cur, null, false); Panes.refresh();
  },
};
(() => {
  const view = Views.entry;
  Views.entry = (el, route, pane) => {
    view(el, route, pane);
    const e = M.entries.get(route.id); if (!e || Entry.editing.has(e.id) || !Stats.types.includes(e.type)) return;
    if (!e.stats && !M.world.gm?.on) return;          // writers who don't run games never see it
    const side = $(".entry-side", el); if (!side) return;
    const box = document.createElement("div"); box.className = "card";
    box.innerHTML = e.stats ? `${Stats.html(e)}<div class="row" style="margin-top:8px"><button class="btn small ghost" data-st>✎ ${tf("Edit", "Промени")}</button><button class="btn small ghost" data-ini>⚔ ${tf("To initiative", "Към инициатива")}</button></div>`
      : `<button class="btn small ghost" data-st style="width:100%">⚄ ${tf("Add a stat block", "Добави характеристики")}</button>`;
    side.prepend(box);
    $("[data-st]", box).onclick = () => Stats.edit(e.id);
    $("[data-ini]", box)?.addEventListener("click", () => { Init.add(e.id); toast(tf("Added to the initiative list (GM page).", "Добавено към инициативата (страницата за водещия).")); });
  };
})();

// ------------------------------------------------------------------ initiative
const Init = {
  st: () => (M.state.init = M.state.init || { list: [], turn: 0, round: 1 }),
  add(id, name) {
    const e = id ? M.entries.get(id) : null, dex = e?.stats?.abil?.[Stats.abil()[1]];
    const hp = e?.stats?.hp ? parseInt(e.stats.hp) || "" : "";
    const roll = 1 + Math.floor(Math.random() * 20) + (dex ? Dice.mod(dex) : 0);
    Init.st().list.push({ id: uid(), entry: id || "", name: name || e?.title || "?", init: roll, hp, max: hp, note: "" }); saveState();
  },
};

// ------------------------------------------------------------------ the GM page
Views.gm = (el, r, pane) => {
  const tab = r.id || r.tab || M.state.gmTab || "sessions"; M.state.gmTab = tab;
  const gm = (M.world.gm = M.world.gm || { on: false, abilities: "STR DEX CON INT WIS CHA" });
  el.innerHTML = paneHead(`⚄ ${tf("Game master", "Водещ на игра")}`, `<label class="small" title="${tf("Shows “Add a stat block” on characters and creatures", "Показва „Добави характеристики“ при персонажи и създания")}"><input type="checkbox" data-on ${gm.on ? "checked" : ""}> ${tf("Stat blocks on entry pages", "Характеристики на страниците")}</label>`, pane) + `
    <div class="pane-body"><div class="wrap wide"><div class="row" style="margin-bottom:14px">${[["sessions", "📜", "Sessions", "Сесии"], ["encounter", "⚔", "Encounter", "Среща"], ["init", "⏱", "Initiative", "Инициатива"], ["dice", "⚄", "Dice", "Зарове"], ["stats", "▦", "Stat blocks", "Характеристики"]]
      .map(([k, i, en, bg]) => `<span class="chip ${k === tab ? "on" : ""}" data-tab="${k}">${i} ${tf(en, bg)}</span>`).join("")}</div><div data-body></div></div></div>`;
  $$("[data-tab]", el).forEach(c => c.onclick = () => { M.state.gmTab = c.dataset.tab; saveState(); Panes.show({ view: "gm", id: c.dataset.tab }, pane); });
  $("[data-on]", el).onchange = async ev => { gm.on = ev.target.checked; await saveWorld(); };
  const body = $("[data-body]", el);
  ({ sessions: gmSessions, encounter: gmEncounter, init: gmInit, dice: gmDice, stats: gmStats }[tab] || gmSessions)(body, pane);
};

function sessionTemplate(prev) {
  const carried = prev ? (prev.body.match(/##\s*(Next time|Loose threads|Следващия път|Висящи нишки)[\s\S]*?(?=\n##\s|$)/gi) || []).join("\n").replace(/^##.*$/gm, "").trim() : "";
  return tf(`## Plan\n\n${carried ? "From last time:\n" + carried + "\n\n" : ""}## What happened\n\n\n## Loose threads\n\n\n## Next time\n\n`,
    `## План\n\n${carried ? "От миналия път:\n" + carried + "\n\n" : ""}## Какво се случи\n\n\n## Висящи нишки\n\n\n## Следващия път\n\n`);
}
function gmSessions(box, pane) {
  const ss = entriesOf("session").sort((a, b) => (+b.fields?.number || 0) - (+a.fields?.number || 0));
  const last = ss[0];
  box.innerHTML = `<div class="row" style="margin-bottom:10px"><button class="btn primary small" data-start>＋ ${tf("Start session", "Започни сесия")} ${(+last?.fields?.number || 0) + 1}</button>
      <span class="faint small">${tf("A new session copies the last one's “Loose threads” and “Next time” into its plan.", "Новата сесия пренася „Висящи нишки“ и „Следващия път“ от предишната в плана.")}</span></div>
    ${last ? `<div class="card" style="margin-bottom:12px"><div class="faint small">${tf("Last session", "Последна сесия")} · ${esc(last.fields?.played || "")}</div><div style="font:600 18px var(--serif)" data-open="${last.id}">${esc(last.title)}</div>
      <div class="md">${MD.render((last.body.match(/##\s*(Next time|Следващия път)[\s\S]*?(?=\n##\s|$)/i) || [""])[0]) || `<p class="faint">${tf("No “Next time” notes.", "Няма бележки „Следващия път“.")}</p>`}</div></div>` : ""}
    ${ss.length ? `<div class="list">${ss.map(s => rowFor(s)).join("")}</div>` : `<div class="empty">${tf("No sessions yet. Each session is an entry with a plan, what happened, loose threads and notes for next time, plus the in-world date and who played.", "Още няма сесии. Всяка сесия е запис с план, случилото се, висящи нишки и бележки за следващия път.")}</div>`}`;
  $("[data-start]", box).onclick = async () => {
    const n = (+last?.fields?.number || 0) + 1, today = new Date().toISOString().slice(0, 10);
    const e = await createEntry("session", `${tf("Session", "Сесия")} ${n}`, { fields: { number: n, played: today, ...(last?.fields?.players ? { players: last.fields.players } : {}) }, body: sessionTemplate(last), status: "canon" });
    Entry.editing.add(e.id); open(e.id);
  };
}

function gmEncounter(box) {
  let where = M.state.gmWhere || "";
  box.innerHTML = `<div class="grid c2" style="align-items:start"><div class="card"><div class="form-grid">
      <label>${tf("Where", "Къде")}</label><div data-where></div>
      <label>${tf("How many", "Колко")}</label><select class="input" data-n style="width:auto">${["1", "1d3", "1d4", "1d6", "2d4", "2d6", "3d6"].map(x => `<option>${x}</option>`).join("")}</select>
      <label>${tf("Also roll", "Добави")}</label><div>${[["weather", "weather", "време"], ["hook", "a twist", "обрат"], ["npc", "someone they meet", "някой, когото срещат"], ["loot", "what they carry", "какво носят"]].map(([k, en, bg]) => `<label class="small" style="display:block"><input type="checkbox" data-x="${k}" ${k !== "npc" ? "checked" : ""}> ${tf(en, bg)}</label>`).join("")}</div>
    </div><button class="btn primary" data-roll style="margin-top:10px">⚄ ${tf("Roll an encounter", "Хвърли среща")}</button>
    <div class="faint small" style="margin-top:8px">${tf("Picks from creatures whose Habitat is this place or a place around it (or any creature if none live there).", "Избира от създания, чието местообитание е това място или място около него.")}</div></div>
    <div data-out></div></div>`;
  Entry.linkPicker($("[data-where]", box), where ? [where] : [], ["location"], ids => { where = ids[0] || ""; M.state.gmWhere = where; saveState(); }, true);
  const around = id => { const out = new Set(); let c = id, seen = new Set(); while (c && !seen.has(c)) { out.add(c); seen.add(c); c = M.entries.get(c)?.fields?.partOf; }
    for (const e of entriesOf("location")) { let p = e.fields?.partOf, s2 = new Set(); while (p && !s2.has(p)) { if (p === id) out.add(e.id); s2.add(p); p = M.entries.get(p)?.fields?.partOf; } } return out; };
  $("[data-roll]", box).onclick = () => {
    const places = where ? around(where) : null;
    let pool = entriesOf("creature").filter(c => c.status !== "scrapped" && (!places || (c.fields?.habitat || []).some(h => places.has(h))));
    const fallback = !pool.length; if (fallback) pool = entriesOf("creature").filter(c => c.status !== "scrapped");
    const who = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null, n = Dice.roll($("[data-n]", box).value)?.total || 1;
    const extra = $$("[data-x]:checked", box).map(x => [x.dataset.x, Tables.roll(x.dataset.x, 1)[0]]).filter(x => x[1]);
    const label = { weather: tf("Weather", "Време"), hook: tf("Twist", "Обрат"), npc: tf("Someone", "Някой"), loot: tf("They carry", "Носят") };
    const text = `${who ? `${n} × [[${who.title}]]` : tf("Something unknown (you have no creatures yet)", "Нещо непознато (още нямате създания)")}${where ? ` ${tf("near", "край")} [[${titleOf(where)}]]` : ""}\n\n${extra.map(([k, v]) => `**${label[k]}:** ${v}`).join("\n\n")}`;
    $("[data-out]", box).innerHTML = `<div class="card"><div class="md">${MD.render(text)}</div>${who?.stats ? Stats.html(who) : ""}${fallback && where && who ? `<div class="faint small">${tf("Nothing lives here yet, so this is from anywhere.", "Тук още нищо не живее, затова е от другаде.")}</div>` : ""}
      <div class="row" style="margin-top:10px">${who ? `<button class="btn small" data-ini>⚔ ${tf("Add to initiative", "Към инициатива")}</button>` : ""}<button class="btn small ghost" data-ev>${tf("Save as an event", "Запази като събитие")}</button><button class="btn small ghost" data-again>⚄ ${tf("Again", "Пак")}</button></div></div>`;
    $("[data-again]", box).onclick = () => $("[data-roll]", box).click();
    $("[data-ini]", box)?.addEventListener("click", () => { for (let i = 1; i <= n; i++) Init.add(who.id, n > 1 ? `${who.title} ${i}` : who.title); toast(tf("Added.", "Добавено.")); });
    $("[data-ev]", box).onclick = async () => { const e = await createEntry("event", tf("Encounter", "Среща") + (where ? " · " + titleOf(where) : ""), { fields: where ? { where } : {}, body: text }); open(e.id); };
  };
}

function gmInit(box) {
  const st = Init.st();
  const draw = () => {
    const list = st.list;
    box.innerHTML = `<div class="row" style="margin-bottom:10px"><b>${tf("Round", "Рунд")} ${st.round}</b><button class="btn primary small" data-next>${tf("Next turn", "Следващ ход")} ▸</button>
        <button class="btn small ghost" data-sort>⇅ ${tf("Sort", "Подреди")}</button><span class="spacer"></span>
        <div data-pick style="width:240px"></div><input class="input" data-name placeholder="${tf("or a name…", "или име…")}" style="width:140px"><button class="btn small" data-add>＋</button>
        <button class="btn small ghost" data-clear>${tf("Clear", "Изчисти")}</button></div>
      ${list.length ? `<div class="init">${list.map((c, i) => `<div class="init-row ${i === st.turn ? "now" : ""} ${c.hp !== "" && +c.hp <= 0 ? "down" : ""}">
        <input class="input" type="number" data-f="init" data-i="${i}" value="${c.init}" style="width:62px">
        <div class="main" ${c.entry ? `data-open="${c.entry}" style="cursor:pointer"` : ""}><b>${esc(c.name)}</b></div>
        <span class="small faint">${tf("HP", "Ж")}</span><button class="btn small ghost" data-hp="-1" data-i="${i}">−</button><input class="input" data-f="hp" data-i="${i}" value="${c.hp}" style="width:56px;text-align:center"><button class="btn small ghost" data-hp="1" data-i="${i}">+</button>
        <span class="small faint">/ ${esc(c.max || "")}</span><input class="input" data-f="note" data-i="${i}" value="${esc(c.note)}" placeholder="${tf("conditions…", "състояния…")}" style="flex:1">
        <button class="btn small ghost" data-del="${i}">✕</button></div>`).join("")}</div>`
        : `<div class="empty">${tf("Add the fighters: entries with stat blocks roll their own initiative (d20 + the second ability, usually DEX).", "Добавете участниците: записи с характеристики хвърлят сами инициатива.")}</div>`}`;
    Entry.linkPicker($("[data-pick]", box), [], ["character", "creature", "entity"], ids => { if (ids[0]) { Init.add(ids[0]); draw(); } }, true);
    $("[data-add]", box).onclick = () => { const n = $("[data-name]", box).value.trim(); if (n) { Init.add("", n); draw(); } };
    $("[data-next]", box).onclick = () => { if (!st.list.length) return; st.turn++; if (st.turn >= st.list.length) { st.turn = 0; st.round++; } saveState(); draw(); };
    $("[data-sort]", box).onclick = () => { st.list.sort((a, b) => b.init - a.init); st.turn = 0; saveState(); draw(); };
    $("[data-clear]", box).onclick = () => { st.list = []; st.turn = 0; st.round = 1; saveState(); draw(); };
    $$("[data-f]", box).forEach(i => i.onchange = () => { const c = st.list[+i.dataset.i]; c[i.dataset.f] = i.dataset.f === "init" ? +i.value : i.value; saveState(); if (i.dataset.f === "hp") draw(); });
    $$("[data-hp]", box).forEach(b => b.onclick = () => { const c = st.list[+b.dataset.i]; c.hp = (+c.hp || 0) + +b.dataset.hp; saveState(); draw(); });
    $$("[data-del]", box).forEach(b => b.onclick = () => { st.list.splice(+b.dataset.del, 1); if (st.turn >= st.list.length) st.turn = 0; saveState(); draw(); });
  };
  draw();
}

function gmDice(box) {
  const hist = (M.state.diceHist = M.state.diceHist || []);
  const draw = () => {
    box.innerHTML = `<div class="card" style="max-width:640px"><div class="row"><input class="input" data-e value="${esc(M.state.diceLast || "1d20")}" style="width:200px;font-size:18px"><button class="btn primary" data-r>⚄ ${tf("Roll", "Хвърли")}</button></div>
      <div class="row" style="margin-top:8px;flex-wrap:wrap">${["d4", "d6", "d8", "d10", "d12", "d20", "d100", "2d6", "3d6", "4d6kh3", "2d20kh1", "2d20kl1"].map(d => `<button class="btn small ghost" data-q="${d}">${d}</button>`).join("")}</div>
      <div class="faint small" style="margin-top:6px">${tf("Write rolls like 2d6+3, 1d20-1, 4d6kh3 (keep highest 3), 2d20kl1 (keep lowest, disadvantage).", "Пишете хвърляния като 2d6+3, 1d20-1, 4d6kh3 (най-високите 3), 2d20kl1 (най-ниското).")}</div></div>
      <div class="list" style="max-width:640px;margin-top:12px">${hist.slice(0, 20).map(h => `<div class="li"><div class="main"><div class="t" style="font-size:20px">${h.total}</div><div class="d">${esc(h.expr)} · ${esc(h.detail)}</div></div></div>`).join("")}</div>`;
    const go = expr => { const r2 = Dice.roll(expr); if (!r2) return toast(tf("Can't read that roll.", "Не мога да разчета хвърлянето."), "error"); hist.unshift({ expr, ...r2 }); hist.length = Math.min(hist.length, 40); M.state.diceLast = expr; saveState(); draw(); };
    $("[data-r]", box).onclick = () => go($("[data-e]", box).value); $("[data-e]", box).onkeydown = e => { if (e.key === "Enter") go(e.target.value); };
    $$("[data-q]", box).forEach(b => b.onclick = () => go(b.dataset.q.startsWith("d") ? "1" + b.dataset.q : b.dataset.q));
  };
  draw();
}

function gmStats(box) {
  const gm = M.world.gm;
  const withStats = sortByTitle([...M.entries.values()].filter(e => e.stats));
  box.innerHTML = `<div class="row" style="margin-bottom:12px"><span class="small faint">${tf("Ability names", "Имена на способностите")}</span><input class="input" data-ab value="${esc(gm.abilities || "")}" style="width:320px"><button class="btn small" data-save>${t("Save")}</button>
      <span class="faint small">${tf("Your game's own, separated by spaces (e.g. BODY MIND SOUL).", "Тези на вашата игра, разделени с интервал.")}</span></div>
    ${withStats.length ? `<div class="sb-grid">${withStats.map(e => `<div class="card" data-open="${e.id}" style="cursor:pointer">${Stats.html(e)}</div>`).join("")}</div>` : `<div class="empty">${tf("No stat blocks yet. Turn on “Stat blocks on entry pages” above, then open a character or creature.", "Още няма характеристики. Включете „Характеристики на страниците“ горе и отворете персонаж или създание.")}</div>`}`;
  $("[data-save]", box).onclick = async () => { gm.abilities = $("[data-ab]", box).value.trim() || "STR DEX CON INT WIS CHA"; await saveWorld(); toast(t("Saved")); Panes.refresh(); };
}

// ------------------------------------------------------------------ milestones
Views.milestones = async (el, r, pane) => {
  el.innerHTML = paneHead(`⚑ ${tf("Milestones", "Етапи")}`, `<button class="btn primary small" data-make>＋ ${tf("Save a milestone", "Запази етап")}</button>`, pane) + `<div class="pane-body"><div class="wrap">
    <p class="muted">${tf("A milestone keeps your whole world exactly as it is now, with a name: “End of draft one”, “Before the big rewrite”. Later you can see what changed since, bring back single entries, or go back to it completely. Milestones are kept inside the world folder.", "Етапът запазва целия свят точно както е сега, с име: „Край на първата чернова“, „Преди голямото пренаписване“. После виждате какво се е променило, връщате отделни записи или целия свят. Етапите се пазят в папката на света.")}</p>
    <div data-list><div class="faint">…</div></div></div></div>`;
  const draw = async () => {
    const { list } = await api("milestones", {});
    $("[data-list]", el).innerHTML = list.length ? `<div class="list">${list.map(m => `<div class="li"><span>${m.auto ? "↺" : "⚑"}</span><div class="main"><div class="t">${esc(m.name)}</div>
        <div class="d">${esc(m.date.replace("T", " ").slice(0, 16))} · ${m.entries} ${tf("entries", "записа")} · ${m.words.toLocaleString()} ${tf("words", "думи")}${m.note ? " · " + esc(m.note) : ""}</div></div>
        <button class="btn small" data-cmp="${esc(m.file)}">${tf("What changed", "Какво се промени")}</button><button class="btn small ghost" data-back="${esc(m.file)}">${tf("Go back to this", "Върни се към това")}</button><button class="btn small ghost" data-del="${esc(m.file)}" title="${tf("Delete", "Изтрий")}">✕</button></div>`).join("")}</div>`
      : `<div class="empty">${tf("No milestones yet.", "Още няма етапи.")}</div>`;
    $$("[data-cmp]", el).forEach(b => b.onclick = () => milestoneCompare(list.find(m => m.file === b.dataset.cmp)));
    $$("[data-back]", el).forEach(b => b.onclick = async () => {
      const m = list.find(x => x.file === b.dataset.back);
      if (!await confirmBox(tf(`Go back to “${m.name}”? Every entry will be as it was then: entries made since then are removed and changes since then are undone. Your world as it is now is saved as a milestone first (and a backup is made), so you can come back to it.`, `Да се върна ли към „${m.name}“? Всички записи ще са както тогава: новите се махат, промените се връщат. Светът както е сега първо се запазва като етап (и резервно копие), за да можете да се върнете.`), tf("Go back", "Върни се"))) return;
      try { await api("milestone/restore", { file: m.file }); } catch (err) { return toast(err.message, "error"); }
      toast(tf("Done. Reloading…", "Готово. Презареждане…")); setTimeout(() => location.reload(), 600);
    });
    $$("[data-del]", el).forEach(b => b.onclick = async () => {
      const m = list.find(x => x.file === b.dataset.del);
      if (!await confirmBox(tf(`Delete the milestone “${m.name}”? It goes to the world's Trash folder.`, `Да изтрия ли етапа „${m.name}“? Отива в кошчето на света.`))) return;
      await api("milestone/delete", { file: m.file }); draw();
    });
  };
  $("[data-make]", el).onclick = async () => {
    const res = await modal(tf("Save a milestone", "Запази етап"), `<div class="form-grid"><label>${t("Name")}</label><input class="input" id="mn" value="${esc(tf("Milestone", "Етап"))} ${new Date().toISOString().slice(0, 10)}">
      <label>${tf("Note", "Бележка")}</label><input class="input" id="mt" placeholder="${tf("optional", "по избор")}"></div>`,
      { buttons: [{ label: t("Cancel"), value: null }, { label: t("Save"), cls: "primary", value: ov => ({ name: $("#mn", ov).value.trim(), note: $("#mt", ov).value.trim() }) }], onOpen: ov => $("#mn", ov).select() });
    if (!res) return; await api("milestone/make", res); toast(tf("Milestone saved.", "Етапът е запазен.")); draw();
  };
  draw();
};
async function milestoneCompare(m) {
  const { entries } = await api("milestone/entries", { file: m.file });
  const then = new Map(entries.map(e => [e.id, e])), wc = s => (String(s || "").match(/[\p{L}\p{N}]+/gu) || []).length;
  const added = [...M.entries.values()].filter(e => !then.has(e.id));
  const removed = entries.filter(e => !M.entries.has(e.id));
  const changed = [...M.entries.values()].filter(e => { const o = then.get(e.id); return o && (o.body !== e.body || o.title !== e.title || JSON.stringify(o.fields || {}) !== JSON.stringify(e.fields || {})); })
    .map(e => ({ e, o: then.get(e.id), d: wc(e.body) - wc(then.get(e.id).body) })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  const row = (e, extra) => `<div class="li"><span style="color:${typeOf(e.type).color}">${typeOf(e.type).icon}</span><div class="main"><div class="t">${esc(e.title)}</div><div class="d">${extra || esc(typeName(e.type))}</div></div>`;
  await modal(`${tf("Since", "От")} “${esc(m.name)}”`, `<div class="row" style="gap:18px;margin-bottom:10px"><b>＋${added.length}</b> ${tf("new", "нови")} <b>✎${changed.length}</b> ${tf("changed", "променени")} <b>−${removed.length}</b> ${tf("gone", "изчезнали")}
      <span class="faint">${tf("Words", "Думи")}: ${m.words.toLocaleString()} → ${[...M.entries.values()].reduce((a, e) => a + wc(e.body), 0).toLocaleString()}</span></div>
    <div style="max-height:60vh;overflow:auto">
    ${changed.length ? `<div class="section-sub">${tf("Changed", "Променени")}</div><div class="list">${changed.map(c => row(c.e, `${c.o.title !== c.e.title ? `${tf("was", "беше")} “${esc(c.o.title)}” · ` : ""}${c.d >= 0 ? "+" : ""}${c.d} ${tf("words", "думи")}`) + `<button class="btn small ghost" data-rest="${c.e.id}">${tf("Bring back that version", "Върни онази версия")}</button></div>`).join("")}</div>` : ""}
    ${removed.length ? `<div class="section-sub">${tf("Gone since then", "Изчезнали оттогава")}</div><div class="list">${removed.map(e => row(e) + `<button class="btn small" data-rest="${e.id}">${tf("Bring back", "Върни")}</button></div>`).join("")}</div>` : ""}
    ${added.length ? `<div class="section-sub">${tf("New since then", "Нови оттогава")}</div><div class="list">${added.map(e => row(e) + `</div>`).join("")}</div>` : ""}
    ${!added.length && !removed.length && !changed.length ? `<div class="empty">${tf("Nothing has changed.", "Нищо не се е променило.")}</div>` : ""}</div>
    <div class="faint small" style="margin-top:8px">${tf("Bringing back a version keeps the current one in the entry's history.", "Връщането на версия пази сегашната в историята на записа.")}</div>`,
    { wide: true, buttons: [{ label: tf("Close", "Затвори"), value: true }], onOpen: ov => $$("[data-rest]", ov).forEach(b => b.onclick = async () => {
      b.disabled = true; const { entry } = await api("milestone/restore-entry", { file: m.file, id: b.dataset.rest });
      M.entries.set(entry.id, entry); Idx.rebuild(); Bus.emit("entries"); b.textContent = "✓ " + tf("Brought back", "Върнато"); }) });
}

// ------------------------------------------------------------------ a world as one file (Settings → Worlds)
const WorldFile = {
  async save() {
    toast(tf("Packing your world…", "Пакетиране на света…"));
    const r = await api("world/export", {});
    const mb = (r.size / 1048576).toFixed(1);
    const res = await modal(tf("World saved as one file", "Светът е запазен като един файл"), `<p>${tf("Saved in Exports", "Запазено в Exports")}: <b>${esc(r.file.split(/[\\/]/).pop())}</b> (${mb} MB)</p>
      <p class="muted">${tf("Everything is inside: entries, pictures, maps, the calendar, types and boards (not the entry history or milestones). Send it to a co-writer or your players, or keep it as a copy. In Morgul they choose Settings → Worlds → Open a world file.", "Всичко е вътре: записи, картини, карти, календар, видове и табла (без историята и етапите). Изпратете го на съавтор или играчи. В Morgul: Настройки → Светове → Отвори файл на свят.")}</p>`,
      { buttons: [{ label: tf("Show the file", "Покажи файла"), value: "show" }, { label: tf("Close", "Затвори"), cls: "primary", value: null }] });
    if (res === "show") api("open", { path: r.file.replace(/[\\/][^\\/]*$/, "") });
  },
  async open() {
    const i = document.createElement("input"); i.type = "file"; i.accept = ".morgulworld,.zip";
    i.onchange = async () => {
      const f = i.files[0]; if (!f) return;
      const dest = await Worlds.pick(tf("Choose an EMPTY folder for this world", "Изберете ПРАЗНА папка за този свят")); if (!dest) return;
      toast(tf("Unpacking…", "Разопаковане…"));
      const r = await fetch("/api/world/import?dest=" + encodeURIComponent(dest), { method: "POST", body: f }).then(x => x.json()).catch(e => ({ error: e.message }));
      if (r.error) return toast(r.error, "error");
      waitForServer(tf("Opening the world…", "Отваряне на света…"));
    };
    i.click();
  },
};
(() => {
  const section = Worlds.section.bind(Worlds);
  Worlds.section = async box => {
    await section(box);
    const row = document.createElement("div"); row.className = "row"; row.style.marginTop = "8px";
    row.innerHTML = `<button class="btn small" data-wfsave>⇩ ${tf("Save this world as one file", "Запази света като един файл")}</button><button class="btn small" data-wfopen>⇧ ${tf("Open a world file…", "Отвори файл на свят…")}</button>
      <button class="btn small ghost" data-wms>⚑ ${tf("Milestones", "Етапи")}</button>`;
    box.append(row);
    $("[data-wfsave]", row).onclick = () => WorldFile.save(); $("[data-wfopen]", row).onclick = () => WorldFile.open();
    $("[data-wms]", row).onclick = () => Panes.show({ view: "milestones" });
  };
})();
