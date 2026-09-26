# Design notes: Jinja render preview (experimental)

Status: **proof of concept** on branch `experimental/template-inputs-poc`
(tracked by #23): a working rendered preview with an inputs panel — see
[PoC status](#poc-status). Brainstorm originally captured 2026-09-24.

## Goal

Show what an `.sls` file actually renders to for a *pretend* minion,
without a Salt master: evaluate the Jinja with injected, user-supplied
values for everything that isn't fixed in the files (grains, pillar,
`salt[...]` call results, ...), and show the resulting YAML.

## UX sketch

- **Rendered preview pane** — command *Salt Syntax: Preview Rendered SLS*
  opens the rendered YAML side by side with the source, live-updating on
  edit (like Markdown preview; a `TextDocumentContentProvider` on a custom
  URI scheme, shown with YAML highlighting).
- **Profiles (mock minions)** — a workspace file (e.g. `.salt-preview.yaml`)
  defining named fake minions with their grains + pillar: `debian-web`,
  `rhel-db`, `windows`, ... Switch the active profile from the status bar
  and watch the output change. Seeing how
  `{% if grains['os_family'] == 'RedHat' %}` renders per OS is the killer
  feature.
- **Salt's built-in context for free** — derive `sls`, `tpldir`, `slspath`,
  `tplfile` from the file's workspace-relative path, so `{{ sls }}.state_id`
  renders correctly with zero configuration.

## Rendering engine — the key decision

| Option | Fidelity | Cost / risk |
|---|---|---|
| **Nunjucks** (JS Jinja clone, bundled) | ~90%. Syntax is close, but Python-isms (`.items()`, `.get()`), `{% do %}` (Salt enables `jinja2.ext.do`) and Salt's filters (`yaml`, `json`, `yaml_encode`, `regex_replace`, `unique`, ...) and tags (`import_yaml`, `import_json`, `load_yaml`, ...) all need shims/re-implementation | Zero install, works everywhere (incl. VS Code for the web) |
| **Real Jinja2 via the user's Python** (`python3` + `jinja2`) | Exact Jinja; Salt filters/tags still shims | User needs Python + jinja2 |
| **Real Jinja2 in WebAssembly** (Pyodide, bundled) | Exact Jinja, no local Python | ~10 MB+ download, slower first render |
| **Actual Salt** (`salt-call --local slsutil.renderer`, or via Docker) | Exact, incl. Salt filters, `import_yaml`, `map.jinja` | Needs Salt installed, and **really executes** `salt[...]` calls on the dev machine |

### Safety

Rendering executes whatever the template calls. With real Salt,
`{{ salt['cmd.run']('...') }}` would actually run on the developer's
machine just to draw a preview. Default must be **never execute anything**;
any real-execution mode only in a trusted workspace, behind an explicit
opt-in setting and a warning.

## Mocking external inputs

- **Lookup-style functions** — `pillar.get`, `grains.get`, `config.get`,
  `grains.filter_by` — answered from the active profile, so they behave
  realistically.
- **Everything else** — `cmd.run`, `file.file_exists`, `network.ip_addrs`,
  ... — renders as a visible placeholder (e.g. `«salt:cmd.run('hostname')»`)
  with a warning, or returns a canned per-call value stored in the profile.
  Never executed.
- **Imports** — `{% from "map.jinja" import ... %}`, `import_yaml`,
  `salt://` paths — resolved against the workspace via a "file roots"
  setting.

## The questionnaire idea

Instead of pretending to *be* Salt, identify every input that isn't fixed
in the files and **ask the user** for it: "line 12 runs
`cmd.run('hostname -f')` — what should it return?", "pillar `app:port`
(default 8080) — value?", etc. Answers are saved into the profile, so each
question is asked once.

### Finding the inputs (static analysis)

Jinja parses to a real AST, so the common inputs are identifiable:

- `pillar.get('app:port', 8080)` / `salt['pillar.get'](...)` — key plus
  default (pre-fill the answer with it)
- `grains['os_family']`, `grains.get('osrelease')`
- `salt['cmd.run']('hostname -f')` — function name + literal arguments
- `opts`, `saltenv`, `config.get`, ...

Where static detection breaks down:

- keys built dynamically: `pillar.get('users:' ~ user)`
- calls inside loops that should return different values per iteration
- inputs hidden inside an imported `map.jinja` or a macro

### The trick: render-until-unknown

Don't rely only on an up-front scan. Render; whenever evaluation hits an
unknown input, pause, ask, store the answer in the profile, resume. This
makes the dynamic cases tractable — by the time the question is asked the
concrete key is known (`users:alice`, not `'users:' ~ user`). Each distinct
input is asked once; later renders are silent unless a genuinely new input
appears.

## Checks on the rendered output

Once rendered to plain YAML, reuse data the extension already ships:

- **Duplicate state IDs after rendering** (classic loop bug, invisible in
  the template) — *done in the PoC:* the rendered output is parsed the way
  Salt's own loader does (`SaltYamlSafeLoader.construct_mapping`), so a key
  repeated in the same mapping at any level is reported with Salt's own
  message, `found conflicting ID '…'`, at the second occurrence plus where
  the first was
- **Unknown `module.function`** for the active `saltSyntax.saltVersion`
  (`MODULE_FUNCTIONS_*`)
- **Missing mandatory arguments** (`MANDATORY_FIELDS_*`)
- **Render errors** (undefined variable, syntax error) as diagnostics on
  the source line that caused them

## Built on top later

- **Grey out branches not taken** under the active profile — like the C/C++
  extension's inactive `#ifdef` regions (under `windows`, dim the `else`
  branch that won't render).
- **Hover values** — hover `{{ pillar.get('app:port', 80) }}` →
  `8080 (debian-web)`.
- **Profile diff** — "what differs between debian-web and rhel-db for this
  file?"

## Phased plan

1. **Input inventory panel** (recommended first, ~1 day) — *"What does this
   file depend on?"*: every pillar key, grain, and `salt[...]` call in the
   file, with line numbers and defaults. No rendering needed. Useful on
   its own ("what pillar does this formula need?", "which grains does it
   branch on?"), and it's the first half of the questionnaire. Decide on
   the rest after seeing it in use.
2. **Preview pane** — Nunjucks + profiles + auto `sls`/`tpldir` + mocked
   `salt[...]`; render-until-unknown questionnaire filling the profile.
3. **Rendered-output checks** — cheap, data already exists.
4. **Branch dimming + hover values.**
5. **Optional exact mode** — real Jinja2 (Python or Pyodide), or
   `salt-call` behind the safety opt-in above.

## PoC status

Implemented on `experimental/template-inputs-poc`:

- **Rendered preview** (`src/preview.js`) — *Salt Syntax: Open Rendered
  Preview (experimental)*, the preview button in the editor title bar, or
  `Ctrl+K V`: the rendered YAML opens beside the formula as a read-only
  virtual document, live-updating (debounced) as the formula is edited or
  any file is saved. A header comment names the file, `sls`/`tpldir`, how
  many inputs are answered / defaulted / unknown, and any render error or
  invalid-YAML output (with its line).
- **Salt Preview panel** (bottom panel, webview) — every external input
  the render needed, grouped (grains, pillar, config/opts, other
  `salt[...]` calls, undefined variables), each with a status dot
  (answered / code default used / unknown), the line reading it (from the
  static extractor in `src/templateInputs.js`), and a text field prefilled
  with the default. Values are YAML. Answers are kept per file in
  `globalState`; answers the current render didn't use are listed
  separately.
- **Renderer** (`src/preview/render.py`) — **real Jinja2** via the user's
  `python3` (+ `jinja2`, `pyyaml`; setting `saltSyntax.preview.pythonPath`).
  Emulates Salt's Jinja: `sls`/`tpldir`/`slspath`/`saltenv`... from the
  path relative to file roots (`saltSyntax.preview.fileRoots`; else the
  workspace folder; else the file's grandparent dir), `import_yaml` /
  `import_json` / `import_text` (rendered through Jinja first, as Salt
  does) and `load_*` blocks, `salt://` and `./relative` imports, `do` and
  loop-control extensions, Salt's common filters (unknown ones become
  pass-throughs with a warning). `grains.filter_by` and the merge helpers
  (`slsutil.merge`, `defaults.merge`, ...) are *computed*; every other
  external read is a question. Unanswered inputs use the code's default if
  it has one, else render as `«kind:key»`. Nothing Salt-side is executed.
- **Render-until-unknown works as designed**: questions only appear once
  the render actually reaches them (answering `os_family: RedHat` is what
  brings up `osmajorrelease`; each loop iteration's computed pillar key
  appears with the map's default).

Findings / limits so far:

- A missing import (e.g. a state file whose `map.jinja` isn't under the
  resolved root) stops the render with a clear error naming the path
  looked for; set `saltSyntax.preview.fileRoots` or open the formula
  folder. Rendering around a missing import is a possible refinement.
- Imported files are read from disk, so unsaved edits to `map.jinja` show
  up on save, not live.
- Salt's `pillar` / `grains` objects in templates are plain dicts;
  `pillar.get('a:b')` here also resolves nested keys, which is more lenient
  than real Salt (only `salt['pillar.get']` does that).
- Not yet: profiles (named answer sets per mock minion), branch dimming,
  rendered-output checks — see the phased plan.

## Open questions

- How heavily do real formulas lean on `map.jinja` / `import_yaml` /
  `grains.filter_by`? Determines how much of Salt the mocks must cover.
- Is Salt available locally, or would a Docker-based exact mode be wanted?
- Is "never execute" a hard rule, or acceptable as a trusted-workspace
  opt-in?
- Questionnaire UI: sequential input boxes (`QuickInput`) vs. a form
  (webview) listing all known inputs at once?

## Honest assessment

A full simulator is a big job with uncertain fidelity (Nunjucks ≠ Jinja2,
Salt's filters/tags/loader aren't free). The inventory panel is the cheap,
certain-value slice; everything past it should be justified by how useful
that first slice turns out to be.
