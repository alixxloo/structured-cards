"use strict";
// The test-count numbers stated in the documentation must match what the suite
// actually runs. This bit us twice in one release cycle: assertions were added
// and six documents kept quoting the old total (1148, then 1209). A number a
// person has to update by hand after every change is a number that will be
// wrong in public — so the update is a script, and the wrong number is a fail.
//
// Since then the discipline got simpler: the running total is stated in exactly
// TWO places — the README badge and the docs/architecture.md directory map.
// Nowhere else. This script fails if either drifts from the suite, and also
// scans every document for stray "NNNN assertions" leftovers that someone
// reintroduced.
//
// This is deliberately NOT a suite in run.cjs: it spawns the whole run itself,
// and a suite that spawns run.cjs would recurse.
//
// Run via `npm run check:counts`.
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const P = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(P, f), "utf8");

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

// ---------------------------------------------------------------------------
// ground truth: run the suite once and read its own tally
// ---------------------------------------------------------------------------

const stubs = spawnSync(process.execPath, [path.join(__dirname, "stubs.cjs")], {
  encoding: "utf8",
});
if (stubs.status !== 0) {
  console.log("stubs.cjs failed before the suite could run");
  process.exit(1);
}

const run = spawnSync(process.execPath, [path.join(__dirname, "run.cjs")], {
  encoding: "utf8",
});
const tally = /(\d+) assertions passed, (\d+) failed across (\d+) suites/.exec(run.stdout || "");

ok("the suite ran", !!tally, (run.stdout || "").slice(-400));
if (!tally) {
  console.log("pass:", pass, " fail:", fail);
  process.exit(1);
}
const X = tally[1];      // assertions
const F = tally[2];      // failures
const K = tally[3];      // suites

ok("the suite itself passes before the docs are graded", F === "0", F + " failed");
ok("the tally parse is sane", +X >= 1000 && +K >= 20, X + " / " + K);

console.log(`  ground truth: ${X} assertions, 0 failed, ${K} suites\n`);

// ---------------------------------------------------------------------------
// the two canonical spots where the numbers are stated
// ---------------------------------------------------------------------------

function fresh(rel, re, exp1, exp2, label) {
  const text = read(rel);
  const m = re.exec(text);
  const good = !!m && m[1] === exp1 && (exp2 === undefined || m[2] === exp2);
  ok(`${rel}: ${label}`,
     good,
     m ? `docs: ${m.slice(1).filter(Boolean).join(", ")} — suite: ${[exp1, exp2].filter(Boolean).join(", ")}` : "pattern not found");
}

fresh("README.md",            /tests-(\d+)%20passing/,                    X, undefined, "badge test count");
fresh("docs/architecture.md", /tests\/\s+(\d+) suites, (\d+) assertions/, K, X,       "directory map");

// ---------------------------------------------------------------------------
// stale residuals: every other "NNNN assertions" mention must be one of the
// two canonical spots or an explicitly whitelisted historical sentence
// ---------------------------------------------------------------------------

const HISTORICAL = [
  // development.md narrates what the suite at the time had missed; the 1148
  // is a fact about the past, not a stale copy of the current total. The
  // number sits on a continuation line of a two-line sentence, so the
  // whitelist keys on the continuation line itself.
  "passing assertions had missed",
];

const docs = [
  "README.md", "CHANGELOG.md", "CONTRIBUTING.md", "SECURITY.md", "CODE_OF_CONDUCT.md",
  "docs/architecture.md", "docs/development.md", "docs/field-reference.md",
  "docs/file-format.md", "docs/known-limitations.md", "docs/release-process.md",
  "docs/release-notes-0.1.0.md",
];

for (const rel of docs) {
  if (!fs.existsSync(path.join(P, rel))) continue;
  const text = read(rel);
  const lines = text.split(/\r?\n/);
  lines.forEach((l, i) => {
    if (/\b\d{3,}\b/.test(l) === false || !/assertions/.test(l)) return;
    const canonical = /tests-(\d+)%20passing|(\d+) suites, (\d+) assertions/.test(l);
    const historical = HISTORICAL.some((h) => l.includes(h));
    if (!canonical && !historical) {
      ok(`${rel} L${i + 1}: stray test count is accounted for`, false, JSON.stringify(l.trim().slice(0, 90)));
    } else {
      pass++;
    }
  });
}

console.log("\n================ COUNTS ================");
console.log("pass:", pass, " fail:", fail);
for (const [n, d] of bad) console.log("  FAIL " + n + (d ? "  [" + d + "]" : ""));
process.exit(fail ? 1 : 0);
