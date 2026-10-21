"use strict";
var it = Object.defineProperty;
var Ut = Object.getOwnPropertyDescriptor;
var Yt = Object.getOwnPropertyNames;
var Jt = Object.prototype.hasOwnProperty;
var Xt = (i, r, t) =>
  r in i
    ? it(i, r, { enumerable: !0, configurable: !0, writable: !0, value: t })
    : (i[r] = t);
var Zt = (i, r) => {
    for (var t in r) it(i, t, { get: r[t], enumerable: !0 });
  },
  Qt = (i, r, t, e) => {
    if ((r && typeof r == "object") || typeof r == "function")
      for (let o of Yt(r))
        !Jt.call(i, o) &&
          o !== t &&
          it(i, o, {
            get: () => r[o],
            enumerable: !(e = Ut(r, o)) || e.enumerable,
          });
    return i;
  };
var te = (i) => Qt(it({}, "__esModule", { value: !0 }), i);
var E = (i, r, t) => Xt(i, typeof r != "symbol" ? r + "" : r, t);
var Ne = {};
Zt(Ne, { default: () => dt });
module.exports = te(Ne);
var w = require("obsidian"),
  O = require("@codemirror/view"),
  J = require("@codemirror/state"),
  j = require("@codemirror/commands");
  // `structuredClone` needs Chrome 98. manifest.json advertises minAppVersion
  // 1.5.0, so the promise of that floor is kept honest with a fallback for the
  // JSON-shaped data cloned here (fields, cards, sections, settings defaults).
  // It copies own enumerable keys including `undefined` values, so `"x" in obj`
  // checks behave exactly as they do under the real clone.
var clonePlain =
  typeof structuredClone == "function"
    ? structuredClone
    : function (v) {
        if (v === null || typeof v != "object") return v;
        if (Array.isArray(v)) return v.map(clonePlain);
        var o = {};
        for (var k in v) o[k] = clonePlain(v[k]);
        return o;
      };
var $t = new Set([
    "text",
    "multiline",
    "url",
    "secret",
    "number",
    "select",
    "tags",
    "code",
  ]),
  /**
   * The refresh effect the plugin dispatches onto editor views after a
   * settings change. The decorations state field treats it as "rebuild now"
   * (see editorExtension). A plain empty dispatch was a no-op: CodeMirror only
   * revisits widget equality when the DecorationSet itself is rebuilt.
   */
  ScRefresh = J.StateEffect.define(),
  ee = new Set([
    "text",
    "title",
    "title-text",
    "checkbox",
    "bullet",
    "numbered",
    "secret",
    "url",
    "separator",
    "multiline",
  ]),
  re = new Set(["small", "medium", "large"]),
  ie = new Set(["normal", "bold"]),
  z = (i) =>
    i.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\n/g, "\\n"),
  B = (i) =>
    i.replace(/\\(\\|n|\|)/g, (r, t) =>
      t === "n"
        ? `
`
        : t,
    );
// Block bodies (`label: |` / `value: |`) are stored raw, so a stored line that
// begins with ``` silently closed the code fence in Markdown -- CommonMark
// allows up to three spaces of indent on a closing fence and the writer indents
// by two, so the field was truncated. Guard those lines with the same
// backslash convention z()/B() already use for inline values.
function fg(i) {
  return /^\s*`{3,}/.test(i) || i.includes("\\")
    ? i.replace(/\\/g, "\\\\").replace(/`/g, "\\`")
    : i;
}
function fug(i) {
  return i.includes("\\")
    ? i.replace(/\\`/g, "`").replace(/\\\\/g, "\\")
    : i;
}
// A scalar `key: value` line loses leading whitespace, and a value whose
// remainder is exactly "|" is read back as the start of a block scalar. Those
// values have to be written as blocks.
function needsBlock(i) {
  return i.includes("\n") || /^\s/.test(i) || /^\s*\|\s*$/.test(i);
}
var At_ = (i) => {
    let r = [],
      t = "",
      e = !1;
    for (let o of i)
      (o === "|" && !e ? (r.push(t), (t = "")) : (t += o),
        (e = o === "\\" && !e),
        o !== "\\" && (e = !1));
    return (r.push(t), r);
  },
  At = At_,
  $ = () => {
  // Math.random().toString(36).slice(2, 10) produced ~2.8e9 values and ids are
  // never checked for uniqueness, so a bulk insert could collide. Prefer a
  // crypto UUID and fall back to a wider random string.
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID().replace(/-/g, "");
  return (
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2)
  );
};
function Ot() {
  return {
    kind: "field",
    id: $(),
    label: "",
    type: "text",
    value: "",
    width: void 0,
    height: void 0,
    align: "start",
    direction: "auto",
    masked: !1,
    required: !1,
    items: [],
    titleStyle: void 0,
  };
}
function Z(i = "text") {
  return {
    id: $(),
    kind: i,
    title: i === "title" || i === "title-text" ? "" : void 0,
    value: "",
    checked: i === "checkbox" ? !1 : void 0,
    number: i === "numbered" ? 1 : void 0,
  };
}
var pt = new Set([
  "id",
  "label",
  "type",
  "width",
  "height",
  "offset",
  "items",
  "row",
  "align",
  "copy",
  "masked",
  "required",
  "direction",
  "placeholder",
  "default",
  "options",
  "prefix",
  "suffix",
  "help",
  "validation",
  "value",
  "title-size",
  "title-weight",
  "title-color",
  "title-italic",
  "title-direction",
]);
pt.add("label-hidden");
function oe(i) {
  if (!i) return;
  let r = i.trim();
  if (r.endsWith("px")) {
    let e = Number.parseFloat(r);
    return Number.isFinite(e) && e > 0 ? `${Math.round(e)}px` : void 0;
  }
  if (r === "100%" || r === "100") return;
  let t = Number.parseFloat(r);
  if (Number.isFinite(t)) return Math.max(20, Math.min(100, t));
}
function se(i) {
  return i == null
    ? "100%"
    : typeof i == "string"
      ? i
      : `${Number(i.toFixed(3))}%`;
}
function ne(i) {
  let r = i.replace(/^item:\s*/, ""),
    t = At(r),
    // `(t[0] || "text")` turned a typeless `item: |` into a real text item on
    // the next save. An empty kind is malformed input, so reject it.
    e = (t[0] ?? "").trim();
  if (!ee.has(e)) return null;
  let o = { id: $(), kind: e, value: "" };
  return e === "separator"
    ? ((o.value = ""), o)
    : e === "checkbox"
      ? ((o.title = B(t[1] || "") || void 0),
        (o.checked = (t[2] || "").trim() === "true"),
        o)
      : e === "numbered"
        ? ((o.title = B(t[1] || "") || void 0),
          (o.value = B(t[2] || "")),
          (o.number = Number(t[3]) || void 0),
          o)
        : e === "title"
          ? ((o.title = B(t[1] || "")), o)
          : e === "title-text"
            ? ((o.title = B(t[1] || "") || void 0),
              (o.value = B(t[2] || "")),
              o)
            : ((o.value = B(t[1] || "")),
              t[2] && (o.direction = t[2].trim()),
              o);
}
function ae(i) {
  let r = i.kind;
  if (r === "separator") return "item: separator";
  if (r === "checkbox")
    return `item: ${r}|${z(i.title || "")}|${i.checked ? "true" : "false"}`;
  if (r === "numbered")
    return `item: ${r}|${z(i.title || "")}|${z(i.value)}|${i.number || ""}`;
  if (r === "title") return `item: title|${z(i.title || "")}`;
  if (r === "title-text") return `item: ${r}|${z(i.title || "")}|${z(i.value)}`;
  let t = i.direction && i.direction !== "auto" ? i.direction : "";
  return `item: ${r}|${z(i.value)}${t ? "|" + t : ""}`;
}
function Q(i) {
  let r = i.replace(/\r/g, "").split(`
`);
  if (r.shift()?.trim() !== "```structured-field" || r.pop()?.trim() !== "```")
    return null;
  let t = new Map(),
    e = {},
    o = [],
    s = !1,
    n = [];
  for (let k = 0; k < r.length; k++) {
    let T = r[k];
    if (s) {
      if (/^\s*item: /.test(T)) {
        n.push(T.trim());
        continue;
      }
      o.push(fug(T.replace(/^ {1,2}/, "")));
      continue;
    }
    // Indented item lines are still item lines. Without this an indented
    // `  item: x` fell through to the metadata branch and was re-emitted as a
    // line that no longer parsed back the same way.
    if (/^\s*item: /.test(T)) {
      n.push(T.trim());
      continue;
    }
    let b = T.indexOf(":");
    if (b < 0) continue;
    let D = T.slice(0, b).trim(),
      x = T.slice(b + 1).trimStart();
    if (D === "label" && x === "|" && r[k + 1]?.startsWith("  ")) {
      let H = [];
      for (; r[k + 1]?.startsWith("  ");)
        H.push(fug(r[++k].replace(/^ {1,2}/, "")));
      t.set(
        "label",
        H.join(`
`),
      );
      continue;
    }
    if (D === "value" && x === "|") {
      s = !0;
      continue;
    }
    pt.has(D) ? t.set(D, x) : (e[D] = x);
  }
  let a = t.get("type") || "text";
  if (!$t.has(a)) return null;
  let d = oe(t.get("width")),
    c = t.get("direction"),
    u = t.get("align"),
    p = Number.parseFloat(t.get("height") || ""),
    l = {},
    f = t.get("title-size");
  f && re.has(f) && (l.size = f);
  let m = t.get("title-weight");
  m && ie.has(m) && (l.weight = m);
  let v = t.get("title-color");
  (v && (l.color = v), t.get("title-italic") === "true" && (l.italic = !0));
  let g = t.get("title-direction");
  (g === "ltr" || g === "rtl" || g === "auto") && (l.direction = g);
  let h = n.map((k) => ne(k)).filter((k) => k !== null),
    // A secret item inside a non-secret field still has to start masked. The old
    // default only looked at the field type, so `item: secret|x` on a text field
    // was stored in plain sight.
    isSecret = a === "secret" || h.some((k) => k.kind === "secret");
  return {
    kind: "field",
    id: t.get("id") || $(),
    label: t.get("label") ?? "Label",
    type: a,
    hideLabel: t.get("label-hidden") === "true" || void 0,
    value: s
      ? o.join(`
`)
      : t.get("value") || "",
    width: d,
    height: Number.isFinite(p) ? Math.max(0, p) : void 0,
    offset: Number.isFinite(Number.parseFloat(t.get("offset") || ""))
      ? Math.max(0, Number.parseFloat(t.get("offset")))
      : void 0,
    row: t.get("row") || void 0,
    align: u === "center" || u === "end" ? u : "start",
    direction: c === "ltr" || c === "rtl" ? c : "auto",
    masked: t.has("masked") ? t.get("masked") !== "false" : isSecret,
    required: t.get("required") === "true",
    placeholder: t.get("placeholder") || void 0,
    defaultValue: t.get("default") || void 0,
    options: t
      .get("options")
      ?.split(",")
      .map((k) => k.trim())
      .filter(Boolean),
    prefix: t.get("prefix") || void 0,
    suffix: t.get("suffix") || void 0,
    help: t.get("help") || void 0,
    validation: t.get("validation") || void 0,
    metadata: Object.keys(e).length ? e : void 0,
    items: h.length > 0 || t.get("items") === "[]" ? h : void 0,
    titleStyle: Object.keys(l).length > 0 ? l : void 0,
  };
}
function W(i) {
  let r = needsBlock(i.label)
      ? [
          "label: |",
          ...i.label.split(`\n`).map((e) => `  ${fg(e)}`),
        ]
      : [`label: ${i.label}`],
    t = [
      "```structured-field",
      `id: ${i.id}`,
      ...r,
      `type: ${i.type}`,
      `width: ${se(i.width)}`,
    ];
  if ((i.hideLabel && t.push("label-hidden: true"), i.height)) {
    let e = typeof i.height == "number" ? Math.round(i.height) : i.height;
    t.push(`height: ${e}px`);
  }
  if (
    (i.offset && t.push(`offset: ${i.offset}px`),
    i.items?.length === 0 && t.push("items: []"),
    i.row && t.push(`row: ${i.row}`),
    i.align && i.align !== "start" && t.push(`align: ${i.align}`),
    i.direction &&
      i.direction !== "auto" &&
      t.push(`direction: ${i.direction}`),
    i.masked === !1 &&
      (i.type === "secret" || i.items?.some((e) => e.kind === "secret")) &&
      t.push("masked: false"),
    i.required && t.push("required: true"),
    i.placeholder && t.push(`placeholder: ${i.placeholder}`),
    i.defaultValue && t.push(`default: ${i.defaultValue}`),
    i.options?.length && t.push(`options: ${i.options.join(", ")}`),
    i.prefix && t.push(`prefix: ${i.prefix}`),
    i.suffix && t.push(`suffix: ${i.suffix}`),
    i.help && t.push(`help: ${i.help}`),
    i.validation && t.push(`validation: ${i.validation}`),
    i.titleStyle)
  ) {
    let e = i.titleStyle;
    (e.size && t.push(`title-size: ${e.size}`),
      e.weight && t.push(`title-weight: ${e.weight}`),
      e.color && t.push(`title-color: ${e.color}`),
      e.italic && t.push("title-italic: true"),
      e.direction && t.push(`title-direction: ${e.direction}`));
  }
  // Custom keys are re-emitted verbatim, so only ones that would read back the
  // same way are kept. Dots, dashes, underscores and spaces are all safe -- the
  // parser splits on the first colon and trims the key -- so they are kept.
  // Dropped: an empty key (a stray ": value" line), a reserved key, the literal
  // "item" (would come back as an item line), a key or value that could close
  // the code fence, and any value carrying a newline.
  for (let [e, o] of Object.entries(i.metadata || {})) {
    let k = e.trim();
    if (!k || pt.has(k) || k === "item" || /^`{3,}/.test(k)) continue;
    let v = String(o);
    if (/^ {0,3}```/.test(v) || /[\r\n]/.test(v)) continue;
    t.push(`${k}: ${v}`);
  }
  if (i.items && i.items.length > 0) for (let e of i.items) t.push(ae(e));
  else if (needsBlock(i.value)) {
    t.push("value: |");
    for (let e of i.value.split(`\n`)) t.push(`  ${fg(e)}`);
  } else t.push(`value: ${i.value}`);
  return (
    t.push("```"),
    t.join(`
`)
  );
}
function R(i) {
  let r = [],
    t = /```structured-field\r?\n[\s\S]*?\r?\n```/g;
  for (let e of i.matchAll(t)) {
    let o = Q(e[0]);
    o &&
      e.index !== void 0 &&
      r.push({ from: e.index, to: e.index + e[0].length, field: o });
  }
  return r;
}
function de() {
  return {
    title: "Structured card",
    layout: "auto",
    size: "medium",
    density: "comfortable",
    sections: [{ title: "Details", items: [] }],
  };
}
function ft(i) {
  let r = i.replace(/\r/g, "").split(`
`);
  if (r.shift()?.trim() !== "```structured-card" || r.pop()?.trim() !== "```")
    return null;
  let t = de();
  t.sections = [];
  let e;
  for (let o of r) {
    let s = o.trimEnd();
    if (!(!s || s.startsWith("<!--"))) {
      if (s.startsWith("title: ")) t.title = s.slice(7);
      else if (
        s.startsWith("layout: ") &&
        ["auto", "1", "2", "3", "4"].includes(s.slice(8))
      )
        t.layout = s.slice(8);
      else if (
        s.startsWith("size: ") &&
        ["small", "medium", "large", "custom"].includes(s.slice(6))
      )
        t.size = s.slice(6);
      else if (s.startsWith("gap: ")) t.gap = Number(s.slice(5)) || void 0;
      else if (
        s.startsWith("density: ") &&
        ["compact", "comfortable"].includes(s.slice(9))
      )
        t.density = s.slice(9);
      else if (s.startsWith("full-width: "))
        t.fullWidth = s.slice(12) === "true";
      else if (s.startsWith("custom-width: ")) t.customWidth = s.slice(14);
      else if (s.startsWith("breakpoint: "))
        t.breakpoint = Number(s.slice(12)) || void 0;
      else if (s.startsWith("## "))
        ((e = { title: s.slice(3), items: [] }), t.sections.push(e));
      else if (e && s.startsWith("section-gap: "))
        e.gap = Number(s.slice(13)) || void 0;
      else if (e && s === "section-full-width: true") e.fullWidth = !0;
      else if (e && s === "---") e.items.push({ kind: "separator", value: "" });
      else if (e && s.startsWith("! "))
        e.items.push({ kind: "heading", value: s.slice(2) });
      else if (e && s.startsWith(". "))
        e.items.push({ kind: "text", value: s.slice(2) });
      else if (e && s.startsWith("- ")) {
        let n = At(s.slice(2)),
          a = n[1];
        if (!$t.has(a)) continue;
        let d = new Map(
            n
              .slice(3)
              .filter(Boolean)
              .map((u) => {
                let p = u.indexOf("=");
                return p < 1 ? [u, ""] : [u.slice(0, p), B(u.slice(p + 1))];
              }),
          ),
          c = {
            kind: "field",
            id: d.get("id") || $(),
            label: B(n[0]),
            type: a,
            value: B(n[2] || ""),
            fullWidth: !1,
            direction: "auto",
            masked: a === "secret",
          };
        (d.has("default") && (c.defaultValue = d.get("default")),
          d.has("options") && (c.options = d.get("options")?.split(",").map(B)),
          d.has("span") && (c.span = Number(d.get("span"))),
          d.get("full") === "true" && (c.fullWidth = !0),
          d.has("dir") && (c.direction = d.get("dir")),
          d.get("masked") === "false" && (c.masked = !1),
          d.get("required") === "true" && (c.required = !0));
        for (let [u, p] of d)
          [
            "id",
            "default",
            "options",
            "span",
            "full",
            "dir",
            "copy",
            "masked",
            "required",
            "placeholder",
            "min-width",
            "class",
            "prefix",
            "suffix",
            "help",
            "validation",
          ].includes(u) || ((c.metadata ||= {})[u] = p);
        (d.has("placeholder") && (c.placeholder = d.get("placeholder")),
          d.has("min-width") && (c.minWidth = d.get("min-width")),
          d.has("class") && (c.cssClass = d.get("class")),
          d.has("prefix") && (c.prefix = d.get("prefix")),
          d.has("suffix") && (c.suffix = d.get("suffix")),
          d.has("help") && (c.help = d.get("help")),
          d.has("validation") && (c.validation = d.get("validation")),
          e.items.push(c));
      } else if (!e && s.includes(":")) {
        let n = s.indexOf(":");
        (t.metadata ||= {})[s.slice(0, n).trim()] = s.slice(n + 1).trim();
      }
    }
  }
  return t.sections.length ? t : null;
}
function mt(i) {
  let r = [
    "```structured-card",
    `title: ${i.title ?? "Structured card"}`,
    `layout: ${["auto", "1", "2", "3", "4"].includes(i.layout) ? i.layout : "auto"}`,
    `size: ${["small", "medium", "large", "custom"].includes(i.size) ? i.size : "medium"}`,
  ];
  (i.gap && r.push(`gap: ${i.gap}`),
    i.density &&
      ["compact", "comfortable"].includes(i.density) &&
      r.push(`density: ${i.density}`),
    i.fullWidth && r.push("full-width: true"),
    i.customWidth && r.push(`custom-width: ${i.customWidth}`),
    i.breakpoint && r.push(`breakpoint: ${i.breakpoint}`));
  for (let [t, e] of Object.entries(i.metadata || {})) r.push(`${t}: ${e}`);
  for (let t of i.sections) {
    (r.push("", `## ${t.title}`),
      t.gap && r.push(`section-gap: ${t.gap}`),
      t.fullWidth && r.push("section-full-width: true"));
    for (let e of t.items)
      if (e.kind === "separator") r.push("---");
      else if (e.kind === "heading") r.push(`! ${e.value}`);
      else if (e.kind === "text") r.push(`. ${e.value}`);
      else {
        let o = [
          `id=${e.id}`,
          e.defaultValue !== void 0 ? `default=${z(e.defaultValue)}` : "",
          e.options?.length ? `options=${e.options.map(z).join(",")}` : "",
          e.span && e.span > 1 ? `span=${e.span}` : "",
          e.fullWidth ? "full=true" : "",
          e.direction && e.direction !== "auto" ? `dir=${e.direction}` : "",
          e.masked === !1 ? "masked=false" : "",
          e.required ? "required=true" : "",
          e.placeholder ? `placeholder=${z(e.placeholder)}` : "",
          e.minWidth ? `min-width=${z(e.minWidth)}` : "",
          e.cssClass ? `class=${z(e.cssClass)}` : "",
          e.prefix ? `prefix=${z(e.prefix)}` : "",
          e.suffix ? `suffix=${z(e.suffix)}` : "",
          e.help ? `help=${z(e.help)}` : "",
          e.validation ? `validation=${z(e.validation)}` : "",
          ...Object.entries(e.metadata || {}).map(([s, n]) => `${s}=${z(n)}`),
        ].filter(Boolean);
        r.push(`- ${z(e.label)}|${e.type}|${z(e.value)}|${o.join("|")}`);
      }
  }
  return (
    r.push("```"),
    r.join(`
`)
  );
}
function Pt(i) {
  let r = [],
    t = /```structured-card\r?\n[\s\S]*?\r?\n```/g;
  for (let e of i.matchAll(t)) {
    let o = ft(e[0]);
    o &&
      e.index !== void 0 &&
      r.push({ from: e.index, to: e.index + e[0].length, card: o });
  }
  return r;
}
var q = require("obsidian");
// The card renderer is reached from reading-mode renderers and CodeMirror
// widgets that have no `app` in scope, so keep one reference for the modals
// that replace the old native prompt()/confirm() calls.
var App = null,
  M = null,
  le = (i) => /[\u0590-\u08ff]/.test(i);
