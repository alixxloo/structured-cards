"use strict";
// Review pass 3: adversarial cases for Ct() (the move engine), saveReadingBlock
// (reading mode) and buildDecorations (Live Preview), plus a fuzz pass over the
// parser/serialiser.
const fs = require("fs");
const T = require("./paths.cjs").T;
const src = fs.readFileSync(require("./paths.cjs").src, "utf8")
  + "\n;module.exports.__Q=Q;module.exports.__W=W;module.exports.__R=R;module.exports.__Ct=Ct;module.exports.__Pt=Pt;module.exports.__Pe=Pe;module.exports.__qt=qt;module.exports.__At=At;module.exports.__B=B;module.exports.__fg=fg;module.exports.__fug=fug;\n";
fs.writeFileSync(T + "rev3.cjs", src);
for (const k of Object.keys(require.cache)) if (k.endsWith("rev3.cjs")) delete require.cache[k];
const { __Q: Q, __W: W, __R: R, __Ct: Ct, __Pt: Pt, __Pe: Pe, __qt: qt, __At: At, __B: B, __fg: fg, __fug: fug } = require(T + "rev3.cjs");

let pass = 0, fail = 0; const bad = [];
const ok = (n, c, d) => { if (c) pass++; else { fail++; bad.push([n, d]); } };
const head = t => console.log("\n### " + t);
const J = (...l) => l.join("\n");
const F = (id, extra = "") => J("```structured-field", `id: ${id}`, "label: L" + id, "type: text", ...(extra ? [extra] : []), `value: ${id}`, "```");

