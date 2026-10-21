/**
 * Build the screenshots used by README.md and docs/.
 *
 * These are not mock-ups. Every page below is rendered by the plugin's own
 * render function, with the plugin's own stylesheet and the CSS variables
 * Obsidian defines, so what lands in the image is what a user sees.
 *
 * Two pages per theme, because they answer different questions:
 *
 *   overview.html  What a note looks like at rest. Nothing is forced visible,
 *                  because that is the honest default view.
 *   controls.html  What the editing affordances look like. Exactly one item is
 *                  marked as hovered -- a still image cannot hover, and forcing
 *                  every control on every card turns the picture into noise.
 *
 * Usage:  node tools/screenshots.mjs [outDir]
 * Then open each .html over http and screenshot it to a .png beside it.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { JSDOM } from "jsdom";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.resolve(process.argv[2] || path.join(ROOT, "docs", "images"));

// ---------------------------------------------------------------------------
// A DOM with the Obsidian helpers the renderer calls.
// ---------------------------------------------------------------------------
const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
  pretendToBeVisual: true,
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", {
  value: dom.window.navigator,
  configurable: true,
  writable: true,
});
for (const k of [
  "HTMLElement", "HTMLInputElement", "HTMLTextAreaElement", "Element", "Node",
  "Event", "CustomEvent", "KeyboardEvent", "getComputedStyle", "DOMParser", "NodeFilter",
]) globalThis[k] = dom.window[k];
globalThis.AbortController = dom.window.AbortController;
globalThis.AbortSignal = dom.window.AbortSignal;

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
    if (o.checked !== undefined) e.checked = o.checked;
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
  show() { this.style.display = ""; },
  hide() { this.style.display = "none"; },
};
for (const [k, fn] of Object.entries(helpers)) {
  Object.defineProperty(dom.window.HTMLElement.prototype, k, { value: fn, writable: true, configurable: true });
  Object.defineProperty(dom.window.Element.prototype, k, { value: fn, writable: true, configurable: true });
}

const O = require(path.join(ROOT, "tests", ".tmp", "node_modules", "obsidian"));
// Drawn inline so the images do not depend on a network fetch for Lucide.
const ICONS = {
  "grip-vertical": "M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01",
  "trash-2": "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
  ellipsis: "M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  "eye-off": "M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2",
  plus: "M12 5v14M5 12h14",
  check: "M20 6L9 17l-5-5",
};
O.setIcon = (el, name) => {
  el.textContent = "";
  const svg = el.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  for (const d of (ICONS[name] || "M4 7h16").split(/(?=M)/)) {
    const path = el.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
  }
  el.appendChild(svg);
};
O.Notice = class extends Error {};
O.Menu = class { addItem() { return this; } addSeparator() {} showAtMouseEvent() {} showAtPosition() {} };
O.Setting = class { constructor() {} setName() { return this; } setDesc() { return this; } addToggle() { return this; } addButton() { return this; } addText() { return this; } addDropdown() { return this; } addExtraButton() { return this; } setWarning() { return this; } };

const src = fs.readFileSync(path.join(ROOT, "src", "main.js"), "utf8");
const tmp = path.join(ROOT, "tests", ".tmp", "screenshot-bundle.cjs");
fs.writeFileSync(tmp, src + "\n;module.exports.__Et=Et;module.exports.__Q=Q;module.exports.__W=W;\n");
const { __Et: Et, __Q: Q } = require(tmp);
const sheet = fs.readFileSync(path.join(ROOT, "styles.css"), "utf8");

const OPTIONS = {
  revealSecrets: false,
  defaultDirection: "auto",
  animations: true,
  showEditingControls: true,
  showDragHandles: true,
  responsive: true,
  snapGuides: false,
};

const CARD = (...lines) => "```structured-field\n" + lines.join("\n") + "\n```";

// ---------------------------------------------------------------------------
// The note. This is Markdown a user would type, nothing more.
// ---------------------------------------------------------------------------
const CARDS = [
  {
    caption: "A card built from items: a title, free text and a list.",
    hover: 1,
    note: CARD(
      "id: demo-items",
      "label: Reading list",
      "type: text",
      "width: 100%",
      "item: title|The Design of Everyday Things",
      "item: text|Don Norman · 1988, revised 2013",
      "item: bullet|Why a door handle tells you how to open it",
      "item: bullet|Affordances and signifiers, in plain words",
      "item: bullet|Nobody reads the manual, and that is the point",
    ),
  },
  {
    caption: "Typed controls: a URL and a checklist.",
    note: CARD(
      "id: demo-typed",
      "label: Where to find it",
      "type: text",
      "width: 100%",
      "item: title|https://obsidian.md",
      "item: checkbox|Download the installer",
      "item: checkbox|Import an existing vault",
    ),
  },
  {
    caption: "A card with a label and one free value.",
    note: CARD("id: demo-value", "label: Status", "type: text", "value: Draft — waiting on review"),
  },
  {
    caption: "An empty card keeps its hints until you type.",
    hover: 0,
    note: CARD(
      "id: demo-empty",
      "label: New card",
      "type: text",
      "width: 100%",
      "item: title|",
      "item: text|",
    ),
  },
];

// Two cards sharing a row id, which is how a row is written.
const ROW_CARDS = [
  CARD("id: demo-row-a", "label: Draft", "type: text", "width: 100%", "row: row-demo", "value: Not sent"),
  CARD("id: demo-row-b", "label: Sent", "type: text", "width: 100%", "row: row-demo", "value: 12 Aug"),
];

/**
 * Copy live form state onto the attributes that serialise.
 *
 * A textarea's `value` and an input's `checked` are properties, not attributes:
 * setting them updates what the user sees but writes nothing into the markup, so
 * serialising the rendered DOM and reopening it produced empty controls. A real
 * page carries that text as the element's default content.
 */
