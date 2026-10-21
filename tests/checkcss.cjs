"use strict";
// Validate the CSS: braces balance, no leftover dead classes, and every class
// main.js emits has a rule.
const fs = require("fs");
const { src, css: cssPath } = require("./paths.cjs");
const css = fs.readFileSync(cssPath, "utf8");
const js = fs.readFileSync(src, "utf8");

let depth = 0, bad = 0;
for (const c of css) { if (c === "{") depth++; else if (c === "}") { depth--; if (depth < 0) bad++; } }
console.log("brace balance:", depth === 0 && bad === 0 ? "OK" : `BROKEN (depth=${depth}, stray=${bad})`);

// crude at-rule sanity
const atRules = [...css.matchAll(/@([a-z-]+)/g)].map(m => m[1]);
console.log("at-rules used:", [...new Set(atRules)].join(", "));
console.log("empty rule bodies:", (css.match(/\{\s*\}/g) || []).length);

const declared = new Map();
for (const m of css.matchAll(/\.(sc-[A-Za-z0-9_-]+)/g)) declared.set(m[1], (declared.get(m[1]) || 0) + 1);
const dynamic = new Set(["sc-text-wrap", "sc-resize-handle", "sc-item",
  "sc-resize-left", "sc-resize-right", "sc-height-handle",
  ...["field","separator","heading","text"].map(k => "sc-item-" + k),
  ...["auto","1","2","3","4"].map(k => "sc-cols-" + k),
  ...["small","medium","large","custom"].map(k => "sc-size-" + k),
  ...["compact","comfortable"].map(k => "sc-density-" + k),
  "sc-field-label-wrap", "sc-item-title-wrap", "sc-item-standalone-title-wrap"]);

const dead = [...declared.entries()].filter(([c]) => !js.includes(c) && !dynamic.has(c));
console.log("\nCSS classes:", declared.size, " never emitted:", dead.length);
for (const [c, n] of dead.sort((a,b)=>b[1]-a[1])) console.log("  ." + c.padEnd(32) + n);

// classes the renderer now emits that still have no rule
const emitted = new Set();
for (const m of js.matchAll(/"(sc-[a-z0-9_-]+)"/g)) emitted.add(m[1]);
for (const m of js.matchAll(/sc-[a-z0-9_]*\$\{/g)) emitted.add(m[0].slice(0, -2));
const missing = [...emitted].filter(c => !declared.has(c)).sort();
console.log("\nemitted by main.js with NO css rule:", missing.length);
for (const c of missing) console.log("  ." + c);

// host classes used by the plugin
for (const h of ["structured-cards-root", "structured-cards-code-host", "structured-cards-field-processor"])
  console.log("host ." + h + " in css=" + css.includes("." + h) + " in js=" + js.includes(h));