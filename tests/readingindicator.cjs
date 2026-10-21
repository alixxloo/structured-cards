"use strict";
// What the DROP LINE promises versus what the file ends up containing.
//
// readingdrag.cjs drives hitTestReadingDrop directly, so the 56 assertions
// there cover the decision. They cannot cover the drawing: the line is painted
// by a different function, further down the pointermove handler, and that call
// site had never been executed by any test. The gap let a call-type mismatch
// through -- the handler handed the painter a DOMRect where it expected an
// element -- which throws, so the line never moved while the field still did.
//
// This suite drives the whole chain: pointerdown, pointermove, the placeholder's
// own style, pointerup, and the text that comes back out of vault.process.
const fs = require("fs");
const { src, T } = require("./paths.cjs");
const { JSDOM, VirtualConsole } = require("jsdom");

const js = fs.readFileSync(src, "utf8");

const SHELL_H = 60,
  PAD = 8,
  PITCH = SHELL_H + PAD * 2;
const bx = (top) => ({
  left: 0,
  top: top - PAD,
  bottom: top + SHELL_H + PAD,
  height: SHELL_H + PAD * 2,
  width: 600,
  right: 600,
});

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

// ---------------------------------------------------------------------------
// jsdom does not rethrow an exception thrown inside an event listener: it hands
// it to the virtual console and carries on. So a plain try/catch around
// dispatchEvent sees nothing, and a drag that dies mid-move looks like a drag
// that merely forgot to draw. Capture the console instead.
const listenerErrors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => listenerErrors.push(e && (e.detail || e)));
vc.on("error", (...a) => listenerErrors.push(a.join(" ")));

const dom = new JSDOM("<!doctype html><html><body><div id='host'></div></body></html>", {
  pretendToBeVisual: true,
  virtualConsole: vc,
});
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(global, "navigator", { value: dom.window.navigator, configurable: true, writable: true });
for (const k of ["HTMLElement", "Element", "Node", "Event", "CustomEvent", "DOMParser", "NodeFilter", "KeyboardEvent"])
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
obsidian.setIcon = (el, n) => el.setAttribute("data-icon", n);
obsidian.Notice = class {
  constructor(m) { notices.push(String(m)); }
};
const notices = [];
obsidian.Menu = class {
  addItem() { return this; }
  addSeparator() {}
  showAtMouseEvent() {}
  showAtPosition() {}
};
obsidian.TFile = class TFile {
  constructor(path) { this.path = path; this.extension = "md"; }
};
obsidian.TFolder = class TFolder {};

fs.writeFileSync(
  T + "readingindicator.cjs",
  js +
    "\n;module.exports.__PluginClass=dt;module.exports.__Ct=Ct;" +
    "module.exports.__R=R;module.exports.__W=W;\n",
);
for (const k of Object.keys(require.cache)) if (k.endsWith("readingindicator.cjs")) delete require.cache[k];
const { __PluginClass: PluginClass, __Ct: Ct, __R: R } = require(T + "readingindicator.cjs");

// ---------------------------------------------------------------------------
// A note with three fields, so a downward drag has somewhere real to land.
function note() {
  return (
    "# Note\n\n" +
    "```structured-field\nid: a\nlabel: Alpha\ntype: text\nwidth: 100%\n```\n\n" +
    "```structured-field\nid: b\nlabel: Beta\ntype: text\nwidth: 100%\n```\n\n" +
    "```structured-field\nid: c\nlabel: Gamma\ntype: text\nwidth: 100%\n```\n"
  );
}

function boot(text) {
  let file = text;
  const applied = [];
  const app = {
    workspace: { getLeavesOfType: () => [] },
    vault: {
      getAbstractFileByPath: () => fileObj,
      process: async (f, fn) => {
        const next = fn(file);
        applied.push({ before: file, after: next });
        if (next !== file) file = next;
      },
      read: async () => file,
    },
  };
  const fileObj = new obsidian.TFile("note.md");
  const plugin = new PluginClass(app, { id: "structured-cards", version: "0.1.0" });
  plugin.loadData = async () => null;
  plugin.saveData = async () => {};
  return {
    plugin,
    applied,
    fileObj,
    text: () => file,
    order: () => R(file).map((c) => c.field.id),
  };
}

/** The reading view: a sizer holding three field elements with real rects. */
function makeView() {
  const sizer = document.createElement("div");
  sizer.className = "markdown-preview-sizer markdown-preview-section";
  document.getElementById("host").appendChild(sizer);
  const els = ["a", "b", "c"].map((id, i) => {
    const el = document.createElement("div");
    el.className = "structured-cards-root sc-standalone-field";
    el.dataset.fieldId = id;
    el.__rect = bx(i * PITCH);
    sizer.appendChild(el);
    return el;
  });
  // A real DOMRect carries coordinates and nothing else. In particular it has no
  // getBoundingClientRect, which is exactly the trap this suite exists to catch.
  for (const el of sizer.children)
    el.getBoundingClientRect = () => {
      const r = el.__rect;
      return { ...r, x: r.left, y: r.top, toJSON: () => ({ ...r }) };
    };
  sizer.getBoundingClientRect = () => ({
    left: 0, top: -PAD, bottom: bx(3 * PITCH).bottom, width: 600, height: 900, right: 600,
  });
  return { sizer, els };
}

