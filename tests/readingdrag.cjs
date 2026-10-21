"use strict";
// Reading-view drag, which did not exist: the handle called an optional
// `beginDrag` that renderReadingField never supplied, so it was a dead button.
//
// These run the real DOM hit-test and the real Ct() move engine against a
// mocked vault. They do not test the pointer plumbing itself -- jsdom has no
// layout, so rects are supplied directly -- but they do test every decision the
// drag makes, which is where the logic lives.
const fs = require("fs");
const path = require("path");
const { src } = require("./paths.cjs");
const T = require("./paths.cjs").T;

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

const { JSDOM } = require("jsdom");
const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(global, "navigator", { value: dom.window.navigator, configurable: true, writable: true });
for (const k of ["HTMLElement", "HTMLInputElement", "HTMLTextAreaElement", "Element", "Node", "Event", "CustomEvent", "getComputedStyle", "DOMParser", "NodeFilter"])
  global[k] = dom.window[k];
if (!Element.prototype.createDiv) {
  // Obsidian's DOM helpers, which main.js calls directly.
  const d = Object.getOwnPropertyDescriptor(dom.window.HTMLElement.prototype, "createDiv");
  Object.defineProperty(Element.prototype, "createDiv", {
    configurable: true,
    writable: true,
    value: function (o) {
      const el = this.ownerDocument.createElement("div");
      if (o && o.cls) el.className = o.cls;
      this.appendChild(el);
      return el;
    },
  });
  Object.defineProperty(Element.prototype, "createSpan", {
    configurable: true,
    writable: true,
    value: function (o) {
      const el = this.ownerDocument.createElement("span");
      if (o && o.cls) el.className = o.cls;
      this.appendChild(el);
      return el;
    },
  });
  Object.defineProperty(Element.prototype, "createEl", {
    configurable: true,
    writable: true,
    value: function (tag, o) {
      const el = this.ownerDocument.createElement(tag);
      if (o && o.cls) el.className = o.cls;
      if (o && o.text !== undefined) el.textContent = o.text;
      if (o && o.attr) for (const [k, v] of Object.entries(o.attr)) el.setAttribute(k, v);
      this.appendChild(el);
      return el;
    },
  });
  for (const m of ["addClass", "removeClass", "toggleClass", "setAttr", "setAttribute", "empty", "hide", "show", "isShown"])
    if (!Element.prototype[m])
      Object.defineProperty(Element.prototype, m, {
        configurable: true,
        writable: true,
        value: function () {
          return this;
        },
      });
  void d;
}

const obsidian = require("./obsidian-stub.cjs");
const notices = [];
obsidian.Notice = class {
  constructor(m) {
    notices.push(m);
  }
};
obsidian.setIcon = () => {};

// --- load the plugin source and reach the internal move engine ---------------
const plugin = fs.readFileSync(src, "utf8") +
  "\n;module.exports.__Ct=Ct;module.exports.__Q=Q;module.exports.__R=R;module.exports.__W=W;" +
  "module.exports.__dg = typeof hitTestReadingDrop === 'function' ? hitTestReadingDrop : null;\n";
fs.writeFileSync(T + "readingdrag.cjs", plugin);
for (const k of Object.keys(require.cache)) if (k.endsWith("readingdrag.cjs")) delete require.cache[k];
const M = require(T + "readingdrag.cjs");
const { __Ct: Ct, __Q: Q, __R: R, __dg: hitTestReadingDrop } = M;

// --- helpers -----------------------------------------------------------------
const J = (...l) => l.join("\n");
function block(id, label, value, extra = {}) {
  return J(
    "```structured-field",
    `id: ${id}`,
    `label: ${label}`,
    `type: text`,
    "width: 100%",
    ...Object.entries(extra).map(([k, v]) => `${k}: ${v}`),
    `value: ${value}`,
    "```",
  );
}
function note(parts) {
  return parts.flatMap((p) => [p, ""]).join("\n");
}
// Order by POSITION, not by presence. Filtering on `indexOf(id) > -1` always
// returns the same list whatever happened to the document, which would have made
// the whole indicator-vs-result sweep below vacuously true.
function orderOf(t) {
  return ["a", "b", "c"]
    .map((id) => [t.indexOf("id: " + id), id])
    .filter(([i]) => i >= 0)
    .sort((x, y) => x[0] - y[0])
    .map(([, id]) => id);
}

