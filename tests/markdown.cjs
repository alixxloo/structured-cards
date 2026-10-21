"use strict";
// Every markdown table in this repository must actually be a table.
//
// The reason this suite exists is concrete: the README's settings table and
// five of field-reference.md's tables were written as
//
//     `Key`   Default   Meaning
//
// — indented rows with 3-space column gaps and NO pipes. GitHub renders that
// as a run of collapsed whitespace, not as a table, and nothing else in the
// toolchain noticed. Found October 2026, eleven days before the first release.
//
// Run directly (node tests/markdown.cjs) or via `npm test`.
const fs = require("fs");
const path = require("path");

const P = path.resolve(__dirname, "..");

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
// the detector
// ---------------------------------------------------------------------------

// A row shaped `label   value   value`: indented, no pipe, two wide gaps.
// Skips fenced code, headings, quotes and list items. A row that begins with
// `|` is already a real table row and never flagged.
const SHAPE = /^\s*\S.*?\S {2,}\S.*?\S {2,}\S.*$/;

function malformedRows(text) {
  const out = [];
  const lines = text.split(/\r?\n/);
  let inFence = false;
  lines.forEach((l, i) => {
    if (/^\s*(```|~~~)/.test(l)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    if (l.includes("|")) return;
    const t = l.trim();
    if (!t) return;
    if (/^[#>]/.test(t) || /^\s*[-*+]\s/.test(l) || /^\s*\d+\.\s/.test(l)) return;
    if (!SHAPE.test(l)) return;
    out.push([i + 1, l]);
  });
  return out;
}

// ---------------------------------------------------------------------------
// pipe-table integrity: same number of cells in every row of a table
// ---------------------------------------------------------------------------

function cells(line) {
  const s = line.trim();
  if (!s.startsWith("|") || !s.endsWith("|")) return null;
  const inner = s.slice(1, -1).replace(/\\\|/g, "\0");
  return inner.split("|").map((c) => c.replace(/\0/g, "\\|").trim());
}

function tablesOf(text) {
  const out = [];
  let cur = [];
  let inFence = false;
  for (const raw of text.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(raw)) {
      if (cur.length) out.push(cur);
      cur = [];
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (raw.trim().startsWith("|")) cur.push(raw);
    else if (cur.length) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

function tableProblems(rows) {
  const problems = [];
  if (rows.length < 3) problems.push("only " + rows.length + " rows (a table needs a header, a separator and at least one data row)");
  const sep = cells(rows[1] || "");
  if (!sep || sep.some((c) => !/^:?-{3,}:?$/.test(c))) {
    problems.push("second row is not a separator row of `---` cells");
    return problems;
  }
  const head = cells(rows[0] || "");
  if (!head || head.length !== sep.length) {
    problems.push("header has " + (head ? head.length : "?") + " cells, separator has " + (sep ? sep.length : "?"));
  }
  for (let i = 2; i < rows.length; i++) {
    const c = cells(rows[i]);
    if (!c) {
      problems.push("data row " + (i + 1) + " is not wrapped in pipes");
      continue;
    }
    if (c.length !== sep.length) {
      problems.push("data row " + (i + 1) + " has " + c.length + " cells, expected " + sep.length + " — row: " + JSON.stringify(rows[i]));
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// positive controls: the detector must catch what it was invented to catch
// ---------------------------------------------------------------------------

console.log("### the detector catches the defect it was invented for");

ok("a mangled row IS flagged", malformedRows("  `Key`   Default   Meaning  ").length === 1);
ok("a real table row is NOT flagged", malformedRows("| `Key` | Default | Meaning |").length === 0);
ok("a mangled row inside a code fence is NOT flagged",
   malformedRows("```\n  a   b   c\n```").length === 0);

{
  const bad001 = tablesOf("| a | b |\n| --- | --- |\n| 1 |");
  ok("a ragged table IS flagged",
     tableProblems(bad001[0]).length === 1, JSON.stringify(bad001[0]));
  const good001 = tablesOf("| a | b |\n| --- | --- |\n| 1 | two |");
  ok("a well-formed table is NOT flagged",
     tableProblems(good001[0]).length === 0, JSON.stringify(good001[0]));
}

// ---------------------------------------------------------------------------
// the real files
// ---------------------------------------------------------------------------

const skip = new Set(["node_modules", "tests", "tools", ".git", "images"]);
const mdFiles = [];
(function walk(d, rel) {
  for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((x, y) => x.name.localeCompare(y.name))) {
    const r = rel ? rel + "/" + e.name : e.name;
    if (e.isDirectory()) {
      if (skip.has(e.name)) continue;
      walk(path.join(d, e.name), r);
    } else if (e.name.endsWith(".md")) {
      mdFiles.push([r, path.join(d, e.name)]);
    }
  }
})(P, "");

console.log("\n### every markdown file in the repository");

ok("the walk actually found the documentation", mdFiles.length >= 6, mdFiles.length + " files");

if (!mdFiles.some(([r]) => r === "README.md")) ok("README.md is in the walk", false, "missing");
if (!mdFiles.some(([r]) => r.startsWith("docs/"))) ok("docs/ is in the walk", false, "missing");

let tableCount = 0;
for (const [rel, abs] of mdFiles) {
  const text = fs.readFileSync(abs, "utf8");

  const rows = malformedRows(text);
  ok(rel + ": no pipe-less table rows", rows.length === 0,
     rows.length ? rows.map(([n, l]) => "L" + n + ": " + JSON.stringify(l.slice(0, 70))).join("\n  ") : "");

  const tables = tablesOf(text);
  tableCount += tables.length;
  for (let t = 0; t < tables.length; t++) {
    const problems = tableProblems(tables[t]);
    const where = rel + ": table " + (t + 1) + "/" + tables.length;
    const line = linesOf(text, tables[t][0]);
    ok(where + " is well formed", problems.length === 0,
       "at L" + line + "\n  " + problems.join("\n  "));
  }
}

function linesOf(text, firstRow) {
  const idx = text.split(/\r?\n/).indexOf(firstRow);
  return idx + 1;
}

console.log("\n### scale");
ok("the walk actually examined tables, not nothing", tableCount >= 6, tableCount + " tables total");

console.log("\n================ MARKDOWN ================");
console.log("pass:", pass, " fail:", fail);
for (const [n, d] of bad) console.log("  FAIL " + n + (d ? "  [" + d + "]" : ""));
process.exit(fail ? 1 : 0);