const pointer = (type, x, y, id = 1) => {
  const e = new dom.window.Event(type, { bubbles: true, cancelable: true });
  e.pointerId = id;
  e.clientX = x;
  e.clientY = y;
  e.button = 0;
  return e;
};

/** Run a whole drag and report what the line said and what the file did. */
async function drag(fieldIndex, dy, view, sourceText) {
  const { plugin, applied, order, text } = boot(sourceText || note());
  await plugin.loadSettings();
  plugin.settings.showEditingControls = true;
  plugin.settings.showDragHandles = true;
  plugin.settings.snapGuides = false;

  const root = view.els[fieldIndex];
  const r = root.getBoundingClientRect();
  const grab = { clientX: 300, clientY: r.top + 10, pointerId: 1 };

  let thrown = null;
  await plugin.beginReadingDrag(pointer("pointerdown", grab.clientX, grab.clientY), {
    sourcePath: "note.md",
  }, { id: root.dataset.fieldId }, root);

  // Every pointermove is observed. An exception inside a listener does not
  // surface at dispatchEvent, so both the local guard and the jsdom console are
  // watched; a throw in any single move is the defect.
  let lastLine = null;
  const move = (y) => {
    const before = listenerErrors.length;
    try {
      dom.window.dispatchEvent(pointer("pointermove", 300, y));
    } catch (e) {
      thrown = thrown || e;
    }
    if (listenerErrors.length > before && !thrown)
      thrown = listenerErrors[listenerErrors.length - 1];
    const ph = document.querySelector(".sc-drop-placeholder");
    if (ph && ph.style.display !== "none")
      lastLine = { top: ph.style.top, left: ph.style.left, width: ph.style.width };
    else lastLine = null;
  };

  move(grab.clientY);
  for (const step of [2, 5, 8, 12, 20, 40, 60, dy]) move(grab.clientY + step);
  const lineAtDrop = lastLine;

  dom.window.dispatchEvent(pointer("pointerup", 300, grab.clientY + dy));
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));

  return { thrown, lineAtDrop, applied, order: order(), text: text() };
}

