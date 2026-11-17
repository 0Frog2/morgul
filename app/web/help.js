// Updates (like Oracle 2), What's new, the welcome tour, the Help page, worlds, problem report.
"use strict";

// wait for the server to come back after a restart (update, rollback, world switch), then reload the page
async function waitForServer(msg) {
  const ov = $("#overlay");
  ov.innerHTML = `<div class="backdrop"><div class="modal" style="text-align:center;padding:28px 34px"><div class="spinner"></div><div style="margin-top:12px">${esc(msg)}</div></div></div>`;
  await new Promise(r => setTimeout(r, 1500));
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch("/api/ai/status", { cache: "no-store" }); if (r.ok) { location.reload(); return; } } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  ov.innerHTML = "";
  toast(tf("Morgul didn't come back. Close the window and open Morgul again.", "Morgul не се върна. Затворете прозореца и отворете Morgul отново."), "error");
}
restartMorgul = async () => { try { await api("restart", {}); } catch {} waitForServer(tf("Restarting Morgul…", "Morgul се рестартира…")); };

// ------------------------------------------------------------------ updates
const Updates = {
  info: null,
  async check(force = false, quiet = true) {
    try { this.info = await api("update/check" + (force ? "?force=1" : "")); }
    catch { this.info = { error: "offline" }; }
    if (this.info.available) this.banner();
    else if (!quiet) toast(this.info.error ? tf("Couldn't check for updates: you seem to be offline. Morgul works fine without it.", "Не можах да проверя за обновления: изглежда сте офлайн. Morgul работи и без това.")
      : tf(`You have the newest version (${this.info.current}).`, `Имате най-новата версия (${this.info.current}).`));
    return this.info;
  },
  banner() {
    if ($("#updateBanner")) return;
    const b = document.createElement("div"); b.id = "updateBanner"; b.className = "update-banner";
    b.innerHTML = `<span>▸ ${tf("A new version of Morgul is ready", "Нова версия на Morgul е готова")} <span class="faint">(${esc(this.info.current)} → ${esc(this.info.latest)})</span></span>
      <span class="spacer"></span><button class="btn small ghost" data-notes>${tf("What's in it", "Какво има")}</button><button class="btn small primary" data-up>${tf("Update now", "Обнови сега")}</button><button class="btn small ghost icon" data-x title="${t("Close")}">✕</button>`;
    document.body.appendChild(b);
    $("[data-up]", b).onclick = () => this.apply();
    $("[data-x]", b).onclick = () => b.remove();
    $("[data-notes]", b).onclick = () => modal(tf(`Morgul ${this.info.latest}`, `Morgul ${this.info.latest}`),
      (this.info.notes || []).length ? `<ul class="tour-list">${this.info.notes.map(n => `<li>${esc(n)}</li>`).join("")}</ul>` : `<div class="muted">${tf("Improvements and fixes.", "Подобрения и поправки.")}</div>`, { buttons: [{ label: "OK", value: true }] });
  },
  async apply() {
    if (!await confirmBox(tf("Update Morgul now? Your world is backed up first and isn't touched by the update. Morgul restarts by itself in a few seconds.", "Да обновя ли Morgul сега? Светът ви се архивира първо и обновлението не го докосва. Morgul ще се рестартира сам след няколко секунди."), tf("Update now", "Обнови сега"))) return;
    const ov = $("#overlay");
    ov.innerHTML = `<div class="backdrop"><div class="modal" style="text-align:center;padding:28px 34px"><div class="spinner"></div><div style="margin-top:12px">${tf("Downloading and installing the update…", "Изтегляне и инсталиране на обновлението…")}</div></div></div>`;
    try { await api("update/apply", {}); }
    catch (err) { ov.innerHTML = ""; toast(err.message, "error"); return; }
    waitForServer(tf("Restarting into the new version…", "Рестарт с новата версия…"));
  },
  async rollbackBox() {
    const list = await api("update/previous");
    if (!list.length) return toast(tf("There's no previous version saved yet.", "Още няма запазена предишна версия."));
    const pick = await modal(tf("Go back to a previous version", "Връщане към предишна версия"), `<div class="muted small" style="margin-bottom:8px">${tf("Only the app changes. Your worlds and settings stay as they are.", "Променя се само приложението. Световете и настройките остават същите.")}</div>
      <div class="list">${list.map((v, i) => `<div class="li" data-i="${i}" style="cursor:pointer"><div class="main"><div class="t">Morgul ${esc(v.version)}</div><div class="d">${tf("saved", "запазена")} ${esc(v.saved)}${v.note ? ` · ${tf("the version you went back from", "версията, от която се върнахте")}` : ""}</div></div><span class="faint">↺</span></div>`).join("")}</div>`,
      { onOpen: (ov, close) => $$("[data-i]", ov).forEach(x => x.onclick = () => close(list[+x.dataset.i])) });
    if (!pick || !await confirmBox(tf(`Switch to Morgul ${pick.version}? You can come back to the newest version with “Check for updates”.`, `Да мина ли на Morgul ${pick.version}? Можете да се върнете към най-новата с „Провери за обновления“.`), tf("Go back", "Върни"))) return;
    try { await api("update/rollback", { dir: pick.dir }); } catch (err) { return toast(err.message, "error"); }
    waitForServer(tf("Switching versions…", "Смяна на версията…"));
  },
};

