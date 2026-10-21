"use strict";
const fs = require("fs");
const path = require("path");
const T = require("./paths.cjs").T;

function writeStub(dir, name, body) {
  const d = path.join(T, "node_modules", dir);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, "package.json"), JSON.stringify({ name: dir, version: "1.0.0", main: "index.js" }));
  fs.writeFileSync(path.join(d, "index.js"), body);
}

writeStub("obsidian", "obsidian", `
class Component { constructor() {} onload() {} onunload() {} addChild() {} removeChild() {} registerEvent() {} register() {} registerDomEvent() {} registerInterval() {} }
class Plugin extends Component {
  constructor(app, manifest) { super(); this.app = app; this.manifest = manifest; }
  addCommand() {} addSettingTab() {}
  registerMarkdownCodeBlockProcessor() {} registerEditorExtension() {}
  async loadData() { return null; } async saveData() {}
}
class Modal { constructor(app) { this.app = app; } open() {} close() {} onOpen() {} onClose() {} }
class PluginSettingTab { constructor(app, plugin) { this.app = app; this.plugin = plugin; this.containerEl = null; } display() {} }
class WorkspaceLeaf {}
class Menu { addItem() {} addSeparator() {} showAtMouseEvent() {} showAtPosition() {} }
class Notice { constructor(m) { this.message = m; } }
class MarkdownRenderChild extends Component {}
class TFile {}
class Setting { constructor() {} setName(){return this;} setDesc(){return this;} addButton(){return this;} addToggle(){return this;} addText(){return this;} addDropdown(){return this;} addExtraButton(){return this;} setWarning(){return this;} }
module.exports = { Component, Plugin, Modal, PluginSettingTab, WorkspaceLeaf, Menu, Notice,
  MarkdownRenderChild, TFile, Setting, setIcon() {}, Platform: { isMobile: false } };
`);

writeStub("@codemirror/view", "view", `
class WidgetType { eq(){return false;} toDOM(){return null;} updateDOM(){return false;} destroy(){} ignoreEvent(){return false;} }
const noop = () => {};
module.exports = {
  WidgetType,
  Decoration: { none:{map:noop,forEach:noop}, replace:(o)=>({replace:true,...o}), mark:(o)=>o,
    set:(v)=>({map:noop,forEach:noop,value:v}),
    RangeSetBuilder: class { add(){} finish(){return {map:noop,forEach:noop};} } },
  EditorView: { decorations:{from:(f)=>f}, findFromDOM:()=>null },
  ViewPlugin: { fromClass:(c)=>({c}) }, keymap:{of:(v)=>v}, EditorState:{},
};
`);

writeStub("@codemirror/state", "state", `
const noop = () => {};
module.exports = {
  StateField:{define:(s)=>({spec:s})},
  // StateEffect with the real protocol: the define() result is a type, .of(value)
  // makes an instance, and instance.is(type) compares. Instances stay reachable
  // with instanceof too, which suites use to finger specific effects.
  StateEffect:{define:()=>{const C=class{constructor(v){this.value=v;}is(t){return t===C;}};C.of=(v)=>new C(v);return C;}},
  Prec:{highest:(v)=>({v}),lowest:(v)=>({v})}, EditorSelection: class{}, Text: class{},
  RangeSetBuilder: class { add(){} finish(){return {map:noop,forEach:noop};} },
};
`);

writeStub("@codemirror/commands", "commands", `
module.exports = { undo:()=>true, redo:()=>true, isolateHistory:{of:(v)=>v}, defaultKeymap:[] };
`);

console.log("stubs restored");