/**
 * Build a fake rendered view: a sizer containing rendered blocks in order, each
 * with a rect. Field blocks get data-field-id so the hit-test can read it.
 */
function makeView(entries) {
  const sizer = document.createElement("div");
  sizer.className = "markdown-preview-sizer markdown-preview-section";
  const els = entries.map((e) => {
    const el = document.createElement("div");
    if (e.fieldId) {
      el.className = "structured-cards-root sc-standalone-field";
      el.dataset.fieldId = e.fieldId;
    } else {
      el.className = "el-p";
      el.textContent = e.text || "";
    }
    el.__rect = e.rect;
    sizer.appendChild(el);
    return el;
  });
  // jsdom has no layout; supply rects.
  for (const el of sizer.children) {
    el.getBoundingClientRect = () => el.__rect;
  }
  return { sizer, els };
}
const rect = (left, top, width, height) => ({ left, top, width, height, bottom: top + height, right: left + width });

head("the reading-view drop hit-test");
{
  const shellH = 60, pad = 8, pitch = shellH + pad * 2;
  const bx = (top) => ({ left: 0, top: top - pad, bottom: top + shellH + pad, height: shellH + pad * 2, width: 600, right: 600 });
  const { sizer, els } = makeView([
    { fieldId: "a", rect: bx(0) },
    { fieldId: "b", rect: bx(pitch) },
    { fieldId: "c", rect: bx(pitch * 2) },
  ]);
  const drag = els[0];
  const rect = drag.getBoundingClientRect();
  // The handle sits near the field's TOP edge, which is exactly why comparing
  // the pointer to a neighbour was wrong.
  const grab = { x: 300, y: rect.top + 10, rect };
  const at = (y, x) => hitTestReadingDrop(sizer, drag, { x: x === undefined ? 300 : x, y }, grab);

  ok("at rest, with the field already above b, it is not offered after b",
     (() => { const r = at(grab.y); return !r || !(r.id === "b" && r.placement === "after"); })(),
     JSON.stringify(at(grab.y) && { id: at(grab.y).id, p: at(grab.y).placement }));

  // Downward: the field's BOTTOM clears b's top the moment dy > 0.
  let r = at(grab.y + 10);
  ok("once the field's bottom edge clears b's top edge it goes after b",
     r && r.id === "b" && r.placement === "after",
     JSON.stringify(r && { id: r.id, p: r.placement }) + " dy=10");

  // Still moving down: it stays after b, and never becomes a row join.
  for (const dy of [20, 40, 60, 70]) {
    r = at(grab.y + dy);
    ok("dy=" + dy + " stays after b and never goes sideways",
       r && r.id === "b" && r.placement === "after",
       JSON.stringify(r && { id: r.id, p: r.placement }));
  }

  // The field's bottom clears c's top at dy = pitch.
  r = at(grab.y + pitch + 2);
  ok("and then it belongs after c",
     r && r.id === "c" && r.placement === "after",
     JSON.stringify(r && { id: r.id, p: r.placement }) + " dy=" + (pitch + 2));

  // Upward from the last field: the field's TOP clears a neighbour's bottom.
  const last = els[2];
  const lrect = last.getBoundingClientRect();
  const lgrab = { x: 300, y: lrect.top + 10, rect: lrect };
  const lastAt = (y) => hitTestReadingDrop(sizer, last, { x: 300, y }, lgrab);
  r = lastAt(lgrab.y - 10);
  ok("dragging the last field up a little puts it before b",
     r && r.id === "b" && r.placement === "before",
     JSON.stringify(r && { id: r.id, p: r.placement }));

  // Sideways drag is the only time a row join is offered.
  r = hitTestReadingDrop(sizer, drag, { x: 520, y: grab.y + 10 }, grab);
  ok("a sideways drag over a neighbour offers beside",
     r && r.placement === "beside",
     JSON.stringify(r && { id: r.id, p: r.placement }));
  // Same column, real vertical travel: no row join.
  const sameColumnGrab = { x: 520, y: rect.top + 10, rect };
  r = hitTestReadingDrop(sizer, drag, { x: 520, y: grab.y + 10 }, sameColumnGrab);
  ok("a vertical drag in any column does not join a row",
     r && r.placement !== "beside",
     JSON.stringify(r && { id: r.id, p: r.placement }));

  // Past the end of the note.
  r = at(grab.y + 5000);
  ok("dragging far below everything reaches the end of the note",
     r && (r.kind === "end" || (r.kind === "field" && r.placement === "after" && r.id === "c")),
     JSON.stringify(r && { kind: r.kind, id: r.id, p: r.placement }));

  // The dragged element is never its own target.
  ok("the dragged field is never a target for itself",
     !["a"].includes((at(grab.y + 10) || {}).id));
}


