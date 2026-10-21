"use strict";
// Runs every suite and reports one number. `npm test`.
// Suites are separate processes on purpose: several of them install globals
// (window, document, navigator) and stub the obsidian module, so running them
// in one process would let one suite's setup silently disarm another's.
const { spawnSync } = require("child_process");
const path = require("path");

const suites = [
  // name,            what it covers
  ["t.cjs", "parse / serialise round-trips"],
  ["runtime.cjs", "live DOM rendering, event wiring"],
  ["audit.cjs", "every fixed defect is actually fixed"],
  ["editortest.cjs", "insert commands against a mock editor"],
  ["review2.cjs", "updateDOM reuse, keymap, minimal-span edits, settings migration"],
  ["review3.cjs", "move engine, blank lines, fence guards"],
  ["review4.cjs", "regressions found by self-audit"],
  ["review5.cjs", "copy button, typed controls, metadata keys"],
  ["direction.cjs", "direction detection, hint bidi, settings reach the screen"],
  ["checkcss.cjs", "stylesheet vs the classes the JS emits"],
  ["look.cjs", "field distinctness, real gap, controls off neighbours"],
  ["readingdrag.cjs", "reading-view drag: hit-test, move, wiring"],
  ["itemchrome.cjs", "item buttons, grabbable line, empty-item hints"],
  ["dragnohover.cjs", "nothing reacts to the pointer mid-drag"],
  ["readingindicator.cjs", "the drop line promises the slot the file takes"],
  ["editorindicator.cjs", "editor drag: line against document, swept"],
  ["seams.cjs", "a move keeps every block seam and invents nothing"],
  ["entry.cjs", "the community-list entry and the update path"],
  ["markdown.cjs", "every markdown table is a real table"],
  ["nocopy.cjs", "the copy feature is fully gone"],
  ["settings.cjs", "every settings toggle actually persists"],
  ["compat.cjs", "publication shims, minAppVersion, repo files"],
  ["manifest.cjs", "everything Obsidian needs to install this"],
  ["artifact.cjs", "the built, minified main.js"],
];

let totalPass = 0,
  totalFail = 0;
const broken = [];

for (const [file, what] of suites) {
  const r = spawnSync(process.execPath, [path.join(__dirname, file)], {
    encoding: "utf8",
  });
  const out = (r.stdout || "") + (r.stderr || "");
  const line = out.match(/pass[:=]\s*(\d+)[\s\S]{0,20}?fail[:=]\s*(\d+)/);
  const pass = line ? +line[1] : 0;
  const fail = line ? +line[2] : 0;
  if (!line && r.status === 0) {
    // A helper suite (checkcss) with no pass/fail tally; treat its exit as truth.
    console.log("  --   " + file.padEnd(16) + what);
    if (r.status !== 0) broken.push(file);
    continue;
  }
  totalPass += pass;
  totalFail += fail;
  const verdict = fail === 0 && r.status === 0 ? " ok " : "FAIL";
  console.log(
    "  " + verdict + " " + file.padEnd(16) + String(pass).padStart(4) + " passed" +
      (fail ? "  " + fail + " FAILED" : "") + "   " + what,
  );
  if (fail !== 0 || r.status !== 0) {
    broken.push(file);
    for (const l of out.split("\n"))
      if (/FAIL|Error:/.test(l) || /^\s+at /.test(l))
        console.log("         " + l.trim().slice(0, 130));
  }
}

console.log(
  "\n  " + totalPass + " assertions passed" +
    (totalFail ? ", " + totalFail + " FAILED" : ", 0 failed") +
    " across " + suites.length + " suites",
);
if (broken.length) {
  console.log("  broken suites: " + broken.join(", "));
  process.exit(1);
}