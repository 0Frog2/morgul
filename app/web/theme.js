// Themes: every color, fonts, size, spacing, corners, glow, background image; save / export / import your own.
// Stored per world in app-settings.json → theme. Type colors live with the types (world.json).
"use strict";

const THEME_DEFAULT = {
  colors: { bg: "#050807", panel: "#0A0F0D", side: "#0A0F0D", raised: "#111916", line: "#1E2B27", text: "#D6DED8",
    accent: "#8EB69B", link: "#8EB69B", warn: "#D9A65A", danger: "#C8685E" },
  fonts: { head: "Cambria", body: "Segoe UI", editor: "Segoe UI" },
  scale: 100, lineHeight: 1.72, radius: 10, glow: 100, dense: false, bgImage: "", bgVeil: 80,
};
const THEMES = {
  "Minas Morgul": THEME_DEFAULT,
  "Old green": { colors: { bg: "#051F20", panel: "#0B2B26", side: "#0B2B26", raised: "#163832", line: "#235347", text: "#DAF1DE", accent: "#8EB69B", link: "#8EB69B", warn: "#D9A65A", danger: "#C8685E" } },
  "Ash & ember": { colors: { bg: "#0A0808", panel: "#121010", side: "#0F0D0D", raised: "#1B1716", line: "#2C2523", text: "#E2DAD4", accent: "#C98F6A", link: "#D9A27C", warn: "#D9A65A", danger: "#C8685E" } },
  "Night ink": { colors: { bg: "#06080D", panel: "#0C1018", side: "#0A0D14", raised: "#131925", line: "#202A3A", text: "#D8DEEA", accent: "#8FA8D6", link: "#9DB6E4", warn: "#D9A65A", danger: "#C8685E" } },
  "Blood moon": { colors: { bg: "#0B0506", panel: "#140A0C", side: "#100709", raised: "#1E0F12", line: "#33181D", text: "#E6D6D6", accent: "#B5424E", link: "#D06A73", warn: "#D9A65A", danger: "#E07A6E" }, fonts: { head: "Palatino Linotype" } },
  "Parchment (light)": { colors: { bg: "#EFE6D2", panel: "#F7F0E1", side: "#E6DBC2", raised: "#FFF9EC", line: "#CDBF9F", text: "#2E261C", accent: "#7A5B2E", link: "#8A4B1F", warn: "#A86A12", danger: "#A63A2E" }, fonts: { head: "Georgia" }, glow: 0 },
};
const THEME_COLORS = [["bg", "Background", "Фон"], ["panel", "Panels and cards", "Панели и карти"], ["side", "Sidebar", "Странична лента"], ["raised", "Raised (buttons, menus)", "Повдигнати (бутони, менюта)"],
  ["line", "Lines and borders", "Линии и рамки"], ["text", "Text", "Текст"], ["accent", "Accent and glow", "Акцент и сияние"], ["link", "Links", "Връзки"], ["warn", "Warnings", "Предупреждения"], ["danger", "Delete", "Изтриване"]];
const THEME_FONTS = ["Segoe UI", "Cambria", "Georgia", "Palatino Linotype", "Book Antiqua", "Garamond", "Times New Roman", "Constantia", "Calibri", "Candara", "Corbel",
  "Trebuchet MS", "Verdana", "Tahoma", "Arial", "Bahnschrift", "Sitka Text", "Gabriola", "Consolas", "Cascadia Mono", "Courier New"];

const mergeTheme = (...ts) => ts.reduce((a, t) => t ? { ...a, ...t, colors: { ...a.colors, ...(t.colors || {}) }, fonts: { ...a.fonts, ...(t.fonts || {}) } } : a, structuredClone(THEME_DEFAULT));
// older settings stored a flat color object (bg, panel, …): read those as colors
function currentTheme() {
  const t = M.settings.theme || {};
  return mergeTheme(t.colors || t.fonts || t.scale ? t : { colors: Object.fromEntries(Object.entries(t).filter(([k]) => THEME_DEFAULT.colors[k])) });
}
function themeColors() { return currentTheme().colors; }
const fontStack = (f, fallback) => `"${String(f).replace(/["\\]/g, "")}", ${fallback}`;

