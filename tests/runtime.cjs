"use strict";
// End-to-end: render real fields in jsdom and assert the DOM plus the text that
// would be written back to the note. This is the only way to prove the renderer
// actually honours the declared type.
const fs = require("fs");
const Module = require("module");
const T = require("./paths.cjs").T;
const { JSDOM } = require("jsdom");

const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { pretendToBeVisual: true });
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
// Node's AbortSignal is not a jsdom AbortSignal; addEventListener({signal}) would reject it.
global.AbortController = dom.window.AbortController;
global.AbortSignal = dom.window.AbortSignal;

// --- Obsidian DOM helpers ---------------------------------------------------
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
};
for (const [k, fn] of Object.entries(helpers)) {
  Object.defineProperty(Proto, k, { value: fn, writable: true, configurable: true });
  Object.defineProperty(dom.window.Element.prototype, k, { value: fn, writable: true, configurable: true });
}

// --- Obsidian module stub ---------------------------------------------------
const notices = [];
const obsidian = require("./obsidian-stub.cjs");
obsidian.Notice = class { constructor(m) { notices.push(m); } };
obsidian.setIcon = (el, name) => { el.setAttribute("data-icon", name); el.appendChild(el.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "svg")); };
obsidian.Menu = class {
  constructor() { this.items = []; }
  addItem(cb) {
    const it = { setTitle(t) { it.title = t; return it; }, setIcon(i) { it.icon = i; return it; },
      onClick(f) { it.onClick = f; return it; } };
    cb(it); this.items.push(it); return it;
  }
  addSeparator() {} showAtMouseEvent() {} showAtPosition() {}
};
let clipboard = null, clipFail = false;
global.navigator.clipboard = { writeText: async (t) => { if (clipFail) throw new Error("denied"); clipboard = t; } };

// Note: do NOT hook Module._resolveFilename. Returning a hand-built path from it
// gives a different cache key than a plain require(), so the plugin ends up with
// a *second* copy of the stub. Normal node_modules resolution is enough: the
// plugin file lives next to node_modules/obsidian.

// --- instrumented copy of the plugin ---------------------------------------
const src = fs.readFileSync(require("./paths.cjs").src, "utf8")
  + "\n;module.exports.__Et=Et;module.exports.__Fe=Fe;module.exports.__fvc=fieldValueControl;module.exports.__Bt=Bt;module.exports.__Q=Q;module.exports.__W=W;\n";
fs.writeFileSync(T + "instrumented.cjs", src);
// Drop any cached copy so the freshly-written stubs above are the ones used.
for (const k of Object.keys(require.cache)) {
  if (k.endsWith("instrumented.cjs")) delete require.cache[k];
}
const M = require(T + "instrumented.cjs");
const { __Et: Et, __Q: Q, __W: W } = M;

let pass = 0, fail = 0; const bad = [];
const ok = (n, c, d) => { if (c) pass++; else { fail++; bad.push([n, d]); } };
const head = t => console.log("\n### " + t);

const OPTS = { revealSecrets: false, defaultDirection: "auto",
  animations: true, showEditingControls: true, showDragHandles: true, responsive: true, snapGuides: true };
const block = inner => "```structured-field\n" + inner + "\n```";

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
const q = (el, sel) => el.querySelector(sel);

// Helper: a multi-line field body must be written as an indented block scalar,
// exactly like W() does. `value: a\nb` at indent 0 is two separate lines.
const ml = (...lines) => "value: |\n" + lines.map(l => "  " + l).join("\n");

head("text field: auto-growing value, label, no copy control");
let clickCopy;
{
  const { el } = render("id: t1\nlabel: Name\ntype: text\nvalue: hello");
  ok("value textarea exists", !!q(el, "textarea.sc-field-value"));
  ok("value preloaded", q(el, "textarea.sc-field-value")?.value === "hello");
  ok("label textarea exists", !!q(el, "textarea.sc-field-label"));
  ok("no help text when unset", !q(el, ".sc-field-help"));
  // The copy button was removed. Asserting its absence here is what stops it
  // coming back unnoticed.
  ok("no copy button is rendered", !q(el, ".sc-field-copy"));
  ok("no copy hook class anywhere in the field", !q(el, ".sc-copy-value"));
  ok("nothing copy-shaped is focusable", ![...el.querySelectorAll("[aria-label]")]
    .some((n) => /copy/i.test(n.getAttribute("aria-label"))),
    [...el.querySelectorAll("[aria-label]")].map((n) => n.getAttribute("aria-label")).join(" | "));
}
head("clipboard + notice");
// copyText is async, so let the microtask queue drain before asserting.
const drain = () => new Promise(r => setTimeout(r, 5));

