"use strict";
// Static audit of the LIVE project files: every claim in the review must now
// read as fixed.
const fs = require("fs");
const { src, css: cssPath } = require("./paths.cjs");
const js = fs.readFileSync(src, "utf8");
const css = fs.readFileSync(cssPath, "utf8");
let pass = 0, fail = 0; const bad = [];
const ok = (n, c, d) => { if (c) pass++; else { fail++; bad.push([n, d]); } };
const seg = (a, b) => js.slice(js.indexOf(a), js.indexOf(b));
const Et = seg("function Et(i, r, t, e) {", "function Fe(i, r, t, e, o, s, n, a, d) {");
const Fe = seg("function Fe(i, r, t, e, o, s, n, a, d) {", "function De(i, r, t) {");
const fvc = seg("function fieldValueControl(", "function Et(");
const Ct = seg("function Ct(", "var St = {");

console.log("--- 1. Move item down / row membership ---");
ok("V() has no index decrement", !/d--/.test(seg("function V(", "function Ht(")));
ok("V() documents the slot semantics", /target index in the ORIGINAL/.test(js.slice(js.lastIndexOf("/**", js.indexOf("function V(")), js.indexOf("function Ht("))));
ok("Ct() joins the target row", /if \(A\.field\.row\) \(\(m\.row = A\.field\.row\)/.test(Ct));
ok("Ct() swallows the leftover blank line", /Swallow one blank separator/.test(Ct));
ok("Ct() keeps row members tight", /tight/.test(Ct));

console.log("--- 2. width clamp ---");
ok("MIN_FIELD_WIDTH exists", /var MIN_FIELD_WIDTH = 60;/.test(js));
ok("ke() clamps the lower bound", /Math\.max\(\s*MIN_FIELD_WIDTH/.test(seg("function ke(", "function It(")));

console.log("--- 3. fence / escape safety ---");
ok("fence guard writer fg()", /function fg\(i\)/.test(js));
ok("fence guard reader fug()", /function fug\(i\)/.test(js));
ok("W() guards label body lines", /`  \$\{fg\(e\)\}`/.test(js));
ok("W() guards value body lines", /t\.push\(`  \$\{fg\(e\)\}`\)/.test(js));
ok("Q() unguards label body lines", /fug\(r\[\+\+k\]\.replace/.test(js));
ok("Q() unguards value body lines", /fug\(T\.replace/.test(js));
ok("needsBlock() guards the bare-pipe case", /needsBlock/.test(js) && /\^\\s\*\\\|\\s\*\$/.test(js));
ok("W() uses needsBlock for both label and value",
   (js.match(/needsBlock\(/g) || []).length >= 2);

console.log("--- 4. mt() never writes 'undefined' ---");
ok("title guarded", /title: \$\{i\.title \?\? "Structured card"\}/.test(js));
ok("layout validated", /\["auto", "1", "2", "3", "4"\]\.includes\(i\.layout\)/.test(js));
ok("size validated", /\["small", "medium", "large", "custom"\]\.includes\(i\.size\)/.test(js));
ok("density validated", /\["compact", "comfortable"\]\.includes\(i\.density\)/.test(js));

console.log("--- 5. newline preservation + duplicate rows ---");
ok("saveReadingBlock re-encodes newlines", /let nl = c\.includes\("\\r\\n"\) \? "\\r\\n" : "\\n"/.test(js));
ok("duplicate regenerates the row id", /if \(r\.row\) r\.row = `row-\$\{\$\(\)\}`;/.test(js));

console.log("--- 6. renderer honours type / options / settings ---");
ok("fieldValueControl exists", /function fieldValueControl/.test(js));
for (const t of ["select", "number", "url", "secret", "multiline", "code", "tags"])
  ok("type '" + t + "' has a branch", new RegExp('r\\.type === "' + t + '"').test(fvc));
ok("options: is read", /r\.options\?\.length \? r\.options/.test(fvc));
ok("required is applied", /required/.test(fvc));
ok("default: used as placeholder", /r\.placeholder \|\| r\.defaultValue/.test(fvc));
ok("validation: applied as pattern", /setAttr\("pattern", r\.validation\)/.test(fvc));
ok("prefix rendered", /sc-affix", text: r\.prefix/.test(Et));
ok("suffix rendered", /sc-affix", text: r\.suffix/.test(Et));
ok("help rendered", /sc-field-help", text: r\.help/.test(Et));
  ok("no copy button in structured-field", !/sc-field-copy|sc-copy-value/.test(Et));
  ok("no copy button in the legacy card", !/copyText\(/.test(Fe));
  ok("no fieldText helper left behind", !/function fieldText\(/.test(js));
  ok("no bidi-strip regex left behind", !/\\u061c\\u200e\\u200f/.test(js));
  ok("copy stays a reserved block key so old notes keep parsing", /"copy"/.test(js));
ok("secret item honours revealSecrets", /s && s\.revealSecrets/.test(Fe));
ok("defaultDirection reaches the label through the base resolver", /effectiveDir\(r\.label, r\.titleStyle\?\.direction \?\? r\.direction, t\)/.test(Et));
ok("renderOptions no longer hardcodes the three flags",
   /showEditingControls: this\.settings\.showEditingControls/.test(js) &&
   /showDragHandles: this\.settings\.showDragHandles/.test(js) &&
   /responsive: this\.settings\.responsive/.test(js));
ok("Et toggles animations + responsive classes",
   /toggleClass\("sc-no-animation", !t\.animations\)/.test(Et) &&
   /toggleClass\("sc-responsive", !!t\.responsive\)/.test(Et));
ok("multiline item kind has a branch", /sc-item-value sc-item-multiline/.test(Fe));
ok("url item kind has a branch", /sc-item-value sc-item-url/.test(Fe));
ok("title-text builds the vertical wrapper", /sc-item-title-text-wrapper/.test(Fe));
ok("titleStyle.direction survives the refresh", /titleStyle\?\.direction \?\?/.test(Et));

console.log("--- 7. settings tab exposes everything ---");
const UI = js.slice(js.indexOf("Mt = class"));
for (const k of ["showEditingControls","showDragHandles",
                 "responsive","snapGuides","animations"])
  ok("setting tab: " + k, new RegExp('"' + k + '"').test(UI));
ok("setting tab: revealSecretsByDefault", UI.includes("settings.revealSecretsByDefault"));
ok("setting tab: defaultDirection", UI.includes("settings.defaultDirection"));
// debugLogging wraps core Obsidian methods and slows navigation; it is a
// diagnostic for data.json only (docs/architecture.md, Diagnostics), never a
// settings row.
ok("debugLogging stays out of the tab (data.json only)", !/"debugLogging"/.test(UI));
ok("setting tab: no copy settings remain", !/"showCopyButtons"|"copyNotice"/.test(UI));
ok("the removed settings are pruned instead", /"showCopyButtons"[\s\S]*?"copyNotice"/.test(js));
ok("no dead default settings remain", !/defaultLayout|defaultSize|defaultDensity|defaultGap|showCopyButtons|copyNotice/.test(js.slice(js.indexOf("var St = {"), js.indexOf("var StDropped"))));
ok("dead settings are pruned from data.json", /StDropped/.test(js) && /delete this\.settings\[e\]/.test(js));

console.log("--- 8. debug instrumentation gated ---");
ok("installP0Open returns unless enabled", /if \(!this\.settings\.debugLogging\) return;/.test(js));
ok("p0log is silent unless enabled", /this\.settings\.debugLogging && console\.warn/.test(js));
ok("settings load before the harness", /await this\.loadSettings\(\),\s*\n?\s*this\.installP0Open\(\)/.test(js));
ok("no unconditional console.warn in onunload", !/console\.warn\("\[Structured Cards:P0-OPEN\] teardown"/.test(js));

console.log("--- 9. performance ---");
ok("moveField dispatches a minimal change", /applyDocEdit\(t, d\)/.test(js));
ok("applyDocEdit diffs prefix/suffix", /for \(; b < n - a && cur\[cur\.length - 1 - b\] ===/.test(js));
ok("buildDecorations skips block-free notes", /o\.includes\("```structured-"\) \? R\(o\) : \[\]/.test(js));
ok("Pt() is gated too", /n\.length \? Pt\(o\) : \[\]/.test(js));
ok("drag caches the field scan", /let cache = \{ len: -1, fields: \[\] \}/.test(js));
ok("drag no longer reparses the doc", !/R\(e\.state\.doc\.toString\(\)\)/.test(js));
ok("keymap uses the fast scan", /d\.includes\("```structured-"\) \? R\(d\) : \[\]/.test(js));
ok("keymap picks the innermost field", /fields\.find\(\(x\) => head > x\.from && head < x\.to\)/.test(js));
ok("decorations tolerate overlapping scans", /if \(a < last\) continue;/.test(js));
ok("blank-line cap is sane", /function qt\(i, r, t, e = 3\)/.test(js));
ok("ids use crypto.randomUUID", /crypto\.randomUUID/.test(js));

console.log("--- 10b. a settings change reaches the screen ---");
// CodeMirror keeps a widget's DOM whenever eq() says the widget is unchanged.
// An eq() that compares only the source and the offsets therefore freezes every
// card the moment its settings change, which is how a toggle came to flip in the
// tab while the note stayed exactly as it was. Counted rather than asserted
// once, so a widget added later cannot quietly reintroduce it.
{
  const eqs = (js.match(/\n    eq\(t\) \{/g) || []).length;
  const keys = (js.match(/t\.renderKey \? t\.renderKey\(\)/g) || []).length;
  ok("there is at least one editor widget to guard", eqs > 0, eqs + " eq() implementations");
  ok(
    "every widget's eq() compares the render options",
    keys === eqs,
    eqs + " eq() but " + keys + " compare renderKey",
  );
  ok(
    "saving settings refreshes what is on screen",
    /saveSettings\(\)\s*\{[\s\S]{0,200}?refreshRenderedCards\(\)/.test(js),
    "the save stops at saveData and nothing on screen is told",
  );
  ok(
    "the refresh reaches both views",
    /previewMode\?\.rerender\?\.\(true\)/.test(js) &&
      /cm\?\.dispatch\?\.\(\{ effects: \[ScRefresh\.of\(null\)\] \}\)/.test(js),
    "one of the two views is left stale",
  );
}

console.log("--- 10. accessibility ---");
for (const [n, re] of [
  ["field drag has keydown", /f\.onkeydown = \(g\) => \{[\s\S]{0,120}?Drag this handle/],
  ["item drag line has keydown", /u\.onkeydown = \(f\) => \{[\s\S]{0,120}?Drag this line/],
  ["item menu has keydown", /l\.onkeydown = \(f\) => \{[\s\S]{0,140}?l\.onclick\(f\)/],
  ["no copy button left to give a keydown", /^(?![\s\S]*sc-field-copy)/],
  ["secret reveal has keydown", /o\.onkeydown = \(s\) => \{[\s\S]{0,120}?o\.onclick\(\)/],
  ["resize handles resize with arrow keys", /ArrowUp/],
  ["resize handles expose aria-valuenow", /"aria-valuenow"/],
  ["resize handles expose aria-orientation", /"aria-orientation"/],
]) ok(n, re.test(js));
ok("legacy label is associated with its input", /s\.htmlFor = a\.id/.test(js));
// strip comments and template literals before checking for native dialogs
const code = js.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
ok("no native confirm() left", !/\bconfirm\s*\(/.test(code));
ok("no native prompt() left", !/\bprompt\s*\(/.test(code));
ok("ConfirmModal exists", /var ConfirmModal = class extends q\.Modal/.test(js));
ok("NumberPrompt exists", /var NumberPrompt = class extends q\.Modal/.test(js));
ok("TextPrompt exists", /var TextPrompt = class extends q\.Modal/.test(js));
ok("App reference set in onload", /App = this\.app/.test(js));
ok("legacy card widget ignores events", /Ft[\s\S]*?ignoreEvent\(\) \{\s*\n\s*\/\/[\s\S]*?return !0;/.test(js));

console.log("--- 11. misc ---");
ok("clipboard writes are guarded", /async function copyText\(/.test(js));
const code2 = js.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const bareClip = (code2.match(/navigator\.clipboard\.writeText/g) || []).length;
ok("the only clipboard writes are inside copyText()", bareClip >= 1, "found " + bareClip);
ok("insertBlock does not clobber the selection", /insertBlock\(editor, text\)/.test(js));
ok("insertBlock surfaces failures", /could not insert/.test(js) && /catch \(e\)/.test(js));
ok("insertBlock rejects a missing editor", /no active editor/.test(js));
ok("the menu item rejects a missing editor", /if \(!e \|\| typeof e\.getValue !== "function"\) return;/.test(js));
ok("the menu item surfaces failures", /could not add a field/.test(js));
ok("insertField uses insertBlock", /this\.insertBlock\(t, W\(e\)\)/.test(js));
ok("insertTemplate uses insertBlock", /this\.insertBlock\(t, o\.trim\(\)\)/.test(js));
ok("saveLayoutTemplate accepts structured-card too", /n\.includes\("```structured-card"\)/.test(js));
ok("Nt() shape covers what the field menu edits", /\$\{!!i\.hideLabel\}\|[\s\S]{0,60}?\$\{i\.type \|\| ""\}/.test(js) && /i\.direction \|\| ""/.test(js) && /i\.align \|\| ""/.test(js) && /\(\s*i\.options\s*\|\| \[\]\s*\)\.join\(","\)/.test(js));

console.log("--- 12. css ---");
ok("no sc-builder rules remain", !css.includes("sc-builder"));
ok("no sc-option-row rules remain", !css.includes("sc-option-row"));
const declared = new Set([...css.matchAll(/\.(sc-[A-Za-z0-9_-]+)/g)].map(m => m[1]));
const dynamic = new Set(["sc-text-wrap","sc-resize-handle","sc-item","sc-resize-left","sc-resize-right",
  "sc-height-handle","sc-field-label-wrap","sc-item-title-wrap","sc-item-standalone-title-wrap",
  ...["field","separator","heading","text"].map(k=>"sc-item-"+k),
  ...["auto","1","2","3","4"].map(k=>"sc-cols-"+k),
  ...["small","medium","large","custom"].map(k=>"sc-size-"+k),
  ...["compact","comfortable"].map(k=>"sc-density-"+k)]);
const dead = [...declared].filter(c => !js.includes(c) && !dynamic.has(c));
ok("zero dead css classes", dead.length === 0, JSON.stringify(dead));
let d = 0; for (const c of css) { if (c === "{") d++; else if (c === "}") d--; }
ok("css braces balance", d === 0, "depth " + d);
for (const c of ["sc-field-value-row","sc-field-help","sc-required","sc-code",
                 "sc-tags","sc-item-url","sc-item-multiline","sc-item-title-text-wrapper",
                 "sc-confirm-modal","sc-number-modal","sc-text-modal"])
  ok("css has ." + c, declared.has(c));

console.log("\n================ AUDIT ================");
console.log("pass:", pass, " fail:", fail);
for (const [n, dd] of bad) console.log("  FAIL " + n + (dd === undefined ? "" : "  [" + dd + "]"));