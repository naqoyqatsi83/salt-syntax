# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Every entry links the GitHub issue that tracked it — see the Workflow
section in [AGENTS.md](AGENTS.md) for how work flows from issue to
`develop` to a tagged release.

## [Unreleased]

Changes land here as they're merged to `develop`, then move under a
version heading when that state gets tagged and merged to `main`.

### Added
- **Salt Jinja** language for Salt's other Jinja files, with `.jinja`
  (`map.jinja`, macro libraries, ...) associated by default: same
  grammar, highlighting, `Ctrl+/` toggle, block highlight, Jinja
  indentation check, Enter indentation, non-ASCII check and Jinja
  completion as `.sls`, without the state-only completions
  (`module.function`, requisites). Editor defaults and `saltSyntax.*`
  toggles apply to it too.
  [#26](https://github.com/naqoyqatsi83/salt-syntax/issues/26)
- `.yaml`/`.yml` files with a line starting with a Jinja `{% %}`/`{# #}`
  tag (e.g. a formula's `defaults.yaml` / `osfamilymap.yaml`) switch to
  Salt Jinja when opened. YAML quoting `{{ }}` inside values (Ansible,
  Helm, GitHub Actions) and files another extension claimed are left
  alone; switching a file back to YAML sticks for the session.
  `saltSyntax.detectJinjaInYaml` turns it off.
  [#27](https://github.com/naqoyqatsi83/salt-syntax/issues/27)

## [0.8.0] - 2026-09-24

### Added
- Jinja indentation check, on by default (`saltSyntax.jinjaIndentCheck`
  to turn it off): warns when a line-leading `{% %}` tag's indentation
  contradicts its nesting — every tag inside a block two spaces deeper
  than the block's opening tag, and a block's `elif`/`else`/`end...` tags
  level with it — with quick fixes to re-indent one tag or every flagged
  tag in the file. Jinja completion follows the same rule: a block,
  statement or keyword it inserts at the start of a line also moves that
  line to the right nesting depth.
  [#24](https://github.com/naqoyqatsi83/salt-syntax/issues/24)
- Enter at the end of a line starting with a Jinja `{% %}` tag puts the
  cursor where the next tag belongs — two spaces deeper than the innermost
  open block — instead of VS Code's generic auto-indent (which for `.sls`
  even dedented a level). `saltSyntax.jinjaEnterIndent` = `column0` always
  goes to column 0 instead; Enter after YAML lines is unaffected. Turns on
  `editor.formatOnType` for `.sls` files.
  [#25](https://github.com/naqoyqatsi83/salt-syntax/issues/25)

## [0.7.1] - 2026-09-23

### Added
- Extension icon (`images/icon.png`, SVG source in `images/icon.svg`) and
  a matching `galleryBanner` for the Marketplace / Open VSX listing.
  [#21](https://github.com/naqoyqatsi83/salt-syntax/issues/21)

### Fixed
- The packaged `.vsix` no longer includes `AGENTS.md` or `examples/`
  (contributor notes and a grammar development sample, not anything the
  extension uses at runtime), nor the icon's SVG source.
  [#22](https://github.com/naqoyqatsi83/salt-syntax/issues/22)

## [0.7.0] - 2026-09-23

### Added
- Cursor on a Jinja block tag highlights every tag of that same block —
  `if`/`elif`/`else`/`endif`, `for`/`else`/`endfor`, `macro`, `call`,
  `set` blocks, `raw`, and the rest — pairing nested blocks correctly and
  skipping tags Jinja itself ignores (inside `{# #}`, toggled-off
  `{#% %#}`, or `{% raw %}`). Same-word highlighting still works
  everywhere else.
  [#20](https://github.com/naqoyqatsi83/salt-syntax/issues/20)

### Fixed
- `Ctrl+/` on a multi-line selection now also neutralizes every Jinja
  `{% ... %}` tag in it (`{#% ... %#}`), not just prefixes each line with
  `# ` — Jinja renders before YAML parses, so a line-commented
  `{% if %}`/`{% else %}`/`{% endif %}` was still live and changed what
  the "commented-out" block rendered. Uncommenting restores both.
  [#19](https://github.com/naqoyqatsi83/salt-syntax/issues/19)

## [0.6.0] - 2026-09-22

### Added
- Non-ASCII check, on by default (`saltSyntax.nonAsciiCheck` to turn it
  off): warns about every non-ASCII character in `.sls` files — smart
  quotes, dashes, non-breaking/zero-width spaces, accented letters — since
  older minions (Python 2 / non-UTF-8 locale) can fail to render a file
  containing one. Quick fixes replace each with an ASCII equivalent, or
  convert the whole file at once (also the new **Salt Syntax: Convert
  Non-ASCII Characters to ASCII** command, and a `source.fixAll` action
  for `editor.codeActionsOnSave`).
  [#16](https://github.com/naqoyqatsi83/salt-syntax/issues/16)

### Fixed
- RC tags (`vX.Y.Z-rc.N`) now publish as a GitHub pre-release instead of
  a full release that GitHub marks as **Latest** over the actual latest
  stable version.
  [#17](https://github.com/naqoyqatsi83/salt-syntax/issues/17)

## [0.5.0] - 2026-09-20

### Added
- `saltSyntax.saltVersion` setting (`3008` default / `3006`) and a
  matching `Salt Syntax: Set Salt Version` command, letting state module
  completions target Salt's 3006.x LTS line instead of 3008.x. 3006.x
  still ships many state modules (mostly third-party cloud/provider
  integrations — `boto_*`, `libcloud_*`, `zabbix_*`, `pagerduty_*`, and
  others) that 3008.x dropped when their dependencies were split out into
  separate salt-extensions packages, so switching to `3006` unlocks
  completions for those states (353 modules vs. 128 under `3008`).
  [#14](https://github.com/naqoyqatsi83/salt-syntax/issues/14)

### Changed
- CI (`.github/workflows/build.yml`) now runs only on a `v*` tag push (or
  manual `workflow_dispatch`), not on every `develop`/`main` push. The
  release flow pushes the same already-tested commit to `develop`, then
  `main`, then the tag — three identical runs for one release.
  [#13](https://github.com/naqoyqatsi83/salt-syntax/issues/13)

### Fixed
- `.vscodeignore` now excludes `.claude/**`, which was being packaged
  into the `.vsix` by accident.
  [#18](https://github.com/naqoyqatsi83/salt-syntax/issues/18)

## [0.4.0] - 2026-09-20

### Added
- `Ctrl+/`/`Cmd+/` on a single line containing a Jinja tag comments out
  just that tag using Jinja's own comment syntax (`{% x %}` <->
  `{#% x %#}`, `{{ x }}` <-> `{#{ x }#}` — a single `#` inserted just
  inside each delimiter, trivially reversible), instead of the normal
  line-comment behavior. Multiple tags on one line toggle independently.
  Anything else (multi-line selection, no Jinja tag on the line, a
  genuine pre-existing `{#- ... #}` comment) falls through to VS Code's
  normal line-comment command unchanged.
  [#10](https://github.com/naqoyqatsi83/salt-syntax/issues/10)
- `saltSyntax.jinjaWhitespaceControl` setting (default `false`) to opt
  every `{% %}` block this extension generates into leading-trim form
  (`{%- if %}` ... `{%- endif %}`, matching this repo's own example file
  and common Salt-formula convention) instead of the plain `{% %}` it
  generates by default.
  [#11](https://github.com/naqoyqatsi83/salt-syntax/issues/11)

### Fixed
- Module completion with some leading indentation and nothing valid to
  nest under (accidental/leftover indentation, common after editing)
  produced a nested function stub with no `{{ sls }}` id line instead of
  a full block — the only check was `indent.length === 0`. Now checks
  whether the line directly above is actually a valid unindented state
  declaration; if not, it's still treated as a fresh top-level block and
  the stray indentation is reset to column 0.
  `saltSyntax.smartTopLevelDetection` (default `true`) can turn this back
  off for strict indentation-only detection.
  [#12](https://github.com/naqoyqatsi83/salt-syntax/issues/12)

## [0.3.3] - 2026-09-19

### Added
- `.sls`-specific editor defaults: render whitespace (spaces as `·`, tabs
  as `→`), insert/trim a single final newline on save, and enforce LF line
  endings. [#1](https://github.com/naqoyqatsi83/salt-syntax/issues/1)
- `saltSyntax.prependSlsToStateId` setting (default `true`) to control
  whether the full-block completion prepends `{{ sls }}.` to the generated
  state ID, for people who don't use that convention. Read live, no reload
  needed. [#7](https://github.com/naqoyqatsi83/salt-syntax/issues/7)
- `saltSyntax.showWhitespace` / `saltSyntax.enforceLfLineEndings` /
  `saltSyntax.enforceFinalNewline` settings (all default `true`) as a
  dedicated, discoverable wrapper around the existing
  `editor.renderWhitespace`/`files.eol`/`files.insertFinalNewline`+
  `trimFinalNewlines` `.sls` defaults. Disabling one actively writes an
  explicit `"[sls]"` override restoring VS Code's own built-in default
  (since a `configurationDefault` can only be overridden by an explicit
  value, not cleared); re-enabling removes that override again, falling
  back to this extension's defaults as normal. Synced on activation and
  immediately on change — no reload needed.
  [#9](https://github.com/naqoyqatsi83/salt-syntax/issues/9)
- Every `module.function` completion with real arguments beyond `name` now
  also offers a `(full)` variant alongside the existing basic one, with
  every parameter the function actually accepts (real names and real
  default values, parsed straight from its Salt v3008.2 source signature —
  e.g. `file.managed (full)` has all 49). Functions with nothing beyond
  `name` don't get a redundant `(full)` entry.
  [#4](https://github.com/naqoyqatsi83/salt-syntax/issues/4)

### Changed
- `module.function` completion now covers all 128 state modules that exist
  in Salt v3008.2 (the latest stable release), with function names
  extracted directly from `salt/states/*.py` at that release tag (a
  function only counts if it's a top-level `def` taking `name` as its
  first parameter — Salt's real convention for state functions — which
  also filters out internal hook functions like `mod_watch`/`mod_beacon`
  that are never written by hand in an SLS file) instead of a ~23-module
  hand-guessed list. [#2](https://github.com/naqoyqatsi83/salt-syntax/issues/2)

### Fixed
- `pip`/`virtualenv` module completion used the wrong public names (the
  underlying files are `pip_state.py`/`virtualenv_mod.py` — Salt exposes
  them as `pip`/`virtualenv` via `__virtualname__`, which the old
  hand-written list got right by luck but couldn't verify).
  `supervisord`, which isn't part of current core Salt, is no longer
  suggested. [#2](https://github.com/naqoyqatsi83/salt-syntax/issues/2)
- The #2 extraction was pulled from `master` (unreleased) rather than a
  stable release, which meant suggesting 3 modules (`dnfmodule`,
  `postgres_default_privileges`, `python`) and 2 `pkg` functions
  (`trusted`, `untrusted`) that don't exist in any released Salt yet.
  Re-pinned to `v3008.2`.
  [#3](https://github.com/naqoyqatsi83/salt-syntax/issues/3)
- The `(full)` completion variant ended with the same trailing blank
  `- ` arg line the basic variant uses to invite adding more args — except
  `(full)` already lists every real argument, so there's nothing left to
  add. [#5](https://github.com/naqoyqatsi83/salt-syntax/issues/5)
- Basic completion could omit arguments Salt genuinely requires — it only
  ever showed a small curated set, or just `name` for anything not
  curated, with no guarantee of covering what's actually mandatory (e.g.
  `acl.absent` needs `acl_type` too, but had no curated entry). Every
  parameter with no default at all in the real v3008.2 signature is now
  merged into basic automatically, even with no curated entry. Also
  dropped basic's own trailing blank `- ` line (see #5 above) now that
  it's no longer needed to invite adding a still-missing required arg.
  [#6](https://github.com/naqoyqatsi83/salt-syntax/issues/6)
- README's basic-completion example still showed the trailing blank `- `
  line removed in #6, and its wording hadn't caught up with the mandatory-
  args guarantee added in the same change. The project file tree in both
  README and AGENTS.md was missing `AGENTS.md`, `CHANGELOG.md`, `LICENSE`,
  and `.github/workflows/build.yml`. `package.json`'s `package` script also
  used a bare `vsce package`, which fails without a global install —
  inconsistent with what CI and the docs actually run.
  [#8](https://github.com/naqoyqatsi83/salt-syntax/issues/8)

## [0.3.2] - 2026-09-19

Initial release.

### Added
- Self-contained TextMate grammar for `.sls` files (YAML + embedded
  Jinja2). Doesn't extend VS Code's built-in YAML grammar — a Jinja tag
  leading a YAML key (`{{ sls }}.state_id:`, the common Salt pattern)
  breaks that grammar's indentation-tracking `begin`/`while` state machine,
  producing stray `invalid.illegal` tokens. Matches each line's whole
  shape (state id / module key / argument key / list item) explicitly
  instead.
- Jinja scope names shared with the Jinja/Django/Twig TextMate lineage, so
  themes with existing templating support (a common convention) render
  Salt Syntax's output with their intended palette.
- Completion: module name + `.` at the start of a line inserts a full
  `{{ sls }}.<state_id>: / module.function: / - args...` block with tab
  stops on the id and every argument that needs a real value; the same
  under an existing state id inserts just the function stub. Several
  module/function combos have their typical arguments prefilled.
- Completion: bare Jinja keywords outside a tag (`if`, `for`, `set`, ...)
  offer the shapes that keyword can take (e.g. `if`/`if-else`/
  `if-elif-else`) as a full `{% %}` block; inside an open tag, suggests
  keywords/filters/Salt globals reactively rather than on every keystroke.
- Snippets for common boilerplate (file header, `tplroot`/`map.jinja`
  import, full state blocks for common module/function pairs).
- `editor.quickSuggestions` tuned for `.sls` files so completion works
  inside plain scalar values too, without changing how they're colored.
