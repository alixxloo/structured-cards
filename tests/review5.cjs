"use strict";
// Review 5: adversarial pass over MY OWN changes. Targets paths the earlier
// suites never exercised, and specifically things my edits could have broken.
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
dom.window.Element.prototype.getBoundingClientRect = () => ({ width: 320, height: 80, top: 0, left: 0, right: 320, bottom: 80, x: 0, y: 0, toJSON() {} });

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
let clip = null; const notices = [];
obsidian.Notice = class { constructor(m) { notices.push(m); } };
obsidian.setIcon = (el, name) => el.setAttribute("data-icon", name);
obsidian.Menu = class { addItem(cb) { const it = { setTitle: t => { it.t = t; return it; }, setIcon: () => it, onClick: f => { it.f = f; return it; } }; cb(it); return it; } addSeparator() {} showAtMouseEvent() {} showAtPosition() {} };
global.navigator.clipboard = { writeText: async t => { clip = t; } };

const src = fs.readFileSync(require("./paths.cjs").src, "utf8")
  + "\n;module.exports.__Et=Et;module.exports.__fvc=fieldValueControl;module.exports.__Q=Q;module.exports.__W=W;module.exports.__R=R;module.exports.__Plugin=dt;\n";
fs.writeFileSync(T + "rev5.cjs", src);
for (const k of Object.keys(require.cache)) if (k.endsWith("rev5.cjs")) delete require.cache[k];
const M = require(T + "rev5.cjs");
const { __Et: Et, __Q: Q, __W: W, __R: R, __Plugin: Plugin } = M;

let pass = 0, fail = 0; const bad = [];
const ok = (n, c, d) => { if (c) pass++; else { fail++; bad.push([n, d]); } };
const head = t => console.log("\n### " + t);
const J = (...l) => l.join("\n");
const OPTS = { revealSecrets: false, defaultDirection: "auto",
  animations: true, showEditingControls: true, showDragHandles: true, responsive: true, snapGuides: true };
const block = inner => "```structured-field\n" + inner + "\n```";

function render(inner, opts = {}) {
  const root = document.getElementById("root");
  root.innerHTML = "";
  const el = root.createDiv({ cls: "host" });
  const field = Q(block(inner));
  const saved = [];
  Et(el, field, { ...OPTS, ...opts }, { save: (f, k) => saved.push({ kind: k, text: W(f) }), settings(){}, duplicate(){}, delete(){}, beginDrag(){}, layout(){}, history(){} });
  return { el, field, saved };
}
const click = el => el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));

// The copy button was removed from the plugin, so the four COPY sections that
// used to live here are gone rather than commented out. nocopy.cjs asserts the
// feature is absent, which is what a commented-out block cannot do.

head("METADATA: custom keys must survive a save");
{
  const keys = ["my.key", "my-key", "my_key", "myKey", "my key", "x", "author.name", "priority-1"];
  for (const k of keys) {
    const f = Q(block("id: m\nlabel: L\ntype: text\n" + k + ": kept\nvalue: v"));
    const out = W(f);
    const again = Q(out);
    ok(`key "${k}" survives`, again.metadata && again.metadata[k] === "kept",
       "metadata=" + JSON.stringify(again.metadata) + " written=" + JSON.stringify(out));
  }
}

