"use strict";
// Direction, hint bidi, settings visibility: every claim from the "settings
// look broken" report, proven against the real renderer.
//
// 1. Plugin-owned hints ("Type here…", "Comma separated") must be bidi-armed
//    (LRI … PDI) so a Persian card still shows them reading left-to-right.
// 2. Every typed scalar control (select/number/url/secret/multiline/code) must
//    carry its own `dir` and update it as the value changes.
// 3. `Vt` auto detection must pick the FIRST STRONG DIRECTIONAL character in
//    the whole string, not just scan a leading neutral run.
// 4. The reuse shape must change when type/alignment change, or the modal saves
//    leave the old control on screen.
// 5. Title alignment must actually render.
// 6. The field menu must hide rows that cannot apply to an item-based field.
// 7. The plugin tab must not expose the diagnostic-logging switch and must
//    describe "Default text direction" honestly (new fields only).
// 8. A settings change must reach the editor's decoration field through a
//    refresh effect, not an empty dispatch.
// 9. "Default text direction" in the plugin tab must be a working switch: it is
//    the base direction of every field left on Auto (and the seed for new
//    fields), with an explicitly declared field direction still winning.
// 10. The refresh must not depend on the undocumented `editor.cm` hop: live
//     CodeMirror views register themselves with the plugin and the dispatch
//     goes straight to them.
// 11. The directions must survive a foreign per-element direction plugin (a
//     vault can run one whose CSS says `.is-rtl div { direction: rtl }`):
//     resolved direction must also travel as sc-dir-* classes (author level,
//     !important), the mirror must follow its wrap, and armored plugin hints
//     must keep their own LTR line placement in RTL fields.
// 12. Title alignment covers the boxes the user actually reads: on an item
//     card that means the title item's own text box, not just the field label.
// 13. The "Help text" row is gone from the field menu (worthless per the
//     report); existing `help:` values in old notes still render.
const fs = require("fs");
const Module = require("module");
const T = require("./paths.cjs").T;
const { JSDOM } = require("jsdom");