head("Ct invariants hold for every ordered pair in a 5-field document");
{
  const ids = ["a", "b", "c", "d", "e"];
  const doc = ["head", "", ...ids.flatMap(id => [F(id), ""]), "tail"].join("\n");
  let checked = 0, problems = [];
  const dstIdx = id => ids.indexOf(id);
  for (const src of ids) for (const dst of ids) {
    if (src === dst) continue;
    for (const placement of ["before", "after"]) {
      const out = Ct(doc, src, dst, placement);
      checked++;
      const got = R(out).map(x => x.field.id);
      // Exactly the same multiset of fields, none lost or duplicated.
      const before = R(doc).map(x => x.field.id).sort().join();
      const after = got.slice().sort().join();
      if (before !== after) problems.push(`${src}->${dst} ${placement}: fields ${after} != ${before}`);
      if (got.length !== ids.length) problems.push(`${src}->${dst} ${placement}: count ${got.length}`);
      // Non-field content must survive.
      if (!out.includes("head") || !out.includes("tail")) problems.push(`${src}->${dst} ${placement}: prose lost`);
      // Ordering must actually change -- unless the move is already satisfied.
      const wasAt = R(doc).map(x => x.field.id).indexOf(src);
      const nowAt = got.indexOf(src);
      const alreadyThere = placement === "before" ? wasAt + 1 === dstIdx(dst) : wasAt === dstIdx(dst) + 1;
      if (!alreadyThere && nowAt === wasAt)
        problems.push(`${src}->${dst} ${placement}: order unchanged`);
      // No fence corruption.
      if ((out.match(/```structured-field/g) || []).length !== ids.length)
        problems.push(`${src}->${dst} ${placement}: fence count`);
      // No runaway blank lines.
      if (/\n{4,}/.test(out)) problems.push(`${src}->${dst} ${placement}: blank run`);
    }
  }
  ok(`${checked} ordered moves are all sound`, problems.length === 0, problems.slice(0, 6).join(" ; "));
}

head("Ct stays bounded when repeated (moving back and forth oscillates by design)");
{
  const doc = J("head", "", F("a", "row: r1"), "", F("b", "row: r1"), "", F("c"), "", "tail");
  let cur = doc;
  const sizes = [];
  for (let i = 0; i < 12; i++) { cur = Ct(cur, "a", "b", "after"); sizes.push(cur.length); }
  const spread = Math.max(...sizes) - Math.min(...sizes);
  ok("document size does not grow without bound", spread <= 4, "spread " + spread + " sizes " + [...new Set(sizes)]);
  ok("all three fields still present", R(cur).length === 3, R(cur).length);
  ok("prose intact", cur.includes("head") && cur.includes("tail"));
  ok("no blank-line pile-up", !/\n{3,}/.test(cur), JSON.stringify(cur.match(/\n{3,}/g)));
}

head("Ct on CRLF documents keeps CRLF and does not mix");
{
  const doc = J("head", "", F("a", "row: r1"), "", F("b", "row: r1"), "", "tail").replace(/\n/g, "\r\n");
  const out = Ct(doc, "a", "b", "after");
  const crlf = (out.match(/\r\n/g) || []).length;
  const bare = (out.match(/(?<!\r)\n/g) || []).length;
  ok("no bare LF introduced", bare === 0, crlf + " crlf / " + bare + " bare");
  ok("both fields survive", R(out).length === 2, R(out).length);
}

head("Ct refuses unsafe inputs without mutating the document");
{
  const doc = J(F("a"), "", F("b"));
  const before = doc;
  const cases = [
    ["unknown id", Ct(doc, "zzz", "b", "after")],
    ["same id", Ct(doc, "a", "a", "after")],
    ["unknown target", Ct(doc, "a", "zzz", "after")],
    ["negative position", Ct(doc, "a", void 0, "after", -5)],
    ["position beyond doc", Ct(doc, "a", void 0, "after", doc.length + 500)],
    ["position inside a block", Ct(doc, "a", void 0, "after", 10)],
  ];
  for (const [name, out] of cases) ok(name + " is a no-op", out === before, JSON.stringify(out && out.slice(0, 40)));
  const dup = J(F("a"), "", F("a"));
  ok("ambiguous id is a no-op", Ct(dup, "a", void 0, "after", 0) === dup);
}

head("qt blank-line cap");
{
  ok("capped at 3", qt(10000, 0, 20) === 3, qt(10000, 0, 20));
  ok("never negative", qt(0, 100, 20) === 0, qt(0, 100, 20));
  ok("small drops give 0", qt(105, 100, 20) === 0, qt(105, 100, 20));
  ok("one line down gives 1", qt(125, 100, 20) === 1, qt(125, 100, 20));
}

head("fg/fug round-trip");
{
  const cases = ["```", "```js", "  ```", "    ```", "a\\b", "a\\`b", "a\\\\b", "plain", "", "```\nmore", "x", "\\", "\\\\"];
  let bad2 = [];
  for (const c of cases) { const r = fug(fg(c)); if (r !== c) bad2.push(JSON.stringify(c) + "->" + JSON.stringify(r)); }
  ok("every case round-trips", bad2.length === 0, bad2.join(" , "));
  ok("fence lines are actually escaped", fg("```").includes("\\`"), fg("```"));
  ok("plain lines are untouched", fg("plain") === "plain");
  ok("lines with a backslash are escaped", fg("a\\b") !== "a\\b");
}

head("value containing a fence survives W -> CommonMark -> Q");
{
  const values = [
    "before\n```\nafter",
    "```js\nconst a = 1;\n```",
    "line\n\n  ```\nline",
    "a\\b\n```\nc",
  ];
  for (const v of values) {
    const written = W({ id: "z", label: "L", type: "text", value: v });
    // Emulate Obsidian handing the code block processor its body.
    const lines = written.split("\n");
    const body = [];
    for (let i = 1; i < lines.length; i++) { if (/^ {0,3}```/.test(lines[i])) break; body.push(lines[i]); }
    const back = Q("```structured-field\n" + body.join("\n") + "\n```");
    ok("survives: " + JSON.stringify(v).slice(0, 34), back && back.value === v,
       JSON.stringify(back && back.value));
  }
}

head("parser fuzz: random strings must never throw or corrupt");
{
  const alphabet = ["a", "|", "\\", "\n", ":", "=", "`", "#", "-", " ", "0", "n", "text", "item: ", "```"];
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  let threw = 0, nullOut = 0, parsed = 0, unstable = 0;
  for (let n = 0; n < 4000; n++) {
    let s = "";
    const len = 1 + Math.floor(rnd() * 14);
    for (let i = 0; i < len; i++) s += alphabet[Math.floor(rnd() * alphabet.length)];
    const doc = "```structured-field\n" + s + "\n```";
    let f;
    try { f = R(doc)[0]?.field; } catch (e) { threw++; if (threw < 4) console.log("    threw on " + JSON.stringify(s) + ": " + e.message); continue; }
    if (!f) { nullOut++; continue; }
    parsed++;
    // Whatever parsed must survive a re-serialise/re-parse cycle.
    try {
      const again = R(W(f))[0]?.field;
      if (!again) { unstable++; if (unstable < 4) console.log("    lost on rewrite: " + JSON.stringify(s)); continue; }
      const label = again.label, value = again.value, kind = again.items?.map(i => i.kind).join("|");
      if (label !== f.label || value !== f.value || kind !== (f.items?.map(i => i.kind).join("|"))) {
        unstable++;
        if (unstable < 5) console.log("    drift: " + JSON.stringify(s) + " label " + JSON.stringify(f.label) + "->" + JSON.stringify(again.label) + " value " + JSON.stringify(f.value) + "->" + JSON.stringify(again.value));
      }
    } catch (e) { unstable++; if (unstable < 4) console.log("    rewrite threw on " + JSON.stringify(s) + ": " + e.message); }
  }
  console.log(`  ${parsed} parsed, ${nullOut} unparseable, ${threw} threw, ${unstable} unstable`);
  ok("parser never throws", threw === 0, threw + " throws");
  ok("parsed fields always round-trip", unstable === 0, unstable + " unstable");
}

head("At() splitter (raw; B() does the unescaping)");
{
  ok("plain pipes split", JSON.stringify(At("a|b|c")) === '["a","b","c"]');
  ok("escaped pipe does not split", At("a\\|b|c").length === 2, JSON.stringify(At("a\\|b|c")));
  ok("and B() unescapes it", B(At("a\\|b|c")[0]) === "a|b", JSON.stringify(B(At("a\\|b|c")[0])));
  ok("empty segments", JSON.stringify(At("a||b")) === '["a","","b"]');
  ok("leading/trailing", JSON.stringify(At("|a|")) === '["","a",""]');
}

head("malformed input is handled without corrupting the block");
{
  const cases = [
    "item: ",
    "item: |",
    "  item: text|x",
    "item: bogus|x",
    "custom: ok",
    "  weird key: v",
    "```leaky: v",
    "custom: ```js",
    "type:",
    "label:",
    "width:",
  ];
  for (const c of cases) {
    const doc = "```structured-field\n" + c + "\n```";
    let f, threw = null;
    try { f = R(doc)[0]?.field; } catch (e) { threw = e.message; }
    ok("parses without throwing: " + JSON.stringify(c), !threw, threw);
    if (!f) { console.log("    " + JSON.stringify(c) + " -> not a field (fine)"); continue; }
    let written, again, t2 = null;
    try {
      written = W(f);
      again = R(written)[0]?.field;
    } catch (e) { t2 = e.message; }
    ok("rewrite does not throw: " + JSON.stringify(c), !t2, t2);
    ok("rewrite still yields a field: " + JSON.stringify(c), !!again, written);
    if (again) {
      // The rewritten block must be stable under a second cycle.
      const twice = R(W(again))[0]?.field;
      ok("stable after a second cycle: " + JSON.stringify(c),
         !!twice && twice.label === again.label && twice.value === again.value &&
         JSON.stringify(twice.items?.map(i => i.kind)) === JSON.stringify(again.items?.map(i => i.kind)),
         twice ? JSON.stringify({ l: twice.label, v: twice.value, i: twice.items?.map(i => i.kind) })
               : "second cycle lost the block");
      // No body line may close the block early (skip the block's own fences).
      const lines = written.split("\n");
      let closed = false;
      for (let i = 1; i < lines.length - 1; i++) { if (/^ {0,3}```/.test(lines[i])) { closed = true; break; } }
      ok("no self-closing fence: " + JSON.stringify(c), !closed, written);
    }
  }
}

console.log("\n================ REVIEW 3 ================");
console.log("pass:", pass, " fail:", fail);
for (const [n, d] of bad) console.log("  FAIL " + n + (d === undefined ? "" : "  [" + d + "]"));
process.exit(fail ? 1 : 0);
