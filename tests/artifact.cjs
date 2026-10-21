"use strict";
// Behavioural test of the BUILT, MINIFIED artifact (main.js), not the source.
// Minification renames every internal binding, so the detailed suites can only
// run against src/main.js. What this file verifies is the shipped contract:
// it loads, exports a Plugin subclass, and the public entry points behave.
const fs = require("fs");
const Module = require("module");
const T = require("./paths.cjs").T;
const P = require("./paths.cjs").P;

let pass = 0, fail = 0; const bad = [];
const ok = (n, c, d) => { if (c) pass++; else { fail++; bad.push([n, d]); } };
const head = t => console.log("\n### " + t);
const J = (...l) => l.join("\n");

// --- the two builds, both runnable -----------------------------------------
const srcArtifact = fs.readFileSync(P + "main.js", "utf8");
const sourceText  = fs.readFileSync(P + "src/main.js", "utf8");
head("the fixes are present in the minified artifact, not just the source");
{
  // Names do not survive minification, so this looks for the literals that DO:
  // class names and data attributes.
  for (const [what, re] of [
    ["reading drag creates the drag overlay", /sc-drag-overlay/],
    ["reading drag creates the drop placeholder", /sc-drop-placeholder/],
    ["reading drag uses the is-dragging state", /is-dragging/],
    ["the hit-test scopes to rendered fields", /sc-standalone-field/],
  ])
    ok(what, re.test(srcArtifact), re.source);

  // Whether the drag handle uses an optional call cannot be checked here: 14
  // legitimate `?.(` guards exist for Obsidian APIs and callbacks the caller may
  // omit, and minified they are indistinguishable. That assertion lives in
  // readingdrag.cjs, against the readable source, where the code is identifiable.

  // The colour fix lives in the stylesheet, which is a separate downloaded file.
  const sheet = fs.readFileSync(P + "styles.css", "utf8");
  ok(
    "the shipped stylesheet uses the surface token, not --background-primary",
    /var\(--sc-surface\)/.test(sheet) && !/\.sc-field-shell\{[^}]*background-primary/.test(sheet),
  );
}

head("the artifact is actually built, not the source");
{
  ok("main.js is minified", srcArtifact.trim().split("\n").length < 60,
     srcArtifact.trim().split("\n").length + " lines");
  ok("main.js is materially smaller than the source",
     srcArtifact.length < sourceText.length * 0.75,
     `${srcArtifact.length} vs ${sourceText.length}`);
  ok("no source comments leaked into the artifact",
     !/\*\/\s*Insert a block on its own line/.test(srcArtifact));
  ok("no 'use strict' duplication", (srcArtifact.match(/use strict/g) || []).length <= 1);
  ok("obsidian stays an external require", /require\("obsidian"\)/.test(srcArtifact));
  for (const m of ["@codemirror/view", "@codemirror/state", "@codemirror/commands"])
    ok(m + " stays external", srcArtifact.includes(`require("${m}")`));
  console.log("  artifact: " + (srcArtifact.length / 1024).toFixed(1) + " KB   source: " +
              (sourceText.length / 1024).toFixed(1) + " KB");
}

// --- load it ----------------------------------------------------------------
const obsidian = require("./obsidian-stub.cjs");
const notices = [];
obsidian.Notice = class { constructor(m) { notices.push(m); } };
obsidian.setIcon = () => {};
obsidian.Menu = class { addItem(cb) { const it = { setTitle: () => it, setIcon: () => it, onClick: () => it }; cb(it); return it; } addSeparator() {} showAtMouseEvent() {} showAtPosition() {} };
obsidian.Setting = class { constructor() {} setName(){return this} setDesc(){return this} addButton(){return this} addToggle(){return this} addText(){return this} addDropdown(){return this} addExtraButton(){return this} setWarning(){return this} };
global.window = { addEventListener() {}, removeEventListener() {} };
global.document = { querySelectorAll: () => [] };

fs.writeFileSync(T + "artifact.cjs.src", srcArtifact + "\n;module.exports.__Plugin=module.exports.default;\n");
for (const k of Object.keys(require.cache)) if (k.endsWith("artifact.cjs.src")) delete require.cache[k];
const exported = require(T + "artifact.cjs.src");
const Plugin = exported.default;

