"use strict";
// The seams between blocks after a move.
//
// Ct() removes the dragged block together with ONE blank separator and then
// re-inserts it adjacent to the target. It never puts a separator back, so the
// blank line that used to sit at the insertion seam disappears and the document
// ends up with a block jammed against its neighbour plus a stray blank line
// somewhere else. The user sees the drop line promise a clean slot and the field
// arrive somewhere that is not one.
//
// It also invents keys. The serialiser writes `value:` for a field whose note
// never had one, so every move quietly edits the block's YAML.
//
// Both are engine-level, so they are asserted here against Ct() directly rather
// than through a pointer.
const fs = require("fs");
const { src, T } = require("./paths.cjs");
const { JSDOM } = require("jsdom");

const js = fs.readFileSync(src, "utf8");

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

const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(global, "navigator", { value: dom.window.navigator, configurable: true, writable: true });
for (const k of ["HTMLElement", "Element", "Node", "Event", "CustomEvent", "DOMParser", "NodeFilter"])
  global[k] = dom.window[k];
global.AbortController = dom.window.AbortController;
global.AbortSignal = dom.window.AbortSignal;

fs.writeFileSync(T + "seams.cjs", js + "\n;module.exports.__Ct=Ct;module.exports.__R=R;\n");
for (const k of Object.keys(require.cache)) if (k.endsWith("seams.cjs")) delete require.cache[k];
const { __Ct: Ct, __R: R } = require(T + "seams.cjs");

const NOTE =
  "```structured-field\nid: a\nlabel: Alpha\ntype: text\nwidth: 100%\n```\n\n" +
  "```structured-field\nid: b\nlabel: Beta\ntype: text\nwidth: 100%\n```\n\n" +
  "```structured-field\nid: c\nlabel: Gamma\ntype: text\nwidth: 100%\n```\n";

const ids = (t) => R(t).map((c) => c.field.id).join(",");

/** How many blank lines sit between every consecutive pair of blocks. */
function seams(text) {
  const b = R(text);
  const out = [];
  for (let i = 0; i + 1 < b.length; i++) {
    const between = text.slice(b[i].to, b[i + 1].from);
    // Count the newlines that are not part of a fence line.
    out.push(between);
  }
  return out;
}
const blankLines = (chunk) => {
  const lines = chunk.split("\n");
  // The first element is the tail of the closing fence's line; the last is the
  // head of the next opening fence's line. Blank lines are what remains.
  return Math.max(0, lines.length - 2);
};

head("every seam keeps exactly one blank line");
{
  const moves = [
    ["a", "b", "after", "b,a,c"],
    ["a", "c", "after", "b,c,a"],
    ["b", "c", "after", "a,c,b"],
    ["c", "a", "before", "c,a,b"],
    ["c", "b", "before", "a,c,b"],
    ["b", "a", "before", "b,a,c"],
  ];
  for (const [from, to, placement, wantOrder] of moves) {
    const out = Ct(NOTE, from, to, placement);
    const label = from + " " + placement + " " + to;
    ok(label + ": the order asked for", ids(out) === wantOrder, ids(out) + " wanted " + wantOrder);
    const counts = seams(out).map(blankLines);
    ok(
      label + ": every seam has one blank line",
      counts.every((n) => n === 1),
      JSON.stringify(counts) + "  " + JSON.stringify(out.slice(out.indexOf("id: b"))),
    );
  }
}

head("the document ends the way it started");
{
  for (const [from, to, placement] of [["a", "c", "after"], ["c", "a", "before"], ["b", "c", "after"]]) {
    const out = Ct(NOTE, from, to, placement);
    const label = from + " " + placement + " " + to;
    ok(label + ": no leading blank", !/^\n/.test(out), JSON.stringify(out.slice(0, 8)));
    ok(
      label + ": no trailing blank line was invented",
      !/\n\n$/.test(out) && /\n$/.test(out),
      JSON.stringify(out.slice(-8)),
    );
  }
}

head("a move invents no keys");
{
  const before = R(NOTE).map((b) => Object.keys(b.field).sort().join("|"));
  for (const [from, to, placement] of [["a", "c", "after"], ["c", "a", "before"], ["b", "a", "before"]]) {
    const out = Ct(NOTE, from, to, placement);
    const label = from + " " + placement + " " + to;
    const after = R(out).map((b) => Object.keys(b.field).sort().join("|"));
    ok(
      label + ": the same set of keys on every block",
      after.every((k) => before.includes(k)),
      "before " + JSON.stringify(before) + " after " + JSON.stringify(after),
    );
    ok(label + ": no value: line appears", !/\nvalue:/.test(out), JSON.stringify(out));
  }
}

