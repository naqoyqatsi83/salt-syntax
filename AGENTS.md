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

## Updating the Salt module/function list

`MODULE_FUNCTIONS` and `FULL_FUNCTION_FIELDS` in `src/extension.js` are
extracted from Salt's own source, not hand-written — see the comments above
each in that file for the exact rules (name-first-param filter,
`__virtualname__` resolution, `__func_alias__` fixes, the handful of
confirmed-by-hand exceptions; `FULL_FUNCTION_FIELDS` additionally parses
each qualifying function's real parameter list and default values straight
out of its signature, handling both single- and multi-line `def`s). To
regenerate it against a newer Salt release:

1. Pick the release tag (e.g. `v3008.3`) — a real, tagged release, not
   `master`. `master` carries unreleased modules/functions (verified: as of
   this writing it has `dnfmodule`/`postgres_default_privileges`/`python`
   and two extra `pkg` functions that don't exist in any tagged release
   yet) — pinning to a tag is what keeps this list matching the Salt people
   actually have installed.
2. `GET https://api.github.com/repos/saltstack/salt/contents/salt/states?ref=<tag>`
   for the file list, then download each `salt/states/<file>.py` raw from
   that same tag.
3. For each file: top-level `def name(...)` where the first parameter is
   literally `name` = a real state function (this is Salt's actual
   convention, and it's what filters out internal-only hooks like
   `mod_watch`/`mod_beacon`/`mod_aggregate`, which Salt calls automatically
   and are never written as `module.function:` by hand). Apply
   `__virtualname__` (module's public name) and `__func_alias__`
   (individual function renames, e.g. `copy_` -> `copy`) where a file
   defines them.
4. Diff against the previous version and manually verify anything that
   changed shape (new/removed modules, function list changes) before
   committing — don't just trust the automated pass blind, the same way the
   original extraction caught `module.run` and `postgres_cluster/schema
   .absent` as real exceptions to the name-first rule only by checking the
   rejected list by hand.

## Verifying grammar changes

There's no test suite that runs in CI for the grammar itself (it's a
TextMate grammar, not code) — verify changes by tokenizing a sample file
with `vscode-textmate`/`vscode-oniguruma` directly (outside the editor) and,
when a specific color theme is in play, by loading that theme's actual
`tokenColors` and checking what a token really resolves to, rather than
guessing from a screenshot. Zero `invalid`-scoped tokens across
`examples/uninstall_formula.sls` is the baseline sanity check.