/** Modal replacement for window.confirm(). `open(cb)` passes true/false. */
var ConfirmModal = class extends q.Modal {
  constructor(t, e) {
    super(t);
    (this.opts = e), (this.result = !1);
  }
  onOpen() {
    this.modalEl.addClass("structured-cards-root", "sc-confirm-modal"),
      this.titleEl.setText(this.opts.title);
    let t = this.contentEl;
    t.createEl("p", { text: this.opts.message }),
      new q.Setting(t).addButton((e) =>
        e
          .setButtonText(this.opts.cta || "Confirm")
          .setWarning()
          .onClick(() => {
            (this.result = !0), this.close();
          }),
      ),
      new q.Setting(t).addButton((e) =>
        e.setButtonText("Cancel").onClick(() => this.close()),
      );
  }
  onClose() {
    (this.contentEl.empty(), this.opts.onResult?.(this.result));
  }
};
/** Modal replacement for window.prompt() for a bounded integer. */
var NumberPrompt = class extends q.Modal {
  constructor(t, e) {
    super(t);
    (this.opts = e), (this.result = null);
  }
  onOpen() {
    let { title, desc, min, max, value } = this.opts;
    this.modalEl.addClass("structured-cards-root", "sc-number-modal"),
      this.titleEl.setText(title);
    let t = this.contentEl;
    if (desc) t.createEl("p", { text: desc });
    let o = t.createEl("input", {
      attr: { type: "number", min: String(min), max: String(max) },
    });
    (o.value = String(value),
      o.select(),
      o.addEventListener("keydown", (e) => {
        "Enter" === e.key &&
          (e.preventDefault(), new q.Setting(t).settingEl.remove(), this.finish());
      }));
    new q.Setting(t).addButton((e) =>
      e
        .setButtonText("Save")
        .setCta()
        .onClick(() => this.finish()),
    );
    setTimeout(() => o.focus(), 0);
  }
  finish() {
    let { min, max } = this.opts,
      n = Number(o_value(this));
    this.result = Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : null;
    this.close();
  }
  onClose() {
    (this.contentEl.empty(), this.opts.onResult?.(this.result));
  }
};
function o_value(i) {
  return i.contentEl.querySelector('input[type="number"]')?.value ?? "";
}
/** Modal replacement for window.prompt() when free text is wanted. */
var TextPrompt = class extends q.Modal {
  constructor(t, e) {
    super(t);
    (this.opts = e), (this.result = null);
  }
  onOpen() {
    this.modalEl.addClass("structured-cards-root", "sc-text-modal"),
      this.titleEl.setText(this.opts.title);
    let t = this.contentEl;
    this.opts.desc && t.createEl("p", { text: this.opts.desc });
    let o = t.createEl("textarea", {
      cls: "sc-template-source",
      attr: {
        rows: this.opts.rows || "8",
        placeholder: this.opts.placeholder || "",
      },
    });
    (o.value = this.opts.value || ""),
      o.addEventListener("keydown", (e) => {
        "Enter" === e.key &&
          (e.ctrlKey || e.metaKey) &&
          (e.preventDefault(), this.finish(o.value));
      });
    new q.Setting(t).addButton((e) =>
      e
        .setButtonText("Save")
        .setCta()
        .onClick(() => this.finish(o.value)),
    );
    setTimeout(() => {
      (o.focus(), o.select());
    }, 0);
  }
  finish(t) {
    (this.result = t), this.close();
  }
  onClose() {
    (this.contentEl.empty(), this.opts.onSubmit?.(this.result));
  }
};
function bt(i, r, t, e, o = {}) {
  (i.empty(),
    i.classList.remove(
      "sc-size-small",
      "sc-size-medium",
      "sc-size-large",
      "sc-size-custom",
      "sc-cols-auto",
      "sc-cols-1",
      "sc-cols-2",
      "sc-cols-3",
      "sc-cols-4",
      "sc-density-compact",
      "sc-density-comfortable",
      "sc-card-full",
      "sc-no-animation",
      "sc-responsive",
    ),
    i.style.removeProperty("--sc-gap"),
    i.style.removeProperty("max-width"),
    i.addClass(
      "structured-cards-root",
      "sc-card",
      `sc-size-${r.size}`,
      `sc-cols-${r.layout}`,
      `sc-density-${r.density || "comfortable"}`,
    ),
    i.toggleClass("sc-card-full", !!r.fullWidth),
    i.toggleClass("sc-no-animation", !e.animations),
    i.toggleClass("sc-responsive", e.responsive),
    r.gap && i.style.setProperty("--sc-gap", `${r.gap}px`),
    r.customWidth && r.size === "custom" && (i.style.maxWidth = r.customWidth),
    i.setAttr("role", "region"),
    i.setAttr("aria-label", r.title));
  let s = i.createDiv({ cls: "sc-card-header" }),
    n = s.createEl("h3", { text: r.title });
  ((n.contentEditable = e.showEditingControls ? "true" : "false"),
    n.setAttr("aria-label", "Card title"),
    (n.onblur = () => {
      let d = n.textContent?.trim() || "Structured card";
      d !== r.title && ((r.title = d), t(r));
    }),
    e.showEditingControls && ue(s, r, t));
  let a = i.createDiv({ cls: "sc-sections" });
  if (
    (r.sections.forEach((d, c) => pe(a, r, d, c, t, e, o)),
    e.showEditingControls)
  ) {
    let d = i.createDiv({ cls: "sc-card-footer sc-edit-control" });
    xt(
      d,
      "plus",
      "Add section",
      () => {
        (r.sections.push({ title: "New section", items: [] }), t(r));
      },
      "+ Section",
    );
  }
}
function ue(i, r, t) {
  let e = i.createEl("details", { cls: "sc-layout-panel sc-edit-control" }),
    o = e.createEl("summary", {
      attr: { "aria-label": "Card layout settings", title: "Card layout" },
    });
  (0, q.setIcon)(o, "layout-grid");
  let s = e.createDiv({ cls: "sc-layout-body" });
  (ht(
    s,
    "Columns",
    ["auto", "1", "2", "3", "4"],
    r.layout,
    (n) => (r.layout = n),
  ),
    ht(
      s,
      "Size",
      ["small", "medium", "large", "custom"],
      r.size,
      (n) => (r.size = n),
    ),
    ht(
      s,
      "Density",
      ["compact", "comfortable"],
      r.density || "comfortable",
      (n) => (r.density = n),
    ),
    ve(s, "Card gap", r.gap ?? 10, 0, 48, (n) => (r.gap = n)),
    xe(
      s,
      "Custom width",
      r.customWidth || "",
      (n) => (r.customWidth = n),
      "760px or 100%",
    ),
    we(s, "Full width", !!r.fullWidth, (n) => (r.fullWidth = n)),
    xt(
      s,
      "check",
      "Apply layout",
      () => {
        ((e.open = !1), t(r));
      },
      "Apply",
    ));
}
function pe(i, r, t, e, o, s, n) {
  let a = i.createDiv({ cls: "sc-section" });
  (t.fullWidth && a.addClass("sc-section-full"),
    t.gap && a.style.setProperty("--sc-section-gap", `${t.gap}px`),
    (a.ondragover = (l) => {
      M?.card === r && (l.preventDefault(), a.addClass("sc-drop-section"));
    }),
    (a.ondragleave = () => a.removeClass("sc-drop-section")),
    (a.ondrop = (l) => {
      (l.preventDefault(),
        a.removeClass("sc-drop-section"),
        !(!M || M.card !== r) &&
          (M.kind === "section"
            ? gt(r, M.section, e)
            : V(r, M.section, M.item, e, t.items.length),
          (M = null),
          o(r)));
    }));
  let d = a.createDiv({ cls: "sc-section-head" });
  s.showEditingControls &&
    s.showDragHandles &&
    Ht(d, "Drag section", () => {
      M = { card: r, kind: "section", section: e };
    });
  let c = d.createEl("h4", { text: t.title });
  if (
    ((c.contentEditable = s.showEditingControls ? "true" : "false"),
    c.setAttr("aria-label", "Section name"),
    (c.onblur = () => {
      let l = c.textContent?.trim() || "Untitled section";
      l !== t.title && ((t.title = l), o(r));
    }),
    s.showEditingControls)
  ) {
    let l = d.createDiv({ cls: "sc-item-tools sc-edit-control" });
    (I(
      l,
      "arrow-up",
      "Move section up",
      () => {
        (gt(r, e, e - 1), o(r));
      },
      e === 0,
    ).addClass("sc-a11y-control"),
      I(
        l,
        "arrow-down",
        "Move section down",
        () => {
          (gt(r, e, e + 1), o(r));
        },
        e === r.sections.length - 1,
      ).addClass("sc-a11y-control"),
      I(l, "between-horizontal-start", "Set section gap", () => {
        new q.NumberPrompt(App, {
          title: "Section gap",
          desc: `Gap before \u201C${t.title}\u201D, in pixels.`,
          min: 0,
          max: 48,
          value: t.gap ?? 10,
          onResult: (f) => {
            f !== null && ((t.gap = f), o(r));
          },
        }).open();
      }),
      I(l, "copy", "Duplicate section", () => {
        (r.sections.splice(e + 1, 0, clonePlain(t)), o(r));
      }),
      I(l, "trash-2", "Delete section", () => {
        new q.ConfirmModal(App, {
          title: "Delete section",
          message: `Delete section \u201C${t.title}\u201D and everything in it?`,
          cta: "Delete",
          onResult: (ok) => {
            ok && (r.sections.splice(e, 1), o(r));
          },
        }).open();
      }));
  }
  let u = a.createDiv({ cls: "sc-grid" });
  t.items.forEach((l, f) => fe(u, l, r, e, f, o, s, n));
  let p = u.createDiv({
    cls: "sc-drop-zone",
    attr: { "aria-label": `Move item to end of ${t.title}` },
  });
  ((p.ondragover = (l) => {
    M?.kind === "item" &&
      M.card === r &&
      (l.preventDefault(), p.addClass("is-active"));
  }),
    (p.ondragleave = () => p.removeClass("is-active")),
    (p.ondrop = (l) => {
      (l.preventDefault(),
        p.removeClass("is-active"),
        M?.kind === "item" &&
          M.card === r &&
          (V(r, M.section, M.item, e, t.items.length), (M = null), o(r)));
    }),
    s.showEditingControls && he(a, r, t, o));
}
function fe(i, r, t, e, o, s, n, a) {
  let c = i.createDiv({ cls: `sc-item sc-item-${r.kind}` });
  if (r.kind === "field") {
    (r.fullWidth && c.addClass("sc-full"),
      r.span && r.span > 1 && (c.style.gridColumn = `span ${r.span}`),
      r.minWidth && (c.style.minWidth = r.minWidth));
    for (let u of ye(r.cssClass)) c.addClass(u);
  } else c.addClass("sc-full");
  if (
    ((c.ondragover = (u) => {
      M?.kind === "item" &&
        M.card === t &&
        (u.preventDefault(), c.addClass("sc-drop-before"));
    }),
    (c.ondragleave = () => c.removeClass("sc-drop-before")),
    (c.ondrop = (u) => {
      (u.preventDefault(),
        c.removeClass("sc-drop-before"),
        M?.kind === "item" &&
          M.card === t &&
          (V(t, M.section, M.item, e, o), (M = null), s(t)));
    }),
    n.showEditingControls &&
      n.showDragHandles &&
      Ht(c, "Drag item", () => {
        M = { card: t, kind: "item", section: e, item: o };
      }),
    r.kind === "separator")
  )
    c.createDiv({ cls: "sc-separator" });
  else if (r.kind === "heading" || r.kind === "text") {
    let u =
      r.kind === "heading"
        ? c.createEl("h5", { text: r.value, cls: "sc-static-heading" })
        : c.createDiv({ text: r.value, cls: "sc-static-text" });
    ((u.contentEditable = n.showEditingControls ? "true" : "false"),
      (u.onblur = () => {
        ((r.value = u.textContent || (r.kind === "heading" ? "Heading" : "")),
          s(t));
      }));
  } else me(c, r, t, s, n);
  n.showEditingControls && ge(c, r, t, e, o, s, a);
}
function me(i, r, t, e, o) {
  let s = i.createEl("label", { text: r.label, cls: "sc-label" });
  ((s.contentEditable = o.showEditingControls ? "true" : "false"),
    (s.onblur = () => {
      ((r.label = s.textContent?.trim() || "Field"), e(t));
    }));
  let n = i.createDiv({ cls: "sc-controls" });
  r.prefix && n.createSpan({ cls: "sc-affix", text: r.prefix });
  let a = be(n, r, o.revealSecrets);
  // The label is a sibling of the input, not its parent, so it has to point at
  // it explicitly or clicking the text never focuses the field.
  (a.id || (a.id = `sc-in-${$()}`),
    (s.htmlFor = a.id),
    a.setAttr("aria-label", r.label),
    (a.required = !!r.required));
  let d =
    r.direction && r.direction !== "auto"
      ? r.direction
      : o.defaultDirection !== "auto"
        ? o.defaultDirection
        : le(r.value)
          ? "rtl"
          : "ltr";
  (a.setAttr("dir", d),
    "placeholder" in a && (a.placeholder = r.placeholder || r.defaultValue || ""),
    r.validation &&
      (a.setAttr("pattern", r.validation), a.setAttr("title", r.validation)),
    (a.onchange = () => {
      ((r.value = a.value), e(t));
    }),
    r.suffix && n.createSpan({ cls: "sc-affix", text: r.suffix }),
    r.help && i.createDiv({ cls: "sc-help", text: r.help }));
}
function ge(i, r, t, e, o, s, n) {
  let a = i.createDiv({ cls: "sc-item-tools sc-edit-control" });
  (I(
    a,
    "arrow-up",
    "Move item up",
    () => {
      (V(t, e, o, e, o - 1), s(t));
    },
    o === 0,
  ).addClass("sc-a11y-control"),
    I(
      a,
      "arrow-down",
      "Move item down",
      () => {
        (V(t, e, o, e, o + 1), s(t));
      },
      o === t.sections[e].items.length - 1,
    ).addClass("sc-a11y-control"),
    I(
      a,
      "corner-left-up",
      "Move to previous section",
      () => {
        (V(t, e, o, e - 1, t.sections[e - 1]?.items.length ?? 0), s(t));
      },
      e === 0,
    ).addClass("sc-a11y-control"),
    I(
      a,
      "corner-right-down",
      "Move to next section",
      () => {
        (V(t, e, o, e + 1, t.sections[e + 1]?.items.length ?? 0), s(t));
      },
      e === t.sections.length - 1,
    ).addClass("sc-a11y-control"),
    I(a, "copy", "Duplicate item", () => {
      let d = clonePlain(r);
      (d.kind === "field" && (d.id = $()),
        t.sections[e].items.splice(o + 1, 0, d),
        s(t));
    }),
    r.kind === "field" &&
      I(a, "settings-2", "Field properties", () =>
        n.onFieldProperties?.(r, (d) => {
          (Object.assign(r, d), s(t));
        }),
      ),
    I(a, "trash-2", "Delete item", () => {
      new q.ConfirmModal(App, {
        title: "Delete item",
        message: `Delete \u201C${r.kind === "field" ? r.label : r.value || r.kind}\u201D?`,
        cta: "Delete",
        onResult: (ok) => {
          ok && (t.sections[e].items.splice(o, 1), s(t));
        },
      }).open();
    }));
}
function he(i, r, t, e) {
  let o = i.createEl("details", { cls: "sc-add-menu sc-edit-control" });
  o.createEl("summary", { text: "+ Add" });
  let s = o.createDiv(),
    n = (a, d) =>
      xt(
        s,
        "plus",
        a,
        () => {
          (t.items.push(d), (o.open = !1), e(r));
        },
        a,
      );
  (n("Field", {
    kind: "field",
    id: $(),
    label: "New field",
    type: "text",
    value: "",
    direction: "auto"
  }),
    n("Heading", { kind: "heading", value: "Heading" }),
    n("Text", { kind: "text", value: "Explanatory text" }),
    n("Separator", { kind: "separator", value: "" }));
}
function be(i, r, t) {
  if (r.type === "multiline") {
    let o = i.createEl("textarea", { cls: "sc-input" });
    return ((o.value = r.value), (o.rows = 3), o);
  }
  if (r.type === "select") {
    let o = i.createEl("select", { cls: "sc-input" }),
      s = r.options?.length ? r.options : [r.value || "Select\u2026"];
    for (let n of s) o.createEl("option", { text: n, value: n });
    return ((o.value = r.value), o);
  }
  let e = i.createEl("input", { cls: "sc-input" });
  return (
    (e.value = r.value),
    (e.type =
      r.type === "secret" && r.masked !== !1 && !t
        ? "password"
        : r.type === "number"
          ? "number"
          : r.type === "url"
            ? "url"
            : "text"),
    r.validation && (e.pattern = r.validation),
    r.type === "secret" &&
      I(i, "eye", "Show or hide secret", () => {
        e.type = e.type === "password" ? "text" : "password";
      }),
    e
  );
}
function gt(i, r, t) {
  if (
    r < 0 ||
    t < 0 ||
    r >= i.sections.length ||
    t >= i.sections.length ||
    r === t
  )
    return;
  let [e] = i.sections.splice(r, 1);
  i.sections.splice(t, 0, e);
}
/**
 * Move a card item to slot `o` of section `e`.
 *
 * `o` is the target index in the ORIGINAL ordering. Removing the item first
 * shifts every later slot down by one, so inserting at `o` afterwards lands it
 * back on `o`. An extra decrement here used to cancel the move out entirely,
 * which made "Move item down" a silent no-op for every item.
 */
function V(i, r, t, e, o) {
  let s = i.sections[r],
    n = i.sections[e];
  if (!s || !n || !s.items[t]) return;
  if (!Number.isInteger(o) || o < 0) return;
  let [a] = s.items.splice(t, 1);
  n.items.splice(Math.max(0, Math.min(o, n.items.length)), 0, a);
}
function Ht(i, r, t) {
  let e = i.createSpan({
    cls: "sc-drag-handle sc-edit-control",
    attr: {
      draggable: "true",
      "aria-label": r,
      title: r,
      role: "button",
      tabindex: "0",
    },
  });
  ((0, q.setIcon)(e, "grip-vertical"),
    (e.ondragstart = (o) => {
      (t(),
        o.dataTransfer?.setData("text/plain", "structured-card-item"),
        o.dataTransfer && (o.dataTransfer.effectAllowed = "move"),
        e.closest(".sc-item,.sc-section")?.addClass("is-dragging"),
        (e.__releaseHover = scHoverLock()));
    }),
    (e.ondragend = () => {
      (e.__releaseHover?.(),
        (e.__releaseHover = null),
        (M = null),
        document
          .querySelectorAll(
            ".is-dragging,.sc-drop-before,.sc-drop-section,.is-active",
          )
          .forEach((o) =>
            o.removeClass(
              "is-dragging",
              "sc-drop-before",
              "sc-drop-section",
              "is-active",
            ),
          ));
    }));
}
function I(i, r, t, e, o = !1) {
  let s = i.createEl("button", {
    cls: "sc-icon",
    attr: { "aria-label": t, title: t, type: "button" },
  });
  return (
    (0, q.setIcon)(s, r),
    (s.disabled = o),
    (s.onclick = (n) => {
      (n.preventDefault(), e());
    }),
    s
  );
}
function xt(i, r, t, e, o) {
  let s = i.createEl("button", {
    cls: "sc-button",
    attr: { "aria-label": t, title: t, type: "button" },
  });
  return (
    r && (0, q.setIcon)(s, r),
    o && s.createSpan({ text: o }),
    (s.onclick = (n) => {
      (n.preventDefault(), e());
    }),
    s
  );
}
function ht(i, r, t, e, o) {
  let s = i.createEl("label", { cls: "sc-control-row" });
  s.createSpan({ text: r });
  let n = s.createEl("select");
  for (let a of t)
    n.createEl("option", {
      value: a,
      text: a === "auto" ? "Auto" : a[0].toUpperCase() + a.slice(1),
    });
  ((n.value = e), (n.onchange = () => o(n.value)));
}
function xe(i, r, t, e, o = "") {
  let s = i.createEl("label", { cls: "sc-control-row" });
  s.createSpan({ text: r });
  let n = s.createEl("input", { type: "text", placeholder: o });
  ((n.value = t), (n.oninput = () => e(n.value)));
}
function ve(i, r, t, e, o, s) {
  let n = i.createEl("label", { cls: "sc-control-row" });
  n.createSpan({ text: r });
  let a = n.createEl("input", {
    type: "number",
    value: String(t),
    attr: { min: String(e), max: String(o) },
  });
  a.oninput = () => s(Math.max(e, Math.min(o, Number(a.value) || 0)));
}
function we(i, r, t, e) {
  let o = i.createEl("label", { cls: "sc-control-row" });
  o.createSpan({ text: r });
  let s = o.createEl("input", { type: "checkbox" });
  ((s.checked = t), (s.onchange = () => e(s.checked)));
}
function ye(i) {
  return (i || "")
    .split(/\s+/)
    .filter((r) => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(r));
}
var N = require("obsidian");
function vt(i) {
  return i === void 0 ? "100%" : typeof i == "number" ? `${i}%` : i;
}
// A field narrower than this is unusable, and 0px fields are unrecoverable
// because the shell collapses and the resize handles fall outside it.
var MIN_FIELD_WIDTH = 60;

