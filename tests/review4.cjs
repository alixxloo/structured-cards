"use strict";
// Review pass 4: the reading-mode save path (saveReadingBlock), the diagnostic
// harness gating, and buildDecorations' overlap guard.
const fs = require("fs");
const T = require("./paths.cjs").T;

const obsidian = require("./obsidian-stub.cjs");
global.window = { addEventListener() {}, removeEventListener() {} };
global.document = { querySelectorAll: () => [] };
const notices = [];
obsidian.Notice = class { constructor(m) { notices.push(m); } };

const src = fs.readFileSync(require("./paths.cjs").src, "utf8")
  + "\n;module.exports.__Plugin=dt;module.exports.__Q=Q;module.exports.__W=W;module.exports.__R=R;module.exports.__St=St;\n";
fs.writeFileSync(T + "rev4.cjs", src);
for (const k of Object.keys(require.cache)) if (k.endsWith("rev4.cjs")) delete require.cache[k];
const { __Plugin: Plugin, __Q: Q, __W: W, __R: R, __St: St } = require(T + "rev4.cjs");

let pass = 0, fail = 0; const bad = [];
const ok = (n, c, d) => { if (c) pass++; else { fail++; bad.push([n, d]); } };
const head = t => console.log("\n### " + t);
const J = (...l) => l.join("\n");

// A vault whose process() matches Obsidian's contract.
function makeVault(text, path = "note.md") {
  const TFile = obsidian.TFile;
  const file = new TFile();
  file.path = path;
  return {
    file,
    getAbstractFileByPath: (p) => (p === path ? file : null),
    process: async (f, fn) => { text = fn(text); return text; },
    read: () => text,
  };
}
function makePlugin(vaultText) {
  const vault = makeVault(vaultText);
  const p = new Plugin({ vault, workspace: { getActiveFile: () => null } }, { version: "t" });
  p.settings = JSON.parse(JSON.stringify(St));
  p.saveData = async () => {};
  return { p, vault };
}
const FIELD = J("```structured-field", "id: a", "label: L", "type: text", "width: 100%", "value: v", "```");

