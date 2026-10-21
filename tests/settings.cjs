"use strict";
// Does flipping a setting in the plugin's settings tab actually persist?
//
// This exists because of a specific report: "Show copy buttons" did nothing and
// data.json still said true after switching it off. A DOM-level test can prove
// the class toggle and the CSS rule work; it cannot prove the value reaches the
// file. So this drives the REAL settings tab class and the REAL loadSettings,
// with only the vault mocked.
const fs = require("fs");
const { src, T } = require("./paths.cjs");
const { JSDOM } = require("jsdom");

const dom = new JSDOM("<!doctype html><html><body><div id='c'></div></body></html>", { pretendToBeVisual: true });
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
obsidian.Notice = class {
  constructor(m) {
    obsidian.__notices.push(m);
  }
};
obsidian.__notices = [];
obsidian.setIcon = () => {};
obsidian.Menu = class {
  addItem() {}
  addSeparator() {}
  showAtMouseEvent() {}
  showAtPosition() {}
};

// A Setting mock that records what the tab asked for, so a test can flip a
// toggle the way a user would rather than poking plugin.settings directly.
const built = [];
obsidian.Setting = class {
  constructor() {
    this.name = "";
    this.desc = "";
    this.toggles = [];
    built.push(this);
  }
  setName(n) { this.name = n; return this; }
  setDesc(d) { this.desc = d; return this; }
  addToggle(cb) {
    const t = {
      _v: undefined,
      setValue(v) { this._v = v; return this; },
      onChange(cb) { this._cb = cb; return this; },
    };
    this.toggles.push(t);
    cb(t);
    return this;
  }
  addButton() { return this; }
  addText() { return this; }
  addDropdown() { return this; }
  addExtraButton() { return this; }
  setWarning() { return this; }
};

const code = fs.readFileSync(src, "utf8") + "\n;module.exports.__Mt=Mt;module.exports.__PluginClass=dt;\n";
fs.writeFileSync(T + "settings.cjs", code);
for (const k of Object.keys(require.cache)) if (k.endsWith("settings.cjs")) delete require.cache[k];
const { __Mt: Mt, __PluginClass: PluginClass } = require(T + "settings.cjs");

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

/** Boot the real plugin + the real settings tab over a mocked vault. */
async function boot(stored, leaves) {
  const saved = [];
  const app = { workspace: { getLeavesOfType: () => leaves || [] } };
  const plugin = new PluginClass(app, { id: "structured-cards", version: "0.1.0" });
  plugin.loadData = async () => (stored ? JSON.parse(JSON.stringify(stored)) : null);
  plugin.saveData = async (d) => {
    saved.push(JSON.parse(JSON.stringify(d)));
  };
  await plugin.loadSettings();
  const tab = new Mt(app, plugin);
  tab.containerEl = document.getElementById("c");
  built.length = 0;
  tab.display();
  return {
    plugin,
    saved,
    lastWritten: () => saved[saved.length - 1],
    row: (name) => built.find((s) => s.name === name),
    rows: built.slice(),
  };
}

