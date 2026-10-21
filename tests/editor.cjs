"use strict";
// Mock of Obsidian's MarkdownEditor (the CodeMirror-backed one) plus a plugin
// instance, so editor-facing commands can be exercised for real.
const fs = require("fs");
const T = require("./paths.cjs").T;

class Editor {
  constructor(text) { this.setValue(text); }
  setValue(t) {
    this.value = t;
    this.sel = { anchor: { line: 0, ch: 0 }, head: { line: 0, ch: 0 } };
  }
  getValue() { return this.value; }
  getLine(n) { return this.value.split("\n")[n] ?? ""; }
  lineCount() { return this.value.split("\n").length; }
  getSelection() {
    const [a, b] = [this.offsetOf(this.sel.anchor), this.offsetOf(this.sel.head)].sort((x, y) => x - y);
    return this.value.slice(a, b);
  }
  setSelection(a, b) { this.sel = { anchor: a, head: b }; }
  setCursor(p, ch) { this.sel = { anchor: { ...p }, head: ch ? { ...p, ch: p.ch + ch } : { ...p } }; }
  getCursor(which = "head") {
    const p = this.sel[which === "from" || which === "anchor" ? "anchor" : "head"];
    return { line: p.line, ch: p.ch };
  }
  listSelections() {
    return [{ anchor: { ...this.sel.anchor }, head: { ...this.sel.head } }];
  }
  offsetOf(pos) {
    const lines = this.value.split("\n");
    let off = 0;
    for (let i = 0; i < pos.line && i < lines.length; i++) off += lines[i].length + 1;
    return off + Math.min(pos.ch, (lines[pos.line] ?? "").length);
  }
  posToOffset(pos) { return this.offsetOf(pos); }
  offsetToPos(offset) {
    const lines = this.value.split("\n");
    let left = offset, line = 0;
    while (line < lines.length - 1 && left > lines[line].length) {
      left -= lines[line].length + 1;
      line++;
    }
    return { line, ch: left };
  }
  replaceRange(replacement, from, to) {
    // Obsidian accepts a Position or an offset for both bounds.
    const a = typeof from === "number" ? from : this.offsetOf(from);
    const b = to === undefined ? a : typeof to === "number" ? to : this.offsetOf(to);
    const lo = Math.min(a, b), hi = Math.max(a, b);
    this.value = this.value.slice(0, lo) + replacement + this.value.slice(hi);
    // Real Obsidian maps the caret through the change and, for a caret that
    // sits exactly on the insertion point, leaves it there — BEFORE the
    // inserted text. That is the bug this suite guards against: a caret that
    // reads as "I went backwards". The mock emulates it so the plugin cannot
    // hide behind mock behaviour; the fix has to be an explicit setCursor.
    const shift = replacement.length - (hi - lo);
    const map = (x) => (x <= lo ? x : x + shift);
    this.sel = {
      anchor: this.offsetToPos(map(this.offsetOf(this.sel.anchor))),
      head: this.offsetToPos(map(this.offsetOf(this.sel.head))),
    };
  }
  replaceSelection(replacement) {
    const [a, b] = [this.offsetOf(this.sel.anchor), this.offsetOf(this.sel.head)].sort((x, y) => x - y);
    this.replaceRange(replacement, a, b);
  }
}

function loadPlugin() {
  const src = fs.readFileSync(require("./paths.cjs").src, "utf8")
    + "\n;module.exports.__Plugin=dt;module.exports.__Q=Q;module.exports.__W=W;module.exports.__R=R;\n";
  fs.writeFileSync(T + "plug.cjs", src);
  for (const k of Object.keys(require.cache)) if (k.endsWith("plug.cjs")) delete require.cache[k];
  return require(T + "plug.cjs");
}
module.exports = { Editor, loadPlugin, T };