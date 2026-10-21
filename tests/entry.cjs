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
const e = read(".github/community-plugin.json");
const rp = fs.readFileSync(path.join(P, "docs/release-process.md"), "utf8");

console.log("\n### the community-plugins.json entry");
//
// Obsidian's own updater does `raw.githubusercontent.com/HEAD/{repo}/manifest.json`
// and then checks that the fetched manifest's `id` equals the id in the entry.
// Get the id wrong and every update check silently fails for every user, with no
// error anywhere. This suite exists so the entry can never drift from the
// manifest it has to agree with.

ok("the entry has exactly the five keys Obsidian accepts",
   Object.keys(e).sort().join(",") === "author,description,id,name,repo",
   Object.keys(e).sort().join(","));

ok("the entry id matches manifest.json",
   e.id === m.id, `${e.id} vs ${m.id}`);
ok("the entry name matches manifest.json",
   e.name === m.name, `${e.name} vs ${m.name}`);
ok("the entry description matches manifest.json",
   e.description === m.description,
   `entry: ${e.description}\n      manifest: ${m.description}`);
ok("the entry author matches manifest.json",
   e.author === m.author, `entry: ${e.author} vs manifest: ${m.author}`);

ok("the repo is owner/name with no scheme and no .git suffix",
   /^[\w.-]+\/[\w.-]+$/.test(e.repo), e.repo);
ok("the repo owner is the manifest author",
   e.repo.split("/")[0] === m.author,
   `repo owner ${e.repo.split("/")[0]} vs author ${m.author}`);

console.log("\n### the placeholder that shipped once already");
//
// `author` and `description` are shown in the plugin search results. A
// placeholder here does not fail loudly -- it just tells every user that
// somebody else's name is on the plugin.
for (const key of ["author", "description", "name", "repo"]) {
  ok(`the entry's ${key} is not a placeholder`,
     !/your|placeholder|todo|tbd|example/i.test(String(e[key])),
     e[key]);
}
ok("no angle-bracket placeholder survives anywhere in the entry",
   !/[<>[]]/.test(JSON.stringify(e)),
   JSON.stringify(e));

console.log("\n### the documented entry matches the real one");
//
// The entry is pasted by hand into obsidianmd/obsidian-releases, so the copy in
// the release process is the one that can go wrong.
{
  const block = /```json\n(\{[^`]*?"structured-cards"[\s\S]*?\})\n```/.exec(rp);
  ok("the release process shows the entry as JSON", !!block, "no block found");
  if (block) {
    let parsed = null;
    try {
      parsed = JSON.parse(block[1]);
    } catch (e) {
      ok("the documented entry is valid JSON", false, String(e.message));
    }
    if (parsed) {
      ok("the documented entry is valid JSON", true);
      ok("the documented entry is the one in .github/community-plugin.json",
         JSON.stringify(parsed) === JSON.stringify(e),
         "documented: " + JSON.stringify(parsed) + "\n      real: " + JSON.stringify(e));
    }
  }
}

console.log("\n### what the updater actually fetches");
//
// The mechanism, from Obsidian's own documentation and its update-check code:
// the newest version comes from manifest.json on the DEFAULT branch, via HEAD,
// and only the files come from the Release. Both copies therefore have to exist
// and agree, and the tag has to be the exact version with no `v` prefix.
ok("manifest.json is at the repository root, where the updater looks",
   fs.existsSync(path.join(P, "manifest.json")));
ok("versions.json is at the repository root, for the too-old fallback",
   fs.existsSync(path.join(P, "versions.json")));

const versions = read("versions.json");
ok("versions.json covers the current version",
   versions[m.version] === m.minAppVersion,
   `${versions[m.version]} vs ${m.minAppVersion}`);

const packaged = fs.existsSync(path.join(P, "main.js")) &&
  fs.existsSync(path.join(P, "manifest.json")) &&
  fs.existsSync(path.join(P, "styles.css"));
ok("all three release assets exist in the repository", packaged,
   "main.js / manifest.json / styles.css");

ok("the current version is semver with no prefix, so it can be a tag",
   /^\d+\.\d+\.\d+$/.test(m.version), m.version);
ok("the tag would need no `v` prefix",
   !/^v/.test(m.version), m.version);

console.log("\n### no plugin code is involved in updating");
//
// Worth asserting, because it is the natural assumption to get wrong: a plugin
// that shipped its own downloader would be doing work Obsidian already does, and
// would need credentials it should not have.
const built = fs.readFileSync(path.join(P, "main.js"), "utf8");
ok("the shipped bundle does not fetch anything from GitHub",
   !/githubusercontent|api\.github\.com/.test(built),
   "the built main.js references GitHub");
ok("the source ships no update checker of its own",
   !/requestUrl\(|checkForUpdate/.test(fs.readFileSync(path.join(P, "src/main.js"), "utf8")));

console.log("\n================ ENTRY ================");
console.log("pass:", pass, " fail:", fail);
for (const [n, d] of bad) console.log("  FAIL " + n + (d === undefined ? d === undefined ? "" : "" : "  [" + d + "]"));
process.exit(fail ? 1 : 0);