function hydrate(root) {
  for (const ta of root.querySelectorAll("textarea"))
    if (ta.value && !ta.textContent) ta.textContent = ta.value;
  for (const inp of root.querySelectorAll("input")) {
    if (inp.value && !inp.hasAttribute("value")) inp.setAttribute("value", inp.value);
    if (inp.checked) inp.setAttribute("checked", "checked");
  }
}

const doc = dom.window.document;

function renderCard(note, hoverItem) {
  const el = doc.createElement("div");
  el.className = "structured-cards-root sc-standalone-field";
  el.dataset.fieldId = "shot";
  Et(el, Q(note), OPTIONS, {
    commitOnBlur: false,
    save: () => {},
    settings: () => {},
    duplicate: () => {},
    delete: () => {},
    beginDrag: () => {},
  });
  if (hoverItem !== undefined) {
    const items = el.querySelectorAll(".sc-field-item");
    if (items[hoverItem]) items[hoverItem].classList.add("sc-demo-hover");
  }
  return el;
}

const THEMES = {
  dark: {
    bg: "#1e1e1e", panel: "#262626", text: "#dcdcdc", muted: "#9a9a9a", faint: "#7a7a7a",
    border: "#3a3a3a", borderHover: "#4d4d4d", hover: "#2f2f2f", accent: "#8b7cf6",
    mono: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
    sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  },
  light: {
    bg: "#ffffff", panel: "#f7f7f8", text: "#1f1f1f", muted: "#5c5c5c", faint: "#8a8a8a",
    border: "#e2e2e4", borderHover: "#c9c9cc", hover: "#eeeeef", accent: "#5b4bd6",
    mono: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
    sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  },
};

function shot(cards, hover) {
  const wrap = doc.createElement("div");
  for (const c of cards) {
    const box = doc.createElement("div");
    box.className = "sc-shot";
    box.appendChild(renderCard(c.note, hover ? c.hover : undefined));
    const cap = doc.createElement("div");
    cap.className = "sc-shot-cap";
    cap.textContent = c.caption;
    box.appendChild(cap);
    wrap.appendChild(box);
  }
  hydrate(wrap);
  return wrap.innerHTML;
}

