# Design notes: Jinja render preview

Status: **shipped in v0.10.0** — graduated from the prototype branch
`experimental/template-inputs-poc` as #39–#46 (umbrella #23), with the
line map's features (#48–#50) on top. [What shipped](#what-shipped)
describes it as it is; [Coverage](#coverage-of-salts-failure-modes) maps
what it catches of Salt's failure modes. The sections from *Goal* to
*Phased plan* are the original brainstorm (2026-09-24), kept as the
record of why it's built this way; where the build went another way,
[What shipped](#what-shipped) says so.

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
  the template) — *done:* the rendered output is parsed the way
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

## What shipped

Compared with the brainstorm: rendering is **real Jinja2 through the
user's Python**, not Nunjucks (fidelity won — see the coverage map
below); answers live in named profiles (#73), shared by every file;
nothing Salt-side is ever executed, with no opt-in to change that. Branch
dimming, hover values and profile diffs weren't built.

- **Rendered preview** (`src/preview.js`) — *Salt Syntax: Open Rendered
  Preview*, the preview button in the editor title bar, or `Ctrl+K V`:
  the rendered YAML opens beside the formula as a read-only virtual
  document, live-updating (debounced) as the formula is edited or any
  file is saved. A header comment names the file, `sls`/`tpldir`, the
  Salt version it's checked as, how many inputs are answered / defaulted /
  unknown, and every problem found (with its line). Problems are also
  real diagnostics (squiggles, Problems panel), on the formula line and
  the rendered line.
- **Salt Preview panel** (bottom panel, webview) — every external input
  the render needed, grouped (grains, pillar, config/opts, other
  `salt[...]` calls, undefined variables), each with a status dot
  (answered / code default used / unknown), the line reading it (from the
  static extractor in `src/templateInputs.js`), and a text field prefilled
  with the default. Values are YAML. Answers belong to the active
  **profile** (#73): named answer sets in `workspaceState` (`globalState`
  with no folder open), one active, shared by every preview -- a profile
  bar at the top switches / adds (empty or a copy) / renames / deletes /
  clears them, with VS Code's own prompts and confirmations. A file's
  answers from before profiles (per file, in `globalState`) move into
  the active profile the first time it's previewed. Answers the current
  render didn't use are listed collapsed, as other answers in the profile.
- **Renderer** (`src/preview/render.py`) — **real Jinja2** via the user's
  `python3` (+ `jinja2`, `pyyaml`; setting `saltSyntax.preview.pythonPath`).
  Emulates Salt's Jinja: `sls`/`tpldir`/`slspath`/`saltenv`... from the
  path relative to file roots (`saltSyntax.preview.fileRoots`; else the
  workspace folder; else the file's grandparent dir), `import_yaml` /
  `import_json` / `import_text` (rendered through Jinja first, as Salt
  does) and `load_*` blocks, `salt://` and `./relative` imports, `do` and
  loop-control extensions, and every one of Salt's filters (see the
  coverage map). `grains.filter_by` / `pillar.filter_by` and the merge helpers
  (`slsutil.merge`, `defaults.merge`, ..., ported from Salt: in place where
  Salt's are) are *computed*; the lookups follow Salt's own
  (`config.get` reads opts, grains, then pillar; `pillar.get(merge=True)`;
  the `pillar` / `grains` / `opts` globals are plain dicts, so
  `pillar.get('a:b')` returns the default, with a warning); every other
  external read is a question. Unanswered inputs use the code's default if
  it has one, else render as `«kind:key»`. Nothing Salt-side is executed.
- **Render-until-unknown works as designed**: questions only appear once
  the render actually reaches them (answering `os_family: RedHat` is what
  brings up `osmajorrelease`; each loop iteration's computed pillar key
  appears with the map's default).
- **Line map** (`render.py`'s `mark_lines` / `line_map`, #48) — which
  formula line produced each rendered line. A second render, used only for
  mapping, puts an invisible marker before every newline of template text
  (placed by Jinja's own lexer, so never inside a tag; captured
  `set`/`filter`/`load_yaml` blocks are skipped); each rendered line then
  names its source line and the markers are stripped. If stripping doesn't
  give back exactly the normal render (e.g. template text passed through
  `tojson`), there's no map rather than a wrong one. The displayed preview
  is always the normal render. Since #59 every template is marked, so each
  rendered line also knows its real file (a macro library, an
  `{% include %}`d file) — `lineOrigins` / `lineFiles` beside the
  main-file `lineMap` — and a line the markers changed (template text
  through `tojson`, ...) loses only its own mapping. It drives:
  - **scroll sync** (#48) — each side follows the other to the matching
    line, toggled by the lock button on the preview (`saltSyntax.preview.scrollSync`);
    no map → both scroll by the same fraction of the file;
  - **problems on the formula line** (#49) — every rendered-output problem
    also on the line that produced it, linked to the preview line(s);
  - **Go to Source Line** (#50, #59) — F12 / context menu in the preview,
    into the file the line really came from; a click reveals it
    (`saltSyntax.preview.clickToSource`).
- **Character origins** (#60) — for F12 only, rendered on demand when it's
  used: a mapping render whose parse tree (not source text, so whitespace
  control is untouched) marks each piece of template text and each `{{ }}`
  output with its file and offset, so F12 lands on the exact character, or
  selects the whole expression that printed it. A proof of concept also had
  a hover and hints on empty lines left by tag-only lines; they read like
  errors on empty lines and were dropped.

Limits:

- A missing import (e.g. a state file whose `map.jinja` isn't under the
  resolved root) stops the render with a clear error naming the path
  looked for; set `saltSyntax.preview.fileRoots` or open the formula
  folder. Rendering around a missing import is a possible refinement.
- Imported files are read from disk, so unsaved edits to `map.jinja` show
  up on save, not live.
- Not built: branch dimming, hover values.

## Coverage of Salt's failure modes

Researched against Salt's own source at the tags the extension's datasets
are pinned to — **v3006.27** (LTS) and **v3008.2** — rather than from
memory. A render in Salt fails in one of three stages; this is what the
preview catches of each, per version. Rules that differ between 3006 and
3008 follow `saltSyntax.saltVersion` and use that version's exact
message. 3007 (STS) and a future 3009 aren't modelled yet: supporting one
means diffing its `salt/utils/templates.py`, `salt/state.py`
(`_handle_state_decls`, `verify_high`) and `salt/utils/jinja.py` against
these two, the same way.

### 1. Jinja rendering — `salt/utils/templates.py`

Salt renders SLS in `jinja2.sandbox.SandboxedEnvironment` with
`StrictUndefined` (unless the master sets `allow_undefined`), extensions
`do`, `loopcontrols`, `with_` and its serializer extension — identical in
3006 and 3008. It reports failures as `Jinja variable …`
(`UndefinedError`), `Jinja syntax error: …` (`TemplateSyntaxError`,
`TemplateRuntimeError`, `SecurityError`) or `Jinja error: …` (anything
else); the preview uses the same wording.

| Failure | Preview |
|---|---|
| Jinja syntax errors | ✅ render error, on its line |
| Undefined variable / missing key used (`StrictUndefined`) | ✅ on the template line *and* the rendered line(s) it printed on |
| Import / `import_yaml` target missing or failing | ✅ render error, in the importing or imported file |
| Exception inside an expression (`1/0`, …) | ✅ `Jinja error: …` on its line |
| Sandbox violation (`"".__class__`, …) | ✅ sandboxed environment, as Salt |
| `{{ raise('…') }}` (Salt global) | ✅ `Jinja error: …` |
| Salt tests `match`, `equalto` | ✅ Salt's implementations |
| Salt's filters — 92 in 3008.2, 90 in 3006.27 (no `to_entries`/`from_entries`), identical signatures otherwise | ✅ every one registered, so an unknown filter fails the render as in Salt (`No filter named …`). ~60 pure ones implemented and **checked against Salt's own code** (`test/salt-filter-parity.test.py`: each Salt filter extracted from source at both tags, ~110 cases per version, identical results). Version differences honoured: `regex_search`/`regex_match` return only the groups in 3006, the whole match when there are none in 3008. Environment-dependent ones (DNS, HTTP, files, users, randomness, the current time, the networking helpers' option modes, `json_query`, …) are panel inputs |

### 2. YAML loading — `salt/renderers/yaml.py`, `SaltYamlSafeLoader`

| Failure | Preview |
|---|---|
| YAML syntax errors | ✅ every one, on the line at fault (not where PyYAML gave up) |
| Conflicting (duplicate) IDs / keys at any level | ✅ every one, with the first occurrence |
| A dict used as a key ("Invalid YAML, possible double curly-brace") | ✅ (worded as PyYAML's "unacceptable key") |
| Unquoted octal (`mode: 0644`) | — not a failure: Salt's loader strips the leading zero and file modes are handled as strings |

### 3. State compiler — `salt/state.py`

Salt runs `_handle_state_decls()` (identical in both), then
`verify_high()` (3006.27: `State.verify_high`; 3008.2: `_verify_high`).
The run-time checks (`State.verify_data()`: unknown function, missing
parameter) and include resolution (`render_state()`) are identical in
3006.27 and 3008.2. The structural checks were ported and checked
**message-for-message against Salt's own code**: the
real functions extracted from both versions' `state.py`, run on the same
rendered data — 20 scenarios × 2 versions, 0 mismatches.

| Failure | 3006 | 3008 | Preview |
|---|---|---|---|
| ID with nothing / a plain value under it (`ID … is not a dictionary`) | ✓ | ✓ | ✅ |
| Same module declared twice in one ID (`file.managed` + `file.comment`) | ✓ | ✓ | ✅ |
| `mod.fn:` with a trailing colon and nothing after it | "is not formed as a list" | "short declaration … with a trailing colon" | ✅ each version's message |
| ID that isn't a string (`1234:`, `yes:`) — "may need to be quoted" | ✓ | ✓ | ✅ |
| Function value not a list (`file.managed: /x`) | ✓ | ✓ | ✅ |
| Argument missing its `:` (`- name /etc/x`) — "function with whitespace" (+ "Too many functions") | ✓ | ✓ | ✅ |
| No function / too many functions declared | ✓ (skips `require`/`watch` keys) | ✓ | ✅ |
| Requisite value not a list | `require`/`watch`/`prereq`/`onchanges` only | every requisite keyword | ✅ |
| Requisite entry not a single-key dict | dict only | dict *and* single key | ✅ |
| Requisite type with a dot (`- pkg.installed: nginx`), illegal (unhashable) requisite value | ✓ | ✓ | ✅ |
| Requisite argument with more than one key | ✓ | ✓ | ✅ |
| `names:` not a list | — | ✓ | ✅ |
| An argument with nothing after its colon (`- name:`) | accepted (runs as None) | accepted | ✅ flagged as *suspicious* |
| Unknown function of a known module ("State … was not found in SLS …", when the state runs) | ✓ | ✓ | ✅ against the version's function list; *fails that state* |
| Module core Salt doesn't have in that version (e.g. `boto_*` in 3008) | ✓ | ✓ | ✅ as *suspicious* — a salt-extension package or custom `_states` module may provide it; a formula's own `_states/*.py` (by file name and `__virtualname__`) is recognised and skipped |
| Missing required argument ("Missing parameter … for state …", when the state runs) | ✓ | ✓ | ✅ against the version's required parameters; `name` always counts (it defaults to the ID); skipped for `names:` entries carrying their own arguments |
| `include:` target not found ("Unknown include: Specified SLS … is not available …"), relative include beyond the top package | ✓ | ✓ | ✅ resolved like `render_state()` — relative (`.foo`, `init.sls` counting as a level), fnmatch globs, `<name>.sls` or `<name>/init.sls` under the file roots; entries for another saltenv are skipped |
| Requisite targets / `extend:` IDs that don't exist (3006: "The following requisites were not found", 3008: "Referenced state does not exist for requisite …"; "Cannot extend ID … It is not part of the high state") | ✓ | ✓ | ✅ as *suspicious*: resolved like `RequisiteGraph.add_dependency` (`sls:` incl. globs, bare/`id:` IDs, `<module>:` by ID or `name`, `names:` entries, globs) against this file **and every file it includes, rendered too** (each with its own `sls`/`tpldir`, the same answers, their inputs kept out of the panel); an include that can't be rendered disables the check rather than guess. Suspicious, not a failure: in a highstate another SLS from `top.sls` may define the target |

Corrections the research made to earlier assumptions:

- An ordinary argument with two keys (`- name: /x` with `source:` wrongly
  indented under it) is **not** an error in either version — Salt checks
  extra keys only inside requisite arguments, and simply sets both.
- Two declarations of the same module in one ID are **rejected**
  (`_handle_state_decls`), not silently dropped.

Not catchable by a preview at all: failures while states *run* on a minion
(a missing package, a failing command) — the preview renders and checks,
it never executes.

## Graduation (done)

The preview moved from `experimental/template-inputs-poc` to `develop` in
bf7607e, one issue per user-facing feature group below (#39–#46, each
closed with its commits and tests), #23 closed pointing at them, and it
was released in 0.10.0. The table is the record of what went in:

| Feature group (issue) | Commits | Verified by |
|---|---|---|
| Rendered preview beside the formula + Salt Preview inputs panel (real Jinja2, Salt's environment emulated, answers per file) | 8488c9b | `preview-render.test.py`, `preview.test.js` |
| Problems as diagnostics on the source and the preview, amber, placed correctly after edits | 296dcaa, e86b14e, fc5c9ba, b3b1728 | `preview.test.js` |
| Rendered YAML checked like Salt's loader: syntax errors on the line at fault, every duplicate ID, empty values | 137a7ed, 67f1f29, 67d5f1a | `preview-checks.test.py`, `preview.test.js` |
| Jinja exactly as Salt: StrictUndefined, sandbox, `raise()`, `match`/`equalto`, Salt's error wording | d76b0c4, d5acee5 | `preview-render.test.py` |
| Salt's state-compiler checks, per version | d5acee5 | `salt-compiler-parity.test.py` (Salt's own code, both versions) |
| Unknown functions / modules, missing required arguments, missing includes | a7d8ddd | `preview-checks.test.py` |
| All of Salt's Jinja filters, environment-dependent ones as inputs | 04009e5 | `salt-filter-parity.test.py` (Salt's own code, both versions) |
| Requisite / `extend:` targets that don't exist, including included files | a74fb23 | `preview-references.test.py` |

## Open questions

Settled by the build: real formulas lean on `map.jinja` / `import_yaml`
/ `grains.filter_by` heavily, so those are emulated for real; "never
execute" is a hard rule; the questionnaire is a webview form (the Salt
Preview panel) listing every input at once. Still open:

- Named profiles (mock minions) — worth it, or are per-file answers
  enough in practice?
- 3007 (STS) or a future 3009 — model them when someone needs them (see
  the coverage map's intro for what that takes).