head("public export shape");
{
  ok("exports a constructor", typeof Plugin === "function");
  ok("it is a Plugin subclass", Plugin.prototype instanceof obsidian.Plugin,
     Object.getPrototypeOf(Plugin.prototype) && Object.getPrototypeOf(Plugin.prototype).constructor.name);
  const methods = ["onload","onunload","insertField","insertTemplate","saveLayoutTemplate",
    "insertBlock","renderOptions","loadSettings","saveSettings","applyDocEdit",
    "buildDecorations","editorExtension","renderReadingField","renderLegacyCard","withEditor",
    "beginReadingDrag","applyReadingMove","rerenderReading","cancelPointerDrag"];
  const missing = methods.filter(m => typeof Plugin.prototype[m] !== "function");
  ok("every public method survived minification", missing.length === 0, missing.join(", "));
  ok(
    "the reading drag surface is on the prototype, not buried in a closure",
    typeof Plugin.prototype.beginReadingDrag === "function" &&
      typeof Plugin.prototype.applyReadingMove === "function",
  );
}

// --- mock editor + vault ----------------------------------------------------
class Editor {
  constructor(text) { this.value = text; this.c = { line: 0, ch: 0 }; }
  getValue() { return this.value; }
  getLine(n) { return this.value.split("\n")[n] ?? ""; }
  lineCount() { return this.value.split("\n").length; }
  getCursor() { return { ...this.c }; }
  getSelection() { return ""; }
  offsetOf(p) { const L = this.value.split("\n"); let o = 0;
    for (let i = 0; i < p.line && i < L.length; i++) o += L[i].length + 1;
    return o + Math.min(p.ch, (L[p.line] ?? "").length); }
  posToOffset(p) { return this.offsetOf(p); }
  offsetToPos(o) { const L = this.value.split("\n"); let left = o, line = 0;
    while (line < L.length - 1 && left > L[line].length) { left -= L[line].length + 1; line++; }
    return { line, ch: left }; }
  replaceRange(rep, from, to) {
    const a = typeof from === "number" ? from : this.offsetOf(from);
    const b = to === undefined ? a : typeof to === "number" ? to : this.offsetOf(to);
    this.value = this.value.slice(0, Math.min(a,b)) + rep + this.value.slice(Math.max(a,b));
  }
}
function makePlugin(text) {
  const file = new obsidian.TFile();
  file.path = "note.md";
  const vault = { getAbstractFileByPath: p => (p === "note.md" ? file : null),
    process: async (f, fn) => (text = fn(text)) };
  const p = new Plugin({ vault, workspace: { getActiveFile: () => null } }, { version: "0.1.0" });
  return { p, vault, read: () => text };
}

