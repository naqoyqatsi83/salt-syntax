<p align="center">
  <img src="https://img.shields.io/badge/VS%20Code-1.80%2B-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="VS Code">
  <img src="https://img.shields.io/badge/javascript-ES2020-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/Salt-SLS-00E272?style=for-the-badge&logo=saltproject&logoColor=white" alt="Salt">
  <img src="https://img.shields.io/badge/Jinja2-templating-B41717?style=for-the-badge&logo=jinja&logoColor=white" alt="Jinja2">
  <img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" alt="MIT License">
</p>

<p align="center">
  <img src="images/icon.png" width="128" alt="Salt Syntax icon">
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
  its real state functions (`managed`, `absent`, ...) — all 128 state
  modules that exist in Salt v3008.2 (the latest stable release) are
  covered by default, with function names extracted directly from
  `salt/states/*.py` at that release tag (not guessed, and not from
  `master`, which carries unreleased modules/functions — see the comment
  above `MODULE_FUNCTIONS_3008` in `src/extension.js`), so `module.function`
  combos that don't actually exist in a released Salt don't show up. Set
  `saltSyntax.saltVersion` to `3006` (or run **Salt Syntax: Set Salt
  Version**) to complete against Salt's 3006.x LTS line instead — 353
  modules, including many third-party cloud/provider states (`boto_*`,
  `libcloud_*`, `zabbix_*`, `pagerduty_*`, and others) that 3008.x dropped
  when their dependencies were split out into separate salt-extensions
  packages. Picking one inserts a full block:

  ```sls
  {{ sls }}.<state_id>:
    file.managed:
      - name: /path/to/file
      - source: salt://path/to/source
      - user: root
      - group: root
      - mode: '0644'
  ```

  with tab stops on the state id and every value, landing the cursor right
  after the last one. `pkg.*`, `service.running`/`dead`,
  `file.managed`/`directory`/`symlink`, `user`/`group.present`, `cmd.run`,
  `mount.*`, `archive.extracted`, `git.latest`, `cron.present`, and
  `lvm.lv_*` have their typical arguments curated like this; anything else
  falls back to just `name` — **plus any argument Salt genuinely requires**
  (parameters with no default at all in the real function signature are
  merged in automatically, even with no curated entry — e.g. `acl.absent`
  has no curated entry but still gets `acl_type` alongside `name`, since
  Salt would otherwise reject the state outright). Add another
  `- key: value` line by hand, same as any other YAML edit, for anything
  beyond what's shown.
- **Every function with real arguments beyond `name` also offers a `(full)`
  variant** — e.g. typing `file.` shows both `managed` (the handful above)
  and `managed (full)`, which includes *every* parameter `file.managed`
  actually accepts (49 of them), each defaulted to its real value from
  Salt's own source (`source: None`, `keep_source: True`,
  `sig_backend: 'gpg'`, ...), all as tab stops. Functions with nothing
  beyond `name` (e.g. `archive.extracted` has none) don't get a redundant
  `(full)` entry. Data for both variants — and which arguments count as
  mandatory for `basic` — is extracted the same way as the module list
  itself (see below), not hand-written.
- Type a module name + `.` **under an existing state id** (some leading
  indentation, with a valid unindented state declaration directly above to
  nest under) instead inserts just the function stub at that indent, since
  the id line is already there. With no valid id line above, any leading
  indentation is treated as accidental — the full block is inserted anyway,
  reset to column 0 (`saltSyntax.smartTopLevelDetection`, on by default;
  disable for strict indentation-only detection instead).
- Start of a state-function line (2–6 space indent) suggests from all state
  modules in the active `saltSyntax.saltVersion` line (`pkg`, `service`,
  `file`, `user`, `cmd`, `mount`, `lvm`, `git`, `win_dacl`, `postgres_user`,
  `rabbitmq_vhost`, ...).
- After `- ` suggests common requisites/args (`require`, `watch`, `onlyif`,
  `unless`, `name`, `names`, `source`, `mode`, ...).