function shotRow() {
  const row = doc.createElement("div");
  // The row's own rules are written as `.structured-cards-root.sc-field-row`, so
  // the wrapper carries both classes -- that is what the plugin emits too.
  row.className = "structured-cards-root sc-field-row";
  for (const n of ROW_CARDS) row.appendChild(renderCard(n));
  const box = doc.createElement("div");
  box.className = "sc-shot";
  box.appendChild(row);
  const cap = doc.createElement("div");
  cap.className = "sc-shot-cap";
  cap.textContent = "Two cards in a row, side by side. A row is written as an ordinary row: key on both blocks.";
  box.appendChild(cap);
  hydrate(box);
  return box.innerHTML;
}

const page = (theme, body, title, sub, extraCss) => `<!doctype html>
<html lang="en" data-theme="${theme}">
<head>
<meta charset="utf-8">
<title>Structured Cards — ${theme}</title>
<style>
  /* Obsidian's own variables, so the plugin's stylesheet resolves against the
     same names it resolves against inside the app. */
  :root {
    --background-primary: ${THEMES[theme].bg};
    --background-secondary: ${THEMES[theme].panel};
    --background-modifier-border: ${THEMES[theme].border};
    --background-modifier-border-hover: ${THEMES[theme].borderHover};
    --background-modifier-hover: ${THEMES[theme].hover};
    --text-normal: ${THEMES[theme].text};
    --text-muted: ${THEMES[theme].muted};
    --text-faint: ${THEMES[theme].faint};
    --interactive-accent: ${THEMES[theme].accent};
    --font-interface: ${THEMES[theme].sans};
    --font-monospace: ${THEMES[theme].mono};
    --font-text: ${THEMES[theme].sans};
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 30px 34px 34px;
    background: ${THEMES[theme].bg}; color: ${THEMES[theme].text};
    font-family: ${THEMES[theme].sans}; font-size: 15px; line-height: 1.5;
  }
  .shot-head { margin: 0 0 24px; }
  .shot-head h1 { margin: 0 0 5px; font-size: 19px; font-weight: 650; letter-spacing: -0.01em; }
  .shot-head p { margin: 0; color: ${THEMES[theme].muted}; font-size: 13px; max-width: 62ch; }
  .sc-shot { margin: 0 0 28px; max-width: 780px; }
  .sc-shot-cap { margin-top: 9px; font-size: 12px; color: ${THEMES[theme].faint}; }
  .shot-foot {
    max-width: 780px; margin-top: 4px; padding-top: 14px;
    border-top: 1px solid ${THEMES[theme].border};
    font-size: 12px; color: ${THEMES[theme].faint};
  }
${extraCss}
  /* The plugin's stylesheet, verbatim. */
${sheet}
</style>
</head>
<body>
  <div class="shot-head"><h1>${title}</h1><p>${sub}</p></div>
  <div class="markdown-preview-view markdown-rendered"><div class="markdown-preview-sizer markdown-preview-section">${body}</div></div>
  <div class="shot-foot">Rendered by the plugin from the Markdown shown in <code>docs/file-format.md</code>.</div>
</body>
</html>`;

// The only thing a still image cannot do is hover, so exactly the marked item
// gets its controls revealed. The override is written with the same selector
// shape the plugin uses to hide them, because the plugin hides controls with
// `opacity: 0 !important` at specificity (0,4,0) -- a shorter selector with
// `!important` still loses to it.
const HOVER_CSS = `  .structured-cards-root.sc-standalone-field .sc-field-item.sc-demo-hover>.sc-edit-control{opacity:1!important;pointer-events:auto!important}`;

fs.mkdirSync(OUT, { recursive: true });
const hoverCss = HOVER_CSS;
for (const theme of ["dark", "light"]) {
  const files = [
    [
      "overview",
      shot(CARDS, false) + shotRow(),
      "Structured Cards",
      "Cards are Markdown blocks you can read, edit and drag — in the editor and in reading view.",
      "",
    ],
    [
      "controls",
      shot(CARDS, true),
      "The editing controls",
      "Drag by the line at the top of an item, delete from the gutter, open a card's own menu from its corner.",
      hoverCss,
    ],
  ];
  for (const [name, body, title, sub, css] of files) {
    const file = path.join(OUT, `${name}-${theme}.html`);
    fs.writeFileSync(file, page(theme, body, title, sub, css), "utf8");
    process.stderr.write("wrote " + path.basename(file) + "\n");
  }
}