/**
 * Translate a pointer drag on a resize handle into a new width/offset pair.
 *
 * `o` is the space physically available to the field, so the result is always
 * clamped into [MIN_FIELD_WIDTH, available]. Without the lower bound a field
 * squeezed against a narrow container produced `width: 0px`.
 */
function ke(i, r, t, e) {
  let o = Math.max(
      MIN_FIELD_WIDTH,
      t === "left" ? i.width + i.offset : e - i.offset,
    ),
    s = Math.min(180, o),
    n = Math.round(
      Math.max(s, Math.min(o, i.width + (t === "left" ? -r : r))),
    );
  return {
    width: n,
    offset: t === "left" ? Math.max(0, i.offset + i.width - n) : i.offset,
  };
}
function It(i) {
  ((i.width = void 0), (i.height = void 0), (i.offset = void 0));
}
var Rt = new WeakMap();
function ot(i) {
  Rt.get(i)?.cancel();
}
function wt(i, r) {
  (i.toggleAttribute("data-auto-width", r.width === void 0),
    r.row ? (i.dataset.row = r.row) : delete i.dataset.row,
    i.style.setProperty("--sc-field-width", vt(r.width)),
    i.style.setProperty("--sc-field-offset", `${r.offset || 0}px`));
  let t = i.querySelector(".sc-field-shell");
  r.height
    ? t?.style.setProperty(
        "--sc-field-height",
        `${Number.parseFloat(String(r.height))}px`,
      )
    : t?.style.removeProperty("--sc-field-height");
  applyTitleAlign(i, r);
}
/**
 * Title alignment from the field menu (`align:`). The field root is forced to
 * LTR for geometry, so this lives on the boxes' own text alignment --
 * START clears back to the stylesheet default, CENTER/END text-align what the
 * box contains. It covers the FIELD LABEL and every TITLE ITEM's text box:
 * on an item-based card the title the user types lives in its own full-width
 * box, so aligning only the label moved nothing they were looking at. Applied
 * both at build and on the reuse path (wt), so an alignment change reaches
 * the screen without a full rebuild of anything else the shape compare lets
 * stand. Value boxes are deliberately untouched: this is title alignment.
 */
function applyTitleAlign(i, r) {
  let e = r.align === "center" || r.align === "end" ? r.align : "";
  let t = i.querySelector(".sc-field-label-wrap");
  t && (t.style.textAlign = e);
  for (let n of i.querySelectorAll(".sc-item-title-wrap"))
    n.style.textAlign = e;
}
function Ee(i) {
  let r = i.ownerDocument.defaultView.getComputedStyle(i),
    t = i.querySelector(".sc-field-content"),
    e = (o) => Number.parseFloat(o) || 0;
  return (
    (t?.getBoundingClientRect().height || 0) +
    e(r.paddingTop) +
    e(r.paddingBottom) +
    e(r.borderTopWidth) +
    e(r.borderBottomWidth)
  );
}
function Ce(i) {
  let r = i.parentElement,
    t = i.ownerDocument.defaultView;
  for (; r;) {
    let e = r.getBoundingClientRect(),
      o = t.getComputedStyle(r);
    if (e.width > 0 && o.display !== "contents")
      return Math.max(
        0,
        r.clientWidth -
          (parseFloat(o.paddingLeft) || 0) -
          (parseFloat(o.paddingRight) || 0),
      );
    r = r.parentElement;
  }
  return i.getBoundingClientRect().width;
}
/**
 * The wrap direction classes, listed statically so tooling that scans the
 * source (tests/checkcss.cjs) can see them without parsing dynamic strings.
 * They re-assert the wrap's resolved direction at author CSS level; see the
 * sc-dir-* rules in styles.css.
 */
const SC_DIR_CLASSES = ["sc-dir-rtl", "sc-dir-ltr", "sc-dir-auto"];

function yt(i, r, t, e, o, s, n, a, h) {
  let d = i.createDiv({
      cls: `sc-text-wrap ${r
        .split(" ")
        .map((l) => l + "-wrap")
        .join(" ")}`,
    }),
    c = d.createDiv({ cls: "sc-text-mirror", attr: { "aria-hidden": "true" } }),
    u = d.createEl("textarea", {
      cls: r,
      attr: { rows: "1", "aria-label": o, spellcheck: a ? "false" : "true" },
    }),
    p = () => {
      let l = t();
      u.value !== l && (u.value = l);
      let f = !!a?.();
      // Display-only hint. A field created by the Insert command is an empty box
      // holding two empty items, which gives the reader nothing to go on. The
      // hint lives on the `placeholder` attribute, so the browser drops it the
      // moment anything is typed, and it is never part of the value -- so it can
      // never be written into the note.
      u.placeholder = l ? "" : String(typeof h == "function" ? h() ?? "" : h ?? "");
      ((d.toggleClass("sc-secret-masked", f),
        (c.textContent =
          (f ? l.replace(/[^\n\r\s]/gu, "\u2022") : l) + "\u200B"),
        // The resolved direction travels twice: as the HTML `dir` attribute
        // (the machine-readable form) and as a sc-dir-* class. The class
        // matters for resilience: an attribute only produces UA-level CSS,
        // and a vault can run another direction plugin whose author-level
        // rules (e.g. `.is-rtl div { direction: rtl }`) would otherwise force
        // their direction through these boxes no matter what was set. For a
        // neutral value the browser itself resolves auto to an LTR base, which
        // the sc-dir-auto rule mirrors.
        (() => {
          let dir = s();
          for (let cls of SC_DIR_CLASSES) d.classList.toggle(cls, cls === "sc-dir-" + dir);
          d.setAttribute("dir", dir);
          // Plugin-owned hints are armored (LRI- first character). While one is
          // showing, sc-hint-ltr keeps it laid out left-to-right at the left
          // edge even inside RTL fields, so an English hint reads as English.
          d.classList.toggle("sc-hint-ltr", u.placeholder.startsWith("\u2066"));
        })()));
    };
  return (
    (u.oninput = (l) => {
      (l.stopPropagation(), e(u.value), p(), n());
    }),
    (u.onbeforeinput = (l) => l.stopPropagation()),
    (u.onkeydown = (l) => {
      (l.stopPropagation(),
        !(
          l.key !== "Enter" ||
          l.isComposing ||
          l.keyCode === 229 ||
          l.ctrlKey ||
          l.metaKey ||
          l.altKey
        ) &&
          (l.preventDefault(),
          u.setRangeText(
            `
`,
            u.selectionStart,
            u.selectionEnd,
            "end",
          ),
          u.dispatchEvent(new Event("input", { bubbles: !0 }))));
    }),
    (u.onpointerdown = (l) => l.stopPropagation()),
    p(),
    { input: u, refresh: p, wrap: d }
  );
}
/**
 * Decide where a reading-view drop would land, from the rendered DOM alone.
 *
 * The reading view has no CodeMirror positions, so a target has to be expressed
 * as a neighbour rather than an offset: another field's id and a placement, the
 * start of the note, or the end. Ct() then turns that into a document edit.
 *
 * There is deliberately no "insert at this point in the middle of a paragraph".
 * Rendered text cannot be mapped back to its source reliably -- emphasis, links
 * and entities all differ -- so a free-text drop snaps to the nearest REAL
 * anchor and the indicator shows exactly where it will land. It never guesses an
 * offset it cannot justify.
 *
 * Returns null when there is nowhere valid to drop, so the caller can hide the
 * indicator rather than offer a target that would be rejected on release.
 */
function hitTestReadingDrop(container, dragged, pt, grab) {
  if (!container || !dragged || !pt) return null;
  let all = Array.from(
    container.querySelectorAll(".sc-standalone-field[data-field-id]"),
  );
  let from = all.indexOf(dragged);
  let fields = all.filter((el) => el !== dragged);

  /**
   * A drop the engine would turn into the document it already had. Offering one
   * is worse than offering nothing: the indicator moves, the release looks
   * successful, and the field stays put.
   *
   * Decided from DOM order, because that is what the user can see. The preview
   * may be stale relative to the file; applyReadingMove refuses the write in that
   * case, so a wrong guess here cannot corrupt anything.
   */
  let meansNothing = (el, placement, side) => {
    let i = all.indexOf(el);
    if (i < 0 || from < 0) return false;
    if (placement === "before") return all[i - 1] === dragged;
    if (placement === "after") return all[i + 1] === dragged;
    // A beside join rewrites the pair as target+moved, or moved+target. It means
    // nothing only when they are ALREADY in that order and adjacent.
    //
    // This used to suppress every beside whose target shared a row with the
    // dragged field. That made two fields inside one row impossible to reorder --
    // and worse, the refusal fell through to the vertical branch below, which
    // answered with a move the user had not asked for.
    //
    // side "right" puts the moved block AFTER the target, so the pair already
    // reads target,moved when the block after the target is the dragged one.
    return side === "left" ? all[i - 1] === dragged : all[i + 1] === dragged;
  };
  let offer = (el, placement, rect, side) =>
    meansNothing(el, placement, side) ? null : {
      kind: "field",
      id: el.dataset.fieldId,
      el,
      placement,
      side,
      rect,
    };

  // "Start of note" and "end of note" are placements too, and they are just as
  // capable of meaning nothing: dropping the first field at the top, or the last
  // one at the bottom. Same rule, same silence.
  let startIsNoop = () => all[0] === dragged,
    endIsNoop = () => all[all.length - 1] === dragged;

  if (!fields.length) return pt.y < 0 ? { kind: "start" } : { kind: "end" };

  /**
   * The comparison is between two FIELD boxes, not between the pointer and a
   * field.
   *
   * The pointer sits wherever the grab handle was, which is near the dragged
   * field's TOP edge. Testing the pointer against a neighbour's edge therefore
   * promoted "before" a whole field-height before the field had actually moved
   * past anything, and demoted "after" by the same amount -- and that offset is
   * the entire reported asymmetry between dragging up and dragging down.
   *
   * Going down, the field's END is what counts: it has passed the neighbour once
   * its bottom edge clears the neighbour's top. Going up, symmetrically, once its
   * top edge clears the neighbour's bottom.
   */
  let base = (grab && grab.rect) || dragged.getBoundingClientRect();
  let dy = pt.y - (grab ? grab.y : pt.y),
    dx = pt.x - (grab ? grab.x : pt.x);
  let mine = { top: base.top + dy, bottom: base.bottom + dy },
    goingDown = dy >= 0,
    // "Beside" joins a row, so it is only offered for a drag that is actually
    // sideways. Offering it while the field is travelling vertically through a
    // neighbour is what made a downward drag answer with a sideways jump.
    sideways = Math.abs(dx) > Math.abs(dy);

  let boxes = fields.map((el) => ({ el, rect: el.getBoundingClientRect() }));
  let choice = null;

  if (sideways) {
    // Horizontal drag: whichever neighbour the pointer is over, at the nearer
    // vertical edge.
    let hit = boxes
        .filter(({ rect: r }) => pt.x >= r.left && pt.x <= r.right)
        .sort((a, b) => Math.min(Math.abs(pt.x - a.rect.left), Math.abs(pt.x - a.rect.right)) -
                         Math.min(Math.abs(pt.x - b.rect.left), Math.abs(pt.x - b.rect.right)))[0];
    if (hit) {
      let r = hit.rect,
        overlaps = mine.bottom > r.top && mine.top < r.bottom;
      choice = offer(
        hit.el,
        overlaps ? "beside" : mine.top + mine.bottom > r.top + r.bottom ? "after" : "before",
        r,
        pt.x < r.left + r.width / 2 ? "left" : "right",
      );
    }
  }

  if (!choice) {
    /**
     * Going down: the field has passed every neighbour whose TOP edge lies above
     * its BOTTOM edge. The last one it passed is where it belongs -- after it.
     * Going up, symmetrically: the first neighbour whose BOTTOM edge is below the
     * field's TOP edge, and the field belongs before that one.
     *
     * This is "count from the end of the field" in the downward direction, and
     * from its start in the upward one. The pointer is nowhere in the decision,
     * which is why the two directions finally agree.
     */
    let target = goingDown
      ? boxes.filter(({ rect: r }) => r.top < mine.bottom).pop()
      : boxes.find(({ rect: r }) => r.bottom > mine.top);
    choice = target
      ? offer(target.el, goingDown ? "after" : "before", target.rect, "right")
      : goingDown
        ? offer(boxes[0].el, "before", boxes[0].rect, "right")
        : offer(boxes[boxes.length - 1].el, "after", boxes[boxes.length - 1].rect, "right");
  }

  if (choice) return choice;

  // No field is a real target. Above the first block or below the last is
  // unambiguous. Note there is no "beside" fallback here: a row join is a
  // sideways outcome, and offering it as a last resort put a sideways jump back
  // into every downward drag that ran out of real targets. Returning null shows
  // no indicator, which is honest.
  let first = fields[0].getBoundingClientRect(),
    last = fields[fields.length - 1].getBoundingClientRect();
  if (pt.y < first.top)
    return (
      (startIsNoop() ? null : { kind: "start", rect: first }) ||
      offer(fields[0], "before", first)
    );
  if (pt.y > last.bottom)
    return (
      (endIsNoop() ? null : { kind: "end", rect: last }) ||
      offer(fields[fields.length - 1], "after", last)
    );
  return null;
}

function Bt(i, r, t, e, o, w) {
  let s = i.ownerDocument.defaultView,
    n = () => {},
    a = () => {
      (wt(i, t), o());
    };
  Rt.set(i, { cancel: () => n(), refresh: a });
  function d(c, u) {
    if (c.button !== 0 || c.detail > 1) return;
    (c.preventDefault(), c.stopPropagation(), n());
    let p = { width: t.width, height: t.height, offset: t.offset },
      l = i.getBoundingClientRect(),
      f = c.clientX,
      m = c.clientY,
      v = l.width,
      S = r.getBoundingClientRect().height,
      g = Math.max(0, parseFloat(s.getComputedStyle(i).marginLeft) || 0),
      h = Ce(i),
      k = i.ownerDocument.body.createDiv({
        cls: "structured-cards-root sc-resize-overlay",
      }),
      T = k.createDiv({ cls: "sc-resize-guide" }),
      b = u === "bottom" ? null : k.createDiv({ cls: "sc-width-badge" }),
      D = new AbortController();
    i.addClass("is-resizing");
    let x = !1,
      H = !1,
      A = (C) => {
        H ||
          ((H = !0),
          D.abort(),
          k.remove(),
          i.removeClass("is-resizing"),
          (n = () => {}),
          C ? x && e() : (Object.assign(t, p), a()));
      };
    n = () => A(!1);
    let F = (C) => {
        if (C.pointerId !== c.pointerId) return;
        if (!i.isConnected) {
          A(!1);
          return;
        }
        if (
          ((x ||= Math.abs(C.clientX - f) + Math.abs(C.clientY - m) > 1),
          u === "bottom")
        )
          t.height = Math.ceil(Math.max(Ee(r), S + C.clientY - m));
        else {
          let P = ke({ width: v, offset: g }, C.clientX - f, u, h);
          ((t.width = `${P.width}px`), (t.offset = P.offset || void 0));
        }
        a();
        let L = r.getBoundingClientRect();
        (Object.assign(T.style, {
          left: `${u === "right" ? L.right : L.left}px`,
          top: `${u === "bottom" ? L.bottom : L.top}px`,
          width: u === "bottom" ? `${L.width}px` : "1px",
          height: u === "bottom" ? "1px" : `${L.height}px`,
        }),
          b &&
            ((b.textContent = `${Math.round(i.getBoundingClientRect().width)} px`),
            (b.style.left = `${L.left + L.width / 2}px`),
            (b.style.top = `${Math.max(0, L.top - 28)}px`)));
      },
      y = { signal: D.signal };
    (s.addEventListener("pointermove", F, y),
      s.addEventListener(
        "pointerup",
        (C) => {
          C.pointerId === c.pointerId && A(!0);
        },
        y,
      ),
      s.addEventListener("pointercancel", () => A(!1), y),
      s.addEventListener("blur", () => A(!1), y),
      s.addEventListener(
        "keydown",
        (C) => {
          C.key === "Escape" && A(!1);
        },
        y,
      ));
  }
  if (w === false) {
    a();
    return;
  }
  let h = Ce(i);
  for (let c of ["left", "right", "bottom"]) {
    let u = r.createSpan({
        cls:
          c === "bottom"
            ? "sc-height-handle sc-edit-control"
            : `sc-resize-handle sc-resize-${c} sc-edit-control`,
        attr: {
          role: "separator",
          tabindex: "0",
          "aria-orientation": c === "bottom" ? "horizontal" : "vertical",
          "aria-valuenow": String(
            Math.round(c === "bottom" ? Ee(r) : i.getBoundingClientRect().width),
          ),
        },
      }),
      p = u.createSpan({
        attr: {
          id: `sc-size-${t.id}-${c}-${$()}`,
          hidden: "",
        },
        text: c === "bottom" ? "Field height" : `Field ${c} width`,
      });
    u.setAttribute("aria-labelledby", p.id),
      (u.onpointerdown = (l) => d(l, c)),
      // Double-click / Enter resets to auto, matching the pointer path.
      (u.ondblclick = (l) => {
        (l.preventDefault(), l.stopPropagation(), n(), It(t), a(), e());
      }),
      // Arrow keys resize in 16px steps. Without this the handles were focusable
      // but completely inert for keyboard users.
      (u.onkeydown = (l) => {
        if (l.key === "Enter") {
          l.preventDefault();
          return (n(), It(t), a(), e());
        }
        let g = l.shiftKey ? 48 : 16,
          S = l.key === "ArrowUp" || l.key === "ArrowLeft" ? -g : l.key === "ArrowDown" || l.key === "ArrowRight" ? g : 0;
        if (!S) return;
        l.preventDefault(), l.stopPropagation();
        n();
        if (c === "bottom") {
          let y = Ee(r) + S;
          t.height = Math.max(y, 40);
        } else {
          let y = ke(
            { width: i.getBoundingClientRect().width, offset: 0 },
            c === "left" ? -S : S,
            c,
            h,
          );
          (t.width = `${y.width}px`), (t.offset = y.offset || void 0);
        }
        (u.setAttribute(
          "aria-valuenow",
          String(
            Math.round(
              c === "bottom" ? Ee(r) : i.getBoundingClientRect().width,
            ),
          ),
        )),
          a(),
          e();
      });
  }
  a();
}
var nt = new WeakMap(),
  kt = new WeakMap();
/**
 * Suppress every hover response for the duration of a drag.
 *
 * None of the drag paths call `setPointerCapture`, so while the pointer is
 * down the browser keeps hit-testing it against the document and `:hover`
 * follows it from item to item. Every item the pointer passes over lights up its
 * grip, its delete button and its background mid-drag, which reads as the list
 * reacting rather than the drag.
 *
 * One marker class on the body is enough, because the stylesheet guards every
 * `:hover` rule with `body:not(.sc-drag-in-progress)`: while a drag is running no hover
 * rule can match at all, so the resting styles stand. `:focus-within` is left
 * unguarded on purpose, so a keyboard user keeps their controls.
 *
 * Counted rather than toggled, and the release is idempotent. The teardown paths
 * overlap -- `blur`, `Escape`, `pointercancel` and `cancelPointerDrag` can
 * all fire for one drag, and `beginPointerDrag` cancels its own previous drag
 * before starting -- so a plain toggle would let an early teardown clear a
 * marker that another live drag still needs.
 *
 * @returns {() => void} Call once, at any point, to release the lock.
 */