// ------------------------------------------------------------------ what's new (once per version)
const WhatsNew = {
  show(since) {
    const vn = v => v.split(".").map(Number).reduce((a, x) => a * 1000 + x, 0);
    const list = APP_CHANGELOG.filter(c => since ? vn(c.v) > vn(since) : c.v === M.version.version).slice(0, 4);
    if (!list.length) return;
    modal(tf("What's new in Morgul", "Какво ново в Morgul"), list.map((c, i) => `<div style="margin-bottom:14px"><div class="${i ? "muted" : "acc"} small">${tf("Version", "Версия")} ${esc(c.v)}</div>
      <ul class="tour-list">${(M.settings.language === "bg" && c.bg ? c.bg : c.items).map(x => `<li>${x}</li>`).join("")}</ul></div>`).join(""), { wide: true, buttons: [{ label: tf("Show the tour", "Покажи обиколката"), value: "tour" }, { label: tf("Got it", "Ясно"), cls: "primary", value: true }] }).then(v => { if (v === "tour") startTour(); });
  },
};

// ------------------------------------------------------------------ welcome tour
const TOUR_VERSION = 2;    // raise when the tour gains steps; anyone who saw an older tour gets the new one once
function startTour(after) {
  const S = [
    [tf("Welcome to Morgul", "Добре дошли в Morgul"), "☾", tf(`<p>Morgul keeps your whole world in one place: characters, places, events, magic, maps, timelines and your story.</p>
      <p>Everything is saved automatically, as plain text files on <b>your own computer</b>. Nothing is sent anywhere, and it all works offline.</p><p>This tour takes about a minute.</p>`,
      `<p>Morgul пази целия ви свят на едно място: персонажи, места, събития, магия, карти, хронология и историята ви.</p><p>Всичко се запазва автоматично като обикновени текстови файлове на <b>вашия компютър</b>. Нищо не се изпраща никъде и всичко работи офлайн.</p><p>Обиколката отнема около минута.</p>`)],
    [tf("Entries", "Записи"), "✎", tf(`<p>Everything in your world is an <b>entry</b>: a character, a place, an event, a ritual, a rule of magic…</p>
      <p>Press <kbd>Ctrl</kbd>+<kbd>N</kbd> (or <b>＋ New entry</b>) and pick a type. Each type has its own fields, like birth dates for characters or ingredients for potions. Add your own types in Settings.</p>
      <p>Mark entries <b>canon</b>, <b>draft</b> or <b>scrapped</b> as your ideas settle.</p>`,
      `<p>Всичко в света ви е <b>запис</b>: персонаж, място, събитие, ритуал, правило на магията…</p><p>Натиснете <kbd>Ctrl</kbd>+<kbd>N</kbd> (или <b>＋ Нов запис</b>) и изберете вид. Всеки вид има свои полета. Можете да добавяте свои видове в Настройки.</p><p>Отбелязвайте записите като <b>канон</b>, <b>чернова</b> или <b>отхвърлени</b>.</p>`)],
    [tf("Links connect everything", "Връзките свързват всичко"), "⟷", tf(`<p>While writing, type <code>[[</code> and a name to link to another entry, like <code>[[Mira Vel]]</code>.</p>
      <p>Every entry shows what links to it, renaming an entry updates every link, and names you mention without an entry yet show up as <b>things to fill in</b>.</p>
      <p>Select a name in your text and press <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd> to turn it into a link and an entry at once.</p>`,
      `<p>Докато пишете, напишете <code>[[</code> и име за връзка към друг запис.</p><p>Всеки запис показва какво сочи към него, преименуването обновява всички връзки, а имената без запис се появяват като <b>неща за попълване</b>.</p><p>Маркирайте име и натиснете <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd>, за да стане връзка и запис наведнъж.</p>`)],
    [tf("Find anything, jot down everything", "Намерете всичко, запишете всичко"), "⌕", tf(`<p><kbd>Ctrl</kbd>+<kbd>K</kbd> searches titles, other names, tags and text, and runs commands.</p>
      <p><kbd>Ctrl</kbd>+<kbd>Space</kbd> opens a <b>quick note</b> for a sudden idea. It lands in your Inbox to sort out later.</p>
      <p><kbd>Alt</kbd>+<kbd>←</kbd> / <kbd>→</kbd> go back and forward, and <kbd>Shift</kbd>+click opens a link side by side.</p>`,
      `<p><kbd>Ctrl</kbd>+<kbd>K</kbd> търси в заглавия, имена, етикети и текст и изпълнява команди.</p><p><kbd>Ctrl</kbd>+<kbd>Space</kbd> отваря <b>бърза бележка</b>. Тя отива във Входящи за по-късно.</p><p><kbd>Alt</kbd>+<kbd>←</kbd> / <kbd>→</kbd> назад и напред; <kbd>Shift</kbd>+клик отваря връзка отстрани.</p>`)],
    [tf("Tools for the big picture", "Инструменти за голямата картина"), "⟟", tf(`<p>The sidebar has a <b>timeline</b> with your own calendar, interactive <b>maps</b>, the <b>story</b> planner, an <b>alchemy</b> book, <b>relationships</b> and <b>family trees</b>, the <b>world at any point in time</b>, a <b>glossary</b> with languages, and a <b>name generator</b>.</p>
      <p>They all fill themselves from your entries.</p>`,
      `<p>Отстрани има <b>хронология</b> със собствен календар, интерактивни <b>карти</b>, планиране на <b>историята</b>, книга по <b>алхимия</b>, <b>връзки</b> и <b>родословия</b>, <b>светът в даден момент</b>, <b>речник</b> с езици и <b>генератор на имена</b>.</p><p>Всички се попълват от записите ви.</p>`)],
    [tf("When you're stuck", "Когато сте блокирали"), "✦", tf(`<p><b>I'm stuck</b> shows what needs fleshing out: thin entries, forgotten ones, missing names, empty fields and open questions. Pick one and answer questions about it, one at a time.</p>
      <p><b>Contradictions</b> are checked every time you save: dates that don't fit, events after a death, and more. <b>You decide</b> what's canon.</p>
      <p>The optional <b>AI helper</b> (<kbd>Ctrl</kbd>+<kbd>J</kbd>) runs on your own computer. It only asks questions and points things out; it never changes your world.</p>`,
      `<p><b>Заседнах</b> показва какво има нужда от разработка. Изберете нещо и отговорете на въпроси за него, един по един.</p><p><b>Противоречията</b> се проверяват при всяко запазване. <b>Вие решавате</b> кое е канон.</p><p>Незадължителният <b>AI помощник</b> (<kbd>Ctrl</kbd>+<kbd>J</kbd>) работи на вашия компютър. Само задава въпроси и посочва неща; никога не променя света ви.</p>`)],
    [tf("Build your world step by step", "Изградете света стъпка по стъпка"), "☾", tf(`<p>The <b>World-building path</b> (sidebar) walks you from the first idea to a finished world: premise, cosmology, geography, history, peoples and cultures, religion, magic, power, economy, characters and story.</p>
      <p>Each stage asks questions one at a time and suggests the entries a finished world needs, like cultures, religions, deities, species, governments, currencies and holidays. A meter shows how complete each stage is, and the dashboard shows the whole world.</p>`,
      `<p><b>Пътят на света</b> (отстрани) ви води от първата идея до завършен свят: замисъл, космология, география, история, народи и култури, религия, магия, власт, икономика, персонажи и сюжет.</p><p>Всеки етап задава въпроси един по един и предлага нужните записи: култури, религии, божества, раси, управления, валути и празници. Измервател показва колко е завършен всеки етап, а таблото — целия свят.</p>`)],
    [tf("Write the book here too", "Пишете и книгата тук"), "¶", tf(`<p><b>Manuscript</b> (sidebar) holds your story: books → chapters → scenes. Each scene has its own point of view, place, in-world date and word goal, and the <b>scene board</b> lets you drag scenes around.</p>
      <p>Start from an <b>outline template</b> (three acts, hero's journey, seven points, four acts), then <b>Compile</b> it into a Word file, a PDF or an e-book. <b>World Bible</b> turns all your lore into a formatted book with contents, fields and images.</p>`,
      `<p><b>Ръкопис</b> (отстрани) пази историята: книги → глави → сцени. Всяка сцена има гледна точка, място, дата в света и цел в думи, а на <b>таблото със сцени</b> ги местите с плъзгане.</p><p>Започнете от <b>шаблон за структура</b> (три действия, пътят на героя, седем точки, четири части) и после <b>Компилирайте</b> в Word, PDF или е-книга. <b>Библия на света</b> превръща целия ви лор в книга със съдържание, полета и изображения.</p>`)],
    [tf("Time in your world", "Времето във вашия свят"), "☽", tf(`<p>The <b>Calendar</b> (sidebar, ☽) shows your world's months with named weekdays, moons and their phases, seasons, holidays and everything dated on each day. Set it up with ⚙ Moons, seasons, weekdays, and press <b>± Date calculator</b> to add days or count the days between two dates.</p>
      <p>The <b>Timeline</b> now has lanes (by type, faction, place or character), colored era bands, lifespan bars and <b>Follow a character</b>: where they were, and when. The Home page shows what happened <b>on this day</b> in other years.</p>`,
      `<p><b>Календарът</b> (отстрани, ☽) показва месеците на света ви с дни от седмицата, луни и фази, сезони, празници и всичко датирано. Настройва се от ⚙, а <b>± Калкулатор за дати</b> добавя дни или брои дните между две дати.</p>
      <p><b>Хрониката</b> вече има ленти (по вид, фракция, място или персонаж), цветни епохи, линии на живота и <b>Следвай персонаж</b>: къде е бил и кога. Началната страница показва какво се е случило <b>на този ден</b>.</p>`)],
    [tf("Draw your maps and arms", "Нарисувайте карти и гербове"), "✦", tf(`<p>No map yet? <b>Maps → ✦ Make a map</b> draws one for you: a continent, islands, a coast or a single region, with mountains, forests, rivers, regions and names in your world's style. Then paint land up or down, stamp mountains, forests and towns, and add labels. Save it and it becomes a normal map with pins, routes and layers, and you can reopen it in the maker any time.</p>
      <p><b>Heraldry</b> (sidebar, ⛨): every faction, house, place or ruler can have a coat of arms. Pick a shield, colors, a band or cross and a figure, or press 🎲. It shows on the entry's page and can be added to its images.</p>`,
      `<p>Нямате карта? <b>Карти → ✦ Създай карта</b> рисува една: континент, острови, бряг или област, с планини, гори, реки, области и имена. После рисувате суша нагоре или надолу, поставяте планини, гори и градове и надписи. Запазена, тя е обикновена карта с пинове, маршрути и слоеве и може да се отвори отново.</p>
      <p><b>Хералдика</b> (отстрани, ⛨): всяка фракция, род, място или владетел може да има герб. Изберете щит, цветове, лента или кръст и фигура или натиснете 🎲. Гербът се вижда на страницата на записа.</p>`)],
    [tf("Stay organized", "Поддържайте ред"), "☐", tf(`<p><b>To-do</b> keeps things to decide, research, write or fix, on their own or attached to an entry (⋯ → To-do).</p>
      <p>In any list, set filters (type, tag, status, even “missing a field”, like places with no ruler) and press <b>☆ Save as smart list</b>; it stays in the sidebar and updates itself.</p>
      <p><b>Random tables</b> roll NPCs, taverns, rumours, plot hooks, weather, ruins and treasure, using names and places from your own world. Make your own tables too.</p>`,
      `<p><b>Задачи</b> пази неща за решаване, проучване, писане или поправка, самостоятелно или към запис (⋯ → Задача).</p><p>Във всеки списък задайте филтри (вид, етикет, статус, дори „липсва поле“) и натиснете <b>☆ Запази като умен списък</b>; остава отстрани и се обновява сам.</p><p><b>Случайни таблици</b> генерират персонажи, кръчми, слухове, сюжетни куки, време, руини и съкровища с имена и места от вашия свят. Може и свои таблици.</p>`)],
    [tf("Make it look like yours", "Направете го свое"), "◐", tf(`<p>Settings → <b>Theme</b> changes every color (including each entry type's), the fonts, the size of everything, line spacing, corners, the glow, and can put an image behind your pages.</p>
      <p>Save your own themes and share them as files. Start from a ready-made one, like Minas Morgul, Blood moon or Parchment.</p>`,
      `<p>Настройки → <b>Тема</b> сменя всеки цвят (и на всеки вид запис), шрифтовете, размера, междуредието, ъглите, сиянието и може да сложи изображение зад страниците.</p><p>Запазвайте свои теми и ги споделяйте като файлове. Започнете от готова: Minas Morgul, Blood moon или Parchment.</p>`)],
    [tf("Safe by default", "Безопасно по подразбиране"), "⛨", tf(`<p>Every entry keeps its earlier versions (<b>⋯ → History</b>). Deleted entries go to the <b>Trash</b> first. A zip backup of your world is made when you close Morgul.</p>
      <p>Wrap author-only parts in <code>:::secret</code> … <code>:::</code>; they never appear in exports.</p>
      <p>Updates only replace the app, never your world.</p>`,
      `<p>Всеки запис пази предишните си версии (<b>⋯ → История</b>). Изтритите записи отиват първо в <b>Кошчето</b>. При затваряне се прави zip архив на света.</p><p>Тайните части оградете с <code>:::secret</code> … <code>:::</code>; те никога не влизат в експорт.</p><p>Обновленията сменят само приложението, никога света ви.</p>`)],
    [tf("Bring in what you already have", "Внесете каквото вече имате"), "⇣", tf(`<p>Start from your existing notes, or from nothing:</p>`, `<p>Започнете от бележките си или от нулата:</p>`), true],
  ];
  let i = 0;
  const draw = (ov, close) => {
    const [title, icon, html, last] = S[i];
    $(".modal", ov).innerHTML = `<div class="tour"><div class="tour-icon">${icon}</div><h2>${esc(title)}</h2><div class="tour-body">${html}</div>
      ${last ? `<div class="tour-actions">
        <button class="btn" data-act="path">☾ ${tf("Start the world-building path", "Започни пътя на света")}</button>
        <button class="btn" data-act="import">📄 ${tf("Import notes, a folder or Word files", "Внеси бележки, папка или Word файлове")}</button>
        <button class="btn" data-act="paste">✎ ${tf("Paste a document and split it", "Постави документ и го раздели")}</button>
        ${Example.has() || M.entries.size > 12 ? "" : `<button class="btn" data-act="example">✦ ${tf("Explore a small example world first", "Първо разгледай малък примерен свят")}</button>`}
        <button class="btn primary" data-act="new">＋ ${M.entries.size ? tf("Write a new entry", "Нов запис") : tf("Start with an empty world", "Започни с празен свят")}</button></div>` : ""}
      <div class="tour-foot"><div class="tour-dots">${S.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("")}</div><span class="spacer"></span>
        ${i ? `<button class="btn ghost" data-back>${tf("Back", "Назад")}</button>` : `<button class="btn ghost" data-skip>${tf("Skip", "Пропусни")}</button>`}
        ${last ? `<button class="btn" data-done>${tf("Close", "Затвори")}</button>` : `<button class="btn primary" data-next>${tf("Next", "Напред")}</button>`}</div></div>`;
    const m = ov;
    $("[data-next]", m) && ($("[data-next]", m).onclick = () => { i++; draw(ov, close); });
    $("[data-back]", m) && ($("[data-back]", m).onclick = () => { i--; draw(ov, close); });
    $("[data-skip]", m) && ($("[data-skip]", m).onclick = () => close("skip"));
    $("[data-done]", m) && ($("[data-done]", m).onclick = () => close("done"));
    $$("[data-act]", m).forEach(b => b.onclick = () => close(b.dataset.act));
  };
  modal("", "", { wide: true, onOpen: (ov, close) => {
    draw(ov, close);
    const k = ev => { if (!$(".tour", ov)) return document.removeEventListener("keydown", k); if (ev.key === "ArrowRight" && i < S.length - 1) { i++; draw(ov, close); } if (ev.key === "ArrowLeft" && i) { i--; draw(ov, close); } };
    document.addEventListener("keydown", k);
  } }).then(async act => {
    M.settings = await api("settings", { tourSeen: TOUR_VERSION });
    if (act === "path") Panes.show({ view: "build" });
    else if (act === "import") Importer.open();
    else if (act === "paste") { await Importer.open(); }
    else if (act === "example") Example.add();
    else if (act === "new") newEntryBox();
    after && after();
  });
}

