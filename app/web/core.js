// Morgul core: state, server calls, translations, world calendar, links, panes.
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const uid = () => Math.random().toString(36).slice(2, 12);
const norm = s => String(s || "").trim().toLowerCase();
const words = s => (String(s || "").match(/[\p{L}\p{N}'’-]+/gu) || []).length;

const M = {
  entries: new Map(),       // id -> entry
  world: null,              // types, calendar, travel speeds (World/_morgul/world.json)
  settings: {},             // app settings (language, AI, backups)
  state: {},                // contradictions, sessions, pinned, recent
  root: "",
};

// ------------------------------------------------------------------ server
async function api(path, body, opts = {}) {
  const r = await fetch("/api/" + path, body === undefined ? {} : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), ...opts,
  });
  const ct = r.headers.get("Content-Type") || "";
  const data = ct.includes("json") ? await r.json() : await r.text();
  if (!r.ok) throw new Error(data?.error || `Request failed (${r.status})`);
  return data;
}
setInterval(() => fetch("/api/ping", { method: "POST" }).catch(() => {}), 8000);

// ------------------------------------------------------------------ colours (Settings → Colors)
const hexRgb = h => { const m = String(h).replace("#", "").match(/^([0-9a-f]{6})$/i); if (!m) return [0, 0, 0]; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const rgba = (h, a) => `rgba(${hexRgb(h).join(", ")}, ${a})`;
function applyTheme() {}           // replaced by theme.js
const localStamp = (d = new Date()) => new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
async function restartMorgul() {
  toast(tf("Restarting Morgul…", "Morgul се рестартира…"));
  try { await api("restart", {}); } catch {}
  await new Promise(r => setTimeout(r, 1500));
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch("/api/ai/status", { cache: "no-store" }); if (r.ok) { location.reload(); return; } } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  toast(tf("Morgul didn't come back. Close the window and open Morgul again.", "Morgul не се върна. Затворете прозореца и отворете Morgul отново."), "error");
}
const cssVar = k => getComputedStyle(document.documentElement).getPropertyValue("--" + k).trim();

// ------------------------------------------------------------------ translations (English / Bulgarian)
const BG = {
  "Help": "Помощ", "words": "думи",
  "Search": "Търсене", "Quick note": "Бърза бележка", "Settings": "Настройки", "Dashboard": "Табло", "Everything": "Всичко",
  "Inbox": "Входящи", "I'm stuck": "Заседнах", "Contradictions": "Противоречия", "Timeline": "Хронология", "Story": "История",
  "Maps": "Карти", "Alchemy & rituals": "Алхимия и ритуали", "Relationships": "Връзки", "Family trees": "Родословия",
  "World at a time": "Светът в даден момент", "Glossary & languages": "Речник и езици", "Name generator": "Генератор на имена",
  "World": "Свят", "Tools": "Инструменти", "Types": "Видове", "New": "Нов", "New entry": "Нов запис", "Save": "Запази",
  "Edit": "Редактирай", "Done": "Готово", "Delete": "Изтрий", "Cancel": "Отказ", "Close": "Затвори", "Add": "Добави",
  "Open beside": "Отвори до", "History": "История на версиите", "Where is this used?": "Къде се използва?", "Export": "Експорт",
  "Print / PDF": "Печат / PDF", "Writing mode": "Режим за писане", "Pin": "Закачи", "Unpin": "Откачи", "Tags": "Етикети",
  "Aliases": "Други имена", "Status": "Статус", "Canon": "Канон", "Draft": "Чернова", "Scrapped": "Отхвърлено", "Type": "Вид",
  "Images": "Изображения", "Drop images here or click": "Пуснете изображения тук или щракнете", "Links here": "Връзки към това",
  "Mentioned without a link": "Споменато без връзка", "Nothing links here yet.": "Още нищо не сочи насам.", "Title": "Заглавие",
  "Author-only notes": "Бележки само за автора", "Secret entry (never exported)": "Таен запис (не се експортира)",
  "Notes from question sessions": "Бележки от сесии с въпроси", "Keep in text": "Добави в текста", "Discard": "Изхвърли",
  "Recently edited": "Последно редактирани", "Pinned": "Закачени", "To fill in": "За доразвиване", "Open contradictions": "Отворени противоречия",
  "See all": "Виж всички", "words": "думи", "entries": "записа", "Filter…": "Филтър…", "All types": "Всички видове", "Sort": "Подреди",
  "Name": "Име", "Updated": "Обновено", "Created": "Създадено", "Nothing here yet.": "Още няма нищо тук.", "Undated": "Без дата",
  "Ask me questions": "Задай ми въпроси", "Start": "Започни", "Answer": "Отговор", "Skip": "Пропусни", "Stop": "Спри",
  "Resolved": "Решено", "Intentional": "Нарочно", "Reopen": "Отвори отново", "Check this entry": "Провери този запис",
  "Check whole world": "Провери целия свят", "AI helper": "AI помощник", "Ask about your world": "Питай за света си",
  "Year": "Година", "Language": "Език", "Translate": "Преведи", "Generate": "Генерирай", "Create": "Създай", "Back up now": "Архивирай сега",
  "Restore": "Възстанови", "Compare": "Сравни", "Layers": "Слоеве", "Pins": "Пинове", "Routes": "Маршрути", "Measure": "Мерило",
  "Untitled": "Без заглавие", "Delete this entry?": "Да изтрия ли този запис?", "Saved": "Запазено", "Who knows": "Кой знае",
};
const t = s => (M.settings.language === "bg" && BG[s]) || s;
const tf = (en, bg) => (M.settings.language === "bg" ? bg : en);

// ------------------------------------------------------------------ default world (types, calendar)
// The description the AI used before Settings → World existed; existing worlds keep it (editable there).
const LEGACY_ABOUT = "Dark medieval folk-horror inspired by Bulgarian and Slavic folklore, alchemy and esoterica.";
const F = (key, label, kind, extra = {}) => ({ key, label, kind, ...extra });
const DEFAULT_WORLD = {
  version: 1,
  types: [
    { key: "character", name: "Character", bg: "Персонаж", icon: "☺", color: "#8EB69B", fields: [
      F("species", "Species", "text"), F("faction", "Faction", "link", { to: ["faction"] }),
      F("life", "Status", "select", { options: ["alive", "dead", "unknown"] }),
      F("born", "Born", "date"), F("died", "Died", "date"), F("birthplace", "Birthplace", "link", { to: ["location"] }),
      F("appearance", "Appearance", "long"), F("personality", "Personality", "long"),
      F("firstAppearance", "First appearance", "link", { to: ["chapter"] }), F("arc", "Arc notes", "long"),
      F("relations", "Relationships", "relations") ] },
    { key: "location", name: "Location", bg: "Място", icon: "⌂", color: "#7FB0C9", fields: [
      F("kind", "Kind", "select", { options: ["world", "continent", "region", "country", "city", "village", "landmark", "building", "underground", "wilderness", "other"] }),
      F("partOf", "Part of", "link", { to: ["location"] }), F("ruler", "Ruled by", "link", { to: ["character", "faction", "entity"] }),
      F("founded", "Founded", "date"), F("destroyed", "Destroyed", "date"), F("population", "Population", "text"),
      F("government", "Government", "link", { to: ["government"] }), F("cultures", "Cultures", "links", { to: ["culture", "species"] }),
      F("economy", "Economy and trade", "long"), F("defenses", "Defenses", "long"), F("notable", "Notable places", "list") ] },
    { key: "event", name: "Event", bg: "Събитие", icon: "✦", color: "#D9A65A", fields: [
      F("date", "Date", "date"), F("endDate", "Ended", "date"), F("where", "Where", "link", { to: ["location"] }),
      F("participants", "Participants", "links", { to: ["character", "faction", "entity", "creature"] }),
      F("causes", "Caused by", "links", { to: ["event"] }), F("consequences", "Consequences", "long") ] },
    { key: "faction", name: "Faction", bg: "Фракция", icon: "⚑", color: "#C98F7F", fields: [
      F("kind", "Kind", "text"), F("leader", "Leader", "link", { to: ["character", "entity"] }), F("base", "Base", "link", { to: ["location"] }),
      F("founded", "Founded", "date"), F("dissolved", "Dissolved", "date"), F("allies", "Allies", "links", { to: ["faction", "entity"] }),
      F("enemies", "Enemies", "links", { to: ["faction", "entity"] }), F("goals", "Goals", "long") ] },
    { key: "entity", name: "Entity", bg: "Същност", icon: "◈", color: "#B79CD9", fields: [
      F("tier", "Tier", "select", { options: ["greater", "lesser", "other"] }), F("domain", "Domain", "text"),
      F("form", "Physical form", "long"), F("rules", "Rules over", "links", { to: ["location"] }) ] },
    { key: "creature", name: "Creature", bg: "Създание", icon: "♞", color: "#9DB86E", fields: [
      F("kind", "Kind", "text"), F("habitat", "Habitat", "links", { to: ["location"] }),
      F("abilities", "Abilities", "long"), F("weaknesses", "Weaknesses", "long") ] },
    { key: "item", name: "Item", bg: "Предмет", icon: "✧", color: "#C9B77F", fields: [
      F("owner", "Owner", "link", { to: ["character", "faction", "entity"] }), F("madeBy", "Made by", "link", { to: ["character", "faction", "entity"] }),
      F("origin", "Origin", "link", { to: ["location"] }), F("powers", "Powers", "long") ] },
    { key: "ingredient", name: "Ingredient", bg: "Съставка", icon: "❦", color: "#6EB89A", fields: [
      F("source", "Source", "text"), F("foundIn", "Found in", "links", { to: ["location"] }), F("properties", "Properties", "long") ] },
    { key: "potion", name: "Potion", bg: "Отвара", icon: "⚗", color: "#6EB8B1", fields: [
      F("ingredients", "Ingredients", "links", { to: ["ingredient"] }), F("effects", "Effects", "long"), F("brewTime", "Brew time", "text"),
      F("sideEffects", "Side effects", "long"), F("taughtBy", "Taught by", "link", { to: ["character", "entity", "faction"] }) ] },
    { key: "ritual", name: "Ritual", bg: "Ритуал", icon: "☽", color: "#C97F9E", fields: [
      F("risk", "Scale", "select", { options: ["minor", "major", "forbidden", "unknown"] }),
      F("components", "Components", "links", { to: ["ingredient", "item", "potion"] }), F("steps", "Steps", "steps"),
      F("conditions", "Conditions", "long"), F("consequences", "Consequences & cost", "long"),
      F("knownBy", "Known by", "links", { to: ["faction", "character", "entity"] }) ] },
    { key: "rule", name: "Magic rule", bg: "Правило на магията", icon: "§", color: "#8EB69B", fields: [ F("domain", "Applies to", "text") ] },
    { key: "concept", name: "Concept", bg: "Понятие", icon: "◇", color: "#8EA5B6", fields: [] },
    { key: "culture", name: "Culture", bg: "Култура", icon: "❖", color: "#C9A26B", fields: [
      F("homeland", "Homeland", "links", { to: ["location"] }), F("peoples", "Peoples", "links", { to: ["species"] }), F("language", "Language", "link", { to: ["language"] }),
      F("religions", "Religions", "links", { to: ["religion", "deity", "entity"] }), F("values", "Values and beliefs", "long"), F("customs", "Customs and rites of passage", "long"),
      F("food", "Food and drink", "long"), F("dress", "Dress and appearance", "long"), F("arts", "Arts, music and stories", "long"), F("taboos", "Taboos and crimes", "long") ] },
    { key: "religion", name: "Religion", bg: "Религия", icon: "☩", color: "#B49ACB", fields: [
      F("deities", "Gods and powers", "links", { to: ["deity", "entity"] }), F("followers", "Followers", "links", { to: ["culture", "faction", "location", "species"] }),
      F("holySites", "Holy places", "links", { to: ["location"] }), F("founded", "Founded", "date"), F("beliefs", "Core beliefs", "long"), F("practices", "Worship and rituals", "long"),
      F("clergy", "Clergy and hierarchy", "long"), F("afterlife", "Death and the afterlife", "long"), F("heresies", "Schisms and heresies", "long") ] },
    { key: "deity", name: "Deity", bg: "Божество", icon: "☼", color: "#D8C27A", fields: [
      F("domain", "Domain", "text"), F("pantheon", "Religion", "link", { to: ["religion"] }), F("symbol", "Symbol", "text"),
      F("form", "Appearance", "long"), F("worshippers", "Worshipped by", "links", { to: ["culture", "faction", "species"] }), F("myths", "Myths", "long"), F("demands", "What they ask of mortals", "long") ] },
    { key: "species", name: "Species", bg: "Раса", icon: "❂", color: "#9CC48A", fields: [
      F("lifespan", "Lifespan", "text"), F("homeland", "Homeland", "links", { to: ["location"] }), F("appearance", "Appearance", "long"),
      F("traits", "Traits and abilities", "long"), F("cultures", "Cultures", "links", { to: ["culture"] }), F("origin", "Origin", "long") ] },
    { key: "government", name: "Government", bg: "Управление", icon: "♛", color: "#C98F6A", fields: [
      F("kind", "Kind", "select", { options: ["monarchy", "empire", "theocracy", "republic", "council", "tribe", "occupation", "other"] }),
      F("realm", "Rules over", "links", { to: ["location"] }), F("ruler", "Ruler", "link", { to: ["character", "faction", "entity"] }), F("seat", "Seat", "link", { to: ["location"] }),
      F("founded", "Founded", "date"), F("laws", "Laws and justice", "long"), F("succession", "Succession", "long"), F("army", "Army and enforcement", "long"), F("currency", "Currency", "link", { to: ["currency"] }) ] },
    { key: "currency", name: "Currency", bg: "Валута", icon: "¤", color: "#D9B65A", fields: [
      F("usedIn", "Used in", "links", { to: ["location", "government"] }), F("material", "Made of", "text"), F("denominations", "Coins and values", "list"), F("prices", "What things cost", "long") ] },
    { key: "holiday", name: "Holiday", bg: "Празник", icon: "✺", color: "#E09A7A", fields: [
      F("when", "When", "text"), F("religion", "Religion", "link", { to: ["religion", "deity"] }), F("cultures", "Celebrated by", "links", { to: ["culture", "location"] }),
      F("customs", "Customs", "long"), F("origin", "Origin", "long") ] },
    { key: "book", name: "Book", bg: "Книга", icon: "❡", color: "#E0C9A6", fields: [
      F("order", "Number in series", "number"), F("subtitle", "Subtitle", "text"), F("author", "Author name", "text"),
      F("stage", "Stage", "select", { options: ["planning", "drafting", "revising", "finished"] }), F("wordGoal", "Word goal", "number"), F("blurb", "Blurb", "long") ] },
    { key: "chapter", name: "Chapter", bg: "Глава", icon: "¶", color: "#DAF1DE", fields: [
      F("order", "Number", "number"), F("progress", "Progress", "select", { options: ["idea", "outline", "draft", "done"] }),
      F("pov", "Point of view", "link", { to: ["character"] }), F("date", "Story date", "date"), F("summary", "Summary", "long"),
      F("book", "Book", "link", { to: ["book"] }), F("wordGoal", "Word goal", "number") ] },
    { key: "scene", name: "Scene", bg: "Сцена", icon: "⁂", color: "#BFD8C4", fields: [
      F("chapter", "Chapter", "link", { to: ["chapter"] }), F("order", "Order in chapter", "number"),
      F("progress", "Progress", "select", { options: ["idea", "outline", "draft", "revised", "done"] }), F("pov", "Point of view", "link", { to: ["character"] }),
      F("where", "Where", "link", { to: ["location"] }), F("date", "Story date", "date"), F("summary", "What happens", "long"), F("wordGoal", "Word goal", "number") ] },
    { key: "thread", name: "Plot thread", bg: "Сюжетна нишка", icon: "⟿", color: "#D9A65A", fields: [
      F("open", "State", "select", { options: ["open", "resolved", "dropped"] }), F("question", "The question", "long"),
      F("planted", "Set up in", "links"), F("payoff", "Pays off in", "links") ] },
    { key: "secret", name: "Secret", bg: "Тайна", icon: "⚿", color: "#C97F7F", fields: [
      F("truth", "The truth", "long"), F("knownBy", "Who knows", "knowers") ] },
    { key: "language", name: "Language", bg: "Език", icon: "ᚠ", color: "#A3B86E", fields: [
      F("culture", "Spoken by", "links", { to: ["faction", "location", "creature", "entity"] }),
      F("syllables", "Syllables for names", "text", { hint: "e.g. mor, vel, ka, dra, -ov, -ina" }),
      F("sampleNames", "Sample names", "list"), F("roots", "Dictionary (word = meaning)", "list"), F("grammar", "Grammar & sound rules", "long") ] },
    { key: "term", name: "Glossary term", bg: "Термин", icon: "Aa", color: "#8EB69B", fields: [
      F("pronunciation", "Pronunciation", "text"), F("language", "Language", "link", { to: ["language"] }), F("meaning", "Meaning", "long") ] },
    { key: "map", name: "Map", bg: "Карта", icon: "⌖", color: "#7FB0C9", fields: [ F("of", "Map of", "link", { to: ["location"] }) ] },
    { key: "note", name: "Note", bg: "Бележка", icon: "✎", color: "#8EA5B6", fields: [] },
    { key: "session", name: "Game session", bg: "Игрова сесия", icon: "⚄", color: "#B79AD6", fields: [
      F("number", "Session number", "number"), F("played", "Played on", "text"), F("date", "In-world date", "date"), F("players", "Players", "text"),
      F("where", "Where", "link", { to: ["location"] }) ] },
  ],
  important: {   // fields whose absence makes an entry show up under "I'm stuck"
    character: ["born", "appearance", "personality", "faction"], location: ["kind", "partOf"], event: ["date", "participants"],
    faction: ["leader", "base", "goals"], entity: ["tier", "domain", "form"], creature: ["abilities", "weaknesses"],
    potion: ["ingredients", "effects", "sideEffects"], ritual: ["components", "steps", "consequences"], ingredient: ["properties"],
    chapter: ["summary"], term: ["meaning", "pronunciation"], language: ["roots"], secret: ["knownBy"], item: ["powers"],
  },
  calendar: {
    // a neutral starting calendar for new worlds (existing worlds keep their own, saved in world.json)
    eras: [ { name: "Before the Founding", abbr: "BF", start: -100000, backwards: true }, { name: "After the Founding", abbr: "AF", start: 0 } ],
    months: Array.from({ length: 12 }, (_, i) => ({ name: `Month ${i + 1}`, days: 30 })),
    present: 1,
  },
  relationKinds: ["parent", "child", "spouse", "sibling", "lover", "friend", "ally", "mentor", "student", "master", "servant", "rival", "enemy", "other"],
  travel: { unit: "km", speeds: [ { name: "On foot", perDay: 25 }, { name: "Horseback", perDay: 50 }, { name: "Cart", perDay: 30 } ] },
};

const FIELD_BG = {
  "Session number": "Номер на сесията", "Played on": "Играна на", "In-world date": "Дата в света", "Players": "Играчи",
  "Number in series": "Номер в поредицата", "Subtitle": "Подзаглавие", "Author name": "Име на автора", "Stage": "Етап", "Word goal": "Цел (думи)", "Blurb": "Анотация",
  "Book": "Книга", "Chapter": "Глава", "Order in chapter": "Ред в главата", "What happens": "Какво се случва",
  "Government": "Управление", "Cultures": "Култури", "Economy and trade": "Икономика и търговия", "Defenses": "Отбрана", "Notable places": "Забележителни места",
  "Homeland": "Родина", "Peoples": "Народи", "Language": "Език", "Religions": "Религии", "Values and beliefs": "Ценности и вярвания", "Customs and rites of passage": "Обичаи и обреди",
  "Food and drink": "Храна и напитки", "Dress and appearance": "Облекло и външност", "Arts, music and stories": "Изкуство, музика и предания", "Taboos and crimes": "Табута и престъпления",
  "Gods and powers": "Богове и сили", "Followers": "Последователи", "Holy places": "Свети места", "Core beliefs": "Основни вярвания", "Worship and rituals": "Поклонение и ритуали",
  "Clergy and hierarchy": "Духовенство и йерархия", "Death and the afterlife": "Смърт и отвъдно", "Schisms and heresies": "Разколи и ереси", "Religion": "Религия", "Symbol": "Символ",
  "Worshipped by": "Почитан от", "Myths": "Митове", "What they ask of mortals": "Какво искат от смъртните", "Lifespan": "Продължителност на живота", "Traits and abilities": "Черти и способности",
  "Origin": "Произход", "Rules over": "Управлява", "Ruler": "Владетел", "Seat": "Седалище", "Laws and justice": "Закони и правосъдие", "Succession": "Наследяване",
  "Army and enforcement": "Армия и ред", "Currency": "Валута", "Used in": "Използва се в", "Made of": "Материал", "Coins and values": "Монети и стойности", "What things cost": "Цени",
  "When": "Кога", "Celebrated by": "Празнува се от", "Customs": "Обичаи",
  "Species": "Вид", "Faction": "Фракция", "Status": "Статус", "Born": "Роден", "Died": "Починал", "Birthplace": "Родно място", "Appearance": "Външност",
  "Personality": "Характер", "First appearance": "Първа поява", "Arc notes": "Развитие", "Relationships": "Връзки", "Kind": "Вид", "Part of": "Част от",
  "Ruled by": "Управлява се от", "Founded": "Основано", "Destroyed": "Разрушено", "Population": "Население", "Date": "Дата", "Ended": "Край", "Where": "Къде",
  "Participants": "Участници", "Caused by": "Причина", "Consequences": "Последици", "Leader": "Водач", "Base": "База", "Dissolved": "Разпусната",
  "Allies": "Съюзници", "Enemies": "Врагове", "Goals": "Цели", "Tier": "Ранг", "Domain": "Сфера", "Physical form": "Физическа форма", "Rules over": "Властва над",
  "Crossed the Rift": "Преминава Разлома", "Habitat": "Обитава", "Abilities": "Способности", "Weaknesses": "Слабости", "Owner": "Притежател", "Made by": "Изработен от",
  "Origin": "Произход", "Powers": "Сили", "Source": "Източник", "Found in": "Среща се в", "Properties": "Свойства", "Ingredients": "Съставки", "Effects": "Действие",
  "Brew time": "Време за варене", "Side effects": "Странични ефекти", "Taught by": "Научено от", "Scale": "Мащаб", "Components": "Компоненти", "Steps": "Стъпки",
  "Conditions": "Условия", "Consequences & cost": "Последици и цена", "Known by": "Известно на", "Applies to": "Важи за", "Number": "Номер", "Progress": "Напредък",
  "Point of view": "Гледна точка", "Story date": "Дата в историята", "Summary": "Резюме", "State": "Състояние", "The question": "Въпросът", "Set up in": "Заложено в",
  "Pays off in": "Развръзка в", "The truth": "Истината", "Who knows": "Кой знае", "Spoken by": "Говори се от", "Syllables for names": "Срички за имена",
  "Sample names": "Примерни имена", "Dictionary (word = meaning)": "Речник (дума = значение)", "Grammar & sound rules": "Граматика и звукови правила",
  "Pronunciation": "Произношение", "Language": "Език", "Meaning": "Значение", "Map of": "Карта на",
};
const fieldLabel = fd => (M.settings.language === "bg" && FIELD_BG[fd.label]) || fd.label;
const typeOf = key => M.world.types.find(x => x.key === key) || { key, name: key, icon: "•", color: "#8EB69B", fields: [] };
const typeName = key => { const ty = typeOf(key); return M.settings.language === "bg" && ty.bg ? ty.bg : ty.name; };

// ------------------------------------------------------------------ world calendar
// internal date string "Y.M.D" (Y = absolute year, may be negative; month/day optional)
const Cal = {
  parse(input) {
    let s = String(input || "").trim();
    if (!s) return "";
    const cal = M.world.calendar;
    let era = null;
    for (const e of cal.eras) {
      const rx = new RegExp(`\\s*\\b${e.abbr}\\b\\.?\\s*$`, "i");
      if (rx.test(s)) { era = e; s = s.replace(rx, "").trim(); }
    }
    // month by name: "14 Izok 512"
    const named = s.match(/^(\d{1,3})?\s*([\p{L}]+)\s+(-?\d+)$/u);
    let y, m, d;
    if (named) {
      const mi = cal.months.findIndex(x => norm(x.name).startsWith(norm(named[2]).slice(0, 3)));
      if (mi < 0) return null;
      y = +named[3]; m = mi + 1; d = named[1] ? +named[1] : 0;
    } else {
      const p = s.split(/[./\-\s]+/).filter(Boolean).map(Number);
      if (!p.length || p.length > 3 || p.some(isNaN)) return null;
      // day.month.year (14.3.512) · month.year (3.512) · year — or year.month.day when the first number is clearly a year
      if (p.length === 3) [d, m, y] = p[0] > 31 ? [p[2], p[1], p[0]] : p;
      else if (p.length === 2) [m, y] = p[0] > 12 ? [p[1], p[0]] : p;
      else [y] = p;
      if (m > cal.months.length || m < 0 || d < 0 || (m && d > (cal.months[m - 1]?.days || 31))) return null;
    }
    era = era || cal.eras[cal.eras.length - 1];
    let abs;
    if (era.backwards) { const next = Cal.nextStart(era); abs = next - y; }
    else abs = era.start + y - 1;
    return [abs, m || "", d || ""].join(".").replace(/\.+$/, "");
  },
  nextStart(era) { const eras = M.world.calendar.eras; const i = eras.indexOf(era); return eras[i + 1]?.start ?? 0; },
  parts(v) { if (v === "" || v == null) return null; const [y, m, d] = String(v).split(".").map(Number); return { y, m: m || 0, d: d || 0 }; },
  key(v) { const p = Cal.parts(v); return p ? p.y * 10000 + p.m * 100 + p.d : null; },
  eraOf(y) { const eras = [...M.world.calendar.eras].sort((a, b) => a.start - b.start); let e = eras[0]; for (const x of eras) if (y >= x.start) e = x; return e; },
  yearLabel(y) { const e = Cal.eraOf(y); const n = e.backwards ? Cal.nextStart(e) - y : y - e.start + 1; return `${n} ${e.abbr}`; },
  format(v) {
    const p = Cal.parts(v); if (!p) return "";
    const mon = p.m ? M.world.calendar.months[p.m - 1]?.name || `Month ${p.m}` : "";
    return [p.d || "", mon, Cal.yearLabel(p.y)].filter(Boolean).join(" ");
  },
  input(v) { const p = Cal.parts(v); if (!p) return ""; const e = Cal.eraOf(p.y); const n = e.backwards ? Cal.nextStart(e) - p.y : p.y - e.start + 1;
    return [p.d || "", p.m || "", n].filter(x => x !== "").join(".") + " " + e.abbr; },
  yearsBetween(a, b) {   // full years from a to b
    const A = Cal.parts(a), B = Cal.parts(b); if (!A || !B) return null;
    let n = B.y - A.y; if (A.m && B.m && (B.m < A.m || (B.m === A.m && A.d && B.d && B.d < A.d))) n--; return n;
  },
  present() { const c = M.world.calendar; return c.presentDate && Cal.parts(c.presentDate) ? Cal.parts(c.presentDate).y : (c.present ?? 0); },
};

// ------------------------------------------------------------------ entries & links
const Idx = {
  byTitle: new Map(),        // lowercased title/alias -> id
  backlinks: new Map(),      // id -> [{from, via}]
  missing: new Map(),        // lower title -> {title, from:Set}
  rebuild() {
    Idx.byTitle.clear(); Idx.backlinks.clear(); Idx.missing.clear();
    for (const e of M.entries.values()) {
      Idx.byTitle.set(norm(e.title), e.id);
      for (const a of e.aliases || []) if (!Idx.byTitle.has(norm(a))) Idx.byTitle.set(norm(a), e.id);
    }
    const add = (to, from, via) => { if (!to || to === from) return; const l = Idx.backlinks.get(to) || []; if (!l.some(x => x.from === from && x.via === via)) l.push({ from, via }); Idx.backlinks.set(to, l); };
    for (const e of M.entries.values()) {
      for (const name of linksIn(e.body)) {
        const id = Idx.byTitle.get(norm(name));
        if (id) add(id, e.id, "text");
        else { const k = norm(name); const m = Idx.missing.get(k) || { title: name, from: new Set() }; m.from.add(e.id); Idx.missing.set(k, m); }
      }
      for (const f of typeOf(e.type).fields) {
        const v = e.fields?.[f.key];
        if (f.kind === "link") add(v, e.id, f.label);
        if (f.kind === "links") (v || []).forEach(x => add(x, e.id, f.label));
        if (f.kind === "relations") (v || []).forEach(r => add(r.to, e.id, r.kind));
        if (f.kind === "knowers") (v || []).forEach(r => { add(r.who, e.id, f.label); add(r.since, e.id, f.label); });
      }
      (e.map?.pins || []).forEach(p => add(p.entry, e.id, "Map pin"));
    }
  },
  find(name) { const id = Idx.byTitle.get(norm(name)); return id ? M.entries.get(id) : null; },
};
function linksIn(text) {
  const out = []; const rx = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g; let m;
  while ((m = rx.exec(text || ""))) out.push(m[1].trim());
  return out;
}
function summary(e, n = 220) {
  const raw = String(e?.body || "").replace(/:::secret[\s\S]*?:::/g, "").replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g, (_, a, b) => b || a)
    .replace(/[#>*_`|]/g, "").replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  return raw.length > n ? raw.slice(0, n).replace(/\s\S*$/, "") + "…" : raw;
}
// choice-field values are stored as plain keys ("open", "alive"); people see a proper label in their language
const OPTION_LABELS = {
  alive: ["Alive", "Жив"], dead: ["Dead", "Мъртъв"], unknown: ["Unknown", "Неизвестно"],
  world: ["World", "Свят"], continent: ["Continent", "Континент"], region: ["Region", "Област"], country: ["Country", "Държава"], city: ["City", "Град"],
  village: ["Village", "Село"], landmark: ["Landmark", "Забележителност"], building: ["Building", "Сграда"], underground: ["Underground", "Подземие"],
  wilderness: ["Wilderness", "Пустош"], other: ["Other", "Друго"], greater: ["Greater", "Висше"], lesser: ["Lesser", "Низше"],
  minor: ["Minor", "Малък"], major: ["Major", "Голям"], forbidden: ["Forbidden", "Забранен"],
  monarchy: ["Monarchy", "Монархия"], empire: ["Empire", "Империя"], theocracy: ["Theocracy", "Теокрация"], republic: ["Republic", "Република"],
  council: ["Council", "Съвет"], tribe: ["Tribe", "Племе"], occupation: ["Occupation", "Окупация"],
  planning: ["Planning", "Планиране"], drafting: ["Drafting", "Чернова"], revising: ["Revising", "Редакция"], finished: ["Finished", "Завършена"],
  idea: ["Idea", "Идея"], outline: ["Outline", "План"], draft: ["Draft", "Чернова"], revised: ["Revised", "Редактирана"], done: ["Done", "Готова"],
  open: ["Open", "Отворена"], resolved: ["Resolved", "Разрешена"], dropped: ["Dropped", "Изоставена"],
};
function optLabel(v) {
  const s = String(v ?? ""), l = OPTION_LABELS[s.toLowerCase()];
  if (l) return tf(l[0], l[1]);
  return s ? s[0].toUpperCase() + s.slice(1) : s;        // the author's own options: just a capital letter
}
// "2026-11-13T14:35:10" → "13 Nov 2026, 14:35" (or "13 ное 2026, 14:35")
function niceStamp(iso) {
  const d = new Date(iso); if (!iso || isNaN(d)) return "";
  const loc = M.settings.language === "bg" ? "bg-BG" : "en-GB";
  return `${d.toLocaleDateString(loc, { day: "numeric", month: "short", year: "numeric" })}, ${d.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" })}`;
}
const titleOf = id => M.entries.get(id)?.title || "";
const entriesOf = (...types) => [...M.entries.values()].filter(e => types.includes(e.type));
const sortByTitle = a => a.sort((x, y) => x.title.localeCompare(y.title));

async function saveEntry(e, prevTitle, snapshot = true) {
  const r = await api("entry", { entry: e, prevTitle, snapshot });
  M.entries.set(r.entry.id, r.entry);
  for (const c of r.changed || []) M.entries.set(c.id, c);
  Idx.rebuild();
  Bus.emit("entries");
  if (r.changed?.length) toast(tf(`Renamed — updated links in ${r.changed.length} other entries.`, `Преименувано — обновени връзки в ${r.changed.length} записа.`));
  return r.entry;
}
async function createEntry(type, title = "", extra = {}) {
  const e = { id: uid(), type, title: title || t("Untitled"), status: "draft", tags: [], aliases: [], fields: {}, body: "", ...extra };
  return saveEntry(e);
}
async function deleteEntry(id) {
  await api("entry/delete", { id });
  M.entries.delete(id); Idx.rebuild(); Bus.emit("entries");
}
const saveState = debounce(() => api("state", M.state).catch(e => toast(e.message, "error")), 400);
const saveWorld = () => api("world", M.world);
function touchRecent(id) {
  const r = (M.state.recent || []).filter(x => x !== id); r.unshift(id); M.state.recent = r.slice(0, 30); saveState();
}

// ------------------------------------------------------------------ tiny event bus
const Bus = { h: {}, on(n, f) { (this.h[n] = this.h[n] || []).push(f); }, emit(n, ...a) { (this.h[n] || []).forEach(f => f(...a)); } };

// ------------------------------------------------------------------ UI helpers
function toast(text, kind = "") {
  const d = document.createElement("div"); d.className = "toast " + kind; d.textContent = text;
  $("#toasts").appendChild(d); setTimeout(() => d.remove(), kind === "error" ? 6000 : 3200);
}
function modal(title, html, { wide = false, buttons = [], onOpen } = {}) {
  return new Promise(res => {
    // a dialog opened from inside another one sits on top of it, and the one below comes back when it closes
    const base = $("#overlay"), stacked = !!base.innerHTML.trim();
    const ov = stacked ? Object.assign(document.createElement("div"), { className: "overlay-stack" }) : base;
    if (stacked) document.body.append(ov);
    modal.stack = [...(modal.stack || []), ov];
    ov.innerHTML = `<div class="backdrop"><div class="modal ${wide ? "wide" : ""}">${title ? `<div class="mh">${esc(title)}</div>` : ""}
      <div class="mb">${html}</div>${buttons.length ? `<div class="mf">${buttons.map((b, i) => `<button class="btn ${b.cls || ""}" data-i="${i}">${esc(b.label)}</button>`).join("")}</div>` : ""}</div></div>`;
    const close = v => { ov.innerHTML = ""; if (stacked) ov.remove(); modal.stack = modal.stack.filter(x => x !== ov); document.removeEventListener("keydown", key); res(v); };
    const key = ev => { if (ev.key === "Escape" && modal.stack[modal.stack.length - 1] === ov) { ev.stopImmediatePropagation(); close(null); } };
    document.addEventListener("keydown", key);
    $(".backdrop", ov).addEventListener("mousedown", ev => { if (ev.target.classList.contains("backdrop")) close(null); });
    $$(".mf .btn", ov).forEach(b => b.onclick = () => { const btn = buttons[+b.dataset.i]; close(btn.value !== undefined ? (typeof btn.value === "function" ? btn.value(ov) : btn.value) : b.dataset.i); });
    onOpen && onOpen(ov, close);
  });
}
const confirmBox = (text, yes = t("Delete")) => modal("", `<div style="font-size:15px">${esc(text)}</div>`,
  { buttons: [{ label: t("Cancel"), value: false }, { label: yes, cls: "primary", value: true }] });
async function promptBox(title, value = "", placeholder = "") {
  return modal(title, `<input class="input" id="pb" value="${esc(value)}" placeholder="${esc(placeholder)}">`, {
    buttons: [{ label: t("Cancel"), value: null }, { label: "OK", cls: "primary", value: ov => $("#pb", ov).value.trim() }],
    onOpen: (ov, close) => { const i = $("#pb", ov); i.focus(); i.select(); i.onkeydown = e => { if (e.key === "Enter") close(i.value.trim()); }; },
  });
}
function lightbox(src) {
  const d = document.createElement("div"); d.className = "lightbox"; d.innerHTML = `<img src="${esc(src)}">`;
  d.onclick = () => d.remove(); document.body.appendChild(d);
  const k = e => { if (e.key === "Escape") { d.remove(); document.removeEventListener("keydown", k); } }; document.addEventListener("keydown", k);
}
function chipFor(id, opts = {}) {
  const e = M.entries.get(id);
  if (!e) return opts.missing ? `<span class="chip" style="color:var(--warn)">${esc(opts.missing)}</span>` : "";
  return `<span class="chip" data-open="${e.id}"><span class="type-dot" style="background:${typeOf(e.type).color}"></span>${esc(e.title)}${opts.x ? `<span class="x" data-x="${e.id}">✕</span>` : ""}</span>`;
}
const img = f => `/assets/${encodeURIComponent(f)}`;

// ------------------------------------------------------------------ panes & routing
// route = {view, id?, ...}. Pane 0 follows the address bar; pane 1 is the side-by-side view.
const Views = {};
const Panes = {
  cur: [null, null],
  show(route, pane = 0) {
    if (pane === 1) $("#pane1").hidden = false;
    Panes.cur[pane] = route;
    const el = $(`#pane${pane}`);
    const v = Views[route.view] || Views.dashboard;
    el.innerHTML = "";
    v(el, route, pane);
    if (pane === 0) { const h = "#" + encodeRoute(route); if (location.hash !== h) history.pushState(null, "", h); Nav.mark(route); }
    if (route.view === "entry") touchRecent(route.id);
  },
  refresh(pane) { [0, 1].forEach(p => { if ((pane === undefined || pane === p) && Panes.cur[p] && !$(`#pane${p}`).hidden) Panes.show(Panes.cur[p], p); }); },
  closeSide() { $("#pane1").hidden = true; $("#pane1").innerHTML = ""; Panes.cur[1] = null; },
};
const encodeRoute = r => [r.view, r.id || r.type || ""].filter(Boolean).map(encodeURIComponent).join("/");
function decodeRoute(h) {
  const [view, a] = h.replace(/^#/, "").split("/").map(decodeURIComponent);
  if (!view) return { view: "dashboard" };
  if (view === "entry") return { view, id: a };
  if (view === "browse") return { view, type: a };
  return { view, id: a };
}
window.addEventListener("popstate", () => Panes.show(decodeRoute(location.hash), 0));
const open = (id, side = false) => Panes.show({ view: "entry", id }, side ? 1 : 0);

function paneHead(title, actions = "", pane = 0) {
  return `<div class="pane-head"><h2>${title}</h2>${actions}${pane === 1 ? `<button class="btn icon ghost" data-close-pane title="${t("Close")}">✕</button>` : ""}</div>`;
}

// global click delegation: chips, wiki links, closing the side pane
document.addEventListener("click", ev => {
  const x = ev.target.closest("[data-close-pane]"); if (x) { Panes.closeSide(); return; }
  const a = ev.target.closest("[data-open]");
  if (a && !ev.target.closest("[data-x]")) { ev.preventDefault(); open(a.dataset.open, ev.shiftKey || ev.ctrlKey || !!a.closest("#pane1")); return; }
  const w = ev.target.closest(".wl");
  if (w) {
    ev.preventDefault();
    const e = Idx.find(w.dataset.title);
    if (e) open(e.id, ev.shiftKey || ev.ctrlKey || !!w.closest("#pane1"));
    else createFromMissing(w.dataset.title);
  }
});
async function createFromMissing(title) {
  const types = M.world.types.filter(x => x.key !== "map");
  const pick = await modal(tf(`“${title}” has no entry yet`, `„${title}“ още няма запис`),
    `<div class="muted" style="margin-bottom:10px">${tf("Create it as:", "Създай го като:")}</div><div class="row">${types.map(x => `<button class="chip" data-k="${x.key}">${x.icon} ${esc(typeName(x.key))}</button>`).join("")}</div>`,
    { onOpen: (ov, close) => $$("[data-k]", ov).forEach(b => b.onclick = () => close(b.dataset.k)) });
  if (!pick) return;
  const e = await createEntry(pick, title);
  open(e.id);
}

// hover previews for links and chips
(() => {
  let timer, cur;
  const card = $("#hover");
  document.addEventListener("mouseover", ev => {
    const el = ev.target.closest(".wl, [data-open]");
    if (el === cur) return;
    cur = el; clearTimeout(timer); card.hidden = true;
    if (!el) return;
    timer = setTimeout(() => {
      const e = el.dataset.open ? M.entries.get(el.dataset.open) : Idx.find(el.dataset.title);
      if (!e) { if (el.classList.contains("wl")) { card.innerHTML = `<div class="t">${esc(el.dataset.title)}</div><div class="d">${tf("No entry yet — click to create it.", "Още няма запис — щракнете, за да го създадете.")}</div>`; } else return; }
      else {
        const pic = (e.images || [])[0];
        card.innerHTML = `${pic ? `<div class="thumb" style="background-image:url('${img(pic)}')"></div>` : ""}<div class="row"><span class="type-dot" style="background:${typeOf(e.type).color}"></span><span class="faint small">${esc(typeName(e.type))}</span><span class="status ${e.status || "draft"} spacer" style="flex:0"></span></div>
          <div class="t">${esc(e.title)}</div><div class="d">${esc(summary(e, 320)) || `<i>${tf("Empty so far", "Засега празно")}</i>`}</div>`;
      }
      const r = el.getBoundingClientRect();
      card.hidden = false;
      const top = r.bottom + 8 + card.offsetHeight > innerHeight ? r.top - card.offsetHeight - 8 : r.bottom + 8;
      card.style.top = Math.max(8, top) + "px"; card.style.left = Math.min(innerWidth - 336, Math.max(8, r.left)) + "px";
    }, 380);
  });
  document.addEventListener("mousedown", () => { clearTimeout(timer); card.hidden = true; });
})();
