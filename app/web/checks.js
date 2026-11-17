// Automatic checks (no AI): hard-fact contradictions + "what needs fleshing out".
"use strict";
const Checks = (() => {
  const f = (e, k) => e?.fields?.[k];
  const has = v => Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && String(v).trim() !== "";
  const dk = v => Cal.key(v);
  const name = id => titleOf(id) || "?";
  // Bulgarian → Latin, then keep only the consonants: Драгомир → drgmr, Dragomir → drgmr (vowels are spelled too differently to compare)
  const CYR = /[Ѐ-ӿ]/;
  const TR = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
    у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sht", ъ: "a", ь: "", ю: "yu", я: "ya" };
  const skeleton = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[Ѐ-ӿ]/g, ch => TR[ch] ?? ch).replace(/ph/g, "f").replace(/w/g, "v").replace(/[ck](?!h)/g, "k").replace(/q/g, "k").replace(/x/g, "ks")
    .replace(/[^a-z]/g, "").replace(/[aeiouy]/g, "").replace(/(.)\1+/g, "$1");

  // ---- contradictions found by rules. Each has a stable key so "resolved/intentional" sticks.
  function rules() {
    const out = [];
    const push = (key, a, b, why) => out.push({ key: "rule:" + key, source: "rule", a, b, why });
    const all = [...M.entries.values()].filter(e => e.status !== "scrapped");
    const chars = all.filter(e => e.type === "character");
    for (const c of chars) {
      const b = f(c, "born"), d = f(c, "died");
      if (has(b) && has(d) && dk(d) < dk(b))
        push(`died-before-born:${c.id}`, { id: c.id, text: `Born ${Cal.format(b)}` }, { id: c.id, text: `Died ${Cal.format(d)}` },
          tf(`${c.title} dies before being born.`, `${c.title} умира, преди да се роди.`));
      if (f(c, "life") === "alive" && has(d))
        push(`alive-but-died:${c.id}`, { id: c.id, text: "Status: alive" }, { id: c.id, text: `Died ${Cal.format(d)}` },
          tf(`${c.title} is marked alive but has a death date.`, `${c.title} е отбелязан като жив, но има дата на смърт.`));
      for (const r of f(c, "relations") || []) {
        const o = M.entries.get(r.to); if (!o) continue;
        const pb = r.kind === "parent" ? f(o, "born") : r.kind === "child" ? b : null;
        const cb = r.kind === "parent" ? b : r.kind === "child" ? f(o, "born") : null;
        const parent = r.kind === "parent" ? o : c, child = r.kind === "parent" ? c : o;
        if (has(pb) && has(cb)) {
          const gap = Cal.yearsBetween(pb, cb);
          if (gap !== null && gap < 12)
            push(`parent-age:${parent.id}:${child.id}`, { id: parent.id, text: `Born ${Cal.format(pb)}` }, { id: child.id, text: `Born ${Cal.format(cb)}` },
              gap < 0 ? tf(`${child.title} is born before their parent ${parent.title}.`, `${child.title} е роден преди родителя си ${parent.title}.`)
                      : tf(`${parent.title} would be only ${gap} at ${child.title}'s birth.`, `${parent.title} би бил само на ${gap} при раждането на ${child.title}.`));
        }
        const pd = f(parent, "died");
        if (has(pd) && has(cb) && Cal.yearsBetween(pd, cb) > 1)
          push(`parent-dead:${parent.id}:${child.id}`, { id: parent.id, text: `Died ${Cal.format(pd)}` }, { id: child.id, text: `Born ${Cal.format(cb)}` },
            tf(`${child.title} is born more than a year after their parent ${parent.title} died.`, `${child.title} е роден повече от година след смъртта на родителя си ${parent.title}.`));
      }
    }
    for (const ev of all.filter(e => e.type === "event" || e.type === "chapter")) {
      const date = f(ev, "date"); if (!has(date)) continue;
      const people = [...(f(ev, "participants") || []), f(ev, "pov")].filter(Boolean);
      for (const pid of people) {
        const p = M.entries.get(pid); if (!p || p.type !== "character") continue;
        if (has(f(p, "died")) && dk(date) > dk(f(p, "died")) && f(p, "life") !== "undead")
          push(`after-death:${ev.id}:${pid}`, { id: p.id, text: `Died ${Cal.format(f(p, "died"))}` }, { id: ev.id, text: `${ev.title} — ${Cal.format(date)}` },
            tf(`${p.title} takes part in “${ev.title}” after their death.`, `${p.title} участва в „${ev.title}“ след смъртта си.`));
        if (has(f(p, "born")) && dk(date) < dk(f(p, "born")))
          push(`before-birth:${ev.id}:${pid}`, { id: p.id, text: `Born ${Cal.format(f(p, "born"))}` }, { id: ev.id, text: `${ev.title} — ${Cal.format(date)}` },
            tf(`${p.title} takes part in “${ev.title}” before being born.`, `${p.title} участва в „${ev.title}“, преди да се роди.`));
      }
      for (const cid of f(ev, "causes") || []) {
        const c = M.entries.get(cid);
        if (c && has(f(c, "date")) && dk(f(c, "date")) > dk(date))
          push(`cause-after:${ev.id}:${cid}`, { id: c.id, text: `${c.title} — ${Cal.format(f(c, "date"))}` }, { id: ev.id, text: `${ev.title} — ${Cal.format(date)}` },
            tf(`“${ev.title}” happens before its cause “${c.title}”.`, `„${ev.title}“ се случва преди причината си „${c.title}“.`));
      }
      const fac = (f(ev, "participants") || []).map(id => M.entries.get(id)).filter(x => x?.type === "faction");
      for (const x of fac) {
        if (has(f(x, "founded")) && dk(date) < dk(f(x, "founded")))
          push(`before-founded:${ev.id}:${x.id}`, { id: x.id, text: `Founded ${Cal.format(f(x, "founded"))}` }, { id: ev.id, text: `${ev.title} — ${Cal.format(date)}` },
            tf(`${x.title} takes part in “${ev.title}” before it was founded.`, `${x.title} участва в „${ev.title}“, преди да е основана.`));
      }
      if (has(f(ev, "endDate")) && dk(f(ev, "endDate")) < dk(date))
        push(`ends-before:${ev.id}`, { id: ev.id, text: `Starts ${Cal.format(date)}` }, { id: ev.id, text: `Ends ${Cal.format(f(ev, "endDate"))}` },
          tf(`“${ev.title}” ends before it starts.`, `„${ev.title}“ свършва, преди да започне.`));
    }
    // location placed inside itself (A part of B part of A)
    for (const l of all.filter(e => e.type === "location")) {
      const seen = new Set([l.id]); let cur = f(l, "partOf");
      while (cur) { if (seen.has(cur)) { push(`loop:${[...seen].sort().join(",")}`, { id: l.id, text: `Part of ${name(f(l, "partOf"))}` }, { id: cur, text: `Part of ${name(f(M.entries.get(cur), "partOf"))}` },
        tf(`${l.title} ends up inside itself (“part of” goes in a circle).`, `${l.title} се оказва вътре в себе си („част от“ е в кръг).`)); break; }
        seen.add(cur); cur = f(M.entries.get(cur), "partOf"); }
    }
    // potions/rituals using something that isn't an ingredient/item
    for (const p of all.filter(e => e.type === "potion" || e.type === "ritual")) {
      for (const id of [...(f(p, "ingredients") || []), ...(f(p, "components") || [])]) {
        if (!M.entries.has(id)) push(`missing-ingredient:${p.id}:${id}`, { id: p.id, text: p.title }, { id: null, text: tf("A deleted entry", "Изтрит запис") },
          tf(`“${p.title}” uses an ingredient that no longer exists.`, `„${p.title}“ използва съставка, която вече не съществува.`));
      }
    }
    // the same name used by two entries
    const names = new Map();
    for (const e of all) for (const n of [e.title, ...(e.aliases || [])]) { const k = norm(n); if (!k) continue; const l = names.get(k) || []; if (!l.includes(e.id)) l.push(e.id); names.set(k, l); }
    for (const [k, ids] of names) if (ids.length > 1)
      push(`same-name:${ids.sort().join(",")}`, { id: ids[0], text: titleOf(ids[0]) }, { id: ids[1], text: titleOf(ids[1]) },
        tf(`Two entries share the name “${k}”. Same thing, or should one be renamed?`, `Два записа носят името „${k}“. Едно и също ли е, или едното трябва да се преименува?`));
    // the same name written in Cyrillic and in Latin letters (Драгомир / Dragomir) on two different entries
    const skel = new Map();
    for (const e of all) for (const n of [e.title, ...(e.aliases || [])]) {
      const sk = skeleton(n); if (sk.length < 4) continue;
      const l = skel.get(sk) || []; if (!l.some(x => x.id === e.id)) l.push({ id: e.id, n, cyr: CYR.test(n) }); skel.set(sk, l);
    }
    for (const l of skel.values()) {
      const c = l.find(x => x.cyr), lat = l.find(x => !x.cyr && x.id !== c?.id);
      if (!c || !lat || norm(c.n) === norm(lat.n)) continue;
      push(`script-name:${[c.id, lat.id].sort().join(",")}`, { id: c.id, text: c.n }, { id: lat.id, text: lat.n },
        tf(`“${c.n}” and “${lat.n}” look like the same name in Bulgarian and English letters, on two different entries. Same thing? Then merge them, or add one as an alias of the other.`,
           `„${c.n}“ и „${lat.n}“ изглеждат като едно и също име на кирилица и на латиница, в два различни записа. Едно и също ли е? Тогава ги обединете или добавете едното като друго име на другото.`));
    }
    return out;
  }

  // ---- all contradictions (rules live + stored AI/import ones), with saved status
  function contradictions() {
    const st = M.state.issueStatus || {};
    const stored = (M.state.contradictions || []).map(c => ({ ...c }));
    return [...rules(), ...stored].map(c => ({ ...c, status: st[c.key] || c.status || "open" }));
  }
  const openCount = () => contradictions().filter(c => c.status === "open").length;
  function setStatus(key, status) {
    M.state.issueStatus = { ...(M.state.issueStatus || {}), [key]: status };
    const s = (M.state.contradictions || []).find(c => c.key === key); if (s) s.status = status;
    saveState(); Bus.emit("issues");
  }

  // ---- "I'm stuck": what needs fleshing out
  function fleshOut() {
    const cards = [];
    const imp = M.world.important || {};
    const now = Date.now();
    for (const e of M.entries.values()) {
      if (e.status === "scrapped" || e.type === "map" || e.type === "note") continue;
      const ty = typeOf(e.type);
      const bodyWords = words(e.body);
      const filled = ty.fields.filter(x => has(f(e, x.key))).length;
      const back = (Idx.backlinks.get(e.id) || []).length;
      const age = (now - new Date(e.updated || e.created || now)) / 86400000;
      if (bodyWords < 40 && filled < 2)
        cards.push({ kind: "thin", id: e.id, why: tf(`Only ${bodyWords} words so far.`, `Само ${bodyWords} думи засега.`), score: 60 + back * 4 });
      const missing = (imp[e.type] || []).filter(k => !has(f(e, k)));
      if (missing.length) {
        const labels = missing.map(k => fieldLabel(ty.fields.find(x => x.key === k) || { label: k }));
        cards.push({ kind: "fields", id: e.id, fields: missing, why: tf(`Missing: ${labels.join(", ")}.`, `Липсва: ${labels.join(", ")}.`), score: 30 + missing.length * 6 + back * 2 });
      }
      if (age > 45 && back < 2)
        cards.push({ kind: "forgotten", id: e.id, why: tf(`Not touched for ${Math.round(age)} days and almost nothing links to it.`, `Не е пипан от ${Math.round(age)} дни и почти нищо не сочи към него.`), score: 40 + Math.min(age, 365) / 10 });
      if (/\b(unnamed|untitled|unknown)\b|\?/i.test(e.title) || (e.tags || []).includes("needs-name"))
        cards.push({ kind: "unnamed", id: e.id, why: tf("Doesn't have a real name yet.", "Още няма истинско име."), score: 55 + back * 3 });
      if (e.type === "thread" && f(e, "open") !== "resolved" && f(e, "open") !== "dropped")
        cards.push({ kind: "thread", id: e.id, why: has(f(e, "payoff")) ? tf("Open plot thread.", "Отворена сюжетна нишка.") : tf("Open plot thread with no payoff yet.", "Отворена нишка без развръзка."), score: 65 });
      if ((e.questions || []).some(q => !q.done))
        cards.push({ kind: "questions", id: e.id, why: tf(`${(e.questions || []).filter(q => !q.done).length} unanswered questions saved.`, `${(e.questions || []).filter(q => !q.done).length} запазени въпроса без отговор.`), score: 70 });
      if (e.type === "character" && f(e, "life") === "dead" && !has(f(e, "died")))
        cards.push({ kind: "fields", id: e.id, fields: ["died"], why: tf("Dead, but when did they die?", "Мъртъв, но кога е починал?"), score: 35 });
    }
    for (const [, m] of Idx.missing)
      cards.push({ kind: "missing", title: m.title, from: [...m.from], why: tf(`Mentioned in ${[...m.from].map(name).join(", ")} but has no entry.`, `Споменато в ${[...m.from].map(name).join(", ")}, но няма запис.`), score: 50 + m.from.size * 8 });
    for (const c of contradictions().filter(c => c.status === "open"))
      cards.push({ kind: "contradiction", id: c.a?.id || c.b?.id, issue: c.key, why: c.why, score: 80 });
    return cards;
  }

  return { rules, contradictions, openCount, setStatus, fleshOut, has };
})();
