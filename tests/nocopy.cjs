"use strict";
// The copy button was removed. This suite asserts the feature is GONE, because
// "removed" is a claim that decays: one later edit that reuses showCopyButtons,
// or one leftover class in the stylesheet, and it is back.
//
// Absence tests are only worth having if they are specific. Each assertion here
// names something that would have to be deliberately re-added.
const fs = require("fs");
const path = require("path");
const { src, css: cssPath } = require("./paths.cjs");
const { JSDOM } = require("jsdom");

const js = fs.readFileSync(src, "utf8");
const code = js.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const sheet = fs.readFileSync(cssPath, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

let pass = 0,
  fail = 0;
const bad = [];
const ok = (n, c, d) => {
  if (c) pass++;
  else {
    fail++;
    bad.push([n, d]);
  }
};
const head = (t) => console.log("\n### " + t);

head("no copy button is rendered, in either card kind");
{
  ok("no code creates an element with the sc-field-copy class", !/sc-field-copy/.test(code));
  ok("no code creates an element with the sc-copy-value hook", !/sc-copy-value/.test(code));
  ok("no code adds the sc-global-copy-off class", !/sc-global-copy-off/.test(code));

  // The shared icon helper is still asked for the "copy" ICON -- for the
  // Duplicate buttons, which use a copy glyph and never touch the clipboard.
  // Asserting on the icon name alone would be wrong; assert on the label, which
  // is what tells a clipboard button from a duplicate button.
  const iconCalls = [...code.matchAll(/\bI\(\s*[a-zA-Z$_][\w$]*\s*,\s*"([^"]*)"\s*,\s*"([^"]*)"/g)].map((m) => ({
    icon: m[1],
    label: m[2],
  }));
  const clipboardish = iconCalls.filter((c) => /copy/i.test(c.label));
  ok("no icon button claims to copy anything", clipboardish.length === 0, JSON.stringify(clipboardish));
  const withCopyIcon = iconCalls.filter((c) => c.icon === "copy");
  ok(
    "the copy ICON survives only where the action is 'duplicate'",
    withCopyIcon.length > 0 && withCopyIcon.every((c) => /duplicate/i.test(c.label)),
    JSON.stringify(withCopyIcon),
  );
  ok("the shared icon helper is still used for other buttons", iconCalls.length > 3, iconCalls.length + " call(s)");

  ok('no "Copy <label>" aria-label is produced for a field', !/Copy \$\{/ .test(code));
  ok(
    "the only copy notices left are about templates",
    [...code.matchAll(/"([^"]*copied[^"]*)"/gi)].map((m) => m[1]).every((s) => /template/i.test(s)),
    JSON.stringify([...code.matchAll(/"([^"]*copied[^"]*)"/gi)].map((m) => m[1])),
  );
}

head("the clipboard primitive survives only because template export uses it");
{
  ok("copyText still exists", /function copyText\b/.test(code));
  // Two call sites, both template operations: the export/import round trip and
  // saving a template's JSON. Neither is a field's copy button. Splitting on the
  // name yields the definition's own body first, which is not a caller.
  const bodies = code.split(/copyText\(/).slice(2);
  ok("exactly two call sites remain", bodies.length === 2, bodies.length + " caller(s)");
  ok(
    "every remaining caller mentions templates",
    bodies.length > 0 && bodies.every((b) => /[Tt]emplate/.test(b.slice(0, 170))),
    JSON.stringify(bodies.map((b) => b.slice(0, 60).replace(/\s+/g, " "))),
  );
}

head("no dead code was left behind");
{
  // fieldText() and the bidi-strip regex existed only to feed the copy buttons.
  ok("fieldText is gone", !/\bfieldText\b/.test(code), "it had one caller, the removed button");
  ok(
    "the bidi strip is gone",
    !/\[\s*\\u061c\\u200e\\u200f/.test(code),
    "it had two callers, both removed buttons",
  );
  // A variable that is only ever assigned is dead weight that survives review.
  const stripped = code.replace(/[^A-Za-z0-9_$]/g, "");
  ok("no identifier named 'ce' remains", !/\bce\b/.test(stripped));
  ok(
    "copyable is gone from the data model",
    !/\bcopyable\b/.test(code),
    "a property nothing reads is a property someone will read by mistake",
  );
  ok("nothing writes a copy= attribute", !/copy=/.test(code));
  ok("the copy icon is still used for the duplicate buttons", /I\(\s*\w+\s*,\s*"copy"\s*,\s*"Duplicate/.test(code));
}

head("the settings are gone, and old data.json is cleaned up");
{
  const dropped = /var StDropped = \[([\s\S]*?)\];/.exec(code);
  ok("StDropped was found", !!dropped);

  // The keys MUST survive in exactly one place -- the prune list -- so an
  // existing data.json stops carrying them. Anywhere else and they are either a
  // live setting or dead text.
  const occurrences = [...code.matchAll(/showCopyButtons|copyNotice/g)].length;
  const inDropped = dropped ? (dropped[1].match(/showCopyButtons|copyNotice/g) || []).length : 0;
  ok("both keys appear exactly once, in the prune list", occurrences === 2 && inDropped === 2,
     occurrences + " occurrence(s), " + inDropped + " in StDropped");

  const st = /var St = \{([\s\S]*?)\};/.exec(code);
  ok("neither key is a live setting", !!st && !/showCopyButtons|copyNotice/.test(st[1]));
  ok("renderOptions no longer passes them", !/showCopyButtons:/.test(code) && !/copyNotice:/.test(code));
  ok("no settings row offers them", !/"Show copy buttons"|"Notice after copy"/.test(code));
}

head("the copy: key is still understood, so old notes do not gain junk metadata");
{
  // Removing the feature must not turn an existing `copy: false` line into a
  // custom metadata entry, which would then be written back forever.
  const reserved = /var pt = new Set\(\[([\s\S]*?)\]\)/.exec(code);
  ok("the reserved-key set was found", !!reserved);
  ok(
    "copy is still reserved",
    !!reserved && /"copy"/.test(reserved[1]),
    "an old `copy: false` would fall through to metadata and be written back forever",
  );
  ok("copyable is no longer stored on a parsed field", !/\bcopyable\b/.test(code));
  ok("the field modal no longer offers a Copyable row", !/"Copyable"/.test(code));
}

head("the stylesheet has no copy rules left");
{
  for (const c of ["sc-field-copy", "sc-copy-value", "sc-global-copy-off"]) {
    ok("." + c + " has no rule", !sheet.includes(c));
  }
  ok("the legacy card copy rule is gone", !/sc-card[^{]*\{[^}]*sc-copy/.test(sheet));
}

head("rendered output really has no copy control");
{
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { pretendToBeVisual: true });
  global.window = dom.window;
  global.document = dom.window.document;
  Object.defineProperty(global, "navigator", { value: dom.window.navigator, configurable: true, writable: true });
  for (const k of ["HTMLElement", "HTMLInputElement", "HTMLTextAreaElement", "Element", "Node", "Event", "CustomEvent", "getComputedStyle", "DOMParser", "NodeFilter"])
    global[k] = dom.window[k];
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
  };
  for (const [k, fn] of Object.entries(helpers)) {
    Object.defineProperty(Proto, k, { value: fn, writable: true, configurable: true });
    Object.defineProperty(dom.window.Element.prototype, k, { value: fn, writable: true, configurable: true });
  }

  const obsidian = require("./obsidian-stub.cjs");
  obsidian.setIcon = (el) => el.appendChild(el.ownerDocument.createElement("i"));
  obsidian.Notice = class {};

  const { T } = require("./paths.cjs");
  fs.writeFileSync(T + "nocopy.cjs", js + "\n;module.exports.__Et=Et;module.exports.__Q=Q;\n");
  for (const k of Object.keys(require.cache)) if (k.endsWith("nocopy.cjs")) delete require.cache[k];
  const { __Et: Et, __Q: Q } = require(T + "nocopy.cjs");

  const root = document.getElementById("root");
  Et(
    root,
    Q("```structured-field\nid: c1\nlabel: L\ntype: text\nwidth: 100%\nvalue: v\n```"),
    {
      revealSecrets: false, showCopyButtons: true, copyNotice: true, defaultDirection: "auto",
      animations: true, showEditingControls: true, showDragHandles: true, responsive: true, snapGuides: true,
    },
    { commitOnBlur: true, save: () => {}, duplicate: () => {}, delete: () => {}, beginDrag: () => {} },
  );
  ok("no .sc-field-copy in the rendered field", !root.querySelector(".sc-field-copy"));
  ok("no .sc-copy-value in the rendered field", !root.querySelector(".sc-copy-value"));
  ok("no sc-global-copy-off on the root", !root.classList.contains("sc-global-copy-off"));
  ok(
    "nothing in the rendered field has a copy-ish aria-label",
    ![...root.querySelectorAll("[aria-label]")].some((e) => /copy/i.test(e.getAttribute("aria-label"))),
    [...root.querySelectorAll("[aria-label]")].map((e) => e.getAttribute("aria-label")).join(" | "),
  );
  ok(
    "the drag handle and menu are still there",
    !!root.querySelector(".sc-field-drag") && !!root.querySelector(".sc-field-more"),
    "removing the copy button must not take the other controls with it",
  );
}

console.log("\n================ NO COPY ================");
console.log("pass:", pass, " fail:", fail);
for (const [n, d] of bad) console.log("  FAIL " + n + (d === undefined ? "" : "  [" + d + "]"));
process.exit(fail ? 1 : 0);
void path;