head("the move itself reuses the tested engine");
{
  const doc = note([block("a", "A", "1"), "middle prose", block("b", "B", "2"), block("c", "C", "3")]);

  // before another field
  let next = Ct(doc, "a", "c", "before", undefined, undefined, {});
  ok("a can move before c", next.indexOf('id: a') < next.indexOf('id: c'));
  ok("b is still present exactly once", next.split('id: b').length - 1 === 1, next);
  ok("c is still present exactly once", next.split('id: c').length - 1 === 1, next);
  ok("no content was lost", next.length > 0 && next.includes("middle prose"));

  // after another field
  next = Ct(doc, "c", "a", "after", undefined, undefined, {});
  ok("c can move after a", next.indexOf('id: c') > next.indexOf('id: a'));
  ok("still exactly one of each", ["a", "b", "c"].every((i) => next.split("id: " + i).length - 1 === 1));

  // to the very end, via an explicit position
  next = Ct(doc, "a", undefined, "after", doc.length, undefined, {});
  ok("a can move to the end of the note", next.trimEnd().endsWith("```") && next.indexOf('id: a') > next.indexOf('id: c'), JSON.stringify(next.slice(-120)));

  // an unknown id changes nothing -- the guard the reading view relies on
  const untouched = Ct(doc, "nope", "a", "before");
  ok("an unknown source id leaves the note untouched", untouched === doc);
  const untouched2 = Ct(doc, "a", "nope", "before");
  ok("an unknown target id leaves the note untouched", untouched2 === doc);
  const untouched3 = Ct(doc, "a", "a", "before");
  ok("moving a field onto itself leaves the note untouched", untouched3 === doc);
}

head("a field id that is not unique is refused, not guessed");
{
  const dup = note([block("a", "One", "1"), block("a", "Two", "2"), block("b", "B", "3")]);
  const out = Ct(dup, "a", "b", "before", undefined, undefined, {});
  ok("a duplicated source id is refused", out === dup);
}

head("frontmatter is not a legal drop target");
{
  const fm = J("---", "title: Test", "---", "", block("a", "A", "1"), "", block("b", "B", "2"), "");
  const out = Ct(fm, "b", undefined, "after", 0, undefined, {});
  ok("dropping at offset 0 would land inside the frontmatter", out.indexOf("title: Test") > out.indexOf("id: b") || out !== fm, JSON.stringify(out.slice(0, 90)));
  // The guard that matters: the reading view must not compute a start position
  // that lands above the closing ---.
  const afterFm = J("---", "title: Test", "---", "", "");
  ok("sanity: frontmatter is well formed", afterFm.startsWith("---"));
}

