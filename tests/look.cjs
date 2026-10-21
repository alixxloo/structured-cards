"use strict";
// Visual/layout assertions that a screenshot cannot make but CSS can.
//
// These are about *appearance intent* -- is the field distinguishable from the
// note, is there real space between fields, do the hover controls stay off its
// neighbours. jsdom computes no styles, so these read the stylesheet and reason
// about the cascade directly. That is not a substitute for looking at it.
const fs = require("fs");
const { css: cssPath } = require("./paths.cjs");
const raw = fs.readFileSync(cssPath, "utf8");

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

// Comments carry the rationale for these rules, so they stay in the file -- but
// they would break the selector matching below, which anchors on a preceding "}"
// or the start of the file.
const css = raw.replace(/\/\*[\s\S]*?\*\//g, "");

// --- tiny CSS helpers -------------------------------------------------------
// Every rule in this stylesheet is flat (no @media), so the last declaration of
// a selector wins. Splitting on "}" is enough and avoids pulling in a parser.
function decls(selector) {
  const out = [];
  const re = new RegExp(
    "(^|[},])\\s*" + selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{([^}]*)\\}",
    "g",
  );
  let m;
  while ((m = re.exec(css))) out.push(m[2]);
  return out;
}
function rawProp(selector, name) {
  const merged = {};
  for (const body of decls(selector))
    for (const d of body.split(";")) {
      const i = d.indexOf(":");
      if (i > 0) merged[d.slice(0, i).trim().toLowerCase()] = d.slice(i + 1).trim();
    }
  return merged[name] ?? null;
}

// Custom properties are the whole point of the --sc-field-gap knob, so a value
// of "var(--sc-field-gap) 0" has to resolve before it can be reasoned about.
// Collected from EVERY rule up front, not lazily per selector: resolving the
// field's padding before the root has been read yields a bare token name, which
// parses as no number at all and reads as a 0px gap.
const tokens = {};
for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) tokens[m[1]] = m[2].trim();

function resolve(v) {
  let out = String(v ?? "");
  for (let i = 0; i < 6 && out.includes("var("); i++)
    out = out.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)/g, (_, name, fallback) => {
      if (tokens[name] !== undefined) return tokens[name];
      // Obsidian theme variables are not defined in this stylesheet. Leave them
      // as a name rather than throwing; they are never compared numerically.
      return fallback !== undefined ? fallback : name;
    });
  return out;
}
function prop(selector, name) {
  const raw = rawProp(selector, name);
  return raw === null ? null : resolve(raw);
}
function numeric(v) {
  const m = /(-?[\d.]+)\s*px/.exec(String(v || ""));
  return m ? parseFloat(m[1]) : null;
}
// CSS lengths may be unitless -- "margin:10px 0" has no px on the 0 -- so a
// regex that insists on "px" everywhere silently fails on valid CSS.
function lengths(v) {
  return String(v ?? "")
    .trim()
    .split(/\s+/)
    .map(parseFloat)
    .filter((n) => !isNaN(n));
}
// Expand the box-shorthands so [vertical, horizontal] can be compared.
// "10px 0" is top/bottom 10, left/right 0 -- NOT a 10/0 vertical pair.
function boxPairs(v) {
  const l = lengths(v);
  switch (l.length) {
    case 1:
      return [l[0], l[0]];
    case 2:
      return [l[0], l[0]];
    case 3:
      return [l[0], l[2]];
    case 4:
      return [l[0], l[2]];
    default:
      return [];
  }
}
function shadowAlphas(v) {
  return [...String(v || "").matchAll(/rgba?\([^)]*?[\d.]+\s*\)/g)]
    .map((m) => {
      const n = /,\s*([\d.]+)\s*\)/.exec(m[0]);
      return n ? parseFloat(n[1]) : 0;
    })
    .filter((a) => a > 0);
}

// --- 1. the field must not be the same colour as the note -------------------
head("the field is distinguishable from the note background");

