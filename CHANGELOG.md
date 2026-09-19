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
- `.sls`-specific editor defaults: render whitespace (spaces as `·`, tabs
  as `→`), insert/trim a single final newline on save, and enforce LF line
  endings. [#1](https://github.com/naqoyqatsi83/salt-syntax/issues/1)

### Changed
- `module.function` completion now covers all 131 of Salt's official state
  modules, with function names extracted directly from `salt/states/*.py`
  on `saltstack/salt` (a function only counts if it's a top-level `def`
  taking `name` as its first parameter — Salt's real convention for state
  functions — which also filters out internal hook functions like
  `mod_watch`/`mod_beacon` that are never written by hand in an SLS file)
  instead of a ~23-module hand-guessed list.
  [#2](https://github.com/naqoyqatsi83/salt-syntax/issues/2)

### Fixed
- `pip`/`virtualenv` module completion used the wrong public names (the
  underlying files are `pip_state.py`/`virtualenv_mod.py` — Salt exposes
  them as `pip`/`virtualenv` via `__virtualname__`, which the old
  hand-written list got right by luck but couldn't verify).
  `supervisord`, which isn't part of current core Salt, is no longer
  suggested. [#2](https://github.com/naqoyqatsi83/salt-syntax/issues/2)

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