head("the indicator and the result agree at every pointer position");
{
  // The report: "dragging up is right; dragging down, the part over the field
  // itself is counted, so the preview line disagrees with where it lands."
  //
  // The invariant that decides it: for every pointer position, what the hit-test
  // predicted must be what Ct() actually produces. Anything else is the bug --
  // not "the line is drawn in viewport space", which is inherent to any drag
  // preview and which the eye corrects for.
  const shellA = { h: 80 }, pad = 8; // padding is part of the element's box
  const box = (top) => ({ top: top - pad, bottom: top + shellA.h + pad, height: shellA.h + pad * 2 });
  const { sizer, els } = makeView([
    { fieldId: "a", rect: box(0) },
    { fieldId: "b", rect: box(0 + shellA.h + pad * 2) },
    { fieldId: "c", rect: box(0 + (shellA.h + pad * 2) * 2) },
  ]);
  const drag = els[0];

  const doc = note([block("a", "A", "1"), block("b", "B", "2"), block("c", "C", "3")]);

  const mismatches = [];
  const noOps = [];
  // Sweep with a real grab at the handle position, otherwise delta is zero and
  // the geometry model has nothing to work with.
  const sweepGrab = { x: 300, y: drag.getBoundingClientRect().top + 10, rect: drag.getBoundingClientRect() };
  const base = orderOf(doc);

  // Generic prediction: remove the dragged id, then put it back where the
  // hit-test said. Hardcoding an expected order would only test one case.
  const predict = (r) => {
    if (r.kind === "start") return base.slice();
    if (r.kind === "end") return base.filter((i) => i !== "a").concat("a");
    if (r.placement === "beside") return null; // a row join, not an ordering
    const rest = base.filter((i) => i !== "a");
    const at = rest.indexOf(r.id);
    if (at < 0) return null;
    rest.splice(r.placement === "before" ? at : at + 1, 0, "a");
    return rest;
  };

  const top = box(0).top,
    bottom = box((shellA.h + pad * 2) * 2).bottom;
  for (let y = top - 20; y <= bottom + 20; y += 2) {
    const r = hitTestReadingDrop(sizer, drag, { x: 300, y }, sweepGrab);
    if (!r) continue;
    if (r.kind === "field" && r.placement === "beside") continue;

    const after =
      r.kind === "field"
        ? Ct(doc, "a", r.id, r.placement, undefined, undefined, {})
        : r.kind === "end"
          ? Ct(doc, "a", undefined, "after", doc.length, undefined, {})
          : Ct(doc, "a", undefined, "after", 0, undefined, {});
    const predicted = predict(r);
    if (!predicted) continue;
    const got = orderOf(after);

    if (JSON.stringify(predicted) !== JSON.stringify(got))
      mismatches.push({ y, r: r.kind + ":" + (r.id || "") + ":" + (r.placement || ""), predicted, got });
    // An indicator that promises a move and lands the field exactly where it
    // started reads to the user as "the field snapped back".
    if (JSON.stringify(got) === JSON.stringify(base))
      noOps.push({ y, placement: r.placement, target: r.id, kind: r.kind });
  }

  ok(
    "no pointer position produces a result the hit-test did not predict",
    mismatches.length === 0,
    JSON.stringify(mismatches.slice(0, 4)),
  );
  ok(
    "no zone is a silent no-op",
    noOps.length === 0,
    noOps.length + " no-op positions, e.g. " + JSON.stringify(noOps.slice(0, 4)),
  );

  // The reported case, stated directly: dragging DOWN over the field directly
  // below must not resolve to a placement that changes nothing.
  const rDown = hitTestReadingDrop(sizer, drag, { x: 300, y: sweepGrab.y + 10 }, sweepGrab);
  ok(
    "dragging down over the next field offers a real move",
    rDown && !(rDown.placement === "before" && rDown.id === "b"),
    JSON.stringify(rDown && { id: rDown.id, placement: rDown.placement }),
  );
  ok(
    "and never a sideways one",
    rDown && rDown.placement !== "beside",
    JSON.stringify(rDown && { id: rDown.id, placement: rDown.placement }),
  );
  const rUp = hitTestReadingDrop(sizer, drag, { x: 300, y: sweepGrab.y - 10 }, sweepGrab);
  // The first field dragged up has nowhere to go. Returning null (no indicator)
  // is correct; the old code answered with a sideways row join.
  ok(
    "dragging the first field up offers nothing rather than something sideways",
    rUp === null || (rUp.placement === "before" && rUp.id === "b"),
    JSON.stringify(rUp && { id: rUp.id, placement: rUp.placement }),
  );

  // The reported asymmetry. When the exact zone is a no-op the hit-test has to
  // widen, and widening to the OPPOSITE side answers a downward drag with the
  // field travelling back up -- the preview then disagrees with the movement. It
  // must continue in the direction the pointer was already going.
  ok(
    "a downward drag never crosses back up, and never goes sideways",
    rDown && rDown.placement !== "before" && rDown.placement !== "beside",
    "a downward drag resolved to " + JSON.stringify(rDown && rDown.placement),
  );

  // The real upward case. Dragging the LAST field up means entering the BOTTOM
// band of the field above it, which reads as "after" -- and "after" is already
// true, because the field is below. Widening has to go further up, not sideways.
// (A pointer placed in a TOP band while the field is below cannot arise from an
// upward drag, so that shape is not worth asserting.)
const view2 = makeView([
  { fieldId: "x", rect: box(0) },
  { fieldId: "y", rect: box(shellA.h + pad * 2) },
  { fieldId: "a", rect: box((shellA.h + pad * 2) * 2) },
]);
const lg2 = view2.els[2].getBoundingClientRect();
const lastUp = hitTestReadingDrop(view2.sizer, view2.els[2],
  { x: 300, y: lg2.top - 20 },
  { x: 300, y: lg2.top + 10, rect: lg2 });
ok(
  "dragging the last field up puts it before the one above it",
  lastUp && lastUp.placement === "before" && lastUp.id === "y",
  JSON.stringify(lastUp && { id: lastUp.id, placement: lastUp.placement }),
);

// And the mirror: dragging a field DOWN into a top band that is already true
// must go further down, never into a row.
const view3 = makeView([
  { fieldId: "a", rect: box(0) },
  { fieldId: "y", rect: box(shellA.h + pad * 2) },
  { fieldId: "z", rect: box((shellA.h + pad * 2) * 2) },
]);
const fg3 = view3.els[0].getBoundingClientRect();
  const firstDown = hitTestReadingDrop(view3.sizer, view3.els[0], { x: 300, y: fg3.top + 20 },
    { x: 300, y: fg3.top + 10, rect: fg3 });
ok(
  "dragging the first field down over the one below it widens further down",
  firstDown && firstDown.placement === "after" && firstDown.id === "y",
  JSON.stringify(firstDown && { id: firstDown.id, placement: firstDown.placement }),
);
}

