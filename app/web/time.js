// Time: a month calendar with weekdays, moons and their phases, seasons, holidays and events; a date calculator;
// "on this day"; and the visual timeline (lanes by faction/place/character, era bands, lifespans, following a character).
"use strict";

// ------------------------------------------------------------------ calendar maths (on top of Cal in core.js)
const CalX = {
  cal: () => M.world.calendar,
  yearDays() { return this.cal().months.reduce((a, m) => a + (+m.days || 30), 0) || 360; },
  // absolute day number (0 = first day of absolute year 0) for a Cal value; missing month/day count as the first
  dayNum(v) {
    const p = Cal.parts(v); if (!p) return null;
    const ms = this.cal().months; let d = p.y * this.yearDays();
    for (let i = 0; i < (p.m || 1) - 1; i++) d += +ms[i]?.days || 30;
    return d + Math.max(0, (p.d || 1) - 1);
  },
  fromDay(n) {
    const yd = this.yearDays(), y = Math.floor(n / yd); let r = n - y * yd, m = 0;
    const ms = this.cal().months;
    while (m < ms.length && r >= (+ms[m].days || 30)) { r -= +ms[m].days || 30; m++; }
    return `${y}.${m + 1}.${r + 1}`;
  },
  addDays(v, n) { const d = this.dayNum(v); return d == null ? null : this.fromDay(d + n); },
  weekday(v) { const w = this.cal().weekdays || []; if (!w.length) return ""; const d = this.dayNum(v); return w[((d + (+this.cal().weekOffset || 0)) % w.length + w.length) % w.length]; },
  moonPhase(moon, day) {      // 0..1 (0 = new, .5 = full)
    const per = +moon.period || 29.5; return (((day - (+moon.offset || 0)) % per) + per) % per / per;
  },
  phaseIcon(ph) { return ["●", "◔", "◑", "◕", "○", "◕", "◑", "◔"][Math.round(ph * 8) % 8]; },
  phaseName(ph) {
    const i = Math.round(ph * 8) % 8;
    return [["New", "Новолуние"], ["Waxing crescent", "Растящ сърп"], ["First quarter", "Първа четвърт"], ["Waxing gibbous", "Растяща луна"], ["Full", "Пълнолуние"], ["Waning gibbous", "Намаляваща луна"], ["Last quarter", "Последна четвърт"], ["Waning crescent", "Намаляващ сърп"]][i];
  },
  season(m, d) {
    const ss = (this.cal().seasons || []).map(s => ({ ...s, k: (+s.month || 1) * 100 + (+s.day || 1) })).sort((a, b) => a.k - b.k);
    if (!ss.length) return null; const k = m * 100 + (d || 1); let cur = ss[ss.length - 1];
    for (const s of ss) if (k >= s.k) cur = s; return cur;
  },
  present() { const c = this.cal(); return c.presentDate || (c.present != null ? `${c.present}.1.1` : "0.1.1"); },
  // recurring day.month of a holiday's "When" text: "14.3", "14 Izok", "3rd of Month 2"
  holidayDay(text) {
    const s = String(text || "").trim(); if (!s) return null;
    let m = s.match(/^(\d{1,2})\s*[./]\s*(\d{1,2})$/); if (m) return { d: +m[1], m: +m[2] };
    m = s.match(/(\d{1,2})\D*?([\p{L}][\p{L}\s]*\d*)/u);
    if (m) { const name = norm(m[2]); const mi = this.cal().months.findIndex(x => { const n = norm(x.name); return n === name || name.startsWith(n) || n.startsWith(name.slice(0, 4)); }); if (mi >= 0) return { d: +m[1], m: mi + 1 }; }
    return null;
  },
  // every dated thing in the world: [{e, date, label, kind}]
  datedItems(includeScrapped = false) {
    const out = [], L = (en, bg) => tf(en, bg);
    const fieldsByType = { event: [["date", "", "event"]], chapter: [["date", L("chapter", "глава"), "story"]], scene: [["date", L("scene", "сцена"), "story"]],
      character: [["born", L("born", "роден"), "life"], ["died", L("died", "умира"), "life"]], faction: [["founded", L("founded", "основана"), "life"], ["dissolved", L("dissolved", "разпусната"), "life"]],
      location: [["founded", L("founded", "основано"), "life"], ["destroyed", L("destroyed", "разрушено"), "life"]], religion: [["founded", L("founded", "основана"), "life"]],
      government: [["founded", L("founded", "основано"), "life"]] };
    for (const e of M.entries.values()) {
      if (!includeScrapped && e.status === "scrapped") continue;
      for (const [k, label, kind] of fieldsByType[e.type] || []) if (e.fields?.[k]) out.push({ e, date: e.fields[k], label, kind });
    }
    return out;
  },
};