// ------------------------------------------------------------------ help page
Views.help = (el, r, pane) => {
  const K = s => s.split("+").map(x => `<kbd>${x}</kbd>`).join("+");
  const keys = [["Ctrl+K", tf("Search everything, run commands", "Търси навсякъде, команди")], ["Ctrl+N", t("New entry")], ["Ctrl+Space", tf("Quick note to the Inbox", "Бърза бележка във Входящи")],
    ["Ctrl+E", tf("Edit / done", "Редакция / готово")], ["Ctrl+J", t("AI helper")], ["Ctrl+Shift+L", tf("Selected name → link + new entry", "Маркирано име → връзка + нов запис")],
    ["Alt+←", tf("Back", "Назад")], ["Alt+→", tf("Forward", "Напред")], ["Shift+click", tf("Open a link side by side", "Отвори връзка отстрани")], ["[[", tf("Link to an entry while writing", "Връзка към запис, докато пишете")]];
  const topics = [
    [tf("Entries, types and fields", "Записи, видове и полета"), tf("Every thing in your world is an entry with a type. Types decide the extra fields (dates, links, lists). Change types or add your own in Settings → Types. Status canon / draft / scrapped tells you what's settled. “Use as template” (⋯ menu) makes new entries of that type start from an entry you like.", "Всяко нещо е запис с вид. Видът определя полетата. Променяйте или добавяйте видове в Настройки → Видове. Статусът канон / чернова / отхвърлено показва кое е решено. „Използвай като шаблон“ (меню ⋯) прави новите записи от този вид да започват от избран запис.")],
    [tf("Links, backlinks and renames", "Връзки и преименуване"), tf("Write [[Name]] to link, [[Name|other text]] to show different words. Every entry lists what links to it. Renaming an entry updates all links to it. Names you link to without an entry appear under I'm stuck → mentioned but missing.", "Пишете [[Име]] за връзка, [[Име|друг текст]] за друг надпис. Всеки запис показва кой сочи към него. Преименуването обновява всички връзки. Имената без запис се появяват в „Заседнах“.")],
    [tf("Dates and the calendar", "Дати и календар"), tf("Dates are day.month.year + era, like 14.3.512 AF, 3.512 AF or 512 AF. Set your eras, months and the present day in Settings → World calendar. Ages, the timeline and “world at a time” use it.", "Датите са ден.месец.година + ера, напр. 14.3.512 AF. Задайте ери, месеци и настоящия ден в Настройки → Календар. Възрастите, хронологията и „светът в даден момент“ го използват.")],
    [tf("Maps", "Карти"), tf("Create a Map entry, add an image, then click to place pins linked to entries. Maps can nest inside each other, have era layers, and measure routes with travel times (speeds in Settings).", "Създайте запис Карта, добавете изображение и щракайте, за да слагате карфици. Картите може да се влагат, да имат слоеве по ери и да мерят маршрути.")],
    [tf("Secrets and author-only notes", "Тайни и бележки на автора"), tf("Wrap parts of the text in :::secret … ::: or use the author-only notes box. Mark a whole entry secret to keep it out of exports completely. Secret entries track who knows what.", "Оградете части с :::secret … ::: или ползвайте бележките на автора. Цял запис може да е таен и никога да не се експортира.")],
    [tf("Contradictions", "Противоречия"), tf("Rule checks run on every save: dates, events after a death, causes after effects, parent ages, duplicate names, the same name in two alphabets. The AI check (optional) compares connected entries. You mark each one resolved or intentional.", "Проверките вървят при всяко запазване. AI проверката (по избор) сравнява свързани записи. Вие отбелязвате всяко като решено или нарочно.")],
    [tf("History, trash and backups", "История, кошче и архиви"), tf("⋯ → History shows earlier versions of an entry with differences, and restores any of them. Deleted entries wait in the Trash. A zip backup of the world is made when you close Morgul (Settings → General; add a second copy on another drive there).", "⋯ → История показва предишни версии и ги възстановява. Изтритите записи чакат в Кошчето. При затваряне се прави zip архив (Настройки → Общи).")],
    [tf("Worlds and where they live", "Светове и къде са"), tf("Settings → Worlds lets you start a new world, open another world folder, switch between worlds, or move this world to another folder or drive. Each world is a normal folder of text files.", "Настройки → Светове: нов свят, отваряне на друга папка, превключване или преместване на света. Всеки свят е обикновена папка с текстови файлове.")],
    [tf("Export and print", "Експорт и печат"), tf("Export turns the world (or part of it) into a small website you can share or open anywhere, or prints it to PDF. Secret parts are always left out.", "Експортът прави уебсайт от света (или част от него) или го отпечатва в PDF. Тайните части винаги се пропускат.")],
    [tf("The AI helper (optional)", "AI помощникът (по избор)"), tf("Install Ollama (ollama.com), run “ollama pull gemma4:e4b”, then open the helper with Ctrl+J. It runs only on your computer, starts when you use it and stops when Morgul closes. It asks questions and points out contradictions; it never writes into your world.", "Инсталирайте Ollama (ollama.com), изпълнете „ollama pull gemma4:e4b“ и отворете с Ctrl+J. Работи само на компютъра ви и никога не пише в света ви.")],
    [tf("The world-building path", "Пътят на света"), tf("Eleven stages take a world from idea to finished: premise, cosmology, geography, history, peoples and cultures, religion, magic, power and politics, economy, characters, story. Each asks questions one at a time (answers are kept in a “worldbuilding notes” entry per stage) and lists the entries it needs. The meter combines answered questions, how many entries exist, and how filled in they are.", "Единадесет етапа водят света от идея до завършен вид. Всеки задава въпроси един по един (отговорите са в запис „бележки за света“ за етапа) и показва нужните записи. Измервателят съчетава отговорите, броя записи и колко са попълнени.")],
    [tf("Cultures, religions, governments and more", "Култури, религии, управления и още"), tf("Types for Culture, Religion, Deity, Species, Government, Currency and Holiday come with fields that link them together: a culture's homeland and faiths, a government's ruler, seat and currency, a holiday's religion. Locations now also have government, cultures, economy, defenses and notable places.", "Видовете Култура, Религия, Божество, Раса, Управление, Валута и Празник имат полета, които ги свързват. Местата вече имат и управление, култури, икономика, отбрана и забележителности.")],
    [tf("Smart lists and to-dos", "Умни списъци и задачи"), tf("In Everything or any type, pick filters (status, tag, text, or a field that's still empty) and press ☆ Save as smart list. To-dos are kinds of work (decide, research, write, fix); add them from the To-do page or from an entry's ⋯ menu, where they also show at the top.", "В „Всичко“ или всеки вид изберете филтри и натиснете ☆ Запази като умен списък. Задачите (реши, проучи, напиши, поправи) се добавят от страница Задачи или от менюто ⋯ на запис.")],
    [tf("Random tables", "Случайни таблици"), tf("Roll offline generators for NPCs, taverns, rumours, plot hooks, weather, ruins and treasure. They use your languages' sample names and your own places, factions, characters, creatures and gods. Make your own tables with one result per line; {name}, {place}, {faction}, {character}, {creature}, {deity} and {Another table} are filled in for you.", "Офлайн генератори за персонажи, кръчми, слухове, сюжетни куки, време, руини и съкровища, с имена и места от вашия свят. Може и свои таблици по един резултат на ред.")],
    [tf("Manuscript and compiling", "Ръкопис и компилиране"), tf("Manuscript (sidebar) shows your books, chapters and scenes. Chapters can belong to a Book; scenes belong to a chapter and have their own point of view, place, date, summary and word goal. Use ↑↓ to reorder, or the Scene board to drag scenes between chapters. Outline templates add chapters with a note on what each should do. Compile (also in Export) creates a Word document with proper headings and page breaks, an EPUB e-book, Markdown, or a PDF through the print window (choose “Save as PDF”). World Bible does the same for your lore: every public entry grouped by type, with its fields, text and images. Secrets never appear and [[links]] become plain words.", "Ръкопис показва книги, глави и сцени. Сцените имат гледна точка, място, дата, резюме и цел. ↑↓ подреждат, а таблото позволява плъзгане между глави. Шаблоните добавят глави с бележка. Компилиране създава Word, EPUB, Markdown или PDF (през печат → „Запиши като PDF“). Библия на света прави същото с лора. Тайните никога не влизат, а [[връзките]] стават думи.")],
    [tf("Calendar and timeline", "Календар и хроника"), tf("Calendar (sidebar, ☽): months, eras and month lengths are set in Settings → World calendar; weekdays, moons (name | days per cycle | shift | color) and seasons (name | day.month) under ⚙ on the Calendar page. Click a day to see moon phases, its season and what happened on that day in other years, to add an event on it, or to make it the present day (used for ages). Holidays are Holiday entries; write their day in “When” as 14.3 or 14 Izok and they appear every year. ± Date calculator adds days, months or years, and counts the days between two dates. Timeline: List, or lanes by type, faction, place or character, with era bands, lifespan bars and a zoom slider; Follow a character lists every dated event, scene or entry they are part of, with the place and their age.", "Календар (отстрани, ☽): епохите и месеците са в Настройки → Календар; дни от седмицата, луни (име | дни на цикъл | отместване | цвят) и сезони (име | ден.месец) са под ⚙ на страницата. Щракнете ден, за да видите фазите на луните, сезона и какво се е случило на този ден, да добавите събитие или да го направите настоящ ден. Празниците са записи Празник с ден в „Кога“ (14.3). ± Калкулатор за дати добавя дни, месеци или години и брои дни между дати. Хроника: списък или ленти по вид, фракция, място или персонаж, с епохи, линии на живота и мащаб; Следвай персонаж показва всяко датирано събитие с място и възраст.")],
    [tf("Map maker", "Създаване на карта"), tf("Maps → ✦ Make a map. Left: the kind of land (continent, islands, archipelago, coast, all land, land with lakes), 🎲 New land for another shape, and sliders for land, rough coasts, mountains, forests, rivers and regions; the look (old parchment, atlas colors, dark), region colors, borders, compass and grid; and ✦ Name the regions, which uses your Languages' sample names. Top: ✋ moves labels (double-click to change or delete one), ▲ raises and ▼ lowers land with the brush (size on the right), ⛰ ◠ ♣ ◉ ♜ stamp mountains, hills, forest, towns and cities, ⌫ clears symbols, A adds a label. ↶ Undo. Save makes a Map entry; on a map made this way, ✦ Edit in map maker reopens it and keeps its pins, routes and layers.", "Карти → ✦ Създай карта. Отляво: видът суша, 🎲 Нова суша и плъзгачи за суша, брегове, планини, гори, реки и области; видът (пергамент, атлас, тъмна), цветове, граници, компас и мрежа; ✦ Именувай областите. Отгоре: ✋ мести надписи (двоен клик ги променя), ▲ повдига и ▼ снишава суша, ⛰ ◠ ♣ ◉ ♜ поставят планини, хълмове, гори, градове и замъци, ⌫ чисти, A добавя надпис. Запазете като карта; ✦ Промени в създаването я отваря отново, като пиновете остават.")],
    [tf("Heraldry", "Хералдика"), tf("A faction, character, place, government, religion, culture, deity or species page has ⛨ Add a coat of arms at the top of the right side. Choose a shape, a plain or divided field and its colors, a band or cross, and up to four figures (stars, moons, towers, swords, keys, crowns, skulls, wolves' heads and more), and a motto. 🎲 makes random arms that follow the old rule (metal on colour). The written description (blazon) is made for you. ▣ As image adds a picture of the arms to the entry, so it appears in the gallery, exports and the World Bible. Heraldry in the sidebar shows every coat of arms.", "Страниците на фракции, персонажи, места и др. имат ⛨ Добави герб. Изберете форма, поле и цветове, лента или кръст, до четири фигури и девиз. 🎲 прави случаен герб. Описанието се пише само. ▣ Като изображение добавя картина към записа. Хералдика отстрани показва всички гербове.")],
    [tf("Theme", "Тема"), tf("Settings → Theme: start from a ready theme, then change any color (and each entry type's color), the fonts for headings, interface and writing, the size of everything, line spacing, corner roundness, glow, compact layout, and a background image. Save themes under your own name; export them as .morgul-theme files and import other people's.", "Настройки → Тема: всеки цвят, шрифтове, размер, междуредие, ъгли, сияние, сбита подредба и фоново изображение. Запазвайте свои теми, експортирайте ги като .morgul-theme файлове и внасяйте чужди.")],
    [tf("Updates", "Обновления"), tf("When a new version is out, a banner offers “Update now”. Only the app is replaced; your worlds, settings and backups stay. Settings → Morgul can check by hand, turn the automatic check off, or go back to a previous version.", "Когато има нова версия, лента предлага „Обнови сега“. Сменя се само приложението. Настройки → Morgul: ръчна проверка, изключване на автоматичната или връщане към предишна версия.")],
  ];
  el.innerHTML = paneHead(tf("Help", "Помощ"), "", pane) + `<div class="pane-body"><div class="wrap">
    <div class="grid c2">
      <div class="card"><div class="section-title" style="margin-top:0">${tf("Getting started", "Първи стъпки")}</div>
        <div class="col-actions">
          <button class="btn" data-tour>☾ ${tf("Show the welcome tour", "Покажи обиколката")}</button>
          <button class="btn" data-new>＋ ${t("New entry")}</button>
          ${Example.has() ? `<button class="btn danger" data-ex-rm>✕ ${tf("Remove the example world", "Махни примерния свят")}</button>` : `<button class="btn" data-ex>☾ ${tf("Add a small example world to explore", "Добави малък примерен свят")}</button>`}
        </div></div>
      <div class="card"><div class="section-title" style="margin-top:0">${tf("Bring in your notes", "Внесете бележките си")}</div>
        <div class="small muted" style="margin-bottom:8px">${tf("Import .md and .txt files, a whole folder (for example from Obsidian) or Word documents. Long documents can be split into entries at their headings. You can also drag files onto the window.", "Внесете .md и .txt файлове, цяла папка (напр. от Obsidian) или Word документи. Дългите документи може да се разделят на записи по заглавията. Може и да пуснете файлове върху прозореца.")}</div>
        <div class="col-actions"><button class="btn primary" data-import>⇣ ${tf("Import files or a folder", "Внеси файлове или папка")}</button><button class="btn" data-paste>✎ ${tf("Paste a document", "Постави документ")}</button></div></div>
    </div>
    <div class="section-title">${tf("Keys", "Клавиши")}</div>
    <div class="card"><div class="keys">${keys.map(([k, d]) => `<div>${K(k)}</div><div class="muted">${esc(d)}</div>`).join("")}</div></div>
    <div class="section-title">${tf("How things work", "Как работят нещата")}</div>
    <div class="faq">${topics.map(([q, a]) => `<details class="card"><summary>${esc(q)}</summary><div class="muted" style="margin-top:8px;line-height:1.6">${esc(a)}</div></details>`).join("")}</div>
    <div class="section-title">${tf("Something not working?", "Нещо не работи?")}</div>
    <div class="card"><div class="row"><div class="small muted" style="flex:1">${tf("Copy a short technical report (version, Windows, recent log lines; never your world's content) to send to whoever gave you Morgul.", "Копирайте кратък технически отчет (версия, Windows, последни редове от дневника; никога съдържание от света) и го изпратете на този, който ви е дал Morgul.")}</div>
      <button class="btn" data-report>⧉ ${tf("Copy problem report", "Копирай отчет за проблем")}</button></div></div>
    <div class="section-title">${tf("About", "Относно")}</div>
    <div class="card"><div class="row"><div style="flex:1">Morgul ${esc(M.version.version)} <span class="faint small">· ${esc(M.version.date)}</span><div class="faint small">github.com/${esc(M.version.repo)}</div></div>
      <button class="btn small" data-whatsnew>${tf("What's new", "Какво ново")}</button><button class="btn small" data-check>${tf("Check for updates", "Провери за обновления")}</button></div></div>
  </div></div>`;
  const on = (k, f) => { const b = $(`[data-${k}]`, el); if (b) b.onclick = f; };
  on("tour", () => startTour());
  on("new", () => newEntryBox());
  on("ex", () => Example.add());
  on("ex-rm", () => Example.remove());
  on("import", () => Importer.open());
  on("paste", () => Importer.open().then(() => {}));
  on("report", copyReport);
  on("whatsnew", () => WhatsNew.show(null));
  on("check", () => Updates.check(true, false));
};
async function copyReport() {
  const r = await api("report");
  try { await navigator.clipboard.writeText(r.text); toast(tf("Problem report copied. Paste it into a message.", "Отчетът е копиран. Поставете го в съобщение.")); }
  catch { modal(tf("Problem report", "Отчет за проблем"), `<textarea class="input" rows="14" readonly>${esc(r.text)}</textarea>`, { wide: true, buttons: [{ label: "OK", value: true }] }); }
}

