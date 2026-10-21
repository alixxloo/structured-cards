"use strict";
// Parity harness: run identical probes against the minified original and the
// current source, then diff the results. One-off tool from the review, not part
// of `npm test`.
//
// Usage: node parity.cjs <path-to-original-min.js>   (twice: original, then src)
//
// The original 0.8.0 build is deliberately not committed, so this exits with a
// note rather than a stack trace when it is not supplied.
const fs = require("fs");
const { src: srcPath } = require("./paths.cjs");

const target = process.argv[2];
if (!target || !fs.existsSync(target)) {
  console.log(
    "parity.cjs needs a file to probe.\n" +
      "  node parity.cjs <original 0.8.0 main.js>\n" +
      "  node parity.cjs " + srcPath + "\n" +
      "then diff the two outputs.",
  );
  process.exit(0);
}

// Copied into tests/.tmp first so its own `require("obsidian")` resolves against
// the stubs written there by stubs.cjs, wherever the target happens to live.
// Neither build exposes its internals, so the same export shim load.cjs uses is
// appended -- the original and src/main.js share these binding names, which is
// what makes the diff meaningful.
const { T: scratch } = require("./paths.cjs");
const path = require("path");
const shim =
  "\n;module.exports.__test={Q,W,R,ft,mt,Pt,At,z,B,$t,pt,oe,se,He,_t,Ie,Nt,st,Pe,Ct,qt,ke,le,Vt,Ot,Z,St,V,gt,wt,nt,de,ne,ae,Oe,Ae,$e};\n";
const probe = path.join(scratch, "probe.cjs");
fs.writeFileSync(probe, fs.readFileSync(target, "utf8") + shim);
delete require.cache[require.resolve(probe)];
const T = require(probe).__test;
const { Q, W, R, ft, mt, V, ke, Nt, Ct, _t, He, Ie } = T;
const o = [];
const p = (...a) => o.push(a.map(x => typeof x === "string" ? x : JSON.stringify(x)).join(" "));

// 1 V() move-down
for (const i of [0, 1]) { const c = { sections: [{ items: [{ id: "A" }, { id: "B" }, { id: "C" }] }] }; V(c, 0, i, 0, i + 1); p("moveDown", i, c.sections[0].items.map(x => x.id)); }
{ const c = { sections: [{ items: [{ id: "A" }, { id: "B" }, { id: "C" }] }] }; V(c, 0, 0, 0, 2); p("moveTo2", c.sections[0].items.map(x => x.id)); }
{ const c = { sections: [{ items: [{ id: "A" }, { id: "B" }, { id: "C" }] }] }; V(c, 0, 2, 0, 1); p("dragContoB", c.sections[0].items.map(x => x.id)); }
{ const c = { sections: [{ items: [{ id: "A" }] }, { items: [{ id: "B" }] }] }; V(c, 0, 0, 1, c.sections[1].items.length); p("cross", c.sections[0].items.map(x => x.id), c.sections[1].items.map(x => x.id)); }

// 2 ke()
p("ke", ke({ width: 300, offset: 0 }, 5000, "right", 1000));
p("ke", ke({ width: 300, offset: 0 }, -5000, "right", 1000));
p("ke", ke({ width: 300, offset: 0 }, 5000, "left", 1000));
p("ke", ke({ width: 300, offset: 0 }, -5000, "left", 1000));
p("ke", ke({ width: 300, offset: 1000 }, -400, "right", 1000));

