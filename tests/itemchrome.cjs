"use strict";
// Item chrome: the controls that sit on an item inside a field.
//
// Three separate complaints are covered here:
//   1. the item's own buttons land on top of the FIELD's buttons
//   2. the "..." menu wrapped a single Delete action, and sat under the field's
//      own "..."
//   3. the grip handle floated above the item, in the same band as the field's
//      controls
//
// And one addition: an item that has just been created is an empty box with no
// visible meaning, so a hint is shown that disappears on the first keystroke.
//
// Item controls are asserted to live INSIDE the item box (top >= 0) while the
// field's live in the field's own top padding (top < 0). Two different boxes,
// so no amount of pixel-tuning can make them overlap again.
const fs = require("fs");
const { src, css: cssPath, T } = require("./paths.cjs");
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

// --- tiny CSS helpers -------------------------------------------------------
function rawProp(selector, name) {
  const out = {};
  const re = new RegExp(
    "(^|[},])\\s*" + selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{([^}]*)\\}",
    "g",
  );
  let m;
  while ((m = re.exec(sheet))) {
    for (const d of m[2].split(";")) {
      const i = d.indexOf(":");
      if (i > 0) out[d.slice(0, i).trim().toLowerCase()] = d.slice(i + 1).trim();
    }
  }
  return out[name] ?? null;
}
function numeric(v) {
  // CSS allows a unitless zero, so "top:0" must not read as "no value".
  if (String(v).trim() === "0") return 0;
  const m = /(-?[\d.]+)\s*px/.exec(String(v || ""));
  return m ? parseFloat(m[1]) : null;
}

