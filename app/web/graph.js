// Relationship web (force layout, draggable) and family trees.
"use strict";
const REL_COLORS = { parent: "#8EB69B", child: "#8EB69B", spouse: "#DAF1DE", sibling: "#7FB0C9", lover: "#C97F9E", friend: "#6EB8B1",
  ally: "#9DB86E", mentor: "#C9B77F", student: "#C9B77F", master: "#B79CD9", servant: "#B79CD9", rival: "#D9A65A", enemy: "#C8685E", other: "#5d8a78", member: "#2E413A" };

Views.relations = (el, r, pane) => {
  const st = { factions: M.state.webFactions ?? true, focus: r.id || "", kinds: new Set(M.state.webKinds || Object.keys(REL_COLORS)) };
  el.innerHTML = paneHead(t("Relationships"), "", pane) + `<div class="pane-body flush">
    <div class="toolbar"><div style="width:240px" data-focus></div>
      <label class="small muted"><input type="checkbox" data-fac ${st.factions ? "checked" : ""}> ${tf("show factions", "покажи фракции")}</label>
      <span class="spacer"></span><div class="legend" data-legend></div><button class="btn small ghost" data-reset>${tf("Re-arrange", "Подреди наново")}</button></div>
    <div class="canvas-wrap" data-wrap><svg data-svg></svg></div>
    <div class="faint small" style="padding:6px 14px;border-top:1px solid var(--line)">${tf("Drag to move people · scroll to zoom · click a name to open it · relationships are edited on each character's page.", "Влачете, за да местите · колелото увеличава · щракнете име, за да го отворите · връзките се редактират в страницата на всеки персонаж.")}</div></div>`;
  Entry.linkPicker($("[data-focus]", el), st.focus ? [st.focus] : [], ["character", "entity", "creature"], ids => { st.focus = ids[0] || ""; build(); }, true);
  $("[data-focus] input", el).placeholder = tf("Focus on someone…", "Фокус върху някого…");
  const svg = $("[data-svg]", el), wrap = $("[data-wrap]", el);
  let nodes = [], links = [], view = { x: 0, y: 0, k: 1 };
  const posCache = M.state.webPos || (M.state.webPos = {});

  function build() {
    const people = [...M.entries.values()].filter(e => ["character", "entity", "creature"].includes(e.type) && e.status !== "scrapped");
    const L = [];
    for (const p of people) for (const rr of p.fields?.relations || []) if (M.entries.has(rr.to) && st.kinds.has(rr.kind)) L.push({ a: p.id, b: rr.to, kind: rr.kind });
    if (st.factions) for (const p of people) if (p.fields?.faction && M.entries.has(p.fields.faction)) L.push({ a: p.id, b: p.fields.faction, kind: "member" });
    let ids = new Set(L.flatMap(l => [l.a, l.b]));
    people.filter(p => (p.fields?.relations || []).length).forEach(p => ids.add(p.id));
    if (st.focus) { const near = new Set([st.focus]); L.forEach(l => { if (l.a === st.focus) near.add(l.b); if (l.b === st.focus) near.add(l.a); }); ids = near; }
    const W = wrap.clientWidth || 900, H = wrap.clientHeight || 600;
    nodes = [...ids].map(id => { const e = M.entries.get(id); const p = posCache[id];
      return { id, e, x: p?.[0] ?? W / 2 + (Math.random() - .5) * W * .6, y: p?.[1] ?? H / 2 + (Math.random() - .5) * H * .6, vx: 0, vy: 0 }; });
    const by = new Map(nodes.map(n => [n.id, n]));
    links = L.filter(l => by.has(l.a) && by.has(l.b)).map(l => ({ ...l, s: by.get(l.a), t: by.get(l.b) }));
    if (nodes.some(n => !posCache[n.id])) simulate(320);
    draw();
    const used = [...new Set(links.map(l => l.kind))];
    $("[data-legend]", el).innerHTML = used.map(k => `<span><i style="background:${REL_COLORS[k] || "#5d8a78"}"></i>${esc(k === "member" ? tf("member of", "член на") : k)}</span>`).join("");
  }
  function simulate(steps) {
    const W = wrap.clientWidth || 900, H = wrap.clientHeight || 600;
    for (let s = 0; s < steps; s++) {
      const a = 1 - s / steps;
      for (const n of nodes) { n.vx += (W / 2 - n.x) * .002; n.vy += (H / 2 - n.y) * .002; }
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        const A = nodes[i], B = nodes[j]; let dx = B.x - A.x, dy = B.y - A.y; let d2 = dx * dx + dy * dy || 1; const f = 2600 / d2;
        const d = Math.sqrt(d2); dx /= d; dy /= d; A.vx -= dx * f; A.vy -= dy * f; B.vx += dx * f; B.vy += dy * f;
      }
      for (const l of links) { const dx = l.t.x - l.s.x, dy = l.t.y - l.s.y; const d = Math.sqrt(dx * dx + dy * dy) || 1; const f = (d - (l.kind === "member" ? 150 : 110)) * .02;
        l.s.vx += dx / d * f; l.s.vy += dy / d * f; l.t.vx -= dx / d * f; l.t.vy -= dy / d * f; }
      for (const n of nodes) { if (n.fixed) continue; n.x += Math.max(-20, Math.min(20, n.vx)) * a; n.y += Math.max(-20, Math.min(20, n.vy)) * a; n.vx *= .6; n.vy *= .6; }
    }
    nodes.forEach(n => posCache[n.id] = [Math.round(n.x), Math.round(n.y)]); saveState();
  }
  function draw() {
    if (!nodes.length) { svg.innerHTML = `<text x="50%" y="50%" text-anchor="middle" style="fill:var(--faint)" font-size="14">${esc(tf("No relationships yet. Add them on a character's page (Edit → Relationships).", "Още няма връзки. Добавете ги в страницата на персонаж (Редактирай → Връзки)."))}</text>`; return; }
    svg.innerHTML = `<g transform="translate(${view.x},${view.y}) scale(${view.k})">
      ${links.map(l => `<line x1="${l.s.x}" y1="${l.s.y}" x2="${l.t.x}" y2="${l.t.y}" stroke="${REL_COLORS[l.kind] || "#5d8a78"}" stroke-width="${l.kind === "member" ? 1 : 2}" ${l.kind === "member" ? 'stroke-dasharray="4 4"' : ""} opacity=".8"><title>${esc(l.s.e.title)} — ${esc(l.kind)} — ${esc(l.t.e.title)}</title></line>`).join("")}
      ${nodes.map(n => { const ty = typeOf(n.e.type); const big = n.e.type === "faction" || n.id === st.focus; const dead = n.e.fields?.life === "dead";
        return `<g class="graph-node" data-n="${n.id}" transform="translate(${n.x},${n.y})"><circle r="${big ? 13 : 9}" fill="${n.e.type === "faction" ? cssVar("panel") : cssVar("raised")}" stroke="${ty.color}" ${dead ? 'stroke-dasharray="3 2"' : ""}/>
          <text y="${big ? 28 : 23}" text-anchor="middle">${esc(n.e.title)}${dead ? " †" : ""}</text></g>`; }).join("")}</g>`;
  }
  // interaction: drag node / pan / zoom
  let drag = null, pan = null, moved = false;
  svg.onmousedown = ev => {
    moved = false;
    const g = ev.target.closest("[data-n]");
    if (g) { const n = nodes.find(x => x.id === g.dataset.n); drag = { n, sx: ev.clientX, sy: ev.clientY, ox: n.x, oy: n.y }; }
    else { pan = { sx: ev.clientX, sy: ev.clientY, ox: view.x, oy: view.y }; wrap.classList.add("drag"); }
  };
  const mm = ev => {
    if (drag) { moved = true; drag.n.x = drag.ox + (ev.clientX - drag.sx) / view.k; drag.n.y = drag.oy + (ev.clientY - drag.sy) / view.k; draw(); }
    if (pan) { moved = true; view.x = pan.ox + ev.clientX - pan.sx; view.y = pan.oy + ev.clientY - pan.sy; draw(); }
  };
  const mu = ev => {
    if (drag) { posCache[drag.n.id] = [Math.round(drag.n.x), Math.round(drag.n.y)]; saveState(); if (!moved) open(drag.n.id, ev.shiftKey); }
    drag = pan = null; wrap.classList.remove("drag");
  };
  window.addEventListener("mousemove", mm); window.addEventListener("mouseup", mu);
  svg.onwheel = ev => { ev.preventDefault(); const k = Math.max(.3, Math.min(3, view.k * (ev.deltaY < 0 ? 1.1 : 0.9))); const r = svg.getBoundingClientRect();
    const mx = ev.clientX - r.left, my = ev.clientY - r.top; view.x = mx - (mx - view.x) * k / view.k; view.y = my - (my - view.y) * k / view.k; view.k = k; draw(); };
  $("[data-fac]", el).onchange = ev => { st.factions = ev.target.checked; M.state.webFactions = st.factions; saveState(); build(); };
  $("[data-reset]", el).onclick = () => { nodes.forEach(n => delete posCache[n.id]); build(); };
  const obs = new MutationObserver(() => { if (!el.contains(svg)) { window.removeEventListener("mousemove", mm); window.removeEventListener("mouseup", mu); obs.disconnect(); } });
  obs.observe(el, { childList: true });
  requestAnimationFrame(build);
};

// ------------------------------------------------------------------ family tree
Views.family = (el, r, pane) => {
  const chars = sortByTitle(entriesOf("character"));
  let root = r.id || M.state.familyRoot || chars.find(c => Entry.relationsOf(c).some(x => ["parent", "child", "spouse"].includes(x.kind)))?.id || chars[0]?.id;
  el.innerHTML = paneHead(t("Family trees"), "", pane) + `<div class="pane-body"><div class="wrap wide">
    <div class="row" style="margin-bottom:10px"><div style="width:280px" data-root></div><span class="faint small">${tf("Built from parent / child / spouse / sibling relationships.", "Изгражда се от връзките родител / дете / съпруг / брат-сестра.")}</span></div>
    <div data-tree></div></div></div>`;
  Entry.linkPicker($("[data-root]", el), root ? [root] : [], ["character"], ids => { root = ids[0]; M.state.familyRoot = root; saveState(); draw(); }, true);
  const rel = id => Entry.relationsOf(M.entries.get(id) || { id });
  const parents = id => rel(id).filter(x => x.kind === "parent").map(x => x.to).filter(x => M.entries.has(x));
  const children = id => rel(id).filter(x => x.kind === "child").map(x => x.to).filter(x => M.entries.has(x));
  const spouses = id => rel(id).filter(x => x.kind === "spouse").map(x => x.to).filter(x => M.entries.has(x));
  const siblings = id => { const s = new Set(rel(id).filter(x => x.kind === "sibling").map(x => x.to)); parents(id).forEach(p => children(p).forEach(c => s.add(c))); s.delete(id); return [...s].filter(x => M.entries.has(x)); };
  const node = (id, cls = "") => { const e = M.entries.get(id); const b = e.fields?.born ? Cal.format(e.fields.born) : "", d = e.fields?.died ? Cal.format(e.fields.died) : "";
    return `<div class="ft-node ${cls}" data-open="${id}"><div>${esc(e.title)}</div>${b || d ? `<div class="d">${esc(b)}${d ? " – " + esc(d) : ""}</div>` : ""}</div>`; };
  const couple = (id, cls) => `<div class="ft-couple">${node(id, cls)}${spouses(id).map(s => `<span class="amp">⚭</span>${node(s)}`).join("")}</div>`;
  function draw() {
    if (!root || !M.entries.has(root)) { $("[data-tree]", el).innerHTML = `<div class="empty">${tf("No characters yet.", "Още няма персонажи.")}</div>`; return; }
    const gens = [];
    let up = [root];
    for (let g = 0; g < 3; g++) { up = [...new Set(up.flatMap(parents))]; if (!up.length) break; gens.unshift(up); }
    const rows = gens.map(g => `<div class="ft-gen">${dedupeCouples(g).map(id => couple(id)).join("")}</div>`);
    rows.push(`<div class="ft-gen">${siblings(root).map(s => node(s)).join("")}${couple(root, "root")}</div>`);
    let down = [root, ...spouses(root)];
    for (let g = 0; g < 3; g++) { down = [...new Set(down.flatMap(children))]; if (!down.length) break; rows.push(`<div class="ft-gen">${dedupeCouples(down).map(id => couple(id)).join("")}</div>`); down = [...down, ...down.flatMap(spouses)]; }
    $("[data-tree]", el).innerHTML = `<div class="ft">${rows.join(`<div class="faint">│</div>`)}</div>` + (rows.length === 1 && !siblings(root).length && !spouses(root).length
      ? `<div class="empty">${tf("No family relationships for this character yet.", "Този персонаж още няма семейни връзки.")}</div>` : "");
  }
  const dedupeCouples = ids => { const seen = new Set(); return ids.filter(id => { if (seen.has(id)) return false; seen.add(id); spouses(id).forEach(s => seen.add(s)); return true; }); };
  draw();
};