(async () => {
// The copy settings were removed with the feature, so their persistence is
// asserted as PRUNED rather than round-tripped. nocopy.cjs covers absence.
ok("the settings tab has no copy rows",
   !built.some((s) => /copy/i.test(s.name)),
   built.map((s) => s.name).join(" | "));

  head("a settings change is made VISIBLE, not just saved");
  {
    // Toggling a render option used to write data.json and stop there. The switch
    // flipped, the value persisted, and the screen did not move until the note
    // was reloaded -- which is what "the toggle does not work" looks like.
    const rerenders = [];
    const dispatches = [];
    const leaves = [
      {
        view: {
          file: { path: "n.md" },
          previewMode: { rerender: (force) => rerenders.push(force) },
          editor: { cm: { dispatch: () => dispatches.push("editor") } },
        },
      },
    ];
    const s = await boot(null, leaves);
    const row = s.row("Show editing controls");
    ok("the toggle row exists", !!row, s.rows.map((r) => r.name).join(" | "));
    await row.toggles[0]._cb(false);
    ok(
      "the reading view was re-rendered",
      rerenders.length > 0,
      "the switch flipped and data.json was written, but nothing on screen changed",
    );
    ok(
      "the editor was asked to recompute",
      dispatches.length > 0,
      "the field widgets are never asked whether they still apply",
    );
    ok(
      "and the value really was persisted",
      s.lastWritten().showEditingControls === false,
      JSON.stringify(s.lastWritten()),
    );
  }

  head("every other toggle behaves the same way");
  for (const [name, key] of [
    ["Show editing controls", "showEditingControls"],
    ["Show drag handles", "showDragHandles"],
    ["Responsive layout", "responsive"],
    ["Snap guides", "snapGuides"],
    ["Animations", "animations"],
  ]) {
    const s = await boot({ templates: [] });
    const row = s.row(name);
    ok(name + " exists", !!row, s.rows.map((r) => r.name).join(" | "));
    if (!row || !row.toggles.length) continue;
    ok(name + " starts on", row.toggles[0]._v === true, JSON.stringify(row.toggles[0]._v));
    await row.toggles[0]._cb(false);
    ok(name + " persists in memory", s.plugin.settings[key] === false, String(s.plugin.settings[key]));
    const reloaded = await boot(s.lastWritten() || {});
    ok(name + " survives a reload", reloaded.plugin.settings[key] === false, String(reloaded.plugin.settings[key]));
  }

  head("the inverse toggle is not inverted twice");
  {
    // The row is labelled "Mask secrets by default" but stores
    // revealSecretsByDefault, so ON on screen == false on disk. Inverted twice
    // is the classic bug here: the label and the stored key disagree.
    const s = await boot({ revealSecretsByDefault: false, templates: [] });
    const row = s.row("Mask secrets by default");
    ok("the row exists", !!row);
    if (row && row.toggles.length) {
      ok(
        "showing ON means secrets start hidden",
        row.toggles[0]._v === true,
        "revealSecretsByDefault is false, so the 'mask' switch should read on",
      );
      await row.toggles[0]._cb(false);
      ok("turning it off reveals secrets by default", s.plugin.settings.revealSecretsByDefault === true, String(s.plugin.settings.revealSecretsByDefault));
      const reloaded = await boot(s.lastWritten() || {});
      ok("and that survives a reload", reloaded.plugin.settings.revealSecretsByDefault === true, String(reloaded.plugin.settings.revealSecretsByDefault));
      const row2 = reloaded.row("Mask secrets by default");
      ok("the tab re-renders consistently with what was stored", !!row2 && row2.toggles[0]._v === false, JSON.stringify(row2 && row2.toggles[0]._v));
    }
  }

  head("the dead keys are still pruned, and the rewrite does not drop the rest");
  {
    const s = await boot({
      templates: [],
      defaultLayout: "auto",
      defaultGap: 10,
      showEditingControls: false,
    });
    ok("defaultLayout is gone", !("defaultLayout" in s.plugin.settings));
    ok("defaultGap is gone", !("defaultGap" in s.plugin.settings));
    ok("a false value survives the rewrite", s.plugin.settings.showEditingControls === false, String(s.plugin.settings.showEditingControls));
    ok("a rewrite happened", s.saved.length > 0);
    ok("the rewrite kept the false value", s.lastWritten() && s.lastWritten().showEditingControls === false, JSON.stringify(s.lastWritten()));
    ok("the removed copy settings are pruned, not carried",
   !("showCopyButtons" in (s.lastWritten() || {})) && !("copyNotice" in (s.lastWritten() || {})),
   JSON.stringify(s.lastWritten()));
  }

  console.log("\n================ SETTINGS ================");
  console.log("pass:", pass, " fail:", fail);
  for (const [n, d] of bad) console.log("  FAIL " + n + (d === undefined ? "" : "  [" + d + "]"));
  process.exit(fail ? 1 : 0);
})();