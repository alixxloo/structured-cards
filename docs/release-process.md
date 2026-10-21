# Release process

Verified against Obsidian's current documentation and the sample plugin, checked
October 2026. If Obsidian's process changes, this file is what needs updating.

---

## What Obsidian actually reads

This is the part that is commonly gotten wrong.

| Obsidian does | Obsidian does **not** do |
| --- | --- |
| Reads `manifest.json` **in your repo** to learn the latest version number | Read the plugin's code from your default branch |
| Fetches the actual files from your **GitHub Release**, tagged identically to `manifest.json`'s `version` | Install from a git tag alone |
| Consults `versions.json` to pick an older, compatible version when the running Obsidian is too old | — |
| Pulls `README.md` from your repo for the plugin's detail page | — |
| Downloads `manifest.json`, `main.js`, and `styles.css` (if present) into `<vault>/.obsidian/plugins/<id>/` | — |

So a `git tag` on its own is **not enough**. You need a published GitHub
Release, with the three files attached as assets.

### The repository has to be public

This is the one that bites hardest, because nothing fails until somebody tries
to install.

Obsidian fetches the files from raw content URLs, of the shape:

```
https://raw.githubusercontent.com/<owner>/<repo>/<tag>/main.js
```

For a **private** repository those URLs return 404 for everyone. Obsidian sends
no token, so there is nothing to authenticate with, and no amount of tagging or
releasing changes that. A private repository cannot be installed from the
community list, or from `Community plugins -> Browse` at all.

So the order is fixed:

1. Work privately for as long as you like. Nothing is lost.
2. **Make the repository public.**
3. *Then* tag and publish the Release.

Flipping it public afterwards does not retroactively damage anything, which is
why working privately first is fine. The only thing that must not happen is
tagging and announcing a release while it is still private, because the
announcement would point everybody at a 404.

`community-plugins.json` carries a `repo` field too, and the listing on
obsidian.md links to it, so a private repository cannot be listed either.

---

## How an update reaches a user

Nothing in this plugin implements updating. Obsidian does it, and it is worth
being precise about the flow, because the two halves come from two different
places and a release that satisfies only one of them will install and then
never offer an update again.

When somebody clicks **Check for updates**, Obsidian:

1. reads `community-plugins.json` from `obsidianmd/obsidian-releases`;
2. takes the `repo` field of each entry and fetches
   `https://raw.githubusercontent.com/HEAD/<repo>/manifest.json` -
   **`HEAD`, so this is the default branch, not a tag**;
3. throws the result away unless its `id` equals the `id` in the entry;
4. if `minAppVersion` is higher than the running app, falls back to
   `versions.json` in the repository to find the newest compatible version;
5. compares that version with the installed one, and only if it is newer,
6. downloads `manifest.json`, `main.js` and `styles.css` **from the GitHub
   Release** whose tag is that exact version, with no `v` prefix.

Three consequences, each of which is a way to ship an update that never
arrives:

| Consequence | What breaks |
| --- | --- |
| The `id` in the entry and in `manifest.json` must match exactly | Step 3 discards the manifest and no update is ever offered, silently |
| `manifest.json` has to be committed on the **default branch** and is what declares the latest version | A tag alone, or a bumped manifest that was never pushed, means users are already up to date |
| The Release has to carry all three files, tagged with the same string | Step 6 finds nothing to download |

`data.json` is **not** replaced by an update, so people's settings survive it.

Obsidian only checks when that button is pressed. It does not poll. So a
release is not visible to anyone until they either click it or install a third
party updater.

---

## Cutting a release

### 1. Bump the version

`manifest.json`:

```json
"version": "0.2.0",
"minAppVersion": "1.5.0"
```

`versions.json` — one entry per released version:

```json
{
  "0.1.0": "1.5.0",
  "0.2.0": "1.5.0"
}
```

`package.json` — keep it in step:

```json
"version": "0.2.0"
```

> `minAppVersion` in `versions.json` is the *floor for that version*, not the
> floor for the plugin. Raise it only for a release that actually needs a newer
> Obsidian.

### 2. Build and test

```sh
npm run build
npm test
```

`manifest.cjs` checks the version agreement across `manifest.json`,
`package.json` and `versions.json`, and fails if a required repo file is
missing. If it passes, the metadata is coherent.

