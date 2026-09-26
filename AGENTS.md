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
- **CI only runs on a `v*` tag push**, not on every `develop`/`main`
  push — verification of a change has to happen before it's committed
  (see "Verifying grammar changes" below, and `node test/run.js` for
  `src/extension.js` logic — see "Tests" below), not after, since nothing
  will catch a mistake on `develop` until the next release.

## Working notes

Carried across sessions/machines since nothing but this repo is shared
between them — keep it current rather than letting it drift, the way the
rest of this file stays current.

- **Where things stand:** `main` is at `v0.9.2`. `develop` has the
  rendered preview graduated from `experimental/template-inputs-poc`
  (#39-#46, closed; #23 closed as the umbrella) and is headed for
  `v0.10.0` -- `v0.10.0-rc.5` cut from `develop` for testing first. The
  experimental branches are kept for history but no longer where work
  happens. Design notes, coverage map and graduation checklist:
  `docs/design/jinja-render-preview.md`.
- **Identity:** commit, tag, and release only as the one identity this
  repo's history already uses — never introduce any other name or handle
  into a commit, issue, or release here.
- **Release habits:**
  - Bump `package.json`'s version before cutting an RC tag.
  - Delete RC tags once the final release they led up to is tagged.
  - Use "Refs #N" (not "Fixes #N") in a commit message when the fix still
    needs testing before it should count as closing the issue — pushing
    to `develop` auto-closes on "Fixes #N".
  - Close an issue with a comment naming the resolving commit and how it
    was verified, per the Workflow section above.
- **Tooling:**
  - Packaging needs Node 20+, not whatever's on `PATH`: `npx -p node@20
    -p @vscode/vsce -c "vsce package --no-dependencies"`.
  - Manual install for local testing: `code --install-extension
    <file>.vsix --force`, then Reload Window.
  - On Windows, the preview's Python interpreter is usually `python` or
    `py`, not `python3` (which may be a Microsoft Store stub that does
    nothing) — set `saltSyntax.preview.pythonPath` explicitly and
    `pip install jinja2 pyyaml` for it.
- **Lessons learned:**
  - A sidebar panel's visibility can't key off `editorLangId`; the
    extension has to set and check its own context key instead.
  - Brackets that stay colored inside a comment after an edit are a
    stale VS Code re-tokenization quirk, fixed by reopening the file —
    not a grammar bug worth chasing.
  - Debug suspicious coloring by tokenizing with `vscode-textmate`
    against the real theme file, per "Verifying grammar changes" below —
    not by eyeballing a screenshot.
- **Next up:** once rc.5 is confirmed, release `v0.10.0` (merge `develop`
  into `main`, tag, delete the 0.10.0 RCs).

## Project Nature

A VS Code language extension for SaltStack `.sls` files (YAML + embedded
Jinja2) — see [README.md](README.md) for what it actually does. No build
step: `src/extension.js` runs as-is, and
`npx --yes @vscode/vsce package --no-dependencies` is the only thing that
turns the source tree into a `.vsix`.

## Layout

| Path | Purpose |
|---|---|
| `package.json` | Extension manifest — languages, grammars, snippets, editor defaults, settings |
| `language-configuration.json` | Comments, brackets, auto-close, indentation |
| `syntaxes/sls.tmLanguage.json` | TextMate grammar |
| `syntaxes/salt-jinja.tmLanguage.json` | Salt Jinja language's grammar — just includes `source.sls` under its own scope, so there's one grammar to maintain |
| `snippets/sls-snippets.json` | Static snippets |
| `src/extension.js` | Completion, diagnostics, highlight, comment-toggle and formatting providers — `sls` gets everything, `salt-jinja` everything but the state-only completions (`SALT_LANGUAGES` / `jinjaSelector`) |
| `src/preview.js`, `src/preview/render.py`, `src/templateInputs.js` | Rendered preview: the VS Code side (preview document, inputs panel, diagnostics), the Python renderer (real Jinja2 with Salt's environment emulated, checks against Salt's rules per version), the static inputs extractor. Design notes and coverage map: `docs/design/jinja-render-preview.md` |
| `examples/uninstall_formula.sls` | Sample file used while developing the grammar |
| `images/icon.svg` / `icon.png` | Extension icon — edit the SVG, re-render the 256×256 PNG from it (e.g. `@resvg/resvg-js`); only the PNG is packaged |
| `test/` | `run.js` runner, `helpers/vscode.js` mock, one `*.test.js` / `*.test.py` per feature — see "Tests" below |
| `CHANGELOG.md` | Keep a Changelog, per the Workflow section above |
| `.github/workflows/build.yml` | CI: validates/packages/releases, only on a `v*` tag push (or manual `workflow_dispatch`) — deliberately not on every `develop`/`main` push, see the Workflow section above |

## Updating the Salt module/function list

This extension supports two Salt release lines side by side, switched at
runtime by `saltSyntax.saltVersion` (`activeDataset()` in
`src/extension.js`): `MODULE_FUNCTIONS_3008` / `FULL_FUNCTION_FIELDS_3008` /
`MANDATORY_FIELDS_3008` (default), and `MODULE_FUNCTIONS_3006` /
`FULL_FUNCTION_FIELDS_3006` / `MANDATORY_FIELDS_3006` (Salt's LTS line, which
still carries hundreds of state modules — mostly third-party cloud/provider
integrations — that 3007.0 onward split out into separate salt-extensions
packages). Both are extracted from Salt's own source, not hand-written — see
the comments above each in that file for the exact rules. `FULL_FUNCTION_FIELDS_*`
parses each qualifying function's real parameter list and default values
straight out of its signature, handling both single- and multi-line `def`s;
`MANDATORY_FIELDS_*` records which of those parameters have no default at all
— genuinely required, not just commonly-set — and `getBasicFields()` uses it
to guarantee the "basic" completion variant never omits one, merging it in
even for a function with no curated `FUNCTION_FIELDS` entry (that curated
dict, plus `DEFAULT_FIELDS`, is shared unversioned across both lines since it
only covers long-stable core modules like `pkg`/`file`/`service`/`user`).

To regenerate one dataset against a newer tag on its line:

1. Pick the release tag (e.g. `v3008.3`, or `v3006.28`) — a real, tagged
   release, not `master`. `master` carries unreleased modules/functions
   (verified for 3008: as of this writing it has
   `dnfmodule`/`postgres_default_privileges`/`python` and two extra `pkg`
   functions that don't exist in any tagged release yet) — pinning to a tag
   is what keeps this list matching the Salt people actually have installed.
2. `GET https://api.github.com/repos/saltstack/salt/contents/salt/states?ref=<tag>`
   for the file list, then download each `salt/states/<file>.py` raw from
   that same tag.
3. For each file, parse it (an actual AST parse, e.g. Python's `ast` module —
   far more reliable than regex, especially for default-value expressions and
   multi-line `def`s) and apply, in order:
   - **Primary rule:** a top-level `def name(...)` counts as a real state
     function only if its first parameter is literally `name` (Salt's actual
     convention). This is also what filters out internal-only hooks
     (`mod_init`, `mod_aggregate`, `mod_watch`, `mod_beacon`, ...) *in
     combination with* an explicit `mod_`-prefix exclusion — some hook
     functions (e.g. `file.mod_beacon`) do take `name` first too, so the
     name-first check alone isn't sufficient; exclude any function whose name
     starts with `mod_` or `_` outright, regardless of its first parameter.
   - **Tier 2 (also automatic):** if `name` isn't the first parameter but
     appears anywhere else in the signature, still treat it as real and
     reorder so `name` leads (Salt still binds the state ID to it) — e.g.
     `bigip.create_node`'s real signature is
     `(hostname, username, password, name, address, ...)`.
   - **Tier 3 (hand-verified only, exactly like the original `module.run` /
     `postgres_cluster.absent` / `postgres_schema.absent` exceptions):** a
     function that accepts `name` only via a trailing `**kwargs` catch-all —
     confirm each one by hand against the real source before adding it, and
     record what was added and why (see `MODULE_FUNCTIONS_3006`'s own header
     comment in `extension.js` for the full 3006 list as a template for the
     next regeneration).
   - Watch for a public name created via plain assignment rather than `def`
     (e.g. `stateconf.py`'s `set = context = _no_op`) — an AST function-def
     scan alone misses these; grep every file for module-level
     `Name = Name` assignments separately and fold in any aliases found.
   - Drop a module entirely (don't emit it with an empty function list) if
     its real public functions are generated by runtime metaprogramming with
     no static `def`/alias to see at all (e.g. `testinfra.py`'s
     `_generate_functions()`, which mirrors the `testinfra` execution module
     into this namespace at import time).
   - Apply `__virtualname__` (module's public name) and `__func_alias__`
     (individual function renames, e.g. `copy_` -> `copy`) where a file
     defines them — except when a file's own `__virtualname__` claims a name
     another distinct, already-established module already owns and the two
     are meant to be addressed differently in SLS (e.g. `x509_v2.py` sets
     `__virtualname__ = "x509"` but is kept as its own `x509_v2` completion
     target, matching precedent already in the 3008 dataset). When two files
     are genuine same-name platform or proxy-extension alternates instead
     (e.g. `win_network.py`/`network.py`, `nxos_upgrade.py`/`nxos.py` — real
     SLS is written the same way regardless of which one actually loads on a
     given minion), merge their functions under the one shared name.
4. Diff against the previous version and manually verify anything that
   changed shape (new/removed modules, function list changes) before
   committing — don't just trust the automated pass blind, the same way the
   original extraction caught `module.run` and `postgres_cluster/schema
   .absent` as real exceptions to the name-first rule only by checking the
   rejected list by hand.

## Tests

`node test/run.js` runs every `test/*.test.js` (node) and `test/*.test.py`
(python3), each in its own process; `node test/run.js <part-of-name>` runs
a subset, `-v` shows every test's output. CI runs it before packaging. Run
it before committing any `src/` change -- nothing else will catch a
regression until the next release.

- `test/helpers/vscode.js` is a shared, lenient mock of the `vscode` API:
  `load()` activates `src/extension.js` against it and returns a registry
  of what got registered (providers, commands, listeners, diagnostic
  collections, ...). Unmodelled APIs are no-ops, so adding a registration
  to the extension doesn't break unrelated tests.
- One file per feature. When fixing a bug, add the reproducing case to the
  feature's file first and check it fails without the fix.
- A mock can't show what only VS Code decides (exact cursor placement,
  rendering, timing of its own events) -- those still need a check in the
  real editor, from a locally installed `.vsix`.
- A Python test that can't run here (no python3/package/network) exits 77,
  which the runner reports as skipped rather than failed.

## Verifying grammar changes

There's no test suite that runs in CI for the grammar itself (it's a
TextMate grammar, not code) — verify changes by tokenizing a sample file
with `vscode-textmate`/`vscode-oniguruma` directly (outside the editor) and,
when a specific color theme is in play, by loading that theme's actual
`tokenColors` and checking what a token really resolves to, rather than
guessing from a screenshot. Zero `invalid`-scoped tokens across
`examples/uninstall_formula.sls` is the baseline sanity check.