- Type a bare Jinja keyword anywhere outside a tag (`for`, `if`, `set`,
  `macro`, `with`, `call`, `from`, `import`, `include`, `raw`, ...) and pick
  from the shapes that keyword can take — e.g. typing `if` offers
  `if…endif`, `if…else…endif`, and `if…elif…else…endif` as separate
  choices — to insert the full `{% ... %}` block; you don't have to type the
  tag delimiters by hand first. By default nothing this extension inserts
  uses Jinja's `-` whitespace-control markers — plain `{% %}` / `{{ }}` /
  `{# #}` only; the grammar always highlights `-` markers correctly
  regardless. Set `saltSyntax.jinjaWhitespaceControl` to opt every `{% %}`
  block this extension generates into leading-trim form instead
  (`{%- if %}` ... `{%- endif %}`).
- Inside an already-open `{{ }}` / `{% %}` suggests bare Jinja keywords,
  filters (`default`, `json`, `yaml`, `regex_replace`, ...) and Salt globals
  (`salt`, `grains`, `pillar`, `sls`, `tpldir`, ...). This only reacts to
  what you're actually typing (a word, or right after `{{`/`{%`/`|`) — it
  won't re-dump the full list on every space.

### Matching Jinja block highlight

Put the cursor on any Jinja block tag and every tag of that same block
lights up — `{% if %}` with its own `{% elif %}` / `{% else %}` /
`{% endif %}`, `{% for %}` with its `{% endfor %}` (and its own
`{% else %}`, which is a different thing from an `if`'s), `macro`, `call`,
`filter`, `with`, `block`, `autoescape`, `trans`/`pluralize`, `raw`, and
block `{% set x %}...{% endset %}`. Nested blocks pair correctly, and tags
can span lines. Tags Jinja itself ignores — inside a `{# #}` comment,
toggled off as `{#% %#}`, or inside `{% raw %}` — are ignored here too;
tags on a YAML `#` comment line are *not*, since Jinja still runs them.

Anywhere else, you get VS Code's usual same-word highlighting. It's
VS Code's own occurrence highlight, so `editor.occurrencesHighlight`
turns both off.

### Smart comment toggle

`Ctrl+/` (`Cmd+/` on macOS) on a single line that contains a Jinja tag
comments out just that tag, using Jinja's own comment syntax — insert a `#`
right after the opening brace and right before the closing one:

```sls
{{ sls }}.service_dead:
```

`Ctrl+/` on that line turns it into:

```sls
{#{ sls }#}.service_dead:
```

This works because Jinja's lexer just looks for the next literal `{#` to
start a comment and the next `#}` to end it — it doesn't care what's in
between, so `{#% x %#}` and `{#{ x }#}` are both valid, ordinary Jinja
comments, and pressing `Ctrl+/` again strips exactly the two `#`s it added
(round-trips perfectly, `-` whitespace-control markers included). Multiple
tags on one line toggle independently, based on each one's own current
state.

On a **multi-line selection**, `Ctrl+/` line-comments every line with `# `
as usual — but also turns each `{% ... %}` tag in it into `{#% ... %#}`.
A YAML `#` alone doesn't stop Jinja: Jinja renders the whole file before
YAML ever sees it, so a plain `# {% if x %}` / `# {% else %}` would still
run and change what the "commented-out" block produces. So this:

```sls
{% if condition %}
{{ sls }}.state_id:
  file.managed:
    - name: /path/to/file
{% endif %}
```

becomes:

```sls
# {#% if condition %#}
# {{ sls }}.state_id:
#   file.managed:
#     - name: /path/to/file
# {#% endif %#}
```

`{{ }}` expressions are left as-is — inside a YAML comment their output is
just more comment text. `Ctrl+/` again on the fully commented block strips
the `# ` and re-enables the tags. Anything else — multiple cursors, a
multi-line selection with no `{% %}` tags, a line with no Jinja tag, or a
genuine pre-existing `{#- ... #}` comment (nothing to toggle) — falls
straight through to VS Code's normal line-comment behavior, unchanged.

### Non-ASCII check

Older minions — Python 2 based Salt, or any minion running under a
non-UTF-8 locale — can fail to render an SLS file that contains a non-ASCII
character *anywhere*, comments included. The usual culprits are look-alike
or invisible characters pasted in from docs, chat or a wiki: smart quotes
(`“ ” ‘ ’`), en/em dashes (`– —`), non-breaking and zero-width spaces, and
accented letters.

Every such character gets a warning (in the editor and the Problems panel)
naming it and its code point, with a quick fix (`Ctrl+.`) that replaces it
with an ASCII equivalent — `“` → `"`, `–` → `-`, NBSP → space, zero-width
characters removed, `é` → `e`, `ß` → `ss`, and so on — plus a
**Convert all non-ASCII characters in file to ASCII** fix, also available as
the **Salt Syntax: Convert Non-ASCII Characters to ASCII** command.
Characters with no sensible ASCII equivalent (CJK, emoji, ...) are still
flagged, just left for you to rewrite by hand.

On by default; turn it off with `saltSyntax.nonAsciiCheck`. The whole-file
conversion is also exposed as a `source.fixAll` action, so if you want it
applied automatically on every save rather than just flagged, add this to
your settings:

```json
"[sls]": {
  "editor.codeActionsOnSave": { "source.fixAll": "explicit" }
}
```

### Jinja indentation check

Jinja doesn't care how its tags are indented, but a reader does: an
`{% if %}` inside a `{% for %}` written at column 0 reads as if it were
outside the loop. So every line starting with a `{% %}` tag whose
indentation contradicts its nesting gets a warning:

```sls
{% for item in items %}
{% if item.enabled %}      {# ⚠ expected 2 spaces (inside {% for %} on line 1) #}
  ...
{% endif %}                {# ⚠ expected 2 spaces (level with its {% if %} on line 2) #}
{% endfor %}
```

The rule: every tag inside a block sits two spaces deeper than the block's
opening tag — block tags and everything else alike (`set`, `include`,
`do`, ...) — and a block's own `elif`/`else`/`end...` tags sit level with
its opening tag. Nesting is measured from where each opening tag *should*
be, so one misplaced `{% if %}` flags its `else`/`endif` too, all at once.
A top-level tag sets its own baseline, so Jinja inside an indented YAML
block (`contents: |`) nests from wherever it starts. Only tags that start
their line are checked (`- name: {% if x %}a{% endif %}` is left alone),
and tags Jinja itself ignores — inside `{# #}`, toggled off as `{#% %#}`,
or inside `{% raw %}` — don't count. YAML lines between tags aren't
affected; YAML has its own indentation rules.

Each warning has a quick fix (`Ctrl+.`) to re-indent that tag, plus one to
re-indent every flagged tag in the file. On by default; turn it off with
`saltSyntax.jinjaIndentCheck`.

Jinja completion follows the same rule as you type, so what it inserts is
never what the check then flags: picking a block or statement (`set`,
`if`, `for`, ...) on a line of its own, or a keyword right after a
line-leading `{%`, also moves that line to where the nesting says it
belongs — two spaces deeper than the enclosing block, or level with it for
`elif`/`else`/`end...`. At the top level there's nothing to follow, so the
line keeps its indentation.

Pressing Enter at the end of a line that starts with a `{% %}` tag works
the same way: the new line lands where the next tag would belong — two
spaces deeper than the innermost open block, so Enter after a nested
`{% if %}` inside a `{% for %}` puts you inside both, and after an
`{% endif %}` back at its enclosing level. Pressing Enter *in front of* a
tag (e.g. before `{% endfor %}`) places the tag it pushes down the same
way — level with its block for `elif`/`else`/`end...` — rather than
copying the indentation of whatever line is above; in front of any other
line (a state ID, `- name:`, ...) the pushed-down line simply keeps the
indentation it had. Prefer the cursor to
always go to column 0 after a Jinja tag line instead? Set
`saltSyntax.jinjaEnterIndent` to `column0`. Enter after any other line —
YAML — keeps VS Code's normal auto-indent either way.

### Other Salt files: `.jinja`, and YAML with Jinja in it

Salt formulas are more than `.sls`: there's `map.jinja` and macro
libraries, plus YAML data files (`defaults.yaml`, `osfamilymap.yaml`,
`parameters/**/*.yaml`, ...) that `import_yaml` renders through Jinja too.
Those get a second language, **Salt Jinja** — same grammar, same Jinja
features, minus the ones that only make sense in a state file:

| | `.sls` | Salt Jinja |
|---|---|---|
| Highlighting, `Ctrl+/` comment toggle, matching block highlight | ✓ | ✓ |
| Jinja indentation check, Enter indentation, non-ASCII check | ✓ | ✓ |
| Jinja keyword / filter / block completion | ✓ | ✓ |
| `module.` → state function completion, requisites after `- ` | ✓ | — |

- **`.jinja` files** are Salt Jinja automatically.
- **`.yaml` / `.yml` files** switch to Salt Jinja when they open if a line
  *starts* with a Jinja `{% %}` or `{# #}` tag — the style Salt's YAML
  data files use. YAML that only quotes `{{ }}` inside values (Ansible,
  Helm, GitHub Actions workflows) isn't affected, and neither is a file
  another extension has already claimed (e.g. Ansible's own language).
  Switched one that shouldn't be? Pick **YAML** again from the language
  picker in the status bar — it stays YAML for the rest of the session.
  Turn detection off entirely with `saltSyntax.detectJinjaInYaml`.
- **Whole folders**, regardless of content, via VS Code's own
  `files.associations`:

  ```json
  "files.associations": {
    "**/salt/**/*.yaml": "salt-jinja"
  }
  ```

The editor defaults and `saltSyntax.*` toggles under
[Language configuration](#language-configuration) apply to Salt Jinja
files the same way.

### Rendered preview

See what a formula actually renders to — the YAML Salt would get — without
a master or a minion. **Ctrl+K V** (or the preview button in the editor
title bar, or *Salt Syntax: Open Rendered Preview*) opens the rendered
output beside the `.sls` / Salt Jinja file, updating as you type.

- **Real Jinja2, Salt's environment.** Rendering uses Jinja2 through your
  `python3` (needs `pip install jinja2 pyyaml`; Salt itself isn't needed)
  with Salt's Jinja emulated: `sls`/`tpldir`/`slspath`/`saltenv` from the
  file's path, `map.jinja` / `import_yaml` / `load_*` / `salt://` and
  `./relative` imports processed for real, Salt's sandbox and
  `StrictUndefined`, `raise()`, and every one of Salt's Jinja filters.
  The output is shown character for character as Salt produces it —
  never reformatted.
- **You supply what isn't in the files.** Every external value the render
  needs — grains, pillar keys, config/opts, other `salt[...]` calls such
  as `cmd.run`, environment-dependent filters (`dns_check`, `http_query`,
  …), undefined variables — is listed in the **Salt Preview** panel,
  prefilled with the default written in the code. Type a value (as YAML:
  `8080`, `RedHat`, `[a, b]`, `{k: v}`) and the preview re-renders;
  questions appear as the render reaches them (answer `os_family:
  RedHat` and the RedHat-only inputs show up). Answers are remembered per
  file. Nothing Salt-side is ever executed; an unanswered value without a
  default shows as a visible `«grains:os»`-style placeholder.
- **Problems Salt would hit, where they are.** Checked against Salt's own
  code for the selected `saltSyntax.saltVersion` (3006 or 3008) and shown
  as warnings — squiggles, the Problems panel, inline tools like Error
  Lens — on the formula line that caused them, and on the rendered line
  where the output shows it:
  - render errors and undefined values (`Jinja variable 'x' is undefined`)
  - invalid YAML and duplicate state IDs, every one, on the line at fault
  - Salt's state-compiler checks (`- name /etc/x` missing its colon, no or
    too many functions, malformed requisites, …) with Salt's own messages
  - unknown `module.function`, missing required arguments, `include:`
    targets that don't exist
  - arguments that rendered empty (`- name:`), and requisite / `extend:`
    targets defined neither in the file nor in anything it includes
- **Scrolls with the formula.** Scroll either side and the other follows
  to the matching line — a loop's lines to its first pass, a
  `{% include %}`d template's output to the include line. The lock button on the preview's title
  bar unlinks them (and links them again).
- **Back to the source.** In the preview, **F12** (or right-click → *Go to
  Formula Line*) jumps to the formula line that produced the line under
  the cursor.
- **Setup:** set `saltSyntax.preview.fileRoots` to your Salt tree (like
  the master's `file_roots`) if it isn't the open workspace folder; on
  Windows point `saltSyntax.preview.pythonPath` at your Python (`python`
  or `py`, not the `python3` Store stub).

What it can't show is anything that only happens when states *run* on a
minion — a package that doesn't exist, a command that fails.

### Snippets

Boilerplate that isn't really "completion" so much as "type a short prefix,
get a block": `sls-header` (coding/vim header), `jinja-tplroot`,
`jinja-import-map`, and full state-block templates for the most common
module/function pairs (`state-pkg-installed`, `state-service-running`,
`state-file-managed`, `state-cmd-run`, `req-require`, ...).

### Language configuration

Comments (`#`, `{# #}`), bracket matching and auto-close for `{{ }}` /
`{% %}` / `{# #}`, and sensible YAML-style indentation (2-space, spaces not
tabs) — set as this extension's editor defaults for `.sls` files, along with:

- Typing `{{` auto-closes padded on *both* sides — `{{ | }}`, cursor in the
  middle — for the usual `{{ variable }}` style
  (`saltSyntax.padJinjaExpressions`). `{%` isn't padded before the cursor,
  since it's so often typed as `{%-` (whitespace control).

- `editor.quickSuggestions` tuned so completion reacts inside plain scalar
  values too (VS Code disables quick suggestions inside `string`-scoped
  text by default, and unquoted YAML values are scoped as strings here to
  color correctly — this re-enables suggestions there without changing the
  coloring).
- `editor.renderWhitespace: "all"` — spaces render as `·` and tabs as `→`,
  since mixed indentation is an easy, hard-to-spot way to break YAML.
- `files.insertFinalNewline` / `files.trimFinalNewlines` — every save ends
  with exactly one trailing blank line, no more, no less.
- `files.eol: "\n"` — LF line endings, regardless of platform.
- `editor.formatOnType: true` — lets Enter after a Jinja tag line follow
  block nesting (see [Jinja indentation check](#jinja-indentation-check)).
  This extension's only on-type formatting, so nothing else changes.

All of these are per-language defaults (`[sls]` in VS Code settings), so
they don't affect any other file type. The last three also have dedicated
`saltSyntax.*` toggles — see [Settings](#settings) below — and like any
default, you can always override them yourself in `settings.json` too.

### Settings

| Setting | Default | Description |
|---|---|---|
| `saltSyntax.prependSlsToStateId` | `true` | Whether the full-block completion (see above) prepends `{{ sls }}.` to the generated state ID — `{{ sls }}.<state_id>:` vs. just `<state_id>:`. Takes effect immediately, no reload needed. |
| `saltSyntax.showWhitespace` | `true` | Render whitespace (`editor.renderWhitespace`) in `.sls` files. |
| `saltSyntax.enforceLfLineEndings` | `true` | Enforce LF line endings (`files.eol`) in `.sls` files regardless of platform. |
| `saltSyntax.enforceFinalNewline` | `true` | Ensure every `.sls` file ends with exactly one trailing blank line on save (`files.insertFinalNewline` + `files.trimFinalNewlines`). |
| `saltSyntax.jinjaWhitespaceControl` | `false` | Include Jinja's `-` whitespace-control marker (leading side only) on `{% %}` blocks this extension inserts — `{%- if %}` instead of `{% if %}`. |
| `saltSyntax.smartTopLevelDetection` | `true` | Module completion with some leading indentation and no valid state id directly above inserts the full block anyway, reset to column 0, instead of a nested stub. Disable for strict indentation-only detection. |
| `saltSyntax.saltVersion` | `3008` | Which Salt release line's state modules/functions to complete against — `3008` (current stable) or `3006` (LTS; includes many modules 3008 dropped). Also settable via the **Salt Syntax: Set Salt Version** command. Takes effect immediately, no reload needed. |
| `saltSyntax.nonAsciiCheck` | `true` | Warn about non-ASCII characters in `.sls` files, with quick fixes converting them to ASCII — see [Non-ASCII check](#non-ascii-check). Takes effect immediately, no reload needed. |
| `saltSyntax.jinjaIndentCheck` | `true` | Warn when a `{% %}` tag's indentation doesn't follow block nesting, with quick fixes to re-indent — see [Jinja indentation check](#jinja-indentation-check). Takes effect immediately, no reload needed. |
| `saltSyntax.jinjaEnterIndent` | `followNesting` | Where Enter puts the cursor after a line starting with a `{% %}` tag: `followNesting` (two spaces deeper than the innermost open Jinja block) or `column0`. Other lines keep VS Code's normal auto-indent. Needs `editor.formatOnType`, on by default for `.sls`. |
| `saltSyntax.padJinjaExpressions` | `true` | Typing `{{` auto-closes to `{{ \| }}` — a space before the cursor too — instead of `{{\| }}`. Only `{{`; `{%` is left alone (often typed as `{%-`). |
| `saltSyntax.detectJinjaInYaml` | `true` | Switch a `.yaml`/`.yml` file to Salt Jinja when a line starts with a `{% %}`/`{# #}` tag — see [Other Salt files](#other-salt-files-jinja-and-yaml-with-jinja-in-it). |
| `saltSyntax.preview.pythonPath` | `python3` | Python interpreter for the rendered preview — needs `jinja2` and `pyyaml`. |
| `saltSyntax.preview.fileRoots` | `[]` | Salt file roots imports, `include:` targets and `sls`/`tpldir` resolve against. Empty: the workspace folder, or with no folder open, the directory above the file's own. |
| `saltSyntax.preview.scrollSync` | `true` | Scroll the formula and its preview together. Toggled by the lock button on the preview's title bar. |

`showWhitespace`, `enforceLfLineEndings` and `enforceFinalNewline` are a
thin, discoverable wrapper around the editor defaults described above — disabling one doesn't just stop *forcing* that behavior,
it actively writes an explicit `"[sls]"` override into your settings
restoring VS Code's own built-in default for that setting (`selection` /
`auto` / `false`); re-enabling removes that override again, falling back to
this extension's defaults as normal. Synced on activation and immediately
whenever you change one — no reload needed.

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
├── package.json                    # Extension manifest (languages, grammars, snippets, settings)
├── language-configuration.json     # Comments, brackets, auto-close, indentation
├── syntaxes/sls.tmLanguage.json    # TextMate grammar
├── snippets/sls-snippets.json      # Static snippets
├── src/extension.js                # Completion providers (plain JS, no build step)
├── examples/uninstall_formula.sls  # Sample file used while developing the grammar
├── AGENTS.md                       # Workflow policy + how to regenerate the module/function data
├── CHANGELOG.md                    # Keep a Changelog, per the branching policy below
├── LICENSE                         # MIT
└── .github/workflows/build.yml     # CI (see below)
```

No build step — `src/extension.js` runs as-is. `npm run package` (or
`npx --yes @vscode/vsce package --no-dependencies`) produces the `.vsix`.
`MODULE_FUNCTIONS_3008`/`MODULE_FUNCTIONS_3006` (and their
`FULL_FUNCTION_FIELDS_*`/`MANDATORY_FIELDS_*` counterparts) in
`src/extension.js` are extracted from Salt's own source, not hand-written —
see [AGENTS.md](AGENTS.md#updating-the-salt-modulefunction-list) for the
exact rules and how to regenerate either one against a newer Salt release.

CI (`.github/workflows/build.yml`) runs only on a `v*` tag push (or manually
via `workflow_dispatch`): validates every JSON file, checks `extension.js`
syntax, packages the extension, uploads the `.vsix` as a build artifact,
and attaches it to a GitHub Release. It deliberately doesn't run on every
`develop`/`main` push — the release flow pushes the same already-tested
commit to `develop`, then `main`, then the tag, and running full CI on
each of those three pushes for identical code was pure noise.

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