`main.js` is **not** committed. It is a build product: `.gitignore` carries
`main.js`, and `.github/workflows/release.yml` builds it fresh from the tagged
source on every version tag and attaches it to the Release. Obsidian, BRAT and
the repository's `install.sh` / `install.ps1` installers all download it from
the Release assets, never from the git tree — so a committed copy would be a
second copy drifting silently from the source. (Retired after 0.1.0, which
still shipped a committed copy; the assets were always the file users got.)

### 3. Commit

```sh
git add -A
git commit -m "Release 0.2.0"
git push
```

`data.json` is gitignored. It is per-install state; committing it seeds every
new install with your personal settings. `main.js` is gitignored for the reason
given in step 2.

### 4. Publish the GitHub Release

`name`: by default this step is automatic — pushing the tag runs
`.github/workflows/release.yml`, which builds fresh, runs the suite, and
attaches the assets with notes generated from this CHANGELOG's section
(`node tools/release-notes.mjs <version>`). The manual path below is the
fallback when the workflow cannot run.

**Exactly** the version string, no `v` prefix. `0.2.0`, not `v0.2.0`.

Attach as assets:

- `manifest.json`
- `main.js`
- `styles.css`

`manifest.json` must be present **both** in the repo root and as a release
asset. The repo copy tells Obsidian the version exists; the asset copy is what
gets installed.

```sh
gh release create 0.2.0 \
  --title "0.2.0" \
  --notes-file CHANGELOG-entry.md \
  manifest.json main.js styles.css
```

---

## Adding it to the community list

Once, for the first release.

### Before the PR

- [ ] The plugin has a published GitHub Release tagged with the version.
- [ ] `README.md` exists in the repo root.
- [ ] The repo is public.
- [ ] `manifest.json` has `id`, `name`, `version`, `minAppVersion`,
      `description`, `author`.
- [ ] `versions.json` covers every released version.
- [ ] You have actually run the plugin in Obsidian yourself.

### The PR

Repo: <https://github.com/obsidianmd/obsidian-releases>

Edit `community-plugins.json` and add one entry, **alphabetically by id**:

The entry is kept as a file, `.github/community-plugin.json`, so it cannot
drift away from `manifest.json`. `tests/entry.cjs` fails if the two disagree:

```json
{
  "id": "structured-cards",
  "name": "Structured Cards",
  "author": "alixxloo",
  "description": "Render structured-card and structured-field codeblocks as interactive, customizable visual cards inside your Obsidian notes.",
  "repo": "alixxloo/structured-cards"
}
```

Note that `author` and `description` are **in the entry**. They are not read
from your `manifest.json` for the list. Get them right — they are what people
see in search results.

Submit the PR. Obsidian's team reviews it.

### After approval

- The plugin appears in Settings → Community plugins → Browse.
- Announce it in the forums as a showcase, and on Discord in `#updates` (you
  need the developer role to post there).

---

## Releasing to beta testers first

You do not have to submit blind. Obsidian's own recommendation is to run a
public beta first, using the **BRAT** plugin, which installs directly from a git
repo. That gets you testers without waiting for the list review.

---

## Rollback

Obsidian reads `manifest.json` from your **default branch** to decide the latest
version. So to stop offering a broken release:

1. Revert or fix the default branch so `manifest.json` points at a good version.
2. Delete the bad GitHub Release.

The release assets are what users actually download, so the release must go.

---

## Checklist

- [ ] `manifest.json` version bumped
- [ ] `package.json` version bumped
- [ ] `versions.json` has the entry
- [ ] `minAppVersion` is correct
- [ ] `npm run build` — `main.js` regenerated
- [ ] `npm test` — all suites pass
- [ ] `npm run check:counts` — the test counts stated in the docs match the suite
- [ ] Changes pushed to the default branch
- [ ] GitHub Release published, tag is exactly the version string
  - the `release.yml` run on the tag is green, and it attached
    `manifest.json`, `main.js` and `styles.css`
- [ ] `CHANGELOG.md` updated
- [ ] The README's version badge shows the new version
- [ ] README's Status section matches reality (drop the "Not published yet"
      paragraph the moment the repository goes public)
- [ ] Tested in a real Obsidian before publishing