"use strict";
// Review pass 2: the paths that decide whether an edit actually persists --
// the CodeMirror updateDOM reuse logic, the Backspace/Delete keymap, the
// minimal-span doc edit, and settings loading/migration.
const fs = require("fs");
const T = require("./paths.cjs").T;
const { JSDOM } = require("jsdom");
const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document;
Object.defineProperty(global, "navigator", { value: dom.window.navigator, configurable: true, writable: true });
global.HTMLElement = dom.window.HTMLElement; global.HTMLInputElement = dom.window.HTMLInputElement;
global.Element = dom.window.Element; global.Node = dom.window.Node; global.Event = dom.window.Event;
global.MouseEvent = dom.window.MouseEvent;
global.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
global.requestAnimationFrame = f => setTimeout(() => f(Date.now()), 0);
global.cancelAnimationFrame = clearTimeout;
global.AbortController = dom.window.AbortController; global.AbortSignal = dom.window.AbortSignal;
// Give elements a size so Ee()/Ce()/getBoundingClientRect are meaningful.
dom.window.Element.prototype.getBoundingClientRect = function () {
  const w = this.__w ?? 320, h = this.__h ?? 80;
  return { width: w, height: h, top: 0, left: 0, right: w, bottom: h, x: 0, y: 0, toJSON() {} };
};
Object.defineProperty(dom.window.Element.prototype, "__w", { value: 320, writable: true, configurable: true });
Object.defineProperty(dom.window.Element.prototype, "__h", { value: 80, writable: true, configurable: true });

const helpers = {
  createEl(tag, o = {}) { const e = this.ownerDocument.createElement(tag);
    if (o.text !== undefined) e.textContent = o.text;
    if (o.cls) e.className = o.cls;
    if (o.attr) for (const k in o.attr) e.setAttribute(k, o.attr[k]);
    if (o.type) e.type = o.type;
    if (o.value !== undefined) e.value = o.value;
    this.appendChild(e); return e; },
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
};
for (const [k, fn] of Object.entries(helpers)) {
  Object.defineProperty(dom.window.HTMLElement.prototype, k, { value: fn, writable: true, configurable: true });
  Object.defineProperty(dom.window.Element.prototype, k, { value: fn, writable: true, configurable: true });
}
const obsidian = require("./obsidian-stub.cjs");
const notices = [];
obsidian.Notice = class { constructor(m) { notices.push(m); } };
obsidian.setIcon = (el, name) => el.setAttribute("data-icon", name);
obsidian.Menu = class { addItem(cb) { const it = { setTitle: t => { it.t = t; return it; }, setIcon() { return it; }, onClick(f) { it.f = f; return it; } }; cb(it); return it; } addSeparator() {} showAtMouseEvent() {} showAtPosition() {} };
global.navigator.clipboard = { writeText: async () => {} };

const src = fs.readFileSync(require("./paths.cjs").src, "utf8")
  + "\n;var __origEt=Et;Et=function(el,f,o,a){globalThis.__live=f;return __origEt(el,f,o,a);};\n"
  + ";module.exports.__Et=Et;module.exports.__Nt=Nt;module.exports.__Wt=Wt;module.exports.__Q=Q;module.exports.__W=W;module.exports.__R=R;module.exports.__Plugin=dt;module.exports.__Pe=Pe;\n";
fs.writeFileSync(T + "rev2.cjs", src);
for (const k of Object.keys(require.cache)) if (k.endsWith("rev2.cjs")) delete require.cache[k];
const M = require(T + "rev2.cjs");
const { __Et: Et, __Nt: Nt, __Wt: Wt, __Q: Q, __W: W, __R: R, __Plugin: Plugin, __Pe: Pe } = M;

let pass = 0, fail = 0; const bad = [];
const ok = (n, c, d) => { if (c) pass++; else { fail++; bad.push([n, d]); } };
const head = t => console.log("\n### " + t);
const J = (...l) => l.join("\n");
const OPTS = { revealSecrets: false, defaultDirection: "auto",
  animations: true, showEditingControls: true, showDragHandles: true, responsive: true, snapGuides: true };

