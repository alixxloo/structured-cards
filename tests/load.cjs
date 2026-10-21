// Loads src/main.js and exposes the internal functions the detailed suites
// assert against. It cannot be used on main.js: minification renames every one
// of these bindings. That is what artifact.cjs is for -- it tests the shipped
// file through its public surface instead.
const fs = require("fs");
const { P, T } = require("./paths.cjs");

const b = fs.readFileSync(P + "src" + require("path").sep + "main.js", "utf8");
const patch =
  "\n;module.exports.__test={Q,W,R,ft,mt,Pt,At,z,B,$t,pt,oe,se,He,_t,Ie,Nt,st,Pe,Ct,qt,ke,le,Vt,Ot,Z,St,V,gt,wt,nt,de,ne,ae,Oe,Ae,$e};\n";
fs.writeFileSync(T + "undertest.cjs", b + patch);
delete require.cache[require.resolve(T + "undertest.cjs")];
module.exports = require(T + "undertest.cjs");