head("insertField through the built artifact (the path that regressed twice)");
{
  const FIELD = J("```structured-field", "id: a", "label: L", "type: text", "width: 100%", "value: v", "```");
  const cases = [
    ["empty note", "", { line: 0, ch: 0 }],
    ["mid text", "hello", { line: 0, ch: 2 }],
    ["end of text", "hello", { line: 0, ch: 5 }],
    ["second line", "a\nb", { line: 1, ch: 1 }],
    ["after a field", FIELD + "\n\ntail", { line: 0, ch: 0 }],
    ["inside a field", FIELD + "\n\ntail", { line: 2, ch: 2 }],
    ["CRLF note", "hello\r\nworld", { line: 1, ch: 2 }],
  ];
  for (const [name, doc, cur] of cases) {
    const { p } = makePlugin(doc);
    const ed = new Editor(doc);
    ed.c = cur;
    let threw = null;
    try { p.insertField(ed); } catch (e) { threw = String(e); }
    ok(`${name}: no throw`, !threw, threw);
    const after = ed.getValue();
    const beforeLines = doc.split("\n").filter(Boolean);
    ok(`${name}: no original line lost`, beforeLines.every(l => after.includes(l)),
       beforeLines.filter(l => !after.includes(l)).join("|"));
    ok(`${name}: one block added`, (after.match(/```structured-field/g) || []).length ===
       (doc.match(/```structured-field/g) || []).length + 1, after);
    ok(`${name}: bounded growth`, after.length <= doc.length + 260, after.length + " vs " + doc.length);
    ok(`${name}: fences balanced`, (after.match(/^```/gm) || []).length % 2 === 0, after);
  }
}

head("insertBlock surfaces failure instead of dying silently");
{
  const { p } = makePlugin("x");
  notices.length = 0;
  p.insertBlock(null, "block");
  ok("a null editor produces a Notice", notices.length === 1 && /no active editor/i.test(notices[0]),
     JSON.stringify(notices));
  const ed = new Editor("abc");
  ed.c = { line: 0, ch: 1 };
  const orig = ed.getValue;
  ed.getValue = () => { throw new Error("boom"); };
  notices.length = 0;
  p.insertBlock(ed, "block");
  ok("a throwing editor produces a Notice", notices.some(n => /could not insert/i.test(n) && /boom/.test(n)),
     JSON.stringify(notices));
  ed.getValue = orig;
  ok("and the document is untouched", ed.getValue() === "abc");
}

head("settings load, migrate and prune");
{
  const { p } = makePlugin("x");
  let written = null;
  p.loadData = async () => ({ responsive: false, defaultLayout: "auto", defaultGap: 10,
    templates: [{ id: "builtin-api-provider", name: "API Provider", source: "x" },
                { id: "keep", name: "Keep", source: "y" }] });
  p.saveData = async d => { written = d; };
  return (async () => {
    await p.loadSettings();
    ok("saved setting preserved", p.settings.responsive === false);
  ok("the removed copy settings are pruned from data.json",
     !("showCopyButtons" in p.settings) && !("copyNotice" in p.settings), Object.keys(p.settings).join());
    ok("dead keys pruned", !("defaultLayout" in p.settings) && !("defaultGap" in p.settings));
    ok("builtin template filtered", !p.settings.templates.some(t => t.id === "builtin-api-provider"));
    ok("user template kept", p.settings.templates.some(t => t.id === "keep"));
    ok("rewrite happened", !!written && !("defaultLayout" in written));
    const opts = p.renderOptions();
    ok("renderOptions reflects settings", opts.responsive === false);
  ok("renderOptions no longer mentions the copy settings",
     !("showCopyButtons" in opts) && !("copyNotice" in opts), Object.keys(opts).join());
    ok("renderOptions exposes the chrome flags",
       ["showEditingControls","showDragHandles","responsive"].every(k => k in opts), Object.keys(opts).join());
    finish();
  })();
}

function finish() {
head("other public entry points do not throw");
{
  const { p, vault, read } = makePlugin("x\n\n```structured-field\nid: a\nlabel: L\ntype: text\nwidth: 100%\nvalue: v\n```\n\ny");
  const FIELD = "```structured-field\nid: a\nlabel: L\ntype: text\nwidth: 100%\nvalue: v\n```";
  let t1 = null;
  try { p.applyDocEdit({ state: { doc: { toString: () => "aaa\nbbb" } }, dispatch: () => {} }, "aaa\nccc"); }
  catch (e) { t1 = String(e); }
  ok("applyDocEdit does not throw", !t1, t1);
  let t2 = null;
  try { p.editorExtension(); } catch (e) { t2 = String(e); }
  ok("editorExtension does not throw", !t2, t2);
  let t3 = null;
  try { p.buildDecorations({ doc: { toString: () => "no blocks here" } }); } catch (e) { t3 = String(e); }
  ok("buildDecorations on a plain note does not throw", !t3, t3);
  let t4 = null;
  try { p.onunload(); } catch (e) { t4 = String(e); }
  ok("onunload does not throw", !t4, t4);
  void read; void vault; void FIELD;
}

console.log("\n================ ARTIFACT ================");
console.log("pass:", pass, " fail:", fail);
for (const [n, d] of bad) console.log("  FAIL " + n + (d === undefined ? "" : "  [" + d + "]"));
process.exit(fail ? 1 : 0);
}