# File format

The on-disk format is the contract. Everything else in this plugin is a view of
it.

---

## Why fenced code blocks

A field is a fenced block whose body is `key: value` lines. The alternatives
were rejected for specific reasons:

| Alternative | Rejected because |
| --- | --- |
| HTML comments / hidden spans | Rendered as literal text in exports and in other Markdown tools. |
| Frontmatter per field | One field per file, so no layouts and no side-by-side fields. |
| A sidecar JSON file | The note stops being the source of truth. Breaks sync, breaks diffs, breaks portability. |
| Wiki links to shadow notes | Works, but now you have two things to keep in sync. |
| Dataview `key:: value` inline fields | Cannot hold a textarea, a secret, or a select. |

A fence is inert Markdown. Every other tool that reads your vault sees a code
block and leaves it alone.

---

## Grammar

````
```structured-field
key: value
key: |
  a block scalar line
  another line
  item: a | legacy item
```
````

- The opening fence must be exactly ` ```structured-field ` after trimming.
  Anything else → the block is not a field.
- The body is split on the **first** colon. The key is trimmed. So
  `author.name: x`, `my key: y` and `a-b_c: z` are all valid keys.
- Lines without a colon are ignored.
- Keys are matched case-sensitively against the reserved set; anything else
  becomes [metadata](field-reference.md#custom-keys).
- `copy` stays a reserved key but intentionally does nothing. An earlier
  internal build used `copy: true` to add a clipboard button to a field; that
  feature was removed before the first public release, but the key remains
  reserved so notes written back then keep parsing exactly as they did —
  without `copy:` leaking onto the card as a metadata chip. The tests
  (`tests/nocopy.cjs`) pin that no copy UI or copy code path exists, and
  `tests/audit.cjs` pins that the key is still understood as reserved.

---

## Escaping

This is the part that is easy to get wrong, and where this release fixed a real
data-loss bug.

### The fence collision

The writer indents block-scalar bodies by **two** spaces. CommonMark allows up
to **three** spaces before a closing fence. So a stored line beginning with
three backticks terminated the block:

````
value: |
  ```js
  console.log(1)
```
````

The processor received `"…value: |\n  ```js"`. The value became `console.log(1)`
and the rest leaked out of the field as Markdown — data gone.

**The fix.** On write, any body line that begins with three or more backticks —
after leading whitespace — has its backticks backslash-escaped. On read, the
escape is reversed. Inline values (non-block) use the same escape.

Consequence: if you hand-edit a raw ``` into a block body, it still splits the
fence. Write `` \` `` instead.

### Backslashes

Because backtick escaping exists, a body containing a literal backslash is
escaped too, so that `\\` and `` \` `` cannot be confused. A body line you typed
with **two consecutive backslashes** is normalised to one on the next save.
This is the only lossy normalisation in the format.

### When a block scalar is used

A `label` or `value` is written as a block scalar when a scalar form would not
round-trip:

- it contains a newline, **or**
- it begins with whitespace (a scalar line would have that trimmed), **or**
- it is exactly `|`, which would be read back as the start of a block.

### Values containing a newline in the legacy format

The legacy serialiser writes any value carrying a newline as a block. Backslash
and pipe escaping is applied on top.

---

## Line endings

The writer matches the note. A note with CRLF endings gets CRLF in the inserted
block; a note with LF gets LF. Mixed line endings inside one note are preserved
as they are rather than normalised, because normalising would rewrite lines the
plugin never touched.

An earlier build appended `\n` regardless, producing mixed-ending notes after
every insert. That is fixed.

---

## What gets written, and when

A field is rewritten **only when its value changes**, and the write is scoped:

- Reading view uses a save path that replaces only the block's own span.
- Editor commands use a minimal-span diff: the smallest region covering old and
  new text. A stale prefix or suffix of the same content is left alone rather
  than rewritten.

This matters because a naive "insert at cursor" implementation replaced from
offset 0 — which, with a `Position` object passed where an offset was expected,
**duplicated the entire document**. That was a real bug in the previous build
and is fixed; see
[`CHANGELOG.md`](../CHANGELOG.md#third-review-round---reported-from-inside-obsidian).

---

## Insertion position

Insertion never splits a line. A caret in the middle of `hello` produces the
block *below* that line, not between `he` and `llo`.

- Caret at a line boundary → insert at that boundary.
- Caret mid-line → snap to the end of that line.
- Caret inside a field → insert after that field's closing fence.
- A CRLF boundary is snapped to the `\r`, so no stray `\r` is stranded.

Blank-line handling: exactly one blank line separates the inserted block from
whatever is above it, and a trailing newline is added after the block only when
the following text is not already on its own line. There is a hard cap of three
consecutive blank lines — a previous build accumulated them until they pushed
content off screen and destroyed rows.

---

## Stability

The format is intended to be stable. `structured-card` is frozen rather than
removed so that existing notes keep working; nothing new is written in that
shape.

If a future release changes the format, the previous reader stays able to read
the previous format, and the changelog will say so explicitly.