var scDragDepth = 0;
/**
 * Capture the pointer for the length of a drag.
 *
 * This is the part that actually freezes hover. Without capture the browser
 * keeps hit-testing the pointer on every move, so `:hover` follows it: the
 * cursor changes the moment the pointer leaves the handle, and every item it
 * crosses lights up. Suppressing the hover rules in CSS covers the symptom;
 * capturing the pointer removes the cause, because the browser routes every
 * event to `el` and stops firing boundary events at everything else.
 *
 * Capture is lost silently when `el` leaves the DOM -- a card that re-renders
 * mid-drag -- and releasing then throws, so the release is both guarded and
 * wrapped.
 *
 * @param {Element} el the element that received the initiating pointerdown.
 * @param {PointerEvent} evt the event that started the drag.
 * @returns {() => void} Call once to release. Safe to call twice.
 */
function scCapturePointer(el, evt) {
  let id = evt && evt.pointerId;
  try {
    id != null && el && el.setPointerCapture(id);
  } catch {}
  return () => {
    try {
      id != null && el && el.hasPointerCapture && el.hasPointerCapture(id) &&
        el.releasePointerCapture(id);
    } catch {}
  };
}

function scHoverLock() {
  let body = document.body;
  // The handles are `tabindex="0"`, so clicking one focuses it -- and the item's
  // `:focus-within` rule then reveals every control on that item for as long as
  // the drag lasts. That is a second, independent reason the controls light up,
  // and no amount of guarding the `:hover` rules touches it.
  //
  // Only focus inside the plugin is taken. The user may have had the caret in
  // the vault, and yanking that out from under them would be worse than the
  // light-up we are fixing.
  let active = document.activeElement;
  let ours = !!(active && active.closest && active.closest(".structured-cards-root"));
  ours && active.blur();
  return (
    body && (scDragDepth += 1),
    body && body.classList.add("sc-drag-in-progress"),
    (() => {
      let done = false;
      return () => {
        if (done) return;
        (done = true),
          (scDragDepth = Math.max(0, scDragDepth - 1)),
          document.body &&
            document.body.classList.toggle("sc-drag-in-progress", scDragDepth > 0);
      };
    })()
  );
}
function at(i) {
  (ot(i), kt.get(i)?.());
}
function Nt(i) {
  // The fingerprint deciding whether updateDOM may patch the existing DOM in
  // place. Everything the field menu can edit that changes WHICH CONTROL is on
  // screen belongs here: type (select vs text is a different element),
  // direction (it decorates every control's dir attribute), alignment (it
  // styles the title) and the options a select redraws from. The item kinds
  // decide the row structure. Value-only edits stay out of it, so note edits
  // keep patching instead of rebuilding.
  return (
    `${!!i.hideLabel}|${i.type || ""}|${i.direction || ""}|${i.align || ""}|${(
      i.options || []
    ).join(",")}|` +
    (i.items === void 0 && i.value ? [{ kind: "text" }] : i.items || [])
      .map((r) => r.kind)
      .join("|")
  );
}
function Y(i) {
  let r = nt.get(i);
  r && (r.flush(), r.cancel(), at(i), nt.delete(i));
}
function Wt(i, r, t) {
  let e = nt.get(i);
  if (!e || e.field.id !== r.id || e.shape !== Nt(r)) return !1;
  Object.assign(e.actions, t);
  let o = e.field.items;
  return (
    Object.assign(e.field, r),
    o &&
      r.items &&
      o.length === r.items.length &&
      (r.items.forEach((s, n) => Object.assign(o[n], s)), (e.field.items = o)),
    e.refresh.forEach((s) => s()),
    wt(i, e.field),
    !0
  );
}
var Se = {
    text: "Text",
    title: "Title",
    "title-text": "Title + text",
    checkbox: "Checkbox",
    bullet: "Bullet",
    numbered: "Numbered",
    secret: "Secret",
    url: "Link",
    separator: "Separator",
    multiline: "Multiline",
  },
  Te = ["text", "title", "checkbox", "secret", "separator"];
/**
 * Clipboard with a guard. navigator.clipboard rejects when permission is denied
 * or the page is not a secure context, and the old fire-and-forget await turned
 * that into an unhandled rejection.
 */
async function copyText(t, e) {
  try {
    (await navigator.clipboard.writeText(t)), e && new N.Notice(e);
  } catch {
    new N.Notice("Could not access the clipboard.");
  }
}
/**
 * The auto-growing plain control, used for `text`/`tags` and as the fallback
 * whenever a typed control cannot represent what the note already contains.
 */
function plainFieldControl(i, r, e, extra, hint, opts) {
  let a = yt(
    i,
    `sc-field-value${extra ? " " + extra : ""}`,
    () => r.value,
    (o) => (r.value = o),
    r.label || "Field value",
    () => effectiveDir(r.value, r.direction, opts),
    e,
    void 0,
    // The hint (the field's own placeholder, or the tags fallback) rides the
    // refresh closure: plainFieldControl used to stamp it on the textarea once,
    // and the next refresh wiped it, so an empty field coming back from an
    // outside edit lost its hint for good.
    typeof hint === "function" ? hint : hint === undefined ? "" : String(hint),
  );
  return (
    r.required && (a.input.required = !0),
    r.validation &&
      (a.input.setAttribute("pattern", r.validation),
        a.input.setAttribute("title", r.validation)),
    a
  );
}
/**
 * The control for a field that carries no item list, chosen from its declared
 * `type:`. Every type used to fall through to the same plain textarea, so
 * `select`, `number`, `url`, `code`, `tags` and `multiline` were inert and
 * `options:` was never read at all.
 *
 * A typed control is only used when it can actually show the stored value:
 * `<input type="number">` silently discards a non-numeric value and a `<select>`
 * shows nothing when the value is not among its options. Either way the note's
 * text would disappear from the UI, so fall back to the plain control instead.
 */
function fieldValueControl(i, r, t, e) {
  let n = r.placeholder || r.defaultValue || "";
  if (r.type === "select") {
    let a = i.createEl("select", { cls: "sc-input" }),
      o = r.options?.length ? r.options.slice() : r.value ? [r.value] : [];
    // Keep a stored value that is not in the list visible instead of dropping it.
    r.value && !o.includes(r.value) && o.unshift(r.value);
    for (let s of o) a.createEl("option", { text: s, value: s });
    o.length || a.createEl("option", { text: "No options defined", value: "" });
      let dirSync = () => a.setAttribute("dir", effectiveDir(r.value, r.direction, t));
    return ((a.value = r.value || ""),
      dirSync(),
      a.setAttr("aria-label", r.label),
      // Typed controls inherit the field root's forced-LTR envelope otherwise:
      // a Persian value sat glued to the left edge of its own select/secret/
      // multiline control. Same rule as the auto-growing control: declared
      // direction wins, auto follows the value, and the attribute is refreshed
      // whenever the value or the outside state changes.
      (a.onchange = () => ((r.value = a.value), dirSync(), e())),
      (a.refresh = () => (
        a.value !== (r.value || "") && (a.value = r.value || ""), dirSync()
      )),
      a);
  }
  if (r.type === "number" && r.value && !Number.isFinite(Number(r.value)))
    return plainFieldControl(i, r, e, "sc-number-input", () => n, t);
  if (r.type === "number" || r.type === "url") {
    let a = i.createEl("input", {
      cls: "sc-input",
      attr: { type: r.type, "aria-label": r.label, placeholder: n },
    });
    r.validation &&
      (a.setAttr("pattern", r.validation), a.setAttr("title", r.validation));
    a.required = !!r.required;
    let dirSync = () => a.setAttribute("dir", effectiveDir(r.value, r.direction, t));
    return ((a.value = r.value),
      dirSync(),
      a.addClass(r.type === "url" ? "sc-url-input" : "sc-number-input"),
      // Follow the value while it is being typed, as the auto-growing control
      // does on every refresh.
      (a.oninput = () => a.setAttribute("dir", effectiveDir(a.value, r.direction, t))),
      (a.onchange = () => ((r.value = a.value), e())),
      (a.refresh = () => (
        a.value !== r.value && (a.value = r.value), dirSync()
      )),
      a);
  }
  if (r.type === "secret") {
    let a = i.createEl("input", {
        cls: "sc-input",
        attr: {
          type: r.masked !== !1 && !t.revealSecrets ? "password" : "text",
          "aria-label": r.label,
          placeholder: n,
        },
      }),
      o = i.createSpan({
        cls: "sc-item-reveal sc-edit-control",
        attr: { role: "button", tabindex: "0", "aria-label": "Show secret" },
      });
    let dirSync = () => a.setAttribute("dir", effectiveDir(r.value, r.direction, t));
    return (
      (0, N.setIcon)(o, "eye"),
      (a.value = r.value),
      dirSync(),
      (a.required = !!r.required),
      (o.onclick = () => {
        let s = a.type === "password";
        ((a.type = s ? "text" : "password"),
          (0, N.setIcon)(o, s ? "eye-off" : "eye"),
          o.setAttribute("aria-label", s ? "Hide secret" : "Show secret"));
      }),
      (o.onkeydown = (s) => {
        (s.key === "Enter" || s.key === " ") && (s.preventDefault(), o.onclick());
      }),
      (a.onchange = () => ((r.value = a.value), dirSync(), e())),
      (a.refresh = () => (
        a.value !== r.value && (a.value = r.value), dirSync()
      )),
      o,
      a
    );
  }
  if (r.type === "multiline" || r.type === "code") {
    let a = i.createEl("textarea", {
      cls: `sc-field-value${r.type === "code" ? " sc-code" : " sc-item-multiline"}`,
      attr: {
        rows: r.type === "code" ? "6" : "3",
        "aria-label": r.label,
        placeholder: n,
        spellcheck: r.type === "code" ? "false" : "true",
      },
    });
    let dirSync = () => a.setAttribute("dir", effectiveDir(r.value, r.direction, t));
    return ((a.value = r.value),
      dirSync(),
      a.required = !!r.required,
      (a.oninput = () => ((r.value = a.value), dirSync(), e())),
      (a.refresh = () => (
        a.value !== r.value && (a.value = r.value), dirSync()
      )),
      a);
  }
  // text and tags: auto-growing input. `tags` is a comma-separated list, so it
  // only gets a hook class and a hint. Both the field's own placeholder and the
  // tags fallback flow through the refresh closure (`hint`), so a refresh can
  // no longer clear what the field is waiting for.
  let a = plainFieldControl(i, r, e, r.type === "tags" ? "sc-tags" : "", () =>
    n || (r.type === "tags" ? scHint("Comma separated") : ""),
  t);
  return a;
}
function Et(i, r, t, e) {
  Y(i);
  let o = [],
    s = !1,
    n = e.save;
  e.save = (g, h) => ((s = !1), n(g, h));
  let a = () => {
      s && ((s = !1), e.save(r, "typing"));
    },
    d = () => {
      ((s = !0), e.commitOnBlur || a(), e.layout?.());
    },
    c = new AbortController();
  (i.addEventListener(
    "focusout",
    (g) => {
      i.contains(g.relatedTarget) || a();
    },
    { signal: c.signal },
  ),
    i.ownerDocument.defaultView?.addEventListener("pagehide", a, {
      signal: c.signal,
    }),
    nt.set(i, {
      field: r,
      actions: e,
      shape: Nt(r),
      refresh: o,
      cancel: () => c.abort(),
      flush: a,
    }),
    i.empty(),
    i.addClass("structured-cards-root", "sc-standalone-field"),
    i.toggleClass("sc-no-animation", !t.animations),
    i.toggleClass("sc-responsive", !!t.responsive),
    (i.dataset.fieldId = r.id),
    i.style.setProperty("--sc-field-width", vt(r.width)),
    i.setAttribute("dir", "ltr"),
    r.row ? (i.dataset.row = r.row) : delete i.dataset.row);
  let u = i.createDiv({ cls: "sc-field-shell", attr: { tabindex: "0" } });
  r.height && u.style.setProperty("--sc-field-height", `${r.height}px`);
  let p = u.createDiv({ cls: "sc-field-content" }),
    l = p.createDiv({ cls: "sc-field-header" }),
    canEdit = !!t.showEditingControls,
    canDrag = canEdit && !!t.showDragHandles,
    f = null;
  if (canDrag)
    ((f = l.createSpan({
      cls: "sc-field-drag sc-edit-control",
      attr: {
        role: "button",
        tabindex: "0",
        "aria-label": "Drag field",
        title: "Drag field",
      },
    })),
      (0, N.setIcon)(f, "grip-vertical"),
      (f.onpointerdown = (g) => {
        g.button === 0 &&
          (g.preventDefault(),
          g.stopPropagation(),
          // Not an optional call. `e.beginDrag?.()` silently did nothing when the
          // callback was missing, which is exactly how a dead drag handle looks
          // to a user. If a render path forgets to wire it, fail loudly instead.
          typeof e.beginDrag == "function"
            ? e.beginDrag(g)
            : new N.Notice("Structured Cards: dragging is unavailable in this view."));
      }),
      (f.onkeydown = (g) => {
        (g.key === "Enter" || g.key === " ") &&
          (g.preventDefault(), new N.Notice("Drag this handle with the mouse."));
      }));
  l.toggleClass("sc-field-header-empty", !!r.hideLabel);
  if (!r.hideLabel) {
    let g = yt(
        l,
        "sc-field-label",
        () => r.label,
        (h) => (r.label = h),
        "Field label",
        // titleStyle.direction used to be applied by Le() and then immediately
        // overwritten by the refresh on every keystroke.
        () => effectiveDir(r.label, r.titleStyle?.direction ?? r.direction, t),
        d,
      );
    (g.input.style.setProperty("font-weight", "700", "important"),
      (g.wrap.querySelector(".sc-text-mirror").style.fontWeight = "700"),
      Le(g.wrap, r.titleStyle),
      applyTitleAlign(i, r),
      o.push(g.refresh),
      jt(g.input, e));
    r.required && l.createSpan({ cls: "sc-required", text: "*" });
  }
  canEdit &&
    ((() => {
      let m = l.createEl("button", {
        cls: "sc-field-more sc-edit-control",
        attr: {
          type: "button",
          "aria-label": "Field actions",
          title: "Field actions",
        },
      });
      (0, N.setIcon)(m, "ellipsis"),
        (m.onclick = (g) => {
          (g.preventDefault(), g.stopPropagation());
          let h = new N.Menu();
          (De(h, r, e),
            r.hideLabel ||
              h.addItem((k) =>
                k
                  .setTitle("Delete title")
                  .setIcon("trash-2")
                  .onClick(() => {
                    ((r.label = ""), (r.hideLabel = !0), e.save(r));
                  }),
              ),
            h.addSeparator(),
            h.addItem((k) =>
              k
                .setTitle("Field settings")
                .setIcon("settings-2")
                .onClick(() => e.settings(r)),
            ),
            h.addItem((k) =>
              k.setTitle("Duplicate").setIcon("copy").onClick(e.duplicate),
            ),
            h.addSeparator(),
            h.addItem((k) =>
              k.setTitle("Delete").setIcon("trash-2").onClick(e.delete),
            ),
            h.showAtMouseEvent(g));
        });
    })());
  let v =
      r.items === void 0 && r.value
        ? [{ id: r.id, kind: "text", value: r.value }]
        : r.items || [],
    hasItems = r.items !== void 0,
    // prefix/suffix wrap both shapes. They used to work only on the legacy
    // structured-card and were silently ignored by structured-field.
    row = r.prefix || r.suffix ? p.createDiv({ cls: "sc-field-value-row" }) : null;
  row && r.prefix && row.createSpan({ cls: "sc-affix", text: r.prefix });
  if (hasItems) {
    let S = row || p.createDiv({ cls: "sc-field-items" });
    v.forEach((g, h) => Fe(S, r, g, h, v, t, e, d, o));
    row && r.suffix && row.createSpan({ cls: "sc-affix", text: r.suffix });
  } else {
    let g = row || p.createDiv({ cls: "sc-field-value-row" }),
      h = fieldValueControl(g, r, t, d);
    r.suffix && g.createSpan({ cls: "sc-affix", text: r.suffix });
    h?.refresh && o.push(h.refresh);
  }
  r.help && p.createDiv({ cls: "sc-field-help", text: r.help });
  Bt(
    i,
    u,
    r,
    () => {
      e.save(r, "resize");
    },
    () => e.layout?.(),
    canEdit,
  );
}
/**
 * Display-only hints for an item that has just been created and is still empty.
 *
 * A field from the Insert command is a title item and a text item, both empty,
 * which renders as a blank card with nothing to indicate what belongs in it. The
 * hint rides on the control's placeholder attribute, so it disappears on the
 * first keystroke and can never reach the note -- there is no key for it and the
 * serialiser has no way to learn one.
 */
var ITEM_HINTS = {
    title: ["Title", "Type here\u2026"],
    "title-text": ["Title", "Type here\u2026"],
    text: ["", "Type here\u2026"],
    bullet: ["", "Type here\u2026"],
    numbered: ["", "Type here\u2026"],
    multiline: ["", "Type here\u2026"],
    url: ["", "Type a URL\u2026"],
    secret: ["", "Type a secret\u2026"],
  },
  /**
   * What an empty item of this kind should say. Returns "" for kinds with no
   * free-text surface (checkbox, separator) and for the title slot of a plain
   * text item, which has no separate title control.
   *
   * The hint is plugin-owned English text, so every result is wrapped in LRI…
   * PDI (see scHint): inside an RTL card it has to keep reading left to right,
   * punctuation included.
   */
  itemHint = (kind, slot) =>
    scHint(
      (ITEM_HINTS[kind] || ["", ""])[slot === "title" ? 0 : 1],
    );