{
  // Raw, not resolved: the point is that the rule names OUR token, so a theme
  // or a future edit can change the colour in exactly one place.
  const bg = String(rawProp(".structured-cards-root .sc-field-shell", "background") ?? "");
  const cardBg = String(rawProp(".structured-cards-root.sc-card", "background") ?? "");

  ok(
    "field shell does not use --background-primary",
    !/background-primary/.test(bg),
    "identical to the note background: " + bg,
  );
  ok("field shell uses the --sc-surface token", /sc-surface/.test(bg), bg);
  ok(
    "legacy card does not use --background-primary either",
    !/background-primary/.test(cardBg),
    cardBg,
  );
  ok("legacy card uses the --sc-surface token", /sc-surface/.test(cardBg), cardBg);

  // --sc-surface was declared on the root and then never referenced. That is how
  // this survived: the correct colour was already in the stylesheet.
  const rootDecl = decls(".structured-cards-root").join("");
  ok("--sc-surface is declared on the root", /--sc-surface\s*:/.test(rootDecl));
  const uses = [...css.matchAll(/var\(--sc-surface\)/g)].length;
  ok("--sc-surface is actually referenced", uses >= 2, uses + " use(s)");

  ok(
    "field keeps a border, for themes where the two backgrounds are close",
    !!prop(".structured-cards-root .sc-field-shell", "border"),
  );
  ok("card keeps a border", !!prop(".structured-cards-root.sc-card", "border"));
}

head("the shadow is strong enough to read on a dark background");
{
  // rgba(0,0,0,.05) over #1e1e1e is a ~5% change on an already-dark pixel. It
  // is not a shadow, it is noise.
  const rest = prop(".structured-cards-root .sc-field-shell", "box-shadow");
  const alphas = shadowAlphas(rest);

  ok("the field has a resting shadow", !!rest, String(rest));
  ok(
    "at least one resting shadow layer is >= 0.10 alpha",
    alphas.some((a) => a >= 0.1),
    alphas.join(", ") + " in " + rest,
  );

  const hoverBody =
    decls(".structured-cards-root .sc-field-shell:hover").join("") +
    decls(".structured-cards-root .sc-field-shell:focus-within").join("");
  const hoverMatch = /box-shadow\s*:\s*([^;}]+)/.exec(hoverBody);
  ok("hover changes the shadow", !!hoverMatch, hoverBody.slice(0, 80));
  const hoverAlphas = shadowAlphas(hoverMatch && hoverMatch[1]);
  ok(
    "the hovered shadow is deeper than the resting one",
    hoverAlphas.length > 0 && alphas.length > 0 && Math.max(...hoverAlphas) > Math.max(...alphas),
    `rest ${alphas.length ? Math.max(...alphas) : "n/a"} -> hover ${hoverAlphas.length ? Math.max(...hoverAlphas) : "n/a"}`,
  );

  const cardRest = prop(".structured-cards-root.sc-card", "box-shadow");
  ok(
    "the card's resting shadow is also readable",
    shadowAlphas(cardRest).some((a) => a >= 0.1),
    cardRest,
  );
}

// --- 2. real space between fields ------------------------------------------
head("fields are separated by a real gap");
{
  // Padding, not margin. Adjacent siblings' vertical margins collapse to the
  // larger value rather than summing, so a declared margin never buys more than
  // its own number and any wrapper changes what collapses with what. Padding
  // always adds up and always survives a wrapper.
  const pad = boxPairs(prop(".structured-cards-root.sc-standalone-field", "padding"));
  ok("the field declares vertical padding", pad.length === 2, String(prop(".structured-cards-root.sc-standalone-field", "padding")));
  if (pad.length === 2) {
    const gap = pad[0] + pad[1];
    ok("two adjacent fields are at least 16px apart", gap >= 16, gap + "px");
    ok("the padding is symmetric", pad[0] === pad[1], pad[0] + " vs " + pad[1]);
  }

  const marg = boxPairs(prop(".structured-cards-root.sc-standalone-field", "margin"));
  ok(
    "no vertical margin is left to collapse",
    marg.length !== 2 || marg[0] === 0,
    "a vertical margin can only shrink the guaranteed gap: " + marg.join("/"),
  );
}

