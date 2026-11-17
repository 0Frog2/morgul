// Hover explanations: rest the mouse on a button, icon, sidebar item, badge or field name and a small box says what it is.
// Text comes from (in order) data-tip, a known button (data-a, sidebar views, footer), the button's own label, or its title.
// Settings → Hover explanations: normal, slow or off.
"use strict";

const TIP_TEXT = [
  // [English label, Bulgarian label, English explanation, Bulgarian explanation]
  ["Edit", "Промени", "Edit this entry: text, fields, type, tags, pictures.", "Промяна на записа: текст, полета, вид, етикети, картини."],
  ["Done", "Готово", "Stop editing. Everything is already saved.", "Край на редакцията. Всичко вече е запазено."],
  ["Open beside", "Отвори до", "Open this next to the current page, to read two things side by side.", "Отваря до текущата страница, за да четете две неща едно до друго."],
  ["Ask me questions", "Задай ми въпроси", "The AI helper asks you questions about this entry, one at a time. It never changes your text.", "AI помощникът ви задава въпроси за записа, един по един. Не променя текста ви."],
  ["Pin", "Закачи", "Keep this entry at the top of the Dashboard.", "Държи записа най-горе на таблото."],
  ["Unpin", "Откачи", "Remove it from the top of the Dashboard.", "Маха го от горната част на таблото."],
  ["Writing mode", "Режим на писане", "Hide everything but the text, for distraction-free writing.", "Скрива всичко освен текста, за писане без разсейване."],
  ["Selection → entry", "Избор → запис", "Turn the selected words into a new entry and a link to it.", "Прави избраните думи в нов запис и връзка към него."],
  ["Save", "Запази", "Save your changes.", "Запазва промените."],
  ["Cancel", "Отказ", "Close without changing anything.", "Затваря без промени."],
  ["Delete", "Изтрий", "Delete it. Entries go to the Trash, where you can bring them back.", "Изтрива го. Записите отиват в кошчето, откъдето могат да се върнат."],
  ["Undo", "Отмени", "Take back the last change.", "Връща последната промяна."],
  ["Generate", "Генерирай", "Make a new batch. Click a result to use it.", "Прави нова партида. Щракнете резултат, за да го използвате."],
  ["Random", "Случаен", "Make a random one. Press again for another.", "Прави случаен. Натиснете пак за друг."],
  ["New", "Нов", "Make a new one.", "Създава нов."],
  ["Close", "Затвори", "Close this window.", "Затваря прозореца."],
  ["Export", "Износ", "Make a website, PDF, Word file or World Bible from your world.", "Прави сайт, PDF, Word или Библия на света."],
  ["Import", "Внос", "Bring in .md, .txt or .docx files, whole folders, or pasted text. Headings decide where things go.", "Внася .md, .txt или .docx файлове, папки или поставен текст. Заглавията решават къде отиват нещата."],
  ["Restart", "Рестартирай", "Reload Morgul's code without closing the window.", "Презарежда кода на Morgul без да затваря прозореца."],
  ["Check for updates", "Провери за обновления", "Look on GitHub for a newer Morgul. Your world is never sent anywhere.", "Проверява в GitHub за по-нов Morgul. Светът ви не се изпраща никъде."],
  ["Update now", "Обнови сега", "Back up your world, download the new version and restart. Your world and settings are not touched.", "Прави копие на света, изтегля новата версия и рестартира. Светът и настройките не се пипат."],
  ["What's new", "Какво ново", "What changed in each version of Morgul.", "Какво се промени във всяка версия."],
  ["Show the tour", "Покажи обиколката", "The welcome tour again, step by step.", "Обиколката отново, стъпка по стъпка."],
  ["Fit", "Побери", "Zoom so everything fits on the screen.", "Мащаб, при който всичко се побира."],
  ["Present day", "Настоящ ден", "Jump to your world's present day.", "Отива на настоящия ден на света."],
  ["Date calculator", "Калкулатор за дати", "Add days, months or years to a date, or count the days between two dates, in your world's calendar.", "Добавя дни, месеци или години или брои дни между дати в календара на света."],
  ["Tidy up", "Подреди", "The AI cleans up the text: paragraphs, headings, spelling. You compare and decide; nothing changes until you accept.", "AI подрежда текста: абзаци, заглавия, правопис. Вие сравнявате и решавате; нищо не се променя без вас."],
  ["Resolved", "Решено", "Mark it resolved: a window asks how, with suggestions, and can add a to-do or a note to both entries.", "Отбелязва като решено: прозорец пита как, с предложения, и може да добави задача или бележка."],
  ["Intentional", "Нарочно", "It is meant to be like this (a lie, a legend, a mystery). A window asks why, with suggestions.", "Така трябва да е (лъжа, легенда, загадка). Прозорец пита защо, с предложения."],
  ["Save a milestone", "Запази етап", "Keep the whole world exactly as it is now, under a name.", "Пази целия свят точно както е сега, под име."],
  ["What changed", "Какво се промени", "New, changed and deleted entries since this milestone, with words added or cut.", "Нови, променени и изтрити записи от този етап насам."],
  ["Go back to this", "Върни се към това", "Return the whole world to this milestone. The present is saved as a milestone first.", "Връща целия свят към етапа. Настоящето първо се пази като етап."],
  ["Bring back", "Върни", "Restore this entry as it was then. The current text stays in its history.", "Връща записа както е бил. Сегашният текст остава в историята."],
  ["Note", "Бележка", "Add a sticky note.", "Добавя бележка."],
  ["Entry", "Запис", "Put entries from your world on the board.", "Слага записи от света на таблото."],
  ["Picture", "Картина", "Add pictures from your computer or ones already in the world. You can also drop files on the board.", "Добавя картини от компютъра или от света. Може и да пуснете файлове на таблото."],
  ["Color", "Цвят", "Add a colour swatch.", "Добавя цветна мостра."],
  ["Heading", "Заглавие", "Add a big heading to the board.", "Добавя голямо заглавие."],
  ["String", "Конец", "Tie two items with red string: click the first, then the second.", "Свързва две неща с червен конец: щракнете първото, после второто."],
  ["Roll", "Хвърли", "Roll the dice written in the box.", "Хвърля заровете от полето."],
  ["Next turn", "Следващ ход", "Move to the next fighter; after the last one a new round starts.", "Към следващия участник; след последния започва нов рунд."],
  ["Sort", "Подреди", "Order by initiative, highest first.", "Подрежда по инициатива, най-високата първа."],
  ["Start session", "Започни сесия", "Make the next Game session entry, carrying over loose threads and notes for next time.", "Създава следващата сесия и пренася висящите нишки."],
  ["Roll an encounter", "Хвърли среща", "Pick creatures that live in this place, with a count and extras.", "Избира създания, които живеят тук, с брой и добавки."],
  ["New land", "Нова суша", "A new random shape of land. Hand painting is cleared (labels stay).", "Нова случайна суша. Нарисуваното на ръка се изчиства (надписите остават)."],
  ["Name the regions", "Именувай областите", "Give every region a name in your world's style.", "Дава име на всяка област в стила на света."],
  ["Trace a map you have", "Прерисувай ваша карта", "Read land, sea, forests and mountains from your own map picture.", "Чете суша, море, гори и планини от картина на ваша карта."],
  ["Add a reference picture", "Добави картина за образец", "Show your own map see-through over the drawing, to paint along it. Never saved into the map.", "Показва вашата карта прозрачно върху рисунката. Не влиза в картата."],
  ["Make a map", "Създай карта", "Draw a new map in the map maker.", "Рисува нова карта."],
  ["Add a coat of arms", "Добави герб", "Design a coat of arms for this entry.", "Създава герб за записа."],
  ["As image", "Като изображение", "Add a picture of the arms to the entry's images, so it shows in the gallery, exports and the World Bible.", "Добавя картина на герба към изображенията на записа."],
  ["Add a stat block", "Добави характеристики", "Game statistics for this character or creature (for game masters).", "Игрови характеристики (за водещи на игри)."],
  ["To initiative", "Към инициатива", "Add this one to the initiative list on the Game master page.", "Добавя към инициативата на страницата за водещия."],
  ["All tools", "Всички инструменти", "Every tool in one place. ☆ pins a tool to the sidebar.", "Всички инструменти на едно място. ☆ закача инструмент в лентата."],
  ["Everything", "Всичко", "Every entry in your world, with filters and sorting.", "Всички записи, с филтри и подредба."],
  ["Center horizontally", "Центрирай хоризонтално", "Move the figures to the middle, left to right.", "Мести фигурите в средата, хоризонтално."],
  ["Center vertically", "Центрирай вертикално", "Move the figures to the middle, top to bottom.", "Мести фигурите в средата, вертикално."],
];
const TIP_BY_A = {      // entry page and editor buttons (data-a)
  edit: 0, done: 1, beside: 2, ask: 3, writing: 6, fromsel: 7,
  more: ["More: duplicate, history, template, delete, add a to-do, and other actions for this entry.", "Още: копие, история, шаблон, изтриване, задача и други действия."],
  map: ["Open the interactive map: pins, routes, layers.", "Отваря интерактивната карта: пинове, маршрути, слоеве."],
};
const TIP_NAV = {
  dashboard: ["Your starting page: what you worked on last, writing today, what needs attention.", "Началната страница: последната работа, писането днес, какво иска внимание."],
  build: ["The world-building path: questions in 11 stages, from the premise to the finished world, with how complete it is.", "Пътят на света: въпроси в 11 етапа, от идеята до готовия свят."],
  inbox: ["Quick notes waiting to be sorted into entries (Ctrl+Space adds one).", "Бързи бележки, които чакат да станат записи (Ctrl+Space добавя)."],
  todo: ["Your to-do list: things to write, check or decide.", "Задачи: какво да напишете, проверите или решите."],
  stuck: ["Ideas for what to work on: thin entries, missing names, open threads, questions. A ⚖ number means contradictions.", "Идеи над какво да работите: тънки записи, липсващи имена, отворени нишки. ⚖ са противоречия."],
  tools: ["Every tool in one place. ☆ pins a tool to the sidebar.", "Всички инструменти на едно място. ☆ закача инструмент в лентата."],
};
const TIP_FOOT = {
  captureBtn: ["Quick note: write something down fast; it goes to the Inbox (Ctrl+Space).", "Бърза бележка: запишете нещо бързо; отива във Входящи (Ctrl+Space)."],
  aiToggle: ["The AI helper: asks questions, points out contradictions, tidies text. It runs on your PC and never decides canon.", "AI помощникът: задава въпроси, посочва противоречия, подрежда текст. Работи на вашия компютър."],
  helpBtn: ["Help: the tour, keyboard keys, how everything works.", "Помощ: обиколката, клавишите, как работи всичко."],
  settingsBtn: ["Settings: world, calendar, types, theme, backups, AI, updates.", "Настройки: свят, календар, видове, тема, копия, AI, обновления."],
};
const TIP_STATUS = {
  canon: ["Canon: this is true in your world.", "Канон: това е вярно в света ви."],
  draft: ["Draft: still an idea; not settled yet.", "Чернова: още идея, не е решено."],
  scrapped: ["Scrapped: dropped, kept only for reference. Hidden from most lists.", "Отхвърлено: пазено само за справка."],
};
const TIP_FIELD_KIND = {
  date: ["A date in your calendar, like 14.3.512 AF.", "Дата в календара ви, напр. 14.3.512 AF."],
  link: ["A link to another entry. Click the chip to open it.", "Връзка към друг запис. Щракнете, за да го отворите."],
  links: ["Links to other entries.", "Връзки към други записи."],
  select: ["One of a few choices.", "Един от няколко избора."],
  number: ["A number.", "Число."],
};

