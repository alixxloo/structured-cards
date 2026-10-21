"use strict";
// The EDITOR (Live Preview) field drag, swept.
//
// The user reports that dragging a field DOWN in Live Preview always lands short,
// "as though the note had a limit". The reading view was swept first and agreed
// at every one of 141 positions, so the fault is in beginPointerDrag -- a
// different hit-test, driving the same Ct() engine, that no test had ever run.
//
// This suite mocks just enough CodeMirror for beginPointerDrag to run for real:
// a document, line bands, posAtCoords/coordsAtPos, and dispatch. Then it sweeps
// the pointer down a note and reports, position by position, what the line
// promised against what the document became.
const fs = require("fs");
const { src, T } = require("./paths.cjs");
const { JSDOM, VirtualConsole } = require("jsdom");

const js = fs.readFileSync(src, "utf8");

const LINE_H = 20,
  FIELD_H = 50,
  GAP = 20,
  WIDTH = 600;

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

const listenerErrors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => listenerErrors.push(e && (e.detail || e)));

const dom = new JSDOM("<!doctype html><html><body><div id='host'></div></body></html>", {
  pretendToBeVisual: true,
  virtualConsole: vc,
});
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(global, "navigator", { value: dom.window.navigator, configurable: true, writable: true });
for (const k of ["HTMLElement", "Element", "Node", "Event", "CustomEvent", "DOMParser", "NodeFilter"])
  global[k] = dom.window[k];
global.AbortController = dom.window.AbortController;
global.AbortSignal = dom.window.AbortSignal;

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
  detach() { this.remove(); },
  setText(t) { this.textContent = t; return this; },
  show() { this.style.display = ""; },
  hide() { this.style.display = "none"; },
};
for (const [k, fn] of Object.entries(helpers)) {
  Object.defineProperty(dom.window.HTMLElement.prototype, k, { value: fn, writable: true, configurable: true });
  Object.defineProperty(dom.window.Element.prototype, k, { value: fn, writable: true, configurable: true });
}

const obsidian = require("./obsidian-stub.cjs");
const notices = [];
obsidian.setIcon = (el, n) => el.setAttribute("data-icon", n);
obsidian.Notice = class {
  constructor(m) { notices.push(String(m)); }
};
obsidian.Menu = class {
  addItem() { return this; }
  addSeparator() {}
  showAtMouseEvent() {}
  showAtPosition() {}
};
obsidian.TFile = class TFile {
  constructor(path) { this.path = path; }
};
obsidian.TFolder = class TFolder {};

fs.writeFileSync(
  T + "editorindicator.cjs",
  js +
    "\n;module.exports.__PluginClass=dt;module.exports.__R=R;module.exports.__Q=Q;module.exports.__W=W;module.exports.__j=j;\n",
);
for (const k of Object.keys(require.cache)) if (k.endsWith("editorindicator.cjs")) delete require.cache[k];
const { __PluginClass: PluginClass, __R: R, __Q: Q } = require(T + "editorindicator.cjs");

// ---------------------------------------------------------------------------
const NOTE =
  "```structured-field\nid: a\nlabel: Alpha\ntype: text\nwidth: 100%\n```\n\n" +
  "```structured-field\nid: b\nlabel: Beta\ntype: text\nwidth: 100%\n```\n\n" +
  "```structured-field\nid: c\nlabel: Gamma\ntype: text\nwidth: 100%\n```\n";

/**
 * A CodeMirror-shaped view over a plain string.
 *
 * The document is laid out as bands: a field decoration is one band FIELD_H
 * tall, and the blank line between two fields is its own band GAP tall. That is
 * what Live Preview looks like, and the gap bands matter -- a pointer resting in
 * a gap is not over any field, which is one of the branches the drag has to get
 * right.
 */