function Fe(i, r, t, e, o, s, n, a, d) {
  let c = i.createDiv({
      cls: `sc-field-item sc-field-item-${t.kind}`,
      attr: { "data-item-index": String(e) },
    }),
    u = null,
    canEdit = !!(s && s.showEditingControls),
    canDrag = canEdit && !!(s && s.showDragHandles);
  /**
   * A thin line along the top of the item, inside the item's own box.
   *
   * It replaced a grip handle that floated 14px above the item -- which is the
   * same band the FIELD's own drag handle and menu occupy, so the two sets of
   * controls sat on top of each other. Living inside the item, the two can no
   * longer collide however either is positioned.
   */
  if (canDrag)
    ((u = c.createSpan({
      cls: "sc-item-grip sc-edit-control",
      attr: {
        role: "button",
        tabindex: "0",
        "aria-label": "Drag item",
        title: "Drag to reorder",
      },
    })),
      (u.onpointerdown = (f) => {
        f.button === 0 &&
          (f.preventDefault(), f.stopPropagation(), ze(f, c, r, t, e, o, n));
      }),
      (u.onkeydown = (f) => {
        (f.key === "Enter" || f.key === " ") &&
          (f.preventDefault(), new N.Notice("Drag this line with the mouse."));
      }));
  let p = (f, m, v, S, g, H) => {
    let h = yt(
      c,
      f,
      m,
      v,
      S,
      () => effectiveDir(m(), t.direction || r.direction, s),
      () => {
        (st(r, o), a());
      },
      g,
      H,
    );
    return (
      f.includes("sc-item-title") &&
        (h.input.style.setProperty("font-weight", "700", "important"),
          (h.wrap.querySelector(".sc-text-mirror").style.fontWeight = "700")),
      d.push(h.refresh),
      jt(h.input, n),
      h
    );
  };
  if (t.kind === "separator") c.createDiv({ cls: "sc-item-separator" });
  else if (t.kind === "checkbox") {
    let f = c.createEl("input", {
        cls: "sc-item-checkbox",
        attr: { type: "checkbox", "aria-label": "Checked" },
      }),
      m = () => (f.checked = !!t.checked);
    (m(),
      d.push(m),
      (f.onchange = () => {
        ((t.checked = f.checked), st(r, o), n.save(r));
      }),
    p(
      "sc-item-value",
      () => t.title || "",
      (v) => (t.title = v),
      "Checkbox text",
      void 0,
      itemHint(t.kind, "value"),
    ));
  } else if (t.kind === "title")
    p(
      "sc-item-title sc-item-standalone-title",
      () => t.title || "",
      (f) => (t.title = f),
      "Item title",
      void 0,
    itemHint(t.kind, "title"),
    );
  else if (t.kind === "secret") {
    let f = r.masked === !1 || !!(s && s.revealSecrets),
      m = p(
        "sc-item-value",
        () => t.value,
        (g) => (t.value = g),
        "Secret value",
      () => !f,
      itemHint(t.kind, "value"),
    ),
      v = c.createSpan({
        cls: "sc-item-reveal sc-edit-control",
        attr: { role: "button", tabindex: "0", "aria-label": "Show secret" },
      });
    (0, N.setIcon)(v, f ? "eye-off" : "eye");
    let S = () => {
      ((f = !f),
        m.refresh(),
        (0, N.setIcon)(v, f ? "eye-off" : "eye"),
        v.setAttribute("aria-label", f ? "Hide secret" : "Show secret"));
    };
    ((v.onclick = S),
      (v.onkeydown = (g) => {
        (g.key === "Enter" || g.key === " ") && (g.preventDefault(), S());
      }));
  } else if (t.kind === "title-text") {
    // The wrapper existed in CSS but Fe() never built it, so the title and the
    // text sat side by side instead of stacking.
    let w = c.createDiv({ cls: "sc-item-title-text-wrapper" });
    p(
      "sc-item-title",
      () => t.title || "",
      (f) => (t.title = f),
      "Item title",
      void 0,
    itemHint(t.kind, "title"),
    );
    w.appendChild(c.lastElementChild);
    p(
      "sc-item-value",
      () => t.value,
      (f) => (t.value = f),
      "Item text",
      void 0,
    itemHint(t.kind, "value"),
    );
    w.appendChild(c.lastElementChild);
  } else {
    t.kind === "bullet" &&
      c.createSpan({ cls: "sc-item-bullet", text: "\u2022" });
    t.kind === "numbered" &&
      (() => {
        let f = c.createEl("input", {
          cls: "sc-item-number",
          type: "number",
          value: String(t.number || e + 1),
          attr: { "aria-label": "Number", min: "1" },
        });
        f.onchange = () => {
          ((t.number = Number(f.value) || 1), n.save(r));
        };
      })();
    p(
      t.kind === "multiline"
        ? "sc-item-value sc-item-multiline"
        : t.kind === "url"
          ? "sc-item-value sc-item-url"
          : "sc-item-value",
      () => t.value,
      (f) => (t.value = f),
      "Item text",
      void 0,
    itemHint(t.kind, "value"),
    );
  }
  if (canEdit) {
    // Delete was the only thing the old ellipsis menu did, so the menu was one
    // extra click for nothing. The button lives inside the item and is inset
    // further from the right edge than the field's own menu, so the two never
    // sit on top of each other.
    let l = c.createSpan({
      cls: "sc-item-delete sc-edit-control",
      attr: { role: "button", tabindex: "0", "aria-label": "Delete item", title: "Delete item" },
    });
    (0, N.setIcon)(l, "trash-2"),
      (l.onclick = (f) => {
        (f.preventDefault(), f.stopPropagation()),
          (o.splice(e, 1), st(r, o), n.save(r));
      }),
      (l.onkeydown = (f) => {
        (f.key === "Enter" || f.key === " ") &&
          (f.preventDefault(), l.onclick(f));
      });
  }
}
function De(i, r, t) {
  i.addItem((e) =>
    e
      .setTitle("Add item")
      .setIcon("plus")
      .onClick((o) => {
        let s = new N.Menu();
        for (let n of Te)
          s.addItem((a) =>
            a.setTitle(Se[n]).onClick(() => {
              (r.items === void 0 &&
                (r.items = r.value
                  ? [{ id: $(), kind: "text", value: r.value }]
                  : []),
                r.items.push(Z(n)),
                t.save(r));
            }),
          );
        Me(s, o);
      }),
  );
}
function jt(i, r) {
  i.addEventListener("keydown", (t) => {
    (t.stopPropagation(),
      r.history &&
        (t.ctrlKey || t.metaKey) &&
        !t.altKey &&
        (t.key.toLowerCase() === "z" || t.key.toLowerCase() === "y") &&
        (t.preventDefault(),
        r.history(t.shiftKey || t.key.toLowerCase() === "y")));
  });
}
function Me(i, r) {
  if (r instanceof MouseEvent) {
    i.showAtMouseEvent(r);
    return;
  }
  let e = r.currentTarget?.getBoundingClientRect();
  i.showAtPosition({ x: e?.left || 0, y: e?.bottom || 0, width: e?.width });
}
function st(i, r) {
  ((i.items = r),
    r.length === 1 && r[0].kind === "text" && !r[0].title
      ? (i.value = r[0].value)
      : (i.value = r.filter((t) => t.kind !== "separator").map((t) => t.value)
          .join(`
`)));
}
/**
 * The text a field represents, mirroring st() without mutating.
 *
 * W() writes no `value:` line for a field that has items, so `field.value` stays
 * empty until something is typed. Copying it verbatim copied an empty string.
 */
function Le(i, r) {
  r &&
    (r.size === "medium"
      ? (i.style.fontSize = "0.88em")
      : r.size === "large" && (i.style.fontSize = "1em"),
    r.weight === "bold" && (i.style.fontWeight = "700"),
    r.color && (i.style.color = r.color),
    r.italic && (i.style.fontStyle = "italic"),
    r.direction && i.setAttribute("dir", r.direction));
}
function ze(i, r, t, e, o, s, n) {
  let a = r.parentElement,
    d = r.closest(".sc-standalone-field");
  if (!a || !d) return;
  at(d);
  // No pointer capture on this path, so the items the pointer crosses would
  // otherwise light up their controls while this drag runs.
  let releaseHover = scHoverLock(),
    releasePointer = scCapturePointer(r, i),
    c = d.ownerDocument.defaultView,
    u = new AbortController(),
    p = d.ownerDocument.body.createDiv({
      cls: "structured-cards-root sc-item-drop-indicator",
    }),
    l = o,
    f = !1,
    m = () => {
      (u.abort(), p.remove(), kt.delete(d), releasePointer(), releaseHover());
    };
  kt.set(d, m);
  let v = { signal: u.signal };
  (c.addEventListener(
    "pointermove",
    (S) => {
      if (S.pointerId !== i.pointerId) return;
      if (!r.isConnected) {
        m();
        return;
      }
      if (((f ||= Math.abs(S.clientY - i.clientY) > 4), !f)) return;
      let g = Array.from(a.children);
      ((l = g.findIndex(
        (k) =>
          S.clientY <
          k.getBoundingClientRect().top + k.getBoundingClientRect().height / 2,
      )),
        l < 0 && (l = g.length));
      let h = (g[l] || g[g.length - 1]).getBoundingClientRect();
      Object.assign(p.style, {
        left: `${h.left}px`,
        top: `${l < g.length ? h.top : h.bottom}px`,
        width: `${h.width}px`,
      });
    },
    v,
  ),
    c.addEventListener(
      "pointerup",
      (S) => {
        if (S.pointerId !== i.pointerId) return;
        m();
        let g = l > o ? l - 1 : l;
        if (f && g !== o) {
          let [h] = s.splice(o, 1);
          (s.splice(g, 0, h), st(t, s), n.save(t));
        }
      },
      v,
    ),
    c.addEventListener("pointercancel", m, v),
    c.addEventListener("blur", m, v),
    c.addEventListener(
      "keydown",
      (S) => {
        S.key === "Escape" && m();
      },
      v,
    ));
}
function Vt(i, r) {
  // Declared directions win outright. For auto, the FIRST STRONG directional
  // character anywhere in the string decides -- not just a leading run. The old
  // detector only recognised RTL when Persian opened the line, so a note like
  // "یادداشت https://x.com" that began with an English word or a URL carried a
  // mostly-Persian line off to the left.
  if (r === "rtl" || r === "ltr") return r;
  for (let s of i) {
    let n = s.codePointAt(0);
    if (n >= 0x0590 && n <= 0x08ff) return "rtl";
    if (
      (n >= 0x41 && n <= 0x5a) ||
      (n >= 0x61 && n <= 0x7a) ||
      (n >= 0xc0 && n <= 0x24f)
    )
      return "ltr";
  }
  return "auto";
}
/**
 * The direction a control is actually rendered with.
 *
 * 1. A field that declares RTL or LTR in the note wins outright.
 * 2. Otherwise the plugin tab's "Default text direction" applies as the base.
 *    RTL/LTR there is a working switch: it reaches EVERY field left on Auto, so
 *    flipping it moves the cards the user is already looking at. Previously the
 *    setting only seeded brand-new fields, which made the switch look dead.
 * 3. When the tab is on Auto (the factory default), each field follows its own
 *    content via the first-strong scan above; a neutral value resolves to the
 *    browser.
 *
 * The legacy card renderer already consulted settings the same way, so this
 * makes the modern path agree with it instead of replacing its meaning.
 */
function effectiveDir(i, r, t) {
  if (r === "rtl" || r === "ltr") return r;
  let e = t && t.defaultDirection;
  if (e === "rtl" || e === "ltr") return e;
  return Vt(i, "auto");
}
/**
 * Wrap a plugin-owned hint in LEFT-TO-RIGHT ISOLATE … POP DIRECTIONAL
 * ISOLATE. Hints are English strings shown inside controls whose base
 * direction belongs to the field (often RTL in Persian notes), and under a
 * RTL base their punctuation slides to the wrong end. The isolate paints each
 * hint as its own LTR paragraph wherever it shows up, without touching the
 * direction of the value the user types. Never used for user-owned strings
 * (placeholder, default value, options) and never serialized -- the serialiser
 * never reads hints at all.
 */
function scHint(i) {
  return i ? "\u2066" + i + "\u2069" : i;
}
/**
 * How many blank lines a drop past the end of the note should insert.
 *
 * The old ceiling was 500, so dropping a field a little below the last line
 * appended hundreds of empty lines to the note.
 */
function qt(i, r, t, e = 3) {
  return Math.max(0, Math.min(e, Math.round((i - r) / Math.max(1, t))));
}
/**
 * Put exactly one blank line back between consecutive blocks.
 *
 * A move rewrites the text either side of the block it relocated, and the result
 * can leave two blocks jammed together while the separator it consumed turns up
 * somewhere else. That is what the drop line promises against -- a clean slot --
 * and what the file then does not deliver.
 *
 * Only the gaps BETWEEN blocks are rewritten. Everything inside a block, and
 * every word outside them, is copied through byte for byte, so this cannot
 * reformat the note. A gap that already has a blank line keeps exactly what it
 * had, including deliberate extra spacing.
 */
