# Changelog

All notable changes to Structured Cards.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Repository infrastructure

Nothing here changes what the plugin does — it changes how the repository is
built, installed and documented:

- **`main.js` is no longer committed.** It now ships the way every installer
  already consumed it: as a GitHub Release asset, built fresh from the tagged
  source by the new release workflow. A committed build product drifts
  silently; a build at tag time cannot. `0.1.0` still carries its copy on the
  tag — the Release assets were then, and remain now, the files users install.
- **One-line installers.** `install.sh` (Linux, macOS, Git Bash on Windows)
  and `install.ps1` (Windows PowerShell 5.1+) download the latest release's
  `manifest.json`, `main.js` and `styles.css` into a vault, enable the plugin
  in `community-plugins.json` without rewriting anything they cannot parse,
  and fall back to building from source when a release asset is unreachable.
- **Release automation.** `.github/workflows/release.yml` builds, runs the
  full test suite and attaches the three assets on every version tag; the
  release page is generated from this file with `node tools/release-notes.mjs`.
  CI was reworked to prove a clean build instead of guarding a committed
  artifact.
- **Bilingual documentation.** A Persian edition of the README (`README.fa.md`)
  with the same depth, examples and reference tables, natively right-to-left.
- **Wider verification net.** The reference tables the READMEs gained are
  checked table-by-table by the markdown suite, and the Persian edition is a
  new file in that walk — the suite's running total is now stated in exactly
  two places (the README badge and the architecture map), enforced by
  `check:counts`.

## [0.1.0] — first public release

Everything in this release was previously an unreleased internal build. This is
the first version other people will run, and it was produced by a six-round
review that found and fixed 27 defects, plus 4 regressions introduced by the
fixes themselves, plus a reported-from-Obsidian pass over directions, hint
rendering and both settings surfaces.

**The full audit trail is [`docs/release-notes-0.1.0.md`](docs/release-notes-0.1.0.md)** —
every defect, every correction of a wrong finding, and every limit of the
verification. Nothing is summarised away.

### What it does

Draggable, resizable form fields stored as fenced Markdown blocks in the note
itself. Eight field types, per-field layout and direction, secret masking,
templates, and a settings panel for the UI chrome.

### Fixed before anyone could install it

**Data loss**