function makeView(text, host) {
  let cur = text;
  const blocks = R(text);
  const bands = [];
  let top = 0;
  if (blocks[0].from > 0) bands.push({ kind: "gap", from: 0, to: blocks[0].from, top, height: GAP });
  top = bands.length ? GAP : 0;
  blocks.forEach((b, i) => {
    bands.push({ kind: "field", from: b.from, to: b.to, id: b.field.id, top, height: FIELD_H });
    top += FIELD_H;
    const nextFrom = blocks[i + 1] ? blocks[i + 1].from : cur.length;
    if (nextFrom > b.to) {
      bands.push({ kind: "gap", from: b.to, to: nextFrom, top, height: GAP });
      top += GAP;
    }
  });
  const totalH = top;

  const dom = document.createElement("div");
  dom.className = "cm-editor";
  host.appendChild(dom);
  const fieldEls = {};
  for (const b of blocks) {
    const el = document.createElement("div");
    el.className = "structured-cards-root sc-standalone-field";
    el.dataset.scFrom = String(b.from);
    el.dataset.scTo = String(b.to);
    const band = bands.find((x) => x.kind === "field" && x.id === b.field.id);
    el.__box = { left: 0, top: band.top, bottom: band.top + band.height, height: band.height, width: WIDTH, right: WIDTH };
    el.getBoundingClientRect = () => ({ ...el.__box });
    dom.appendChild(el);
    fieldEls[b.field.id] = el;
  }

  const bandAt = (y) => bands.find((x) => y >= x.top && y <= x.top + x.height) || null;
  const posAtY = (y) => {
    const band = bandAt(y);
    if (!band) return cur.length;
    return band.kind === "field" ? Math.floor((band.from + band.to) / 2) : band.from;
  };
  const lineAt = (pos) => {
    let s = cur.lastIndexOf("\n", Math.max(0, pos - 1)) + 1;
    let e = cur.indexOf("\n", pos);
    if (e < 0) e = cur.length;
    return { from: s, to: e, text: cur.slice(s, e) };
  };
  const coordsOfPos = (pos) => {
    const band = bands.find((x) => pos >= x.from && pos <= x.to);
    if (!band) return null;
    return { top: band.top, bottom: band.top + band.height, left: 0, right: WIDTH };
  };

  const scrollDOM = document.createElement("div");
  host.appendChild(scrollDOM);
  const contentDOM = document.createElement("div");
  scrollDOM.appendChild(contentDOM);
  dom.appendChild(contentDOM);
  contentDOM.getBoundingClientRect = () => ({ left: 0, top: 0, bottom: totalH, height: totalH, width: WIDTH, right: WIDTH });
  scrollDOM.getBoundingClientRect = () => ({ left: 0, top: 0, bottom: 2000, height: 2000, width: WIDTH, right: WIDTH });
  Object.defineProperty(scrollDOM, "scrollTop", { value: 0, writable: true });

  const view = {
    dom,
    contentDOM,
    scrollDOM,
    documentTop: 0,
    defaultLineHeight: LINE_H,
    state: {
      get doc() {
        const len = cur.length;
        return {
          length: len,
          toString: () => cur,
          sliceString: (a, b) => cur.slice(a, b),
          lineAt,
          line: (n) => {
            let i = 0;
            for (let k = 1; k < n; k++) i = cur.indexOf("\n", i) + 1;
            return lineAt(i);
          },
        };
      },
    },
    posAtCoords: ({ y }) => posAtY(y),
    coordsAtPos: coordsOfPos,
    lineBlockAt: () => {
      const last = bands[bands.length - 1];
      return { top: last.top, bottom: last.top + last.height };
    },
    dispatch: ({ changes }) => {
      const c = Array.isArray(changes) ? changes[0] : changes;
      cur = cur.slice(0, c.from) + (c.insert || "") + cur.slice(c.to);
    },
  };

  return {
    view,
    fieldEls,
    text: () => cur,
    order: () => R(cur).map((x) => x.field.id),
    bands,
    totalH,
  };
}