// 3 parser round trips
const f1 = { id: "a", label: " hello", type: "text", value: "v" };
p("labelWS", Q(W(f1)).label);
p("labelPipe", Q(W({ id: "a", label: "Owner: me | x", type: "text", value: "v" })).label);
p("multi", Q(W({ id: "a", label: "L", type: "text", value: "l1\nl2\nl3" })).value);
p("injected", Q(W({ id: "a", label: "L", type: "text", value: "intro\nitem: text|INJ" })).items);
p("fence", Q(W({ id: "a", label: "L", type: "text", value: "before\n```\nafter" })).value);
const items = { id: "a", label: "C", type: "text", items: [{ id: "1", kind: "title", value: "", title: "Email" }, { id: "2", kind: "text", value: "m@e.com" }] };
p("items", W(items)); p("itemsBack", Q(W(items)).items, Q(W(items)).value);
for (const w of ["50", "50%", "50px", "100%", "100", "5", "500", "abc", "", "0", "-10"])
  p("width", w, Q(["```structured-field", "id: w", "label: L", "type: text", "width: " + w, "value: v", "```"].join("\n")).width);

// 4 _t / He
p("dupRow", Q(_t(["```structured-field", "id: r1", "row: row-abc", "label: A", "type: text", "value: 1", "```"].join("\n"))).row);
p("heRows", R(He(["```structured-field", "id: r1", "row: row-abc", "label: A", "type: text", "value: 1", "```", "", "```structured-field", "id: r2", "row: row-abc", "label: B", "type: text", "value: 2", "```"].join("\n"))).map(x => x.field.row === "row-abc"));

// 5 legacy card
const card = { title: "My card", layout: "2", size: "large", density: "compact", gap: 12, fullWidth: true,
  customWidth: "800px", breakpoint: 900, metadata: { owner: "ali" },
  sections: [{ title: "A", gap: 6, fullWidth: true, items: [ { kind: "heading", value: "Head" }, { kind: "text", value: "plain" },
    { kind: "separator", value: "" }, { kind: "field", id: "f1", label: "Name", type: "text", value: "v1", span: 2,
      direction: "rtl", copyable: false, masked: false, required: true, placeholder: "ph", cssClass: "big red",
      minWidth: "120px", prefix: "pre", suffix: "suf", help: "h", validation: "^a+$", metadata: { z: "1" } } ] },
    { title: "B", items: [{ kind: "field", id: "f2", label: "A: b | c", type: "text", value: "v2" }] }] };
const src = mt(card); const back = ft(src);
p("mt", src);
for (const k of ["title","layout","size","density","gap","fullWidth","customWidth","breakpoint"]) p("card", k, back[k], card[k]);
const f1b = back.sections[0].items[3];
p("f1", f1b.span, f1b.direction, f1b.copyable, f1b.required, f1b.placeholder, f1b.cssClass, f1b.minWidth, f1b.prefix, f1b.suffix, f1b.help, f1b.validation, f1b.metadata);
p("lbl", back.sections[1].items[0].label);
p("items2", back.sections[0].items.slice(0,3).map(i => i.kind + ":" + i.value));

// 6 Ie
p("Ie", Ie({ layout: "2", sections: [{ title: "S", items: [{ kind: "heading", value: "H" }, { kind: "text", value: "prose" }, { kind: "separator", value: "" }, { kind: "field", id: "f1", label: "N", type: "text", value: "v" }] }] }));

// 7 Nt
for (const c of [{ items: undefined, value: "" }, { items: [], value: "" }, { items: undefined, value: "x" }, { items: [{ kind: "text" }], value: "x" }]) p("Nt", c, Nt(c));

// 8 Ct moves
const rowDoc = ["intro", "", "```structured-field", "id: a", "row: row-1", "label: A", "type: text", "value: 1", "```", "",
  "```structured-field", "id: b", "row: row-1", "label: B", "type: text", "value: 2", "```", "", "outro"].join("\n");
p("CtAfter", Ct(rowDoc, "a", "b", "after"));
const two = ["```structured-field", "id: a", "label: A", "type: text", "value: 1", "```", "", "```structured-field", "id: b", "label: B", "type: text", "value: 2", "```"].join("\n");
p("CtBeside", Ct(two, "a", "b", "beside", undefined, undefined, { side: "right" }));

console.log(o.join("\n"));