// Build: src/main.js -> main.js (the file Obsidian actually loads).
//
// The plugin has no local imports, only externals that Obsidian provides at
// runtime, so this is a minify pass rather than a bundle. Keeping it as a real
// build step matters: src/main.js carries comments and readable names, and that
// is what should never ship.
import { build } from "esbuild";
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes("--watch");

const common = {
  entryPoints: [join(root, "src", "main.js")],
  bundle: true,
  format: "cjs",
  platform: "browser",
  target: "es2020",
  // Obsidian injects these; they must stay as require() calls.
  external: ["obsidian", "@codemirror/view", "@codemirror/state", "@codemirror/commands",
    "electron", "@lezer/common", "@lezer/highlight", "@lezer/lr"],
  minify: true,
  legalComments: "none",
  logLevel: "info",
};

async function run() {
  if (watch) {
    const { context } = await import("esbuild");
    const ctx = await context(common);
    await ctx.watch();
    console.log("watching src/ ...");
    return;
  }
  await build({ ...common, outfile: join(root, "main.js") });
  const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
  const size = (statSync(join(root, "main.js")).size / 1024).toFixed(1);
  console.log(`built main.js for ${manifest.id} ${manifest.version}  (${size} KB)`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});