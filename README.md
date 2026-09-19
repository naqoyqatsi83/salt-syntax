<p align="center">
  <img src="https://img.shields.io/badge/VS%20Code-1.80%2B-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="VS Code">
  <img src="https://img.shields.io/badge/javascript-ES2020-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/Salt-SLS-00E272?style=for-the-badge&logo=saltproject&logoColor=white" alt="Salt">
  <img src="https://img.shields.io/badge/Jinja2-templating-B41717?style=for-the-badge&logo=jinja&logoColor=white" alt="Jinja2">
  <img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" alt="MIT License">
</p>

<h1 align="center">Salt Syntax</h1>

<p align="center">
  <b>Syntax highlighting, coloring, and IntelliSense for SaltStack SLS files</b><br>
  YAML + Jinja2, in one grammar that treats them as what they actually are
</p>

<br>

Salt Syntax is a VS Code language extension for `.sls` files — SaltStack's
YAML-with-embedded-Jinja2 state files. It ships a purpose-built TextMate
grammar (not a bolt-on of VS Code's built-in YAML grammar — see
[Why a custom grammar](#why-a-custom-grammar) below), a set of completion
providers that react to what you're actually typing, and a handful of
snippets for common boilerplate.

## What it does

### Syntax highlighting

A self-contained grammar for the line shapes Salt SLS files actually use:

- **State declarations** (`{{ sls }}.foo:`) and **module/argument keys**
  each get their own scope, with Jinja recognized and separately scoped
  wherever it appears — including inside a key, which is exactly the case
  that trips up naive "YAML + Jinja" grammars (see below).
- Every Jinja construct — `{{ }}`, `{% %}`, `{# #}`, keywords, filters,
  operators, strings — is scoped using conventions shared with the
  Jinja/Django/Twig TextMate lineage, so themes that already have rules for
  templating languages (a common convention going back to the original
  TextMate/Sublime bundles) render Salt Syntax's output with their full
  intended palette, while themes that only style the generic
  `keyword`/`variable`/`string`/`comment` categories still get sensible,
  distinct colors.
- Doesn't touch or depend on any other language's grammar, so it can't
  conflict with other extensions or color themes.

#### Why a custom grammar

The obvious first approach — `{ "patterns": [{ "include": "source.jinja" },
{ "include": "source.yaml" }] }` — looks reasonable and is what most
Jinja-in-YAML grammars (including earlier attempts at this one) actually
ship. It has a real bug: VS Code's YAML grammar tracks indentation with
nested `begin`/`while` constructs, and once a Jinja tag leads a YAML *key*
(exactly the common Salt pattern `{{ sls }}.state_id:`), the YAML tokenizer
can't resume correctly afterward — the rest of that line renders as
`invalid.illegal`, visible as stray red-background artifacts in most themes.
This was verified directly by tokenizing real SLS files through both the
naive approach and VS Code's actual grammar/theme-matching engine before
writing a single rule of the replacement. Salt Syntax's grammar instead
matches each line's whole shape (state id / module key / argument key / list
item) explicitly, so Jinja-led keys are handled correctly from the start.

### Autocompletion

- **Type a module name + `.` at the start of a line** (e.g. `file.`) to get
  its common state functions (`managed`, `absent`, ...). Picking one inserts
  a full block:

  ```sls
  {{ sls }}.<state_id>:
    file.managed:
      - name: /path/to/file
      - source: salt://path/to/source
      - user: root
      - group: root
      - mode: '0644'
      -
  ```

  with tab stops on the state id and every argument that needs a real
  value, ending on a free `- ` line for anything else. `pkg.*`,
  `service.running`/`dead`, `file.managed`/`directory`/`symlink`,
  `user`/`group.present`, `cmd.run`, `mount.*`, `archive.extracted`,
  `git.latest`, `cron.present`, and `lvm.lv_*` have their typical arguments
  prefilled; anything else falls back to just `name`.
- Type a module name + `.` **under an existing state id** (2–6 space
  indent) instead inserts just the function stub at that indent, since the
  id line is already there.
- Start of a state-function line (2–6 space indent) suggests common Salt
  execution modules (`pkg`, `service`, `file`, `user`, `cmd`, `mount`,
  `lvm`, `git`, ...).
- After `- ` suggests common requisites/args (`require`, `watch`, `onlyif`,
  `unless`, `name`, `names`, `source`, `mode`, ...).
- Type a bare Jinja keyword anywhere outside a tag (`for`, `if`, `set`,
  `macro`, `with`, `call`, `from`, `import`, `include`, `raw`, ...) and pick
  from the shapes that keyword can take — e.g. typing `if` offers
  `if…endif`, `if…else…endif`, and `if…elif…else…endif` as separate
  choices — to insert the full `{% ... %}` block; you don't have to type the
  tag delimiters by hand first. Nothing this extension inserts uses Jinja's
  `-` whitespace-control markers (`{%- ... -%}`) — plain `{% %}` / `{{ }}` /
  `{# #}` only. The grammar still highlights `-` markers correctly if you
  type them yourself.
- Inside an already-open `{{ }}` / `{% %}` suggests bare Jinja keywords,
  filters (`default`, `json`, `yaml`, `regex_replace`, ...) and Salt globals
  (`salt`, `grains`, `pillar`, `sls`, `tpldir`, ...). This only reacts to
  what you're actually typing (a word, or right after `{{`/`{%`/`|`) — it
  won't re-dump the full list on every space.

### Snippets

Boilerplate that isn't really "completion" so much as "type a short prefix,
get a block": `sls-header` (coding/vim header), `jinja-tplroot`,
`jinja-import-map`, and full state-block templates for the most common
module/function pairs (`state-pkg-installed`, `state-service-running`,
`state-file-managed`, `state-cmd-run`, `req-require`, ...).

### Language configuration

Comments (`#`, `{# #}`), bracket matching and auto-close for `{{ }}` /
`{% %}` / `{# #}`, and sensible YAML-style indentation (2-space, spaces not
tabs) — set as this extension's editor defaults for `.sls` files, along with
`editor.quickSuggestions` tuned so completion reacts inside plain scalar
values too (VS Code disables quick suggestions inside `string`-scoped text
by default, and unquoted YAML values are scoped as strings here to color
correctly — this re-enables suggestions there without changing the
coloring).

## Installation

### From a release

Grab the `.vsix` from the [Releases](../../releases) page (or the latest
[Actions](../../actions) build artifact), then:

```bash
code --install-extension salt-syntax-<version>.vsix
```

### From source

```bash
git clone https://github.com/naqoyqatsi83/salt-syntax.git
cd salt-syntax
npx --yes @vscode/vsce package --no-dependencies
code --install-extension salt-syntax-<version>.vsix
```

Or press `F5` in VS Code (with this folder open) to launch an Extension
Development Host with it loaded live from source.

## Development

```
salt-syntax/
├── package.json                    # Extension manifest (languages, grammars, snippets)
├── language-configuration.json     # Comments, brackets, auto-close, indentation
├── syntaxes/sls.tmLanguage.json    # TextMate grammar
├── snippets/sls-snippets.json      # Static snippets
├── src/extension.js                # Completion providers (plain JS, no build step)
└── examples/uninstall_formula.sls  # Sample file used while developing the grammar
```

No build step — `src/extension.js` runs as-is. `npm run package` (or
`npx @vscode/vsce package`) produces the `.vsix`.

CI (`.github/workflows/build.yml`) validates every JSON file, checks
`extension.js` syntax, and packages the extension on every push/PR to
`main`/`develop`, uploading the `.vsix` as a build artifact. Pushing a `v*`
tag additionally attaches that build's `.vsix` to a GitHub Release.

### Branching & releases

All work happens on `develop`; `main` only moves via merging `develop` in
at tag time (see [AGENTS.md](AGENTS.md) for the full policy).
[CHANGELOG.md](CHANGELOG.md) tracks unreleased changes as they land, moving
under a version heading when tagged.

## Credits

The convention of giving Jinja tokens scope names shared with the
Jinja/Django/Twig TextMate lineage — so themes with existing templating
support render them well — follows the same approach used by
[samuelcolvin/jinjahtml-vscode](https://github.com/samuelcolvin/jinjahtml-vscode),
which an earlier, since-unmaintained version of this extension was built on
top of.

## License

MIT — see [LICENSE](LICENSE).

Salt Syntax is not affiliated with or endorsed by SaltStack / VMware /
Broadcom.
