# Architecture

A map of the code, and the reasoning behind the parts that are not obvious.

---

## Shape

```
src/main.js        everything: parser, serialiser, renderer, commands, settings
build.mjs          esbuild: src/main.js -> main.js, minified, externals kept
styles.css         all styling
tests/             24 suites, 1326 assertions
```

`src/main.js` is one file because the plugin began as one file and splitting it
would mean a module system, which a plugin loaded by a bare `require()` does not
have for free. Internal boundaries are marked by comment banners instead:

| Region | Responsibility |
| --- | --- |
| Escaping helpers | `fg` / `fug` (body lines), `z` / `B` (inline), `needsBlock` |
| Parser | `Q` — one `structured-field` block → object |
| Serialiser | `W` — object → one block |
| Scanner | `R` — find every block span in a document |
| Legacy parse/serialise | `ft` / `mt` |
| Move engine | `Ct` — ordered field moves with minimal-span edits |
| Layout | `ke` — resize maths, `Bt` — resize handles |
| Renderers | `Et` (field), `Fe` (legacy card) |
| Controls | `yt` (plain auto-growing), `fieldValueControl` (typed) |
| Modals | `ConfirmModal`, `NumberPrompt`, `TextPrompt` |
| Plugin class | `dt` |

**These names are terse because the file was recovered by de-minifying a build.**
They are stable identifiers, not meaningful ones. New code uses readable names;
see [`development.md`](development.md).

---

## Data flow

### Reading

`R(doc)` finds block spans once. Everything downstream that needs to know "is
there a field here, and which one" uses that scan instead of re-parsing. The
scan is cached per document and invalidated on edit — the keymap path used to
re-scan on every keystroke.

Overlapping spans are tolerated rather than throwing. They cannot be produced by
the writer, so if two of them appear the document was hand-edited; rendering it
is more useful than crashing.

### Rendering

A field renders through `Et`:

1. Build the wrapper, honouring `width`, `align`, `direction`, `hideLabel`.
2. Pick a control through `fieldValueControl`.
3. Wire save-on-blur, save-on-`pagehide`, and the unsaved-changes flag.
4. Register the field in `nt` so the drag, resize and menu paths can find it.

**Direction is written twice, on purpose.** Each auto-growing wrap gets the
HTML `dir` attribute *and* an `sc-dir-rtl` / `sc-dir-ltr` / `sc-dir-auto`
class. The attribute is the machine-readable form (inherited by the control
inside, and what `dir=auto` content detection rides on); the class is CSS
armor: an attribute only produces UA-level rules, and a vault can run a second
direction plugin whose author-level CSS (here: `.is-rtl div { direction: rtl;
unicode-bidi: unset }` from *RTL Support*) would otherwise force its own value
through every wrap. The stylesheet re-asserts the class (`!important`), pins
structural divs and the measure mirror to LTR, and gives armored plugin hints
their own LTR `::placeholder` placement inside RTL fields. Armored hints are
marked with `sc-hint-ltr` only while they show, never for user placeholders.