async function boot() {
  const app = {
    workspace: { getLeavesOfType: () => [] },
    vault: {
      getAbstractFileByPath: () => null,
      process: async () => {},
      read: async () => "",
    },
  };
  const plugin = new PluginClass(app, { id: "structured-cards", version: "0.1.0" });
  plugin.loadData = async () => null;
  plugin.saveData = async () => {};
  await plugin.loadSettings();
  plugin.settings.showEditingControls = true;
  plugin.settings.showDragHandles = true;
  plugin.settings.snapGuides = false;
  return plugin;
}

const pointer = (type, x, y, id = 1) => {
  const e = new dom.window.Event(type, { bubbles: true, cancelable: true });
  e.pointerId = id;
  e.clientX = x;
  e.clientY = y;
  e.button = 0;
  return e;
};

async function main() {
  // -------------------------------------------------------------------------
  head("the editor drag runs at all");
  {
    const host = document.getElementById("host");
    host.innerHTML = "";
    const w = makeView(NOTE, host);
    const plugin = await boot();
    const src = R(NOTE)[0];
    const el = w.fieldEls.a;
    let thrown = null;
    try {
      plugin.beginPointerDrag(
        pointer("pointerdown", 300, el.__box.top + 6),
        w.view,
        { from: src.from, to: src.to, field: Q(NOTE.slice(src.from, src.to)), source: NOTE.slice(src.from, src.to) },
        el,
      );
    } catch (e) {
      thrown = e;
    }
    ok("beginPointerDrag did not throw", thrown === null, thrown && String(thrown.message || thrown));
    ok("it marked the field as dragging", el.classList.contains("is-dragging"));
    plugin.cancelPointerDrag();
    ok("cancelPointerDrag released it", !el.classList.contains("is-dragging"));
    ok("no error notice", notices.length === 0, notices.join(" | "));
  }

  // -------------------------------------------------------------------------
  head("every downward pointer position agrees with the document");
  {
    const host = document.getElementById("host");
    const results = [];
    const problems = [];

    for (let y = 8; y <= 260; y += 2) {
      host.innerHTML = "";
      const w = makeView(NOTE, host);
      const plugin = await boot();
      const blocks = R(NOTE);
      const me = blocks[0];
      const el = w.fieldEls.a;
      const start = el.__box.top + 6;

      let thrown = null;
      try {
        plugin.beginPointerDrag(
          pointer("pointerdown", 300, start),
          w.view,
          {
            from: me.from, to: me.to,
            field: Q(NOTE.slice(me.from, me.to)),
            source: NOTE.slice(me.from, me.to),
          },
          el,
        );
        for (let k = 8; k <= y; k += 4) {
          dom.window.dispatchEvent(pointer("pointermove", 300, k));
          if (listenerErrors.length) { thrown = listenerErrors.pop(); break; }
        }
      } catch (e) {
        thrown = e;
      }
      if (thrown) {
        problems.push("y=" + y + " threw " + String(thrown.message || thrown));
        break;
      }

      const ph = document.querySelector(".sc-drop-placeholder");
      const line =
        ph && ph.style.display !== "none"
          ? { top: ph.style.top, left: ph.style.left, width: ph.style.width }
          : null;
      dom.window.dispatchEvent(pointer("pointerup", 300, y));
      await new Promise((r) => setImmediate(r));

      // Which field's bottom is the line on?
      let on = "?";
      for (const b of blocks) {
        const bb = w.fieldEls[b.field.id].__box;
        if (line && Math.abs(parseFloat(line.top) - bb.bottom) < 0.51) on = b.field.id;
      }
      results.push({ y, line: !!line, on, order: w.order().join(",") });
      plugin.cancelPointerDrag();
    }

    // The map, printed, because it IS the diagnosis.
    const seen = new Map();
    for (const r of results) {
      const key = (r.line ? "line@" + r.on : "no-line") + " -> " + r.order;
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key).push(r.y);
    }
    console.log("\n  pointer y  ->  outcome");
    for (const [k, ys] of seen)
      console.log("    " + k.padEnd(28) + " y=" + (ys[0] === ys[ys.length - 1] ? ys[0] : ys[0] + ".." + ys[ys.length - 1]) + " (" + ys.length + " positions)");

    ok("no position threw", problems.length === 0, problems[0] || "");
    ok("the sweep exercised the drag", results.length > 100, results.length + " positions");

    // A line on b's bottom edge promises a after b, which is b,a,c.
    const onB = results.filter((r) => r.on === "b");
    const onC = results.filter((r) => r.on === "c");
    ok(
      "a line on b's bottom edge puts a after b",
      onB.length === 0 || onB.every((r) => r.order === "b,a,c"),
      onB.filter((r) => r.order !== "b,a,c").slice(0, 4).map((r) => "y=" + r.y + " gave " + r.order).join("; "),
    );
    ok(
      "a line on c's bottom edge puts a after c",
      onC.length === 0 || onC.every((r) => r.order === "b,c,a"),
      onC.filter((r) => r.order !== "b,c,a").slice(0, 4).map((r) => "y=" + r.y + " gave " + r.order).join("; "),
    );

    // The complaint: a downward drag should be able to reach the bottom.
    const atBottom = results[results.length - 1];
    ok(
      "dragging all the way down reaches the end of the note",
      atBottom.order === "b,c,a",
      "at y=" + atBottom.y + " the document is " + atBottom.order,
    );

    // And the first downward step that offers a line must be the one that moves.
    const moving = results.filter((r) => r.order !== "a,b,c");
    ok("some positions actually move the field", moving.length > 0, "nothing ever moved");

    const sideways = results.filter((r) => r.line && r.on === "?" && r.order !== "a,b,c");
    console.log(
      "\n  positions that moved without a line on a field's edge: " + sideways.length +
      (sideways.length ? " (e.g. y=" + sideways.slice(0, 6).map((r) => r.y).join(",") + " -> " + sideways[0].order + ")" : ""),
    );
  }

  // -------------------------------------------------------------------------
  head("a horizontal drag DOES create a row (the control for the test below)");
  {
    const host = document.getElementById("host");
    host.innerHTML = "";
    const w = makeView(NOTE, host);
    const plugin = await boot();
    const blocks = R(NOTE);
    const me = blocks[0];
    const el = w.fieldEls.a;
    const y = w.fieldEls.b.__box.top + w.fieldEls.b.__box.height / 2;
    plugin.beginPointerDrag(
      pointer("pointerdown", 300, el.__box.top + 6),
      w.view,
      { from: me.from, to: me.to, field: Q(NOTE.slice(me.from, me.to)), source: NOTE.slice(me.from, me.to) },
      el,
    );
    for (const x of [280, 200, 120, 40]) dom.window.dispatchEvent(pointer("pointermove", x, y));
    dom.window.dispatchEvent(pointer("pointerup", 40, y));
    await new Promise((r) => setImmediate(r));
    console.log(
      "\n  CONTROL: sideways drag produced text:\n    " +
        JSON.stringify(w.text()).slice(0, 400),
    );
    ok(
      "a genuinely sideways drag creates a row, so the harness CAN reach 'beside'",
      /\nrow:/.test(w.text()),
      "no row was created, so this harness cannot exercise 'beside' at all: " +
        JSON.stringify(w.text()),
    );
  }

