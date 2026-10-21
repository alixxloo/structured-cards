## What

<!-- One or two sentences. What changes, from the user's point of view. -->

## Why

<!-- The problem this solves. Link the issue if there is one. -->

Closes #

## How

<!-- The approach. Skip this if the diff says it clearly. -->

## Verification

<!-- Required. -->

- [ ] I reproduced the problem in a test **before** fixing it.
- [ ] The new test failed without this change and passes with it.
- [ ] `npm test` passes.
- [ ] I added or updated an assertion in the right suite (`CONTRIBUTING.md` has the map).

If any box cannot be ticked, say why in a comment below. A change that cannot be
tested is allowed — an unacknowledged one is not.

## File format

- [ ] This change does **not** alter what gets written into notes.
- [ ] Or: this change alters the format, and it is called out in `CHANGELOG.md`
      and in `docs/file-format.md`.

## Checklist

- [ ] `CHANGELOG.md` updated
- [ ] Docs updated if behaviour changed (`docs/`)
- [ ] No real secrets or personal data in the diff, in test fixtures, or in comments
- [ ] No unrelated reformatting — one change per PR
- [ ] I have read `CODE_OF_CONDUCT.md`