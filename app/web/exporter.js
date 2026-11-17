// Export: a static website (folder you can open or share) and print / save as PDF.
// Secret entries, author-only notes and :::secret blocks are never included.
"use strict";
const Exporter = (() => {
  const publicEntries = ids => (ids ? ids.map(id => M.entries.get(id)) : [...M.entries.values()])
    .filter(e => e && !e.secret && e.status !== "scrapped" && e.type !== "note" && e.type !== "secret");
  const file = e => slugify(e.title) + ".html";
  const slugify = s => String(s).normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase() || "entry";

  function fieldsHtml(e, linkTo) {
    return typeOf(e.type).fields.map(fd => {
      const v = e.fields?.[fd.key]; if (!Checks.has(v)) return "";
      const L = id => { const x = M.entries.get(id); return !x ? "" : linkTo(x) ? `<a href="${linkTo(x)}">${esc(x.title)}</a>` : esc(x.title); };
      let s;
      switch (fd.kind) {
        case "link": s = L(v); break; case "links": s = v.map(L).join(", "); break; case "date": s = esc(Cal.format(v)); break;
        case "relations": s = v.map(r => `${esc(r.kind)}: ${L(r.to)}`).join("<br>"); break;
        case "knowers": return "";       // who knows a secret is author-only
        case "steps": s = `<ol>${v.split("\n").filter(Boolean).map(x => `<li>${esc(x)}</li>`).join("")}</ol>`; break;
        case "list": s = v.split("\n").filter(Boolean).map(esc).join("<br>"); break;
        default: s = esc(v).replace(/\n/g, "<br>");
      }
      return s ? `<tr><th>${esc(fieldLabel(fd))}</th><td>${s}</td></tr>` : "";
    }).join("");
  }
  const CSS = () => { const c = themeColors(), m = a => rgba(c.text, a); return `body{margin:0;background:${c.bg};color:${c.text};font:16px/1.7 Georgia,Cambria,serif}a{color:${c.accent}}main{max-width:860px;margin:0 auto;padding:40px 24px}
    header{border-bottom:1px solid ${c.line};padding:14px 24px;background:${c.panel};font:600 20px Georgia;letter-spacing:1px}header a{text-decoration:none;color:${c.text}}
    h1{font-size:34px;margin:0 0 4px}.type{color:${c.accent};font:13px "Segoe UI",sans-serif;text-transform:uppercase;letter-spacing:1px}
    table{border-collapse:collapse;margin:16px 0;font:14px "Segoe UI",sans-serif}th{text-align:left;color:${m(.6)};font-weight:400;padding:3px 16px 3px 0;vertical-align:top}td{padding:3px 0}
    img{max-width:100%;border-radius:8px}.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;margin:16px 0}
    .idx h2{font-size:18px;color:${c.accent};border-bottom:1px solid ${c.line};margin-top:28px}.idx a{display:block;padding:2px 0}blockquote{border-left:3px solid ${c.line};margin:0;padding:2px 14px;color:${m(.7)}}`; };

  async function site(ids = null, name = "Morgul World") {
    const list = publicEntries(ids);
    if (!list.length) return toast(tf("Nothing to export (secret, scrapped and inbox entries are left out).", "Няма какво да се експортира (тайни, отхвърлени и входящи се пропускат)."), "warn");
    const inSet = new Set(list.map(e => e.id));
    const linkTo = x => inSet.has(x.id) ? file(x) : null;
    const images = new Set();
    const files = {};
    const page = (title, content) => `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS()}</style></head><body><header><a href="index.html">${esc(name)}</a></header><main>${content}</main></body></html>`;
    for (const e of list) {
      const body = MD.render(e.body, { noSecrets: true, assetBase: "assets/", link: (n, label, x) => x && inSet.has(x.id) ? `<a href="${file(x)}">${label}</a>` : esc(label) });
      (body.match(/src="assets\/([^"]+)"/g) || []).forEach(m => images.add(decodeURIComponent(m.slice(12, -1))));
      (e.images || []).forEach(f => images.add(f));
      files[file(e)] = page(e.title, `<div class="type">${esc(typeName(e.type))}</div><h1>${esc(e.title)}</h1>${(e.aliases || []).length ? `<div style="color:${rgba(themeColors().text, .6)}">${e.aliases.map(esc).join(", ")}</div>` : ""}
        ${fieldsHtml(e, linkTo) ? `<table>${fieldsHtml(e, linkTo)}</table>` : ""}${body}
        ${(e.images || []).length ? `<div class="gallery">${e.images.map(f => `<a href="assets/${encodeURIComponent(f)}"><img src="assets/${encodeURIComponent(f)}"></a>`).join("")}</div>` : ""}`);
    }
    const groups = {};
    list.forEach(e => (groups[e.type] = groups[e.type] || []).push(e));
    files["index.html"] = page(name, `<h1>${esc(name)}</h1><div class="idx">${Object.entries(groups).map(([k, es]) => `<h2>${esc(typeName(k))}</h2>${sortByTitle(es).map(e => `<a href="${file(e)}">${esc(e.title)}</a>`).join("")}`).join("")}</div>`);
    const r = await api("export", { name, files, images: [...images] });
    toast(tf("Exported to ", "Експортирано в ") + r.path);
    api("open", { path: r.path + "\\index.html" }).catch(() => {});
  }

  function print(ids = null) {
    const list = publicEntries(ids);
    if (!list.length) return toast(tf("Nothing to print.", "Няма какво да се отпечата."), "warn");
    $("#print").innerHTML = list.map(e => `<div class="pe"><div class="meta">${esc(typeName(e.type))}</div><h1>${esc(e.title)}</h1>
      ${fieldsHtml(e, () => null) ? `<table>${fieldsHtml(e, () => null)}</table>` : ""}${MD.render(e.body, { noSecrets: true, link: (n, label) => esc(label) })}
      ${(e.images || []).map(f => `<img src="${img(f)}">`).join("")}</div>`).join("");
    setTimeout(() => window.print(), 150);
  }

  async function dialog() {
    const types = M.world.types.filter(x => entriesOf(x.key).length && !["note", "secret"].includes(x.key));
    const res = await modal(t("Export"), `<div class="muted small" style="margin-bottom:10px">${tf("Secret entries, author-only notes and :::secret parts are always left out.", "Тайните записи, бележките само за автора и частите :::secret винаги се пропускат.")}</div>
      <div class="row" style="margin-bottom:10px">${types.map(x => `<label class="chip on"><input type="checkbox" data-t="${x.key}" checked hidden>${x.icon} ${esc(typeName(x.key))} (${entriesOf(x.key).length})</label>`).join("")}</div>
      <label class="small muted"><input type="checkbox" data-canon> ${tf("Only canon", "Само канон")}</label>`, {
      buttons: [{ label: t("Cancel"), value: null }, { label: "❡ " + tf("World Bible / book…", "Библия на света / книга…"), value: ov => ({ how: "compile", ov }) }, { label: "⎙ " + t("Print / PDF"), value: ov => ({ how: "print", ov }) }, { label: "⇪ " + tf("Website folder", "Уеб папка"), cls: "primary", value: ov => ({ how: "site", ov }) }],
      onOpen: ov => $$("label.chip", ov).forEach(l => l.onclick = ev => { ev.preventDefault(); const c = $("input", l); c.checked = !c.checked; l.classList.toggle("on", c.checked); }),
    });
    if (!res) return;
    if (res.how === "compile") return Compile.dialog();
    const keep = new Set($$("[data-t]", res.ov).filter(c => c.checked).map(c => c.dataset.t));
    const canon = $("[data-canon]", res.ov).checked;
    const ids = [...M.entries.values()].filter(e => keep.has(e.type) && (!canon || e.status === "canon")).map(e => e.id);
    res.how === "print" ? print(ids) : site(ids, M.world.name || "Morgul World");
  }
  return { site, print, dialog };
})();
