# Release notes for 0.1.0 — the full audit trail

This is the detailed record behind
[`CHANGELOG.md`](../CHANGELOG.md#010--first-public-release). Nothing here is
summarised away: every defect, every correction of a wrong finding, and every
limit of the verification are stated.

It exists because "we fixed some bugs" is not a reviewable claim. This is.

---

## How this release was produced

The plugin arrived as a minified `main.js` with no source and no build config.
Recovering readable source meant de-minifying it, which was verified for
functional parity against the original build first (`parity.cjs` re-runs
identical probes against both and diffs the results).

The de-minified file then went through five review rounds:

| Round | Focus | Defects found |
| --- | --- | --- |
| 1 | Full static audit | 27 |
| 2 | Re-read of the changed code | 4, three of them in round 1's own fixes |
| 3 | Reported from inside Obsidian | 1 regression |
| 4 | Self-audit, written to attack rounds 1–3 | 4, all introduced by earlier rounds |
| 5 | Publication readiness | 0 defects, 7 structural changes |
| 6 | Directions, hint bidi and both settings surfaces, reported from Obsidian | 6, plus design corrections listed in the round itself |

**The full test suite.** `npm test`.

---

## Round 1

### Data loss / silently broken features

**A ` ``` ` inside a value truncated the field.** `W()` indents block bodies by
two spaces, and CommonMark allows up to three spaces before a closing fence, so a
stored ``` ended the code block. The processor received `"…value: |\n  before"`,
the value became `"before"`, and the rest leaked out as Markdown. Added
`fg()`/`fug()` to escape backticks on any body line that could be read as a
fence, applied in `W()` and reversed in `Q()`.

**A value of exactly `|` became empty.** `value: |` is parsed as the start of a
block scalar. Added `needsBlock()`, now used for both `label:` and `value:`.

**`Move item down` did nothing.** `V()` decremented the target index when moving
downwards, which cancelled the move for every item. Removed the decrement and
documented the slot semantics.

**Moving one member of a row destroyed the row.** `Ct()` stripped the moved
field's `row:` unconditionally, so dragging one half of a two-field row silently
dissolved the layout. The moved field now joins the target row.

**Blank lines piled up on every move.** Removing a block consumed only its
terminating newline, merging the blank lines on either side. The extra separator
is now swallowed, and row members are inserted tightly.

**`ke()` could produce `width: 0px`.** Added `MIN_FIELD_WIDTH = 60`.

**Duplicate kept the original's row id.** `_t()` regenerated the field id but
not `row:`, unlike `He()`. Now consistent.

**`mt()` wrote the literal string `undefined`** as a card title when a card
object lacked `title`/`layout`/`size`/`density`. All four are now validated.

**CRLF notes got mixed line endings on every save.** `saveReadingBlock` searched
for all three newline variants but always substituted the LF-only serialiser
output. The replacement is now re-encoded to match.

### Features that parsed and saved but did nothing

`type:` was never read by the renderer — all eight types rendered as the same
plain textarea, and `options:` was ignored entirely. Added `fieldValueControl()`:

| `type:` | Control |
| --- | --- |
| `select` | `<select>` built from `options:` |
| `number` / `url` | typed `<input>` |
| `secret` | masked `<input>` + reveal toggle, seeded from `revealSecrets` |
| `multiline` / `code` | `<textarea>`, code monospace with spellcheck off |
| `tags` | text input with a comma hint |
| `text` | existing auto-growing input |

`prefix`, `suffix`, `help`, `required`, `default`, `validation` are now rendered
and editable — the field settings modal gained controls for all of them plus
`type`, `align` and `copyable`.

**There was no copy button at all** in `structured-field` — only the legacy card
had one, so `copyable` / `showCopyButtons` / `copyNotice` had nothing to act on.
One now exists, keyboard-operable, and clipboard writes go through a guarded
`copyText()` (the old fire-and-forget `await` produced unhandled rejections).

A `secret` **item** inside a non-secret field was not masked, because the default
only considered the field type. Fixed, and `masked: false` now persists for
item-level secrets.

`title-text` items rendered side by side; the CSS wrapper for stacking them
existed but `Fe()` never built it. `multiline` and `url` items now get real
classes. `titleStyle.direction` was overwritten on every keystroke.

### Settings that did nothing

`showEditingControls`, `showDragHandles` and `responsive` were hardcoded `true` in
`renderOptions()`. All wired up, with toggles. `copyNotice`, `animations`,
`defaultDirection`, `revealSecretsByDefault` and `snapGuides` now reach the main
renderer instead of only the legacy card.

`defaultLayout`, `defaultSize`, `defaultDensity` and `defaultGap` were declared
but referenced nowhere. Removed, and pruned from existing `data.json`.

The three chrome flags default to `true` so that first-run appearance is
unchanged from the previous build.

### Debug instrumentation shipped enabled

`installP0Open()` monkey-patched six core Obsidian methods (`openLinkText`,
`setActiveLeaf`, `setViewState`, `getAbstractFileByPath`, `getFirstLinkpathDest`,
`openFile`), added global `error` / `unhandledrejection` listeners, built an
`Error().stack` on every "empty target", and wrote to the console on every load
and every editor view.

All of it now sits behind a new **Diagnostic logging** setting, off by default
and not exposed in the settings tab.

### Performance

- `moveField` / `moveFieldToPosition` replaced the whole document
  (`from: 0, to: length`). Now diffed to the minimal span — this was also
  breaking collaboration and cursor mapping.
- The drag hit-test called `R(doc.toString())`, parsing the entire note on every
  pointermove. Cached, invalidated on document length change.
- `buildDecorations` and the Backspace/Delete handlers skip the scan entirely for
  notes with no blocks (`includes("```structured-")`).
- `Pt()` is skipped when there are no fields.
- Decoration ranges are now de-overlapped, so two independent scans can no
  longer make `RangeSetBuilder.add()` throw and blank the editor.
- `qt()` capped at 500 blank lines; dropping a field past the end of a note
  could append hundreds. Now 3.
- Ids use `crypto.randomUUID()` instead of an 8-char `Math.random()` slice.

### Accessibility

- `sc-field-drag`, `sc-item-drag` and `sc-item-menu` were `role="button"`
  `tabindex="0"` with **no keyboard handler** — the item-actions menu was
  unreachable by keyboard. All three respond to Enter/Space.
- Resize handles were focusable but inert; Enter only reset them. Arrow keys now
  resize in 16px steps (48 with Shift), with `aria-valuenow` and
  `aria-orientation`.
- Native `confirm()` / `prompt()` replaced with `ConfirmModal`, `NumberPrompt`
  and `TextPrompt`. `prompt()` could not hold multi-line template JSON.
- The legacy card's `<label>` is a sibling of its input with no `for`, so
  clicking the text never focused the field.
- The legacy card widget returned `ignoreEvent() === false`, letting CodeMirror
  handle events over contentEditable titles and inline inputs. Now `true`, like
  the other block widgets.
- **Insert field no longer clobbers the selection** — `replaceSelection()`
  overwrote whatever was highlighted. Inserts on its own line, and appends after
  the current field if the caret is inside one.

### Stylesheet

31,323 → ~27,000 bytes. Removed 44 dead rules: the entire `sc-builder-*` family
(25 classes, 62 rule references — a card-builder UI that exists only in CSS) and
`sc-option-row`. Zero dead classes remain; every class `main.js` emits has a rule.

---

## Corrections to the original review

Two reported findings were wrong and are **not** fixed, because there was nothing
to fix. They are recorded here rather than quietly dropped.

- **Resize did not write the file per pointermove.** `Bt()`'s local `a()` only
  applies the CSS variables and requests a measure; the save happens once on
  pointerup via `A(!0)`. The original reading conflated `a()` with the save
  callback.
- **`Nt()` shape-key collision was not a bug.** `items: undefined` with no value
  and `items: []` both render zero rows, so sharing a key is correct, and
  `items: undefined` with a value deliberately matches a real
  `[{kind:"text"}]`. A change made here would have *reduced* CodeMirror DOM reuse.

---

## Round 2

A fresh pass over the changed code, plus new suites, found four more defects —
**three of them in the fixes themselves.**

**`insertField` duplicated the whole document.** The replacement `insertBlock()`
called `editor.getCursor("from")` — which returns a `{line, ch}` **Position**,
not an offset. Slicing with it produced `NaN`, so the rewrite became
`replaceRange(text + wholeDocument, cursor, cursor)`.

Verified with a mock `MarkdownEditor`: a 67-byte note became 271 bytes with the
whole original text duplicated, and four inserts produced 15 fields. Rewritten to
resolve the caret with `posToOffset()`, and to append *after* the current field
when the caret is inside one.

**Malformed item lines silently became real items.** `ne()` used
`(t[0] || "text")`, so a typeless `item: |` parsed as an empty **text** item and
then re-serialised as `item: text|` — inventing content. An empty kind is now
rejected.

**Indented `item:` lines were parsed as metadata.** `  item: text|x` failed the
column-0 `startsWith("item: ")` test, fell through to the metadata branch, and
was written back as `item: text|x` — which then parsed as an item. Malformed
input changed meaning across a save. Item lines are now recognised regardless of
indent.

**Custom keys could corrupt the block.** Metadata was re-emitted verbatim, so a
key that was not a plain identifier — or a value beginning with ``` — produced
a block that truncated on the next parse. Restricted at the time to
`^[A-Za-z][\w-]*$` keys with values that cannot close the fence.

Also removed a dead `let d = t.sections[e]` in `fe()`.

ESLint with `no-undef`, `no-unused-vars`, `no-dupe-keys` and friends reports
**0 errors**; the three remaining warnings are the new modals, which are used
through the `obsidian` namespace and so are invisible to the linter.

The fuzz pass in `review3.cjs` (4,000 random bodies drawn from pipes,
backslashes, newlines, colons, backticks and fences) reports **0 throws and 0
unstable round-trips**.

---

## Round 3 — reported from inside Obsidian

**`Add field` did nothing, from both the context menu and the command palette.**

This is a regression introduced by the `insertBlock()` rewrite in round 1. Both
entry points call `insertField()` → `insertBlock()`, so a shared failure points
at that function — and the 63-assertion mock-editor suite passed it.

Two changes:

- The insertion point is now passed as an `EditorPosition` from `offsetToPos()`
  instead of a bare numeric offset, which is the unambiguous form across
  `Editor` implementations.
- **Failures are surfaced instead of swallowed.** The whole reason this was hard
  to diagnose is that a throwing click handler produced no Notice and no console
  output — it just looked like a dead button. `insertBlock()` and the
  `editor-menu` item now both catch, `console.error`, and raise a Notice naming
  the message. `editor-menu` also fires outside an editing view, where there is
  no editor at all, so the item is now skipped there instead of throwing on
  `undefined`.

**Lesson recorded:** a mock `Editor` is not the real `Editor`. Every suite passed
and the bug shipped. Failure paths in editor-facing code must never be silent.

---

## Installation note

Never place a plugin backup **inside** `.obsidian\plugins\`. Obsidian scans every
subdirectory of that folder for a `manifest.json`, so a backup sitting next to
`structured-cards` was loaded in preference to the newer build — two folders with
the same `id`, and a baffling "my version is stuck" bug. Backups belong in
`.obsidian\plugin-backups\` or outside the vault entirely.

---

## Round 4 — self-audit of my own changes

A pass written specifically to attack rounds 1–3. It found four defects, **all
introduced by the earlier rounds**, three of them by the very changes that
"fixed" other bugs.

**`Add field` regression** — see round 3.

**Copy copied an empty string for every item-based field.** `W()` writes no
`value:` line when a field has items, so `field.value` is empty until something is
typed. Added `fieldText()`, which mirrors `st()` without mutating, and the copy
button now uses it.

**A typed control could hide data the note already contained.**
`<input type="number">` silently discards a non-numeric value, and a `<select>`
shows nothing when the stored value is not among `options:`. Both rendered as
*empty fields* where the previous build had shown the text in a textarea — data
invisible in the UI.

A typed control is now only used when it can represent the stored value;
otherwise the plain control is used. A `select` also gains the stored value as an
extra option when it is missing from the list.

**Custom metadata keys were being dropped.** The round-2 fix for a key that could
corrupt the block filtered keys to `^[A-Za-z][\w-]*$`, which silently discarded
`author.name`, `my key` and anything with a dot on the next save. Dots, dashes,
underscores and spaces are all safe — the parser splits on the first colon and
trims the key. Only an empty key, a reserved key, the literal `item`, a key
starting with ``` , and a value that could close the fence are dropped now.

**`fieldValueControl()` lost its `return`.** In the middle of fixing the two
above, a `return` was dropped from the `text`/`tags` branch. The control was still
built, so every test that only looked at the DOM passed — but `Et()` never
received the handle, so its refresh hook was never registered and `updateDOM`
left a **stale value on screen** for every `text` field.

`review5.cjs` now asserts directly that each branch returns a usable handle.

---

## Round 5 — making it publishable

Not defects, but everything that has to be true before other people can install
this. Each item is a change with a test behind it.

**`main.js` was readable source, and that is not shippable.** Obsidian downloads
`main.js` straight from the GitHub Release. Comments and readable names were going
to every user, and the file was 124 KB. Added `build.mjs` (esbuild, `obsidian` and
`@codemirror/*` left external because Obsidian injects them). Source moved to
`src/main.js`; the artifact is now 75 KB and reproducible.

Because minification renames every internal binding, the detailed assertions
cannot run against it — hence `artifact.cjs`, which exercises the shipped file
through its public methods only.

**`structuredClone` needed Chrome 98 while `minAppVersion` claimed 1.5.0.**
Fourteen call sites. Rather than quietly raising the floor and locking out users,
all fourteen now call `clonePlain`, which defers to the native clone and
otherwise deep-copies JSON-shaped data, keeping explicitly-`undefined` keys so
`"x" in obj` behaves identically. `compat.cjs` forces the missing branch in a VM
sandbox and diffs its output against the native clone.

**`color-mix()` needed Chrome 111** for the drop placeholder. Given a flat
`rgba()` declaration first; the modern value overrides it where supported.

**Insert could split a line in half.** With the caret in the middle of `hello`,
`insertBlock` wrote the block between `he` and `llo`. It now snaps to the line
boundary — inserting below the line you are on — for both LF and CRLF, and
`tail` is only emitted when the following text is not already on its own line.

**Required repo files were absent.** Added `versions.json`, `README.md`, MIT
`LICENSE`, `.gitignore` and `package.json`. Deleted the stale `data.json`: it is
per-install state and is now ignored, so a fresh clone starts on defaults instead
of one person's settings.

**The test harness lived in a temp directory** with absolute paths to the
author's machine, so nobody else could re-run it. Moved into `tests/` behind
`paths.cjs`, added `jsdom` as a real devDependency, and `npm test` now runs every
suite in a separate process and prints one total.

### What publication readiness is still based on

`minAppVersion: 1.5.0` is a claim about a browser this was never run on. The
only version-gated APIs in the plugin are now shimmed and tested, but nobody has
loaded this in Obsidian 1.5. Stating it in `versions.json` is honest about the
code; it is not the same as having verified it.

See [`known-limitations.md`](known-limitations.md) for the full list.

---

## Parity with the previous build

`parity.cjs` re-runs 120 identical probes against the untouched original and the
current source and diffs the results. **27 lines differ**, and every one is
either an intended fix or a randomly generated id. There is no incidental
behaviour change hiding in the refactor.

```sh
node tests/parity.cjs <path-to-original-0.8.0-main.js>
node tests/parity.cjs src/main.js
# then diff the two outputs
```

The original is not committed. Run this before you throw your copy away.

---

## Round 6 - reported from inside Obsidian, then a line-by-line review

Everything below was found by running the plugin, not by reading it, or by a
line-by-line read of the source afterwards.

### Defects reported while using it

- **Item buttons collided with the card's own buttons.** Both sets of controls
  occupied the same band above the field. The item's controls now live inside the
  item and the field's live in the field's padding, which are different boxes.
- **The "..." menu on an item wrapped a single Delete action.** Replaced by a
  direct delete button in the shell's gutter.
- **The drag handle was a grip floating above the item**, which put it in the
  field's control band. Replaced by a small centred line inside the item.
- **An empty card showed nothing at all.** Empty title and text items now carry
  display-only hints, on the `placeholder` attribute, so they vanish on the first
  keystroke and can never reach the note.
- **Items reacted to the pointer during a drag.** The pointer was never captured,
  so the browser kept hit-testing it and `:hover` followed it from item to item,
  changing the cursor and lighting up whatever it crossed.
  `setPointerCapture` now runs for the whole of every drag.
- **The drop line was never drawn in the reading view.** The pointermove handler
  handed the painter a `DOMRect` where it expected an element, which threw, so
  the line stayed hidden while the card still moved.
- **Cards travelled short when dragged down.** The editor's hit-test gated
  "before" and "after" on the pointer being horizontally inside the target, so any
  x past a narrow card's edge turned a straight downward drag into a row join.
- **A toggle in the settings tab flipped and nothing else happened.** `saveSettings`
  wrote `data.json` and stopped. Worse, the editor's widgets compared only their
  source text and offsets, so even a forced re-render would have kept the stale
  DOM.

### Found by review, each proven before fixing

Five more, found by reading the source line by line. Each was turned into a test
first; one of them turned out to be a *mistake in the review* rather than a defect,
and that is recorded below rather than quietly dropped.

1. A deliberate blank line before trailing text was deleted on every move.
2. A "beside" drop between two cards already in one row was suppressed as a
   no-op - and the refusal fell through to the vertical branch, which answered
   with a move the user had not asked for.
3. On a "beside" move the phantom-`value:` strip was aimed at the target instead
   of the moved card.
4. A discarded editor drag failed in silence, with no Notice, unlike the reading
   view.
5. No settings change ever reached the screen (see above).

The first attempt at the test for #2 was itself wrong: it dragged onto the *left*
half of the neighbouring card, which genuinely is a no-op, and the hit-test was
right to refuse. The assertion was moved to the right half.

One review claim was corrected rather than fixed. It said a "beside" move took a
real `value:` from the target. It does not: the strip only matches an empty
`value:`, because it requires end-of-line immediately after the colon. The
defect is real but it is cosmetic noise, not data loss.

### What that means for a reader of the tests

The editor's drag now has a mocked CodeMirror behind it and a sweep across pointer
positions, and the reading view has an end-to-end sweep of line-against-file. Both
are better than nothing and neither is Obsidian. See
`docs/known-limitations.md`.---

## Round 6 — directions, hint bidi, and both settings surfaces

Reported from inside Obsidian after round 5: "RTL, LTR and auto are broken; the
pre-typing hints are English yet render right-to-left; the settings look like
nothing works — check the main tab and the per-field menu, prune the dead rows
and make the rest apply." Every claimed defect in this round is proven by an
assertion in `direction.cjs` before the fix, against the same renderer the
editor and reading view run.

**Typed controls had no direction of their own.** The field root is forced LTR
on purpose (geometry: widths, offsets and rows are all left-to-right math), and
each control is supposed to carry its own `dir`. The auto-growing control did;
`select`, `number`, `url`, `secret`, `multiline` and `code` did not. Their
values inherited the LTR envelope, so a Persian secret or multiline value sat at
the left edge of its own control while its title and items flowed right. Every
typed control now carries `dir`, follows the value while typing (`oninput`),
re-applies on change, and exposes a `refresh` so the reading-view reuse path
re-syncs both value and direction.

**Auto resolved from the first RTL run, not from the first strong character.**
The detector looked for RTL only when the string *opened* with Persian (after
neutrals), then fell to a URL check. A mostly-Persian line that opened Latin,
like `delete my س`, or carried a URL, like `یادداشت ببین https://x.com` written
after a Latin prefix, resolved to the wrong base or to `auto`. Detection now
scans for the first strong directional character anywhere and ignores a URL
that is not itself the first strong content (a URL starts with a letter, so
first-strong already answers it).

**English hints rendered right-to-left inside RTL cards.** A hint is English
text shown in a control whose base direction belongs to the field — deliberately
RTL in a Persian card — so the hint's punctuation and ellipsis landed on the
wrong side of the line. Plugin-owned hints are now wrapped in LEFT-TO-RIGHT
ISOLATE … POP DIRECTIONAL ISOLATE (U+2066/U+2069) at the single point they are
produced (`itemHint` and the tags fallback), which paints each hint as its own
LTR paragraph wherever it shows, without touching the control's direction for
typed values. User-owned strings — `placeholder:`, `default:`, option labels —
are never wrapped, and nothing serialized can contain isolates because the
serialiser never reads hints.

**A settings change never reached an open editor.** The decorations state field
rebuilt only when `update` saw `docChanged`; an empty `dispatch({})` produced a
transaction that rebuilds nothing, so live-preview widgets kept their old
options after flipping anything in the settings tab. (The reading view already
re-rendered correctly via `previewMode.rerender(true)` — verified against the
official API typings: `MarkdownView.previewMode` is a `MarkdownPreviewView`
with `rerender(full?: boolean)`.) The plugin now defines a `ScRefresh`
CodeMirror effect: `refreshRenderedCards` dispatches it into every open
editor's view, the state field treats it as "rebuild now", and widgets whose
render key is unchanged keep their DOM.

**The field menu's saves left stale DOM in reading mode.** The reuse
fingerprint (`Nt`) covered only the item kinds and the label-hidden flag — the
architecture document *claimed* it covered type, options and direction, which
was not true. So changing a field's type through the menu kept the old control
on screen until the note was reopened, and direction or alignment saves looked
like no-ops. The fingerprint now covers `type`, `direction`, `align` and
`options`, so those edits rebuild the field; value-only edits still patch in
place, which is what the reuse path is for.

**Two rows in the field menu could only mislead.** `Title alignment` was parsed
and serialized but read by nothing — it now styles the title, at build and on
the reuse path. And the field menu offered every scalar-only control to item
cards, where each silently did nothing; for an item card the modal now hides
type, placeholder, options, default value, validation and required, and states
in a note that rows are edited on the card itself. The settings tab's one
decorative row — `Diagnostic logging` — is gone from the tab as the
architecture document already described it; the diagnostic still exists behind
`debugLogging` in `data.json`.

**Red-first accounting.** The new `direction.cjs` suite ran against the unfixed
source and failed 28 assertions (26 passes were deliberate green controls);
after the fixes it passes 56, and the full current totals are stated at the top
of this document. No other suite regressed.

**Follow-up report — the switch looked dead, and the editor hop was opaque.**
Re-testing in Obsidian still showed nothing happening: the plugin had not been
reloaded, and two real limitations remained even after it is. (1)
`Default text direction` only seeded new fields, so flipping it could not move
existing cards; it is now the base direction of every field left on Auto —
RTL/LTR applies immediately through the same refresh effect, explicit
`direction:` still wins, and `Auto` keeps content detection (`effectiveDir`).
(2) Reaching a live editor went through `MarkdownView.editor.cm`, a property
Obsidian never documents; live views now register themselves with the plugin
and the refresh dispatch is sent to them directly, with the old hop kept as a
fallback. Red-first: the follow-up additions to `direction.cjs` ran against the
unfixed source and failed 17 assertions (18 were added for the round, 1 as a
deliberate green control); after the fix the suite passes 73, 17 of them new.

**Follow-up 2 — a foreign direction plugin was overriding every fix.** The
vault runs "RTL Support" (`obsidian-rtl`) with its `Default text direction` on
RTL. That plugin labels each note container with `is-rtl`/`is-ltr` and its CSS
says `.is-rtl div { direction: rtl; unicode-bidi: unset }` — author-level CSS,
which an HTML `dir` attribute (UA-level) can never beat. It therefore overrode
every direction this plugin set: auto-growing wraps were force-RTL'd, LTR
fields glued themselves to the right edge, and hints sat against the wrong
edge, which is exactly why the round above looked like it did nothing after a
restart. The final fix re-asserts each wrap's resolved direction at author
level (`sc-dir-rtl` / `sc-dir-ltr` / `sc-dir-auto` with `!important`), keeps
structural boxes layout-LTR, makes the mirror follow its wrap, and gives
armored plugin hints their own `::placeholder` LTR line placement so an
English hint reads left-to-right at the left edge even inside RTL fields.
Red-first: `"direction.cjs"` gained 14 asserts (10 failed against the unfixed
source, 4 were deliberate guards); it now passes 87, and the release totals
1305 across 24 suites.

**Follow-up 3 — title alignment never touched the title the user reads.** On
an item card, `align:` centered the small field label while the actual title
sits in its own full-width item box, which never received the alignment —
"وسط‌چین و راست و چپ تایتل وجود دارد ولی عمل نمی‌کنه", confirmed and true.
The alignment now lands on the field label AND every title item's text box
(a `title-text` row's title included, its text value deliberately excluded),
at build and on the reuse path. The `Help text` row is removed from the
field menu as worthless per the report; `help:` already written into notes
still renders below the field, so old notes lose nothing. Red-first: 6 of the
8 new asserts failed against the unfixed source (2 were guards); the suite
passes 96 and the release totals 1314 across 24 suites.

---

## Notes for the next reviewer

- The internals are terse (`Q`, `W`, `R`, `Ct`, `ke`, `dt`) because the file was
  recovered from a minified build. They are stable and load-bearing for the test
  harness, and they are **not** meaningful. New code should use readable names.
- The suites run in jsdom. Read [`known-limitations.md`](known-limitations.md)
  before concluding that something is verified.
- Two findings in the original review were wrong and are documented as wrong.
  Round 3 and round 4 are both regressions introduced by earlier rounds. The
  track record is: automated suites missed three real bugs. Trust manual testing
  too.