// -------------------------------------------------------------------------
  head("a downward drag never turns sideways because of the pointer's x");
  {
    // The editor's hit-test gates "before" and "after" on the pointer being
    // horizontally inside the target, and falls through to "beside" when it is
    // not. So dragging a field straight down through the right margin -- or any
    // x past a narrow field's right edge -- silently becomes a row join, and the
    // field lands beside the target instead of below it.
    //
    // The reading view guards this with |dx| > |dy|. The editor path has no such
    // test, so this is the behaviour to prove.
    const host = document.getElementById("host");
    const out = [];
    for (const narrow of [false, true]) {
      host.innerHTML = "";
      const w = makeView(NOTE, host);
      if (narrow) for (const el of w.fieldEls && Object.values(w.fieldEls)) el.__box = { ...el.__box, width: 200, right: 200 };
      const plugin = await boot();
      const blocks = R(NOTE);
      const me = blocks[0];
      const el = w.fieldEls.a;
      const start = el.__box.top + 6;
      const x = narrow ? 520 : 300;
      let thrown = null;
      try {
        plugin.beginPointerDrag(
          pointer("pointerdown", x, start),
          w.view,
          { from: me.from, to: me.to, field: Q(NOTE.slice(me.from, me.to)), source: NOTE.slice(me.from, me.to) },
          el,
        );
        // Bands are a:0-50, gap:50-70, b:70-120, gap:120-140, c:140-190.
        // The release has to land INSIDE a field's band, or the hit-test falls
        // through to the text-position branch and this proves nothing.
        // rt = min(16, 50*0.22) = 11, so b's "after" band is y 109..120.
        for (const y of [20, 55, 78, 100, 115]) dom.window.dispatchEvent(pointer("pointermove", x, y));
      } catch (e) {
        thrown = e;
      }
      ok("no throw at x=" + x + " narrow=" + narrow, thrown === null, thrown && String(thrown.message || thrown));
      dom.window.dispatchEvent(pointer("pointerup", x, 115));
      await new Promise((r) => setImmediate(r));
      out.push({ narrow, x, text: w.text(), order: w.order().join(",") });
    }

    const straight = out[0], offset = out[1];
    ok(
      "dragging down at the field's own x moves it below",
      straight.order !== "a,b,c",
      "nothing happened: " + straight.order,
    );
    ok(
      "the SAME drag, just 320px further right, moves it the same way",
      offset.order === straight.order,
      "x=" + straight.x + " gave " + straight.order + " but x=" + offset.x + " gave " + offset.order,
    );
    ok(
      "and no field was dragged into a row by a purely vertical drag",
      !/\nrow:/.test(offset.text),
      "a row was created by a vertical drag: " + JSON.stringify(offset.text.slice(offset.text.indexOf("id: b"))),
    );
  }

  // -------------------------------------------------------------------------
  head("a discarded editor drag says so instead of failing silently");
  {
    // The release checks that the block is unchanged and, if it is not, skips the
    // move with no message at all: the line promised a slot, the user released,
    // and nothing happened. The reading view raises a Notice for exactly this.
    const host = document.getElementById("host");
    host.innerHTML = "";
    const w = makeView(NOTE, host);
    const plugin = await boot();
    const blocks = R(NOTE);
    const me = blocks[0];
    const el = w.fieldEls.a;
    const before = notices.length;
    plugin.beginPointerDrag(
      pointer("pointerdown", 300, el.__box.top + 6),
      w.view,
      { from: me.from, to: me.to, field: Q(NOTE.slice(me.from, me.to)), source: NOTE.slice(me.from, me.to) },
      el,
    );
    // Simulate the note changing underneath the drag, which is one of the two
    // ways the release guard refuses. state.doc is a getter, so the change has to
    // go through dispatch rather than by patching toString.
    for (const y of [20, 55, 78, 100, 115]) dom.window.dispatchEvent(pointer("pointermove", 300, y));
    w.view.dispatch({ changes: { from: 0, to: 0, insert: "x" } });
    dom.window.dispatchEvent(pointer("pointerup", 300, 115));
    await new Promise((r) => setImmediate(r));
    ok(
      "the drag did not write anything",
      w.text() === "x" + NOTE,
      "it moved anyway: " + JSON.stringify(w.text().slice(0, 60)),
    );
    ok(
      "and the user was told why",
      notices.length > before,
      "the line promised a slot, the release did nothing, and no message appeared",
    );
  }

  console.log("\n================ EDITOR LINE ================");
  console.log("pass:", pass, " fail:", fail);
  for (const [n, d] of bad) console.log("  FAIL " + n + (d === undefined || d === "" ? "" : "  [" + d + "]"));
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.log("threw:", (e && (e.stack || e.message)) || e);
  process.exit(1);
});