const dom = new JSDOM("<!doctype html><html><body><div id='root'></div><div id='c'></div></body></html>", { pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(global, "navigator", { value: dom.window.navigator, configurable: true, writable: true });
global.HTMLElement = dom.window.HTMLElement;
global.HTMLInputElement = dom.window.HTMLInputElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.Event = dom.window.Event;
global.MouseEvent = dom.window.MouseEvent;
global.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
global.requestAnimationFrame = (f) => setTimeout(() => f(Date.now()), 0);
global.cancelAnimationFrame = clearTimeout;
global.AbortController = dom.window.AbortController;
global.AbortSignal = dom.window.AbortSignal;

const Proto = dom.window.HTMLElement.prototype;
const helpers = {
  createEl(tag, o = {}) {
    const e = this.ownerDocument.createElement(tag);
    if (o.text !== undefined) e.textContent = o.text;
    if (o.cls) e.className = o.cls;
    if (o.attr) for (const k in o.attr) e.setAttribute(k, o.attr[k]);
    if (o.type) e.type = o.type;
    if (o.value !== undefined) e.value = o.value;
    this.appendChild(e);
    return e;
  },
  createDiv(o = {}) { return this.createEl("div", o); },
  createSpan(o = {}) { return this.createEl("span", o); },
  addClass(...c) { this.classList.add(...c.filter(Boolean)); return this; },
  removeClass(...c) { this.classList.remove(...c.filter(Boolean)); return this; },
  toggleClass(c, on) { this.classList.toggle(c, on); return this; },
  hasClass(c) { return this.classList.contains(c); },
  setAttr(k, v) { this.setAttribute(k, v); return this; },
  empty() { this.innerHTML = ""; return this; },
  detach() { this.remove(); },
  setText(t) { this.textContent = t; return this; },
  hide() { this.style.display = "none"; },
  show() { this.style.display = ""; },
};
for (const [k, fn] of Object.entries(helpers)) {
  Object.defineProperty(Proto, k, { value: fn, writable: true, configurable: true });
  Object.defineProperty(dom.window.Element.prototype, k, { value: fn, writable: true, configurable: true });
}

const obsidian = require("./obsidian-stub.cjs");
obsidian.Notice = class { constructor(m) { notices.push(m); } };
obsidian.setIcon = (el, name) => { el.setAttribute("data-icon", name); };
obsidian.Menu = class {
  addItem(cb) { const it = { setTitle(t) { it.title = t; return it; }, setIcon(i) { it.icon = i; return it; }, onClick(f) { it.onClick = f; return it; } }; cb(it); return it; }
  addSeparator() {}
  showAtMouseEvent() {}
  showAtPosition() {}
};
// Modal rich enough for the field-settings modal to draw into.
let notices = [];
obsidian.Modal = class {
  constructor(app) {
    this.app = app;
    this.modalEl = document.getElementById("c").createDiv({ cls: "modal" });
    this.titleEl = this.modalEl.createDiv("modal-title");
    this.contentEl = this.modalEl.createDiv("modal-content");
  }
  open() { this.onOpen?.(); }
  close() { this.onClose?.(); }
};
// Setting rows that record themselves, like the real panel would.
const builtRows = [];
obsidian.Setting = class {
  constructor() { this.name = ""; this.desc = ""; builtRows.push(this); }
  setName(n) { this.name = n; return this; }
  setDesc(d) { this.desc = d; return this; }
  addToggle(cb) { const t = { setValue(v) { this._v = v; return this; }, onChange(c) { this._cb = c; return this; } }; this.toggles = (this.toggles || []).concat(t); cb(t); return this; }
  addText(cb) { const t = { setValue(v) { this._v = v; return this; }, onChange(c) { this._cb = c; return this; } }; this.texts = (this.texts || []).concat(t); cb(t); return this; }
  addDropdown(cb) {
    const d = {
      options: null, _v: undefined,
      addOptions(o) { d.options = o; return d; },
      setValue(v) { d._v = v; return d; },
      onChange(c) { d._cb = c; return d; },
    };
    this.dropdowns = (this.dropdowns || []).concat(d); cb(d); return this;
  }
  addButton(cb) { const b = { setButtonText() { return b; }, setCta() { return b; }, onClick() {} }; cb(b); return b; }
  addExtraButton() { return this; }
  setWarning() { return this; }
};

const LRI = "\u2066", PDI = "\u2069";
const instrument = fs.readFileSync(require("./paths.cjs").src, "utf8")
  + "\n;module.exports.__Et=Et;module.exports.__Q=Q;module.exports.__W=W;module.exports.__Vt=Vt;module.exports.__Nt=Nt;"
  + "module.exports.__Wt=Wt;module.exports.__wt=wt;module.exports.__itemHint=itemHint;module.exports.__K=K;module.exports.__dt=dt;"
  + "try{module.exports.__ScRefresh=ScRefresh;}catch(e){module.exports.__ScRefresh=null;}"
  + "try{module.exports.__effectiveDir=effectiveDir;}catch(e){module.exports.__effectiveDir=null;}\n"
  + "module.exports.__Mt=Mt;\n";
fs.writeFileSync(T + "direction-instr.cjs", instrument);
for (const k of Object.keys(require.cache)) if (k.endsWith("direction-instr.cjs")) delete require.cache[k];
const M = require(T + "direction-instr.cjs");
const { __Et: Et, __Q: Q, __W: W, __Vt: Vt, __Nt: Nt, __Wt: Wt, __wt: wt, __itemHint: itemHint, __K: K, __dt: PluginClass, __ScRefresh: ScRefresh, __effectiveDir: effectiveDir } = M;

let pass = 0, fail = 0; const bad = [];
const ok = (n, c, d) => { if (c) pass++; else { fail++; bad.push([n, d]); } };
const head = (t) => console.log("\n### " + t);

const OPTS = { revealSecrets: false, defaultDirection: "auto", animations: true, showEditingControls: true, showDragHandles: true, responsive: true, snapGuides: true };
const block = (inner) => "```structured-field\n" + inner + "\n```";
const clone = (o) => JSON.parse(JSON.stringify(o));
const q = (el, sel) => el.querySelector(sel);

function render(inner, opts = {}) {
  const root = document.getElementById("root");
  root.innerHTML = "";
  const el = root.createDiv({ cls: "placeholder" });
  const field = Q(block(inner));
  const saved = [];
  Et(el, field, { ...OPTS, ...opts }, {
    save: (f, kind) => saved.push({ kind, text: W(f) }),
    settings: () => {}, duplicate: () => {}, delete: () => {},
    beginDrag: () => {}, layout: () => {}, history: () => {},
  });
  return { el, field, saved };
}

head("1. plugin-owned hints are LTR islands");
ok("the text item hint is bidi-armed", itemHint("text", "value") === LRI + "Type here\u2026" + PDI, JSON.stringify(itemHint("text", "value")));
{
  let armed = 0, unarmed = 0;
  for (const kind of ["title", "title-text", "text", "bullet", "numbered", "multiline", "url", "secret"]) {
    for (const slot of ["title", "value"]) {
      const h = itemHint(kind, slot);
      if (!h) continue;
      if (h.startsWith(LRI) && h.endsWith(PDI)) armed++; else unarmed++;
    }
  }
  ok("every non-empty slot is armed", armed >= 8 && unarmed === 0, "armed=" + armed + " unarmed=" + unarmed);
}
{
  const { el } = render("id: t1\nlabel: \u0646\u0627\u0645\ntype: text\nplaceholder: \u0646\u0627\u0645 \u0631\u0627 \u0628\u0646\u0648\u06cc\u0633");
  const ta = q(el, "textarea.sc-field-value");
  ok("a USER placeholder is left alone", ta.placeholder === "\u0646\u0627\u0645 \u0631\u0627 \u0628\u0646\u0648\u06cc\u0633", JSON.stringify(ta.placeholder));
}
{
  const { el } = render("id: t2\nlabel: tags\ntype: tags");
  const ta = q(el, "textarea.sc-field-value");
  ok("the tags fallback hint is bidi-armed", ta.placeholder.startsWith(LRI) && ta.placeholder.endsWith(PDI) && /Comma separated/.test(ta.placeholder), JSON.stringify(ta.placeholder));
  // Whatever ends up in the note must be isolate-free: both a user placeholder
  // and the arming itself have to stay render-only.
  ok("the arming never reaches the note", !/[\u2066\u2069]/.test(W(Q(block("id: t2\nlabel: tags\ntype: tags\nplaceholder: \u0646\u0627\u0645")))), "serializer must never emit isolates");
}

head("2. typed scalar controls carry their own direction");
{
  const { el } = render("id: s1\nlabel: pass\ntype: secret\nvalue: \u0633\u0631\u06cc");
  const input = q(el, "input");
  ok("a secret input is RTL for Persian value", input.getAttribute("dir") === "rtl", "dir=" + input.getAttribute("dir"));
}
{
  const { el } = render("id: s2\nlabel: site\ntype: url\nvalue: https://x.com");
  const input = q(el, "input");
  ok("a url input is LTR", input.getAttribute("dir") === "ltr", "dir=" + input.getAttribute("dir"));
}
{
  const { el } = render("id: s3\nlabel: pick\ntype: select\noptions: a\ndirection: rtl");
  const sel = q(el, "select");
  ok("a select is RTL when the field says so", sel.getAttribute("dir") === "rtl", "dir=" + sel.getAttribute("dir"));
}
{
  const { el } = render("id: s4\nlabel: code\ntype: code\nvalue: \u06a9\u062f");
  const ta = q(el, "textarea.sc-field-value");
  ok("a code textarea is RTL for Persian", ta.getAttribute("dir") === "rtl", "dir=" + ta.getAttribute("dir"));
  ok("the control dir follows edits", (() => {
    ta.value = "\u062a\u0632\u06cc\u06cc\u0646";
    ta.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    return ta.getAttribute("dir") === "rtl";
  })(), "dir=" + ta.getAttribute("dir"));
}
{
  const { el } = render("id: s5\nlabel: digits\ntype: number\nvalue: 1234");
  const input = q(el, "input");
  ok("digits fall to the browser (dir=auto)", input.getAttribute("dir") === "auto", "dir=" + input.getAttribute("dir"));
}

head("3. auto detects the FIRST strong character anywhere");
ok("Persian text with a URL stays RTL", Vt("\u06cc\u0627\u062f\u062f\u0627\u0634\u062a \u0628\u0628\u06cc\u0646 https://x.com", "auto") === "rtl", JSON.stringify(Vt("\u06cc\u0627\u062f\u062f\u0627\u0634\u062a \u0628\u0628\u06cc\u0646 https://x.com", "auto")));
ok("latin first wins even with RTL later", Vt("delete my \u0633\u0627\u0645", "auto") === "ltr", JSON.stringify(Vt("delete my \u0633\u0627\u0645", "auto")));
ok("a bare URL stays LTR", Vt("https://x.com", "auto") === "ltr", JSON.stringify(Vt("https://x.com", "auto")));
ok("empty resolves to auto", Vt("", "auto") === "auto", JSON.stringify(Vt("", "auto")));
ok("digits resolve to auto", Vt("1234", "auto") === "auto", JSON.stringify(Vt("1234", "auto")));
ok("declared RTL wins", Vt("anything", "rtl") === "rtl", JSON.stringify(Vt("anything", "rtl")));
ok("declared LTR wins", Vt("\u0645\u062a\u0646", "ltr") === "ltr", JSON.stringify(Vt("\u0645\u062a\u0646", "ltr")));

head("4. the reuse shape catches structural edits");
{
  const f1 = Q(block("id: sh1\nlabel: n\ntype: text\nvalue: x"));
  const f2 = Q(block("id: sh1\nlabel: n\ntype: select\noptions: a\nvalue: x"));
  ok("a type change is a different shape", Nt(clone(f1)) !== Nt(clone(f2)), Nt(clone(f1)) + " vs " + Nt(clone(f2)));
  const f3 = Q(block("id: sh2\nlabel: n\ntype: text\nvalue: x"));
  const f4 = Q(block("id: sh2\nlabel: n\ntype: text\nvalue: x\ndirection: rtl"));
  ok("a direction change is a different shape", Nt(clone(f3)) !== Nt(clone(f4)), Nt(clone(f3)) + " vs " + Nt(clone(f4)));
  const f5 = Q(block("id: sh3\nlabel: n\ntype: text\nvalue: x"));
  const f6 = Q(block("id: sh3\nlabel: n\ntype: text\nvalue: x\nalign: center"));
  ok("an alignment change is a different shape", Nt(clone(f5)) !== Nt(clone(f6)), Nt(clone(f5)) + " vs " + Nt(clone(f6)));
}
{
  // Same shape, changed value: reuse must still work.
  const { el, field } = render("id: r1\nlabel: n\ntype: text\nvalue: hello");
  const fresh = Q(block("id: r1\nlabel: n\ntype: text\nvalue: hello changed"));
  const reused = Wt(el, clone(fresh), {});
  ok("a value-only change still reuses the DOM", reused === true && q(el, "textarea.sc-field-value").value === "hello changed", "reused=" + reused + " value=" + q(el, "textarea.sc-field-value")?.value);
}
{
  // A type change must NOT reuse the old control: that left a stale widget
  // after using the field menu to change the type.
  const { el } = render("id: r2\nlabel: n\ntype: text\nvalue: hello");
  const fresh = Q(block("id: r2\nlabel: n\ntype: select\noptions: [a]\nvalue: hello"));
  const reused = Wt(el, clone(fresh), {});
  ok("a type change refuses the resize-and-refresh path", reused === false, "reused=" + reused);
}

head("5. title alignment actually renders");
{
  const { el } = render("id: a1\nlabel: Title\ntype: text\nvalue: x\nalign: center");
  const wrap = q(el, ".sc-field-label-wrap");
  ok("center alignment reaches the title", wrap && wrap.style.textAlign === "center", "textAlign=" + (wrap && wrap.style.textAlign));
}
{
  const { el, field } = render("id: a2\nlabel: Title\ntype: text\nvalue: x");
  field.align = "end";
  wt(el, clone(field));
  const wrap = q(el, ".sc-field-label-wrap");
  ok("alignment re-applies on the reuse path", wrap && wrap.style.textAlign === "end", "textAlign=" + (wrap && wrap.style.textAlign));
}

head("6. the field menu hides rows that cannot apply");
{
  builtRows.length = 0;
  const draft = Q(block("id: m1\nlabel: Card\nitem: title\nitem: text"));
  const modal = new K(null, clone(draft), () => {});
  modal.open();
  const names = builtRows.map((r) => r.name);
  for (const dead of [
    "Type", "Placeholder", "Options (comma separated)", "Default value",
    "Validation pattern", "Required", "Mask secret", "Help text",
  ]) {
    ok("'" + dead + "' is hidden for an item-based field", !names.includes(dead), names.join(" | "));
  }
  for (const live of ["Text direction", "Prefix", "Suffix", "Title alignment"]) {
    ok("'" + live + "' stays for an item-based field", names.includes(live), names.join(" | "));
  }
}
{
  builtRows.length = 0;
  const draft = Q(block("id: m2\nlabel: n\ntype: select\noptions: [a,b]\nvalue: a"));
  const modal = new K(null, clone(draft), () => {});
  modal.open();
  const names = builtRows.map((r) => r.name);
  for (const live of [
    "Type", "Text direction", "Options (comma separated)", "Default value",
    "Placeholder", "Prefix", "Suffix", "Validation pattern",
    "Required", "Title alignment",
  ]) {
    ok("'scalar " + live + "' stays", names.includes(live), names.join(" | "));
  }
  ok("the scalar field has no 'Mask secret'", !names.includes("Mask secret"), names.join(" | "));
  ok("the scalar field has no 'Help text'", !names.includes("Help text"), names.join(" | "));
}

head("7. the plugin tab is honest");
{
  document.getElementById("c").innerHTML = "";
  const plugin = new PluginClass();
  plugin.settings = {
    templates: [], revealSecretsByDefault: false, defaultDirection: "auto",
    animations: true, showEditingControls: true, showDragHandles: true,
    responsive: true, snapGuides: true, debugLogging: false,
  };
  const Mt = M.__Mt;
  const tab = new Mt(null, plugin);
  tab.containerEl = document.getElementById("c");
  builtRows.length = 0;
  tab.display();
  const names = builtRows.map((r) => r.name);
  ok("the diagnostic-logging switch is not exposed", !names.includes("Diagnostic logging"), names.join(" | "));
  const drow = builtRows.find((r) => r.name === "Default text direction");
  ok("default direction says it is about new fields", !!drow && /new fields/i.test(drow.desc), drow && drow.desc);
  ok("default direction says it is the base for Auto fields", !!drow && /Auto/i.test(drow.desc), drow && drow.desc);
}

head("8. a settings change reaches the editor field");
if (!ScRefresh) {
  ok("the refresh effect exists", false, "ScRefresh is not defined in src/main.js yet");
  ok("the editor rebuilds on the effect", false, "ScRefresh is not defined in src/main.js yet");
  ok("the dispatch carries the effect", false, "ScRefresh is not defined in src/main.js yet");
} else {
{
  const plugin = new PluginClass();
  plugin.buildDecorations = () => "REBUILT";
  const ext = plugin.editorExtension();
  const spec = ext.map((x) => x?.spec || x?.v?.spec).find((s) => s && s.update);
  ok("the decoration field is reachable", !!spec && typeof spec.update === "function", String(!!spec));
  ok("an unrelated update keeps the previous value", spec.update("OLD", { docChanged: false, effects: [] }) === "OLD", String(spec.update("OLD", { docChanged: false, effects: [] })));
  ok("the refresh effect forces a rebuild", spec.update("OLD", { docChanged: false, effects: [ScRefresh.of(null)] }) === "REBUILT", String(spec.update("OLD", { docChanged: false, effects: [ScRefresh.of(null)] })));
}
{
  let rerendered = [];
  const dispatched = [];
  const plugin = new PluginClass();
  plugin.settings = { templates: [] };
  plugin.app = {
    workspace: {
      getLeavesOfType: () => [{
        view: {
          file: { path: "n.md" },
          previewMode: { rerender: (f) => rerendered.push(f) },
          editor: { cm: { dispatch: (tr) => dispatched.push(tr) } },
        },
      }],
    },
  };
  plugin.refreshRenderedCards();
  ok("the reading view is re-rendered", rerendered.length === 1 && rerendered[0] === true, JSON.stringify(rerendered));
  ok("the editor gets the refresh effect", dispatched.some((tr) => (tr.effects || []).some((e) => e instanceof ScRefresh)), JSON.stringify(dispatched));
}
}

head("9. the settings default direction is a base, not a seed");
if (!effectiveDir) {
  ok("the resolution helper exists", false, "effectiveDir is not defined in src/main.js yet");
  ok("the tab's RTL forces Auto fields", false, "effectiveDir not implemented");
  ok("a declared RTL field keeps it", false, "effectiveDir not implemented");
  ok("a declared LTR field keeps it", false, "effectiveDir not implemented");
  ok("Auto tab still follows content", false, "effectiveDir not implemented");
  ok("Auto tab leaves neutral content auto", false, "effectiveDir not implemented");
  ok("a scalar Auto field shows RTL under the tab's RTL", false, "effectiveDir not implemented");
  ok("an item card shows RTL under the tab's RTL", false, "effectiveDir not implemented");
  ok("its label follows the base too", false, "effectiveDir not implemented");
  ok("a declared LTR field refuses the base", false, "effectiveDir not implemented");
  ok("the same field flips when the tab flips", false, "effectiveDir not implemented");
  ok("the field menu explains the tab interplay", false, "effectiveDir not implemented");
} else {
  ok("the tab's RTL forces an Auto field", effectiveDir("", "auto", { defaultDirection: "rtl" }) === "rtl", JSON.stringify(effectiveDir("", "auto", { defaultDirection: "rtl" })));
  ok("a declared RTL field keeps it", effectiveDir("hello", "rtl", { defaultDirection: "ltr" }) === "rtl", JSON.stringify(effectiveDir("hello", "rtl", { defaultDirection: "ltr" })));
  ok("a declared LTR field keeps it", effectiveDir("\u0633\u0644\u0627\u0645", "ltr", { defaultDirection: "rtl" }) === "ltr", JSON.stringify(effectiveDir("\u0633\u0644\u0627\u0645", "ltr", { defaultDirection: "rtl" })));
  ok("an Auto tab still follows content", effectiveDir("\u0633\u0644\u0627\u0645", "auto", { defaultDirection: "auto" }) === "rtl", JSON.stringify(effectiveDir("\u0633\u0644\u0627\u0645", "auto", { defaultDirection: "auto" })));
  ok("an Auto tab leaves neutral content auto", effectiveDir("", "auto", { defaultDirection: "auto" }) === "auto", JSON.stringify(effectiveDir("", "auto", { defaultDirection: "auto" })));
  {
    const { el } = render("id: g1\nlabel: \u067e\u06cc\u0646\ntype: text", { defaultDirection: "rtl" });
    const wrap = q(el, ".sc-field-value-wrap");
    ok("a scalar Auto field shows RTL under the tab's RTL", wrap && wrap.getAttribute("dir") === "rtl", "dir=" + (wrap && wrap.getAttribute("dir")));
  }
  {
    const { el } = render("id: g2\nlabel: \u06a9\u0627\u0631\u062f\ntype: text\nitem: title\nitem: text", { defaultDirection: "rtl" });
    const item = q(el, ".sc-item-value-wrap");
    ok("an item card shows RTL under the tab's RTL", item && item.getAttribute("dir") === "rtl", "dir=" + (item && item.getAttribute("dir")));
    const label = q(el, ".sc-field-label-wrap");
    ok("its label follows the base too", label && label.getAttribute("dir") === "rtl", "dir=" + (label && label.getAttribute("dir")));
  }
  {
    const { el } = render("id: g3\nlabel: doc\ntype: text\ndirection: ltr", { defaultDirection: "rtl" });
    const wrap = q(el, ".sc-field-value-wrap");
    ok("a declared LTR field refuses the base", wrap && wrap.getAttribute("dir") === "ltr", "dir=" + (wrap && wrap.getAttribute("dir")));
  }
  {
    // The switch itself: the same source must render differently when the tab
    // flips, which is exactly what "the button does nothing" was missing.
    const src = "id: g4\nlabel: n\ntype: text\nvalue: hello";
    const a = render(src, { defaultDirection: "rtl" });
    const b = render(src, { defaultDirection: "auto" });
    const da = q(a.el, ".sc-field-value-wrap").getAttribute("dir");
    const db = q(b.el, ".sc-field-value-wrap").getAttribute("dir");
    ok("the same field flips when the tab flips", da === "rtl" && db === "ltr", "rtl-tab=" + da + " auto-tab=" + db);
  }
  {
    builtRows.length = 0;
    const draft = Q(block("id: k1\nlabel: n\ntype: text"));
    const modal = new K(null, clone(draft), () => {});
    modal.open();
    const row = builtRows.find((r) => r.name === "Text direction");
    ok("the field menu explains the tab interplay", !!row && /Auto/i.test(row.desc) && /tab|settings|Default/i.test(row.desc), row && row.desc);
  }
}

head("10. the refresh cannot depend on opaque editor hops");
{
  const plugin = new PluginClass();
  plugin.settings = { templates: [] };
  ok("the plugin tracks live editor views", plugin.editorViews instanceof Set, String(plugin.editorViews));
  const ext = plugin.editorExtension();
  const fromClass = ext && ext.find && ext.find((x) => x && typeof x.c === "function");
  ok("the view plugin is reachable", !!fromClass && typeof fromClass.c === "function", String(!!fromClass));
  if (fromClass && typeof fromClass.c === "function") {
    const mock = { state: { doc: { toString: () => "" }, selection: { main: { head: 0 } } } };
    if (plugin.editorViews instanceof Set) {
      const inst = new fromClass.c(mock);
      ok("a live editor is registered automatically", plugin.editorViews.has(mock), String(plugin.editorViews.size));
      inst.destroy();
      ok("a closed editor is unregistered", !plugin.editorViews.has(mock), String(plugin.editorViews.size));
    } else {
      ok("a live editor is registered automatically", false, "plugin.editorViews is not a Set");
      ok("a closed editor is unregistered", false, "plugin.editorViews is not a Set");
    }
  }
}
{
  let dispatched = [];
  const plugin = new PluginClass();
  plugin.settings = { templates: [] };
  plugin.editorViews = new Set([{ dispatch: (tr) => dispatched.push(tr) }]);
  plugin.app = {
    workspace: {
      getLeavesOfType: () => [{
        view: {
          file: { path: "n.md" },
          previewMode: { rerender: () => {} },
        },
      }],
    },
  };
  plugin.refreshRenderedCards();
  ok("the refresh reaches the editor even without editor.cm", dispatched.some((tr) => (tr.effects || []).some((e) => e instanceof ScRefresh)), JSON.stringify(dispatched));
}

head("11. the directions survive foreign per-element direction rules");
{
  const css = fs.readFileSync(require("./paths.cjs").css, "utf8");
  ok("sc-dir-rtl and sc-dir-ltr carry !important", /structured-cards-root \.sc-dir-rtl\s*\{[^}]*!important/.test(css) && /structured-cards-root \.sc-dir-ltr\s*\{[^}]*!important/.test(css), "css missing the sc-dir defense rules");
  ok("sc-dir-auto resolves neutral as ltr", /structured-cards-root \.sc-dir-auto\s*\{[^}]*direction:\s*ltr/.test(css), "css missing the auto-class rule");
  ok("structural divs stay geometry-LTR", /structured-cards-root\.sc-standalone-field div\s*\{[^}]*direction:\s*ltr/.test(css), "css missing the structural-div rule");
  ok("the mirror follows its wrap", /structured-cards-root \.sc-text-wrap\s*>\s*\.sc-text-mirror\s*\{[^}]*direction:\s*inherit/.test(css), "css missing the mirror inherit rule");
  ok("plugin hints keep their own line placement", /sc-hint-ltr\s*>\s*textarea::placeholder\s*\{[^}]*direction:\s*ltr/.test(css), "css missing the placeholder rule");
}
{
  const { el } = render("id: w1\nlabel: \u067e\u06cc\u0646\nvalue: hello\ndirection: rtl");
  const wrap = q(el, ".sc-field-value-wrap");
  ok("an RTL wrap records sc-dir-rtl", wrap && wrap.classList.contains("sc-dir-rtl"), wrap && [...wrap.classList].join(" "));
  ok("the dir attribute stays as the machine-readable form", wrap && wrap.getAttribute("dir") === "rtl", wrap && wrap.getAttribute("dir"));
}
{
  const { el } = render("id: w2\nlabel: doc\nvalue: hello\ndirection: ltr");
  const wrap = q(el, ".sc-field-value-wrap");
  ok("an LTR wrap records sc-dir-ltr", wrap && wrap.classList.contains("sc-dir-ltr"), wrap && [...wrap.classList].join(" "));
  ok("no other direction class lingers", wrap && ["sc-dir-rtl", "sc-dir-auto"].every((c) => !wrap.classList.contains(c)), wrap && [...wrap.classList].join(" "));
}
{
  const { el } = render("id: w3\nlabel: digits\nvalue: 1234");
  const wrap = q(el, ".sc-field-value-wrap");
  ok("a neutral value records sc-dir-auto", wrap && wrap.classList.contains("sc-dir-auto"), wrap && [...wrap.classList].join(" "));
}
{
  const { el } = render("id: w4\nlabel: n\nvalue: hello");
  const ta = q(el, "textarea.sc-field-value");
  const wrap = q(el, ".sc-field-value-wrap");
  ta.value = "\u062a\u0632\u06cc\u06cc\u0646";
  ta.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  ok("typing Persian re-records the class", wrap && wrap.classList.contains("sc-dir-rtl"), wrap && [...wrap.classList].join(" "));
}
{
  const { el } = render("id: w5\nlabel: tags\ntype: tags");
  const wrap = q(el, ".sc-field-value-wrap");
  ok("an armored plugin hint marks the wrap sc-hint-ltr", wrap && wrap.classList.contains("sc-hint-ltr"), wrap && [...wrap.classList].join(" "));
  const ta = q(el, "textarea.sc-field-value");
  ta.value = "scroll";
  ta.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  ok("a typed value clears the hint marker", wrap && !wrap.classList.contains("sc-hint-ltr"), wrap && [...wrap.classList].join(" "));
}
{
  const { el } = render("id: w6\nlabel: \u0646\u0627\u0645\nplaceholder: \u062e\u0648\u062f\u062a \u0628\u0646\u0648\u06cc\u0633");
  const wrap = q(el, ".sc-field-value-wrap");
  ok("a user's own placeholder is never hinted-LTR", wrap && !wrap.classList.contains("sc-hint-ltr"), wrap && [...wrap.classList].join(" "));
}

head("12. title alignment covers the boxes the user actually reads");
{
  const { el } = render("id: ta1\nlabel: \u06a9\u0627\u0631\u062a\nitem: title\nitem: text\nalign: center");
  const tw = q(el, ".sc-item-standalone-title-wrap");
  ok("a standalone title item follows the card's alignment", tw && tw.style.textAlign === "center", "textAlign=" + (tw && tw.style.textAlign));
  const vw = q(el, ".sc-item-value-wrap");
  ok("a value item keeps its own alignment", vw && vw.style.textAlign === "", "textAlign=" + (vw && vw.style.textAlign));
}
{
  const { el } = render("id: ta2\nlabel: mixed\nitem: title-text\nalign: center");
  const w = q(el, ".sc-item-title-text-wrapper .sc-item-title-wrap");
  ok("a title-text row's title follows alignment", w && w.style.textAlign === "center", "textAlign=" + (w && w.style.textAlign));
  const v = q(el, ".sc-item-title-text-wrapper .sc-item-value-wrap");
  ok("a title-text row's text value keeps its own alignment", v && v.style.textAlign === "", "textAlign=" + (v && v.style.textAlign));
}
{
  const { el } = render("id: ta3\nlabel: \u06a9\u0627\u0631\u062a\nitem: title\nalign: start");
  const tw = q(el, ".sc-item-standalone-title-wrap");
  ok("start clears the title box back to the stylesheet", tw && tw.style.textAlign === "", "textAlign=" + (tw && tw.style.textAlign));
}
{
  // The field menu changes align while the card stays on screen: the reuse
  // path must re-apply it to the item titles too.
  const { el, field } = render("id: ta4\nlabel: \u06a9\u0627\u0631\u062a\nitem: title\nitem: text");
  field.align = "center";
  wt(el, clone(field));
  const tw = q(el, ".sc-item-standalone-title-wrap");
  ok("an alignment save re-applies on the reuse path", tw && tw.style.textAlign === "center", "textAlign=" + (tw && tw.style.textAlign));
}

head("13. the Help text row is gone; old notes keep their help");
{
  builtRows.length = 0;
  const draft = Q(block("id: hb1\nlabel: n\nitem: title"));
  const modal = new K(null, clone(draft), () => {});
  modal.open();
  const names = builtRows.map((r) => r.name);
  ok("'Help text' is gone from the field menu (item card)", !names.includes("Help text"), names.join(" | "));
}
{
  builtRows.length = 0;
  const draft = Q(block("id: hb2\nlabel: n\ntype: text"));
  const modal = new K(null, clone(draft), () => {});
  modal.open();
  const names = builtRows.map((r) => r.name);
  ok("'Help text' is gone from the field menu (scalar)", !names.includes("Help text"), names.join(" | "));
}
{
  const { el } = render("id: hb3\nlabel: n\ntype: text\nhelp: Old note text\nvalue: x");
  ok("an existing help text still renders for old notes", !!q(el, ".sc-field-help"), "help node missing");
}

console.log("\n================ DIRECTION ================");
console.log("pass:", pass, " fail:", fail);
for (const [n, d] of bad) console.log("  FAIL " + n + (d === undefined ? "" : "  [" + d + "]"));
process.exit(fail ? 1 : 0);