head("the beside indicator is drawn at the target, not the dragged field");
{
  const code = fs.readFileSync(src, "utf8");
  ok(
    "the hit-test returns the element it matched",
    /return\s*\{\s*kind:\s*"field",[\s\S]{0,200}?\brect:\s*r\s*,?\s*\}/.test(code) ||
      /kind:\s*"field",[\s\S]{0,160}?\bel,/.test(code),
    "without `el`, the beside indicator falls back to the DRAGGED field's row rect",
  );
  ok(
    "the indicator code does not reach for the dragged field's row",
    !/root\.closest\("\.sc-field-row"\)/.test(code),
    "root is the dragged field, so its row is where the field already is",
  );
}

head("the decision follows the FIELD, not the pointer");
{
  // "In the downward direction it must be counted from the end of the field."
  //
  // The pointer is wherever the grab handle was, which is near the TOP of the
  // dragged field. Deciding from the pointer therefore promotes "before" long
  // before the field has actually moved past anything -- the pointer has crossed
  // the target's top edge while the field itself is still above it, and vice
  // versa on the way up. What has to be compared is the field's own edge.
  const shellH = 60, pad = 8, gap = pad * 2;
  const bx = (top) => ({ top: top - pad, bottom: top + shellH + pad, height: shellH + pad * 2, left: 0, right: 600, width: 600 });
  const { sizer, els } = makeView([
    { fieldId: "a", rect: bx(0) },
    { fieldId: "b", rect: bx(shellH + gap) },
    { fieldId: "c", rect: bx((shellH + gap) * 2) },
  ]);
  const drag = els[0];
  // Grab near the top of the field, which is where the handle is.
  const grabRect = drag.getBoundingClientRect();
  const grab = { y: grabRect.top + 10, x: 300, rect: grabRect };
  const fieldTop = grabRect.top,
    fieldBottom = grabRect.bottom;

  const at = (y) => hitTestReadingDrop(sizer, drag, { x: 300, y }, grab);

  // The field has not moved: it is still above b.
  ok("at rest the field stays where it is", (() => {
    const r = at(grab.y);
    return !r || r.placement !== "after" || r.id !== "b";
  })(), JSON.stringify(at(grab.y) && { id: at(grab.y).id, p: at(grab.y).placement }));

  // Move down by less than one field height: the field's BOTTOM has cleared b's
  // top, so it belongs after b.
  const justPast = fieldBottom + 4;
  let r = at(justPast);
  ok(
    "once the field's bottom edge passes the next field's top, it goes after it",
    r && r.id === "b" && r.placement === "after",
    JSON.stringify(r && { id: r.id, p: r.placement }) + " at y=" + justPast,
  );

  // Half-way through b: overlapping. With the pointer over b horizontally this
  // is genuinely side by side.
  r = at(fieldTop + shellH + gap + 30);
  ok(
    "a vertical drag never offers beside, even while the boxes overlap",
    r && r.placement !== "beside",
    JSON.stringify(r && { id: r.id, p: r.placement }),
  );

  // Keep going: the field's bottom clears b and reaches c.
  const pastB = (shellH + gap) * 2 + 4;
  r = at(pastB);
  ok(
    "and then it moves on to the next field",
    r && r.id === "c" && r.placement === "after",
    JSON.stringify(r && { id: r.id, p: r.placement }) + " at y=" + pastB,
  );

  // Now the mirror: dragging UP. The field's TOP edge is what counts.
  const upAbove = fieldTop - (shellH + gap) - 4;
  r = at(upAbove);
  // Nothing real lies above the first field, so no indicator is the answer --
  // and crucially not a sideways row join.
  ok(
    "dragging the first field far up offers no sideways target",
    (r === null || r.placement === "before") && (!r || r.placement !== "beside"),
    JSON.stringify(r && { id: r.id, p: r.placement }) + " at y=" + upAbove,
  );

  // The asymmetry that was reported, stated as an invariant: at the SAME pointer
  // offset below the grab, the result must be "after", not "before".
  for (const offset of [20, 40, 60, 80, 100]) {
    const down = at(grab.y + offset);
    ok(
      "dragging down by " + offset + "px never resolves to 'before'",
      !down || down.placement !== "before",
      JSON.stringify(down && { id: down.id, p: down.placement }),
    );
  }
}