// ------------------------------------------------------------------ the calendar page
Views.calendar = (el, r, pane) => {
  const c = CalX.cal();
  const now = Cal.parts(M.state.calCursor || CalX.present()) || { y: 0, m: 1, d: 1 };
  let Y = now.y, Mo = now.m || 1;
  el.innerHTML = paneHead(`⟟ ${tf("Calendar", "Календар")}`, `<div class="row"><button class="btn small ghost" data-calc>± ${tf("Date calculator", "Калкулатор за дати")}</button><button class="btn small ghost" data-setup>⚙ ${tf("Moons, seasons, weekdays", "Луни, сезони, дни")}</button></div>`, pane) + `
    <div class="pane-body"><div class="wrap wide"><div class="grid" style="grid-template-columns:minmax(0,1fr) 300px;align-items:start">
      <div><div class="row cal-nav"><button class="btn small ghost" data-py>«</button><button class="btn small ghost" data-pm>‹</button><b data-title style="font:600 20px var(--serif);flex:1;text-align:center"></b>
        <button class="btn small ghost" data-nm>›</button><button class="btn small ghost" data-ny>»</button><button class="btn small" data-today>${tf("Present day", "Настоящ ден")}</button></div>
        <div data-grid></div></div>
      <div data-side></div></div></div></div>`;
  const draw = () => {
    if (Mo < 1) { Mo = c.months.length; Y--; } if (Mo > c.months.length) { Mo = 1; Y++; }
    M.state.calCursor = `${Y}.${Mo}.1`; saveState();
    const days = +c.months[Mo - 1]?.days || 30, wd = c.weekdays || [], cols = wd.length || 7;
    const first = CalX.dayNum(`${Y}.${Mo}.1`), lead = wd.length ? ((first + (+c.weekOffset || 0)) % cols + cols) % cols : 0;
    const items = CalX.datedItems().filter(x => { const p = Cal.parts(x.date); return p.y === Y && p.m === Mo && p.d; });
    const yearly = CalX.datedItems().filter(x => { const p = Cal.parts(x.date); return p.m === Mo && p.d && p.y !== Y && x.kind !== "story"; });
    const hols = entriesOf("holiday").map(h => ({ h, at: CalX.holidayDay(h.fields?.when) })).filter(x => x.at?.m === Mo);
    const pres = Cal.parts(CalX.present());
    const se = CalX.season(Mo, 1);
    $("[data-title]", el).innerHTML = `${esc(c.months[Mo - 1]?.name || "")} ${esc(Cal.yearLabel(Y))}${se ? ` <span class="faint small" style="font:13px var(--sans)">· ${esc(se.name)}</span>` : ""}`;
    let cells = wd.length ? wd.map(w => `<div class="cal-wd">${esc(w)}</div>`).join("") : "";
    for (let i = 0; i < lead; i++) cells += `<div class="cal-day empty"></div>`;
    for (let d = 1; d <= days; d++) {
      const dn = first + d - 1, here = items.filter(x => Cal.parts(x.date).d === d), hol = hols.filter(x => x.at.d === d);
      const seasonStart = (c.seasons || []).find(s => +s.month === Mo && +s.day === d);
      const isNow = pres && pres.y === Y && pres.m === Mo && pres.d === d;
      cells += `<div class="cal-day ${isNow ? "now" : ""}" data-day="${d}"><div class="row"><b>${d}</b><span class="spacer"></span>${(c.moons || []).map(mn => { const ph = CalX.moonPhase(mn, dn); const k = Math.round(ph * 8) % 8;
        return k === 0 || k === 4 ? `<span class="moon" style="color:${esc(mn.color || "var(--muted)")}" title="${esc(mn.name)}: ${esc(tf(...CalX.phaseName(ph)))}">${CalX.phaseIcon(ph)}</span>` : ""; }).join("")}</div>
        ${seasonStart ? `<div class="cal-tag season">${esc(seasonStart.name)}</div>` : ""}
        ${hol.map(x => `<div class="cal-tag hol" data-open="${x.h.id}">✺ ${esc(x.h.title)}</div>`).join("")}
        ${here.slice(0, 3).map(x => `<div class="cal-tag" data-open="${x.e.id}">${typeOf(x.e.type).icon} ${esc(x.e.title)}${x.label ? ` <span class="faint">${esc(x.label)}</span>` : ""}</div>`).join("")}${here.length > 3 ? `<div class="faint small">+${here.length - 3}</div>` : ""}</div>`;
    }
    $("[data-grid]", el).innerHTML = `<div class="cal-grid" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">${cells}</div>`;
    $$("[data-day]", el).forEach(x => x.onclick = ev => { if (!ev.target.closest("[data-open]")) side(+x.dataset.day); });
    side(pres && pres.y === Y && pres.m === Mo ? pres.d : 1, yearly);
  };
  const side = (d, yearlyAll) => {
    const v = `${Y}.${Mo}.${d}`, dn = CalX.dayNum(v);
    const yearly = (yearlyAll || CalX.datedItems().filter(x => { const p = Cal.parts(x.date); return p.m === Mo && p.y !== Y && x.kind !== "story"; })).filter(x => Cal.parts(x.date).d === d);
    const se = CalX.season(Mo, d);
    $("[data-side]", el).innerHTML = `<div class="card"><div style="font:600 18px var(--serif)">${esc(Cal.format(v))}</div>
      <div class="faint small">${[CalX.weekday(v), se?.name].filter(Boolean).map(esc).join(" · ")}</div>
      ${(c.moons || []).map(mn => { const ph = CalX.moonPhase(mn, dn); return `<div class="small" style="margin-top:4px"><span style="color:${esc(mn.color || "inherit")}">${CalX.phaseIcon(ph)}</span> ${esc(mn.name)}: ${esc(tf(...CalX.phaseName(ph)))}</div>`; }).join("")}
      <div class="section-sub">${tf("On this day in other years", "На този ден в други години")}</div>
      ${yearly.length ? `<div class="list">${yearly.sort((a, b) => Cal.key(a.date) - Cal.key(b.date)).map(x => `<div class="li" data-open="${x.e.id}"><div class="main"><div class="t">${esc(x.e.title)}</div><div class="d">${esc(Cal.yearLabel(Cal.parts(x.date).y))}${x.label ? " · " + esc(x.label) : ""}</div></div></div>`).join("")}</div>` : `<div class="faint small">—</div>`}
      <div class="row" style="margin-top:10px"><button class="btn small" data-newev>＋ ${tf("Event on this day", "Събитие на този ден")}</button><button class="btn small ghost" data-setnow>${tf("Make this the present day", "Направи го настоящ ден")}</button></div></div>`;
    $("[data-newev]", el).onclick = async () => { const e = await createEntry("event", "", { fields: { date: v } }); Entry.editing.add(e.id); open(e.id); };
    $("[data-setnow]", el).onclick = async () => { M.world.calendar.presentDate = v; M.world.calendar.present = Y; await saveWorld(); toast(tf("Present day set. Ages and “world at a time” use it.", "Настоящият ден е зададен.")); draw(); };
  };
  $("[data-pm]", el).onclick = () => { Mo--; draw(); }; $("[data-nm]", el).onclick = () => { Mo++; draw(); };
  $("[data-py]", el).onclick = () => { Y--; draw(); }; $("[data-ny]", el).onclick = () => { Y++; draw(); };
  $("[data-today]", el).onclick = () => { const p = Cal.parts(CalX.present()); Y = p.y; Mo = p.m || 1; draw(); };
  $("[data-setup]", el).onclick = () => calendarSetup().then(draw);
  $("[data-calc]", el).onclick = () => dateCalculator();
  draw();
};

