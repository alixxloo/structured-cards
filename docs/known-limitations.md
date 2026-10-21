# Known limitations

Everything the automated tests cannot reach, stated plainly. Read this before
filing a bug that says "it doesn't work" — one of these may already explain it.

---

## The tests are jsdom, not Obsidian

The full suite runs in Node with jsdom, a mocked vault, a mocked `Editor` and
a mocked CodeMirror. **None of them is Obsidian.**

That means the following are verified by nothing but manual testing:

| Area | Why it is unverified |
| --- | --- |
| Real layout and CSS cascade | jsdom does not lay out. No computed widths, no reflow, no flexbox. |
| Real pointer drag and resize | jsdom has no pointer events and no real geometry. The maths is tested; the interaction is not. |
| The three replacement modals opening | `ConfirmModal`, `NumberPrompt`, `TextPrompt` are constructed and called; whether Obsidian's modal layer renders them correctly is not. |
| Clipboard permissions | The write is wrapped in a guard and the guard is tested. Whether the browser grants it is not. |
| RTL layout | `direction` is asserted as a value reaching the DOM for every control — including the typed ones (`select`, `number`, `url`, `secret`, `multiline`, `code`) — wraps also carry it as `sc-dir-*` classes re-asserted at CSS author level, and plugin hints keep their own LTR line placement. All of this survives a foreign direction plugin that writes `direction` on every div; the visual result in a real vault — where the glyph order, alignment and caret sit — is still only human-verifiable. |
| Mobile | `isDesktopOnly: false`, untested on any device. |
| Light / dark themes | No theme was loaded. |

Three regressions in this release — a duplicated whole document, a dead
context-menu button, and `updateDOM` leaving a stale value on screen — passed
every automated suite and were found only by running the plugin. Treat the
suites as a floor, not a ceiling.

---

## `minAppVersion: 1.5.0` is unverified

The two version-gated APIs are shimmed and the shims are tested
(`clonePlain`, and the `rgba()` fallback under `color-mix()`). But nobody has
loaded this plugin in Obsidian 1.5. Stating the floor in `versions.json` is
honest about the *code*; it is not the same as having tested it.

If you are on an old version and something breaks, that is a bug — please report
it.

---

## Data-model limits

### `validation:` does nothing on `number` and `url`

`validation` is applied as the HTML `pattern` attribute. Every current browser
ignores `pattern` on `<input type="number">` and `<input type="url">`. So on
those two types the key is inert.

### `required:` is not enforced

It sets an attribute. There is no form and nothing to submit, so nothing rejects
an empty required field. It is semantics and styling.

### `height:` on `number`, `url`, `select`, `secret`

Applied as the `--sc-field-height` custom property. Those four controls are
fixed-height inputs, so the property has little to act on. It matters for
`multiline` and `code`.

### `align:` accepts three values

`start`, `center`, `end`. Anything else silently becomes `start` — including
`stretch`, which is a reasonable thing to type. It styles the title only,
applied as `text-align` on the title's wrap, at build and on the reuse path.

### The settings tab's `Default text direction` is the base, not a master

RTL/LTR there applies to every field left on Auto, and it is also the direction
new fields start with — so flipping it moves the cards already on screen. A
field that declares its own `direction:` in the note keeps that. The factory
`Auto` meaning is unchanged: each field follows its own content. A defaults
like this cannot win over an explicit per-field choice, and none does here.

### Plugin hints are LTR islands, your text is not

The pre-typing hints (`Title`, `Type here…`, and so on) are plugin-owned
English strings; they are wrapped in Unicode LRI…PDI isolates so they keep
reading LTR inside RTL cards, and while one is showing its box is marked
`sc-hint-ltr` so the placeholder keeps LTR reading at the left edge even when
the card is RTL. This is render-only: the isolates never reach the note, and
they never wrap text you typed — placeholders you set yourself are rendered
exactly as you wrote them, at the direction your field declares.

### The interplay with a separate RTL/direction plugin

A second direction plugin can be installed in the same vault (here: *RTL
Support*, `obsidian-rtl`). Its stylesheet applies `direction` to plain `div`
elements under its own container classes, which at CSS author level would beat
a bare `dir` attribute. This plugin therefore re-asserts each wrap's resolved
direction as author-level rules (`sc-dir-rtl` / `sc-dir-ltr` / `sc-dir-auto`
with `!important`) and pins its structural boxes and mirrors to LTR, so the
two plugins cannot fight over the cards. The other plugin still owns the
paragraphs of the note itself; only the cards are defended. Old-format
(legacy) card templates are not defended — their value divs will still follow
whatever the other plugin writes.

### Link: `debugLogging` is a data.json diagnostic

It is not a settings-tab row (wrapping six core Obsidian methods slows
navigation). Set `"debugLogging": true` in `data.json` when a session needs it;
see [`architecture.md`](architecture.md) under Diagnostics.

### `tags` is not a tag system

A comma-separated string in a text control. No chip rendering, no tag
autocomplete, no tag database, no link to `#tags`.

### `url` has no open button

`<input type="url">` gives you validation and nothing else.

---

## Format limits

### Hand-written triple backticks split the block

The writer escapes body lines that begin with ```` ``` ```` so it cannot close
its own fence. If you type a raw ```` ``` ```` into a block body by hand, the
block splits and the content after it renders as Markdown. Write `` \` ``
instead. See [`file-format.md`](file-format.md#escaping).

### Two consecutive backslashes are normalised

Because backslash escaping exists to make backtick escaping unambiguous, a body
line containing `\\` is rewritten to `\` on the next save. This is the only lossy
normalisation in the format.

### Mixed line endings are preserved, not fixed

The writer matches the note's existing style and does not rewrite lines it did
not touch. A note that already has mixed endings keeps them.

---

## Saving

### No `beforeunload` prompt

An uncommitted value is written on `focusout`, and as a backstop on `pagehide`.
There is no "you have unsaved changes" dialog. In practice `pagehide` is
reliable on normal closes, but it is not a guarantee — force-killing Obsidian
while a field is focused can lose that value.

### Writes happen on every keystroke for `multiline` and `code`

Those two commit on every input event, debounced by the save path. A vault on a
sync tool may see a lot of file churn while you type.

---

## Scope

- `structured-card` is **frozen**. It renders, it moves, it saves. No new
  features. Bug fixes only.
- No mobile testing has been done. `isDesktopOnly: false` is a claim.
- No theme testing has been done beyond the default.
- Single vault only. There is no cross-vault sync logic beyond whatever your
  sync tool does to plain text.