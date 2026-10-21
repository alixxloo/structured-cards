"use strict";
// Runs against the LIVE project main.js. Usage: node t.cjs <group>
const T = require("./load.cjs").__test;
const { Q, W, R, ft, mt, V, ke, Nt, Ct, _t, He, Ie, st } = T;
let pass = 0, fail = 0; const bad = [];
const ok = (n, c, d) => { if (c) pass++; else { fail++; bad.push([n, d]); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const J = (...l) => l.join("\n");
const group = process.argv[2] || "all";
const head = t => console.log("\n### " + t);

if (group === "1" || group === "all") {
  head("1  V(): 'Move item down' must actually move");
  const mk = () => ({ sections: [{ title: "S", items: [{ id: "A" }, { id: "B" }, { id: "C" }, { id: "D" }] }] });
  let c = mk(); V(c, 0, 0, 0, 1); ok("move 0 -> 1", eq(c.sections[0].items.map(x => x.id), ["B", "A", "C", "D"]), c.sections[0].items.map(x => x.id));
  c = mk(); V(c, 0, 1, 0, 2);         ok("move 1 -> 2", eq(c.sections[0].items.map(x => x.id), ["A", "C", "B", "D"]), c.sections[0].items.map(x => x.id));
  c = mk(); V(c, 0, 2, 0, 3);         ok("move 2 -> 3", eq(c.sections[0].items.map(x => x.id), ["A", "B", "D", "C"]), c.sections[0].items.map(x => x.id));
  c = mk(); V(c, 0, 1, 0, 0);         ok("move 1 -> 0 (up)", eq(c.sections[0].items.map(x => x.id), ["B", "A", "C", "D"]), c.sections[0].items.map(x => x.id));
  c = mk(); V(c, 0, 3, 0, 0);         ok("move 3 -> 0", eq(c.sections[0].items.map(x => x.id), ["D", "A", "B", "C"]), c.sections[0].items.map(x => x.id));
  c = mk(); V(c, 0, 0, 0, 99);        ok("o past the end clamps", eq(c.sections[0].items.map(x => x.id), ["B", "C", "D", "A"]), c.sections[0].items.map(x => x.id));
  c = mk(); V(c, 0, 0, 0, -1);        ok("negative o ignored", eq(c.sections[0].items.map(x => x.id), ["A", "B", "C", "D"]), c.sections[0].items.map(x => x.id));
  c = { sections: [{ items: [{ id: "A" }] }, { items: [{ id: "B" }] }] }; V(c, 0, 0, 1, c.sections[1].items.length);
  ok("cross-section", eq([c.sections[0].items.length, c.sections[1].items.map(x => x.id)], [0, ["B", "A"]]), c.sections[1].items.map(x => x.id));
  c = mk(); V(c, 0, 9, 0, 0);         ok("missing source item ignored", eq(c.sections[0].items.map(x => x.id), ["A", "B", "C", "D"]));
  c = mk(); V(c, 0, 0, 7, 0);         ok("missing target section ignored", eq(c.sections[0].items.map(x => x.id), ["A", "B", "C", "D"]));
}

if (group === "2" || group === "all") {
  head("2  ke(): width never collapses to 0");
  for (const [n, a, b, d, e] of [
    ["right +5000", { width: 300, offset: 0 }, 5000, "right", 1000],
    ["right -5000", { width: 300, offset: 0 }, -5000, "right", 1000],
    ["left +5000", { width: 300, offset: 0 }, 5000, "left", 1000],
    ["left -5000", { width: 300, offset: 0 }, -5000, "left", 1000],
    ["no room left", { width: 300, offset: 1000 }, -400, "right", 1000],
    ["zero container", { width: 0, offset: 0 }, -900, "right", 0],
  ]) { const r = ke(a, b, d, e); ok("ke " + n + " > 0", r.width > 0, JSON.stringify(r)); console.log("    " + n + " -> " + JSON.stringify(r)); }
  const r = ke({ width: 300, offset: 0 }, 40, "right", 1000);
  ok("ke still tracks the drag", r.width === 340, JSON.stringify(r));
  ok("offset stays >= 0", ke({ width: 300, offset: 0 }, -5000, "left", 1000).offset >= 0);
}

if (group === "3" || group === "all") {
  head("3  fence guard: a ``` inside a value no longer closes the block");
  const fence = "before\n```js\nx\n```\nafter";
  const src = W({ id: "m", label: "L", type: "text", value: fence });
  console.log(src);
  const lines = src.split("\n");
  const body = [];
  for (let i = 1; i < lines.length; i++) { if (/^ {0,3}```/.test(lines[i])) break; body.push(lines[i]); }
  const reparsed = Q("```structured-field\n" + body.join("\n") + "\n```");
  console.log("  processor receives: " + JSON.stringify(body.join("\n")));
  ok("value survives the fence", reparsed && reparsed.value === fence, JSON.stringify(reparsed && reparsed.value));
  // label too
  const lf = Q(W({ id: "m", label: "a\n```\nb", type: "text", value: "v" }));
  ok("label survives the fence", lf.label === "a\n```\nb", JSON.stringify(lf.label));
  // no false positives
  ok("plain value untouched", Q(W({ id: "m", label: "L", type: "text", value: "a\nb" })).value === "a\nb");
  ok("inline backticks untouched", Q(W({ id: "m", label: "L", type: "text", value: "use `code` here" })).value === "use `code` here");
  ok("trailing ``` line guarded", Q(W({ id: "m", label: "L", type: "text", value: "x\n```" })).value === "x\n```");
}

if (group === "4" || group === "all") {
  head("4  legacy card: mt()/ft() fidelity still intact");
  const card = { title: "My card", layout: "2", size: "large", density: "compact", gap: 12, fullWidth: true,
    customWidth: "800px", breakpoint: 900, metadata: { owner: "ali" },
    sections: [{ title: "A", gap: 6, fullWidth: true, items: [
      { kind: "heading", value: "Head" }, { kind: "text", value: "plain" }, { kind: "separator", value: "" },
      { kind: "field", id: "f1", label: "Name", type: "text", value: "v1", span: 2, direction: "rtl",
        copyable: false, masked: false, required: true, placeholder: "ph", cssClass: "big red",
        minWidth: "120px", prefix: "pre", suffix: "suf", help: "h", validation: "^a+$", metadata: { z: "1" } }] },
      { title: "B", items: [{ kind: "field", id: "f2", label: "A: b | c", type: "text", value: "v2" }] }] };
  const back = ft(mt(card));
  for (const k of ["title","layout","size","density","gap","fullWidth","customWidth","breakpoint"])
    ok("card." + k, back[k] === card[k], `${card[k]} -> ${back[k]}`);
  const f = back.sections[0].items[3];
  ok("span", f.span === 2); ok("direction", f.direction === "rtl");
  // `copy` stays in the reserved-key set so an old note's `copy: false` line is
  // parsed and dropped rather than becoming custom metadata that would be written
  // back forever. The property itself is gone with the button.
  ok("copyable no longer exists on a field", !("copyable" in f), Object.keys(f).join());
  ok("the serialiser never emits copy=", !/copy=/.test(mt(card)), mt(card).slice(0, 120));
  ok("required", f.required === true); ok("placeholder", f.placeholder === "ph");
  ok("cssClass", f.cssClass === "big red"); ok("minWidth", f.minWidth === "120px");
  ok("prefix", f.prefix === "pre"); ok("suffix", f.suffix === "suf");
  ok("help", f.help === "h"); ok("validation", f.validation === "^a+$");
  ok("metadata", f.metadata && f.metadata.z === "1", JSON.stringify(f.metadata));
  ok("label with colon+pipe", back.sections[1].items[0].label === "A: b | c");
  ok("items 0..2", back.sections[0].items.slice(0,3).map(i => i.kind).join() === "heading,text,separator");
  head("4b mt() must not write the literal string 'undefined'");
  const bare = mt({ sections: [{ title: "S", items: [] }] });
  console.log(bare);
  const pb = ft(bare);
  ok("title is a real string", pb.title === "Structured card", JSON.stringify(pb.title));
  ok("size is valid", ["small","medium","large","custom"].includes(pb.size), JSON.stringify(pb.size));
  ok("layout is valid", ["auto","1","2","3","4"].includes(pb.layout), JSON.stringify(pb.layout));
  ok("density is valid", ["compact","comfortable"].includes(pb.density), JSON.stringify(pb.density));
  ok("no 'undefined' in output", !bare.includes("undefined"), bare);
}

if (group === "5" || group === "all") {
  head("5  parser/serializer round-trips (regression guard)");
  ok("label leading space", Q(W({ id: "a", label: " hello", type: "text", value: "v" })).label === " hello");
  ok("label pipe+colon", Q(W({ id: "a", label: "Owner: me | x", type: "text", value: "v" })).label === "Owner: me | x");
  ok("label multiline", Q(W({ id: "a", label: "a\nb", type: "text", value: "v" })).label === "a\nb");
  ok("value multiline", Q(W({ id: "a", label: "L", type: "text", value: "l1\nl2\nl3" })).value === "l1\nl2\nl3");
  ok("value empty line", Q(W({ id: "a", label: "L", type: "text", value: "a\n\nb" })).value === "a\n\nb");
  const it = { id: "a", label: "C", type: "text", items: [
    { id: "1", kind: "title", value: "", title: "Email" }, { id: "2", kind: "text", value: "m@e.com" }] };
  const rb = Q(W(it));
  ok("items survive", rb.items && rb.items.length === 2, JSON.stringify(rb.items));
  ok("no metadata leak", rb.metadata === undefined, JSON.stringify(rb.metadata));
  ok("checkbox round-trip", (() => { const f = { id: "a", label: "T", type: "text", items: [
    { id: "1", kind: "checkbox", value: "", title: "Done", checked: true }] }; st(f, f.items);
    const b = Q(W(f)); return b.items[0].kind === "checkbox" && b.items[0].title === "Done" && b.items[0].checked === true; })());
  for (const [w, want] of [["50",50],["50%",50],["50px","50px"],["100%",undefined],["100",undefined],["5",20],["500",100],["abc",undefined],["",undefined]])
    ok("width " + JSON.stringify(w), Q(J("```structured-field","id: w","label: L","type: text","width: "+w,"value: v","```")).width === want,
       JSON.stringify(Q(J("```structured-field","id: w","label: L","type: text","width: "+w,"value: v","```")).width));
  ok("unknown type rejected", Q(J("```structured-field","id: w","label: L","type: bogus","value: v","```")) === null);
  head("5b secret masking defaults");
  ok("type: secret masks by default", Q(J("```structured-field","id: s","label: L","type: secret","value: v","```")).masked === true);
  ok("type: text does not mask", Q(J("```structured-field","id: s","label: L","type: text","value: v","```")).masked === false);
  ok("a secret ITEM masks even on a text field",
     Q(J("```structured-field","id: s","label: L","type: text","item: secret|h","```")).masked === true);
  ok("explicit masked: false is honoured for an item",
     Q(J("```structured-field","id: s","label: L","type: text","masked: false","item: secret|h","```")).masked === false);
  const secF = { id: "s", label: "L", type: "text", masked: false, items: [{ id: "1", kind: "secret", value: "h" }] };
  ok("masked: false survives a re-save for an item", W(secF).includes("masked: false"), W(secF));
  ok("and re-parses as unmasked", Q(W(secF)).masked === false);
  const secT = { id: "s", label: "L", type: "text", masked: true, items: [{ id: "1", kind: "secret", value: "h" }] };
  ok("masked: true is not written out (it is the default)", !W(secT).includes("masked:"), W(secT));
  ok("and re-parses as masked", Q(W(secT)).masked === true);
}

if (group === "6" || group === "all") {
  head("6  Ct(): row-aware moves still correct");
  const rowDoc = J("intro","","```structured-field","id: a","row: row-1","label: A","type: text","value: 1","```","",
    "```structured-field","id: b","row: row-1","label: B","type: text","value: 2","```","","outro");
  const m1 = Ct(rowDoc, "a", "b", "after");
  ok("after: order flipped", eq(R(m1).map(x => x.field.id), ["b","a"]));
  ok("after: moved field JOINS the row", R(m1)[0].field.row && R(m1)[0].field.row === R(m1)[1].field.row,
     R(m1).map(x => x.field.row).join(","));
  ok("after: no stray blank line at the seam", !/\n{3}/.test(m1), JSON.stringify(m1));
  ok("after: surroundings intact", m1.startsWith("intro") && m1.endsWith("outro"));
  // repeated moves must not accumulate blank lines
  let acc = rowDoc;
  for (let i = 0; i < 6; i++) acc = Ct(acc, "a", "b", "after");
  ok("after x6: still no blank-line pile-up", !/\n{3}/.test(acc), JSON.stringify(acc));
  ok("after x6: still a row pair", R(acc)[0].field.row && R(acc)[0].field.row === R(acc)[1].field.row);
  const m2 = Ct(rowDoc, "a", "b", "before");
  ok("before: order unchanged", eq(R(m2).map(x => x.field.id), ["a","b"]));
  ok("before: still a row pair", R(m2)[0].field.row && R(m2)[0].field.row === R(m2)[1].field.row);
  // moving OUT of a row must break the row
  const out = J("intro","","```structured-field","id: a","row: r1","label: A","type: text","value: 1","```","",
    "```structured-field","id: b","row: r1","label: B","type: text","value: 2","```","","mid","","tail");
  const mOut = Ct(out, "a", undefined, "after", out.indexOf("tail"));
  ok("moving out of a row drops the row id", R(mOut).find(x => x.field.id === "a").field.row === undefined,
     JSON.stringify(R(mOut).map(x => [x.field.id, x.field.row])));
  ok("moving out keeps the other row member's row", R(mOut).find(x => x.field.id === "b").field.row === "r1");
  const two = J("```structured-field","id: a","label: A","type: text","value: 1","```","",
    "```structured-field","id: b","label: B","type: text","value: 2","```");
  const m3 = Ct(two, "a", "b", "beside", undefined, undefined, { side: "right" });
  const f3 = R(m3);
  ok("beside: shares a row", f3[0].field.row && f3[0].field.row === f3[1].field.row);
  ok("beside: adjacent", !/\n\n/.test(m3), JSON.stringify(m3));
  ok("unknown id is a no-op", Ct(two, "zzz", undefined, "after", 0) === two);
  ok("same id is a no-op", Ct(two, "a", "a", "after") === two);
  const dup = J("```structured-field","id: a","label: A","type: text","value: 1","```","",
    "```structured-field","id: a","label: B","type: text","value: 2","```");
  ok("ambiguous id is a no-op", Ct(dup, "a", undefined, "after", 0) === dup);
  ok("CRLF doc: move keeps CRLF", Ct(rowDoc.replace(/\n/g,"\r\n"), "a", "b", "after").includes("\r\n"));
}

if (group === "7" || group === "all") {
  head("7  duplicate (_t) and template insert (He) ids/rows");
  const b1 = J("```structured-field","id: r1","row: row-abc","label: A","type: text","value: 1","```");
  const d = Q(_t(b1));
  ok("dup: new field id", d.id !== "r1");
  ok("dup: NEW row id", d.row && d.row !== "row-abc", d.row);
  const n = Q(_t(J("```structured-field","id: r1","label: A","type: text","value: 1","```")));
  ok("dup: no row stays no row", n.row === undefined);
  const src = J("```structured-field","id: r1","row: row-abc","label: A","type: text","value: 1","```","",
    "```structured-field","id: r2","row: row-abc","label: B","type: text","value: 2","```");
  const h = R(He(src));
  ok("He: rows regenerated", h.every(x => x.field.row !== "row-abc"));
  ok("He: rows still paired", h[0].field.row === h[1].field.row);
  const h2 = R(He(src));
  ok("He: two inserts give disjoint ids", h.every((x, i) => x.field.id !== h2[i].field.id));
}

if (group === "8" || group === "all") {
  head("8  Nt() shape key tracks the rendered DOM, not the storage");
  // items:undefined + no value and items:[] both render zero rows -> same key is correct
  ok("undefined/empty and [] agree (both render nothing)", Nt({ items: undefined, value: "" }) === Nt({ items: [], value: "" }));
  // items:undefined + value renders one synthetic text row -> must equal a real [text]
  ok("undefined+value matches a real [text]", Nt({ items: undefined, value: "x" }) === Nt({ items: [{ kind: "text" }], value: "x" }));
  ok("different kinds differ", Nt({ items: [{ kind: "text" }, { kind: "checkbox" }] }) !== Nt({ items: [{ kind: "checkbox" }, { kind: "text" }] }));
  ok("hideLabel is part of the key", Nt({ items: [], hideLabel: true }) !== Nt({ items: [], hideLabel: false }));
}

console.log("\n--------------------------------------------");
console.log(`group=${group}  pass=${pass}  fail=${fail}`);
for (const [n, d] of bad) console.log("  FAIL " + n + (d === undefined ? "" : "   [" + d + "]"));
process.exit(fail ? 1 : 0);