head("updateDOM reuse (Wt): edits must survive a re-render");
{
  const inner = "id: u1\nlabel: Name\ntype: text\nvalue: v";
  const block = "```structured-field\n" + inner + "\n```";
  const root = document.getElementById("root");
  root.innerHTML = "";
  const el = root.createDiv({ cls: "host" });
  const saved = [];
  const actions = { save: (f) => saved.push(W(f)), settings(){}, duplicate(){}, delete(){}, beginDrag(){}, layout(){}, history(){} };
  Et(el, Q(block), OPTS, actions);

  const ta = () => el.querySelector("textarea.sc-field-value");
  ok("rendered", !!ta());
  // Wt() copies onto the object Et() closed over, so that is the live one.
  const live = globalThis.__live;

  // 1. same shape + same id -> reuse, and the edit is visible after refresh
  let reused = Wt(el, Q(block), actions);
  ok("same field reuses the DOM", reused === true);
  ok("value still rendered", ta().value === "v", ta().value);

  // 2. a changed value refreshes the visible control
  reused = Wt(el, { ...Q(block), value: "changed" }, actions);
  ok("changed value refreshes the DOM", ta().value === "changed", ta().value);

  // 3. typing after that refresh still mutates the live field object
  ta().value = "typed";
  ta().dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  ok("typing updates the live field", live.value === "typed", live.value);

  // 4. different id -> must NOT reuse (forces a rebuild)
  const other = { ...Q(block), id: "different" };
  ok("a different field id refuses reuse", Wt(el, other, actions) === false);

  // 5. same id but a different item shape -> must NOT reuse
  const reshaped = { ...Q("```structured-field\nid: u1\nlabel: Name\ntype: text\nitems: []\n```") };
  ok("a different item shape refuses reuse", Wt(el, reshaped, actions) === false);

  // 6. hideLabel toggled -> different shape
  ok("hideLabel is part of the shape key",
     Nt({ ...Q(block), hideLabel: true }) !== Nt({ ...Q(block), hideLabel: false }));
}

head("item edits survive a reuse cycle (identity preservation)");
{
  const block = J("```structured-field", "id: i1", "label: L", "type: text",
    "item: title|T", "item: text|one", "item: text|two", "```");
  const root = document.getElementById("root");
  root.innerHTML = "";
  const el = root.createDiv({ cls: "host" });
  const saved = [];
  const actions = { save: (f) => saved.push(W(f)), settings(){}, duplicate(){}, delete(){}, beginDrag(){}, layout(){}, history(){} };
  Et(el, Q(block), OPTS, actions);
  const vals = () => [...el.querySelectorAll("textarea.sc-item-value")].map(t => t.value);
  ok("two item textareas", vals().length === 2, JSON.stringify(vals()));
  ok("item values", vals().join(",") === "one,two", JSON.stringify(vals()));

  // Simulate CodeMirror handing back a freshly parsed field (new object identity).
  const liveItems = globalThis.__live;
  const originalArray = liveItems.items;
  const originalItem2 = liveItems.items[2];
  const reparsed = Q(block);
  ok("reuse accepted for identical shape", Wt(el, reparsed, actions) === true);
  // Identity must survive: the closures inside the textareas hold the ORIGINAL
  // item objects, so Wt() has to keep the array and copy values onto those.
  ok("the original item array is kept", liveItems.items === originalArray);
  ok("the original item objects are kept", liveItems.items[2] === originalItem2);
  ok("the carrier array is not adopted", liveItems.items !== reparsed.items);
  ok("values copied onto the originals",
     liveItems.items.every((x, i) => x.value === reparsed.items[i].value && x.kind === reparsed.items[i].kind),
     JSON.stringify([liveItems.items.map(x => x.value), reparsed.items.map(x => x.value)]));
  // A `title` item renders as sc-item-title, so the sc-item-value textareas are
  // items 1 and 2.
  const values = el.querySelectorAll("textarea.sc-item-value");
  values[1].value = "edited";
  values[1].dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  ok("edit lands in the live field", liveItems.items[2].value === "edited",
     JSON.stringify(liveItems.items.map(x => x.value)));
  ok("field value mirrors the items", liveItems.value.includes("edited"), JSON.stringify(liveItems.value));
}

head("Backspace / Delete keymap");
{
  const block = J("```structured-field", "id: k1", "label: L", "type: text", "value: v", "```");
  const doc = "before\n\n" + block + "\n\nafter";
  const f = R(doc)[0];
  ok("field located", !!f, JSON.stringify(f));
  // The plugin's pick(): strict-inside wins, then the boundary match.
  const pick = (fields, head, edge) =>
    fields.find(x => head > x.from && head < x.to) ||
    fields.find(x => (edge === "end" ? x.to : x.from) === head);
  const one = R(doc);
  ok("at the end: Backspace selects the field", pick(one, f.to, "end")?.field.id === "k1");
  ok("at the start: Delete selects the field", pick(one, f.from, "start")?.field.id === "k1");
  ok("strictly inside: Backspace finds the field", pick(one, f.from + 5, "end")?.field.id === "k1");
  ok("strictly inside: Delete finds the field", pick(one, f.from + 5, "start")?.field.id === "k1");
  ok("far outside: nothing is captured", pick(one, 2, "end") === undefined);
  ok("in the tail: nothing is captured", pick(one, doc.length - 2, "end") === undefined);
  const noBlocks = pick(R("just prose, no blocks"), 5, "end");
  ok("a note with no blocks captures nothing", noBlocks === undefined);
}