applyTheme = (th = currentTheme()) => {
  const c = th.colors, r = document.documentElement.style, g = Math.max(0, +th.glow || 0) / 100;
  for (const k of Object.keys(THEME_DEFAULT.colors)) r.setProperty("--" + k, c[k]);
  r.setProperty("--muted", rgba(c.text, .62)); r.setProperty("--faint", rgba(c.text, .38));
  r.setProperty("--accent-soft", rgba(c.accent, .10)); r.setProperty("--accent-mid", rgba(c.accent, .22));
  r.setProperty("--accent-glow", rgba(c.accent, .35 * g)); r.setProperty("--accent-halo", rgba(c.accent, .18 * g));
  r.setProperty("--warn-soft", rgba(c.warn, .14)); r.setProperty("--danger-soft", rgba(c.danger, .14)); r.setProperty("--row-line", rgba(c.line, .9));
  r.setProperty("--serif", fontStack(th.fonts.head, "Georgia, serif")); r.setProperty("--sans", fontStack(th.fonts.body, "system-ui, sans-serif"));
  r.setProperty("--editor-font", fontStack(th.fonts.editor, "system-ui, sans-serif"));
  r.setProperty("--read-lh", th.lineHeight); r.setProperty("--r", (+th.radius) + "px");
  document.body.style.zoom = (+th.scale || 100) / 100;
  document.body.classList.toggle("dense", !!th.dense); document.body.classList.toggle("no-glow", g === 0);
  const light = (([R, G, B]) => R * .299 + G * .587 + B * .114)(hexRgb(c.bg)) > 140;
  r.setProperty("color-scheme", light ? "light" : "dark"); $('meta[name="color-scheme"]')?.setAttribute("content", light ? "light" : "dark");
  const app = $("#app");
  if (th.bgImage) { r.setProperty("--bg-img", `url("${img(th.bgImage)}")`); r.setProperty("--bg-veil", rgba(c.bg, Math.min(1, (+th.bgVeil || 0) / 100))); app?.classList.add("has-bg"); }
  else app?.classList.remove("has-bg");
  $('meta[name="theme-color"]')?.setAttribute("content", c.bg);
};

