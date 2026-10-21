"use strict";
const { Editor, loadPlugin, T } = require("./editor.cjs");
const { __Plugin: Plugin, __Q: Q, __W: W, __R: R } = loadPlugin();

let pass = 0, fail = 0; const bad = [];
const ok = (n, c, d) => { if (c) pass++; else { fail++; bad.push([n, d]); } };
const head = t => console.log("\n### " + t);
const J = (...l) => l.join("\n");
const blockLen = J("```structured-field", "id: new", "label: L", "type: text", "width: 100%", "value: ", "```").length;
const fencesBalanced = s => (s.match(/^```/gm) || []).length % 2 === 0;

const notices = [];
const obsidian = require("./obsidian-stub.cjs");
obsidian.Notice = class { constructor(m) { notices.push(m); } };

function newPlugin() {
  const p = new Plugin({ workspace: {} }, { version: "test" });
  p.settings = {
    templates: [], revealSecretsByDefault: false, showCopyButtons: true,
    copyNotice: true, defaultDirection: "auto", animations: true,
    showEditingControls: true, showDragHandles: true, responsive: true,
    snapGuides: true, debugLogging: false,
  };
  p.saveSettings = async () => {};
  return p;
}
const FIELD = J("```structured-field", "id: a", "label: Name", "type: text", "value: v", "```");
const NEW = J("```structured-field", "id: new", "label: L", "type: text", "width: 100%", "value: ", "```");

head("insertField must not duplicate or destroy the document");
{
  const cases = [
    ["empty note", "", { line: 0, ch: 0 }],
    ["plain text, caret at start", "hello", { line: 0, ch: 0 }],
    ["plain text, caret at end", "hello", { line: 0, ch: 5 }],
    ["single line with newline after", "hello\n", { line: 0, ch: 5 }],
    ["caret in the middle", "a\nb", { line: 1, ch: 1 }],
    ["after a field", FIELD + "\n\ntail", { line: 0, ch: 0 }],
    ["inside a field", FIELD + "\n\ntail", { line: 2, ch: 2 }],
  ];
  for (const [name, doc, cursor] of cases) {
    const ed = new Editor(doc);
    ed.setCursor(cursor);
    const before = ed.getValue();
    const p = newPlugin();
    let threw = null;
    try { p.insertField(ed); } catch (e) { threw = String(e); }
    const after = ed.getValue();
    console.log("  " + name);
    console.log("    before: " + JSON.stringify(before));
    console.log("    after : " + JSON.stringify(after));
    const beforeLines = before.split("\n").filter(l => l !== "");
    ok(name + ": no throw", !threw, threw);
    ok(name + ": no original line lost", beforeLines.every(l => after.includes(l)),
       beforeLines.filter(l => !after.includes(l)).join(" | "));
    ok(name + ": original prose not duplicated", (() => {
      const prose = beforeLines.filter(l => !l.startsWith("```") && !/^(id|label|type|value|width|item)/.test(l));
      return prose.every(l => (after.split("\n").filter(x => x === l).length) <= 1);
    })(), after);
    ok(name + ": growth is bounded", after.length <= before.length + 260,
       after.length + " vs " + before.length);
    ok(name + ": exactly one new block", (after.match(/```structured-field/g) || []).length ===
       (before.match(/```structured-field/g) || []).length + 1, after);
    ok(name + ": field count grew by 1", R(after).length === R(before).length + 1,
       R(after).length + " vs " + R(before).length);
    ok(name + ": fences balanced", fencesBalanced(after), fencesBalanced(after) ? "" : after);
  }
}

head("insertField inside a field appends AFTER it, never splits the fence");
{
  const doc = FIELD + "\n\ntail";
  const ed = new Editor(doc);
  ed.setCursor({ line: 2, ch: 2 });      // inside the fence
  const p = newPlugin();
  p.insertField(ed);
  console.log(JSON.stringify(ed.getValue()));
  const f = R(ed.getValue());
  ok("two intact fields", f.length === 2, f.length);
  ok("first field still parses with its label", f[0].field.label === "Name", f[0].field.label);
  ok("tail text still present", ed.getValue().includes("tail"));
  ok("no unbalanced fences", (ed.getValue().match(/```structured-field/g) || []).length ===
     (ed.getValue().match(/^```$/gm) || []).length - 0, "fence balance");
}

head("insertField never touches a selection");
{
  const doc = "keep me\n\n" + FIELD;
  const ed = new Editor(doc);
  ed.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 7 });  // "keep me" selected
  const p = newPlugin();
  p.insertField(ed);
  console.log(JSON.stringify(ed.getValue()));
  ok("selected text survives", ed.getValue().includes("keep me"), JSON.stringify(ed.getValue()));
  ok("only one copy of the selected text",
     (ed.getValue().match(/keep me/g) || []).length === 1, ed.getValue());
}