`applyTitleAlign` covers the field label **and** every title item's text box
(the `title-text` row's title included, its text value excluded): on an item
card the title the user reads lives in its own box, so the menu's Title
alignment must reach it too.

`updateDOM` reuses the existing DOM when the field's **shape** has not changed,
and rebuilds it when it has. The shape fingerprint (`Nt`) covers the label
hiding flag, the item kinds and everything the field menu edits that changes
*which control* is on screen: `type`, `direction`, `align` and the `options` a
select redraws from. It deliberately does **not** include the value, the width
or the height: those are patched on the reuse path (`wt` re-applies the
geometry, control refreshes re-read the value). The shape comparison is the
part that matters — reusing the node when the shape changed left the old value
on screen (self-audit), and the earlier fingerprint excluding type, direction
and alignment made field-menu saves keep a stale control until the note was
reopened (reported from Obsidian, fixed this release).

### Settings reach the screen

`saveSettings()` saves and calls `refreshRenderedCards()`: reading views
re-render through `previewMode.rerender(true)` (the public
`MarkdownPreviewView.rerender`), and editor views receive the plugin's
`ScRefresh` effect. Each live CodeMirror editor registers itself with the
plugin while its view plugin is alive (`plugin.editorViews`), so the dispatch
goes straight to the instance; the older hop through `MarkdownView.editor.cm`
— a property Obsidian never documented — remains only as a fallback. The
decorations state field rebuilds on that effect (or a doc change); widgets
whose `renderKey()` — the flat tuple of the seven render options, which
includes `defaultDirection` — is unchanged keep their DOM, so only what the
toggle affects is rebuilt, and the base direction switch is visible without
touching a note.

`Diagnostic logging` (`debugLogging`) is deliberately **not** a settings-tab
row: the diagnostic wraps six core Obsidian methods and slows navigation, so it
lives in `data.json` only.

### Writing

- **Reading view** → a save path that replaces only the block's span.
- **Editor commands** → `applyDocEdit`, which diffs and replaces the minimal
  span covering old and new text.

Both paths preserve the note's line-ending style.

---

## Typed controls

The rule that governs `fieldValueControl`:

> A typed control is only used when it can actually show the stored value.

`<input type="number">` silently discards a value it cannot represent. A
`<select>` shows nothing when the stored value is not among its options. In both
cases the note's text would disappear from the UI while still being in the file
— the worst kind of bug, because it looks like data loss and is not.

So `number` falls back to a text control when the value is not finite, and
`select` injects an unlisted stored value at the top of its option list. In the
original build neither guard existed: every type rendered as the same plain
textarea, so `select`, `number`, `url`, `code`, `tags` and `multiline` were inert
and `options:` was never read at all.

---

## Compatibility shims

`minAppVersion` is 1.5.0. That is a claim about a browser this code has never run
on, so the version-gated APIs are shimmed and the shims are tested:

| Shim | Gate | Fallback |
| --- | --- | --- |
| `clonePlain` | `structuredClone` needs Chrome 98 | Recursive deep copy that preserves explicitly-`undefined` keys, so `"x" in obj` behaves identically |
| `color-mix()` declaration | needs Chrome 111 | A flat `rgba()` declared first; the modern value overrides it where supported |

`compat.cjs` forces the `structuredClone`-absent branch inside a `vm` sandbox and
diffs its output against the native clone. Without that test the fallback would
be untested code shipping to every user — which is exactly what a shim is.

---

## Diagnostics

The previous build shipped a debug harness that ran in every user's vault and
logged to their console. It is now behind `debugLogging`, which defaults to
**off** and is not exposed in the settings tab.

This is the one setting in `data.json` that exists only for the plugin's own
debugging.

---

## Accessibility

- Drag handles, menus and resize handles are reachable by
  keyboard, with `aria-label`s.
- Resize handles respond to arrow keys in 16px steps (48px with Shift).
- `Enter` on a resize handle resets the size to auto; double-click does the same.
- The secret reveal toggle is a `role="button"` with `tabindex="0"`, operable
  with `Enter` or `Space`.
- Labels are associated with their controls via `for` / `id`.
- Resize handles expose `aria-valuenow`.
- Legacy card widgets set `ignoreEvent()` to `true` — returning `false` made
  CodeMirror consume clicks that belonged to the card.

---

## Native dialogs

Confirmation, number and text prompts were native `window.confirm` /
`prompt` dialogs. In Obsidian those are inconsistent across platforms, can be
suppressed, and look nothing like the app. They are now three small modals that
inherit the plugin's styling.

---

## What is deliberately not done

- **No shadow DOM.** Isolating styles would break every user theme that
  customises `.markdown-preview-section`. The plugin's classes are all prefixed
  `sc-` / `structured-cards-` to stay out of the way instead.
- **No per-field database.** See [`file-format.md`](file-format.md#why-fenced-code-blocks).
- **No development of `structured-card`.** Frozen, not removed.
- **No `defaultLayout` / `defaultSize` / `defaultDensity` / `defaultGap`.** They
  were read by nothing. The prune pass removes them from existing `data.json`
  files so old vaults stop carrying dead keys.