function normalizeSeams(text) {
  let blocks = R(text);
  if (blocks.length < 2) return text;
  // Belt and braces. This function rebuilds the note by concatenating each
  // block's own text, so anything other than a strictly ascending, non-touching
  // set of blocks would make it copy a span twice. R() is not expected to
  // produce that, but a silent duplicate here would look to the user like a move
  // that invented a field, so refuse rather than risk it.
  for (let i = 0; i < blocks.length; i++)
    if (blocks[i].from > blocks[i].to || (i > 0 && blocks[i].from < blocks[i - 1].to))
      return text;
  let nl = text.includes("\r\n") ? "\r\n" : "\n",
    out = text.slice(0, blocks[0].from);
  // Two members of a row are MEANT to be adjacent -- that adjacency is the row,
  // and a blank line between them dissolves the layout. Only a gap between
  // unrelated blocks is given a separator.
  let oneRow = (a, b) => !!(a.field.row && a.field.row === b.field.row);
  for (let i = 0; i < blocks.length; i++) {
    (out += text.slice(blocks[i].from, blocks[i].to),
      i + 1 < blocks.length &&
        (() => {
          let gap = text.slice(blocks[i].to, blocks[i + 1].from);
          out += oneRow(blocks[i], blocks[i + 1])
            ? gap
            : /\n\n/.test(gap)
              ? gap
              : gap.replace(/[\r\n]+$/, "") + nl + nl;
        })());
  }
  let tail = text.slice(blocks[blocks.length - 1].to);
  // Only collapse the tail when it is nothing but newlines -- that is a blank
  // line the move left where the note used to end on one. A tail with any content
  // in it is real text, including the spacing the author chose in front of it,
  // and it is passed through untouched. Collapsing it deleted the blank line
  // above a trailing paragraph on every single move.
  out += tail.replace(/[\r\n]/g, "") ? tail : nl;
  return out;
}
function Ct(i, r, t, e = "after", o, s, n = {}) {
  let a = i,
    d = R(i),
    c = d.filter((x) => x.field.id === r);
  if (c.length !== 1) return a;
  let u = c[0],
    p = t ? d.filter((x) => x.field.id === t) : [];
  if (t && (p.length !== 1 || t === r)) return a;
  let l = Math.max(0, Math.min(500, Math.floor(n.blankLines || 0))),
    f = o ?? 0;
  if (
    (!t && (f < 0 || f > i.length || d.some((x) => f > x.from && f < x.to))) ||
    (!t && f >= u.from && f <= u.to && !(f === u.to && l))
  )
    return a;
  let original = i.slice(u.from, u.to),
    // W() always writes a `value:` line for a field that has no items, so a block
    // that never had one grows a line the moment anything rewrites it. Noted here
    // so the move below can undo it.
    hadValue = /(^|\n)value[ ]*:/i.test(original),
    m = clonePlain(u.field);
  ((m.row = void 0), (m.offset = void 0));
  let v = i.includes("\r\n") ? "\r\n" : "\n",
    S = (x) => W(x).replace(/\r\n|\r|\n/g, v),
    // A move must be a move. W() always writes a `value:` line for a field with
    // no items, so a block that never had one grows a line the moment anything
    // rewrites it -- and the note changes by more than the thing that was asked
    // for. Only the empty form is removed, so a real value is never touched.
    //
    // This has to be a function of the MOVED block. On the beside path the
    // serialised string holds two blocks, and a bare replace would take the line
    // out of the target instead.
    mine = () => {
      let out = S(m);
      return hadValue ? out : out.replace(/(^|\n)value:[ ]*\r?\n/, "$1");
    },
    g =
      i.slice(u.to, u.to + 2) === "\r\n"
        ? u.to + 2
        : i[u.to] === "\n"
          ? u.to + 1
          : u.to;
  // Swallow one blank separator too. Removing only the terminating newline
  // merges the blank line before the block with the one after it, so every move
  // added another blank line at the seam.
  if (i.slice(g, g + 2) === "\r\n" || i[g] === "\n")
    g += i[g] === "\r" ? 2 : 1;
  i = i.slice(0, u.from) + i.slice(g);
  let h = f >= g ? f - (g - u.from) : f >= u.from ? u.from : f,
    T = h,
    // Serialised lazily: the placement below can still change m.row.
    k = null,
    tight = !1;
  if (t) {
    let x = R(i),
      H = x.findIndex((F) => F.field.id === t),
      A = x[H];
    if (!A) return a;
    if (e === "beside") {
      let F = clonePlain(A.field),
        y = F.row || `row-${$()}`;
      ((m.row = y),
        (F.row = y),
        (F.offset = void 0),
        (k = n.side === "left" ? `${mine()}${v}${S(F)}` : `${S(F)}${v}${mine()}`),
        (tight = !0),
        (h = A.from),
        (T = A.to));
    } else {
      let F = H,
        y = H;
      if (A.field.row) {
        for (
          ;
          F > 0 &&
          x[F - 1].field.row === A.field.row &&
          /^\s*$/.test(i.slice(x[F - 1].to, x[F].from));
        )
          F--;
        for (
          ;
          y + 1 < x.length &&
          x[y + 1].field.row === A.field.row &&
          /^\s*$/.test(i.slice(x[y].to, x[y + 1].from));
        )
          y++;
      }
      // The block lands adjacent to the whole target row, so it joins it.
      // Without this, moving one member of a row silently dissolved the layout
      // because the moved field had been stripped of its row id.
      if (A.field.row) ((m.row = A.field.row), (tight = !0));
      ((h = e === "before" ? x[F].from : x[y].to), (T = h));
    }
  }
    k ??= mine();
  let b =
      !tight &&
      h > 0 &&
      i[h - 1] !== "\n"
      ? v
      : "",
    D =
      !tight &&
      i[T] !== "\n" &&
      i[T] !== "\r"
      ? v
      : "";
  return normalizeSeams(i.slice(0, h) + b + (t ? "" : v.repeat(l)) + k + D + i.slice(T));
}
var St = {
  templates: [],
  revealSecretsByDefault: !1,
  defaultDirection: "auto",
  animations: !0,
  showEditingControls: !0,
  showDragHandles: !0,
  responsive: !0,
  snapGuides: !0,
  debugLogging: !1,
};
// Settings that no longer exist, either because nothing ever read them or
// because the feature they belonged to was removed. Pruned from data.json on
// load so old vaults stop carrying keys the plugin would otherwise have to
// ignore forever.
var StDropped = [
  "defaultLayout",
  "defaultSize",
  "defaultDensity",
  "defaultGap",
  "showCopyButtons",
  "copyNotice",
];
var _ = require("obsidian");
var K = class extends _.Modal {
  constructor(t, e, o) {
    super(t);
    E(this, "onSave", o);
    E(this, "draft");
    this.draft = clonePlain(e);
  }
  onOpen() {
    (this.modalEl.addClass("structured-cards-root", "sc-field-modal"),
      this.titleEl.setText("Field settings"));
    let t = this.contentEl,
      d = this.draft,
      // An item card takes its values from its rows, which are edited on the
      // card itself. Every row below that can only shape a single-value field
      // (type, placeholder, options, default, validation, required, masking)
      // would silently do nothing for one of those -- so it is hidden, and the
      // modal only offers what actually applies.
      hasItems = d.items !== void 0;
    hasItems &&
      t.createDiv({
        cls: "sc-modal-note",
        text: "This field holds item rows. Edit the rows on the card itself -- these settings shape the card's shell only.",
      });
    (hasItems ||
      Ae(
        t,
        "Type",
        Object.fromEntries(
          [...$t].map((e) => [
            e,
            e.charAt(0).toUpperCase() + e.slice(1),
          ]),
        ),
        d.type || "text",
        (e) => (d.type = e),
        // Honest about the typed-control contract: a stored value a control
        // cannot show falls back to plain text instead of vanishing.
        "How the value is edited. A value the control cannot show falls back to plain text.",
      ),
      !hasItems &&
        d.type === "secret" &&
        Oe(
          t,
          "Mask secret",
          d.masked !== !1,
          (e) => (d.masked = e),
          "Decides whether the value is hidden until the eye in the card is clicked.",
        ),
    Ae(
      t,
      "Text direction",
      { auto: "Auto", rtl: "RTL", ltr: "LTR" },
      d.direction || "auto",
      (e) => (d.direction = e),
      "This field's text direction. RTL/LTR wins over the plugin tab's default. Auto follows that default, or the content when the tab is Auto too.",
    ),
    hasItems ||
      $e(
        t,
        "Placeholder",
        d.placeholder || "",
        (e) => (d.placeholder = e || void 0),
        "Hint shown while the field is empty.",
      ),
    // These were parsed and written back to the note but had no way to be set.
    !hasItems &&
      d.type === "select" &&
      $e(
        t,
        "Options (comma separated)",
        (d.options || []).join(", "),
        (e) => {
          let o = e
            .split(",")
            .map((o) => o.trim())
            .filter(Boolean);
          d.options = o.length ? o : void 0;
        },
      ),
    hasItems ||
      $e(
        t,
        "Default value",
        d.defaultValue || "",
        (e) => (d.defaultValue = e || void 0),
        "Second hint: shown when no placeholder is set, and a template may seed it as the starting value.",
      ),
    $e(t, "Prefix", d.prefix || "", (e) => (d.prefix = e || void 0)),
    $e(t, "Suffix", d.suffix || "", (e) => (d.suffix = e || void 0)),
    hasItems ||
      $e(
        t,
        "Validation pattern",
        d.validation || "",
        (e) => (d.validation = e || void 0),
        "Regular expression the browser checks on text, number and url inputs.",
      ),
    hasItems ||
      Oe(t, "Required", !!d.required, (e) => (d.required = e), "The browser flags an empty value; a * shows on the title."),
    Ae(
      t,
      "Title alignment",
      { start: "Start", center: "Centre", end: "End" },
      d.align || "start",
      (e) => (d.align = e),
      "Where the title sits in the card.",
    ),
    new _.Setting(t).addButton((e) =>
      e
        .setButtonText("Save")
        .setCta()
        .onClick(() => {
          (this.onSave(clonePlain(this.draft)), this.close());
        }),
    ));
  }
};
function $e(i, r, t, e, o = "") {
  new _.Setting(i).setName(r).setDesc(o).addText((s) => s.setValue(t).onChange(e));
}
function Ae(i, r, t, e, o, s) {
  new _.Setting(i)
    .setName(r)
    .setDesc(s || "")
    .addDropdown((n) => n.addOptions(t).setValue(e).onChange(o));
}
function Oe(i, r, t, e, o) {
  new _.Setting(i)
    .setName(r)
    .setDesc(o || "")
    .addToggle((s) => s.setValue(t).onChange(e));
}
var dt = class extends w.Plugin {
  constructor() {
    super(...arguments);
    E(this, "settings", clonePlain(St));
    E(this, "dragged", null);
    E(this, "dragAbort", null);
    E(this, "dragOverlay", null);
    E(this, "p0Installed", !1);
    E(this, "p0Restore", []);
    // Every CodeMirror view our editor extension lives in, so a settings
    // change can be dispatched to them directly. The previous hop reached the
    // view through `editor.cm`, a property Obsidian never documented -- when it
    // was absent the refresh silently did nothing in the editor.
    E(this, "editorViews", new Set());
  }
  async onload() {
    // Settings must load first: the P0-OPEN diagnostic harness wraps six core
    // Obsidian methods, so it stays uninstalled unless it is switched on.
    (App = this.app,
      await this.loadSettings(),
      this.installP0Open(),
      this.p0StartupState("onload"),
      this.addSettingTab(new Mt(this.app, this)),
      this.registerMarkdownCodeBlockProcessor("structured-field", (t, e, o) => {
        try {
          return this.renderReadingField(t, e, o);
        } catch (s) {
          (console.error(
            "Structured Cards: structured-field processor failed",
            s,
          ),
            this.malformed(
              e,
              `\`\`\`structured-field
${t}
\`\`\``,
            ));
        }
      }),
      this.registerMarkdownCodeBlockProcessor("structured-card", (t, e, o) => {
        try {
          return this.renderLegacyCard(t, e, o);
        } catch (s) {
          (console.error(
            "Structured Cards: structured-card processor failed",
            s,
          ),
            this.malformed(
              e,
              `\`\`\`structured-card
${t}
\`\`\``,
            ));
        }
      }),
      this.app.workspace.onLayoutReady(() => {
        this.p0StartupState("layout-ready");
        try {
          this.registerEditorExtension(this.editorExtension());
        } catch (t) {
          console.error(
            "Structured Cards: Live Preview registration failed",
            t,
          );
        }
      }),
      this.addCommand({
        id: "insert-field",
        name: "Insert field",
        callback: () => this.withEditor((t) => this.insertField(t)),
      }),
      this.registerEvent(
        this.app.workspace.on("editor-menu", (t, e) => {
          // editor-menu also fires outside an editing view, where there is no
          // editor to write into.
          if (!e || typeof e.getValue !== "function") return;
          t.addItem((o) =>
            o
              .setTitle("Add field")
              .setIcon("plus-square")
              .setSection("selection-link")
              .onClick(() => {
                try {
                  this.insertField(e);
                } catch (err) {
                  console.error("Structured Cards: Add field failed", err);
                  new w.Notice(
                    `Structured Cards: could not add a field \u2014 ${err instanceof Error ? err.message : String(err)}`,
                  );
                }
              }),
          );
        }),
      ),
      this.addCommand({
        id: "insert-template",
        name: "Insert template",
        callback: () =>
          this.withEditor((t) => new Dt(this.app, this, t).open()),
      }),
      this.addCommand({
        id: "save-layout-template",
        name: "Save selected/current layout as template",
        callback: () => this.withEditor((t) => this.saveLayoutTemplate(t)),
      }),
      this.addCommand({
        id: "manage-templates",
        name: "Manage templates",
        callback: () => new lt(this.app, this).open(),
      }));
  }
  onunload() {
    (this.cancelPointerDrag(),
      this.readingDrag?.cancel?.(),
      document.querySelectorAll(".sc-standalone-field").forEach(Y));
    for (let t of this.p0Restore)
      try {
        t();
      } catch (e) {
        this.p0log("teardown-failed", String(e));
      }
    ((this.p0Restore = []),
      (this.p0Installed = !1),
      this.p0log("teardown", {
        restored: !0,
        version: this.manifest.version,
      }));
  }
  /** Diagnostic sink for the P0-OPEN harness. Silent unless it is enabled. */
  p0log(t, e) {
    this.settings.debugLogging && console.warn("[Structured Cards:P0-OPEN]", t, e);
  }
  p0StartupState(t) {
    try {
      let e = this.app.workspace,
        o = e.getLeavesOfType("markdown"),
        s = o.map((n) => {
          let a = n.view;
          return {
            type: a.getViewType?.() ?? null,
            file: a.file?.path ?? null,
          };
        });
      this.p0log("startup-state", {
        tag: t,
        version: this.manifest.version,
        activeFile: e.getActiveFile()?.path ?? null,
        activeLeafType: e.activeLeaf?.view?.getViewType() ?? null,
        markdownLeafCount: o.length,
        leaves: s,
      });
    } catch (e) {
      this.p0log("startup-state-failed", { tag: t, error: String(e) });
    }
  }
  p0DecorationError(t, e, o) {
    let s = -1,
      n = -1,
      a = [];
    try {
      ((s = o.doc.length),
        (n = o.selection.main.head),
        (a = R(o.doc.toString()).map((d) => d.field.id)));
    } catch (d) {
      a = [`range-scan-failed:${String(d)}`];
    }
    this.p0log(t, {
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : void 0,
      docLength: s,
      selection: n,
      fieldIds: a,
    });
  }
  installP0Open() {
    if (this.p0Installed) return;
    // Wrapping workspace/vault methods and adding global error listeners is a
    // debugging aid, not something to ship enabled by default.
    if (!this.settings.debugLogging) return;
    this.p0Installed = !0;
    let t = this,
      e = (p) => p == null || (typeof p == "string" && p.trim() === ""),
      o = (p) =>
        p === void 0
          ? "undefined"
          : p === null
            ? "null"
            : p === ""
              ? '""'
              : String(p),
      s = (p, l, f, m) => {
        if (!p) {
          t.p0log("probe-missing", { operation: f, name: l, owner: "absent" });
          return;
        }
        let v = p[l];
        if (typeof v != "function") {
          t.p0log("probe-missing", { operation: f, name: l });
          return;
        }
        let S = Object.prototype.hasOwnProperty.call(p, l);
        ((p[l] = function (...g) {
          let h = null;
          try {
            h = m(g);
          } catch (T) {
            t.p0log("probe-target-failed", { operation: f, error: String(T) });
          }
          return (
            e(h) &&
              t.p0log("empty-target", {
                operation: f,
                target: o(h),
                argTypes: g.map((T) => (T === null ? "null" : typeof T)),
                activeFile: t.app.workspace.getActiveFile()?.path ?? null,
                stack: new Error("[Structured Cards:P0-OPEN] caller").stack,
              }),
            v.apply(this, g)
          );
        }),
          t.p0Restore.push(() => {
            S ? (p[l] = v) : Reflect.deleteProperty(p, l);
          }));
      },
      n = this.app.workspace,
      a = this.app.vault,
      d = this.app.metadataCache;
    (s(n, "openLinkText", "workspace.openLinkText", (p) => p[0]),
      s(n, "setActiveLeaf", "workspace.setActiveLeaf", (p) =>
        p[0] == null ? null : "leaf",
      ),
      s(n, "setViewState", "workspace.setViewState", (p) => {
        let l = p[0];
        if (!l || l.state == null || !("file" in l.state))
          return "no-file-state";
        let f = l.state.file;
        return typeof f == "string" ? f : null;
      }),
      s(a, "getAbstractFileByPath", "vault.getAbstractFileByPath", (p) => p[0]),
      s(
        d,
        "getFirstLinkpathDest",
        "metadataCache.getFirstLinkpathDest",
        (p) => p[0],
      ),
      s(w.WorkspaceLeaf.prototype, "openFile", "leaf.openFile", (p) => {
        let l = p[0];
        return l == null ? null : typeof l.path == "string" ? l.path : null;
      }));
    let c = (p) => {
        t.p0log("window-error", {
          message: String(p.message ?? ""),
          filename: String(p.filename ?? ""),
          lineno: p.lineno ?? 0,
          activeFile: t.app.workspace.getActiveFile()?.path ?? null,
          stack:
            p.error instanceof Error
              ? p.error.stack
              : String(p.error ?? p.message),
        });
      },
      u = (p) => {
        let l = p.reason;
        t.p0log("unhandled-rejection", {
          reason: l instanceof Error ? l.message : String(l),
          stack: l instanceof Error ? l.stack : void 0,
          activeFile: t.app.workspace.getActiveFile()?.path ?? null,
        });
      };
    (window.addEventListener("error", c),
      window.addEventListener("unhandledrejection", u),
      t.p0Restore.push(() => {
        (window.removeEventListener("error", c),
          window.removeEventListener("unhandledrejection", u));
      }),
      t.p0log("installed", {
        wrappers: [
          "openLinkText",
          "setActiveLeaf",
          "setViewState",
          "getAbstractFileByPath",
          "getFirstLinkpathDest",
          "openFile",
        ],
        listeners: ["error", "unhandledrejection"],
        mode: "log-only-delegate",
      }));
  }
  async loadSettings() {
    let t = await this.loadData(),
      dropped = !1;
    ((this.settings = Object.assign(
      {},
      clonePlain(St),
      t && typeof t == "object" ? t : {},
    )),
      Array.isArray(this.settings.templates) || (this.settings.templates = []),
      StDropped.forEach((e) => {
        e in this.settings && (delete this.settings[e], (dropped = !0));
      }));
    let e = JSON.stringify(this.settings.templates);
    ((this.settings.templates = this.settings.templates
      .filter(
        (o) => o.id !== "builtin-api-provider" && o.name !== "API Provider",
      )
      .map((o) => (o.source ? o : { ...o, source: o.card ? Ie(o.card) : "" }))),
      (JSON.stringify(this.settings.templates) !== e || dropped) &&
        (await this.saveSettings()));
  }
  async saveSettings() {
    await this.saveData(this.settings);
    this.refreshRenderedCards();
  }
  /**
   * Make a settings change visible.
   *
   * Saving alone is not enough. The reading view renders a card once and keeps
   * it, and the editor's field widgets compare only their source text and
   * offsets -- so neither asked whether the new settings still applied. The
   * result was a switch that flipped, a settings file that changed, and a screen
   * that did not move until the note was reopened.
   *
   * Reading view: re-render the preview.
   * Editor view: run a transaction. A settings change is not a document change,
   * so nothing would otherwise make CodeMirror recompute its decorations -- and
   * even once it does, it is eq() that decides whether a widget is reused.
   * Each live editor is reached through the registry the view plugin keeps (the
   * `editor.cm` hop stays only as a safety net for views that never registered:
   * unresponsive, reused, or foreign).
   *
   * Wrapped throughout: a stale screen is a nuisance, but a thrown error here
   * would leave the settings unsaved.
   */
  refreshRenderedCards() {
    try {
      // Live CodeMirror views first: the extension registered itself with us,
      // so this works regardless of how Obsidian hides the view behind
      // MarkdownView.editor (whose `.cm` was never a documented property).
      for (const cm of this.editorViews || []) {
        try {
          cm?.dispatch?.({ effects: [ScRefresh.of(null)] });
        } catch {}
      }
      for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
        let v = leaf?.view;
        if (!v) continue;
        try {
          v.previewMode?.rerender?.(true);
        } catch {}
        try {
          let cm = v.editor?.cm || (v.editor?.cm6 ? G(v.editor.cm6.dom) : null);
          // The refresh EFFECT is what makes the decorations state field
          // rebuild; an empty dispatch ran no update at all and open editor
          // widgets kept their old options on screen.
          cm?.dispatch?.({ effects: [ScRefresh.of(null)] });
        } catch {}
      }
    } catch (err) {
      console.error("Structured Cards: could not apply a settings change on screen", err);
    }
  }
  withEditor(t) {
    let e = this.app.workspace.getActiveViewOfType(w.MarkdownView)?.editor;
    if (!e) {
      new w.Notice("Open a Markdown note to use this command.");
      return;
    }
    t(e);
  }
  renderOptions() {
    return {
      revealSecrets: this.settings.revealSecretsByDefault,
      defaultDirection: this.settings.defaultDirection,
      animations: this.settings.animations,
      showEditingControls: this.settings.showEditingControls,
      showDragHandles: this.settings.showDragHandles,
      responsive: this.settings.responsive,
      snapGuides: this.settings.snapGuides,
    };
  }