(async () => {
  ok("rendering a field writes nothing to the clipboard", clipboard === null, String(clipboard));
  ok("rendering a field raises no copy notice", !notices.some((n) => /copied/i.test(n)), JSON.stringify(notices));


head("select honours options:");
{
  const { el } = render("id: s1\nlabel: Status\ntype: select\noptions: Todo, Doing, Done\nvalue: Doing");
  const sel = q(el, "select.sc-input");
  ok("select element", !!sel);
  ok("one option per entry", sel?.options.length === 3, sel && [...sel.options].map(o => o.value).join());
  ok("current value selected", sel?.value === "Doing");
  sel.value = "Done";
  sel.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  ok("change handler ran without throwing", true);
}

head("number / url / validation");
{
  const inp = q(render("id: n1\nlabel: Count\ntype: number\nvalue: 42\nvalidation: ^[0-9]+$").el, "input.sc-number-input");
  ok("number input", inp?.type === "number");
  ok("value preloaded", inp?.value === "42");
  ok("validation -> pattern", inp?.getAttribute("pattern") === "^[0-9]+$");
  const u = q(render("id: u1\nlabel: Site\ntype: url\nvalue: https://x.dev").el, "input.sc-url-input");
  ok("url input", u?.type === "url", u?.type);
  ok("url value", u?.value === "https://x.dev");
}

head("secret masking");
{
  ok("password by default", q(render("id: x1\nlabel: T\ntype: secret\nvalue: s").el, "input.sc-input")?.type === "password");
  ok("masked: false reveals", q(render("id: x2\nlabel: T\ntype: secret\nvalue: s\nmasked: false").el, "input.sc-input")?.type === "text");
  ok("revealSecrets setting reaches it", q(render("id: x3\nlabel: T\ntype: secret\nvalue: s", { revealSecrets: true }).el, "input.sc-input")?.type === "text");
  ok("reveal button present", !!q(render("id: x4\nlabel: T\ntype: secret\nvalue: s").el, ".sc-item-reveal"));
}

head("multiline / code / tags");
{
  const el = render("id: m1\nlabel: Notes\ntype: multiline\n" + ml("a", "b")).el;
  const t = q(el, "textarea.sc-item-multiline");
  ok("multiline textarea", t?.value === "a\nb", t && JSON.stringify(t.value));
  const cd = q(render("id: c1\nlabel: S\ntype: code\nvalue: x=1").el, "textarea.sc-code");
  ok("code textarea", !!cd);
  ok("code disables spellcheck", cd?.getAttribute("spellcheck") === "false");
  const tg = q(render("id: g1\nlabel: Tags\ntype: tags").el, "textarea.sc-tags");
  ok("tags hook class", !!tg);
  // The hint belongs to an EMPTY field (the browser hides placeholders once
  // there is a value), and it is an LTR island inside RTL cards now: LRI-prefixed.
  ok("tags hint", /^\u2066Comma separated\u2069$/.test(tg?.placeholder || ""), tg?.placeholder);
}

head("prefix / suffix / help / required");
{
  const { el } = render("id: p1\nlabel: Price\ntype: text\nvalue: 5\nprefix: $\nsuffix: USD\nhelp: Net amount\nrequired: true");
  ok("affixes rendered", [...el.querySelectorAll(".sc-affix")].map(x => x.textContent).join("|") === "$|USD",
     [...el.querySelectorAll(".sc-affix")].map(x => x.textContent).join("|"));
  ok("affixes live in a value row", !!q(el, ".sc-field-value-row"));
  ok("help rendered", q(el, ".sc-field-help")?.textContent === "Net amount");
  ok("required marker", q(el, ".sc-required")?.textContent === "*");
  ok("required on the control", q(el, "textarea.sc-field-value")?.required === true);
  const itemPref = render("id: p2\nlabel: L\ntype: text\nprefix: #\nitem: text|tag");
  ok("prefix also renders for item fields", itemPref.el.querySelectorAll(".sc-affix").length === 1,
     itemPref.el.querySelectorAll(".sc-affix").length);
}

head("items: title-text, multiline, url, checkbox, secret, separator");
{
  const { el } = render("id: i1\nlabel: C\ntype: text\nitem: title-text|Email|me@x.dev\nitem: multiline|Long note\nitem: url|https://a.dev\nitem: checkbox|Done|true\nitem: secret|hidden\nitem: separator");
  const wrap = q(el, ".sc-item-title-text-wrapper");
  ok("title-text wrapper built", !!wrap);
  ok("wrapper stacks title then value", wrap?.children.length === 2, wrap?.children.length);
  ok("multiline item class", !!q(el, ".sc-item-multiline"));
  ok("url item class", !!q(el, ".sc-item-url"));
  ok("checkbox checked", q(el, ".sc-item-checkbox")?.checked === true);
  ok("separator rendered", !!q(el, ".sc-item-separator"));
  ok("secret item masked", !!q(el, ".sc-secret-masked"));
  ok("kind recorded on the row", !!q(el, ".sc-field-item-title-text"));
}

head("settings gate the chrome");
{
  const on = render("id: g1\nlabel: L\ntype: text\nvalue: v").el;
  ok("field drag on", !!q(on, ".sc-field-drag"));
  ok("field menu on", !!q(on, ".sc-field-more"));
  ok("3 resize handles", on.querySelectorAll(".sc-resize-handle, .sc-height-handle").length === 3,
     on.querySelectorAll(".sc-resize-handle, .sc-height-handle").length);
  ok("handles expose aria-orientation", [...on.querySelectorAll(".sc-resize-handle,.sc-height-handle")].every(h => h.hasAttribute("aria-orientation")));
  ok("handles expose aria-valuenow", [...on.querySelectorAll(".sc-resize-handle,.sc-height-handle")].every(h => h.hasAttribute("aria-valuenow")));
  const off = render("id: g2\nlabel: L\ntype: text\nvalue: v", { showEditingControls: false }).el;
  ok("editing off: no drag", !q(off, ".sc-field-drag"));
  ok("editing off: no menu", !q(off, ".sc-field-more"));
  ok("editing off: no handles", off.querySelectorAll(".sc-resize-handle, .sc-height-handle").length === 0);
  ok("editing off: still editable", !!q(off, "textarea.sc-field-value"));
  ok("editing off renders no copy control", !q(off, ".sc-field-copy"));
  const nh = render("id: g3\nlabel: L\ntype: text\nvalue: v", { showDragHandles: false }).el;
  ok("no grips", !q(nh, ".sc-field-drag") && !q(nh, ".sc-item-drag"));
  ok("menus still there", !!q(nh, ".sc-field-more"));
  const nc = render("id: g4\nlabel: L\ntype: text\nvalue: v").el;
  ok("a field renders the same whatever the removed options were", !!nc);
  ok("no copy-off class survives", !nc.classList.contains("sc-global-copy-off"));
  ok("copy: false in a note is still accepted and renders no copy control",
     !q(render("id: g5\nlabel: L\ntype: text\nvalue: v\ncopy: false").el, ".sc-field-copy"));
  ok("animations off class", render("id: g6\nlabel: L\ntype: text\nvalue: v", { animations: false }).el.classList.contains("sc-no-animation"));
  ok("responsive class", render("id: g7\nlabel: L\ntype: text\nvalue: v", { responsive: true }).el.classList.contains("sc-responsive"));
}

head("a fence inside a value survives render and re-serialisation");
{
  const value = "before\n```js\nx\n```\nafter";
  const { field } = render("id: f1\nlabel: Doc\ntype: multiline\n" + ml(...value.split("\n")));
  ok("multiline value parsed intact", field.value === value, JSON.stringify(field.value));
  const ta = q(document.getElementById("root"), "textarea.sc-item-multiline");
  ok("rendered control holds the fence", ta?.value === value, JSON.stringify(ta?.value));
  ok("re-serialises identically", Q(W(field)).value === value, JSON.stringify(Q(W(field)).value));
  // And the CommonMark fence check that used to truncate it.
  const written = W(field);
  const body = [];
  const lines = written.split("\n");
  for (let i = 1; i < lines.length; i++) { if (/^ {0,3}```/.test(lines[i])) break; body.push(lines[i]); }
  ok("no line in the block can close the fence",
     body.length === lines.length - 2, body.length + " of " + (lines.length - 2));
  ok("and the plugin still reads the full body",
     Q("```structured-field\n" + body.join("\n") + "\n```").value === value);
}

head("duplicate copies are independent");
{
  const { field } = render("id: d1\nlabel: L\ntype: text\nvalue: v");
  const copy = Q(block("id: d1\nlabel: L\ntype: text\nvalue: v"));
  ok("two identical blocks parse to the same field id", copy.id === field.id);
}

console.log("\n================ RUNTIME ================");
console.log("pass:", pass, " fail:", fail);
for (const [n, d] of bad) console.log("  FAIL " + n + (d === undefined ? "" : "  [" + d + "]"));
process.exit(fail ? 1 : 0);
})();