- A ` ``` ` inside a value truncated the field — block bodies are indented two
  spaces and CommonMark allows three before a closing fence.
- Inserting a field could **duplicate the entire document**: a `Position` object
  was passed where an offset was expected.
- Inserting at a caret mid-line split the line: `hello` became `he` + block +
  `llo`.
- Blank lines piled up until they destroyed rows. Capped at three.
- Malformed and indented `item:` lines produced blocks that did not parse back
  the same way.

**Silently broken features**

- `Move item down` did nothing — a stray `d--` in the condition.
- Every field type rendered as the same plain textarea. `select`, `number`,
  `url`, `code`, `tags` and `multiline` were inert and `options:` was never read.
- There was **no copy button at all**, despite three settings governing it.
- Resizing set `width: 0px`, making a field unusable.
- `prefix`, `suffix`, `help`, `required`, `options`, `default` and `validation`
  were parsed and then ignored.

**Settings that did nothing**

- `showEditingControls`, `showDragHandles` and `responsive` were hardcoded `true`.
  Now wired, defaulting to `true` so first-run appearance is unchanged.
- `defaultLayout`, `defaultSize`, `defaultDensity` and `defaultGap` were read by
  nothing. Now pruned from `data.json` on load.

### Fixed in the direction and settings round

Reported from inside Obsidian after round 5: directions misbehaving, English
hints rendering right-to-left, and settings that did not appear to do anything.

- **Direction now reaches every control.** `select`, `number`, `url`, `secret`,
  `multiline` and `code` controls sat inside the field's forced-LTR layout
  envelope and never carried a `dir` attribute, so a Persian value glued itself
  to the left edge of its own control with the title and items flowing right.
  Every typed control now carries `dir` from its declared direction,
  follows the value while typing and re-syncs on external edits.
- **Auto follows the first strong character anywhere.** A mostly-Persian line
  that opened Latin (or carried a URL) resolved LTR because the old detector
  only recognised RTL when Persian opened the line. Detection now scans the
  whole string for the first strong directional run.
- **English hints read left-to-right everywhere.** Plugin-owned hints
  (`Type here…`, `Type a URL…`, `Type a secret…`, `Title`, `Comma separated`)
  are wrapped in Unicode LRI…PDI isolates so they keep reading LTR inside RTL
  cards, punctuation included. Render-only and never serialized; your own
  placeholder text is never touched.
- **`Default text direction` is a base, not a seed (follow-up).** The first fix
  made the tab setting only seed brand-new fields, so flipping it looked dead
  to anyone looking at cards they already had. RTL/LTR in the tab is now the
  base direction of every field left on Auto (visible immediately, through the
  refresh effect and the widget render key), while a field that declares its
  own `direction:` still wins, and the factory `Auto` keeps per-field content
  detection. The field menu's Text-direction row and the tab row both describe
  this interplay.
- **The editor refresh no longer relies on an undocumented hop (follow-up).**
  Reaching a live editor went through `MarkdownView.editor.cm`, a property
  Obsidian never documented; when it was absent the refresh silently did
  nothing. Every CodeMirror view now registers itself with the plugin while
  the view plugin is alive, and the dispatch is sent straight to those views;
  the old hop stays only as a fallback.
- **The directions survive foreign direction plugins (follow-up 2).** A vault
  can run a second direction plugin whose stylesheet says `.is-rtl div
  { direction: rtl; unicode-bidi: unset }`. That is author-level CSS and a
  `dir` attribute only produces UA-level CSS, so it beat every direction this
  plugin set and force-RTL'ed every auto-growing wrap, which is why the fixes
  above looked like no-ops on that machine. The resolved direction is now also
  carried as `sc-dir-rtl` / `sc-dir-ltr` / `sc-dir-auto` classes and re-asserted
  (`!important`) at author level; structural divs re-assert their layout LTR;
  the mirror follows its wrap; and armored plugin hints keep their own LTR line
  placement (`::placeholder`) so an English hint reads left-to-right at the
  left edge even inside RTL fields.
- **Title alignment now covers item titles (follow-up 3).** `align:` styled
  only the field label; on an item-based card the title the user reads lives
  in its own full-width item box, so centering "moved nothing the user was
  looking at". The alignment now applies to the field label and every title
  item's text box (a title-text row's title included, its text value
  deliberately excluded), at build and on the reuse path.
- **The `Help text` row is gone from the field menu.** Reported as worthless;
  title alignment is the card-level control in that menu. Existing `help:`
  values in old notes still render under the field, so nothing a note already
  says is lost — new fields simply have no row that sets it.
- **Settings changes now reach an open editor.** The decoration state field
  rebuilt only on document changes, so toggling anything in the settings tab
  left live-preview widgets exactly as they were. The plugin now dispatches a
  refresh effect and the field rebuilds its decorations (widgets whose render
  key is unchanged keep their DOM).
- **Field-menu saves are no longer ignored on screen.** The reading-view reuse
  fingerprint covered only the item kinds, so changing a field's type kept the
  old control, and changing direction or title alignment did nothing until the
  note was reopened. The fingerprint now covers type, direction, alignment and
  options, so those saves rebuild the field; value-only edits still patch in
  place.
- **Title alignment actually renders.** `align:` was parsed and written back to
  the note but read by nothing; it now styles the title on build and on the
  reuse path.
- **The field menu only offers what applies.** For an item card, the rows that
  can only shape a single-value field (type, placeholder, options, default,
  validation, required, masking) are hidden with a note in their place — they
  could be set to values that silently did nothing.
- **The settings tab lost its one decorative row.** `Diagnostic logging` wraps
  core Obsidian methods and slows navigation; it is a data.json-only diagnostic
  (`debugLogging: true`), as the architecture document always described.
- **Empty text and tags fields keep their hints after outside edits.** The
  placeholder used to be stamped once at build time and wiped by the first
  refresh; it now rides the refresh closure.

**Debug instrumentation shipped enabled**

A diagnostic harness monkey-patched six core Obsidian methods and logged to every
user's console. Now behind `debugLogging`, default off.

### Improved

- **Accessibility** — keyboard support on drag handles, menus, resize handles and
  the copy button; arrow-key resizing; `aria-valuenow`; labels associated via
  `for`; legacy widgets set `ignoreEvent()` to `true`.
- **Dialogs** — native `confirm`/`prompt` replaced with three styled modals.
- **Ids** — `Math.random()` produced a small space and collisions were unchecked.
  Now `crypto.randomUUID` with a wider fallback.
- **Performance** — the field scan is cached instead of re-run per keystroke;
  edits use a minimal-span diff; decoration building has fast paths.
- **Stylesheet** — 44 dead rules removed, 31 KB → 27 KB.
- **Build** — `src/main.js` → minified `main.js` via esbuild. Readable source and
  its comments were previously shipped as-is.
- **Tests** — the full suite, run with `npm test`.
- **CI** — builds, tests, and fails if the committed `main.js` does not match
  what the source produces.
- **Docs** — field reference, file format, architecture, development, release
  process, and a candid list of known limitations.

### Known limitations at release

[`docs/known-limitations.md`](docs/known-limitations.md) is part of this release,
not an afterthought. In short: the tests run in jsdom and never in Obsidian, so
real layout, pointer drag, modal display, clipboard permissions, RTL, mobile and
themes are unverified by any assertion. Three regressions in this release passed
every automated suite and were found only by using the plugin.

[0.1.0]: https://github.com/alixxloo/structured-cards/releases/tag/0.1.0