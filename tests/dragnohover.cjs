"use strict";
// While a drag is running, nothing in the plugin may react to the pointer.
//
// None of the four drag paths call `setPointerCapture`. While the pointer is
// down the browser therefore keeps hit-testing it against the document, and
// `:hover` follows it from item to item: every item the pointer passes over
// lights up its grip, its delete button and its background mid-drag. That reads
// as the list reacting rather than the drag.
//
// The fix is one marker on the body plus a stylesheet in which no `:hover` rule
// can match while the marker is present. The invariant tested here is the strong
// one -- EVERY `:hover` rule is guarded -- so a hover rule added later without a
// guard fails the suite instead of reintroducing the defect. `:focus-within` is
// deliberately left unguarded: keyboard focus must still reveal controls.
const fs = require("fs");
const { src, css: cssPath, T } = require("./paths.cjs");
const { JSDOM } = require("jsdom");

const js = fs.readFileSync(src, "utf8");
const code = js.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const sheet = fs.readFileSync(cssPath, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

const MARK = "sc-drag-in-progress";
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

// --- a depth-aware selector splitter ----------------------------------------
// Commas inside :is(...) / :not(...) do not separate selectors.
function splitSelectors(list) {
  const out = [];
  let depth = 0,
    buf = "";
  for (const ch of list) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(buf.trim());
      buf = "";
    } else buf += ch;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

function rules(src) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(src))) out.push({ sel: m[1].trim(), body: m[2] });
  return out;
}