// ---------------------------------------------------------------------------
async function main() {
  head("the line survives being drawn at all");
  {
    const view = makeView();
    const out = await drag(0, 30, view);
    ok(
      "no pointermove threw",
      out.thrown === null,
      out.thrown && (out.thrown.name + ": " + out.thrown.message),
    );
    ok(
      "a line was actually drawn",
      !!out.lineAtDrop,
      "the placeholder was never shown, so the field moved with nothing promising where",
    );
  }

  head("the line is where the field actually goes");
  {
    const view = makeView();
    const out = await drag(0, 30, view);
    ok("the field actually moved", out.order[0] === "b", out.order.join(","));
    ok("it moved below b, not above", out.order.indexOf("a") === 1, out.order.join(","));

    // The line promises a slot; the file must fill that slot. Compare against the
    // geometry rather than a literal, so the two cannot drift apart unnoticed.
    const bBottom = bx(PITCH).bottom;
    const lineTop = out.lineAtDrop ? parseFloat(out.lineAtDrop.top) : NaN;
    ok(
      "the line sits at the bottom edge of the field it names",
      Math.abs(lineTop - bBottom) < 0.51,
      "line top " + lineTop + " vs b bottom " + bBottom,
    );
    ok(
      "the line spans the target's width",
      !!out.lineAtDrop && Math.abs(parseFloat(out.lineAtDrop.width) - 600) < 0.51,
      out.lineAtDrop && out.lineAtDrop.width,
    );
  }

  head("the same agreement holds for every downward step");
  {
    for (const dy of [6, 14, 30, PITCH + 4, PITCH * 2 + 4]) {
      const view = makeView();
      const out = await drag(0, dy, view);
      const want = dy >= PITCH + 4 ? "c" : "b";
      ok(
        "dy=" + dy + ": no throw",
        out.thrown === null,
        out.thrown && (out.thrown.name + ": " + out.thrown.message),
      );
      ok("dy=" + dy + ": a line was drawn", !!out.lineAtDrop, "no line");
      ok(
        "dy=" + dy + ": the field lands below " + want,
        out.order.indexOf("a") === out.order.indexOf(want) + 1,
        "order " + out.order.join(",") + " expected a after " + want,
      );
      if (out.lineAtDrop) {
        const targetTop = want === "b" ? bx(PITCH).top - PAD : bx(PITCH * 2).top - PAD;
        ok(
          "dy=" + dy + ": the line is on that field's edge",
          Math.abs(parseFloat(out.lineAtDrop.top) - bx(want === "b" ? PITCH : PITCH * 2).bottom) < 0.51,
          "line " + out.lineAtDrop.top,
        );
        void targetTop;
      }
    }
  }

  head("a drag that means nothing draws nothing, and says so");
  {
    const view = makeView();
    const out = await drag(2, 5, view); // the last field, barely moved
    ok("no throw", out.thrown === null, out.thrown && out.thrown.message);
    ok("nothing was written", out.applied.length === 0, out.applied.length + " write(s)");
    ok("the order is untouched", out.order.join(",") === "a,b,c", out.order.join(","));
  }

  head("the line and the file agree on the field's final position");
  {
    // The strongest form of the complaint: read the slot off the line, then read
    // the file, and require that the field really did land in that slot.
    const view = makeView();
    const out = await drag(0, 30, view);
    const ids = out.order;
    const lineField = bx(PITCH); // the field the line was drawn against
    ok(
      "the field occupies the slot the line was drawn in",
      ids[1] === "a" && lineField.bottom === bx(PITCH).bottom,
      "order " + ids.join(",") + ", line on b",
    );
    ok("no error Notice was raised", notices.length === 0, notices.join(" | "));
  }

head("a row target is drawn at the row, because that is where it lands");
  {
    // Ct() puts a block dropped on a row member at the edge of the WHOLE row and
    // joins it to that row. Drawing the line against the individual member would
    // promise a slot the write does not take -- the same disagreement, moved.
    const rowNote =
      "# Note\n\n" +
      "```structured-field\nid: a\nlabel: Alpha\ntype: text\nwidth: 100%\n```\n\n" +
      "```structured-field\nid: b\nlabel: Beta\ntype: text\nwidth: 100%\nrow: row-1\n```\n\n" +
      "```structured-field\nid: c\nlabel: Gamma\ntype: text\nwidth: 100%\nrow: row-1\n```\n";

    const sizer = document.createElement("div");
    sizer.className = "markdown-preview-sizer markdown-preview-section";
    document.getElementById("host").appendChild(sizer);
    const el = (cls, r) => {
      const d = document.createElement("div");
      d.className = cls;
      d.__rect = r;
      d.getBoundingClientRect = () => ({ ...d.__rect, x: d.__rect.left, y: d.__rect.top });
      sizer.appendChild(d);
      return d;
    };
    const a = el("structured-cards-root sc-standalone-field", bx(0));
    a.dataset.fieldId = "a";
    const rowEl = el("sc-field-row", { ...bx(PITCH), left: 0, right: 600 });
    const member = (id, left) => {
      const d = document.createElement("div");
      d.className = "structured-cards-root sc-standalone-field";
      d.dataset.fieldId = id;
      d.__rect = {
        left, right: left + 300, top: bx(PITCH).top, bottom: bx(PITCH).bottom,
        height: bx(PITCH).height, width: 300,
      };
      d.getBoundingClientRect = () => ({ ...d.__rect });
      rowEl.appendChild(d);
      return d;
    };
    const b = member("b", 0);
    const c = member("c", 300);
    sizer.getBoundingClientRect = () => ({
      left: 0, top: -PAD, bottom: bx(PITCH * 2).bottom, width: 600, height: 900, right: 600,
    });

    const out = await drag(0, 30, { sizer, els: [a, b, c] }, rowNote);
    ok("no throw", out.thrown === null, out.thrown && String(out.thrown.message || out.thrown));
    ok("a line was drawn", !!out.lineAtDrop, "no line");

    const rowBottom = bx(PITCH).bottom;
    ok(
      "the line is on the row's edge, not on member b's",
      out.lineAtDrop && Math.abs(parseFloat(out.lineAtDrop.top) - rowBottom) < 0.51,
      "line " + (out.lineAtDrop && out.lineAtDrop.top) + " vs row bottom " + rowBottom,
    );
    ok("a landed after the whole row", out.order.join(",") === "b,c,a", out.order.join(","));
    ok(
      "a joined that row",
      /row:\s*row-1/.test(out.text.split("id: a")[1] || ""),
      "the moved field did not join the row it was dropped on",
    );

head("every pointer position agrees with the file");
  {
    // The complaint: going down, the field lands short -- as though the note
    // puts a wall in the way. Rather than guess where, sweep the pointer down
    // a field at a time and require the invariant at EVERY position: the line's
    // top is the bottom edge of a real field, and the file is the original with
    // the dragged field placed immediately after that field.
    //
    // The note has text around and between the fields, which is what a real note
    // looks like and what the earlier fixtures left out.
    const sweepNote =
      "# Title\n\nIntro paragraph.\n\n" +
      "```structured-field\nid: a\nlabel: Alpha\ntype: text\nwidth: 100%\n```\n\n" +
      "A paragraph between the fields.\n\n" +
      "```structured-field\nid: b\nlabel: Beta\ntype: text\nwidth: 100%\n```\n\n" +
      "```structured-field\nid: c\nlabel: Gamma\ntype: text\nwidth: 100%\n```\n\n" +
      "Outro paragraph.\n";

    // a, a paragraph, b, c, and a trailing paragraph.
    const TOPS = { a: 0, b: 200, c: 320, tail: 460 };
    const sizer = document.createElement("div");
    sizer.className = "markdown-preview-sizer markdown-preview-section";
    document.getElementById("host").appendChild(sizer);
    const push = (cls, fieldId, top, height) => {
      const d = document.createElement("div");
      d.className = cls;
      if (fieldId) d.dataset.fieldId = fieldId;
      d.__rect = { left: 0, top, bottom: top + height, width: 600, height, right: 600 };
      d.getBoundingClientRect = () => ({ ...d.__rect });
      sizer.appendChild(d);
      return d;
    };
    const a = push("structured-cards-root sc-standalone-field", "a", TOPS.a, 50);
    push("el-p", null, TOPS.a + 60, 20);
    const b = push("structured-cards-root sc-standalone-field", "b", TOPS.b, 50);
    const c = push("structured-cards-root sc-standalone-field", "c", TOPS.c, 50);
    push("el-p", null, TOPS.tail, 20);
    sizer.getBoundingClientRect = () => ({
      left: 0, top: 0, bottom: 500, width: 600, height: 500, right: 600,
    });
    const view = { sizer, els: [a, b, c] };

    const bottoms = { a: TOPS.a + 50, b: TOPS.b + 50, c: TOPS.c + 50 };
    // The note starts as a,b,c. A line on b's bottom edge means "a goes
    // straight after b", which is b,a,c. A line on c's bottom edge means
    // b,c,a. Anything else is a line the drag should never have drawn.
    const expected = (lineTop) => {
      const hit = ["b", "c"].find((id) => Math.abs(lineTop - bottoms[id]) < 0.51);
      return hit === "b" ? "b,a,c" : hit === "c" ? "b,c,a" : null;
    };

    let checked = 0;
    const mismatches = [];
    const unseen = [];
    for (let dy = 0; dy <= 560; dy += 4) {
      const out = await drag(0, dy, view, sweepNote);
      if (out.thrown) {
        mismatches.push("dy=" + dy + " threw " + String(out.thrown.message || out.thrown));
        break;
      }
      if (!out.lineAtDrop) {
        // Only acceptable before the field has moved at all.
        if (out.order.join(",") !== "a,b,c")
          mismatches.push("dy=" + dy + " no line, yet the order became " + out.order.join(","));
        continue;
      }
      checked++;
      const lineTop = parseFloat(out.lineAtDrop.top);
      const want = expected(lineTop);
      if (want === null) unseen.push("dy=" + dy + " line top " + lineTop);
      else if (out.order.join(",") !== want)
        mismatches.push(
          "dy=" + dy + ": line at " + lineTop + " (bottom of " +
          (["a", "b", "c"].find((x) => Math.abs(lineTop - bottoms[x]) < 0.51) || "?") +
          ") but the file is " + out.order.join(","),
        );
    }

    ok("no position throws", mismatches.every((m) => !m.includes("threw")), mismatches[0] || "");
    ok(
      "every line the drag drew matches the file it produced",
      mismatches.length === 0,
      mismatches.length + " mismatch(es):\n        " + mismatches.slice(0, 6).join("\n        "),
    );
    ok("the sweep actually exercised the drag", checked > 20, checked + " positions with a line");
    ok(
      "every line landed on a real edge",
      unseen.length === 0,
      unseen.length + " unexplained line position(s): " + unseen.slice(0, 5).join("; "),
    );

    // And the shape the complaint describes: the field must be able to reach the
    // very bottom, with no position that stops it short.
    const last = await drag(0, 600, view, sweepNote);
    ok(
      "the field can reach the bottom of the note",
      last.order.join(",") === "b,c,a",
      "at the bottom of the note the file is " + last.order.join(","),
    );
  }
  }

console.log("\n================ READING LINE ================");
console.log("pass:", pass, " fail:", fail);
for (const [n, d] of bad) console.log("  FAIL " + n + (d === undefined || d === "" ? "" : "  [" + d + "]"));
process.exit(fail ? 1 : 0);}

main().catch((e) => {
  console.log("threw:", (e && (e.stack || e.message)) || e);
  process.exit(1);
});