head("insertTemplate");
{
  const p = newPlugin();
  const src = J("```structured-field", "id: x", "label: T", "type: text", "value: 1", "```");
  const ed = new Editor("note");
  ed.setCursor({ line: 0, ch: 4 });
  p.insertTemplate(ed, { source: src });
  console.log(JSON.stringify(ed.getValue()));
  ok("template inserted once", (ed.getValue().match(/```structured-field/g) || []).length === 1, ed.getValue());
  ok("note text preserved", ed.getValue().startsWith("note"), JSON.stringify(ed.getValue()));
  ok("template field parses", R(ed.getValue()).length === 1, R(ed.getValue()).length);
  // empty template -> notice, no change
  const ed2 = new Editor("abc");
  ed2.setCursor({ line: 0, ch: 3 });
  notices.length = 0;
  p.insertTemplate(ed2, { source: "   " });
  ok("empty template is rejected", ed2.getValue() === "abc" && notices.length === 1, JSON.stringify([ed2.getValue(), notices]));
}

head("repeated inserts do not accumulate junk");
{
  const ed = new Editor("seed");
  ed.setCursor({ line: 0, ch: 4 });
  const p = newPlugin();
  for (let i = 0; i < 4; i++) p.insertField(ed);
  const v = ed.getValue();
  console.log(v);
  ok("4 inserts -> 4 fields", R(v).length === 4, R(v).length);
  ok("original text intact", v.startsWith("seed"), JSON.stringify(v.slice(0, 30)));
  ok("no long blank-line runs", !/\n{4,}/.test(v), JSON.stringify(v.match(/\n{3,}/g)));
  ok("still parses end to end", Q(v.slice(v.indexOf("```structured-field"),
      v.indexOf("```structured-field") + v.slice(v.indexOf("```structured-field")).indexOf("\n```") + 3) + "\n```") !== null);
}

head("after insertField the caret sits on the line BELOW the new block");
{
  // The user-visible contract, shaped by two rounds of real usage:
  // create a field, and you are typing on the LINE AFTER it.
  //  * a caret ON the closing fence is swallowed by the editor's block widget
  //    and simply disappears — that was the "first field, no caret" report;
  //  * a caret at the seam above reads as "before the field" — that was the
  //    second-field report.
  // Universal structural target: right after the last closing fence + its
  // newline. When the note ends at the block, the closing newline is
  // appended so that line exists at all.
  const afterBlock = (ed) => ed.offsetOf(ed.getCursor());
  const fenceEnd = (v) => v.lastIndexOf("```") + 3;
  const caretLine = (v) => v.lastIndexOf("```") + 4;

  {
    const ed = new Editor("hello");
    ed.setCursor({ line: 0, ch: 5 });
    const p = newPlugin();
    p.insertField(ed);
    const v = ed.getValue();
    const at = afterBlock(ed);
    ok("a caret line is appended below the block", v.endsWith("```\n"),
       JSON.stringify(v.slice(-14)));
    ok("caret on the line below the block", at === caretLine(v) && at === v.length,
       "caret " + at + ", fence end " + fenceEnd(v) + "\n   doc: " + JSON.stringify(v));
  }
  {
    const ed = new Editor("hello\n\nworld");
    ed.setCursor({ line: 0, ch: 5 });
    const p = newPlugin();
    p.insertField(ed);
    const v = ed.getValue();
    const at = afterBlock(ed);
    ok("text below survives untouched", v.endsWith("\n\nworld"), JSON.stringify(v.slice(-14)));
    ok("caret on the line below the block, text below", at === caretLine(v),
       "caret " + at + ", fence end " + fenceEnd(v) + "\n   doc: " + JSON.stringify(v));
  }
  {
    const ed = new Editor("hello");
    ed.setCursor({ line: 0, ch: 3 });    // mid-word
    const p = newPlugin();
    p.insertField(ed);
    const v = ed.getValue();
    const at = afterBlock(ed);
    ok("mid-word caret lands below the block", at === caretLine(v) && at === v.length,
       "caret " + at + ", fence end " + fenceEnd(v) + "\n   doc: " + JSON.stringify(v));
  }
  {
    const ed = new Editor(FIELD + "\n\ntail");
    ed.setCursor({ line: 2, ch: 2 });    // inside the existing field
    const p = newPlugin();
    p.insertField(ed);
    const v = ed.getValue();
    const at = afterBlock(ed);
    ok("caret on the line below the second block", at === caretLine(v),
       "caret " + at + ", fence end " + fenceEnd(v) + "\n   doc: " + JSON.stringify(v));
  }
  {
    const ed = new Editor("keep me\n\n" + FIELD);
    ed.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 7 });
    const sel = ed.getSelection();
    const p = newPlugin();
    p.insertField(ed);
    ok("an active selection is not collapsed", ed.getSelection() === sel,
       JSON.stringify(ed.getSelection()));
  }
  {
    // The deferred re-assert must not fire when the caret it moved to is no
    // longer a plain caret (someone made a selection in between).
    const ed = new Editor("seed");
    ed.setCursor({ line: 0, ch: 4 });
    const p = newPlugin();
    p.insertField(ed);
    ed.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 1 });
    const sel = ed.getSelection();
    p.insertField(ed);                    // second insert: selection active
    ok("selection made between inserts is not collapsed", ed.getSelection() === sel,
       JSON.stringify(ed.getSelection()));
  }
}

console.log("\n================ EDITOR ================");
console.log("pass:", pass, " fail:", fail);
for (const [n, d] of bad) console.log("  FAIL " + n + (d === undefined ? "" : "  [" + d + "]"));
process.exit(fail ? 1 : 0);