const Tips = {
  box: null, timer: 0, cur: null,
  norm: s => String(s || "").replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim().toLowerCase(),
  index: null,
  lookup(label) {
    if (!this.index) { this.index = new Map(); TIP_TEXT.forEach(r => { this.index.set(this.norm(r[0]), r); this.index.set(this.norm(r[1]), r); }); }
    const r = this.index.get(this.norm(label)); return r ? tf(r[2], r[3]) : "";
  },
  textFor(el) {
    if (el.dataset.tip) return el.dataset.tip;
    const pair = p => Array.isArray(p) ? tf(p[0], p[1]) : typeof p === "number" ? tf(TIP_TEXT[p][2], TIP_TEXT[p][3]) : "";
    const short = el.dataset.tipTitle || el.getAttribute("title") || "";
    const keys = /^(ctrl|shift|alt)\+|^[A-Z]$/i.test(short) ? ` (${short})` : "";
    let tip = "";
    if (el.dataset.a && TIP_BY_A[el.dataset.a] !== undefined) tip = pair(TIP_BY_A[el.dataset.a]);
    else if (el.classList.contains("foot-btn") && TIP_FOOT[el.id]) tip = pair(TIP_FOOT[el.id]);
    else if (el.classList.contains("nav-item")) {
      const v = el.dataset.view, tool = typeof TOOLS !== "undefined" && TOOLS.find(x => x[0] === v);
      if (TIP_NAV[v]) tip = pair(TIP_NAV[v]);
      else if (tool) tip = `${tf(tool[2], tool[3])}: ${tf(tool[4], tool[5])}`;
      else if (v === "browse" && el.dataset.id) tip = tf(`All your ${typeName(el.dataset.id)} entries. Shift+click opens beside.`, `Всички записи от вид ${typeName(el.dataset.id)}. Shift+клик ги отваря отстрани.`);
      else if (v === "browse") tip = this.lookup("Everything");
      else if (v === "smart") tip = tf("A smart list you saved: entries that match its filters, kept up to date.", "Умен списък: записите, които отговарят на филтрите му.");
    } else if (el.classList.contains("status")) { const k = ["canon", "draft", "scrapped"].find(c => el.classList.contains(c)); if (k && !/🔒/.test(el.textContent)) tip = pair(TIP_STATUS[k]); else if (/🔒/.test(el.textContent)) tip = tf("Secret: left out of exports and shared views.", "Тайно: не влиза в износа."); }
    else if (el.dataset.contra !== undefined) tip = tf("Contradictions waiting for you to decide. Click to see them.", "Противоречия, които чакат вашето решение. Щракнете.");
    else if (el.classList.contains("count")) return "";
    if (!tip) tip = this.lookup(el.textContent);
    if (!tip && short && !keys) return short;
    return tip ? tip + keys : "";
  },
  show(el) {
    const text = this.textFor(el); if (!text) return;
    if (!this.box) { this.box = document.createElement("div"); this.box.className = "tipbox"; document.body.append(this.box); }
    this.box.textContent = text; this.box.style.display = "block";
    const r = el.getBoundingClientRect(), b = this.box.getBoundingClientRect();
    let x = Math.min(window.innerWidth - b.width - 8, Math.max(8, r.left + r.width / 2 - b.width / 2)), y = r.bottom + 8;
    if (y + b.height > window.innerHeight - 8) y = r.top - b.height - 8;
    this.box.style.left = x + "px"; this.box.style.top = y + "px";
  },
  hide() { clearTimeout(this.timer); this.cur = null; if (this.box) this.box.style.display = "none"; },
  mode: () => M.settings.tips || "on",
};
const TIP_TARGET = "[data-tip],[title],button,.nav-item,.status,.badge[data-contra],.fields .k,.chip[data-m],.chip[data-tab],.her-tin,.tool-tile .pin";
document.addEventListener("mouseover", ev => {
  if (Tips.mode() === "off") return;
  const el = ev.target.closest?.(TIP_TARGET); if (!el || el === Tips.cur) return;
  if (el.closest(".tipbox, .preview-pop, .hover-card")) return;
  // keep the browser's own grey tooltip out of the way; ours replaces it
  if (el.hasAttribute("title")) { el.dataset.tipTitle = el.getAttribute("title"); el.removeAttribute("title"); }
  Tips.hide(); Tips.cur = el;
  Tips.timer = setTimeout(() => { if (Tips.cur === el && el.isConnected) Tips.show(el); }, Tips.mode() === "slow" ? 1300 : 550);
}, true);
document.addEventListener("mouseout", ev => { if (Tips.cur && !Tips.cur.contains(ev.relatedTarget)) Tips.hide(); }, true);
["mousedown", "keydown", "wheel", "scroll"].forEach(k => document.addEventListener(k, () => Tips.hide(), true));

