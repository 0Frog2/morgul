// Small Markdown renderer: headings, lists, quotes, bold/italic, images, tables, [[links]], :::secret blocks.
"use strict";
const MD = (() => {
  function inline(s, opt) {
    // links first (on the raw text), so names with ' or & survive escaping
    const keep = [];
    const hold = html => `\u0000${keep.push(html) - 1}\u0000`;
    s = String(s).replace(/\[\[([^\]|#]+)(#[^\]|]*)?(?:\|([^\]]*))?\]\]/g, (_, name, part, label) => {
      const n = name.trim();
      const e = typeof Idx !== "undefined" ? Idx.find(n) : null;
      const shown = esc(label || n);
      if (opt.link) return hold(opt.link(n, shown, e));
      return hold(`<a class="wl${e ? "" : " missing"}" data-title="${esc(n)}">${shown}</a>`);
    });
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => {
      const url = /^(https?:|\/|data:)/.test(src) ? src : (opt.assetBase || "/assets/") + src.replace(/^assets\//, "");
      return hold(`<img src="${esc(url)}" alt="${esc(alt)}" data-zoom>`);
    });
    s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, (_, txt, url) => hold(`<a href="${esc(url)}" target="_blank" rel="noopener">${esc(txt)}</a>`));
    s = esc(s);
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
         .replace(/(^|\W)_([^_\s][^_]*)_(?=\W|$)/g, "$1<em>$2</em>");
    return s.replace(/\u0000(\d+)\u0000/g, (_, i) => keep[+i]);
  }
  function render(src, opt = {}) {
    let text = String(src || "").replace(/\r/g, "");
    text = opt.noSecrets ? text.replace(/:::secret[\s\S]*?(:::|$)/g, "") : text;
    const lines = text.split("\n");
    const out = [];
    let i = 0;
    const para = [];
    const flush = () => { if (para.length) { out.push(`<p>${inline(para.join(" "), opt)}</p>`); para.length = 0; } };
    while (i < lines.length) {
      const l = lines[i];
      if (/^:::secret\s*$/.test(l.trim())) {
        flush(); const buf = []; i++;
        while (i < lines.length && lines[i].trim() !== ":::") buf.push(lines[i++]);
        i++; out.push(`<div class="secret">${render(buf.join("\n"), opt)}</div>`); continue;
      }
      if (!l.trim()) { flush(); i++; continue; }
      let m;
      if ((m = l.match(/^(#{1,4})\s+(.*)$/))) { flush(); const n = Math.min(m[1].length + 1, 4); out.push(`<h${n}>${inline(m[2], opt)}</h${n}>`); i++; continue; }
      if (/^(-{3,}|\*{3,})\s*$/.test(l)) { flush(); out.push("<hr>"); i++; continue; }
      if (/^>\s?/.test(l)) {
        flush(); const buf = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
        out.push(`<blockquote>${render(buf.join("\n"), opt)}</blockquote>`); continue;
      }
      if (/^\s*([-*+]|\d+[.)])\s+/.test(l)) {
        flush();
        // nested lists by indentation
        const parse = (indent) => {
          const ordered = /^\s*\d+[.)]/.test(lines[i]);
          const items = [];
          while (i < lines.length) {
            const L = lines[i];
            const mm = L.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
            if (!mm) { if (L.trim() && /^\s{2,}/.test(L) && items.length) { items[items.length - 1].t += " " + L.trim(); i++; continue; } break; }
            const ind = mm[1].replace(/\t/g, "  ").length;
            if (ind < indent) break;
            if (ind > indent && items.length) { items[items.length - 1].sub += parse(ind); continue; }
            items.push({ t: mm[3], sub: "" }); i++;
          }
          const tag = ordered ? "ol" : "ul";
          return `<${tag}>${items.map(x => `<li>${inline(x.t, opt)}${x.sub}</li>`).join("")}</${tag}>`;
        };
        out.push(parse(l.match(/^\s*/)[0].length)); continue;
      }
      if (/^\|.*\|\s*$/.test(l)) {
        flush(); const rows = [];
        while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) rows.push(lines[i++]);
        const cells = r => r.trim().slice(1, -1).split("|").map(c => c.trim());
        const body = rows.filter(r => !/^\|[\s:|-]+\|$/.test(r.trim()));
        out.push(`<table>${body.map((r, n) => `<tr>${cells(r).map(c => n === 0 && rows.length > 1 && /^\|[\s:|-]+\|$/.test((rows[1] || "").trim()) ? `<th>${inline(c, opt)}</th>` : `<td>${inline(c, opt)}</td>`).join("")}</tr>`).join("")}</table>`);
        continue;
      }
      para.push(l.trim()); i++;
    }
    flush();
    return out.join("\n");
  }
  return { render, inline };
})();