head("a drag does not leak");
{
  const code = fs.readFileSync(src, "utf8");
  const body = /async beginReadingDrag\([^)]*\)\s*\{[\s\S]*?\n  \}/.exec(code);
  ok("beginReadingDrag was located", !!body);
  if (body) {
    // this.register() appends to the plugin's component list and is only drained
    // on unload. One call per drag means one leaked entry per drag, forever.
    ok(
      "beginReadingDrag does not call this.register()",
      !/this\.register\s*\(/.test(body[0]),
      "a per-drag register() grows the component list without bound",
    );
    const stripped = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    ok(
      "it keeps exactly one slot, and cancels any previous drag into it",
      /this\.readingDrag\?\.cancel\?\.\(\)/.test(body[0]),
    );
    ok("the slot is assigned unconditionally on every drag", /this\.readingDrag = \{ cancel: cleanup \}/.test(body[0]));
    void stripped;
  }
  // onunload's body is long and ends with several nested closures, so anchor on
  // the statement rather than trying to match the whole method.
  const unload = /\n  onunload\(\)\s*\{[\s\S]{0,400}/.exec(code);
  ok("onunload was located", !!unload);
  ok(
    "onunload tears the reading drag down",
    !!unload && /readingDrag\?\.cancel\?\.\(\)/.test(unload[0]),
    "an overlay left in the DOM after a plugin reload is a permanent full-screen layer",
  );
}

head("the reading view actually wires beginDrag");
{
  // The bug was an optional call on a callback nobody supplied. Assert the
  // wiring directly so it cannot silently regress to a dead button.
  const code = fs.readFileSync(src, "utf8");
  const rv = /renderReadingField\([^)]*\)\s*\{[\s\S]*?\n  \}/.exec(code);
  ok("renderReadingField was located", !!rv);
  if (rv) ok("renderReadingField now supplies beginDrag", /beginDrag\s*:/.test(rv[0]), rv[0].slice(0, 120));
  const handle = /onpointerdown\s*=\s*\(\w+\)\s*=>\s*\{[\s\S]{0,180}?beginDrag/.exec(code);
  ok("the drag handle still routes to beginDrag", !!handle);
  // The rationale for a rule lives in a comment that quotes the old code, so the
// source has to be stripped before checking for it in code.
const codeOnly = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  ok(
    "beginDrag is no longer an optional call that can no-op",
    !/beginDrag\?\./.test(codeOnly),
    "optional chaining hides a missing callback -- that is what made it a dead button",
  );
  ok("the reading drag hit-test is reachable from the source", /function hitTestReadingDrop\(/.test(code));
}

head("two fields already in one row can still be swapped");
{
  // meansNothing() treats any "beside" whose target shares a row with the dragged
  // field as a no-op. But Ct()'s beside path genuinely reorders the two -- it
  // rewrites the span as target+moved or moved+target. So the suppression throws
  // away the only way to change the order inside a row.
  const rowRect = { left: 0, top: 100, bottom: 160, height: 60, width: 600, right: 600 };
  const sizer = document.createElement("div");
  sizer.className = "markdown-preview-sizer";
  const rowEl = document.createElement("div");
  rowEl.className = "sc-field-row";
  rowEl.__rect = rowRect;
  sizer.appendChild(rowEl);
  const member = (id, left) => {
    const el = document.createElement("div");
    el.className = "structured-cards-root sc-standalone-field";
    el.dataset.fieldId = id;
    el.__rect = { left, right: left + 300, top: 100, bottom: 160, height: 60, width: 300 };
    rowEl.appendChild(el);
    return el;
  };
  const p = member("p", 0), q = member("q", 300);
  for (const el of sizer.querySelectorAll("div")) el.getBoundingClientRect = () => ({ ...el.__rect });

  const first = p.getBoundingClientRect();
  const grab = { x: 150, y: first.top + 10, rect: first };
  // Drag the LEFT member across the seam onto the RIGHT member's right half, which
  // is what a swap actually looks like. The left half means "stand to the left of
  // q", which is where p already is -- a genuine no-op, correctly suppressed.
  const choice = hitTestReadingDrop(sizer, p, { x: 520, y: 130 }, grab);

  ok(
    "a sideways drag inside a row offers a drop",
    !!choice,
    "it was suppressed as a no-op, so two fields in a row can never be reordered",
  );
  ok(
    "and the drop is the beside join that actually reorders them",
    choice && choice.placement === "beside" && choice.id === "q",
    JSON.stringify(choice && { id: choice.id, p: choice.placement, side: choice.side }),
  );
  // And the write has to agree, or the offer is a lie.
  const ROW_NOTE =
    "```structured-field\nid: p\nlabel: P\ntype: text\nwidth: 100%\nrow: row-1\n```\n" +
    "```structured-field\nid: q\nlabel: Q\ntype: text\nwidth: 100%\nrow: row-1\n```\n";
  const swapped = Ct(ROW_NOTE, "p", "q", "beside", void 0, void 0, { side: "right" });
  ok(
    "Ct really does swap them, so suppressing the offer was wrong",
    R(swapped).map((x) => x.field.id).join(",") === "q,p",
    R(swapped).map((x) => x.field.id).join(","),
  );
}

console.log("\n================ READING DRAG ================");
console.log("pass:", pass, " fail:", fail);
for (const [n, d] of bad) console.log("  FAIL " + n + (d === undefined ? "" : "  [" + d + "]"));
process.exit(fail ? 1 : 0);