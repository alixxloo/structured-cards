# Field reference

Every key a `structured-field` block understands, every type, and every
setting. This is the reference for the *current* format; the older
`structured-card` format is documented at the bottom.

---

## The block

````markdown
```structured-field
id: status
label: Status
type: select
width: 45%
options: todo, doing, done
value: doing
```
````

A field is a fence tagged `structured-field` whose body is `key: value` lines.
The parser splits on the **first** colon and trims the key, so keys may contain
spaces, dots, dashes and underscores.

---

## Keys

### Identity and layout

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `id` | string | generated | Stable key. Used to identify the field when moving, duplicating, and inside templates. Generated as a 32-character hex string when omitted. |
| `label` | string or block | `"Label"` | Text above the control. |
| `label-hidden` | boolean | `false` | Render the control without a visible label. |
| `type` | enum | `text` | See [types](#types). An unrecognised type makes the whole block parse as `null` — the fence then renders as plain code rather than a broken field. |
| `width` | percent | `100%` | Width as a percentage of the container. Clamped to a floor of 60px — see [`known-limitations.md`](known-limitations.md). |
| `height` | pixels | auto | Applied as the `--sc-field-height` CSS custom property. Negative and non-numeric values are dropped. |
| `offset` | pixels | `0` | Horizontal offset from the layout position. Negative values are clamped to `0`. |
| `row` | string | auto | Row identity inside a card. Regenerated on edit, so do not rely on its value. |
| `align` | enum | `start` | `start` / `center` / `end`. Anything else falls back to `start`. Styles the title only, as `text-align` on the title's wrap (applied at build and on the reuse path). |
| `direction` | enum | `auto` | `auto` / `ltr` / `rtl` for this field. Declared modes win outright; `auto` first takes the **base direction** from the settings tab (`Default text direction`) and follows the value's first strong directional character only when that is `auto` too. Typed controls follow the value while typing. |
| `items` | list | — | Emitted as `items: []` when empty. See [`item:` lines](#item-lines). |

### Content

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `value` | string or block | `""` | The current content. This is what gets written back to the file. |
| `options` | comma-separated list | — | Choices for `select`. Trimmed on parse. |
| `placeholder` | string | — | Hint shown while the field is empty. |
| `default` | string | — | Second hint: shown when no `placeholder` is set, and a template may seed it as the starting value for a new field. |

### Presentation

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `prefix` | string | — | Text rendered before the control. |
| `suffix` | string | — | Text rendered after the control. |
| `help` | string | — | Helper text under the control. |
| `title-size` | enum | — | `small` / `medium` / `large`. |
| `title-weight` | enum | — | `normal` / `bold`. |
| `title-color` | string | — | Any CSS colour. |
| `title-italic` | boolean | `false` | — |
| `title-direction` | enum | — | `ltr` / `rtl`, independent of the control. |

### Behaviour

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `required` | boolean | `false` | Sets the control's `required` attribute. |
| `validation` | string | — | Applied as the control's `pattern` attribute, with the same string as its `title`. See the caveat below. |
| `copy` | boolean | — | **Reserved, no longer used.** The copy button was removed in 0.1.0. The key is still accepted so that a note written by an earlier build keeps its line untouched instead of being rewritten as unknown metadata. |
| `masked` | boolean | depends | Whether a secret field starts masked. Defaults to `true` when the field type is `secret` **or** the field contains a secret item; otherwise `false`. Set `masked: false` to start revealed. |
| `secret` | boolean | — | Shorthand: a field is a secret when its type is `secret`. |

> **On `required` and `validation`.** These only set HTML attributes. There is no
> form to submit, so the browser enforces nothing on its own — they are styling
> and semantics, not validation logic. Worse, `pattern` is **ignored** on
> `<input type="number">` and `<input type="url">` by every current browser, so
> `validation:` on a `number` or `url` field does nothing at all.

### Custom keys

Anything else is preserved as **metadata** and written back verbatim, subject to
these rules — the writer drops a key only if it could not read back the same:

  Dropped   Why  
  ---   ---  
  Empty key   A stray `: value` line has no key  
  A reserved key   It would be read back as the reserved field, not as metadata  
  The literal `item`   Would be read back as an item line, not metadata  
  A key that looks like a fence   Would terminate the code block  
  A value starting with ` ```` ` or containing a newline   Same, plus the value would not survive the block  

Dots, dashes, underscores and spaces are all safe in custom keys:

````markdown
```structured-field
id: meta
label: Metadata
type: text
author.name: Someone
my key: another value
```
````

---

## Types

The control that renders is chosen from `type:`. The rule behind the choice is
in [`architecture.md`](architecture.md#typed-controls): **a typed control is
only used when it can actually show the stored value.** When it cannot, the
field falls back to the plain auto-growing control rather than displaying
nothing and silently dropping your text.

### `text`

The default. A **single-row auto-growing textarea** — it looks like one line and
grows as you type. `Enter` inserts a newline; it does **not** commit. The value
is written when you leave the field.

### `tags`

The same auto-growing control as `text`, plus a hook class and a
`Comma separated` placeholder. It is a comma-separated string with no chip
rendering and no tag database.

### `multiline`

A `<textarea>`, three rows tall. Commits on every input event, debounced by the
save path.

### `code`

A `<textarea>`, six rows tall, monospaced, spellcheck disabled. Commits on
every input event.

### `url`

An `<input type="url">`. The browser offers its own validation bubble.

> There is **no** open-in-browser button. `<input type="url">` gives validation
> and nothing else.

### `number`

An `<input type="number">`.

If the stored value is present but not finite as a number — an empty string, or
text — the field renders as a plain text control instead, because
`<input type="number">` silently discards a value it cannot represent and your
note's text would vanish from the UI.

`min`, `max` and `step` are **not** read from metadata. Use `validation:`, with
the caveat that browsers ignore `pattern` on number inputs.

### `select`

A `<select>` built from `options`. Two edge cases worth knowing:

- **No options** → the control renders a single `No options defined` entry
  rather than appearing broken.
- **A stored value not in `options`** → it is inserted at the top of the list so
  it stays visible. Your value is never dropped because someone edited
  `options:`.

### `secret`

An `<input type="password">` with an eye toggle beside it. The toggle is a
`role="button"` with `tabindex="0"`, reachable and operable by keyboard
(`Enter` or `Space`).

Whether it starts masked depends on `masked:` — see the [keys table](#keys).

> The reveal state is deliberately **not** written to the file, so it resets on
> reload. A secret that stays revealed across sessions is a secret you will
> forget about.

---

## How values are written back

1. You type. Nothing is written.
2. You leave the field (`focusout`) → the value is written to the file.
3. As a backstop, an uncommitted value is flushed when the page is hidden.

There is no `beforeunload` prompt. Closing the tab mid-edit relies on step 3,
which fires on `pagehide`. In practice this is reliable, but it is not a
guarantee — see [`known-limitations.md`](known-limitations.md).

---

## Block-valued keys

`label` and `value` switch to a block scalar when a scalar form would not
survive a round trip. The writer uses a block when the text contains a newline,
begins with whitespace, or is exactly ` `:

````markdown
```structured-field
id: notes
label:  
  Meeting notes
  2026-10-16
type: multiline
value:  
  First paragraph.
  Second paragraph.
```
````

Block bodies are indented two spaces. CommonMark permits up to three spaces
before a closing fence, so a stored line beginning with three backticks **would**
close the block. That is why those lines are escaped — see
[`file-format.md`](file-format.md).

---

## Settings

Stored in `.obsidian/plugins/structured-cards/data.json`. Managed through the
plugin's settings tab; editing the file by hand works too.

| Key | Default | Meaning |
| --- | --- | --- |
| `templates` | `[]` | Saved layout templates. |
| `revealSecretsByDefault` | `false` | Start new secret fields revealed. |
| `defaultDirection` | `"auto"` | `auto` / `ltr` / `rtl` — the **base direction**: it applies to every field left on `auto` (and new fields start with it). A field that declares its own `direction:` wins over it; `auto` here means each field follows its own content. |
| `animations` | `true` | Motion and transitions. |
| `showEditingControls` | `true` | Menus, resize handles, duplicate. |
| `showDragHandles` | `true` | Drag affordance. |
| `responsive` | `true` | Collapse multi-column rows on narrow screens. |
| `snapGuides` | `true` | Alignment guides while dragging. |
| `debugLogging` | `false` | Diagnostics in the console. Set by editing `data.json` only — deliberately not a settings-row: the diagnostic wraps core Obsidian methods and slows navigation. |

### Removed keys

`defaultLayout`, `defaultSize`, `defaultDensity` and `defaultGap` were read by
nothing and are **pruned from `data.json` on load**. If you see them, you are on
an older build. They are listed in
[`CHANGELOG.md`](../CHANGELOG.md#settings-that-did-nothing).

## The field settings menu

The card's ⋯ menu → **Field settings** opens one modal; a save rewrites the
block in place. What it holds depends on the kind of field:

| Row | Shown for | Does |
| --- | --- | --- |
| Type | value fields | How the value is edited. A value the control cannot show falls back to plain text. |
| Mask secret | value fields of type `secret` | Whether the value is hidden until the eye is clicked. |
| Text direction | every field | The field's `direction:` — Auto / RTL / LTR. RTL/LTR wins over the plugin tab's default; Auto follows that default first, then the text when the tab is Auto too: RTL for Persian, LTR for Latin. |
| Options | `select` | The choices, comma-separated. |
| Default value | value fields | Second hint when no placeholder is set; templates may seed it as the starting value. |
| Placeholder | value fields | Hint shown while the field is empty. |
| Prefix / Suffix | every field | Rendered before / after the control. |
| Validation pattern | value fields | Browser-checked `pattern` on text, number and url inputs. |
| Required | value fields | Browser flags an empty value; `*` on the title. |
| Title alignment | every field | `start` / `center` / `end`, applied to the field label and to every title item's text box (an item card's own title included); value boxes are untouched. |

The **Help text** row was removed as worthless: existing `help:` values in old
notes still render under the field, but the menu no longer offers it and no
new field gets one.

Item cards (fields made of `item:` rows) only get the shell rows — text
direction, prefix, suffix and title alignment — plus a note saying rows are
edited on the card itself. The hidden rows would silently do nothing for an
item card, so they are not offered.

## `item:` lines

A `structured-field` block may also carry `item:` lines, which is how the legacy
card's content model survives inside the newer format:

````markdown
```structured-field
id: mixed
label: Both
type: text
value: main value
  item: title   Email
  item: checkbox   done
```
````

Notes:

- An **indented** `  item: x` is still an item. Without that, it fell through to
  the metadata branch and was written back out as a line that no longer parsed
  the same way.
- A `secret` item makes the **whole field** start masked, even when the field's
  own `type:` is `text`. Override with `masked: false`.
- `items: []` is written explicitly when a field has no items, so a cleared
  field does not resurrect old ones on the next parse.

---

## The legacy `structured-card` format

`structured-card` predates `structured-field`. It is still parsed and rendered,
and it is **frozen** — no new features land there. It remains so that existing
notes keep working.

A card holds sections; a section holds items:

````markdown
```structured-card
## Section name
- text   Some value
- title   Email
- checkbox   done
- separator  
- secret   token
```
````

Item kinds: `text`, `title`, `title-text`, `checkbox`, `bullet`, `numbered`,
`secret`, `url`, `separator`, `multiline`.

- `title` renders a heading. `title-text` renders the same vertical structure
  styled as body text — useful for a form where the label should not shout.
- A `## ` line names the section that follows it.
- `secret` items honour `revealSecretsByDefault` and a per-item `masked: false`.
- Card text items have their own bidi control characters stripped when copied,
  so pasting into a terminal does not produce mojibake.