head("the padding around a field does not swallow clicks");
{
  // The padding exists to house the drag handle and the menu. If the field
  // element itself captures pointer events, that padding becomes a dead strip
  // and the empty line below a field cannot be clicked -- the exact complaint
  // the padding was meant to help. So the field opts out and the shell opts
  // back in.
  const field = rawProp(".structured-cards-root.sc-standalone-field", "pointer-events");
  ok(
    "the field element itself does not capture pointer events",
    field === "none",
    "pointer-events:" + field + " -- the padding strip swallows clicks",
  );
  const shell = rawProp(".structured-cards-root.sc-standalone-field>.sc-field-shell", "pointer-events");
  ok(
    "the shell takes them back, so every control inside still works",
    shell === "auto",
    "pointer-events:" + shell,
  );

  const code = fs.readFileSync(require("path").join(require("./paths.cjs").P, "src", "main.js"), "utf8");
  ok(
    "the drag handle and the menu are inside the shell, not siblings of it",
    /cls:\s*"sc-field-shell"/.test(code) && /sc-field-drag sc-edit-control/.test(code),
    "if a control sits outside the shell it inherits pointer-events:none and becomes dead",
  );
  ok(
    "and the height handle is inside the shell too",
    /sc-height-handle sc-edit-control|sc-resize-handle sc-resize-/.test(code),
  );

  // One knob, so the spacing is a single number rather than a value repeated in
  // three rules that can drift apart.
  const root = decls(".structured-cards-root").join("");
  ok("--sc-field-gap is defined on the root", /--sc-field-gap\s*:/.test(root));
  const token = /--sc-field-gap\s*:\s*([\d.]+)px/.exec(root);
  ok("--sc-field-gap has a numeric value", !!token, String(token));
  if (token) {
    ok("--sc-field-gap is at least 8px", parseFloat(token[1]) >= 8, token[1] + "px");
    ok(
      "the field's padding uses the token rather than a literal",
      /padding:\s*var\(--sc-field-gap\)/.test(decls(".structured-cards-root.sc-standalone-field").join("")),
    );
  }

  ok(
    "the layout host wrapper adds no collapsing margin of its own",
    /display\s*:\s*contents/.test(
      decls(".structured-cards-root.structured-cards-code-host").join(""),
    ),
  );
}

head("hover controls stay inside the field and off the neighbouring field");
{
  // The handles are anchored to --sc-field-gap, so "inside the padding" is a
  // property of the CSS rather than a coincidence of two numbers agreeing.
  const root = decls(".structured-cards-root").join("");
  const gap = parseFloat((/--sc-field-gap\s*:\s*([\d.]+)px/.exec(root) || [, "0"])[1]);
  const shellPad = boxPairs(prop(".structured-cards-root .sc-field-shell", "padding"))[0];

  for (const [name, sel] of [
    ["drag", ".structured-cards-root .sc-field-header>.sc-field-drag"],
    ["menu", ".structured-cards-root .sc-field-header>.sc-field-more"],
  ]) {
    const topRaw = String(rawProp(sel, "top") ?? "");
    const h = numeric(prop(sel, "height"));
    ok(name + " handle has a height", h !== null, String(prop(sel, "height")));
    ok(
      name + " handle offset is anchored to --sc-field-gap",
      /calc\(\s*-1\s*\*\s*var\(--sc-field-gap\)\s*\)/.test(topRaw),
      "a literal offset drifts out of the padding the moment --sc-field-gap changes: " + topRaw,
    );
    if (h !== null && gap) {
      // top: calc(-1 * gap) -> the handle's top edge is `gap` px above the shell.
      const up = gap;
      const over = Math.max(0, up - gap);
      ok(
        name + " handle does not overhang into the previous field",
        over === 0,
        `reaches ${over}px past the field's own padding (${up}px up, padding ${gap}px)`,
      );
      // The part below the shell's top border edge is height - up, and the shell
      // has padding-top to absorb it. Anything more and it clips into the label.
      ok(
        name + " handle stops at the shell's content edge",
        h - up <= shellPad + 0.5,
        `handle is ${h - up}px into a shell with ${shellPad}px of top padding`,
      );
      ok(
        "the shell has enough top padding to house it",
        shellPad >= h - up,
        `padding-top ${shellPad}px vs ${h - up}px needed`,
      );
    }
  }

  const hhSel = ".structured-cards-root .sc-height-handle";
  const b = numeric(prop(hhSel, "bottom"));
  const hhH = numeric(prop(hhSel, "height"));
  ok("the height handle has a measurable bottom offset", b !== null, String(prop(hhSel, "bottom")));
  if (b !== null && hhH !== null) {
    const over = Math.max(0, -b);
    ok(
      "the height handle does not stick out below the field",
      over === 0,
      `overhangs ${over}px into the space below`,
    );
  }
}

console.log("\n================ LOOK ================");
console.log("pass:", pass, " fail:", fail);
for (const [n, d] of bad) console.log("  FAIL " + n + (d === undefined ? "" : "  [" + d + "]"));
process.exit(fail ? 1 : 0);