head("METADATA: keys that must be dropped to stay safe");
{
  for (const k of ["item", ""]) {
    const f = { id: "m", label: "L", type: "text", value: "v", metadata: { [k]: "x" } };
    const again = Q(W(f));
    const leaked = again.items && again.items.length;
    ok(`key ${JSON.stringify(k)} is not re-emitted as an item`, !leaked, JSON.stringify(W(f)));
  }
  // a value that could close the fence
  const f2 = { id: "m", label: "L", type: "text", value: "v", metadata: { note: "```js" } };
  const written = W(f2);
  const body = [];
  const lines = written.split("\n");
  for (let i = 1; i < lines.length - 1; i++) { if (/^ {0,3}```/.test(lines[i])) break; body.push(lines[i]); }
  ok("a fence-looking metadata value cannot truncate the block",
     Q("```structured-field\n" + body.join("\n") + "\n```") !== null, written);
}

head("ITEMS: deleting the last item then re-saving");
{
  const { field, saved } = render(J("id: d1", "label: L", "type: text", "item: text|x"));
  // Simulate the item menu's delete handler.
  field.items.splice(0, 1);
  const out = W(field);
  console.log("  after deleting the only item:\n" + out);
  const again = Q(out);
  ok("items: [] written", out.includes("items: []"), out);
  ok("no stale value left behind", !/value: \S/.test(out), out);
  ok("re-parses with no items", again.items && again.items.length === 0, JSON.stringify(again.items));
  void saved;
}

head("ITEMS: title-text wrapper survives a re-render and keeps order");
{
  const { el } = render(J("id: t1", "label: L", "type: text", "item: title-text|The title|The value"));
  const w = el.querySelector(".sc-item-title-text-wrapper");
  ok("wrapper exists", !!w);
  ok("two children in title-then-value order",
     w && w.children.length === 2 && w.children[0].className.includes("sc-item-title")
        && w.children[1].className.includes("sc-item-value"),
     w && [...w.children].map(c => c.className).join(" | "));
  ok("title text", w && w.querySelector(".sc-item-title")?.value === "The title");
  ok("value text", w && w.querySelector(".sc-item-value")?.value === "The value");
}

head("SCALAR vs ITEMS: every declared type renders and reports its value");
{
  const types = ["text", "multiline", "url", "number", "select", "tags", "code", "secret"];
  for (const ty of types) {
    // Values are type-appropriate: a number field gets a number, a select gets
    // one of its options. Non-representable values are checked separately below.
    const good = { text: "hello", multiline: "hello", url: "https://x.dev", number: "42",
      select: "B", tags: "a, b", code: "x = 1", secret: "s3cret" }[ty];
    const extra = ty === "select" ? "\noptions: A, B, C" : "";
    const { el, field } = render("id: t\nlabel: L\ntype: " + ty + "\nvalue: " + good + extra);
    const control = el.querySelector("textarea.sc-field-value, input.sc-input, select.sc-input, textarea.sc-item-multiline, textarea.sc-code");
    ok(`type ${ty} renders a control`, !!control);
    ok(`type ${ty} shows the stored value`, control && control.value === good,
       control && JSON.stringify(control.value));
    if (control) {
      // The replacement must itself be valid for the control, or the browser
      // refuses it and we would be testing the browser, not the plugin.
      const edited = ty === "number" ? "7" : ty === "select" ? "C" : "changed";
      control.value = edited;
      ok(`type ${ty} accepts its own replacement`, control.value === edited,
         `${JSON.stringify(edited)} -> ${JSON.stringify(control.value)}`);
      control.dispatchEvent(new dom.window.Event(
        control.tagName === "SELECT" || ["number","url","password","text"].includes(control.type) ? "change" : "input",
        { bubbles: true }));
      ok(`type ${ty} writes the change back`, field.value === edited,
         `${JSON.stringify(field.value)}`);
    }
  }
}

head("SCALAR: a value the typed control cannot represent must still be visible");
{
  const n = render("id: n1\nlabel: N\ntype: number\nvalue: hello").el;
  const shown = n.querySelector("textarea.sc-field-value, input.sc-input");
  console.log("  number control tag: " + (shown && shown.tagName) + " value: " + JSON.stringify(shown && shown.value));
  ok("non-numeric number falls back to a visible control", shown && shown.value === "hello",
     JSON.stringify(shown && shown.value));
  const s = render("id: s1\nlabel: S\ntype: select\noptions: A, B, C\nvalue: Z").el;
  const sel = s.querySelector("select.sc-input");
  ok("an option list gains the stored value", sel && sel.value === "Z",
     sel && JSON.stringify([...sel.options].map(o => o.value)));
  ok("the original options are still there", sel && [...sel.options].map(o => o.value).join() === "Z,A,B,C",
     sel && [...sel.options].map(o => o.value).join());
  const u = render("id: u1\nlabel: U\ntype: url\nvalue: not a url").el.querySelector("input.sc-input");
  ok("url accepts arbitrary text", u && u.value === "not a url", JSON.stringify(u && u.value));
}

head("INVARIANT: fieldValueControl must return a usable handle for every type");
{
  const { __fvc: fvc } = M;
  for (const ty of ["text", "tags", "multiline", "code", "url", "number", "secret"]) {
    const extra = ty === "number" ? "5" : "hello";
    const box = document.createElement("div");
    const fld = Q(block("id: x\nlabel: L\ntype: " + ty + "\nvalue: " + extra));
    const h = fvc(box, fld, OPTS, () => {});
    ok(`${ty} returns a control`, !!h && !!(h.input || h.tagName), String(h));
    // The refresh hook is what Wt() uses to repaint after an updateDOM; losing
    // it leaves a stale value on screen.
    if (ty === "text" || ty === "tags")
      ok(`${ty} exposes a refresh hook`, !!(h && h.refresh), Object.keys(h || {}).join(","));
  }
  const sel = document.createElement("div");
  const sf = Q(block("id: x\nlabel: L\ntype: select\noptions: A, B\nvalue: A"));
  ok("select returns an element", !!fvc(sel, sf, OPTS, () => {})?.tagName);
  const num = document.createElement("div");
  const nf = Q(block("id: x\nlabel: N\ntype: number\nvalue: 5"));
  ok("number returns an element", fvc(num, nf, OPTS, () => {})?.tagName === "INPUT");
}

head("REQUIRED / VALIDATION reach the right control");
{
  const n = render("id: r1\nlabel: N\ntype: number\nvalue: 1\nrequired: true\nvalidation: ^[0-9]+$").el.querySelector("input.sc-number-input");
  ok("required on a number input", n?.required === true);
  ok("pattern from validation", n?.getAttribute("pattern") === "^[0-9]+$");
  const m = render("id: r2\nlabel: M\ntype: multiline\nvalue: x\nrequired: true").el.querySelector("textarea.sc-item-multiline");
  ok("required on a multiline textarea", m?.required === true);
}

head("AFFIXES appear once, for items and for scalars");
{
  const a = render("id: a1\nlabel: L\ntype: text\nprefix: $\nsuffix: usd\nitem: text|v").el;
  ok("items: one prefix, one suffix", a.querySelectorAll(".sc-affix").length === 2,
     JSON.stringify([...a.querySelectorAll(".sc-affix")].map(x => x.textContent)));
  const b = render("id: a2\nlabel: L\ntype: text\nvalue: 1\nprefix: $\nsuffix: usd").el;
  ok("scalar: one prefix, one suffix", b.querySelectorAll(".sc-affix").length === 2,
     JSON.stringify([...b.querySelectorAll(".sc-affix")].map(x => x.textContent)));
  ok("affixes are not duplicated outside the row", b.querySelectorAll(".sc-field-content > .sc-affix").length === 0);
}

head("showEditingControls=false leaves a usable field");
{
  const { el } = render("id: s1\nlabel: L\ntype: text\nvalue: v", { showEditingControls: false });
  ok("value control still present", !!el.querySelector("textarea.sc-field-value"));
  ok("label still present", !!el.querySelector("textarea.sc-field-label"));
  ok("no drag", !el.querySelector(".sc-field-drag"));
  ok("no handles", el.querySelectorAll(".sc-resize-handle, .sc-height-handle").length === 0);
  ok("no copy control either", !el.querySelector(".sc-field-copy"));
  const { el: e2 } = render(J("id: s2", "label: L", "type: text", "item: text|v"), { showEditingControls: false });
  ok("item fields still render their items", e2.querySelectorAll(".sc-field-item").length === 1,
     e2.querySelectorAll(".sc-field-item").length);
  ok("no item menu", !e2.querySelector(".sc-item-menu"));
  ok("no item drag", !e2.querySelector(".sc-item-drag"));
}

head("DIRECTION: titleStyle.direction must not be clobbered by the refresh");
{
  const { el, field } = render("id: d1\nlabel: کتاب\ntype: text\nvalue: v\ntitle-direction: rtl");
  ok("titleStyle parsed", field.titleStyle && field.titleStyle.direction === "rtl", JSON.stringify(field.titleStyle));
  const wrap = el.querySelector(".sc-field-label-wrap");
  ok("label wrap is rtl", wrap && wrap.getAttribute("dir") === "rtl", wrap && wrap.getAttribute("dir"));
  const ta = el.querySelector("textarea.sc-field-label");
  ok("label text is there", ta && ta.value === "کتاب", ta && JSON.stringify(ta.value));
  ta.value = "عنوان جدید";
  ta.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  ok("dir survives a keystroke", wrap.getAttribute("dir") === "rtl", wrap.getAttribute("dir"));
}

console.log("\n================ REVIEW 5 ================");
console.log("pass:", pass, " fail:", fail);
for (const [n, d] of bad) console.log("  FAIL " + n + (d === undefined ? "" : "  [" + d + "]"));
process.exit(fail ? 1 : 0);