/**
   * Insert a block on its own line without disturbing anything else.
   *
   * replaceSelection() overwrote whatever the user had highlighted. If the caret
   * sits inside a field the new block goes after that whole field, because
   * splicing into the middle would split its fence.
   *
   * The insertion point is passed as an EditorPosition rather than a raw offset,
   * and failures are surfaced: a silently swallowed error here made the context
   * menu item look simply dead with no console output at all.
   */
  insertBlock(editor, text) {
    if (!editor || typeof editor.getValue !== "function") {
      new w.Notice("Structured Cards: no active editor.");
      return;
    }
    try {
      let doc = editor.getValue(),
        at = editor.posToOffset(editor.getCursor()),
        hit = R(doc).find((d) => at >= d.from && at <= d.to),
        nl = doc.includes("\r\n") ? "\r\n" : "\n",
        block = text.replace(/\r\n|\r|\n/g, nl),
        pos = hit ? Pe(doc, hit.from, hit.to).to : at;
      // Never split a line. A caret in the middle of "hello" used to leave "he"
      // above the block and "llo" below it.
      if (pos > 0 && !doc.slice(0, pos).endsWith(nl)) {
        let lf = doc.indexOf("\n", pos);
        if (lf === -1) pos = doc.length;
        else if (lf > pos) pos = doc[lf - 1] === "\r" ? lf - 1 : lf;
      }
      let before = doc.slice(0, pos),
        after = doc.slice(pos);
      // `head` closes the partial line above; `gap` leaves one blank line when
      // there is anything above at all; `tail` is only needed when what follows
      // is not already on its own line.
      let head = before.length > 0 && !before.endsWith(nl) ? nl : "",
        gap = before.length > 0 ? nl : "",
        tail = after.length > 0 && !after.startsWith(nl) ? nl : "",
        where = editor.offsetToPos(pos),
        inserted = head + gap + block + tail;
      // The caret belongs on the line AFTER the block - never on the closing
      // fence, where the block widget swallows it and the caret simply
      // disappears, and never at the seam above it. When the note ends at
      // this block, append the closing newline so a caret line of its own
      // exists below; that also keeps repeated inserts from scripting the
      // caret back inside the fence.
      if (after.length === 0) inserted += nl;
      let end = pos + inserted.length,
        caret = after.length === 0 ? end : end + (tail ? 0 : 1);
      editor.replaceRange(inserted, where, where);
      const docNow = editor.getValue();
      const placeCaret = () => {
        let plain = true;
        try {
          let sels = editor.listSelections();
          plain =
            sels.length === 1 &&
            editor.posToOffset(sels[0].anchor) ===
              editor.posToOffset(sels[0].head);
        } catch (c) {
          // No selection introspection available: treat as a plain caret.
        }
        if (!plain) return;
        try {
          editor.setCursor(editor.offsetToPos(caret));
        } catch (c) {
          // Leave the mapped caret rather than crash if positioning fails.
        }
      };
      placeCaret();
      // Editors settle. A caret set straight after the change can be re-mapped
      // by the editor one step later (a command palette closing, decorations
      // re-laying out). One deferred re-assert puts it back, but only while the
      // document is exactly what we just wrote.
      try { setTimeout(placeCaret, 0); } catch (c) {
        // The synchronous placement above is still in force.
      }
    } catch (e) {
      console.error("Structured Cards: insert failed", e);
      new w.Notice(
        `Structured Cards: could not insert \u2014 ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }  insertField(t) {
    let e = Ot();
    ((e.hideLabel = !0),
      (e.items = [Z("title"), Z("text")]),
      (e.direction = this.settings.defaultDirection),
      this.insertBlock(t, W(e)));
  }
  insertTemplate(t, e) {
    let o = He(e.source || "");
    if (!o.trim()) {
      new w.Notice("This template is empty.");
      return;
    }
    this.insertBlock(t, o.trim());
  }
  saveLayoutTemplate(t) {
    let e = t.getSelection(),
      o = t.getValue(),
      s = t.posToOffset(t.getCursor()),
      n = e.trim();
    if (!n) {
      let a = R(o).find((d) => s >= d.from && s <= d.to);
      a && (n = o.slice(a.from, a.to));
    }
    if (
      !n ||
      (!n.includes("```structured-field") &&
        !n.includes("```structured-card") &&
        !/^#{1,6}\s|^---$/m.test(n))
    ) {
      new w.Notice(
        "Select a layout or place the cursor inside a structured field first.",
      );
      return;
    }
    new ct(this.app, void 0, async (a) => {
      (this.settings.templates.push(a),
        await this.saveSettings(),
        new w.Notice("Template saved"));
    }).openWithSource(n);
  }
  renderReadingField(t, e, o) {
    let s = `\`\`\`structured-field
${t}
\`\`\``,
      n = null;
    try {
      n = Q(s);
    } catch (c) {
      console.error("Structured Cards: parse failed", c);
    }
    if (!n) {
      this.malformed(e, s);
      return;
    }
    Be(e);
    let a = new w.MarkdownRenderChild(e);
    ((a.onunload = () => Y(e)), o.addChild(a));
    let d = (c) => {
      this.saveReadingBlock(o, s, W(c));
    };
    try {
      Et(e, n, this.renderOptions(), {
        commitOnBlur: !0,
        save: d,
        // The reading view has no CodeMirror to drag inside, so it gets its own
        // DOM-driven path. Before this existed the handle called an optional
        // callback that was never supplied and did nothing at all.
        beginDrag: (g) => {
          this.beginReadingDrag(g, o, n, e);
        },
        settings: (c) =>
          new K(this.app, c, (u) => {
            (Object.assign(c, u), d(c));
          }).open(),
        duplicate: () => {
          this.saveReadingBlock(
            o,
            s,
            `${s}
${_t(s)}`,
          );
        },
        delete: () => {
          this.saveReadingBlock(o, s, "");
        },
      });
    } catch (c) {
      (console.error("Structured Cards: render failed", c),
        this.malformed(e, s));
    }
  }
  renderLegacyCard(t, e, o) {
    let s = `\`\`\`structured-card
${t}
\`\`\``,
      n = ft(s);
    if (!n) {
      this.malformed(e, s);
      return;
    }
    bt(
      e,
      n,
      async (a) => this.saveReadingBlock(o, s, mt(a)),
      this.renderOptions(),
      { onFieldProperties: (a, d) => new K(this.app, a, d).open() },
    );
  }
  malformed(t, e) {
    (t.addClass("structured-cards-root", "sc-malformed"),
      t.createEl("strong", {
        text: "Structured Cards: this block could not be parsed.",
      }),
      t.createEl("pre", { text: e }));
  }
  async saveReadingBlock(t, e, o) {
    if (!t.sourcePath) return;
    let s = this.app.vault.getAbstractFileByPath(t.sourcePath);
    if (!(s instanceof w.TFile)) return;
    let n = !1;
    (await this.app.vault.process(s, (a) => {
      let d = e.replace(/\r/g, ""),
        c = [
          e,
          d,
          d.replace(
            /\n/g,
            `\r
`,
          ),
        ].find((p) => a.includes(p));
      if (!c) return a;
      let u = a.indexOf(c);
      if (u < 0 || a.indexOf(c, u + c.length) >= 0) return a;
      n = !0;
      // W()/mt() always emit "\n"; re-encode to whatever the matched text used
      // so saving into a CRLF note no longer mixes line endings.
      let nl = c.includes("\r\n") ? "\r\n" : "\n",
        body = o.replace(/\r\n|\r|\n/g, nl);
      return a.slice(0, u) + body + a.slice(u + c.length);
    }),
      n ||
        new w.Notice(
          "The field changed or was ambiguous. Reload the note and try again.",
        ));
  }
  buildDecorations(t) {
    let e = new J.RangeSetBuilder(),
      o = t.doc.toString(),
      s = [],
      n = o.includes("```structured-") ? R(o) : [];
    for (let a = 0; a < n.length;) {
      let d = n[a],
        c = [d],
        u = a + 1;
      if (d.field.row)
        for (
          ;
          u < n.length &&
          n[u].field.row === d.field.row &&
          /^\s*$/.test(o.slice(c[c.length - 1].to, n[u].from));
        )
          (c.push(n[u]), u++);
      if (c.length > 1) {
        let p = d.from,
          l = c[c.length - 1].to,
          f = c.map((m) => ({ ...m, source: o.slice(m.from, m.to) }));
        (s.push([
          p,
          l,
          O.Decoration.replace({
            widget: new Tt(f, o.slice(p, l), p, l, this),
            block: !0,
          }),
        ]),
          (a = u));
      } else
        (s.push([
          d.from,
          d.to,
          O.Decoration.replace({
            widget: new et(d.field, o.slice(d.from, d.to), d.from, d.to, this),
            block: !0,
          }),
        ]),
          a++);
    }
    for (let a of n.length ? Pt(o) : [])
      s.push([
        a.from,
        a.to,
        O.Decoration.replace({
          widget: new Ft(a.card, o.slice(a.from, a.to), a.from, a.to, this),
          block: !0,
        }),
      ]);
    // RangeSetBuilder requires ascending, non-overlapping ranges. The two scans
    // are independent regexes, so drop anything that overlaps what came first
    // instead of letting add() throw and blank the whole editor.
    s.sort((a, d) => a[0] - d[0] || a[1] - d[1]);
    let last = 0;
    for (let [a, d, c] of s) {
      if (a < last) continue;
      last = d;
      e.add(a, d, c);
    }
    return e.finish();
  }
  editorExtension() {
    let t = this,
      // Both handlers run on every keypress, so skip the scan entirely for the
      // overwhelming majority of notes that contain no blocks at all.
      scan = (n) => {
        let d = n.state.doc.toString();
        return d.includes("```structured-") ? R(d) : [];
      },
      // Prefer a field the cursor sits strictly inside, then the one ending at
      // the cursor (Backspace) or starting at it (Delete). Scanning in document
      // order used to pick whichever matched first at a shared boundary.
      pick = (fields, head, edge) =>
        fields.find((x) => head > x.from && head < x.to) ||
        fields.find((x) => (edge === "end" ? x.to : x.from) === head),
      e = [
        {
          key: "Backspace",
          run: (n) => {
            let a = n.state.selection.main.head,
              u = pick(scan(n), a, "end");
            if (!u) return !1;
            if (a === u.from) return !0;
            return (
              n.dispatch({ selection: { anchor: a, head: u.from } }), !0
            );
          },
        },
        {
          key: "Delete",
          run: (n) => {
            let a = n.state.selection.main.head,
              u = pick(scan(n), a, "start");
            if (!u) return !1;
            if (a === u.from)
              return (
                n.dispatch({ selection: { anchor: a, head: u.to } }), !0
              );
            return !1;
          },
        },
      ],
      o = J.StateField.define({
        create: (n) => {
          try {
            return t.buildDecorations(n);
          } catch (a) {
            return (
              t.p0DecorationError("initial-decoration-error", a, n),
              O.Decoration.none
            );
          }
        },
        update(n, a) {
          // Rebuild on doc change -- and on the plugin's own refresh effect,
          // which refreshRenderedCards sends after a settings change. An
          // ordinary transaction with no effect used to return the previous
          // value, so a settings toggle never reached an open editor widget:
          // widgets are only re-examined when the DecorationSet itself is
          // rebuilt (their eq compares the render key, so untouched widgets
          // keep their DOM).
          if (
            a.docChanged ||
            (a.effects || []).some((m) => m.is(ScRefresh))
          )
            try {
              return t.buildDecorations(a.state);
            } catch (d) {
              return (
                t.p0DecorationError("decoration-update-error", d, a.state),
                O.Decoration.none
              );
            }
          return n;
        },
        provide: (n) => O.EditorView.decorations.from(n),
      }),
      s = O.ViewPlugin.fromClass(
        class {
          constructor(n) {
            E(this, "view", null);
            this.view = n;
            // Register this live view with the plugin so refreshRenderedCards()
            // can dispatch the refresh effect to it without guessing where the
            // EditorView hides behind the Obsidian editor facade.
            t.editorViews?.add(n);
            try {
              let a = n.state.doc.toString(),
                d = n.state.selection.main.head;
              t.p0log("editor-created", {
                docLength: a.length,
                selection: d,
                cursorInsideField: R(a).some((c) => d >= c.from && d <= c.to),
              });
            } catch (a) {
              t.p0log("editor-created-failed", { error: String(a) });
            }
          }
          destroy() {
            (this.view && t.editorViews?.delete(this.view),
              this.view && t.dragged?.view === this.view && t.cancelPointerDrag());
          }
          update(n) {
            ((this.view = n.view),
              n.docChanged &&
                (t.dragged?.view === n.view && t.cancelPointerDrag(),
                n.view.dom
                  .querySelectorAll(".sc-standalone-field")
                  .forEach(at)));
          }
        },
      );
    return [O.keymap.of(e), J.Prec.highest(o), s];
  }
  /**
   * Reading-view drag.
   *
   * This used to be a dead button: the handle called an optional `beginDrag`
   * that renderReadingField never supplied, so `?.` swallowed the miss and
   * nothing happened. There is no CodeMirror here, so the whole thing is
   * DOM-driven: hit-test the rendered fields, then hand the decision to the
   * same Ct() engine the editor path uses, and write the file back.
   *
   * The file is the source of truth, not the preview. If the preview is stale
   * relative to the file the edit is refused with a Notice rather than applied
   * against offsets that no longer describe anything.
   */
  async beginReadingDrag(evt, ctx, field, root) {
    if (!this.settings.showEditingControls || !this.settings.showDragHandles) return;
    if (!ctx.sourcePath) return;
    let doc = root.ownerDocument,
      win = doc.defaultView,
      sizer = root.closest(".markdown-preview-sizer") || root.parentElement;
    if (!sizer) return;

    root.addClass("is-dragging");
    let releaseHover = scHoverLock(),
      releasePointer = scCapturePointer(root, evt);
    // Where the field was when the drag began. Every later decision is made from
    // this box shifted by the pointer's travel, not from the pointer alone.
    let grab = { x: evt.clientX, y: evt.clientY, rect: root.getBoundingClientRect() };
    let overlay = doc.body.createDiv({ cls: "structured-cards-root sc-drag-overlay" }),
      ph = overlay.createDiv({ cls: "sc-drop-placeholder" }),
      guides = [
        overlay.createDiv({ cls: "sc-drag-guide" }),
        overlay.createDiv({ cls: "sc-drag-guide" }),
        overlay.createDiv({ cls: "sc-drag-guide" }),
      ];
    tt(ph, guides);

    let abort = new AbortController(),
      opts = { signal: abort.signal },
      start = { x: evt.clientX, y: evt.clientY },
      moved = false,
      choice = null,
      file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);

    let cleanup = () => {
      abort.abort();
      ph.remove();
      overlay.remove();
      root.removeClass("is-dragging");
      releasePointer();
      releaseHover();
      if (this.readingDrag?.cancel === cleanup) this.readingDrag = null;
    };
    // A single slot, torn down by onunload. Registering a cleanup per drag would
    // append to the plugin's component list on every pointerup and grow without
    // bound over a long session.
    this.readingDrag?.cancel?.();
    this.readingDrag = { cancel: cleanup };

    // --- pointer tracking ---------------------------------------------------
    win.addEventListener(
      "pointermove",
      (e) => {
        if (e.pointerId !== evt.pointerId) return;
        if (!root.isConnected) return cleanup();
        moved ||= Math.abs(e.clientY - start.y) > 4 || Math.abs(e.clientX - start.x) > 4;
        if (!moved) return;

        choice = hitTestReadingDrop(sizer, root, { x: e.clientX, y: e.clientY }, grab);
        if (!choice) return tt(ph, guides);

        let r = choice.rect;
        if (choice.kind === "start") Lt(ph, guides, r ? r.top : e.clientY, sizer.getBoundingClientRect(), this.settings.snapGuides);
        else if (choice.kind === "end") Lt(ph, guides, r ? r.bottom : e.clientY, sizer.getBoundingClientRect(), this.settings.snapGuides);
        else if (r) {
          // The painter wants a RECT, and the hit-test already measured one.
          // Asking a DOMRect for getBoundingClientRect() throws, which is why
          // the line never moved while the field still did.
          //
          // Which rect is the real question. "Beside" lines up with the target's
          // row rather than the dragged field's row -- the dragged field's row is
          // where it already is, so using it drew the placeholder where the
          // field was rather than where it would go. Every other placement on a
          // row target joins that row too: Ct() puts the block at the edge of
          // the whole row. Drawing against the individual field would promise a
          // slot the write does not take, which is the same disagreement in a
          // different place.
          let row = choice.el?.closest?.(".sc-field-row");
          Kt(ph, guides, row ? row.getBoundingClientRect() : r, choice.placement, this.settings.snapGuides, choice.side);
        } else tt(ph, guides);
      },
      opts,
    );

    win.addEventListener(
      "pointerup",
      async (e) => {
        if (e.pointerId !== evt.pointerId) return;
        let target = choice;
        cleanup();
        if (!moved || !target) return;
        await this.applyReadingMove(file, field.id, target);
      },
      opts,
    );

    win.addEventListener("pointercancel", cleanup, opts);
    win.addEventListener("blur", cleanup, opts);
    win.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape") cleanup();
      },
      opts,
    );
  }

  /** Perform the move the indicator was promising, or say why it cannot. */
  async applyReadingMove(file, sourceId, target) {
    if (!(file instanceof w.TFile))
      return new w.Notice("Structured Cards: that note is no longer available.");
    let ok = false;
    try {
      await this.app.vault.process(file, (text) => {
        // Refuse against a stale preview rather than writing to offsets that no
        // longer describe the file. Ct() returns its input unchanged when an id
        // is missing or ambiguous, which is the same signal.
        let next =
          target.kind === "field"
            ? Ct(text, sourceId, target.id, target.placement, void 0, void 0, {})
            : Ct(text, sourceId, void 0, "after", target.kind === "end" ? text.length : 0, void 0, {
                blankLines: target.kind === "end" ? 2 : 0,
              });
        if (next === text) return text;
        ok = true;
        return next;
      });
    } catch (err) {
      console.error("Structured Cards: reading drag failed", err);
      return new w.Notice(`Structured Cards: move failed. ${String(err)}`);
    }
    if (!ok)
      return new w.Notice(
        "Structured Cards: that field moved or changed on disk. Reload the note and try again.",
      );
    this.rerenderReading(file);
  }

  /** Re-render the preview so the DOM matches the file we just rewrote. */
  rerenderReading(file) {
    try {
      for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
        let v = leaf.view;
        if (!v || v.file?.path !== file.path) continue;
        v.previewMode?.rerender?.(true);
      }
    } catch (err) {
      // A failure here means the file is correct but the preview is stale.
      // Reloading the leaf is the fallback; if that also fails, leave it -- the
      // next manual reload will show the truth.
      console.error("Structured Cards: could not re-render the preview", err);
      for (const leaf of this.app.workspace.getLeavesOfType("markdown"))
        if (leaf.view?.file?.path === file.path) leaf.view?.reload?.();
    }
  }

  moveField(t, e, o, s, n = {}) {
    let a = t.state.doc.toString(),
      d = Ct(a, e.field.id, o.field.id, s, void 0, void 0, n);
    this.applyDocEdit(t, d);
  }
  moveFieldToPosition(t, e, o, s = {}) {
    let n = t.state.doc.toString(),
      a = Ct(n, e.field.id, void 0, "after", o, void 0, s);
    this.applyDocEdit(t, a);
  }
  /**
   * Replace the document with `next`, dispatching only the span that actually
   * changed. Ct() rebuilds the whole note as a string, but handing that to
   * CodeMirror as one `from:0, to:length` change discards the cursor, rewrites
   * every position, and conflicts with concurrent edits (sync, collaboration).
   */
  applyDocEdit(t, next) {
    let cur = t.state.doc.toString();
    if (cur === next) return;
    let a = 0,
      b = 0,
      n = Math.min(cur.length, next.length);
    for (; a < n && cur[a] === next[a]; ) a++;
    for (; b < n - a && cur[cur.length - 1 - b] === next[next.length - 1 - b]; )
      b++;
    t.dispatch({
      changes: {
        from: a,
        to: cur.length - b,
        insert: next.slice(a, next.length - b),
      },
      userEvent: "input.move",
      annotations: j.isolateHistory.of("full"),
    });
  }
  beginPointerDrag(t, e, o, s) {
    (this.cancelPointerDrag(), ot(s), (this.dragged = { ...o, view: e }));
    let n = s.ownerDocument,
      a = n.defaultView,
      d = new AbortController();
    ((this.dragAbort = d), s.addClass("is-dragging")),
    (this.releaseHover = scHoverLock()),
    (this.releasePointer = scCapturePointer(s, t));
    // The hit-test runs on every pointermove. Parsing the whole note each time
    // made dragging expensive on large files, so cache the scan and only redo it
    // if the document actually changed underneath us.
    let cache = { len: -1, fields: [] },
      fieldAt = (v, pos) => {
        let len = v.state.doc.length;
        if (len !== cache.len) {
          let text = v.state.doc.toString();
          cache =
            text.includes("```structured-")
              ? { len, fields: R(text) }
              : { len, fields: [] };
        }
        return cache.fields.find((x) => pos >= x.from && pos <= x.to);
      };
    let c = n.body.createDiv({ cls: "structured-cards-root sc-drag-overlay" });
    this.dragOverlay = c;
    let u = c.createDiv({ cls: "sc-drop-placeholder" }),
      p = [
        c.createDiv({ cls: "sc-drag-guide" }),
        c.createDiv({ cls: "sc-drag-guide" }),
        c.createDiv({ cls: "sc-drag-guide" }),
      ];
    tt(u, p);
    let l = {},
      f = !1,
      m = { x: t.clientX, y: t.clientY },
      v = 0,
      S = () => {
        if (((l = {}), !s.isConnected)) {
          this.cancelPointerDrag();
          return;
        }
        let b = e.contentDOM.getBoundingClientRect(),
          D = e.scrollDOM.getBoundingClientRect();
        if (m.x < b.left || m.x > b.right || m.y < D.top || m.y > D.bottom) {
          tt(u, p);
          return;
        }
        let H = Array.from(
          e.dom.querySelectorAll(".sc-standalone-field[data-sc-from]"),
        )
          .filter((y) => y !== s)
          .map((y) => ({ el: y, rect: y.getBoundingClientRect() }))
          .filter(({ rect: y }) => m.y >= y.top && m.y <= y.bottom)
          .sort(
            (y, C) =>
              Math.max(y.rect.left - m.x, m.x - y.rect.right, 0) -
              Math.max(C.rect.left - m.x, m.x - C.rect.right, 0),
          )[0];
        if (H) {
          let { el: y, rect: C } = H,
            L = Number(y.dataset.scFrom),
            P = Number(y.dataset.scTo),
            U = Q(e.state.doc.sliceString(L, P));
          if (U) {
            // Whether the drag is sideways decides the kind of drop, NOT where the
            // pointer happens to sit horizontally. Gating "before" and "after" on
            // the pointer being inside the target's width meant that any x past a
            // narrow field's right edge -- or anywhere in the right margin --
            // silently turned a straight downward drag into a row join, and the
            // field landed beside the target instead of below it.
            //
            // The reading view already decided this the right way, from |dx| vs
            // |dy|. This path now does the same.
            let sideways = Math.abs(m.x - t.clientX) > Math.abs(m.y - t.clientY),
              X = m.x >= C.left && m.x <= C.right,
              rt = Math.min(16, C.height * 0.22),
              ut = sideways
                ? "beside"
                : (X && m.y < C.top + rt) || (!X && m.y < C.top + C.height / 2)
                  ? "before"
                  : "after",
              zt = m.x < C.left + C.width / 2 ? "left" : "right";
            l = {
              target: { from: L, to: P, field: U },
              placement: ut,
              side: zt,
            };
            let Gt =
              ut === "beside"
                ? C
                : y.closest(".sc-field-row")?.getBoundingClientRect() || C;
            Kt(u, p, Gt, ut, this.settings.snapGuides, zt);
            return;
          }
        }
        let A = e.documentTop + e.lineBlockAt(e.state.doc.length).bottom;
        if (m.y > A) {
          let y = s.closest(".sc-field-row"),
            C = y
              ? Array.from(y.children)
                  .filter((P) => P !== s)
                  .map((P) => P.getBoundingClientRect().height)
              : [],
            L = C.length
              ? Math.max(0, s.getBoundingClientRect().height - Math.max(...C))
              : s.getBoundingClientRect().height;
          ((l = {
            position: e.state.doc.length,
            blankLines: qt(m.y, A - L, e.defaultLineHeight),
          }),
            Lt(u, p, m.y, b, this.settings.snapGuides));
          return;
        }
        let F = e.posAtCoords(
          { x: Math.max(b.left + 1, Math.min(b.right - 1, m.x)), y: m.y },
          !1,
        );
        if ((m.y <= b.top && (F = 0), F !== null)) {
          let y = fieldAt(e, F);
          if (y) {
            let P = Array.from(
              e.dom.querySelectorAll(".sc-standalone-field[data-sc-from]"),
            ).find((rt) => Number(rt.dataset.scFrom) === y.from);
            if (y.field.id === o.field.id || !P) {
              tt(u, p);
              return;
            }
            let U =
                P.closest(".sc-field-row")?.getBoundingClientRect() ||
                P.getBoundingClientRect(),
              X = m.y < (U.top + U.bottom) / 2 ? "before" : "after";
            ((l = { target: y, placement: X }),
              Kt(u, p, U, X, this.settings.snapGuides));
            return;
          }
          let C = e.state.doc.lineAt(F),
            L = e.coordsAtPos(C.from);
          if (
            ((F = L && m.y > (L.top + L.bottom) / 2 ? C.to : C.from),
            F >= o.from && F <= o.to)
          ) {
            tt(u, p);
            return;
          }
          ((l = { position: F }),
            Lt(
              u,
              p,
              L ? (F === C.from ? L.top : L.bottom) : m.y,
              b,
              this.settings.snapGuides,
            ));
        } else tt(u, p);
      },
      g = () => {
        if (!d.signal.aborted) {
          if (f) {
            let b = e.scrollDOM.getBoundingClientRect(),
              D = 48,
              x =
                m.y < b.top + D
                  ? -Math.min(18, (b.top + D - m.y) / 3)
                  : m.y > b.bottom - D
                    ? Math.min(18, (m.y - b.bottom + D) / 3)
                    : 0;
            if (
              x &&
              m.x >= b.left &&
              m.x <= b.right &&
              m.y >= b.top &&
              m.y <= b.bottom
            ) {
              let H = e.scrollDOM.scrollTop;
              ((e.scrollDOM.scrollTop += x),
                e.scrollDOM.scrollTop !== H && S());
            }
          }
          d.signal.aborted || (v = a.requestAnimationFrame(g));
        }
      };
    ((v = a.requestAnimationFrame(g)),
      d.signal.addEventListener("abort", () => a.cancelAnimationFrame(v), {
        once: !0,
      }));
    let h = (b) => {
        b.pointerId === t.pointerId &&
          ((m = { x: b.clientX, y: b.clientY }),
          (f ||= Math.hypot(m.x - t.clientX, m.y - t.clientY) > 4),
          f && (b.preventDefault(), S()));
      },
      k = (b) => {
        let D = this.dragged,
          x = l;
        this.cancelPointerDrag();
        if (!b || !f || !D) return;
        /**
         * The block has to be exactly what it was when the drag began, or the
         * offsets in hand no longer describe it.
         *
         * This used to short-circuit in silence. The drop line had already
         * promised a slot, the user released, and nothing happened and nothing
         * was said -- which reads as the plugin ignoring them. The reading view
         * raises a Notice for exactly this case; this path now does too.
         */
        if (e.state.doc.sliceString(D.from, D.to) !== D.source)
          return new w.Notice(
            "Structured Cards: that field changed while you were dragging it, so the move was not applied.",
          );
        return (
          x.target && x.placement
            ? this.moveField(e, D, x.target, x.placement, x)
            : x.position !== void 0 && this.moveFieldToPosition(e, D, x.position, x)
        );
      },
      T = { signal: d.signal, capture: !0 };
    (a.addEventListener("pointermove", h, T),
      a.addEventListener(
        "pointerup",
        (b) => {
          b.pointerId === t.pointerId && (h(b), k(!0));
        },
        T,
      ),
      a.addEventListener(
        "pointercancel",
        (b) => {
          b.pointerId === t.pointerId && k(!1);
        },
        T,
      ),
      a.addEventListener("blur", () => k(!1), T),
      a.addEventListener(
        "keydown",
        (b) => {
          b.key === "Escape" && k(!1);
        },
        T,
      ),
      e.scrollDOM.addEventListener(
        "scroll",
        () => {
          f && S();
        },
        T,
      ));
  }
  cancelPointerDrag() {
    (this.releasePointer?.(),
      (this.releasePointer = null),
      this.releaseHover?.(),
      (this.releaseHover = null),
      this.dragAbort?.abort(),
      (this.dragAbort = null),
      this.dragOverlay?.remove(),
      (this.dragOverlay = null),
      this.dragged?.view.dom
        .querySelectorAll(".is-dragging")
        .forEach((t) => t.removeClass("is-dragging")),
      (this.dragged = null));
  }
};
function G(i) {
  if (!i) return null;
  let r = i instanceof HTMLElement ? i : i.parentElement;
  if (!r) return null;
  let t = r.closest(".cm-editor");
  return O.EditorView.findFromDOM(t || r);
}
var et = class extends O.WidgetType {
    constructor(t, e, o, s, n) {
      super();
      E(this, "field", t);
      E(this, "source", e);
      E(this, "from", o);
      E(this, "to", s);
      E(this, "plugin", n);
    }
    eq(t) {
      /**
       * The render options belong in here.
       *
       * CodeMirror asks a widget whether it is still the same widget and reuses
       * its DOM when the answer is yes. Comparing only the source text and the
       * offsets meant that after ANY settings change the widget said "yes, same
       * thing" and its DOM was kept -- so renderOptions() was never re-read, and
       * flipping a switch wrote data.json and changed nothing on screen until the
       * note was reopened.
       *
       * renderOptions() returns a fresh object each call, so the options cannot
       * be compared by identity; renderKey() is the flat form eq() compares.
       */
      return (
        this.source === t.source &&
        this.from === t.from &&
        this.to === t.to &&
        (t.renderKey ? t.renderKey() : "") === this.renderKey()
      );
    }
    renderKey() {
      let e = (this.plugin && this.plugin.renderOptions && this.plugin.renderOptions()) || {};
      return [
        e.revealSecrets,
        e.defaultDirection,
        e.animations,
        e.showEditingControls,
        e.showDragHandles,
        e.responsive,
        e.snapGuides,
      ].join("\u0001");
    }
    actions(t) {
      return {
        save: (o, s) => this.replace(t, W(o), s),
        settings: (o) =>
          new K(this.plugin.app, o, (s) => {
            (Object.assign(o, s), this.replace(t, W(o)));
          }).open(),
        duplicate: () => {
          let o = G(t);
          o &&
            o.state.doc.sliceString(this.from, this.to) === this.source &&
            o.dispatch({
              changes: {
                from: this.to,
                to: this.to,
                insert: `
${_t(this.source)}`,
              },
              userEvent: "input",
            });
        },
        delete: () => {
          let o = G(t);
          if (!o || o.state.doc.sliceString(this.from, this.to) !== this.source)
            return;
          let s = Pe(o.state.doc.toString(), this.from, this.to);
          o.dispatch({
            changes: { from: s.from, to: s.to, insert: "" },
            userEvent: "delete",
          });
        },
        beginDrag: (o) => {
          let s = G(t);
          s &&
            this.plugin.beginPointerDrag(
              o,
              s,
              {
                from: this.from,
                to: this.to,
                source: this.source,
                field: clonePlain(this.field),
              },
              t,
            );
        },
        layout: () => G(t)?.requestMeasure(),
        history: (o) => {
          let s = G(t);
          return s ? (o ? (0, j.redo)(s) : (0, j.undo)(s)) : !1;
        },
      };
    }
    toDOM(t) {
      let e = t.dom.ownerDocument.createElement("div");
      return (
        (e.dataset.scFrom = String(this.from)),
        (e.dataset.scTo = String(this.to)),
        Et(
          e,
          clonePlain(this.field),
          this.plugin.renderOptions(),
          this.actions(e),
        ),
        e
      );
    }
    updateDOM(t) {
      return (
        (t.dataset.scFrom = String(this.from)),
        (t.dataset.scTo = String(this.to)),
        Wt(t, clonePlain(this.field), this.actions(t))
      );
    }
    destroy(t) {
      Y(t);
    }
    replace(t, e, o) {
      let s = G(t);
      if (s) {
        if (s.state.doc.sliceString(this.from, this.to) !== this.source) {
          new w.Notice(
            "This field changed. Reload its preview before editing again.",
          );
          return;
        }
        e !== this.source &&
          s.dispatch({
            changes: { from: this.from, to: this.to, insert: e },
            userEvent: o === "typing" ? "input.type" : "input",
            annotations: o === "typing" ? [] : j.isolateHistory.of("full"),
          });
      }
    }
    ignoreEvent() {
      return !0;
    }
  },
  Tt = class extends O.WidgetType {
    constructor(t, e, o, s, n) {
      super();
      E(this, "fields", t);
      E(this, "source", e);
      E(this, "from", o);
      E(this, "to", s);
      E(this, "plugin", n);
    }
    eq(t) {
      /**
       * The render options belong in here.
       *
       * CodeMirror asks a widget whether it is still the same widget and reuses
       * its DOM when the answer is yes. Comparing only the source text and the
       * offsets meant that after ANY settings change the widget said "yes, same
       * thing" and its DOM was kept -- so renderOptions() was never re-read, and
       * flipping a switch wrote data.json and changed nothing on screen until the
       * note was reopened.
       *
       * renderOptions() returns a fresh object each call, so the options cannot
       * be compared by identity; renderKey() is the flat form eq() compares.
       */
      return (
        this.source === t.source &&
        this.from === t.from &&
        this.to === t.to &&
        (t.renderKey ? t.renderKey() : "") === this.renderKey()
      );
    }
    renderKey() {
      let e = (this.plugin && this.plugin.renderOptions && this.plugin.renderOptions()) || {};
      return [
        e.revealSecrets,
        e.defaultDirection,
        e.animations,
        e.showEditingControls,
        e.showDragHandles,
        e.responsive,
        e.snapGuides,
      ].join("\u0001");
    }
    toDOM(t) {
      let e = t.dom.ownerDocument.createElement("div");
      ((e.className = "structured-cards-root sc-field-row"),
        e.setAttribute("dir", "ltr"));
      for (let o of this.fields)
        e.appendChild(
          new et(o.field, o.source, o.from, o.to, this.plugin).toDOM(t),
        );
      return e;
    }
    updateDOM(t) {
      return t.children.length !== this.fields.length ||
        this.fields.some((e, o) => t.children[o].dataset.fieldId !== e.field.id)
        ? !1
        : this.fields.every((e, o) =>
            new et(e.field, e.source, e.from, e.to, this.plugin).updateDOM(
              t.children[o],
            ),
          );
    }
    destroy(t) {
      for (let e of Array.from(t.children)) Y(e);
    }
    ignoreEvent() {
      return !0;
    }
  },
  Ft = class extends O.WidgetType {
    constructor(t, e, o, s, n) {
      super();
      E(this, "card", t);
      E(this, "source", e);
      E(this, "from", o);
      E(this, "to", s);
      E(this, "plugin", n);
    }
    eq(t) {
      /**
       * The render options belong in here.
       *
       * CodeMirror asks a widget whether it is still the same widget and reuses
       * its DOM when the answer is yes. Comparing only the source text and the
       * offsets meant that after ANY settings change the widget said "yes, same
       * thing" and its DOM was kept -- so renderOptions() was never re-read, and
       * flipping a switch wrote data.json and changed nothing on screen until the
       * note was reopened.
       *
       * renderOptions() returns a fresh object each call, so the options cannot
       * be compared by identity; renderKey() is the flat form eq() compares.
       */
      return (
        this.source === t.source &&
        this.from === t.from &&
        this.to === t.to &&
        (t.renderKey ? t.renderKey() : "") === this.renderKey()
      );
    }
    renderKey() {
      let e = (this.plugin && this.plugin.renderOptions && this.plugin.renderOptions()) || {};
      return [
        e.revealSecrets,
        e.defaultDirection,
        e.animations,
        e.showEditingControls,
        e.showDragHandles,
        e.responsive,
        e.snapGuides,
      ].join("\u0001");
    }
    toDOM(t) {
      let e = t.dom.ownerDocument.createElement("div");
      try {
        bt(
          e,
          clonePlain(this.card),
          async (o) => {
            let s = G(e);
            s &&
              s.state.doc.sliceString(this.from, this.to) === this.source &&
              s.dispatch({
                changes: { from: this.from, to: this.to, insert: mt(o) },
              });
          },
          this.plugin.renderOptions(),
          { onFieldProperties: (o, s) => new K(this.plugin.app, o, s).open() },
        );
      } catch (o) {
        (console.error("Structured Cards: legacy card render failed", o),
          e.empty(),
          e.addClass("structured-cards-root", "sc-malformed"),
          e.setText("Structured Cards: could not render this card."));
      }
      return e;
    }
    ignoreEvent() {
      // Same as the other block widgets. Returning false let CodeMirror handle
      // events over the card, so its contentEditable titles and inline inputs
      // fought the editor in Live Preview.
      return !0;
    }
  },
  Dt = class extends w.Modal {
    constructor(t, e, o) {
      super(t);
      E(this, "plugin", e);
      E(this, "editor", o);
    }
    onOpen() {
      (this.modalEl.addClass("structured-cards-root", "sc-template-picker"),
        this.titleEl.setText("Insert template"),
        this.plugin.settings.templates.length ||
          this.contentEl.createEl("p", {
            text: "No templates yet. Select a layout and save it as a template.",
          }));
      for (let t of this.plugin.settings.templates)
        new w.Setting(this.contentEl)
          .setName(t.name)
          .setDesc(t.description || "User-created layout")
          .addButton((e) =>
            e
              .setButtonText("Insert")
              .setCta()
              .onClick(() => {
                (this.plugin.insertTemplate(this.editor, t), this.close());
              }),
          );
    }
  },
  ct = class extends w.Modal {
    constructor(t, e, o) {
      super(t);
      E(this, "template", e);
      E(this, "save", o);
      E(this, "source", "");
    }
    openWithSource(t) {
      ((this.source = t), this.open());
    }
    onOpen() {
      (this.modalEl.addClass("structured-cards-root", "sc-template-editor"),
        this.titleEl.setText(
          this.template ? "Edit template" : "Save layout as template",
        ));
      let t = this.template?.name || "Untitled template",
        e = this.template?.description || "";
      ((this.source = this.source || this.template?.source || ""),
        new w.Setting(this.contentEl)
          .setName("Name")
          .addText((n) => n.setValue(t).onChange((a) => (t = a))),
        new w.Setting(this.contentEl)
          .setName("Description")
          .addText((n) => n.setValue(e).onChange((a) => (e = a))));
      let o = this.contentEl.createEl("details", { cls: "sc-advanced" });
      o.createEl("summary", { text: "Portable template source" });
      let s = o.createEl("textarea", { cls: "sc-template-source" });
      ((s.value = this.source),
        (s.oninput = () => (this.source = s.value)),
        new w.Setting(this.contentEl).addButton((n) =>
          n
            .setButtonText("Save")
            .setCta()
            .onClick(async () => {
              if (!t.trim()) {
                new w.Notice("Template name is required");
                return;
              }
              let a = Date.now();
              (await this.save({
                id: this.template?.id || $(),
                name: t.trim(),
                description: e,
                source: this.source,
                createdAt: this.template?.createdAt || a,
                updatedAt: a,
              }),
                this.close());
            }),
        ));
    }
  },
  lt = class extends w.Modal {
    constructor(t, e) {
      super(t);
      E(this, "plugin", e);
    }
    onOpen() {
      (this.modalEl.addClass("structured-cards-root", "sc-template-manager"),
        this.titleEl.setText("Templates"),
        this.draw());
    }
    draw() {
      (this.contentEl.empty(),
        new w.Setting(this.contentEl)
          .setName("Import templates")
          .addButton((t) =>
            t.setButtonText("Import JSON").onClick(() => {
              this.import();
            }),
          ),
        new w.Setting(this.contentEl)
          .setName("Export all templates")
          .addButton((t) =>
            t.setButtonText("Copy JSON").onClick(() => {
              copyText(
                JSON.stringify(this.plugin.settings.templates, null, 2),
                "Templates copied",
              );
            }),
          ),
        this.plugin.settings.templates.length ||
          this.contentEl.createEl("p", {
            text: "No templates. Structured Cards does not install bundled content.",
          }),
        this.plugin.settings.templates.forEach((t, e) => {
          let o = new w.Setting(this.contentEl)
            .setName(t.name)
            .setDesc(t.description || "User-created layout");
          (o.addButton((s) =>
            s.setButtonText("Edit").onClick(() =>
              new ct(this.app, t, async (n) => {
                ((this.plugin.settings.templates[e] = n),
                  await this.plugin.saveSettings(),
                  this.draw());
              }).open(),
            ),
          ),
            o.addExtraButton((s) =>
              s
                .setIcon("copy")
                .setTooltip("Duplicate")
                .onClick(async () => {
                  (this.plugin.settings.templates.splice(e + 1, 0, {
                    ...clonePlain(t),
                    id: $(),
                    name: `${t.name} copy`,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                  }),
                    await this.plugin.saveSettings(),
                    this.draw());
                }),
            ),
            o.addExtraButton((s) =>
              s
                .setIcon("download")
                .setTooltip("Export")
                .onClick(() =>
                  copyText(JSON.stringify(t, null, 2), "Template copied"),
                ),
            ),
            o.addExtraButton((s) =>
              s
                .setIcon("trash-2")
                .setTooltip("Delete")
                .onClick(() => {
                  new w.ConfirmModal(this.app, {
                    title: "Delete template",
                    message: `Delete template \u201C${t.name}\u201D?`,
                    cta: "Delete",
                    onResult: async (ok) => {
                      if (!ok) return;
                      (this.plugin.settings.templates.splice(e, 1),
                        await this.plugin.saveSettings(),
                        this.draw());
                    },
                  }).open();
                }),
            ));
        }));
    }
    import() {
      // A native prompt() cannot hold multi-line JSON comfortably.
      new w.TextPrompt(this.app, {
        title: "Import templates",
        desc: "Paste the JSON exported from Structured Cards.",
        placeholder: '[{ "name": "...", "source": "..." }]',
        onSubmit: async (t) => {
          if (!t || !t.trim()) return;
          try {
            let e = JSON.parse(t),
              o = Array.isArray(e) ? e : [e];
            for (let s of o) {
              if (!Re(s)) throw new Error("Invalid template data");
              this.plugin.settings.templates.push({
                ...s,
                id: this.plugin.settings.templates.some((n) => n.id === s.id)
                  ? $()
                  : s.id,
              });
            }
            (await this.plugin.saveSettings(),
              this.draw(),
              new w.Notice(
                `Imported ${o.length} template${o.length === 1 ? "" : "s"}`,
              ));
          } catch (e) {
            new w.Notice(
              e instanceof Error ? e.message : "Invalid template JSON",
            );
          }
        },
      }).open();
    }
  },
  Mt = class extends w.PluginSettingTab {
    constructor(t, e) {
      super(t, e);
      E(this, "plugin", e);
    }
    display() {
      let t = this.containerEl,
        toggle = (e, o, s, n) =>
          new w.Setting(t)
            .setName(e)
            .setDesc(n || "")
            .addToggle((a) =>
              a.setValue(this.plugin.settings[o]).onChange(async (c) => {
                (this.plugin.settings[o] = c),
                  s && s(c),
                  await this.plugin.saveSettings();
              }),
            );
      (t.empty(),
        t.addClass("structured-cards-root", "sc-settings"),
        t.createEl("h2", { text: "Structured Cards" }),
        // This one stores the inverse of the label, so it cannot use toggle().
        new w.Setting(t)
          .setName("Mask secrets by default")
          .setDesc("Off: secrets start revealed until you click the eye.")
          .addToggle((e) =>
            e
              .setValue(!this.plugin.settings.revealSecretsByDefault)
              .onChange(async (o) => {
                ((this.plugin.settings.revealSecretsByDefault = !o),
                  await this.plugin.saveSettings());
              }),
          ),
        new w.Setting(t)
          .setName("Default text direction")
          .setDesc(
            "The base direction for every field left on Auto, and the direction new fields start with; a field can still set its own in its menu. Auto means each field follows its content. Layout geometry always stays left-to-right.",
          )
          .addDropdown((e) =>
            e
              .addOptions({ auto: "Auto", rtl: "RTL", ltr: "LTR" })
              .setValue(this.plugin.settings.defaultDirection)
              .onChange(async (o) => {
                ((this.plugin.settings.defaultDirection = o),
                  await this.plugin.saveSettings());
              }),
          ),
        toggle("Show editing controls", "showEditingControls", null, "Menus, resize handles and the duplicate/delete actions."),
        toggle("Show drag handles", "showDragHandles", null, "Only used when editing controls are shown."),
        toggle("Responsive layout", "responsive", null, "Collapse multi-column cards and rows on narrow screens."),
        toggle("Snap guides", "snapGuides", null, "Alignment guides while dragging."),
        toggle("Animations", "animations", null, ""),
        // debugLogging stays available but is not a settings-tab row: it is a
        // diagnostic that wraps core Obsidian methods and slows navigation,
        // documented in docs/architecture.md under Diagnostics. Set
        // `debugLogging: true` in data.json when a session needs it.
        new w.Setting(t)
          .setName("Templates")
          .setDesc(
            `${this.plugin.settings.templates.length} user-created template(s)`,
          )
          .addButton((e) =>
            e
              .setButtonText("Manage")
              .onClick(() => new lt(this.app, this.plugin).open()),
          ));
    }
  };
