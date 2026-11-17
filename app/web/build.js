// Building a world from start to finish: the guided path with completeness meters, smart lists, to-dos, random tables.
"use strict";

// ------------------------------------------------------------------ the world-building path
// Each stage: what it covers, the entries it needs (type, how many), and questions answered one at a time.
// Answers go into one entry per stage (type Concept, tag "worldbuilding") as "### Question" sections,
// so they stay ordinary, editable text that links and search see like everything else.
const PATH = [
  { key: "premise", icon: "☾", en: "Premise", bg: "Замисъл", about: ["The heart of your world in a few sentences: what it's about, how it feels, and what makes it yours.", "Сърцето на света ви в няколко изречения: за какво е, какво е усещането и с какво е ваш."],
    goals: [() => !!M.world.name, () => (M.world.about || "").length > 40], qs: [
    ["What is your world called, and what does the name mean?", "Как се казва светът ви и какво означава името?"],
    ["Describe the world in one sentence to someone who has never heard of it.", "Опишете света с едно изречение на някой, който не е чувал за него."],
    ["What feeling should a reader have here: dread, wonder, grit, hope?", "Какво усещане трябва да има читателят: ужас, чудо, суровост, надежда?"],
    ["What makes this world different from every other world in its genre?", "С какво този свят се различава от всички други в жанра?"],
    ["What are its biggest inspirations: myths, places, periods, books?", "Кои са най-големите вдъхновения: митове, места, епохи, книги?"],
    ["What is the central conflict or question of the world?", "Кой е централният конфликт или въпрос на света?"] ] },
  { key: "cosmology", icon: "✧", en: "Cosmology and creation", bg: "Космология и сътворение", about: ["How the world began, what lies beyond it, and the forces that shape it.", "Как е започнал светът, какво има отвъд него и какви сили го оформят."],
    types: [["deity", 1], ["entity", 1]], qs: [
    ["How did the world begin, according to its people? Is that the truth?", "Как е започнал светът според хората му? Това ли е истината?"],
    ["Are there gods or great powers? Are they real, distant, or dead?", "Има ли богове или велики сили? Истински ли са, далечни или мъртви?"],
    ["What lies beyond the edge of the world, below it, above it?", "Какво има отвъд края на света, под него, над него?"],
    ["What happens to souls after death?", "Какво става с душите след смъртта?"],
    ["What is the sky like: suns, moons, stars, omens?", "Какво е небето: слънца, луни, звезди, знамения?"],
    ["How will the world end, if it ends?", "Как ще свърши светът, ако свърши?"] ] },
  { key: "geography", icon: "⌂", en: "Geography and nature", bg: "География и природа", about: ["Lands, seas, climates, creatures and the places people live.", "Земи, морета, климат, същества и местата, където живеят хората."],
    types: [["location", 6], ["creature", 2], ["map", 1]], qs: [
    ["What does the world look like from above: continents, seas, mountains, deserts?", "Как изглежда светът отгоре: континенти, морета, планини, пустини?"],
    ["Which places are dangerous or forbidden, and why?", "Кои места са опасни или забранени и защо?"],
    ["What do the seasons and the weather do to people's lives?", "Какво правят сезоните и времето с живота на хората?"],
    ["Which plants and animals matter most to people (food, fear, magic)?", "Кои растения и животни са най-важни за хората (храна, страх, магия)?"],
    ["Where are the biggest cities, and why did they grow there?", "Къде са най-големите градове и защо са израснали там?"],
    ["How long does it take to travel across the known world?", "Колко време отнема да се прекоси познатият свят?"] ] },
  { key: "history", icon: "⟟", en: "History", bg: "История", about: ["The ages, wars, falls and turning points that made the present.", "Епохите, войните, паденията и повратните точки, създали настоящето."],
    types: [["event", 6]], qs: [
    ["Name the great ages of your world, from oldest to now.", "Назовете великите епохи на света, от най-старата до сега."],
    ["What was the greatest catastrophe, and what did it change forever?", "Коя е била най-голямата катастрофа и какво е променила завинаги?"],
    ["Which war is still remembered, and by whom, and how differently?", "Коя война още се помни, от кого и колко различно?"],
    ["What do people believe about the past that isn't true?", "Какво вярват хората за миналото, което не е вярно?"],
    ["What happened in the last 50 years that everyone still talks about?", "Какво се е случило през последните 50 години, за което всички още говорят?"],
    ["What has been lost or forgotten, and who is looking for it?", "Какво е изгубено или забравено и кой го търси?"] ] },
  { key: "peoples", icon: "❖", en: "Peoples and cultures", bg: "Народи и култури", about: ["Who lives here, how they live, and what they value.", "Кой живее тук, как живее и какво цени."],
    types: [["species", 1], ["culture", 2], ["language", 1]], qs: [
    ["Which peoples or species live in the world, and how do they see each other?", "Кои народи или раси живеят в света и как се гледат взаимно?"],
    ["What does an ordinary family eat, wear and worry about?", "Какво яде, облича и какво тревожи обикновеното семейство?"],
    ["How do people mark birth, coming of age, marriage and death?", "Как отбелязват хората раждане, пълнолетие, брак и смърт?"],
    ["What is the worst thing a person can do in each culture?", "Кое е най-лошото, което човек може да направи във всяка култура?"],
    ["Which languages are spoken, and who can't understand whom?", "Кои езици се говорят и кой кого не разбира?"],
    ["Which stories, songs or sayings does everyone know?", "Кои истории, песни или поговорки знаят всички?"] ] },
  { key: "faith", icon: "☩", en: "Religion and belief", bg: "Религия и вяра", about: ["Faiths, rites, holy places and heresies.", "Вери, обреди, свети места и ереси."],
    types: [["religion", 1], ["holiday", 1]], qs: [
    ["What do most people believe in, and how strongly?", "В какво вярват повечето хора и колко силно?"],
    ["Who are the priests, and how much power do they really hold?", "Кои са жреците и колко власт имат наистина?"],
    ["Which holy days or festivals stop everyday life?", "Кои свети дни или празници спират ежедневието?"],
    ["What is forbidden by faith, and what happens to those who break it?", "Какво е забранено от вярата и какво става с нарушителите?"],
    ["Which heresy or rival faith is growing?", "Коя ерес или съперничеща вяра набира сила?"],
    ["Do the gods ever answer? How do people know?", "Отговарят ли някога боговете? Как знаят хората?"] ] },
  { key: "magic", icon: "§", en: "Magic and the extraordinary", bg: "Магия и необикновеното", about: ["What is possible, what it costs, and who controls it.", "Какво е възможно, каква е цената и кой го контролира."],
    types: [["rule", 3], ["ritual", 1]], qs: [
    ["Is there magic? Where does its power come from?", "Има ли магия? Откъде идва силата ѝ?"],
    ["What does magic cost the one who uses it?", "Каква е цената на магията за този, който я използва?"],
    ["What can magic never do?", "Какво магията никога не може да направи?"],
    ["Who is allowed to use it, and who hunts those who aren't?", "Кой има право да я използва и кой преследва останалите?"],
    ["How do ordinary people feel about magic and those who use it?", "Какво мислят обикновените хора за магията и за тези, които я ползват?"],
    ["What is the most dangerous thing magic has ever done?", "Кое е най-опасното, което магията някога е направила?"] ] },
  { key: "power", icon: "♛", en: "Power and politics", bg: "Власт и политика", about: ["Who rules, who wants to, and how they fight about it.", "Кой управлява, кой иска да управлява и как се борят."],
    types: [["faction", 3], ["government", 1]], qs: [
    ["Who truly holds power, and who only seems to?", "Кой наистина държи властта и кой само изглежда, че я държи?"],
    ["How does a ruler gain and lose power?", "Как владетелят печели и губи власт?"],
    ["Which groups want to change the order of things, and how?", "Кои групи искат да променят реда на нещата и как?"],
    ["What happens to someone who breaks the law: who judges, what punishments?", "Какво става с нарушителя на закона: кой съди, какви наказания?"],
    ["Which alliances are fragile, and what would break them?", "Кои съюзи са крехки и какво би ги разбило?"],
    ["Who are the secret powers behind the visible ones?", "Кои са тайните сили зад видимите?"] ] },
  { key: "economy", icon: "¤", en: "Economy and trade", bg: "Икономика и търговия", about: ["Money, work, trade routes and what people fight over.", "Пари, труд, търговски пътища и за какво се бият хората."],
    types: [["currency", 1], ["item", 2]], qs: [
    ["What do people use to pay: coins, barter, favors, blood?", "С какво плащат хората: монети, размяна, услуги, кръв?"],
    ["What is the most valuable resource, and who controls it?", "Кой е най-ценният ресурс и кой го контролира?"],
    ["What do most people do for a living?", "С какво се препитават повечето хора?"],
    ["Which trade routes matter, and what dangers threaten them?", "Кои търговски пътища са важни и какви опасности ги заплашват?"],
    ["Who is rich, who is poor, and can anyone move between them?", "Кой е богат, кой беден и може ли някой да премине от едното в другото?"],
    ["What is smuggled, and why is it forbidden?", "Какво се контрабандира и защо е забранено?"] ] },
  { key: "characters", icon: "☺", en: "Characters", bg: "Персонажи", about: ["The people who carry your story: heroes, villains, and those in between.", "Хората, които носят историята ви: герои, злодеи и всичко помежду."],
    types: [["character", 6]], qs: [
    ["Who is your main character, and what do they want more than anything?", "Кой е главният ви герой и какво иска повече от всичко?"],
    ["What stands in their way, inside and outside them?", "Какво им пречи, отвътре и отвън?"],
    ["Who is the antagonist, and why do they believe they are right?", "Кой е антагонистът и защо вярва, че е прав?"],
    ["Who would the main character die for, and who would betray them?", "За кого би умрял главният герой и кой би го предал?"],
    ["How does the world shape who these characters are?", "Как светът оформя кои са тези персонажи?"],
    ["Which minor character might steal the story?", "Кой второстепенен герой може да открадне историята?"] ] },
  { key: "story", icon: "¶", en: "Story", bg: "История (сюжет)", about: ["Threads, mysteries and the chapters that tell your tale.", "Нишки, загадки и главите, които разказват историята."],
    types: [["thread", 2], ["chapter", 3], ["secret", 1]], qs: [
    ["Where does the story begin, and why there and then?", "Откъде започва историята и защо точно там и тогава?"],
    ["What is the mystery at its heart, and who knows the answer?", "Каква е загадката в сърцето ѝ и кой знае отговора?"],
    ["What is the turning point in the middle?", "Коя е повратната точка в средата?"],
    ["How might it end? Write two different endings.", "Как може да свърши? Напишете два различни края."],
    ["Which secrets will be revealed, and in what order?", "Кои тайни ще се разкрият и в какъв ред?"],
    ["What should the reader feel on the last page?", "Какво трябва да почувства читателят на последната страница?"] ] },
];
const Path = {
  stageTitle: st => tf(st.en, st.bg),
  stageEntry(st) { return [...M.entries.values()].find(e => (e.tags || []).includes("worldbuilding") && e.fields?.stage === st.key); },
  answered(st, i) {
    const e = this.stageEntry(st); if (!e) return "";
    const heads = [st.qs[i][0], st.qs[i][1]].map(h => "### " + h);
    for (const h of heads) {
      const at = (e.body || "").indexOf(h); if (at < 0) continue;
      const rest = e.body.slice(at + h.length); const end = rest.search(/\n### /);
      return (end < 0 ? rest : rest.slice(0, end)).trim();
    }
    return "";
  },
  score(st) {
    const parts = [];
    const qa = st.qs.filter((_, i) => this.answered(st, i)).length / st.qs.length; parts.push(qa);
    for (const [type, min] of st.types || []) parts.push(Math.min(1, entriesOf(type).length / min));
    for (const g of st.goals || []) parts.push(g() ? 1 : 0);
    // entries of the stage's types count more when their fields are filled in
    const ents = (st.types || []).flatMap(([type]) => entriesOf(type));
    if (ents.length) parts.push(ents.reduce((a, e) => { const fs = typeOf(e.type).fields; return a + (fs.length ? fs.filter(f => Checks.has(e.fields?.[f.key])).length / fs.length : 1); }, 0) / ents.length);
    return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length * 100);
  },
  overall() { return Math.round(PATH.reduce((a, st) => a + this.score(st), 0) / PATH.length); },
  async saveAnswer(st, i, text) {
    let e = this.stageEntry(st);
    const q = tf(st.qs[i][0], st.qs[i][1]);
    if (!e) e = await createEntry("concept", tf(st.en, st.bg) + tf(" (worldbuilding notes)", " (бележки за света)"), { tags: ["worldbuilding"], fields: { stage: st.key }, body: "" });
    e = structuredClone(M.entries.get(e.id));
    const old = this.answered(st, i);
    const block = `### ${q}\n${text.trim()}\n\n`;
    if (old || [st.qs[i][0], st.qs[i][1]].some(h => (e.body || "").includes("### " + h))) {
      const h = [st.qs[i][0], st.qs[i][1]].find(h => e.body.includes("### " + h));
      const at = e.body.indexOf("### " + h), rest = e.body.slice(at + 4 + h.length), end = rest.search(/\n### /);
      e.body = e.body.slice(0, at) + block + (end < 0 ? "" : rest.slice(end + 1).replace(/^\n+/, ""));
    } else e.body = (e.body ? e.body.trimEnd() + "\n\n" : "") + block;
    e.body = e.body.trimEnd() + "\n";
    await saveEntry(e);
  },
  meter(p, big = false) { return `<div class="meter ${big ? "big" : ""}" title="${p}%"><i style="width:${p}%"></i></div>`; },
  async session(st, startAt = 0) {
    const order = st.qs.map((_, i) => i).filter(i => i >= startAt || !this.answered(st, i));
    let k = 0;
    const next = () => order.slice(k).find(i => true);
    while (k < order.length) {
      const i = order[k], q = tf(st.qs[i][0], st.qs[i][1]), cur = this.answered(st, i);
      const r = await modal("", `<div class="small faint">${st.icon} ${esc(this.stageTitle(st))} · ${tf("question", "въпрос")} ${i + 1} / ${st.qs.length}</div>
        <h2 style="font:600 21px var(--serif);margin:6px 0 12px">${esc(q)}</h2>
        <textarea class="input" id="pa" rows="7" placeholder="${tf("Write as much or as little as you like. Use [[links]] to other entries.", "Пишете колкото искате. Използвайте [[връзки]] към други записи.")}">${esc(cur)}</textarea>
        <div class="faint small" style="margin-top:6px">${tf("Answers are saved in", "Отговорите се пазят в")} “${esc(tf(st.en, st.bg))} ${tf("(worldbuilding notes)", "(бележки за света)")}”.</div>`,
        { wide: true, buttons: [{ label: tf("Stop", "Спри"), value: "stop" }, { label: tf("Skip", "Пропусни"), value: "skip" }, { label: tf("Save and next", "Запази и напред"), cls: "primary", value: ov => ({ text: $("#pa", ov).value }) }],
          onOpen: (ov, close) => { const t = $("#pa", ov); t.focus(); linkAutocomplete?.(t); t.onkeydown = ev => { if (ev.key === "Enter" && ev.ctrlKey) close({ text: t.value }); }; } });
      if (!r || r === "stop") break;
      if (r.text !== undefined && r.text.trim()) await this.saveAnswer(st, i, r.text);
      k++;
    }
    Panes.refresh(); Nav.render();
  },
};
const linkAutocomplete = (...a) => Entry.linkAutocomplete?.(...a);

Views.build = (el, r, pane) => {
  const st = PATH.find(s => s.key === r.id);
  if (!st) {
    const all = Path.overall();
    el.innerHTML = paneHead(tf("World-building path", "Пътят на света"), "", pane) + `<div class="pane-body"><div class="wrap wide">
      <div class="card path-hero"><div><div class="faint small">${tf("Your world is", "Светът ви е")}</div><div style="font:600 34px var(--serif)">${all}% <span class="faint" style="font-size:15px">${tf("built", "изграден")}</span></div></div>
        <div style="flex:1">${Path.meter(all, true)}<div class="faint small" style="margin-top:8px">${tf("Go through the stages in any order. Each one asks questions, one at a time, and suggests the entries a finished world needs. The meters fill as you answer, add entries and fill in their fields.", "Минете през етапите в какъвто ред искате. Всеки задава въпроси един по един и предлага записите, нужни на завършен свят. Измервателите се пълнят, докато отговаряте, добавяте записи и попълвате полета.")}</div></div></div>
      <div class="grid auto" style="margin-top:14px">${PATH.map(s => { const p = Path.score(s), n = s.qs.filter((_, i) => Path.answered(s, i)).length; return `<div class="card path-card" data-st="${s.key}">
        <div class="row"><span class="path-icon">${s.icon}</span><b style="flex:1">${esc(Path.stageTitle(s))}</b><span class="small ${p >= 80 ? "acc" : "faint"}">${p}%</span></div>
        ${Path.meter(p)}<div class="faint small" style="margin-top:6px">${esc(tf(...s.about))}</div>
        <div class="small muted" style="margin-top:6px">${n}/${s.qs.length} ${tf("questions", "въпроса")}${(s.types || []).map(([ty, min]) => ` · ${typeOf(ty).icon} ${entriesOf(ty).length}/${min}`).join("")}</div></div>`; }).join("")}</div>
    </div></div>`;
    $$("[data-st]", el).forEach(c => c.onclick = () => Panes.show({ view: "build", id: c.dataset.st }, pane));
    return;
  }
  const p = Path.score(st), ents = (st.types || []).map(([ty, min]) => [ty, min, entriesOf(ty)]);
  el.innerHTML = paneHead(`<span class="faint" style="font-size:14px;cursor:pointer" data-back>${tf("World-building path", "Пътят на света")} ›</span> ${st.icon} ${esc(Path.stageTitle(st))}`,
    `<button class="btn primary small" data-session>✎ ${tf("Answer one by one", "Отговаряй един по един")}</button>`, pane) + `<div class="pane-body"><div class="wrap wide">
    <div class="card path-hero"><div style="font:600 28px var(--serif)">${p}%</div><div style="flex:1">${Path.meter(p, true)}<div class="faint small" style="margin-top:6px">${esc(tf(...st.about))}</div></div></div>
    <div class="grid c2" style="align-items:start;margin-top:14px">
      <div><div class="section-title">${tf("Questions", "Въпроси")}</div>
        <div class="list">${st.qs.map((q, i) => { const a = Path.answered(st, i); return `<div class="li" data-q="${i}" style="align-items:flex-start"><span class="${a ? "acc" : "faint"}" style="margin-top:2px">${a ? "✓" : "○"}</span>
          <div class="main"><div class="t" style="white-space:normal">${esc(tf(q[0], q[1]))}</div>${a ? `<div class="d" style="white-space:normal">${esc(a.slice(0, 160))}${a.length > 160 ? "…" : ""}</div>` : ""}</div></div>`; }).join("")}</div>
        ${Path.stageEntry(st) ? `<div style="margin-top:8px">${chipFor(Path.stageEntry(st).id)}</div>` : ""}</div>
      <div><div class="section-title">${tf("Entries this stage needs", "Записи за този етап")}</div>
        ${st.goals ? `<div class="card small" style="margin-bottom:8px">${M.world.name ? "✓" : "○"} ${tf("World name", "Име на света")} · ${(M.world.about || "").length > 40 ? "✓" : "○"} ${tf("A description of the world", "Описание на света")} <button class="btn small ghost" data-settings>${t("Settings")} → ${t("World")}</button></div>` : ""}
        ${ents.map(([ty, min, list]) => `<div class="card" style="margin-bottom:8px"><div class="row"><b style="flex:1">${typeOf(ty).icon} ${esc(typeName(ty))}</b><span class="small ${list.length >= min ? "acc" : "faint"}">${list.length} / ${min}</span>
          <button class="btn small" data-new="${ty}">＋ ${tf("Add", "Добави")}</button></div>
          ${list.length ? `<div class="row" style="margin-top:8px">${list.slice(0, 24).map(e => chipFor(e.id)).join("")}</div>` : `<div class="faint small" style="margin-top:6px">${tf("None yet.", "Още няма.")}</div>`}</div>`).join("")}
        <div class="row" style="margin-top:6px">${PATH.map(s => `<span class="chip ${s === st ? "on" : ""}" data-go="${s.key}">${s.icon}</span>`).join("")}</div>
      </div></div></div></div>`;
  $("[data-back]", el).onclick = () => Panes.show({ view: "build" }, pane);
  $("[data-session]", el).onclick = () => Path.session(st);
  $$("[data-q]", el).forEach(x => x.onclick = () => Path.session({ ...st, qs: st.qs }, +x.dataset.q).catch(() => {}));
  $$("[data-new]", el).forEach(b => b.onclick = () => newEntryBox(b.dataset.new));
  $$("[data-go]", el).forEach(b => b.onclick = () => Panes.show({ view: "build", id: b.dataset.go }, pane));
  $("[data-settings]", el)?.addEventListener("click", () => Panes.show({ view: "settings" }));
};

// ------------------------------------------------------------------ smart lists (saved searches)
const Smart = {
  list() { return M.world.smartLists || []; },
  async save(spec) {
    const name = await promptBox(tf("Name this smart list", "Име на умния списък"), spec.name || "", tf("e.g. Places with no ruler", "напр. Места без владетел")); if (!name) return;
    M.world.smartLists = [...this.list().filter(x => x.id !== spec.id), { ...spec, id: spec.id || uid(), name }];
    await saveWorld(); Nav.render(); toast(tf(`Saved “${name}”. It's in the sidebar.`, `Запазено „${name}“. В страничната лента е.`));
  },
  async remove(id) { M.world.smartLists = this.list().filter(x => x.id !== id); await saveWorld(); Nav.render(); Panes.show({ view: "browse" }); },
  match(e, s) {
    if (s.type && e.type !== s.type) return false;
    if (s.tag && !(e.tags || []).includes(s.tag)) return false;
    if (s.status && (e.status || "draft") !== s.status) return false;
    if (s.missing && Checks.has(e.fields?.[s.missing])) return false;
    if (s.q) { const q = norm(s.q); if (!(norm(e.title).includes(q) || (e.aliases || []).some(a => norm(a).includes(q)) || norm(e.body).includes(q))) return false; }
    return true;
  },
};
Views.smart = (el, r, pane) => {
  const s = Smart.list().find(x => x.id === r.id);
  if (!s) return Views.browse(el, { view: "browse" }, pane);
  Views.browse(el, { view: "browse", ...s, smart: s }, pane);
};

// ------------------------------------------------------------------ to-do list
const TODO_KINDS = [["decide", "Decide", "Реши"], ["research", "Research", "Проучи"], ["write", "Write", "Напиши"], ["fix", "Fix", "Поправи"], ["other", "Other", "Друго"]];
const Todos = {
  all() { return M.state.todos || (M.state.todos = []); },
  open() { return this.all().filter(x => !x.done); },
  forEntry(id) { return this.open().filter(x => x.entry === id); },
  async add(entry = "", text = "") {
    const r = await modal(tf("New to-do", "Нова задача"), `<input class="input" id="tt" value="${esc(text)}" placeholder="${tf("e.g. Decide how the Order got the recipes", "напр. Реши как Орденът е взел рецептите")}" style="margin-bottom:10px">
      <div class="row">${TODO_KINDS.map(([k, en, bg], i) => `<button class="chip ${i ? "" : "on"}" data-k="${k}">${esc(tf(en, bg))}</button>`).join("")}</div>
      ${entry ? `<div class="faint small" style="margin-top:8px">${tf("Attached to", "Към")} ${chipFor(entry)}</div>` : ""}`, {
      buttons: [{ label: t("Cancel"), value: null }, { label: tf("Add", "Добави"), cls: "primary", value: ov => ({ text: $("#tt", ov).value.trim(), kind: $(".chip.on", ov).dataset.k }) }],
      onOpen: (ov, close) => { $$("[data-k]", ov).forEach(b => b.onclick = () => { $$("[data-k]", ov).forEach(x => x.classList.remove("on")); b.classList.add("on"); }); const i = $("#tt", ov); i.focus(); i.onkeydown = e => { if (e.key === "Enter") close({ text: i.value.trim(), kind: $(".chip.on", ov).dataset.k }); }; },
    });
    if (!r?.text) return;
    this.all().unshift({ id: uid(), text: r.text, kind: r.kind, entry, done: false, created: localStamp() }); saveState(); Nav.render(); Panes.refresh();
  },
  toggle(id) { const x = this.all().find(t => t.id === id); if (x) { x.done = !x.done; x.doneAt = x.done ? localStamp() : undefined; saveState(); Nav.render(); } },
  remove(id) { M.state.todos = this.all().filter(t => t.id !== id); saveState(); Nav.render(); },
  row(x) {
    const k = TODO_KINDS.find(k => k[0] === x.kind) || TODO_KINDS[4];
    return `<div class="li todo ${x.done ? "done" : ""}"><input type="checkbox" data-td="${x.id}" ${x.done ? "checked" : ""}><span class="todo-kind k-${x.kind}">${esc(tf(k[1], k[2]))}</span>
      <div class="main"><div class="t" style="white-space:normal">${esc(x.text)}</div></div>${x.entry ? chipFor(x.entry) : ""}<button class="btn icon ghost small" data-tdx="${x.id}" title="${t("Delete")}">✕</button></div>`;
  },
  bind(el, after) {
    $$("[data-td]", el).forEach(c => c.onchange = () => { this.toggle(c.dataset.td); after?.(); });
    $$("[data-tdx]", el).forEach(b => b.onclick = () => { this.remove(b.dataset.tdx); after?.(); });
  },
};
Views.todo = (el, r, pane) => {
  let kind = "", showDone = false;
  el.innerHTML = paneHead(tf("To-do", "Задачи"), `<button class="btn primary small" data-add>＋ ${tf("To-do", "Задача")}</button>`, pane) + `<div class="pane-body"><div class="wrap">
    <div class="row" style="margin-bottom:10px" data-kinds></div><div data-list></div></div></div>`;
  const draw = () => {
    $("[data-kinds]", el).innerHTML = `<span class="chip ${!kind ? "on" : ""}" data-kind="">${tf("All", "Всички")}</span>` + TODO_KINDS.map(([k, en, bg]) => `<span class="chip ${kind === k ? "on" : ""}" data-kind="${k}">${esc(tf(en, bg))} <span class="faint">${Todos.open().filter(x => x.kind === k).length || ""}</span></span>`).join("")
      + `<span class="spacer"></span><label class="small"><input type="checkbox" data-sd ${showDone ? "checked" : ""}> ${tf("Show done", "Покажи готовите")}</label>`;
    const list = Todos.all().filter(x => (!kind || x.kind === kind) && (showDone || !x.done));
    $("[data-list]", el).innerHTML = list.length ? `<div class="list">${list.map(x => Todos.row(x)).join("")}</div>`
      : `<div class="empty">${tf("Nothing to do. Add things to decide, research, write or fix, here or from any entry (⋯ → To-do).", "Няма задачи. Добавяйте неща за решаване, проучване, писане или поправка тук или от всеки запис (⋯ → Задача).")}</div>`;
    $$("[data-kind]", el).forEach(c => c.onclick = () => { kind = c.dataset.kind; draw(); });
    $("[data-sd]", el).onchange = e => { showDone = e.target.checked; draw(); };
    Todos.bind(el, draw);
  };
  $("[data-add]", el).onclick = () => Todos.add();
  draw();
};
// show an entry's open to-dos on its page
(() => {
  const view = Views.entry;
  Views.entry = (el, route, pane) => {
    view(el, route, pane);
    const list = Todos.forEntry(route.id); if (!list.length || Entry.editing.has(route.id)) return;
    const meta = $(".entry-meta", el); if (!meta) return;
    const box = document.createElement("div"); box.className = "card todo-box";
    box.innerHTML = `<div class="small faint" style="margin-bottom:4px">${tf("To-do", "Задачи")}</div><div class="list">${list.map(x => Todos.row(x)).join("")}</div>`;
    meta.after(box); Todos.bind(box, () => Panes.refresh());
  };
})();

// ------------------------------------------------------------------ random tables (offline)
const NAME_SAMPLES = "Aldric Bren Caelin Dara Edrin Fenna Garret Hale Isolde Jory Kael Liora Marek Nessa Orin Perrin Quill Rowan Senna Talen Una Varek Wren Yara Zorin Bogdan Darina Mirela Radko Velin Zlatka Stoyan Rada Borislav Vesna Dragan Milena".split(" ");
function worldNames(n) {
  const langs = entriesOf("language").flatMap(l => String(l.fields?.sampleNames || "").split(/[\n,]/).map(x => x.trim()).filter(Boolean));
  const sample = langs.length >= 3 ? langs : [...NAME_SAMPLES, ...entriesOf("character").map(e => e.title.split(" ")[0]).filter(x => x.length > 2)];
  const out = typeof Names !== "undefined" ? Names.markov(sample, n) : [];
  return out.length ? out : Array.from({ length: n }, () => sample[Math.floor(Math.random() * sample.length)]);
}
const RT = {   // built-in tables; {name} = a generated name, {place}/{faction}/{character}/{creature}/{deity} = one of your entries
  npc: [["NPC", "Персонаж"], { en: [
    "{name}, a {job} who {quirk}. Wants: {want}.",
  ], bg: ["{name}, {job}, който {quirk}. Иска: {want}."] }, {
    job: { en: "blacksmith,ferryman,midwife,grave-digger,tax collector,hedge witch,soldier,scribe,innkeeper,hunter,beggar,priest,herbalist,smuggler,minstrel,miller,cartographer".split(","), bg: "ковач,лодкар,бабуваща,гробар,бирник,врачка,войник,писар,кръчмар,ловец,просяк,свещеник,билкар,контрабандист,гуслар,мелничар,картограф".split(",") },
    quirk: { en: "never looks anyone in the eye,collects teeth,speaks to the dead,owes money to {faction},is secretly from {place},laughs at the wrong moments,keeps a caged bird,can't read but pretends to,prays to {deity} every hour,is missing two fingers".split(","), bg: "никога не гледа в очите,събира зъби,говори с мъртвите,дължи пари на {faction},тайно е от {place},смее се в грешния момент,държи птица в клетка,не може да чете, но се преструва,моли се на {deity} всеки час,няма два пръста".split(",") },
    want: { en: "to leave {place} forever,revenge on {character},enough coin to bury a parent,to be forgiven,a cure for a strange illness,to find a missing child,to join {faction},to forget something they saw".split(","), bg: "да напусне {place} завинаги,отмъщение на {character},пари да погребе родител,да бъде простен,лек за странна болест,да намери изчезнало дете,да се присъедини към {faction},да забрави нещо видяно".split(",") } }],
  tavern: [["Tavern or inn", "Кръчма или хан"], { en: ["The {adj} {noun}, run by {name}. Known for {known}."], bg: ["„{adj} {noun}“ на {name}. Известна с {known}."] }, {
    adj: { en: "Drowned,Black,Crooked,Last,Grinning,Hanged,Silver,Burnt,Weeping,Sleeping".split(","), bg: "Удавения,Черния,Кривия,Последния,Ухиления,Обесения,Сребърния,Изгорелия,Плачещия,Спящия".split(",") },
    noun: { en: "Goat,Lantern,Wolf,Bell,Raven,Barrel,Crown,Ferryman,Saint,Boar".split(","), bg: "Козел,Фенер,Вълк,Камбана,Гарван,Бъчва,Венец,Лодкар,Светец,Глиган".split(",") },
    known: { en: "a stew nobody asks about,fights every night,a locked room upstairs,the best wine east of {place},a ghost that pays its tab,smugglers from {faction},a bard who knows too much".split(","), bg: "яхния, за която никой не пита,бой всяка вечер,заключена стая горе,най-доброто вино на изток от {place},призрак, който плаща сметката си,контрабандисти от {faction},гуслар, който знае твърде много".split(",") } }],
  rumour: [["Rumour", "Слух"], { en: ["They say {character} {did}.", "Word is that {place} {happens}.", "{faction} is {plotting}."], bg: ["Говори се, че {character} {did}.", "Казват, че в {place} {happens}.", "{faction} {plotting}."] }, {
    did: { en: "was seen alive after the funeral,made a deal with {creature},knows where the old maps are,is not who they claim to be,poisoned the last heir".split(","), bg: "е видян жив след погребението,е сключил сделка със {creature},знае къде са старите карти,не е този, за когото се представя,е отровил последния наследник".split(",") },
    happens: { en: "the wells taste of iron,children dream the same dream,a new shrine appeared overnight,the dead don't stay buried,strangers pay in old coin".split(","), bg: "кладенците имат вкус на желязо,децата сънуват един и същи сън,за една нощ се появи ново светилище,мъртвите не остават в гробовете,непознати плащат със стари монети".split(",") },
    plotting: { en: "paying spies in {place},hunting someone who escaped,secretly broke,arming the villages,searching for a relic".split(","), bg: "плаща на шпиони в {place},гони някого, който е избягал,тайно е разорен,въоръжава селата,търси реликва".split(",") } }],
  hook: [["Plot hook", "Сюжетна кука"], { en: ["{name} asks for help: {problem}. The catch: {catch}."], bg: ["{name} моли за помощ: {problem}. Уловката: {catch}."] }, {
    problem: { en: "a sibling vanished near {place},a debt to {faction} comes due,something is killing livestock,a letter must reach {character} before dawn,the bridge to {place} is cursed".split(","), bg: "брат изчезна близо до {place},изтича дълг към {faction},нещо убива добитъка,писмо трябва да стигне до {character} преди зори,мостът към {place} е прокълнат".split(",") },
    catch: { en: "they are lying about why,{faction} wants the opposite,the answer lies in {place},{creature} is involved,it already happened once before".split(","), bg: "лъжат защо,{faction} иска обратното,отговорът е в {place},замесено е {creature},вече се е случвало веднъж".split(",") } }],
  weather: [["Weather", "Време"], { en: ["{w}, {t}."], bg: ["{w}, {t}."] }, {
    w: { en: "Low fog that smells of ash,Freezing rain,A sky the color of bruises,Dry wind from the east,Thunder without rain,First snow,A red sunrise,Still and heavy heat".split(","), bg: "Ниска мъгла с мирис на пепел,Леден дъжд,Небе с цвят на синина,Сух вятър от изток,Гръмотевици без дъжд,Първи сняг,Червен изгрев,Тежка неподвижна жега".split(",") },
    t: { en: "travel is slow,animals are restless,the roads are empty,old folk call it an omen,the rivers are rising,perfect for an ambush".split(","), bg: "пътуването е бавно,животните са неспокойни,пътищата са празни,старите го смятат за знамение,реките прииждат,идеално за засада".split(",") } }],
  ruin: [["Ruin or dungeon", "Руина или подземие"], { en: ["A {what} near {place}, {state}. Inside: {inside}."], bg: ["{what} близо до {place}, {state}. Вътре: {inside}."] }, {
    what: { en: "sunken chapel,collapsed watchtower,burial mound,flooded mine,abandoned monastery,giant's well,library cellar".split(","), bg: "потънал параклис,срутена кула,могила,наводнена мина,изоставен манастир,великански кладенец,мазе на библиотека".split(",") },
    state: { en: "older than any record,sealed from the inside,still lit at night,claimed by {faction},avoided by every local".split(","), bg: "по-стар от всички летописи,запечатан отвътре,още светне нощем,присвоен от {faction},избягван от всички местни".split(",") },
    inside: { en: "a sleeping {creature},a library of rotting books,an altar to {deity},the bones of a lost army,a door that should not open".split(","), bg: "спящо {creature},библиотека от гниещи книги,олтар на {deity},кости на изгубена армия,врата, която не бива да се отваря".split(",") } }],
  loot: [["Treasure", "Съкровище"], { en: ["{item}, {detail}."], bg: ["{item}, {detail}."] }, {
    item: { en: "A silver ring,A bone flute,A rusted key,A sealed letter,A map fragment,A vial of dark liquid,A carved idol,A pouch of foreign coins".split(","), bg: "Сребърен пръстен,Костена свирка,Ръждясал ключ,Запечатано писмо,Парче от карта,Шишенце с тъмна течност,Издялан идол,Кесия чужди монети".split(",") },
    detail: { en: "marked with the sign of {faction},warm to the touch,stolen from {place},it whispers at night,its owner wants it back,worth more than it looks".split(","), bg: "със знака на {faction},топло на допир,откраднато от {place},шепне нощем,собственикът го иска обратно,струва повече, отколкото изглежда".split(",") } }],
};
const Tables = {
  pick: a => a[Math.floor(Math.random() * a.length)],
  fromWorld(type, fallback) { const l = entriesOf(...[type].flat()); return l.length ? `[[${this.pick(l).title}]]` : fallback; },
  fill(s, slots, lang, depth = 0) {
    return s.replace(/\{(\w+)\}/g, (m, k) => {
      if (depth > 6) return k;
      if (k === "name") return worldNames(1)[0] || "Mira";
      const W = { place: [["location"], tf("the old town", "стария град")], faction: [["faction"], tf("the guild", "гилдията")], character: [["character"], tf("the miller's son", "мелничаровия син")],
        creature: [["creature", "entity"], tf("something in the woods", "нещо в гората")], deity: [["deity", "entity"], tf("the old gods", "старите богове")] }[k];
      if (W) return this.fromWorld(W[0], W[1]);
      const custom = (M.world.tables || []).find(x => norm(x.name) === norm(k));
      if (custom) return this.fill(this.pick(custom.items), slots, lang, depth + 1);
      const sl = slots?.[k]; return sl ? this.fill(this.pick(sl[lang] || sl.en), slots, lang, depth + 1) : m;
    });
  },
  roll(key, n = 5) {
    const lang = M.settings.language === "bg" ? "bg" : "en";
    const cap = s => s.replace(/^(\[\[)?(\p{Ll})/u, (m, b, c) => (b || "") + c.toUpperCase());
    if (RT[key]) { const [, tpl, slots] = RT[key]; return Array.from({ length: n }, () => cap(this.fill(this.pick(tpl[lang] || tpl.en), slots, lang))); }
    const c = (M.world.tables || []).find(x => x.id === key); if (!c || !c.items.length) return [];
    return Array.from({ length: n }, () => this.fill(this.pick(c.items), null, lang));
  },
  async edit(tb) {
    const r = await modal(tb ? tf("Edit table", "Редакция на таблица") : tf("New random table", "Нова таблица"), `
      <input class="input" id="tn" value="${esc(tb?.name || "")}" placeholder="${tf("Name, e.g. Omens", "Име, напр. Знамения")}" style="margin-bottom:8px">
      <textarea class="input" id="ti" rows="10" placeholder="${tf("One result per line. You can use {name}, {place}, {faction}, {character}, {creature}, {deity}, or {Another table's name}.", "По един резултат на ред. Може {name}, {place}, {faction}, {character}, {creature}, {deity} или {Име на друга таблица}.")}">${esc((tb?.items || []).join("\n"))}</textarea>`,
      { wide: true, buttons: [...(tb ? [{ label: t("Delete"), cls: "danger", value: "del" }] : []), { label: t("Cancel"), value: null }, { label: t("Save"), cls: "primary", value: ov => ({ name: $("#tn", ov).value.trim(), items: $("#ti", ov).value.split("\n").map(x => x.trim()).filter(Boolean) }) }] });
    if (!r) return;
    if (r === "del") { if (!await confirmBox(tf(`Delete the table “${tb.name}”?`, `Да изтрия ли таблицата „${tb.name}“?`))) return; M.world.tables = M.world.tables.filter(x => x.id !== tb.id); }
    else { if (!r.name || !r.items.length) return toast(tf("Give it a name and at least one line.", "Дайте име и поне един ред."), "error"); M.world.tables = [...(M.world.tables || []).filter(x => x.id !== tb?.id), { id: tb?.id || uid(), ...r }]; }
    await saveWorld(); Panes.refresh();
  },
};
Views.tables = (el, r, pane) => {
  let cur = r.id || "npc";
  el.innerHTML = paneHead(tf("Random tables", "Случайни таблици"), `<button class="btn small" data-newt>＋ ${tf("My own table", "Моя таблица")}</button>`, pane) + `<div class="pane-body"><div class="wrap wide">
    <div class="grid" style="grid-template-columns:240px minmax(0,1fr);align-items:start">
      <div class="list" data-tl></div><div><div class="row" style="margin-bottom:10px"><b data-tt style="font:600 20px var(--serif);flex:1"></b><button class="btn primary small" data-roll>⚄ ${tf("Roll again", "Хвърли пак")}</button><button class="btn small ghost" data-edit hidden>✎ ${t("Edit")}</button></div>
        <div data-res></div><div class="faint small" style="margin-top:10px">${tf("Works offline. Names come from your languages' sample names; places, factions, characters, creatures and gods come from your own entries. Save a result as an entry, or copy it.", "Работи без интернет. Имената идват от примерните имена на езиците ви; местата, фракциите, персонажите, съществата и боговете идват от вашите записи. Запазете резултат като запис или го копирайте.")}</div></div></div></div></div>`;
  const draw = () => {
    const custom = M.world.tables || [];
    $("[data-tl]", el).innerHTML = Object.entries(RT).map(([k, v]) => `<div class="li ${k === cur ? "on" : ""}" data-t="${k}"><div class="main"><div class="t">${esc(tf(...v[0]))}</div></div></div>`).join("")
      + (custom.length ? `<div class="section-sub" style="padding:0 10px">${tf("My tables", "Моите таблици")}</div>` + custom.map(c => `<div class="li ${c.id === cur ? "on" : ""}" data-t="${c.id}"><div class="main"><div class="t">${esc(c.name)}</div><div class="d">${c.items.length} ${tf("lines", "реда")}</div></div></div>`).join("") : "");
    const c = custom.find(x => x.id === cur);
    $("[data-tt]", el).textContent = RT[cur] ? tf(...RT[cur][0]) : c?.name || "";
    $("[data-edit]", el).hidden = !c;
    const res = Tables.roll(cur, 6);
    $("[data-res]", el).innerHTML = `<div class="list">${res.map((x, i) => `<div class="li"><div class="main"><div class="t md" style="white-space:normal">${MD.inline(x, {})}</div></div>
      <button class="btn small ghost" data-copy="${i}" title="${tf("Copy", "Копирай")}">⧉</button><button class="btn small" data-save="${i}">＋ ${tf("Entry", "Запис")}</button></div>`).join("")}</div>`;
    $$("[data-t]", el).forEach(x => x.onclick = () => { cur = x.dataset.t; draw(); });
    $$("[data-copy]", el).forEach(b => b.onclick = () => { navigator.clipboard.writeText(res[+b.dataset.copy]); toast(tf("Copied.", "Копирано.")); });
    $$("[data-save]", el).forEach(b => b.onclick = async () => {
      const text = res[+b.dataset.save], type = cur === "npc" ? "character" : cur === "tavern" || cur === "ruin" ? "location" : cur === "loot" ? "item" : cur === "hook" ? "thread" : "note";
      const title = cur === "npc" ? text.split(",")[0] : cur === "tavern" ? text.split(",")[0].replace(/^The /, "The ") : text.replace(/\[\[|\]\]/g, "").slice(0, 60);
      const e = await createEntry(type, title, { body: text, tags: ["generated"] }); open(e.id);
    });
  };
  $("[data-roll]", el).onclick = draw;
  $("[data-newt]", el).onclick = () => Tables.edit(null);
  $("[data-edit]", el).onclick = () => Tables.edit((M.world.tables || []).find(x => x.id === cur));
  draw();
};