async function calendarSetup() {
  const c = CalX.cal();
  const r = await modal(tf("Moons, seasons and weekdays", "Луни, сезони и дни от седмицата"), `<div class="form-grid">
    <label>${tf("Weekdays", "Дни от седмицата")}</label><div><textarea class="input" data-wd rows="4" placeholder="${tf("One per line, e.g.\nMoonday\nFireday", "По един на ред")}">${esc((c.weekdays || []).join("\n"))}</textarea>
      <div class="faint small">${tf("Leave empty for no named weekdays.", "Оставете празно, ако няма именувани дни.")}</div></div>
    <label>${tf("Weekday of day 1", "Ден от седмицата на ден 1")}</label><input class="input" type="number" data-off value="${+c.weekOffset || 0}" style="width:100px">
    <label>${tf("Moons", "Луни")}</label><div><textarea class="input" data-moons rows="3" placeholder="Silva | 28 | 0 | #C8D0E0">${esc((c.moons || []).map(m => `${m.name} | ${m.period} | ${m.offset || 0}${m.color ? " | " + m.color : ""}`).join("\n"))}</textarea>
      <div class="faint small">${tf("Name | days from new moon to new moon | shift in days | color (optional)", "Име | дни от новолуние до новолуние | отместване | цвят (по избор)")}</div></div>
    <label>${tf("Seasons", "Сезони")}</label><div><textarea class="input" data-seasons rows="4" placeholder="${tf("Spring | 1.3", "Пролет | 1.3")}">${esc((c.seasons || []).map(s => `${s.name} | ${s.day}.${s.month}`).join("\n"))}</textarea>
      <div class="faint small">${tf("Name | day.month it starts", "Име | ден.месец, в който започва")}</div></div>
  </div><div class="faint small" style="margin-top:8px">${tf("Eras, months and the length of each month are in Settings → World calendar. Holidays are Holiday entries; put their day in “When”, like 14.3 or 14 Izok.", "Епохите и месеците са в Настройки → Календар. Празниците са записи Празник; денят им е в „Кога“, напр. 14.3.")}</div>`,
    { wide: true, buttons: [{ label: t("Cancel"), value: null }, { label: t("Save"), cls: "primary", value: ov => ov }] });
  if (!r) return;
  const lines = sel => $(sel, r).value.split("\n").map(l => l.split("|").map(x => x.trim())).filter(p => p[0]);
  c.weekdays = $("[data-wd]", r).value.split("\n").map(x => x.trim()).filter(Boolean);
  c.weekOffset = +$("[data-off]", r).value || 0;
  c.moons = lines("[data-moons]").map(p => ({ name: p[0], period: +p[1] || 29.5, offset: +p[2] || 0, color: /^#[0-9a-f]{3,6}$/i.test(p[3] || "") ? p[3] : "" }));
  c.seasons = lines("[data-seasons]").map(p => { const [d, m] = (p[1] || "1.1").split(/[./]/).map(Number); return { name: p[0], day: d || 1, month: m || 1 }; });
  await saveWorld(); toast(t("Saved"));
}

async function dateCalculator() {
  await modal(tf("Date calculator", "Калкулатор за дати"), `<div class="form-grid">
    <label>${tf("From", "От")}</label><input class="input" data-a value="${esc(Cal.input(CalX.present()))}">
    <label>${tf("Add", "Добави")}</label><div class="row"><input class="input" type="number" data-n value="100" style="width:110px"><select class="input" data-u style="width:auto"><option value="d">${tf("days", "дни")}</option><option value="m">${tf("months", "месеца")}</option><option value="y">${tf("years", "години")}</option></select></div>
    <label>${tf("Result", "Резултат")}</label><div data-r style="padding-top:7px;font-weight:600"></div>
    <label style="margin-top:10px">${tf("Days between", "Дни между")}</label><div class="row" style="margin-top:10px"><input class="input" data-b1 placeholder="1.1.500 AF"><span>→</span><input class="input" data-b2 placeholder="1.1.512 AF"></div>
    <label>${tf("Difference", "Разлика")}</label><div data-d style="padding-top:7px;font-weight:600"></div>
  </div><div class="faint small" style="margin-top:8px">${tf("Uses your world's calendar: its months, their lengths and its eras.", "Използва календара на света ви.")}</div>`, {
    wide: true, buttons: [{ label: tf("Close", "Затвори"), value: true }],
    onOpen: ov => {
      const calc = () => {
        const a = Cal.parse($("[data-a]", ov).value), n = +$("[data-n]", ov).value || 0, u = $("[data-u]", ov).value;
        let res = "";
        if (a) {
          if (u === "d") res = CalX.addDays(a, n);
          else { const p = Cal.parts(a), months = CalX.cal().months.length; let total = (p.m || 1) - 1 + (u === "m" ? n : n * months); const y = p.y + Math.floor(total / months); total = ((total % months) + months) % months; res = `${y}.${total + 1}.${p.d || 1}`; }
        }
        $("[data-r]", ov).textContent = a ? `${Cal.format(res)}${CalX.weekday(res) ? " · " + CalX.weekday(res) : ""}` : tf("Can't read the first date", "Не мога да разчета датата");
        const b1 = Cal.parse($("[data-b1]", ov).value), b2 = Cal.parse($("[data-b2]", ov).value);
        if (b1 && b2) { const d = CalX.dayNum(b2) - CalX.dayNum(b1), yd = CalX.yearDays(); $("[data-d]", ov).textContent = `${d.toLocaleString()} ${tf("days", "дни")} (${(d / yd).toFixed(1)} ${tf("years", "години")})`; }
        else $("[data-d]", ov).textContent = "";
      };
      $$("input,select", ov).forEach(i => i.oninput = calc); calc();
    },
  });
}

// "on this day" on the dashboard, when the present day has a month and day
function onThisDayCard() {
  const p = Cal.parts(CalX.present()); if (!p?.m || !p?.d) return "";
  const list = CalX.datedItems().filter(x => { const q = Cal.parts(x.date); return q.m === p.m && q.d === p.d && q.y !== p.y && x.kind !== "story"; });
  const hol = entriesOf("holiday").filter(h => { const a = CalX.holidayDay(h.fields?.when); return a && a.m === p.m && a.d === p.d; });
  if (!list.length && !hol.length) return "";
  return `<div class="card" style="margin-bottom:6px"><div class="faint small">${tf("On this day in your world", "На този ден във вашия свят")} · ${esc(Cal.format(CalX.present()))}</div>
    <div class="row" style="margin-top:6px">${hol.map(h => chipFor(h.id)).join("")}${list.slice(0, 10).map(x => `<span class="chip" data-open="${x.e.id}">${esc(x.e.title)} <span class="faint">${esc(Cal.yearLabel(Cal.parts(x.date).y))}${x.label ? " " + esc(x.label) : ""}</span></span>`).join("")}</div></div>`;
}

// ------------------------------------------------------------------ the visual timeline (lanes, era bands, lifespans, following a character)
const TimelineX = {
  mode: () => M.state.tlMode || "list",
  draw(box, filters) {
    const mode = this.mode();
    if (mode === "follow") return this.follow(box);
    const items = CalX.datedItems(filters.scrapped).filter(x => x.kind !== "life" || x.e.type !== "character");
    const lives = entriesOf("character").filter(c => c.fields?.born && (filters.scrapped || c.status !== "scrapped"));
    const ys = [...items.map(x => Cal.parts(x.date).y), ...lives.flatMap(c => [Cal.parts(c.fields.born).y, c.fields.died ? Cal.parts(c.fields.died).y : Cal.present()])];
    if (!ys.length) { box.innerHTML = `<div class="empty">${tf("No dates yet. Give events, births and foundings a date and they appear here.", "Още няма дати.")}</div>`; return; }
    let y0 = Math.min(...ys), y1 = Math.max(...ys); const pad = Math.max(1, Math.round((y1 - y0) * .04)); y0 -= pad; y1 += pad;
    const fit = Math.max(400, (box.clientWidth || 1100) - 170), scale = +M.state.tlScale || Math.max(.05, Math.min(60, fit / Math.max(1, y1 - y0)));
    const X = y => (y - y0) * scale, W = X(y1) + 240;
    const laneOf = { faction: x => [...(x.e.fields?.participants || []), x.e.fields?.leader].map(id => M.entries.get(id)).filter(e => e?.type === "faction").map(e => e.title),
      place: x => { let id = x.e.fields?.where || (x.e.type === "location" ? x.e.id : null), seen = new Set(); while (id && M.entries.get(id)?.fields?.partOf && !seen.has(id)) { seen.add(id); id = M.entries.get(id).fields.partOf; } return id ? [titleOf(id)] : []; },
      character: x => (x.e.fields?.participants || []).concat(x.e.fields?.pov || []).map(id => M.entries.get(id)).filter(e => e?.type === "character").map(e => e.title),
      type: x => [typeName(x.e.type)] }[mode] || (x => [typeName(x.e.type)]);
    const lanes = new Map();
    for (const x of items) { const ls = laneOf(x); (ls.length ? ls : [tf("Other", "Други")]).forEach(l => (lanes.get(l) || lanes.set(l, []).get(l)).push(x)); }
    const eraBands = [...CalX.cal().eras].sort((a, b) => a.start - b.start).map((e, i, arr) => ({ e, from: Math.max(y0, e.start), to: Math.min(y1, arr[i + 1]?.start ?? y1) })).filter(b => b.to > b.from);
    const ticks = []; const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000].find(s => s * scale >= 70) || 10000;
    for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) ticks.push(y);
    const lane = (name, its) => {
      const rows = []; const placed = its.sort((a, b) => Cal.key(a.date) - Cal.key(b.date)).map(x => {
        const left = X(Cal.parts(x.date).y + ((Cal.parts(x.date).m || 1) - 1) / CalX.cal().months.length);
        let row = rows.findIndex(end => end < left - 6); if (row < 0) { row = rows.length; rows.push(0); } rows[row] = left + Math.min(220, 14 + x.e.title.length * 7);
        return `<div class="tlx-ev k-${x.kind}" style="left:${left}px;top:${row * 24 + 4}px" data-open="${x.e.id}" title="${esc(Cal.format(x.date))}${x.label ? " · " + esc(x.label) : ""}"><i></i>${esc(x.e.title)}</div>`;
      });
      return `<div class="tlx-lane" style="height:${Math.max(1, rows.length) * 24 + 10}px"><div class="tlx-name">${esc(name)}</div>${placed.join("")}</div>`;
    };
    const lifeRows = lives.sort((a, b) => Cal.key(a.fields.born) - Cal.key(b.fields.born)).map(c => {
      const b = Cal.parts(c.fields.born).y, d = c.fields.died ? Cal.parts(c.fields.died).y : null, end = d ?? Cal.present();
      return `<div class="tlx-life" style="left:${X(b)}px;width:${Math.max(4, X(end) - X(b))}px" data-open="${c.id}" title="${esc(c.title)}: ${esc(Cal.format(c.fields.born))} – ${d != null ? esc(Cal.format(c.fields.died)) : tf("alive", "жив")}">
        <span>${esc(c.title)}${d == null ? "" : " †"}</span></div>`;
    });
    box.innerHTML = `<div class="tlx-wrap"><div class="tlx" style="width:${W + 140}px">
      <div class="tlx-axis">${eraBands.map((b, i) => `<div class="tlx-era e${i % 4}" style="left:${X(b.from) + 140}px;width:${X(b.to) - X(b.from)}px"><span>${esc(b.e.name)}</span></div>`).join("")}
        ${ticks.map(y => `<div class="tlx-tick" style="left:${X(y) + 140}px"><span>${esc(Cal.yearLabel(y))}</span></div>`).join("")}</div>
      <div class="tlx-body">${[...lanes.entries()].sort((a, b) => b[1].length - a[1].length).map(([n, its]) => lane(n, its)).join("")}
        ${lives.length ? `<div class="tlx-lane lives" style="height:${lives.length * 20 + 10}px"><div class="tlx-name">${tf("Lifespans", "Живот")}</div>${lifeRows.map((h, i) => h.replace('class="tlx-life"', `class="tlx-life" data-i="${i}"`).replace("style=\"", `style="top:${i * 20 + 4}px;`)).join("")}</div>` : ""}
        <div class="tlx-now" style="left:${X(Cal.present()) + 140}px" title="${tf("Present day", "Настоящ ден")}"></div></div></div></div>
      <div class="row small faint" style="margin-top:6px">${tf("Zoom", "Мащаб")} <input type="range" min="0" max="100" value="${Math.round(Math.log(scale / .05) / Math.log(1200) * 100)}" data-zoom style="width:200px"> <button class="btn small ghost" data-fit>${tf("Fit", "Побери")}</button> <span>${tf("Bars are lifespans (to the present day when alive). Colored bands are eras.", "Лентите са живот (до настоящия ден, ако е жив). Цветните полета са епохи.")}</span></div>`;
    $("[data-zoom]", box).oninput = e => { M.state.tlScale = .05 * Math.pow(1200, +e.target.value / 100); saveState(); this.draw(box, filters); };
    $("[data-fit]", box).onclick = () => { delete M.state.tlScale; saveState(); this.draw(box, filters); };
  },
  follow(box) {
    const chars = sortByTitle(entriesOf("character"));
    const who = M.state.tlFollow && M.entries.has(M.state.tlFollow) ? M.state.tlFollow : (chars.find(c => c.fields?.born) || chars[0])?.id;
    if (!who) { box.innerHTML = `<div class="empty">${tf("No characters yet.", "Още няма персонажи.")}</div>`; return; }
    const c = M.entries.get(who), steps = [];
    if (c.fields?.born) steps.push({ date: c.fields.born, what: tf("Born", "Роден"), where: c.fields.birthplace, id: c.id });
    for (const e of M.entries.values()) {
      const inIt = (e.fields?.participants || []).includes(who) || e.fields?.pov === who || linksIn(e.body).some(n => Idx.find(n)?.id === who);
      if (!inIt || e.id === who) continue;
      const date = e.fields?.date; if (!date) continue;
      steps.push({ date, what: e.title, where: e.fields?.where, id: e.id, kind: typeName(e.type) });
    }
    if (c.fields?.died) steps.push({ date: c.fields.died, what: tf("Died", "Умира"), id: c.id });
    steps.sort((a, b) => Cal.key(a.date) - Cal.key(b.date));
    box.innerHTML = `<div class="row" style="margin-bottom:10px"><span class="small faint">${tf("Follow", "Следвай")}</span><select class="input" data-who style="width:auto">${chars.map(x => `<option value="${x.id}" ${x.id === who ? "selected" : ""}>${esc(x.title)}${chars.filter(y => y.title === x.title).length > 1 && x.fields?.born ? ` (${esc(Cal.format(x.fields.born))})` : ""}</option>`).join("")}</select>
      <span class="faint small">${tf("Where they were, and when: from events they take part in, scenes from their point of view, and dated entries that mention them.", "Къде е бил и кога: от събития, сцени от неговата гледна точка и датирани записи, които го споменават.")}</span></div>
      ${steps.length ? `<div class="tl">${steps.map(s => `<div class="tl-item"><div class="card" data-open="${s.id}"><div class="tl-date">${esc(Cal.format(s.date))}${c.fields?.born && s.what !== tf("Born", "Роден") ? ` · ${tf("age", "на")} ${Cal.yearsBetween(c.fields.born, s.date)}` : ""}</div>
        <div style="font:600 15px var(--serif)">${esc(s.what)}</div><div class="faint small">${s.where ? `⌂ ${esc(titleOf(s.where))}` : tf("place unknown", "мястото не е известно")}${s.kind ? " · " + esc(s.kind) : ""}</div></div></div>`).join("")}</div>`
        : `<div class="empty">${tf("Nothing dated mentions this character yet.", "Още нищо датирано не споменава този персонаж.")}</div>`}`;
    $("[data-who]", box).onchange = e => { M.state.tlFollow = e.target.value; saveState(); this.follow(box); };
  },
};
// put the mode switch on the timeline page
(() => {
  const list = Views.timeline;
  Views.timeline = (el, r, pane) => {
    list(el, r, pane);
    const mode = TimelineX.mode();
    const bar = document.createElement("div"); bar.className = "row tlx-modes"; bar.style.marginBottom = "12px";
    bar.innerHTML = `<span class="small faint">${tf("View", "Изглед")}</span>` + [["list", "List", "Списък"], ["type", "Lanes by type", "Ленти по вид"], ["faction", "By faction", "По фракция"], ["place", "By place", "По място"], ["character", "By character", "По персонаж"], ["follow", "Follow a character", "Следвай персонаж"]]
      .map(([k, en, bg]) => `<span class="chip ${k === mode ? "on" : ""}" data-m="${k}">${esc(tf(en, bg))}</span>`).join("") + `<span class="spacer"></span><button class="btn small ghost" data-cal>⟟ ${tf("Calendar", "Календар")}</button>`;
    const body = $(".pane-body .wrap", el); body.prepend(bar);
    $$("[data-m]", bar).forEach(c => c.onclick = () => { M.state.tlMode = c.dataset.m; saveState(); Panes.refresh(); });
    $("[data-cal]", bar).onclick = () => Panes.show({ view: "calendar" }, pane);
    if (mode !== "list") {
      const tl = $("[data-tl]", el), filters = body.querySelector(":scope > .row:not(.tlx-modes)");
      $$("[data-who],[data-where]", filters).forEach(x => x.style.display = "none");   // lanes show everything
      if (mode === "follow") filters.style.display = "none";
      body.classList.add("wide"); TimelineX.draw(tl, { scrapped: $("[data-scr]", el).checked });
      $("[data-scr]", el).onchange = () => TimelineX.draw(tl, { scrapped: $("[data-scr]", el).checked });
    }
  };
})();
