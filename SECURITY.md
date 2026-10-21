# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| 0.1.x | Yes |
| < 0.1.0 | No — never publicly released |

## Reporting a vulnerability

**Do not open a public issue for a security vulnerability.**

Open a private report instead:

**GitHub** — <https://github.com/alixxloo/structured-cards/security/advisories/new>

If that is not available to you, open a regular issue that says only *"security
report available on request"* with no technical detail, and wait to be contacted.

Please include:

- What the vulnerability allows an attacker to do
- The steps to reproduce it
- Your Obsidian version and plugin version
- The smallest note that reproduces it

You can expect an acknowledgement within a few days and an assessment within two
weeks. If a fix is warranted you will be credited in the release notes unless you
prefer otherwise.

---

## What is in scope

### The plugin reads and writes your notes

A Markdown plugin has write access to the vault. That is its job. The relevant
question is whether it writes where it means to.

- **Data loss** — a write that destroys or truncates content the user did not
  ask to change. This is in scope and is treated as serious.
- **Path traversal** — a template, id or filename that escapes the vault or
  reaches outside the plugin's directory.
- **Injection** — untrusted note content executed rather than rendered as text.
- **Cross-note writes** — writing into a note the user did not open, or into a
  different note than the action targeted.
- **Leaking secrets** — a `secret` field's value reaching somewhere it should
  not: a URL, a log, the clipboard by default, an error message.

### Clipboard

Values are copied only on an explicit user action. A copy that happens without
one is a vulnerability.

### Network access

The plugin makes **no network requests**. If a future version needs to, it is a
reviewable change and must be called out in the changelog. Silently added
telemetry is a vulnerability, not a feature.

---

## What is not a vulnerability

Stated up front so reports are not wasted on it:

- **Secrets are stored in plain text.** By design — see
  [`docs/file-format.md`](docs/file-format.md). A `secret` field masks the
  display; it does not encrypt. If you need encryption, do not use this plugin
  for that data.
- **Data loss through hand-editing the format.** Editing a block into an invalid
  state is documented behaviour. See
  [`docs/known-limitations.md`](docs/known-limitations.md).
- **Anything in the "unverified" list** of
  [`docs/known-limitations.md`](docs/known-limitations.md). Unverified is not the
  same as vulnerable, but a concrete report of a real failure there is still
  welcome — file it as a bug.
- **Rendering bugs.** Wrong colours, bad layout, a control in the wrong place.

---

## Threat model in one paragraph

The realistic adversary is not a remote attacker — this plugin has no network
surface. It is a **malicious or malformed note**: a note someone else wrote,
synced into your vault, containing a `structured-field` block crafted to make the
plugin corrupt the file it is editing, read outside the vault, or write into a
note you did not open. Treat every field in every note as untrusted input, even
the ones you wrote.

## Disclosure

Please give the maintainer a reasonable window to ship a fix before disclosing
publicly.