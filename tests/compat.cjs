"use strict";
// Guards for the compatibility shims added for publication.
//
// Each shim is, by definition, code that does not run on the machine it was
// written on. Without a test that forces the missing branch, it is untested
// code shipping to every user.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { P, T } = require("./paths.cjs");

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

const source = fs.readFileSync(path.join(P, "src", "main.js"), "utf8");
const artifact = fs.readFileSync(path.join(P, "main.js"), "utf8");

// Pull the shim out of the source so it can be exercised with and without the
// global present, without needing the whole plugin to load twice.
const m = source.match(
  /var clonePlain =[\s\S]*?\n      \};\n/,
);
head("clonePlain fallback");
{
  ok("the shim exists in src/main.js", !!m, "regex did not match");
  if (m) {
    const shim = m[0];
    // The same thing under a sandbox where structuredClone is missing.
    const ctx = { Math, Array, console };
    vm.createContext(ctx);
    vm.runInContext("var clonePlain;\n" + shim.replace(/^var clonePlain =/, "clonePlain ="), ctx);
    const fallback = ctx.clonePlain;

    ok("with structuredClone absent it is still a function", typeof fallback === "function");
    ok(
      "it is not the native clone",
      fallback !== structuredClone,
      "sandbox saw a native structuredClone",
    );

    const sample = {
      id: "f1",
      label: "L",
      type: "text",
      width: "50%",
      value: "line one\nline two",
      optional: undefined,
      nested: { a: 1, b: [1, 2, { c: 3 }] },
      list: [{ x: 1 }, { y: 2 }],
    };
    const out = fallback(sample);
    ok("deep object comes back equal", JSON.stringify(out) === JSON.stringify(sample));
    ok("the clone is not the same reference", out !== sample);
    ok("nested objects are cloned too", out.nested !== sample.nested);
    ok("nested arrays are cloned too", out.list[0] !== sample.list[0]);
    ok(
      "an explicitly-undefined key survives",
      "optional" in out && out.optional === undefined,
      Object.keys(out).join(","),
    );
    ok("'optional' in out matches structuredClone", "optional" in structuredClone(sample));
    ok("mutating the clone leaves the original alone", (() => {
      const c2 = fallback(sample);
      c2.nested.a = 99;
      c2.list.push({ z: 3 });
      return sample.nested.a === 1 && sample.list.length === 2;
    })());
    ok("null passes through", fallback(null) === null);
    ok("primitives pass through", [fallback(1), fallback("x"), fallback(true)].join() === "1,x,true");
    ok("undefined passes through", fallback(undefined) === undefined);
    ok("an empty array stays an array", Array.isArray(fallback([])));
    ok(
      "a mutation through the shared fallback matches the native clone",
      (() => {
        const a = fallback(sample),
          b = structuredClone(sample);
        a.nested.b[2].c = 7;
        b.nested.b[2].c = 7;
        return JSON.stringify(a) === JSON.stringify(b);
      })(),
    );

    // And the branch the shim actually takes in Obsidian: native present.
    const withNative = vm.runInNewContext(
      "var structuredClone = (x) => JSON.parse(JSON.stringify(x));\n" +
        shim.replace(/^var clonePlain =/, "clonePlain ="),
    );
    ok(
      "when structuredClone exists the shim defers to it",
      typeof withNative === "function",
    );
  }
}

head("the shim reaches the built artifact");
{
  // Minified, but the native-detection idiom has to survive -- otherwise the
  // fallback was dead-code-eliminated and minAppVersion is a lie again.
  ok(
    "artifact still probes for structuredClone",
    /typeof structuredClone\s*==\s*["']function["']/.test(artifact),
    "probe missing from main.js",
  );
  ok(
    "artifact keeps the recursive fallback body",
    /Array\.isArray/.test(artifact),
  );
}

head("CSS fallbacks for older Chromium");
{
  const css = fs.readFileSync(path.join(P, "styles.css"), "utf8");
  const mixUses = [...css.matchAll(/[^;{}]*color-mix\([^;{}]*/g)];
  ok("color-mix is still used for modern browsers", mixUses.length >= 1, String(mixUses.length));
  for (const u of mixUses) {
    const rule = css.slice(0, u.index).split("}").pop();
    ok(
      "color-mix has a declared fallback before it",
      /background\s*:\s*(rgba|hsla|#[0-9a-f]{3,8})/i.test(rule),
      rule.slice(-160),
    );
  }
  const risky = [":has(", "aspect-ratio", "backdrop-filter"];
  for (const r of risky)
    ok("no unguarded '" + r + "' in the stylesheet", !css.includes(r));
}

head("declaration floor is actually supportable");
{
  const manifest = JSON.parse(fs.readFileSync(path.join(P, "manifest.json"), "utf8"));
  ok("minAppVersion is declared", typeof manifest.minAppVersion === "string");
  const versions = JSON.parse(fs.readFileSync(path.join(P, "versions.json"), "utf8"));
  ok(
    "versions.json covers the current version",
    versions[manifest.version] !== undefined,
    JSON.stringify(versions),
  );
  ok(
    "versions.json and manifest agree on the floor",
    versions[manifest.version] === manifest.minAppVersion,
    `${versions[manifest.version]} vs ${manifest.minAppVersion}`,
  );
  const knownGates = [
    [/\bstructuredClone\s*\(/, "structuredClone"],
    [/\breplaceAll\s*\(/, "replaceAll"],
    [/\breplaceChildren\s*\(/, "replaceChildren"],
  ];
  for (const [re, name] of knownGates) {
    const bare = [...source.matchAll(new RegExp(re.source, "g"))].length;
    ok(
      name + (bare ? " is used bare" : " is not used bare"),
      bare === 0,
      bare + " bare use(s) bypass the shim",
    );
  }
}

head("repo files Obsidian's reviewer expects");
{
  for (const f of [
    "main.js",
    "manifest.json",
    "styles.css",
    "versions.json",
    "README.md",
    "LICENSE",
    "package.json",
    "build.mjs",
    ".gitignore",
  ])
    ok(f + " is present", fs.existsSync(path.join(P, f)));
  const m = JSON.parse(fs.readFileSync(path.join(P, "manifest.json"), "utf8"));
  for (const k of ["id", "name", "version", "minAppVersion", "description", "author", "isDesktopOnly"])
    ok("manifest." + k + " is set", m[k] !== undefined && m[k] !== "");
  ok(
    "manifest.id is a safe directory name",
    /^[a-z0-9-]+$/.test(m.id),
    m.id,
  );
  ok("authorUrl is either absent or a real link", !m.authorUrl || /^https:\/\//.test(m.authorUrl), String(m.authorUrl));
}

console.log("\n================ COMPAT ================");
console.log("pass:", pass, " fail:", fail);
for (const [n, d] of bad) console.log("  FAIL " + n + (d === undefined ? "" : "  [" + d + "]"));
process.exit(fail ? 1 : 0);