// field names on entry pages explain what kind of detail they are
(() => {
  const view = Views.entry;
  Views.entry = (el, route, pane) => {
    view(el, route, pane);
    const e = M.entries.get(route.id); if (!e) return;
    const ty = typeOf(e.type);
    $$(".fields .k", el).forEach(k => {
      const fd = ty.fields.find(f => fieldLabel(f) === k.textContent); if (!fd) return;
      const kind = TIP_FIELD_KIND[fd.kind];
      k.dataset.tip = `${k.textContent}${kind ? ": " + tf(kind[0], kind[1]) : ""} ${tf("Change it with Edit.", "Променя се с Промени.")}`;
    });
  };
})();

// Settings → Hover explanations
(() => {
  const view = Views.settings;
  Views.settings = (el, r, pane) => {
    view(el, r, pane);
    const host = $("[data-theme-editor]", el); if (!host) return;
    const card = document.createElement("div"); card.className = "card";
    card.innerHTML = `<h3>${tf("Hover explanations", "Обяснения при посочване")}</h3><p class="muted small">${tf("Rest the mouse on a button, icon or name and a small box says what it does.", "Задръжте мишката върху бутон, икона или име и малко поле казва какво прави.")}</p>
      <div class="row">${[["on", "Show quickly", "Бързо"], ["slow", "Show after a longer pause", "След по-дълга пауза"], ["off", "Off", "Изключени"]].map(([k, en, bg]) => `<label class="small"><input type="radio" name="tips" value="${k}" ${Tips.mode() === k ? "checked" : ""}> ${tf(en, bg)}</label>`).join("")}</div>`;
    host.after(card);
    $$("input[name=tips]", card).forEach(i => i.onchange = async () => { M.settings = await api("settings", { tips: i.value }); toast(t("Saved")); });
  };
})();
