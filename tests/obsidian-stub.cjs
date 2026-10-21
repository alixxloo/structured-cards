// Re-export, not a second copy: the plugin's own `require("obsidian")` resolves
// to tests/.tmp/node_modules/obsidian, and the suites need the *same* classes
// for `instanceof` to mean anything. Run `node stubs.cjs` (npm test does this)
// to regenerate the target.
module.exports = require("./.tmp/node_modules/obsidian/index.js");