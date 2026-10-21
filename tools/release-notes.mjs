// Release notes for a tag: extracts the matching CHANGELOG section (## [<ver>]
// ... up to the next section or the trailing link definitions) and prints it,
// with an install block on top. Used by the release workflow so the release
// page is generated from the same text the repo already maintains.
//
// Usage: node tools/release-notes.mjs 0.2.0

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("usage: node tools/release-notes.mjs <version>");
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const changelog = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8");

const heading = "## [" + version + "]";
const start = changelog.indexOf(heading);
if (start < 0) {
  console.error(
    "no CHANGELOG section for " + version +
    " - add a '## [" + version + "] ...' heading before tagging",
  );
  process.exit(1);
}
let end = changelog.indexOf("\n## [", start + heading.length);
if (end < 0) end = changelog.length;

// Link definitions at the very end ([0.1.0]: https://...) are for markdown
// files, not for a release page; drop them.
let section = changelog.slice(start, end).trimEnd();
section = section.replace(/\n\[[\w.]+\]: https?:\/\/\S+\s*$/, "").trimEnd();

const install =
  "> **Install** — this plugin is not in Obsidian's community-plugin list yet, so use one of:\n" +
  ">\n" +
  "> **Manual:** download the three assets below (`manifest.json`, `main.js`, `styles.css`) into\n" +
  "> `<your-vault>/.obsidian/plugins/structured-cards/`, restart Obsidian, then enable **Structured Cards**\n" +
  "> in Settings → Community plugins (community plugins are enabled under Settings → General).\n" +
  ">\n" +
  "> **BRAT:** install BRAT, run its *Add a plugin* command, and enter `alixxloo/structured-cards` —\n" +
  "> the repository is public, and future tagged releases are picked up the same way.";

console.log(install + "\n\n---\n\n" + section + "\n");
