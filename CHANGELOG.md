# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Every entry links the GitHub issue that tracked it — see the Workflow
section in [AGENTS.md](AGENTS.md) for how work flows from issue to
`develop` to a tagged release.

## [Unreleased]

Changes land here as they're merged to `develop`, then move under a
version heading when that state gets tagged and merged to `main`.

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