// ------------------------------------------------------------------ Settings → Theme
const ThemeEditor = {
  render(box) {
    const th = currentTheme(), mine = M.settings.customThemes || {};
    const fontSel = (k) => `<select class="input" data-font="${k}">${[...new Set([th.fonts[k], ...THEME_FONTS])].map(f => `<option ${f === th.fonts[k] ? "selected" : ""} style="font-family:'${esc(f)}'">${esc(f)}</option>`).join("")}<option value="__other">${tf("Other font…", "Друг шрифт…")}</option></select>`;
    const range = (k, min, max, step, unit, label) => `<label>${label}</label><div class="row"><input type="range" data-num="${k}" min="${min}" max="${max}" step="${step}" value="${th[k]}" style="flex:1"><span class="small" data-val="${k}" style="width:52px;text-align:right">${th[k]}${unit}</span></div>`;
    box.innerHTML = `
      <div class="row theme-presets" style="margin-bottom:10px"><span class="faint small">${tf("Start from:", "Започнете от:")}</span>
        ${Object.entries(THEMES).map(([n, t]) => { const c = mergeTheme(t).colors; return `<button class="chip" data-preset="${esc(n)}"><i style="background:${c.bg}"></i><i style="background:${c.accent}"></i>${esc(n)}</button>`; }).join("")}
        ${Object.keys(mine).map(n => { const c = mergeTheme(mine[n]).colors; return `<span class="chip on" data-mine="${esc(n)}"><i style="background:${c.bg}"></i><i style="background:${c.accent}"></i>${esc(n)}<span class="x" data-delmine="${esc(n)}" title="${t("Delete")}">✕</span></span>`; }).join("")}
      </div>
      <div class="section-sub">${tf("Colors", "Цветове")}</div>
      <div class="swatches">${THEME_COLORS.map(([k, en, bg]) => `<label class="swatch"><input type="color" data-col="${k}" value="${th.colors[k]}"><span>${esc(tf(en, bg))}</span><code data-hex="${k}">${th.colors[k].toUpperCase()}</code></label>`).join("")}</div>
      <div class="section-sub">${tf("Entry type colors", "Цветове на видовете")}</div>
      <div class="swatches">${M.world.types.map((ty, i) => `<label class="swatch"><input type="color" data-tycol="${i}" value="${/^#[0-9a-f]{6}$/i.test(ty.color) ? ty.color : "#8EB69B"}"><span>${esc(ty.icon)} ${esc(typeName(ty.key))}</span></label>`).join("")}</div>
      <div class="section-sub">${tf("Text and layout", "Текст и подредба")}</div>
      <div class="form-grid">
        <label>${tf("Headings font", "Шрифт за заглавия")}</label>${fontSel("head")}
        <label>${tf("Interface font", "Шрифт на интерфейса")}</label>${fontSel("body")}
        <label>${tf("Writing font", "Шрифт за писане")}</label>${fontSel("editor")}
        ${range("scale", 80, 140, 5, "%", tf("Size of everything", "Размер на всичко"))}
        ${range("lineHeight", 1.3, 2.1, .05, "", tf("Line spacing when reading", "Междуредие при четене"))}
        ${range("radius", 0, 20, 1, "px", tf("Corner roundness", "Заобленост на ъглите"))}
        ${range("glow", 0, 200, 10, "%", tf("Glow", "Сияние"))}
        <label>${tf("Layout", "Подредба")}</label><label class="small" style="padding-top:6px"><input type="checkbox" data-dense ${th.dense ? "checked" : ""}> ${tf("Compact (less spacing, more on screen)", "Сбито (по-малко разстояния, повече на екрана)")}</label>
        <label>${tf("Background image", "Фоново изображение")}</label><div class="row">
          <button class="btn small" data-bgpick>${th.bgImage ? esc(th.bgImage) : tf("Choose an image…", "Изберете изображение…")}</button>
          ${th.bgImage ? `<button class="btn small ghost" data-bgclear>✕</button>` : ""}</div>
        ${th.bgImage ? range("bgVeil", 30, 98, 2, "%", tf("Darken the image", "Затъмняване на изображението")) : ""}
      </div>
      <div class="row" style="margin-top:12px">
        <button class="btn small" data-savemine>＋ ${tf("Save as my theme…", "Запази като моя тема…")}</button>
        <button class="btn small ghost" data-export>⇩ ${tf("Export theme file", "Експорт на тема")}</button>
        <button class="btn small ghost" data-import>⇧ ${tf("Import theme file", "Внеси тема")}</button>
        <span class="spacer"></span><button class="btn small ghost" data-reset>${tf("Reset to Minas Morgul", "Върни Minas Morgul")}</button>
      </div>
      <div class="faint small" style="margin-top:6px">${tf("Changes show right away and are saved automatically. Theme files (.morgul-theme) can be shared with other Morgul users.", "Промените се виждат веднага и се запазват автоматично. Файловете с теми (.morgul-theme) може да се споделят.")}</div>`;
    const set = (patch, redraw = false) => {
      const next = mergeTheme(currentTheme(), patch);
      M.settings.theme = next; applyTheme(next); this.save(next);
      if (redraw) this.render(box);
      else for (const k of ["scale", "lineHeight", "radius", "glow", "bgVeil"]) { const v = $(`[data-val="${k}"]`, box); if (v) v.textContent = next[k] + ({ scale: "%", radius: "px", glow: "%", bgVeil: "%" }[k] || ""); }
    };
    $$("[data-col]", box).forEach(i => i.oninput = () => { $(`[data-hex="${i.dataset.col}"]`, box).textContent = i.value.toUpperCase(); set({ colors: { [i.dataset.col]: i.value } }); });
    $$("[data-tycol]", box).forEach(i => i.oninput = () => { M.world.types[+i.dataset.tycol].color = i.value; this.saveTypes(); });
    $$("[data-num]", box).forEach(i => i.oninput = () => set({ [i.dataset.num]: +i.value }));
    $$("[data-font]", box).forEach(s => s.onchange = async () => {
      let f = s.value;
      if (f === "__other") { f = await promptBox(tf("Font name exactly as Windows shows it", "Име на шрифта, точно както е в Windows"), "", "Book Antiqua"); if (!f) return this.render(box); }
      set({ fonts: { [s.dataset.font]: f } }, s.value === "__other");
    });
    $("[data-dense]", box).onchange = e => set({ dense: e.target.checked });
    $$("[data-preset]", box).forEach(b => b.onclick = () => { const p = THEMES[b.dataset.preset]; M.settings.theme = mergeTheme(p); applyTheme(M.settings.theme); this.save(M.settings.theme); this.render(box); });
    $$("[data-mine]", box).forEach(b => b.onclick = ev => { if (ev.target.closest("[data-delmine]")) return; M.settings.theme = mergeTheme(mine[b.dataset.mine]); applyTheme(M.settings.theme); this.save(M.settings.theme); this.render(box); });
    $$("[data-delmine]", box).forEach(b => b.onclick = async () => {
      if (!await confirmBox(tf(`Delete your theme “${b.dataset.delmine}”?`, `Да изтрия ли темата „${b.dataset.delmine}“?`))) return;
      const m = { ...mine }; delete m[b.dataset.delmine]; M.settings = await api("settings", { customThemes: m }); this.render(box);
    });
    $("[data-reset]", box).onclick = () => { M.settings.theme = structuredClone(THEME_DEFAULT); applyTheme(M.settings.theme); this.save(M.settings.theme); this.render(box); };
    $("[data-savemine]", box).onclick = async () => {
      const n = await promptBox(tf("Name your theme", "Име на темата"), "", tf("My dark theme", "Моята тъмна тема")); if (!n) return;
      M.settings = await api("settings", { customThemes: { ...(M.settings.customThemes || {}), [n]: currentTheme() } }); this.render(box); toast(tf(`Saved “${n}”.`, `Запазено „${n}“.`));
    };
    $("[data-export]", box).onclick = () => {
      const name = (Object.entries(M.settings.customThemes || {}).find(([, v]) => JSON.stringify(v) === JSON.stringify(currentTheme()))?.[0]) || "My Morgul theme";
      const blob = new Blob([JSON.stringify({ morgulTheme: 1, name, theme: currentTheme() }, null, 2)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${name}.morgul-theme`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast(tf("Theme file saved to your Downloads folder.", "Файлът с темата е запазен в Изтегляния."));
    };
    $("[data-import]", box).onclick = () => {
      const i = document.createElement("input"); i.type = "file"; i.accept = ".morgul-theme,.json";
      i.onchange = async () => {
        try {
          const d = JSON.parse(await i.files[0].text()); if (!d.theme?.colors) throw new Error();
          const th = mergeTheme(d.theme); th.bgImage = "";                  // the image isn't inside the file
          M.settings = await api("settings", { theme: th, customThemes: { ...(M.settings.customThemes || {}), [d.name || "Imported theme"]: th } });
          applyTheme(th); this.render(box); toast(tf(`Theme “${d.name || "Imported"}” added.`, `Темата „${d.name || "Внесена"}“ е добавена.`));
        } catch { toast(tf("That isn't a Morgul theme file.", "Това не е файл с тема на Morgul."), "error"); }
      };
      i.click();
    };
    const bp = $("[data-bgpick]", box);
    bp.onclick = async () => {
      const assets = (await api("assets")).filter(f => /\.(png|jpe?g|webp|gif)$/i.test(f));
      const pick = await modal(tf("Background image", "Фоново изображение"), `<div class="g-grid" style="grid-template-columns:repeat(auto-fill,minmax(120px,1fr))">
          <div class="g-tile" data-up style="display:flex;align-items:center;justify-content:center;min-height:110px;cursor:pointer">＋ ${tf("Upload…", "Качи…")}</div>
          ${assets.map(f => `<div class="g-tile" data-f="${esc(f)}" style="cursor:pointer"><div class="img" style="height:90px;background-image:url('${img(f)}')"></div><div class="g-cap small">${esc(f)}</div></div>`).join("")}</div>`,
        { wide: true, onOpen: (ov, close) => {
          $$("[data-f]", ov).forEach(x => x.onclick = () => close(x.dataset.f));
          $("[data-up]", ov).onclick = () => { const i = document.createElement("input"); i.type = "file"; i.accept = "image/*"; i.onchange = async () => { const got = await Entry.upload([...i.files]); if (got[0]) close(got[0]); }; i.click(); };
        } });
      if (pick) set({ bgImage: pick }, true);
    };
    const bc = $("[data-bgclear]", box); if (bc) bc.onclick = () => set({ bgImage: "" }, true);
  },
  save: debounce(async th => { M.settings = { ...(await api("settings", { theme: th })) }; }, 400),
  saveTypes: debounce(async () => { await saveWorld(); Nav.render(); }, 500),
};
