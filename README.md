<div align="center">

# Structured Cards

**Typed, draggable fields that live inside your Markdown.**

[![Version](https://img.shields.io/badge/version-0.1.0-informational)](manifest.json)
[![Minimum Obsidian](https://img.shields.io/badge/minimum-1.5.0-8a8a8a)](manifest.json)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-1314%20passing-success)](tests/)

[Install](#install) · [Documentation](#documentation)

</div>

---

![A note containing several Structured Cards, in the light theme](docs/images/overview-light.png)

Structured Cards turns fenced Markdown blocks into labelled, typed fields you can
edit in place, drag around, and resize. A status dropdown, an API key box, a notes
textarea — they render as a card, you drag them where you want, and underneath they
are still **plain text in your note**.

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

## Why blocks and not a sidecar database

Most plugins that store structured data keep it somewhere else: a JSON file, a
database, an encrypted blob. That works, but it means your notes stop being the
source of truth, and they stop being portable.

This plugin inverts that. **A field _is_ a fence.**

- **Your notes stay portable.** Uninstall the plugin, copy the vault to another
  machine — the data is still there, readable, in the text.
- **Diffs are meaningful.** Changing a field shows up in `git diff` as a small,
  readable change rather than an opaque blob rewrite.
- **Sync just works.** Obsidian Sync, iCloud, Dropbox, Syncthing — none of them
  know this plugin exists, and none of them need to.
- **It fails loudly.** If the plugin ever stops loading, you see the raw block in
  your note instead of silently losing data.

## What a card can contain

A card is either a single typed value, or a list of items.

<p align="center">
  <img src="docs/images/overview-dark.png" alt="A card built from items, typed controls, a plain value, an empty card, and two cards in a row" width="720">
</p>

- **Eight value types** — `text`, `multiline`, `url`, `secret`, `number`,
  `select`, `tags`, `code`.
- **Items inside a card** — a title, free text, bulleted or numbered lists,
  headings and separators, each with its own kind.
- **Secrets** are masked by default and revealed per field.
- **Rows** place two or more cards side by side, written as an ordinary `row:`
  key on each block.
- **Widths** per card, in percent, with a floor that stops a card becoming
  unusable.
- **RTL and LTR** per card, plus a vault-wide default.

## Editing controls

<p align="center">
  <img src="docs/images/controls-dark.png" alt="One item with its drag line and delete button visible, and an empty card showing its placeholder hints" width="720">
</p>

- **Drag an item** by the small line at the top of it.
- **Drag a card** by its handle, in the editor and in reading view. Alignment
  guides snap to neighbouring cards.
- **Resize a card** by its edge or corner.
- **Per-card menu** for editing properties, duplicating and deleting.
- **Empty cards keep their hints.** A new card shows `Title` and `Type here…`
  until you type; the hint is never written to your note.
- **Values commit on blur**, not on every keystroke.

Chrome you can turn off — drag handles, editing controls, alignment guides,
animations — is in the settings, and every one of them applies immediately.

## Commands

  Command   What it does  
  ---   ---  
  `Insert field`   Add a field at the cursor  
  `Insert template`   Insert a saved layout template  
  `Save selected/current layout as template`   Capture the current cards as a template  
  `Manage templates`   Rename, update, delete, import and export templates  

## Settings

| Setting | Default | Effect |
| --- | --- | --- |
| `Mask secrets by default` | off | Start every secret card masked |
| `Default text direction` | `auto` | `auto` / `ltr` / `rtl` for new cards |
| `Show editing controls` | on | Per-card menus, resize handles |
| `Show drag handles` | on | Drag affordances (needs editing controls) |
| `Responsive layout` | on | Collapse multi-column rows on narrow screens |
| `Snap guides` | on | Alignment guides while dragging |
| `Animations` | on | Transitions and motion |

Full reference: [`docs/field-reference.md`](docs/field-reference.md).

## Updating

Structured Cards has no update code of its own. Obsidian does this:

1. `Settings -> Community plugins`
2. the **Check for updates** button, or the plugin's own `...` menu
3. `Update` next to Structured Cards

Obsidian reads the latest version from this repository's `manifest.json` and
downloads the new files from the GitHub Release, so the settings in `data.json`
are left alone. It only checks when you ask it to - not in the background.

Before the plugin is on the community list, beta testers update with the BRAT
plugin, which installs straight from a git repository.

## Install

### From the community list

`Settings → Community plugins → Browse`, then search **Structured Cards**.

### Manually

Copy `main.js`, `manifest.json` and `styles.css` into
`<your-vault>/.obsidian/plugins/structured-cards/`, then enable it under
`Settings → Community plugins`.

### From source

```sh
git clone https://github.com/alixxloo/structured-cards
cd structured-cards
npm install
npm run build
```

Then copy `main.js`, `manifest.json` and `styles.css` as above.

## Requirements

- Obsidian **1.5.0** or newer
- Desktop and mobile

## Documentation

  Document   What is in it  
  ---   ---  
  [`docs/field-reference.md`](docs/field-reference.md)   Every key, every type, every setting  
  [`docs/file-format.md`](docs/file-format.md)   The on-disk block format and its escaping rules  
  [`docs/architecture.md`](docs/architecture.md)   How the code is organised, and why  
  [`docs/development.md`](docs/development.md)   Build, test harness, adding a field type  
  [`docs/release-process.md`](docs/release-process.md)   How a release is cut and submitted  
  [`docs/known-limitations.md`](docs/known-limitations.md)   What is unverified, and what will bite you  
  [`docs/release-notes-0.1.0.md`](docs/release-notes-0.1.0.md)   The audit trail behind this release  
  [`CHANGELOG.md`](CHANGELOG.md)   Release history  

## Status

**Published** — the repository is public and tagged `0.1.0`, with a GitHub
Release carrying `manifest.json`, `main.js` and `styles.css`: exactly the files
the Obsidian installer downloads. The release follows the order written down in
[`docs/release-process.md`](docs/release-process.md) — public before tagged.

This is the **first public release**: stable and tested, but young. It is not
yet in Obsidian's community plugin list; until it is, install from the Release
assets (or via BRAT) — see the Release page.

It is also honest about its edges:
[`docs/known-limitations.md`](docs/known-limitations.md) lists exactly what has and
has not been verified — including the things an automated test cannot reach, like
real pointer dragging and real theme CSS cascades.

## Contributing

Issues and pull requests are welcome. Please read
[`CONTRIBUTING.md`](CONTRIBUTING.md) and
[`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) first. Security reports go through
[`SECURITY.md`](SECURITY.md), not the issue tracker.

## License

MIT — see [`LICENSE`](LICENSE).