function Pe(i, r, t) {
  return i.slice(t, t + 2) ===
    `\r
`
    ? { from: r, to: t + 2 }
    : i[t] ===
        `
`
      ? { from: r, to: t + 1 }
      : r > 0 &&
          i.slice(r - 2, r) ===
            `\r
`
        ? { from: r - 2, to: t }
        : r > 0 &&
            i[r - 1] ===
              `
`
          ? { from: r - 1, to: t }
          : { from: r, to: t };
}
function _t(i) {
  let r = Q(i);
  if (!r) return i;
  // A duplicate must not keep the original's row id, or the copy and the source
  // collide as one row in the note.
  r.id = $();
  if (r.row) r.row = `row-${$()}`;
  return W(r);
}
function He(i) {
  let r = new Map(),
    t = 0,
    e = "";
  for (let o of R(i)) {
    e += i.slice(t, o.from);
    let s = clonePlain(o.field);
    ((s.id = $()),
      s.row &&
        (r.has(s.row) || r.set(s.row, `row-${$()}`), (s.row = r.get(s.row))),
      (e += W(s)),
      (t = o.to));
  }
  return e + i.slice(t);
}
function Ie(i) {
  let r = i.layout === "auto" ? 1 : Number(i.layout) || 1,
    t = 100 / r,
    e = [];
  for (let o of i.sections) {
    o.title && e.push(`## ${o.title}`);
    for (let s of o.items)
      s.kind === "heading"
        ? e.push(`### ${s.value}`)
        : s.kind === "text"
          ? e.push(s.value)
          : s.kind === "separator"
            ? e.push("---")
            : e.push(
                W({
                  ...s,
                  width: s.fullWidth
                    ? 100
                    : Math.min(100, t * Math.max(1, s.span || 1)),
                }),
              );
  }
  return e.join(`

`);
}
function Re(i) {
  return (
    !!i &&
    typeof i == "object" &&
    typeof i.id == "string" &&
    typeof i.name == "string" &&
    typeof i.source == "string"
  );
}
function Be(i) {
  i.addClass("structured-cards-field-processor");
  let r = i.closest("pre");
  if (r) {
    r.addClass("structured-cards-root", "structured-cards-code-host");
    let e = r.previousElementSibling;
    e && e.addClass("structured-cards-root", "structured-cards-code-host");
  }
  let t = (r || i).parentElement;
  t &&
    (t.addClass("structured-cards-root", "structured-cards-code-host"),
    t.parentElement &&
      t.parentElement.addClass(
        "structured-cards-root",
        "structured-cards-code-host",
      ));
}
function tt(i, r) {
  i.hide();
  for (let t of r) t.hide();
}
function Kt(i, r, t, e, o, s = "right") {
  if (e !== "beside") {
    Lt(i, r, e === "before" ? t.top : t.bottom, t, o);
    return;
  }
  (i.show(),
    Object.assign(i.style, {
      left: `${s === "left" ? t.left : t.left + t.width / 2}px`,
      top: `${t.top}px`,
      width: `${t.width / 2}px`,
      height: `${t.height}px`,
    }),
    [t.left, t.left + t.width / 2, t.right].forEach((n, a) => {
      let d = r[a];
      ((d.style.display = o ? "" : "none"),
        Object.assign(d.style, {
          left: `${n}px`,
          top: `${Math.max(0, t.top - 18)}px`,
          height: `${t.height + 36}px`,
        }));
    }));
}
function Lt(i, r, t, e, o) {
  if (
    (i.show(),
    (i.style.left = `${e.left}px`),
    (i.style.top = `${t}px`),
    (i.style.width = `${e.width}px`),
    (i.style.height = "3px"),
    !o)
  ) {
    for (let s of r) s.hide();
    return;
  }
  for (let s of r) s.hide();
  (r[1].show(),
    (r[1].style.left = `${e.left + e.width / 2}px`),
    (r[1].style.top = `${Math.max(0, t - 20)}px`),
    (r[1].style.height = "40px"));
}