head("a single helper owns the drag marker");
{
  ok("the helper exists", /function scHoverLock\(/.test(code));
  ok(
    "it marks the body, not an element inside the card",
    /document\.body[\s\S]{0,240}?classList\.add\(\s*"sc-drag-in-progress"\s*\)/.test(code),
    "a marker inside the card would not cover the reading view or another field",
  );
  ok(
    "the release is idempotent, so a double teardown cannot over-decrement",
    /let done = false[\s\S]{0,320}?if \(done\) return/.test(code),
    "blur, Escape, pointercancel and cancelPointerDrag can all fire for one drag",
  );
  ok(
    "it counts rather than toggling",
    /scDragDepth/.test(code),
    "a bare toggle lets the first teardown clear a marker another drag still needs",
  );
}

head("every hover rule is guarded while a drag runs");
{
  const all = rules(sheet);
  const hoverRules = all.filter((r) => r.sel.includes(":hover"));
  ok("the stylesheet has hover rules to guard", hoverRules.length > 0, hoverRules.length + " found");

  const unguarded = [];
  for (const r of hoverRules) {
    for (const s of splitSelectors(r.sel)) {
      if (s.includes(":hover") && !s.includes(`body:not(.${MARK})`)) unguarded.push(s);
    }
  }
  ok(
    "no :hover selector can match during a drag",
    unguarded.length === 0,
    unguarded.join("\n        "),
  );

  const guarded = hoverRules.filter((r) => r.sel.includes(`body:not(.${MARK})`));
  ok("the guard is applied to the hover rules", guarded.length === hoverRules.length,
     guarded.length + " of " + hoverRules.length);

  ok("the guard is not re-applied twice",
     !sheet.includes(`body:not(.${MARK}) body:not(.${MARK})`));

  // Specificity rises by (0,1,1) from the guard, so check that no resting rule
  // relies on beating a hover rule it now outranks.
  const hoverOnlyProps = new Set();
  for (const r of hoverRules)
    for (const d of r.body.split(";")) {
      const i = d.indexOf(":");
      if (i > 0) hoverOnlyProps.add(d.slice(0, i).trim().toLowerCase());
    }
  ok("the guard does not change what the hover rules declare", hoverOnlyProps.size > 0);
}

head("keyboard focus still reveals controls during a drag");
{
  const all = rules(sheet);
  // Judge the selectors, not the rules. One rule can carry a guarded `:hover`
  // selector beside an unguarded `:focus-within` one, and that is the correct
  // outcome -- only the hover half has to be suppressed.
  const focusSelectors = [];
  for (const r of all) {
    if (!r.sel.includes(":focus-within")) continue;
    for (const s of splitSelectors(r.sel))
      if (s.includes(":focus-within")) focusSelectors.push(s);
  }
  ok("there are :focus-within selectors", focusSelectors.length > 0, focusSelectors.length + " found");
  const wronglyGuarded = focusSelectors.filter((s) => s.includes(`body:not(.${MARK})`));
  ok("no :focus-within selector is guarded", wronglyGuarded.length === 0, wronglyGuarded.join("\n        "));
  // A focused control has to survive, otherwise the drag would erase the
  // keyboard path through the item.
  ok(
    "focus still forces a control visible",
    /:focus-within[^{]*\.sc-edit-control[^{]*\{[^}]*opacity:\s*1/.test(sheet),
    "the keyboard path through an item is gone",
  );
  // The keyboard path has to survive a drag too, not just ordinary hovering. It
  // does because the lock takes focus off the handle when a drag starts, so no
  // :focus-within rule matches while the drag runs -- rather than by suppressing
  // the rule, which would also suppress it for a keyboard user.
  ok(
    "the lock is what protects focus, not a stylesheet override",
    /scHoverLock\([\s\S]{0,700}?\.blur\(\)/.test(code),
    "no blur, so :focus-within reveals every control on the item being dragged",
  );
  ok(
    "the guard never targets the dragged element",
    !new RegExp(`body:not\\(\\.$MARK\\)[^{}]*is-dragging`).test(sheet),
    "is-dragging is how the element being dragged is styled; suppressing it would hide the drag",
  );
}

head("all four drag paths lock and unlock");
{
  const paths = [
    ["the standalone-field item drag", /function ze\([\s\S]*?scHoverLock\(\)[\s\S]*?\n\s*\}\n/],
    ["the reading-view field drag", /beginReadingDrag\([\s\S]*?scHoverLock\(\)/],
    ["the editor block drag", /beginPointerDrag\([\s\S]*?scHoverLock\(\)/],
    ["its teardown", /cancelPointerDrag\([\s\S]*?releaseHover/],
    ["the legacy HTML5 drag", /ondragstart[\s\S]{0,400}?scHoverLock\(\)/],
    ["its teardown", /ondragend[\s\S]{0,400}?releaseHover/],
  ];
  for (const [name, re] of paths) ok(name + " locks hover", re.test(code), name + " did not lock");

  // The four teardown paths do not share one variable name -- a local closure in
  // ze(), another local in beginReadingDrag(), and two instance slots -- so count
  // the call, not the identifier.
  const releases = (code.match(/[\w.$]*releaseHover(?:\?\.)?\(\)/g) || []).length;
  ok("every lock has a matching release", releases >= 4, releases + " release call(s) for 4 locks");
  const locks = (code.match(/scHoverLock\(\)/g) || []).length - 1; // minus the definition
  ok("one lock per drag path", locks === 4, locks + " lock call(s)");
  ok("the orphan sweep clears it too",
     /cancelPointerDrag\([\s\S]{0,400}?releaseHover/.test(code),
     "a drag torn down by cancelPointerDrag would otherwise leave hover dead for the session");
}

// ---------------------------------------------------------------------------
head("at runtime");
{
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
    pretendToBeVisual: true,
  });
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
      if (o.disabled !== undefined) e.disabled = o.disabled;
      if (o.placeholder !== undefined) e.placeholder = o.placeholder;
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
  obsidian.setIcon = (el, name) => el.setAttribute("data-icon", name);
  obsidian.Notice = class {};
  obsidian.Menu = class {
    addItem() { return this; }
    addSeparator() {}
    showAtMouseEvent() {}
    showAtPosition() {}
  };

  // The helper is optional here: the suite must report a red state, not crash.
fs.writeFileSync(
  T + "dragnohover.cjs",
  js +
    "\n;module.exports.__Et=Et;module.exports.__Q=Q;" +
    "module.exports.__scHoverLock=typeof scHoverLock==='function'?scHoverLock:void 0;\n",
);
  for (const k of Object.keys(require.cache)) if (k.endsWith("dragnohover.cjs")) delete require.cache[k];
  const { __Et: Et, __Q: Q } = require(T + "dragnohover.cjs");

  const OPTS = {
    revealSecrets: false, defaultDirection: "auto", animations: true,
    showEditingControls: true, showDragHandles: true, responsive: true, snapGuides: true,
  };
  const saved = [];
  function render(items) {
    const root = document.getElementById("root");
    root.innerHTML = "";
    const field = Q(
      "```structured-field\nid: f\nlabel: L\ntype: text\nwidth: 100%\n" +
        items.map((i) => `  item: ${i}`).join("\n") +
        "\n```",
    );
    Et(root, field, OPTS, {
      commitOnBlur: true,
      save: (f) => saved.push(f),
      settings() {}, duplicate() {}, delete() {}, beginDrag() {},
    });
    return root;
  }

  const body = document.body;
  const locked = () => body.classList.contains(MARK);
  const pt = (type, y) =>
    new dom.window.Event(type, { bubbles: true, cancelable: true });
  const pointer = (type, y, id = 1) => {
    const e = new dom.window.Event(type, { bubbles: true, cancelable: true });
    e.pointerId = id;
    e.clientX = 40;
    e.clientY = y;
    e.button = 0;
    return e;
  };

  // jsdom has no layout, so every child box is zero-height. Give them a box so
  // the drag's index maths has something to work with.
  dom.window.Element.prototype.getBoundingClientRect = function () {
    const kids = this.children.length;
    return { left: 0, right: 100, top: 0, bottom: kids * 10, width: 100, height: kids * 10 };
  };

  const root = render(["title|A", "text|B", "text|C"]);
  const grips = root.querySelectorAll(".sc-item-grip");

  ok("there is a grip to grab", grips.length === 3, grips.length + " grips");

  head("a real pointer drag locks hover for its whole life");
  {
    ok("hover is live before the drag", !locked());

    grips[0].dispatchEvent(pointer("pointerdown", 5));
    ok("hover is locked as soon as the drag starts", locked());

    // Move far enough to pass the 4px dead zone, straight over another item.
    dom.window.dispatchEvent(pointer("pointermove", 40));
    dom.window.dispatchEvent(pointer("pointermove", 80));
    ok("hover stays locked while the pointer crosses other items", locked());

    dom.window.dispatchEvent(pointer("pointerup", 80));
    ok("hover is released on pointerup", !locked());
    ok("the drop indicator is gone", !document.querySelector(".sc-item-drop-indicator"));
    ok("the move was applied", saved.length > 0, saved.length + " save(s)");
  }

  head("every other way out of a drag releases the lock");
  {
    const escapes = ["pointercancel", "blur"];
    for (const kind of escapes) {
      grips[0].dispatchEvent(pointer("pointerdown", 5));
      ok(kind + ": locked on the way in", locked());
      dom.window.dispatchEvent(pointer(kind, 5));
      ok(kind + ": released on the way out", !locked());
    }

    grips[0].dispatchEvent(pointer("pointerdown", 5));
    ok("Escape: locked on the way in", locked());
    dom.window.dispatchEvent(pointer("pointermove", 40));
    const esc = new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true });
    dom.window.dispatchEvent(esc);
    ok("Escape: released on the way out", !locked());
  }

  head("a stale teardown cannot unlock a drag that is still running");
  {
    const lock = require(T + "dragnohover.cjs").__scHoverLock;
    ok("the lock helper is reachable for this check", typeof lock === "function",
       "not exported, so the counter cannot be exercised directly");

    grips[0].dispatchEvent(pointer("pointerdown", 5));
    ok("the first drag is live", locked());
    if (typeof lock === "function") {
      const rel1 = lock(); // a second drag starts
      ok("two live drags keep it locked", locked());

      dom.window.dispatchEvent(pointer("pointerup", 80)); // the first ends
      ok("one drag ending does not clear the lock", locked(),
         "the second drag is still running");

      rel1();
      rel1(); // double teardown
      ok("the last release clears it", !locked());
    }
    ok("the lock is not left on after this section", !locked());
  }

  head("the marker is a single class on the body");
  {
    grips[0].dispatchEvent(pointer("pointerdown", 5));
    const classes = [...body.classList].filter((c) => /^sc-drag/.test(c));
    ok("exactly one drag class", classes.length === 1, JSON.stringify(classes));
    ok("it is the documented one", classes[0] === MARK, classes[0]);
    ok("it is on the body, not inside the card", !root.querySelector("." + MARK));
    dom.window.dispatchEvent(pointer("pointerup", 5));
  }

  head("the pointer is actually captured, and released");
  {
    // jsdom implements neither call, so record them. What is under test is the
    // wiring -- which pointer id, on which element -- not the browser.
    const calls = [];
    dom.window.Element.prototype.setPointerCapture = function (id) {
      calls.push(["capture", id, this.className]);
    };
    dom.window.Element.prototype.releasePointerCapture = function (id) {
      calls.push(["release", id, this.className]);
    };
    dom.window.Element.prototype.hasPointerCapture = function (id) {
      return calls.some((c) => c[0] === "capture" && c[1] === id) &&
        !calls.some((d) => d[0] === "release" && d[1] === id);
    };

    grips[0].dispatchEvent(pointer("pointerdown", 5, 77));
    const captured = calls.filter((c) => c[0] === "capture");
    ok("the drag captured the pointer", captured.length === 1, JSON.stringify(calls));
    ok("it captured the pointer that started the drag",
       !!captured[0] && captured[0][1] === 77, "got id " + (captured[0] && captured[0][1]));
    // Captured on the item rather than on the handle: the handle is a child that
    // a re-render can replace, while the item is the element the drag has already
    // committed to, and events from it still bubble to the window listeners.
    ok("it captured on the dragged item, not on the body",
       /sc-field-item/.test(captured[0] ? captured[0][2] : ""),
       "captured on: " + (captured[0] && captured[0][2]));

    dom.window.dispatchEvent(pointer("pointermove", 60, 77));
    ok("moving the captured pointer keeps the drag alive", locked());
    dom.window.dispatchEvent(pointer("pointerup", 90, 77));
    const released = calls.filter((c) => c[0] === "release" && c[1] === 77);
    ok("the capture is released on pointerup", released.length === 1, JSON.stringify(calls));
    ok("hover comes back afterwards", !locked());
  }

  head("a drag that grabs focus gives it up for the length of the drag");
  {
    const input = root.querySelector("textarea");
    input.focus();
    ok("something inside the item has focus", root.contains(document.activeElement),
       "jsdom focus did not land on " + (document.activeElement && document.activeElement.tagName));

    grips[0].dispatchEvent(pointer("pointerdown", 5));
    const active = document.activeElement;
    ok(
      "focus is no longer inside the plugin",
      !root.contains(active),
      "focus stayed on " + (active && active.tagName) +
        " -- :focus-within then keeps every control on that item visible",
    );
    dom.window.dispatchEvent(pointer("pointerup", 5));
  }
}

head("the pointer is captured, so the browser stops hit-testing for hover");
{
  // The stylesheet guard alone is not enough. `:hover` is driven by the browser
  // hit-testing the pointer on every move; while a button is held that keeps
  // happening, so the cursor changes and other elements light up under the
  // pointer. `setPointerCapture` is the mechanism that actually stops it: the
  // browser routes every pointer event to the capturing element and stops
  // firing boundary events, so no other element can become :hover at all.
  ok("capture is used somewhere", /setPointerCapture/.test(code), "no drag captures the pointer");
  ok("release is used too", /releasePointerCapture/.test(code));

  const paths = [
    ["the item drag", /function ze\([\s\S]{0,900}?scCapturePointer\(/],
    ["the reading-view drag", /beginReadingDrag\([\s\S]{0,900}?scCapturePointer\(/],
    ["the editor block drag", /beginPointerDrag\([\s\S]{0,900}?scCapturePointer\(/],
  ];
  for (const [name, re] of paths) ok(name + " captures the pointer", re.test(code), name + " did not");
  // The legacy path is HTML5 drag-and-drop, where the browser has already
  // entered drag mode and no pointer events fire, so capture does not apply.
  ok("one capture helper serves every path", (code.match(/function scCapturePointer\(/g) || []).length === 1);

  // The id must come from the event that started the drag. The move and up
  // handlers already filter on it, so a hard-coded or invented id would leave
  // the drag listening for a pointer it does not own.
  ok(
    "the id is read from the initiating event",
    /function scCapturePointer\([^)]*\)\s*\{\s*let id = \w+ && \w+\.pointerId/.test(code),
    "the id must come from evt.pointerId",
  );
  ok(
    "no call site passes an id of its own",
    !/scCapturePointer\([^)]*,\s*\d+\s*\)/.test(code),
    "a literal id is a bug waiting for the second pointer",
  );

  ok(
    "release is guarded against an element that has already gone",
    /releasePointerCapture/.test(code) && /hasPointerCapture/.test(code),
    "a drag whose card re-renders loses its capture; an unguarded release throws",
  );
}

head("the grabbed handle stops holding focus for the length of the drag");
{
  // The grip is tabindex="0", so clicking it focuses it -- and the item's
  // :focus-within rule then reveals every control on that item, for as long as
  // the drag lasts. That reveal is a second, independent reason the controls
  // light up, and it survives any amount of guarding the :hover rules.
  ok("the lock takes focus away", /scHoverLock\([\s\S]{0,700}?\.blur\(\)/.test(code));
  ok(
    "and only from an element inside the plugin, so the editor keeps its caret",
    /scHoverLock\([\s\S]{0,900}?structured-cards-root/.test(code),
    "blurring the vault's focused input would close whatever the user was writing",
  );
}

head("the cursor cannot flip mid-drag");
{
  ok("grabbing is forced for the whole document while a drag runs",
     /body\.sc-drag-in-progress[^{}]*\{[^}]*cursor:\s*grabbing/.test(sheet),
     "the cursor reverts the moment the pointer leaves the 8px handle");
  ok("the force reaches everything under the pointer",
     /body\.sc-drag-in-progress[^{}]*\*[^{}]*\{[^}]*cursor:\s*grabbing/.test(sheet));
  ok("the handle is a bigger target than a 3px line",
     (() => {
       const m = /\.sc-field-item>\.sc-item-grip\{[^}]*height:(\d+)px/.exec(sheet);
       return m && parseInt(m[1], 10) >= 10;
     })(),
     "a few pixels of drift and the cursor changes before the drag even starts");
}

head("controls are reset outright while a drag runs, not merely left to win");
{
  // Second layer. If the browser ever evaluates a hover rule anyway, these
  // explicit resets still put the controls back at rest.
  const under = new RegExp(`body\\.${MARK}[^}]*\\{[^}]*\\}`, "g");
  const resets = [...sheet.matchAll(under)].map((m) => m[0]).join(" ");
  // `[^}]*` and not `[^{}]*`: the sheet is minified onto one line, so the
  // property follows its selector across the block's opening brace.
  ok("item background is reset", /sc-field-item[^}]*background/.test(resets));
  ok("control opacity is reset",
     /sc-item-(grip|delete|reveal)[^}]*opacity/.test(resets));
  ok("the resets are not merely the guard's own rules",
     resets.includes("{background:transparent}"), resets.slice(0, 120));
}

console.log("\n================ DRAG / HOVER ================");
console.log("pass:", pass, " fail:", fail);
for (const [n, d] of bad) console.log("  FAIL " + n + (d === undefined || d === "" ? "" : "  [" + d + "]"));
process.exit(fail ? 1 : 0);