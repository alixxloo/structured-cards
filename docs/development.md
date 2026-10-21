# Development

## Setup

```sh
git clone https://github.com/alixxloo/structured-cards
cd structured-cards
npm install
npm run build
```

Node 18 or newer.

The plugin has no local imports — only `obsidian` and `@codemirror/*`, both of
which Obsidian injects at runtime. So `build.mjs` is a **minify pass, not a
bundle**:

```js
external: ["obsidian", "@codemirror/view", "@codemirror/state", "@codemirror/commands", ...]
minify: true
format: "cjs"
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run build` | `src/main.js` → `main.js`, minified |
| `npm run dev` | Same, rebuilding on change |
| `npm test` | Regenerates stubs, then runs all 24 suites |
| `npm run check:counts` | Re-runs the suite and fails if the test counts stated in the docs do not match it |
| `npm run test:quick` | The three fastest suites |
| `npm run prepare-stubs` | Regenerates the API stubs only |
| `npm run screenshots` | Regenerates the screenshot pages in `docs/images/` |

### Edit `src/main.js`, never `main.js`

`main.js` is a build artifact **and** a committed file, because Obsidian
downloads it straight from the git tag. Editing it directly means the next build
silently reverts your change.

## Screenshots

`npm run screenshots` writes `docs/images/*.html`: pages that render a handful
of cards with the plugin's own render function and the plugin's own stylesheet,
so the images in the README are the real UI rather than a mock-up. The `.html`
files are gitignored; the `.png` files they are screenshotted into are committed,
because README.md links to them.

To refresh an image, serve the repository over http (the screenshot tool cannot
open `file://`), open the page, and capture it at the same width so the set stays
consistent:

```sh
npm run prepare-stubs   # the harness reuses the test stubs
npm run screenshots
npx --yes http-server . -p 8731   # or any static server
```

Two things are declared on the page itself, and should stay that way if the
harness is changed:

- hover-revealed controls are forced visible, because a still image cannot hover.
  Exactly one item is marked, not every control on every card;
- the plugin's stylesheet is inlined verbatim, and the CSS variables Obsidian
  defines are declared by hand, because the page is the note's rendered view and
  not Obsidian's chrome.

## Loading it in a vault

```sh
# after npm run build
cp main.js manifest.json styles.css \
   "<your-vault>/.obsidian/plugins/structured-cards/"
```

Then `Ctrl+R` in Obsidian.

> **Do not put a backup inside `.obsidian/plugins/`.** Obsidian scans every
> subdirectory for a `manifest.json` and will happily load a second copy of the
> plugin from a folder named `structured-cards-backup`, which produces a baffling
> "my version is stuck" bug. Keep backups in `.obsidian/plugin-backups/`.

## The test harness

`tests/` runs the plugin against jsdom with a mocked vault, a mocked `Editor`
and a mocked CodeMirror. It is not Obsidian, and
[`known-limitations.md`](known-limitations.md) is explicit about what that costs.

### Layout

| File | Role |
| --- | --- |
| `paths.cjs` | The only place that knows where the plugin and the scratch dir are |
| `stubs.cjs` | Writes the `obsidian` and `@codemirror/*` stubs into `tests/.tmp/node_modules` |
| `obsidian-stub.cjs` | A **re-export**, not a copy — `instanceof` has to mean something |
| `load.cjs` | Loads `src/main.js` and exposes internals on `__test` |
| `run.cjs` | Runs every suite in a separate process, prints one total |
| `artifact.cjs` | Tests the **built** `main.js` through its public surface |

### Two kinds of suite

`src/main.js` has readable internals; the built `main.js` has minified ones.
So:

- **Detailed suites** assert against `src/main.js` via `load.cjs`, which appends
  a `module.exports.__test = {...}` shim listing internal bindings. One suite,
  `direction.cjs`, appends its own exports instead (declared in the file); the
  result is the same kind of shim, just owned by the suite that needs it.
- **`artifact.cjs`** asserts against the shipped `main.js` through its public
  methods only, because that is all a minified file exposes.

If you add an internal function you want tested, add it to the `__test` list in
`load.cjs`.

### Why separate processes

Several suites install globals (`window`, `document`, `navigator`) and replace
members of the `obsidian` module. In one process, one suite's setup silently
disarms another's. Separate processes cost a few hundred milliseconds and buy
isolation.

### After any `npm install`

`npm install` prunes `tests/.tmp/node_modules`, which contains hand-written
stubs. `npm test` regenerates them, so this only bites if you run a suite
directly:

```sh
node tests/stubs.cjs && node tests/review3.cjs
```

## Adding a field type

1. **Serialise** — add the key to `W()`.
2. **Parse** — add the key to the parser and validate it.
3. **Reserve** — add it to the reserved-key set so it is not swallowed into
   metadata.
4. **Render** — add a branch in `fieldValueControl`.
5. **Fall back** — if the control cannot represent the stored value, fall back to
   `plainFieldControl`. This step is not optional; see
   [`architecture.md`](architecture.md#typed-controls).
6. **Test** — `audit.cjs` asserts the branch exists; `runtime.cjs` renders it.

## Naming

The recovered internals are terse (`Q`, `W`, `R`, `Ct`, `ke`, `dt`) because the
file was de-minified from a build — those names are stable but meaningless.
**New code uses readable names.** The terse names are load-bearing for the test
harness and will not be renamed casually.

## Style

- Two-space indent, semicolons, double quotes — matching the existing file.
- Comments explain **why**, not what. A comment restating the code is noise.
- Every fix gets an assertion. If you cannot write one, that is a signal the fix
  is not understood yet.

## Verifying a fix

The loop that has actually worked:

1. Reproduce the bug in a test.
2. Watch it fail.
3. Fix it.
4. Watch it pass.
5. Add it to the right suite so it stays covered.

Do not skip step 1. Real-usage runs found three regressions in this release that
1148 passing assertions had missed — see
[`CHANGELOG.md`](../CHANGELOG.md#third-review-round---reported-from-inside-obsidian).