head("the item's buttons no longer collide with the field's");
{
  // The field's own controls float ABOVE the field, in its top padding.
  const fieldDragTop = rawProp(".structured-cards-root .sc-field-header>.sc-field-drag", "top");
  const fieldMoreTop = rawProp(".structured-cards-root .sc-field-header>.sc-field-more", "top");
  ok("the field drag handle sits above the field", /var\(/.test(String(fieldDragTop)), String(fieldDragTop));
  ok("the field menu sits above the field", /var\(/.test(String(fieldMoreTop)), String(fieldMoreTop));

  // The delete button hangs in the shell's 8px gutter, to the RIGHT of the item,
  // vertically centred. Both matter: on top of the item it sat over the text, and
  // the text is what the user was trying to read.
  const delSel = ".structured-cards-root .sc-field-item>.sc-item-delete";
  const delRight = numeric(rawProp(delSel, "right"));
  ok("the delete button declares a right offset", delRight !== null, String(rawProp(delSel, "right")));
  ok(
    "it sits OUTSIDE the item's right edge, in the gutter",
    delRight !== null && delRight < 0,
    `right:${delRight} -- anything >= 0 puts it on top of the item's text`,
  );
  const delTop = String(rawProp(delSel, "top"));
  ok(
    "it is centred on the item, not in the band the drag dashes use",
    /50%/.test(delTop),
    `top:${delTop} -- a pixel value in the top band collides with the drag line`,
  );
  ok(
    "and the shell really has a gutter to hang it in",
    (() => {
      const pad = rawProp(".structured-cards-root .sc-field-shell", "padding");
      return pad !== null && numeric(String(pad).split(/\s+/)[1]) >= 8;
    })(),
    String(rawProp(".structured-cards-root .sc-field-shell", "padding")),
  );

  // The grab line stays inside the item, where its band was reserved for it.
  const gripTop = numeric(rawProp(".structured-cards-root .sc-field-item>.sc-item-grip", "top"));
  ok(
    "the grab line lives inside the item's own band",
    gripTop !== null && gripTop >= 0,
    `top:${gripTop}`,
  );
  ok(
    "the two controls cannot cover each other",
    /50%/.test(String(rawProp(".structured-cards-root .sc-field-item>.sc-item-grip", "left"))) &&
      delRight !== null &&
      delRight < 0,
    "the drag line is centred and the delete button is off the right edge, so they are in different places",
  );
}

head("the grip and the ellipsis menu are gone");
{
  ok("no sc-item-drag element is created", !/sc-item-drag/.test(code));
  ok("no grip-vertical icon is requested for an item", !/setIcon\([^)]*,\s*"grip-vertical"/.test(code));
  ok("no ellipsis icon is requested for an item", !/setIcon\([^)]*,\s*"ellipsis"/.test(code));
  ok("the item delete control is a direct action", /sc-item-delete/.test(code));
  // Check the handler itself rather than a character window: the field's own
  // menu, and the Add-item menu, sit nearby in the source and would trip a
  // proximity test that has nothing to do with this button.
  const delHandler = /sc-item-delete[\s\S]*?onclick\s*=\s*\((\w+)\)\s*=>\s*\{([\s\S]{0,400}?)\}/.exec(code);
  ok("the delete button has a click handler", !!delHandler);
  ok(
    "that handler deletes directly",
    !!delHandler && /splice\(/.test(delHandler[2]) && !/\.Menu\(\)/.test(delHandler[2]),
    "the handler opens a menu: " + (delHandler && delHandler[2].replace(/\s+/g, " ").slice(0, 120)),
  );
  ok("the old classes have no rules left", !/\.sc-item-drag[.,{ ]/.test(sheet) && !/\.sc-item-menu[.,{ ]/.test(sheet));
}

head("a small centred grabbable line replaces the grip");
{
  ok("the grip line is created for an item", /sc-item-grip/.test(code));
  ok("it starts the same reorder as the old handle", /sc-item-grip[\s\S]{0,600}?ze\(/.test(code));

  const sel = ".structured-cards-root .sc-field-item>.sc-item-grip";
  const left = rawProp(sel, "left");
  const width = numeric(rawProp(sel, "width"));
  const transform = String(rawProp(sel, "transform") || "");
  const marginLeft = numeric(rawProp(sel, "margin-left"));

  ok("the handle is centred, not flush to the edge", /50%/.test(String(left)), "left:" + left);
  ok(
    "and actually centred, by transform or a compensating margin",
    /translateX\(-50%\)/.test(transform) ||
      (marginLeft !== null && width !== null && marginLeft === -width / 2),
    "transform:" + transform + " margin-left:" + marginLeft + " width:" + width,
  );

  // The complaint was a bar stretched across the whole item. It has to be a
  // short dash, or the handle is a rule drawn through the text again.
  ok("the handle is narrow", width !== null && width > 0 && width <= 48, width + "px");
  ok(
    "and is not stretched between both edges",
    rawProp(sel, "right") === null || /^auto$/.test(String(rawProp(sel, "right")).trim()),
    "right:" + rawProp(sel, "right") + " -- left:0;right:0 spans the whole item",
  );

  const h = numeric(rawProp(sel, "height"));
  ok("the grab area is a comfortable target", h !== null && h >= 8, h + "px");

  const cur = rawProp(sel, "cursor");
  ok("it advertises that it can be grabbed", /grab|resize|pointer/.test(String(cur)), String(cur));
  ok(
    "it is invisible until the item is hovered or focused",
    /^0(\.0+)?$/.test(String(rawProp(sel, "opacity")).trim()),
    "opacity:" + rawProp(sel, "opacity") + " -- a permanent mark across every item would be noise",
  );
  ok(
    "hovering the item reveals it",
    /\.sc-field-item:hover[^{}]*\.sc-item-grip[^{}]*\{[^}]*opacity\s*:\s*(?!0)/.test(sheet),
    "nothing brings it back on hover",
  );

  // Two dashes: a longer one and a shorter one below it.
  const dashes = [...sheet.matchAll(/\.sc-field-item>\.sc-item-grip(::(?:before|after))?\s*\{([^}]*)\}/g)];
  ok("the handle draws its dashes with pseudo-elements", dashes.length >= 2,
     dashes.length + " rule(s)");
  // Only the pseudo rules paint a dash; the element itself is just the hit area.
  const painted = dashes.filter((d) => d[1] && /background/.test(d[2]));
  ok("both dashes are painted", painted.length >= 2, painted.length + " painted");
  // A rule that does not declare the property yields null rather than crashing,
  // so a missing width is reported as a failing assertion with its context.
  // The sheet is minified onto one line, so a declaration is found after the
  // start of the block or after a `;` -- never at a line start.
  const val = (body, prop) => {
    const m = new RegExp("(?:^|;)\\s*" + prop + "\\s*:\\s*([^;}]+)").exec(body);
    return m ? numeric(m[1]) : null;
  };
  const widths = painted.map((d) => val(d[2], "width"));
  ok("both dashes declare a width", widths.length >= 2 && widths.every((w) => w !== null),
     JSON.stringify(widths));
  const sized = widths.filter((w) => w !== null);
  if (sized.length >= 2) {
    ok("the second dash is the smaller one", sized[1] < sized[0], sized.join(" vs "));
    ok("both dashes stay narrow", sized.every((w) => w > 0 && w <= 40), JSON.stringify(sized));
  }
  const tops = painted.map((d) => val(d[2], "top"));
  const placed = tops.filter((w) => w !== null);
  if (placed.length >= 2)
    ok("the smaller dash sits below the larger one", placed[1] > placed[0], placed.join(" vs "));
  ok("each dash is centred", dashes.every((d) => /50%/.test(d[2])));
}

head("an empty title or text item says what it is");
{
  ok("items can carry a display-only hint", /itemHint|ITEM_HINTS|placeholderForItem/.test(code));
  ok("a title item gets a title hint", /title\s*:\s*"[^"]+"/.test(code));
  ok("a text item gets a text hint", /text\s*:\s*"[^"]+"/.test(code));
  ok(
    "the hint is not written into the note",
    !/W\([^)]*\)[^;]{0,200}placeholder/.test(code),
    "a display-only hint must never become saved content",
  );
}

head("rendered output");
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
  const menus = [];
  obsidian.setIcon = (el, name) => el.setAttribute("data-icon", name);
  obsidian.Notice = class {};
  obsidian.Menu = class {
    addItem(cb) { const it = { setTitle: () => it, setIcon: () => it, onClick: (f) => { it.onClick = f; return it; } }; cb(it); menus.push(it); return this; }
    addSeparator() {}
    showAtMouseEvent() { this.shown = true; }
    showAtPosition() {}
  };

  fs.writeFileSync(T + "itemchrome.cjs", js + "\n;module.exports.__Et=Et;module.exports.__Q=Q;module.exports.__W=W;\n");
  for (const k of Object.keys(require.cache)) if (k.endsWith("itemchrome.cjs")) delete require.cache[k];
  const { __Et: Et, __Q: Q, __W: W } = require(T + "itemchrome.cjs");

  const OPTS = {
    revealSecrets: false, defaultDirection: "auto", animations: true,
    showEditingControls: true, showDragHandles: true, responsive: true, snapGuides: true,
  };
  let saved = [];
  function render(items) {
    const root = document.getElementById("root");
    root.innerHTML = "";
    saved = [];
    const field = Q(
      "```structured-field\nid: f\nlabel: L\ntype: text\nwidth: 100%\n" +
        items.map((i) => `  item: ${i}`).join("\n") +
        "\n```"
    );
    Et(root, field, OPTS, {
      commitOnBlur: true,
      save: (f) => saved.push(W(f)),
      settings() {}, duplicate() {}, delete() {}, beginDrag() {},
    });
    return root;
  }

  const root = render(["title|", "text|"]);

  ok("the item has a delete button", !!root.querySelector(".sc-item-delete"));
  ok("no grip handle on the item", !root.querySelector(".sc-item-drag"));
  ok("no ellipsis button on the item", !root.querySelector(".sc-item-menu"));
  ok("a grabbable line is present", root.querySelectorAll(".sc-item-grip").length === 2,
     root.querySelectorAll(".sc-item-grip").length + " grip(s) for 2 items");
  ok(
    "the delete button carries a delete label",
    [...root.querySelectorAll(".sc-item-delete")].every((b) => /delete/i.test(b.getAttribute("aria-label") || "")),
    [...root.querySelectorAll(".sc-item-delete")].map((b) => b.getAttribute("aria-label")).join(" | "),
  );
  ok("the field's own menu is still there", !!root.querySelector(".sc-field-more"),
     "removing the item's ellipsis must not take the field's away");

  head("the delete button deletes on one click");
  {
    const before = root.querySelectorAll(".sc-field-item").length;
    menus.length = 0;
    const btn = root.querySelector(".sc-item-delete");
    if (btn) btn.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    ok("no menu was opened", menus.length === 0, menus.length + " menu item(s)");
    ok("the field was saved", saved.length === 1, saved.length + " save(s)");
    const after = Q(saved[0] || "");
    ok("the item is gone from the saved block",
       after && after.items && after.items.length === 1,
       saved[0]);
    ok("one item was removed", before === 2, "had " + before);
  }

  head("hints on empty items, none once there is content");
  {
    const empty = render(["title|", "text|"]);
    const ph = [...empty.querySelectorAll("textarea")].map((t) => t.placeholder);
    ok("an empty title item shows a hint", ph.some((p) => /title/i.test(p || "")), JSON.stringify(ph));
    ok("an empty text item shows a hint", ph.some((p) => /text|type/i.test(p || "")), JSON.stringify(ph));

    const filled = render(["title|Hello", "text|World"]);
    const ph2 = [...filled.querySelectorAll("textarea")].map((t) => t.placeholder);
    ok("a filled item shows no hint", ph2.every((p) => !p), JSON.stringify(ph2));

    // The hint must never become content.
    const ta = filled.querySelector(".sc-field-item textarea");
    if (ta) {
    ta.value = "typed";
    ta.dispatchEvent(new dom.window.Event("input", { bubbles: true })); }
    ok("typing does not save the hint as content",
       saved.length === 0 || !/Title|Type here|Text here/.test(saved[saved.length - 1] || ""),
       saved[saved.length - 1]);
  }

head("hints reach the reading view too");
{
  const empty = render(["title|", "text|"]);
  const inputs = [...empty.querySelectorAll("input.sc-input, select.sc-input, textarea")];
  ok("every editable surface inside an empty item has a hint",
     inputs.length > 0 && inputs.every((i) => !!i.placeholder || !i.closest(".sc-field-item")),
     inputs.map((i) => i.placeholder || "(none)").join(" | "));
}

head("an empty item that is never typed into stays empty in the file");
{
  const empty = render(["title|", "text|"]);
  ok("no save happened just from rendering", saved.length === 0, saved.length + " save(s)");
}
}

console.log("\n================ ITEM CHROME ================");
console.log("pass:", pass, " fail:", fail);
for (const [n, d] of bad) console.log("  FAIL " + n + (d === undefined ? "" : "  [" + d + "]"));
process.exit(fail ? 1 : 0);