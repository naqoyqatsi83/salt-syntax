# Salt Syntax — Agent Workflow

## Workflow

This repo follows a standing process — apply it without being asked:

- **All work happens on `develop`.** `main` is release-only: it only ever
  moves via merging `develop` in at tag time. Never commit directly to
  `main`.
- **Every real fix or feature gets a GitHub issue**, opened before or
  alongside the work, closed with a comment naming the resolving commit
  and how it was verified once merged. If something real got fixed
  without one, backfill the issue and close it immediately rather than
  let it go undocumented.
- **`CHANGELOG.md` tracks everything under `[Unreleased]`** as it lands
  on `develop`, one bullet per issue, linked. When a version is tagged,
  that section becomes the version's heading.
- **Tags are real releases, not checkpoints.** An RC tag (`vX.Y.Z-rc.N`)
  can be cut directly on `develop` for pre-release testing without
  touching `main`. A non-RC tag means: merge `develop` into `main` first,
  tag `main` at that merge commit, then push both the branch and the tag.
  Pushing a `v*` tag triggers `.github/workflows/build.yml`'s release job,
  which packages the `.vsix` and attaches it to a GitHub Release.

## Project Nature

A VS Code language extension for SaltStack `.sls` files (YAML + embedded
Jinja2) — see [README.md](README.md) for what it actually does. No build
step: `src/extension.js` runs as-is, and `npx @vscode/vsce package` is the
only thing that turns the source tree into a `.vsix`.

## Layout

| Path | Purpose |
|---|---|
| `package.json` | Extension manifest — languages, grammars, snippets, editor defaults |
| `language-configuration.json` | Comments, brackets, auto-close, indentation |
| `syntaxes/sls.tmLanguage.json` | TextMate grammar |
| `snippets/sls-snippets.json` | Static snippets |
| `src/extension.js` | Completion providers |
| `examples/uninstall_formula.sls` | Sample file used while developing the grammar |

## Verifying grammar changes

There's no test suite that runs in CI for the grammar itself (it's a
TextMate grammar, not code) — verify changes by tokenizing a sample file
with `vscode-textmate`/`vscode-oniguruma` directly (outside the editor) and,
when a specific color theme is in play, by loading that theme's actual
`tokenColors` and checking what a token really resolves to, rather than
guessing from a screenshot. Zero `invalid`-scoped tokens across
`examples/uninstall_formula.sls` is the baseline sanity check.