head("a move to a raw text position never duplicates or loses a block");
{
  // Live Preview drops on ordinary text through moveFieldToPosition, which calls
  // Ct with a position and no target. That path was never asserted, and it is a
  // different branch of Ct entirely. The invariant is simple and absolute: the
  // block count cannot change, and no id can appear twice.
  const WITH_TEXT =
    "# Title\n\nIntro.\n\n" +
    "```structured-field\nid: a\nlabel: Alpha\ntype: text\nwidth: 100%\n```\n\n" +
    "```structured-field\nid: b\nlabel: Beta\ntype: text\nwidth: 100%\n```\n\n" +
    "```structured-field\nid: c\nlabel: Gamma\ntype: text\nwidth: 100%\n```\n\nOutro.\n";
  const start = R(WITH_TEXT).length;
  const dupes = [],
    lost = [];
  let noop = 0,
    moved = 0;
  for (const from of ["a", "b", "c"]) {
    for (let pos = 0; pos <= WITH_TEXT.length; pos += 3) {
      for (const opts of [{}, { blankLines: 2 }, { blankLines: 0 }]) {
        const out = Ct(WITH_TEXT, from, undefined, "after", pos, undefined, opts);
        const got = R(out).map((x) => x.field.id);
        if (got.length !== start) {
          dupes.push(from + " pos=" + pos + " " + JSON.stringify(opts) + " -> " + got.length + " blocks: " + got.join(","));
          continue;
        }
        if (new Set(got).size !== got.length) {
          dupes.push(from + " pos=" + pos + " -> repeated id: " + got.join(","));
          continue;
        }
        if (got.join(",") === ["a", "b", "c"].join(",")) noop++;
        else {
          moved++;
          // Every non-no-op must still be a permutation of the original blocks.
          if (["a", "b", "c"].every((x) => got.includes(x)) === false)
            lost.push(from + " pos=" + pos + " -> " + got.join(","));
        }
      }
    }
  }
  ok("no position duplicates or drops a block", dupes.length === 0, dupes.slice(0, 4).join("; "));
  ok("every result still holds the same three blocks", lost.length === 0, lost.slice(0, 4).join("; "));
  ok("the sweep actually moved something", moved > 50, moved + " moving positions, " + noop + " no-ops");
}

head("a move leaves the text after the last field exactly as it was");
{
  // The normaliser rebuilt the tail by collapsing its leading newlines whenever
  // the tail held any content. A note that ends with a blank line before a
  // paragraph therefore lost that blank line on every move, silently.
  const WITH_TAIL =
    "```structured-field\nid: a\nlabel: Alpha\ntype: text\nwidth: 100%\n```\n\n" +
    "```structured-field\nid: b\nlabel: Beta\ntype: text\nwidth: 100%\n```\n\n" +
    "Outro paragraph.\n";
  const tailOf = (t) => {
    const b = R(t);
    return t.slice(b[b.length - 1].to);
  };
  ok(
    "the note under test really does have a blank line before the trailing text",
    tailOf(WITH_TAIL) === "\n\nOutro paragraph.\n",
    JSON.stringify(tailOf(WITH_TAIL)),
  );
  for (const [from, to, placement] of [["a", "b", "after"], ["b", "a", "before"]]) {
    const out = Ct(WITH_TAIL, from, to, placement);
    ok(
      from + " " + placement + " " + to + ": the trailing text is untouched",
      tailOf(out) === "\n\nOutro paragraph.\n",
      "was \\n\\nOutro, became " + JSON.stringify(tailOf(out)),
    );
    ok(
      from + " " + placement + " " + to + ": the trailing text itself is intact",
      out.includes("Outro paragraph."),
      "the paragraph went missing",
    );
  }
}

head("a beside move does not strip the TARGET's own value line");
{
  // k holds TWO blocks on the beside path -- the target first, then the moved
  // one -- but the phantom-value strip is written as if it held only the moved
  // one. It is therefore aimed at the target.
  const BESIDE =
    "```structured-field\nid: a\nlabel: A\ntype: text\nwidth: 100%\n```\n\n" +
    "```structured-field\nid: b\nlabel: B\ntype: text\nwidth: 100%\nvalue: \n```\n";
  const out = Ct(BESIDE, "a", "b", "beside", undefined, undefined, { side: "right" });
  ok("a landed after b", R(out).map((x) => x.field.id).join(",") === "b,a", R(out).map((x) => x.field.id).join(","));
  ok(
    "the target kept its value: line",
    out.includes("id: b") && /id: b[\s\S]*?value:/.test(out),
    "b lost its value line: " + JSON.stringify(out),
  );
  ok(
    "and the moved field still did not gain one",
    !/id: a[\s\S]*?\nvalue:/.test(out),
    "a gained a phantom value line: " + JSON.stringify(out),
  );
}

console.log("\n================ SEAMS ================");
console.log("pass:", pass, " fail:", fail);
for (const [n, d] of bad) console.log("  FAIL " + n + (d === undefined || d === "" ? "" : "  [" + d + "]"));
process.exit(fail ? 1 : 0);