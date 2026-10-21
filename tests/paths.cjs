// Single place that knows where the plugin and the scratch dir are, so the
// suites can be moved or cloned without editing eight files.
const path = require("path");
const fs = require("fs");

const tests = __dirname;
const sep = path.sep;
const P = path.resolve(tests, "..") + sep;
const T = (process.env.SC_TMP || path.join(P, "tests", ".tmp")) + sep;

fs.mkdirSync(T, { recursive: true });

module.exports = {
  P,
  T,
  tests,
  // The readable, editable source. The suites that reach into internals can
  // only run against this: minification renames every one of those bindings.
  src: P + "src" + sep + "main.js",
  // The shipped artifact, produced by `npm run build`.
  built: P + "main.js",
  css: P + "styles.css",
};