// ------------------------------------------------------------------ worlds (Settings → Worlds)
const Worlds = {
  async pick(title) {
    const r = await api("worlds/pick", { title }).catch(() => ({ unavailable: true }));
    if (r.path) return r.path;
    if (!r.unavailable) return null;                      // cancelled
    return promptBox(title, "", "D:\\Worlds\\My world");   // no folder picker on this computer: type the path
  },
  async run(route, body, msg) {
    try { await api(route, body); } catch (err) { toast(err.message, "error"); return; }
    waitForServer(msg);
  },
  async newWorld() {
    const p = await this.pick(tf("Choose an EMPTY folder for the new world", "Изберете ПРАЗНА папка за новия свят")); if (!p) return;
    this.run("worlds/new", { path: p }, tf("Opening the new world…", "Отваряне на новия свят…"));
  },
  async openWorld() {
    const p = await this.pick(tf("Choose a world folder (the one with a _morgul folder inside)", "Изберете папка на свят (с папка _morgul вътре)")); if (!p) return;
    this.run("worlds/open", { path: p }, tf("Opening the world…", "Отваряне на света…"));
  },
  async switchTo(p) { this.run("worlds/open", { path: p }, tf("Switching worlds…", "Смяна на света…")); },
  async move() {
    const p = await this.pick(tf("Choose an EMPTY folder to move this world into", "Изберете ПРАЗНА папка, в която да преместите света")); if (!p) return;
    if (!await confirmBox(tf(`Copy this world to “${p}” and use it from there? A backup is made first. The old folder is left untouched; delete it yourself once you've checked everything is there.`, `Да копирам ли света в „${p}“ и да го ползвам оттам? Първо се прави архив. Старата папка остава непокътната.`), tf("Move world", "Премести"))) return;
    this.run("worlds/move", { path: p }, tf("Copying your world…", "Копиране на света…"));
  },
  async forget(p) { await api("worlds/forget", { path: p }); Panes.refresh(); },
  async section(box) {
    const w = await api("worlds");
    box.innerHTML = `<div class="list">${w.worlds.map(x => `<div class="li"><span>${x.path === w.current ? "●" : "○"}</span><div class="main"><div class="t">${esc(x.name)}${x.path === w.current ? ` <span class="faint small">· ${tf("open now", "отворен")}</span>` : ""}</div><div class="d">${esc(x.path)}${x.exists ? "" : ` · <span style="color:var(--warn)">${tf("folder not found", "папката липсва")}</span>`}</div></div>
      ${x.path === w.current ? `<button class="btn small ghost" data-wopen="${esc(x.path)}">${tf("Show folder", "Покажи папката")}</button>` : `${x.exists ? `<button class="btn small" data-wswitch="${esc(x.path)}">${tf("Switch to it", "Превключи")}</button>` : ""}${x.path !== w.default ? `<button class="btn small ghost" data-wforget="${esc(x.path)}" title="${tf("Remove from this list (the folder is not deleted)", "Махни от списъка (папката не се изтрива)")}">✕</button>` : ""}`}</div>`).join("")}</div>
      <div class="row" style="margin-top:8px"><button class="btn small" data-wnew>＋ ${tf("New world", "Нов свят")}</button><button class="btn small" data-wadd>📁 ${tf("Open a world folder", "Отвори папка на свят")}</button><span class="spacer"></span><button class="btn small ghost" data-wmove>⇢ ${tf("Move this world…", "Премести света…")}</button></div>
      <div class="faint small" style="margin-top:6px">${tf("Each world is a normal folder of text files: keep it on any drive or in a synced folder. Backups, settings and colors belong to each world.", "Всеки свят е обикновена папка с текстови файлове. Архивите, настройките и цветовете са за всеки свят поотделно.")}</div>`;
    $$("[data-wopen]", box).forEach(b => b.onclick = () => api("open", { path: b.dataset.wopen }));
    $$("[data-wswitch]", box).forEach(b => b.onclick = () => this.switchTo(b.dataset.wswitch));
    $$("[data-wforget]", box).forEach(b => b.onclick = () => this.forget(b.dataset.wforget));
    $("[data-wnew]", box).onclick = () => this.newWorld();
    $("[data-wadd]", box).onclick = () => this.openWorld();
    $("[data-wmove]", box).onclick = () => this.move();
  },
};

// ------------------------------------------------------------------ first run / after an update
async function afterStart() {
  if (M.worldMissing) toast(tf(`Your world folder “${M.worldMissing}” wasn't found (unplugged drive?). Morgul opened the default world instead. Reconnect it and restart, or pick it in Settings → Worlds.`, `Папката на света „${M.worldMissing}“ не е намерена. Отворен е светът по подразбиране. Свържете я и рестартирайте или я изберете в Настройки → Светове.`), "error");
  const last = M.settings.lastVersion, cur = M.version.version;
  const fresh = !M.entries.size;
  if (last !== cur) M.settings = await api("settings", { lastVersion: cur });
  const whatsNew = () => { if (last && last !== cur) WhatsNew.show(last); else if (!last && !fresh) WhatsNew.show(null); };
  if ((M.settings.tourSeen || 0) < TOUR_VERSION) startTour(whatsNew);
  else if (last !== cur) whatsNew();
  if (M.settings.update_check !== false) setTimeout(() => Updates.check(false, true), 2500);
}
