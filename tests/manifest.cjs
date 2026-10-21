"use strict";
// Everything that must be true for Obsidian to install this plugin, and for CI
// to pass. A release that breaks one of these is not a release.
//
// Run directly (node tests/manifest.cjs) or via `npm test`.
const fs = require("fs");
const path = require("path");

const P = path.resolve(__dirname, "..");
const read = (f) => JSON.parse(fs.readFileSync(path.join(P, f), "utf8"));

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

const m = read("manifest.json");
const v = read("versions.json");
const p = read("package.json");

console.log("\n### manifest.json");
for (const k of [
  "id",
  "name",
  "version",
  "minAppVersion",
  "description",
  "author",
  "isDesktopOnly",
])
  ok("manifest." + k + " is set", m[k] !== undefined && m[k] !== "", String(m[k]));

ok(
  "manifest.id is a safe directory name",
  /^[a-z0-9-]+$/.test(m.id),
  m.id,
);
ok(
  "manifest.version is semver",
  /^\d+\.\d+\.\d+$/.test(m.version),
  m.version,
);
ok(
  "manifest.description is a sensible length for the plugin list",
  m.description.length >= 20 && m.description.length <= 300,
  m.description.length + " chars",
);
// Checked against the live community-plugins.json: 96.5% of the 8,900+ entries
// end their description with a period. A fragment reads as truncated in the
// browse list, so the period is the convention, not the exception.
ok(
  "manifest.description is a full sentence",
  /\.$/.test(m.description),
  m.description,
);
ok("authorUrl is either absent or an https link", !m.authorUrl || /^https:\/\//.test(m.authorUrl), String(m.authorUrl));

console.log("### versions.json");
ok(
  "versions.json has an entry for the current version",
  v[m.version] !== undefined,
  JSON.stringify(v),
);
ok(
  "versions.json agrees with manifest.minAppVersion",
  v[m.version] === m.minAppVersion,
  `${v[m.version]} vs ${m.minAppVersion}`,
);
ok("versions.json is not empty", Object.keys(v).length > 0);
ok(
  "every versions.json key is semver",
  Object.keys(v).every((k) => /^\d+\.\d+\.\d+$/.test(k)),
  Object.keys(v).join(","),
);
ok(
  "every versions.json floor is semver",
  Object.values(v).every((k) => /^\d+\.\d+\.\d+$/.test(String(k))),
  Object.values(v).join(","),
);

console.log("### version agreement");
ok(
  "package.json version matches manifest.json",
  p.version === m.version,
  `${p.version} vs ${m.version}`,
);

console.log("### files Obsidian downloads or the reviewer reads");
for (const f of [
  "main.js",
  "styles.css",
  "manifest.json",
  "versions.json",
  "README.md",
  "LICENSE",
  "package.json",
  "build.mjs",
  "src/main.js",
  ".gitignore",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  "SECURITY.md",
  ".github/workflows/ci.yml",
])
  ok(f + " exists", fs.existsSync(path.join(P, f)));

for (const d of [
  "docs/field-reference.md",
  "docs/file-format.md",
  "docs/architecture.md",
  "docs/development.md",
  "docs/known-limitations.md",
  "docs/release-process.md",
  "docs/release-notes-0.1.0.md",
])
  ok(d + " exists", fs.existsSync(path.join(P, d)));

console.log("### hygiene");
ok(
  "data.json is not committed",
  !fs.existsSync(path.join(P, "data.json")),
  "per-install state must stay out of the repo",
);
const gitignore = fs.readFileSync(path.join(P, ".gitignore"), "utf8");
for (const entry of ["node_modules/", "data.json", "tests/.tmp/"])
  ok(".gitignore covers " + entry, gitignore.includes(entry));
ok(
  "main.js is gitignored (built fresh for each Release by release.yml)",
  /^main\.js\s*$/m.test(gitignore) && /deliberately NOT committed/.test(gitignore),
  "main.js ships as a Release asset, not as a committed copy",
);
const readme = fs.readFileSync(path.join(P, "README.md"), "utf8");
ok(
  "README links to every doc it lists",
  [
    "field-reference",
    "file-format",
    "architecture",
    "development",
    "known-limitations",
    "release-process",
    "release-notes",
    "CHANGELOG",
    "CONTRIBUTING",
    "CODE_OF_CONDUCT",
    "SECURITY",
    "LICENSE",
  ].every((f) => readme.includes(f)),
);
ok("README states the current version", readme.includes(m.version), m.version);
ok(
  "README links use the placeholder owner, not a stale username",
  !/<you>/.test(readme.replace(/https:\/\/github\.com\/<you>/g, "")),
);

console.log("\n================ MANIFEST ================");
console.log("pass:", pass, " fail:", fail);
for (const [n, d] of bad) console.log("  FAIL " + n + (d === undefined ? "" : "  [" + d + "]"));
process.exit(fail ? 1 : 0);