head("applyDocEdit only touches the changed span");
{
  const p = new Plugin({ workspace: {} }, { version: "t" });
  p._doc = "";
  const dispatched = [];
  const view = { state: { doc: { toString: () => p._doc, length: p._doc.length } }, dispatch: (d) => dispatched.push(d) };
  p._doc = "aaa\nbbb\nccc";
  p.applyDocEdit(view, "aaa\nbbb\nccc");
  ok("identical text dispatches nothing", dispatched.length === 0);
  p._doc = "aaa\nbbb\nccc";
  p.applyDocEdit(view, "aaa\nbbb\nXXX");
  const d = dispatched[0];
  ok("minimal span used", d && d.changes.from === 8 && d.changes.to === 11, JSON.stringify(d && d.changes));
  ok("only the tail inserted", d && d.changes.insert === "XXX");
  ok("userEvent preserved", d && d.userEvent === "input.move");
  p._doc = "aaa\nbbb\nccc";
  p.applyDocEdit(view, "XXX\nbbb\nccc");
  ok("minimal span for a head edit", dispatched[1].changes.from === 0 && dispatched[1].changes.to === 3,
     JSON.stringify(dispatched[1].changes));
  p._doc = "aaa\nbbb\nccc";
  p.applyDocEdit(view, "XXX");
  ok("wholesale replace still works",
     dispatched[2].changes.from === 0 && dispatched[2].changes.to === 11 && dispatched[2].changes.insert === "XXX",
     JSON.stringify(dispatched[2].changes));
}

head("Pe() delete ranges on LF and CRLF");
{
  const lf = "a\n\n" + J("```structured-field", "id: p", "label: L", "type: text", "value: v", "```") + "\n\nb";
  const crlf = lf.replace(/\n/g, "\r\n");
  const a = Pe(lf, 3, 3 + lf.split("\n")[2].length + 8);
  ok("LF range sane", a.to > a.from && a.to <= lf.length, JSON.stringify(a));
  const b = Pe(crlf, 3, 3 + crlf.split("\n")[2].length + 9);
  ok("CRLF range consumes 2 bytes per break", b.to - b.from > (a.to - a.from), JSON.stringify([a, b]));
}

head("loadSettings migrates and prunes");
{
  const p = new Plugin({ workspace: {} }, { version: "t" });
  let written = null;
  p.loadData = async () => ({
    defaultLayout: "auto", defaultSize: "medium",
    defaultDensity: "comfortable", defaultGap: 10,
    templates: [{ id: "builtin-api-provider", name: "API Provider", source: "x" },
                { id: "keep", name: "Keep", source: "y" }],
    templatesGarbage: 1,
  });
  p.saveData = async (d) => { written = d; };
  (async () => {
    await p.loadSettings();
    // The copy button was removed, so its setting is pruned like any other dead key.
    ok("removed copy settings are pruned", !("showCopyButtons" in p.settings) && !("copyNotice" in p.settings),
    Object.keys(p.settings).join());
    ok("dropped keys removed", !("defaultLayout" in p.settings) && !("defaultGap" in p.settings),
       Object.keys(p.settings).join());
    ok("builtin API template filtered out", !p.settings.templates.some(t => t.id === "builtin-api-provider"),
       JSON.stringify(p.settings.templates));
    ok("user template kept", p.settings.templates.some(t => t.id === "keep"));
    ok("settings rewritten once", !!written);
    ok("written data has no dropped keys", written && !("defaultLayout" in written));

    // second run must be a no-op (no rewrite)
    const p2 = new Plugin({ workspace: {} }, { version: "t" });
    p2.loadData = async () => JSON.parse(JSON.stringify(written));
    let rewrites = 0;
    p2.saveData = async () => { rewrites++; };
    await p2.loadSettings();
    ok("second load is idempotent", rewrites === 0, "rewrites=" + rewrites);
    ok("new defaults present", p2.settings.debugLogging === false && p2.settings.showEditingControls === true);
  })();
}

setTimeout(() => {
  console.log("\n================ REVIEW 2 ================");
  console.log("pass:", pass, " fail:", fail);
  for (const [n, d] of bad) console.log("  FAIL " + n + (d === undefined ? "" : "  [" + d + "]"));
}, 50);