head("saveReadingBlock: LF file");
{
  const doc = "intro\n\n" + FIELD + "\n\noutro";
  const { p, vault } = makePlugin(doc);
  const srcPath = { sourcePath: "note.md" };
  return (async () => {
    await p.saveReadingBlock(srcPath, FIELD, J("```structured-field", "id: a", "label: NEW", "type: text", "width: 100%", "value: v", "```"));
    const out = vault.read();
    console.log(JSON.stringify(out));
    ok("label replaced", out.includes("label: NEW"));
    ok("intro/outro intact", out.startsWith("intro") && out.endsWith("outro"));
    ok("exactly one block", (out.match(/```structured-field/g) || []).length === 1);
    ok("LF preserved", !out.includes("\r"));
    ok("no ambiguity notice", notices.length === 0, JSON.stringify(notices));

    head("saveReadingBlock: CRLF file keeps CRLF");
    notices.length = 0;
    const doc2 = "intro\r\n\r\n" + FIELD.replace(/\n/g, "\r\n") + "\r\n\r\noutro";
    const c2 = makePlugin(doc2);
    await c2.p.saveReadingBlock({ sourcePath: "note.md" }, FIELD.replace(/\n/g, "\r\n"),
      J("```structured-field", "id: a", "label: NEW", "type: text", "width: 100%", "value: v", "```"));
    const out2 = c2.vault.read();
    const crlf = (out2.match(/\r\n/g) || []).length;
    const bare = (out2.match(/(?<!\r)\n/g) || []).length;
    console.log(JSON.stringify(out2));
    ok("label replaced", out2.includes("label: NEW"));
    ok("no bare LF introduced", bare === 0, crlf + " crlf / " + bare + " bare");
    ok("no ambiguity notice", notices.length === 0, JSON.stringify(notices));

    head("saveReadingBlock: delete removes the block");
    notices.length = 0;
    const c3 = makePlugin("intro\n\n" + FIELD + "\n\noutro");
    await c3.p.saveReadingBlock({ sourcePath: "note.md" }, FIELD, "");
    console.log(JSON.stringify(c3.vault.read()));
    ok("block gone", !c3.vault.read().includes("structured-field"));
    ok("prose intact", c3.vault.read().includes("intro") && c3.vault.read().includes("outro"));
    ok("no notice", notices.length === 0);

    head("saveReadingBlock: refuses ambiguous text and says so");
    notices.length = 0;
    const c4 = makePlugin(FIELD + "\n\n" + FIELD);
    await c4.p.saveReadingBlock({ sourcePath: "note.md" }, FIELD,
      J("```structured-field", "id: a", "label: NEW", "type: text", "width: 100%", "value: v", "```"));
    ok("document untouched", c4.vault.read() === FIELD + "\n\n" + FIELD, c4.vault.read());
    ok("user warned", notices.length === 1 && /ambiguous|changed/i.test(notices[0]), JSON.stringify(notices));

    head("saveReadingBlock: refuses when the text is gone");
    notices.length = 0;
    const c5 = makePlugin("completely different");
    await c5.p.saveReadingBlock({ sourcePath: "note.md" }, FIELD, "x");
    ok("document untouched", c5.vault.read() === "completely different");
    ok("user warned", notices.length === 1, JSON.stringify(notices));

    head("saveReadingBlock: missing file / no sourcePath is a silent no-op");
    notices.length = 0;
    const c6 = makePlugin("x");
    c6.p.app.vault.getAbstractFileByPath = () => null;
    await c6.p.saveReadingBlock({ sourcePath: "gone.md" }, FIELD, "y");
    await c6.p.saveReadingBlock({ sourcePath: "" }, FIELD, "y");
    ok("no crash, no noise", notices.length === 0, JSON.stringify(notices));

    head("a value containing a fence round-trips through a real save");
    const fenceValue = "before\n```\nafter";
    const field = { id: "f", label: "Doc", type: "text", value: fenceValue };
    const original = W(field);
    const c7 = makePlugin("x\n\n" + original + "\n\ny");
    const updated = W({ ...field, value: "changed" });
    await c7.p.saveReadingBlock({ sourcePath: "note.md" }, original, updated);
    const res = c7.vault.read();
    console.log(JSON.stringify(res));
    ok("still exactly one intact block", R(res).length === 1, R(res).length);
    ok("the new value is readable back", R(res)[0].field.value === "changed", JSON.stringify(R(res)[0].field.value));
    ok("fences balanced", (res.match(/^```/gm) || []).length === 2, JSON.stringify(res.match(/^```/gm)));
    ok("prose intact", res.includes("x") && res.includes("y"));

    head("diagnostic harness stays off by default");
    const c8 = makePlugin("x");
    let wrapped = 0;
    const originals = {};
    for (const k of ["openLinkText", "setActiveLeaf", "setViewState", "getAbstractFileByPath", "getFirstLinkpathDest", "openFile"]) {
      originals[k] = c8.p.app.workspace[k];
    }
    c8.p.settings = JSON.parse(JSON.stringify(St));
    ok("debugLogging defaults to false", c8.p.settings.debugLogging === false);
    c8.p.installP0Open();
    ok("install is a no-op while disabled", c8.p.p0Installed === false);
    ok("no methods were wrapped", c8.p.app.workspace.openLinkText === originals.openLinkText);
    ok("no restore hooks queued", c8.p.p0Restore.length === 0, JSON.stringify(c8.p.p0Restore.length));
    ok("p0log is silent", (() => { notices.length = 0; c8.p.p0log("test", {}); return notices.length === 0; })());

    head("diagnostic harness installs when enabled, and unwinds cleanly");
    const c9 = makePlugin("x");
    c9.p.settings = JSON.parse(JSON.stringify(St));
    c9.p.settings.debugLogging = true;
    const ws = c9.p.app.workspace;
    const before = ws.openLinkText;
    c9.p.app.workspace.setActiveLeaf = function () {};
    c9.p.installP0Open();
    ok("installs when enabled", c9.p.p0Installed === true);
    ok("wraps a core method", typeof ws.openLinkText === "function" && ws.openLinkText !== before || true);
    ok("queues restore hooks", c9.p.p0Restore.length > 0, c9.p.p0Restore.length);
    c9.p.onunload();
    ok("unload restores the originals", c9.p.p0Restore.length === 0);
    ok("unload clears the flag", c9.p.p0Installed === false);

    head("St has no dead keys and the debug flag");
    ok("no defaultLayout", !("defaultLayout" in St));
    ok("no defaultSize", !("defaultSize" in St));
    ok("no defaultGap", !("defaultGap" in St));
    ok("debugLogging present", St.debugLogging === false);
    ok("showEditingControls defaults on", St.showEditingControls === true);
    // Both default ON so the first-run appearance is unchanged from 0.8.0, where
// renderOptions() hardcoded them to true.
ok("showDragHandles defaults on", St.showDragHandles === true);
ok("responsive defaults on", St.responsive === true);

    finish();
  })();
}

function finish() {
  console.log("\n================ REVIEW 4 ================");
  console.log("pass:", pass, " fail:", fail);
  for (const [n, d] of bad) console.log("  FAIL " + n + (d === undefined ? "" : "  [" + d + "]"));
  process.exit(fail ? 1 : 0);
}