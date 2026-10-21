# Contributing

Thanks for looking. Bug reports and pull requests are both welcome.

## Before you start

- **Is it a bug?** Check [`docs/known-limitations.md`](docs/known-limitations.md)
  first. Several reports every week are documented behaviour.
- **Does something similar exist?** Check
  [the community plugins list](https://obsidian.md/plugins).
- **Security issue?** Do not open an issue. See [`SECURITY.md`](SECURITY.md).
- **A feature?** Open an issue first. A pull request for a feature nobody asked
  for is hard to review and often wasted work.

## Reporting a bug

A good report contains:

1. **Obsidian version** — Settings → About.
2. **Plugin version** — the number in the plugin's description.
3. **OS.**
4. **What you did**, step by step.
5. **What you expected.**
6. **What happened.**
7. **The smallest note that reproduces it.**

That last one is the valuable part. If you can paste the smallest
`structured-field` block that shows the problem, the bug is usually fixable
quickly.

If there is a console error, include it. Open `Ctrl+Shift+I`, go to Console,
copy the red lines.

### Please do not include secrets

This plugin stores passwords in `secret` fields, in **plain text in your note**.
A bug report containing your note's real content publishes your passwords.

Redact first. If you can reproduce with `hunter2`, do that.

## Setting up

```sh
git clone https://github.com/alixxloo/structured-cards
cd structured-cards
npm install
npm run build
```

See [`docs/development.md`](docs/development.md) for the full picture, including
how to load the build into a vault.

## The verification loop

This is the part that matters:

1. Write a test that fails.
2. Watch it fail.
3. Fix the code.
4. Watch it pass.

Do not start at step 3. Fixes that were not reproduced first have, in this
project's history, turned out to be fixes for the wrong thing twice.

## Pull requests

- One change per PR. A PR that fixes a bug and reformats the file is a PR nobody
  can review.
- Say **what** changed and **why** in the description.
- Add or update an assertion for the behaviour you changed. If the change is not
  testable, say so explicitly and explain why.
- Update `CHANGELOG.md`.
- `npm test` must pass.

## Where things go

| You are changing | Put the test in |
| --- | --- |
| Parser / serialiser round-trips | `t.cjs` |
| Rendering, DOM shape, event wiring | `runtime.cjs` |
| A specific defect that was fixed | `audit.cjs` |
| Editor commands, insert paths | `editortest.cjs` |
| Editor interaction, minimal-span writes | `review2.cjs` |
| Move engine, blank lines, escaping | `review3.cjs` |
| A regression found by self-audit | `review4.cjs` |
| Copy, metadata, typed controls | `review5.cjs` |
| Stylesheet vs classes emitted | `checkcss.cjs` |
| Compatibility shims, repo files | `compat.cjs` |
| Release metadata, manifest coherence | `manifest.cjs` |
| The built `main.js` | `artifact.cjs` |

`run.cjs` lists what each suite covers.

## Style

Match the file. Two-space indent, semicolons, double quotes. Comments explain
**why** — a comment restating the code is noise.

New code uses readable names. The terse ones (`Q`, `W`, `Ct`, `dt`) are an
artifact of recovering the file from a minified build; they are stable, load
bearing for the test harness, and will not be renamed casually.

## Code of conduct

[`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) applies to all project spaces.