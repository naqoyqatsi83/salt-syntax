// Rendered preview (#23; design + coverage map: docs/design/jinja-render-preview.md):
// preview of a Salt template, like Markdown preview -- the formula on one
// side, the YAML it renders to on the other, and a "Salt Preview" panel
// where every external input the render needed (grains, pillar, config,
// other salt[...] call results, undefined variables) can be answered by
// hand. Rendering is real Jinja2 via src/preview/render.py (python3 +
// jinja2 + pyyaml); nothing Salt-side is ever executed.

const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { extractTemplateInputs } = require('./templateInputs');

const SCHEME = 'salt-preview';
const RENDER_SCRIPT = path.join(__dirname, 'preview', 'render.py');
const KIND_LABELS = { grains: 'Grains', pillar: 'Pillar', config: 'Config / opts', salt: 'Salt function calls', filter: 'Environment-dependent filters', variable: 'Undefined variables' };

function register(context, vscode, isSaltLanguage, stateDataFor = () => null) {
  const states = new Map(); // source uri string -> { uri, answers, result, running, pending }
  const changed = new vscode.EventEmitter();
  // Problems the render found, as real diagnostics (so squiggles, the
  // Problems panel and inline tools like Error Lens show them), not just
  // the preview's header comment. Keyed per source, so each render replaces
  // exactly what its previous render set.
  const diagnostics = vscode.languages.createDiagnosticCollection('salt-preview');
  const diagnosedUris = new Map(); // source uri string -> [uri, ...] it set diagnostics on
  let current = null; // source uri string the panel shows
  let panel = null; // resolved WebviewView

  // Answers live in profiles (#73): named answer sets -- typically one per
  // kind of minion -- of which one is active, and every preview renders
  // against it. Stored per workspace (globally with no folder open), so
  // they persist across restarts until cleared or deleted.
  const PROFILES_KEY = 'saltPreview.profiles';
  const profileStore = () => ((vscode.workspace.workspaceFolders || []).length ? context.workspaceState : context.globalState);
  const readProfiles = () => {
    const saved = profileStore().get(PROFILES_KEY);
    return saved && saved.profiles && saved.profiles[saved.active] ? JSON.parse(JSON.stringify(saved)) : { active: 'default', profiles: { default: {} } };
  };
  let profiles = readProfiles();
  // Windows with no folder open all share the global store, and VS Code
  // carries a write from one window to the others' -- so profiles are read
  // afresh before every change (a change lands on the latest state, never
  // on a stale copy) and every render. True if they changed meanwhile.
  const refreshProfiles = () => {
    const fresh = readProfiles();
    const changed = JSON.stringify(fresh) !== JSON.stringify(profiles);
    profiles = fresh;
    return changed;
  };
  const activeAnswers = () => profiles.profiles[profiles.active];
  const saveProfiles = () => profileStore().update(PROFILES_KEY, profiles);
  // Before profiles, answers were kept per file under this key.
  const answersKey = (uriString) => `saltPreview.answers:${uriString}`;
  const previewUriFor = (sourceUri) =>
    vscode.Uri.from({ scheme: SCHEME, path: `${sourceUri.path}.rendered.yaml`, query: encodeURIComponent(sourceUri.toString()) });
  const sourceOfPreview = (previewUri) => decodeURIComponent(previewUri.query);

  function fileRoots(sourceUri) {
    const file = sourceUri.fsPath;
    const expand = (p) => p.replace(/^~(?=$|\/)/, os.homedir());
    const configured = vscode.workspace.getConfiguration('saltSyntax').get('preview.fileRoots', []).map(expand);
    const inside = (root) => !path.relative(root, file).startsWith('..');
    const hit = configured.find(inside);
    if (hit) return [hit, ...configured.filter((r) => r !== hit)];
    const folder = vscode.workspace.getWorkspaceFolder(sourceUri);
    if (folder) return [folder.uri.fsPath, ...configured];
    // No roots configured and no folder open: assume <root>/<formula>/file,
    // i.e. the file's parent directory is its formula directory.
    return [path.dirname(path.dirname(file)), ...configured];
  }

  function runRenderer(request) {
    const python = vscode.workspace.getConfiguration('saltSyntax').get('preview.pythonPath', 'python3');
    return new Promise((resolve) => {
      let out = '';
      let err = '';
      let child;
      try {
        child = spawn(python, [RENDER_SCRIPT], { stdio: ['pipe', 'pipe', 'pipe'] });
      } catch (e) {
        resolve({ fatal: `Couldn't start ${python}: ${e.message}` });
        return;
      }
      const timer = setTimeout(() => child.kill(), 15000);
      child.stdout.on('data', (d) => (out += d));
      child.stderr.on('data', (d) => (err += d));
      child.on('error', (e) =>
        resolve({ fatal: `Couldn't run "${python}" (${e.code || e.message}). The rendered preview needs Python 3 with jinja2 and pyyaml; set saltSyntax.preview.pythonPath if it isn't on PATH as python3.` })
      );
      child.on('close', () => {
        clearTimeout(timer);
        try {
          resolve(JSON.parse(out));
        } catch (e) {
          resolve({ fatal: `The renderer failed${err ? `:\n${err.trim().split('\n').slice(-3).join('\n')}` : ' (no output -- timed out?)'}` });
        }
      });
      child.stdin.end(JSON.stringify(request));
    });
  }

  const renderRequest = (state, source, saltVersion) => ({
    source, path: state.uri.fsPath, roots: fileRoots(state.uri), answers: activeAnswers(),
    saltVersion, stateData: stateDataFor(saltVersion)
  });

  async function render(uriString) {
    const state = states.get(uriString);
    if (!state) return;
    if (state.running) {
      state.pending = true;
      return;
    }
    state.running = true;
    refreshProfiles();
    const doc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uriString);
    const source = doc ? doc.getText() : state.lastSource || '';
    state.lastSource = source;
    const saltVersion = vscode.workspace.getConfiguration('saltSyntax').get('saltVersion', '3008');
    state.result = await runRenderer(renderRequest(state, source, saltVersion));
    state.saltVersion = saltVersion;
    state.lines = staticLines(source);
    state.running = false;
    updateDiagnostics(state);
    changed.fire(previewUriFor(state.uri));
    postState();
    if (state.pending) {
      state.pending = false;
      render(uriString);
    }
  }

  // Where each input is read in the file itself (imports aren't scanned).
  function staticLines(source) {
    const lines = {};
    for (const i of extractTemplateInputs(source)) {
      const kind = i.category === 'imports' || i.category === 'context' ? null : i.category;
      if (!kind || i.dynamic) continue;
      const id = `${kind}|${i.key}`;
      (lines[id] = lines[id] || []).push(i.line + 1);
    }
    return lines;
  }

  // How a rendered-YAML problem reads, in the preview's own line numbers
  // (rendered line + the header's line count), for the header and panel.
  function describeYamlError(y, offset) {
    const where = y.line ? ` at line ${y.line + offset} of the preview` : '';
    const first = y.firstLine ? ` (first defined at line ${y.firstLine + offset})` : '';
    const gaveUp = y.gaveUpLine ? ` (the parser gave up at line ${y.gaveUpLine + offset})` : '';
    return `${yamlProblemLead(y)}${where}: ${y.message}${first}${gaveUp}`;
  }

  // Salt refuses the file (syntax error, conflicting ID, bodiless state), or
  // accepts it but it's almost certainly wrong (an empty argument)...
  // ...or it passes compilation but fails that one state when it runs
  // (unknown function, missing required parameter).
  const yamlProblemLead = (y) =>
    y.reject === false ? 'Suspicious output' : y.lead === 'state' ? 'Salt would fail this state' : 'Salt would reject this output';

  // Salt renders with StrictUndefined: using an undefined value fails the
  // whole render there (the preview carries on so the rest stays visible).
  const describeStrictError = (e) =>
    `Salt would fail to render this: ${e.message}${e.line ? ` (${e.file ? `${e.file} ` : ''}line ${e.line})` : ''}`;

  const yamlErrorsOf = (r) => (r && !r.error && r.yamlErrors) || [];

  function headerLines(state) {
    const r = state.result;
    const qs = r.questions || [];
    const open = qs.filter((q) => !q.answered);
    const noDefault = open.filter((q) => q.default === null);
    const head = [
      `# Salt rendered preview — ${r.context.file}  (sls: ${r.context.sls}, tpldir: ${r.context.tpldir || '.'}, checked as Salt ${state.saltVersion || '3008'})`,
      `# ${qs.length} external input${qs.length === 1 ? '' : 's'}: ${qs.length - open.length} answered (profile "${profiles.active}"), ${open.length - noDefault.length} using the default in the code, ${noDefault.length} unknown (shown as «kind:key»). Fill them in the Salt Preview panel.`
    ];
    for (const w of r.warnings || []) head.push(`# ⚠ ${w}`);
    if (r.error) {
      head.push(`# ⚠ Render error${r.error.file ? ` in ${r.error.file}` : ''}${r.error.line ? ` line ${r.error.line}` : ''}: ${r.error.message}`);
    } else {
      for (const e of r.strictErrors || []) head.push(`# ⚠ ${describeStrictError(e)}`);
      // One header line per problem; they're part of the header too, so
      // the offset into the rendered text counts them.
      const problems = yamlErrorsOf(r);
      const offset = head.length + problems.length;
      for (const y of problems) head.push(`# ⚠ ${describeYamlError(y, offset)}`);
    }
    return head;
  }

  // - "Salt would reject this output" (duplicate ID, invalid YAML, ...): an
  //   error on that line of the preview, linking to the first occurrence --
  //   and, through the renderer's line map (#48), on the formula line that
  //   produced it, linking to the preview line(s). A loop repeating the
  //   same problem gets it once on its line. No map: preview only.
  // - A render error: an error on the line Jinja reports -- in the source,
  //   or in the imported file it happened in.
  // - Renderer warnings: on their own header line of the preview.
  // All at Warning severity -- the same amber as the other checks (e.g. the
  // non-ASCII one), so everything this extension flags looks alike.
  function updateDiagnostics(state) {
    const key = state.uri.toString();
    for (const uri of diagnosedUris.get(key) || []) diagnostics.delete(uri);
    const r = state.result || {};
    const byUri = new Map();
    const add = (uri, diag) => {
      if (!byUri.has(uri.toString())) byUri.set(uri.toString(), { uri, list: [] });
      byUri.get(uri.toString()).list.push(diag);
    };
    const make = (line, message, severity) => {
      const d = new vscode.Diagnostic(new vscode.Range(Math.max(line, 0), 0, Math.max(line, 0), Number.MAX_SAFE_INTEGER), message, severity);
      d.source = 'Salt Preview';
      return d;
    };
    const previewUri = previewUriFor(state.uri);
    if (r.context) {
      const head = headerLines(state);
      (r.warnings || []).forEach((w, i) => add(previewUri, make(2 + i, w, vscode.DiagnosticSeverity.Warning)));
      // A template file as the renderer names it (the main file by its
      // relative name, imports by absolute path) -> where to put a diagnostic.
      const uriOf = (file) => (file === r.context.file || !file ? state.uri : path.isAbsolute(file) ? vscode.Uri.file(file) : null);
      const renderedLines = (r.rendered || '').split('\n');
      const strict = r.error ? [] : r.strictErrors || [];
      const lead = 'Salt would fail to render this: ';
      const sourceLine = (e) => `${e.file ? `${e.file} ` : ''}line ${e.line}`;
      strict.forEach((e) => {
        const where = uriOf(e.file);
        add(where || state.uri, make(where && e.line ? e.line - 1 : 0, where ? `${lead}${e.message}` : `${lead}${e.message} (${sourceLine(e)})`, vscode.DiagnosticSeverity.Warning));
      });
      // Also on the preview: every rendered line an undefined value was
      // printed on (its «…» marker). A rendered line can't tell which
      // template line printed it, so per marker it names all of them. Used
      // only in an if/loop (nothing printed): on its own header line.
      const byMarker = new Map();
      strict.forEach((e, i) => {
        const markers = e.markers && e.markers.length ? e.markers : e.marker ? [e.marker] : [];
        const printedAt = renderedLines.flatMap((l, n) => (markers.some((m) => l.includes(m)) ? [n + head.length] : []));
        if (!printedAt.length) {
          add(previewUri, make(2 + (r.warnings || []).length + i, `${lead}${e.message} (${sourceLine(e)})`, vscode.DiagnosticSeverity.Warning));
          return;
        }
        if (!byMarker.has(e.marker)) byMarker.set(e.marker, { lines: printedAt, errors: [] });
        byMarker.get(e.marker).errors.push(e);
      });
      for (const { lines, errors } of byMarker.values()) {
        const messages = [...new Set(errors.map((e) => e.message))].join('; ');
        for (const line of lines) add(previewUri, make(line, `${lead}${messages} (${errors.map(sourceLine).join(', ')})`, vscode.DiagnosticSeverity.Warning));
      }
      if (r.error) {
        const e = r.error;
        const where = uriOf(e.file);
        const line = e.line ? e.line - 1 : 0;
        add(where || state.uri, make(where ? line : 0, where ? `Render error: ${e.message}` : `Render error in ${e.file}${e.line ? ` line ${e.line}` : ''}: ${e.message}`, vscode.DiagnosticSeverity.Warning));
      } else {
        const at = (renderedLine) => renderedLine - 1 + head.length; // 0-based preview line
        const onSource = new Map(); // "line|message" -> diagnostic on the formula
        for (const y of yamlErrorsOf(r)) {
          const d = make(y.line ? at(y.line) : 0, `${yamlProblemLead(y)}: ${y.message}`, vscode.DiagnosticSeverity.Warning);
          const other = y.firstLine ? [y.firstLine, 'first defined here'] : y.gaveUpLine ? [y.gaveUpLine, 'the parser gave up here'] : null;
          if (other) {
            d.relatedInformation = [new vscode.DiagnosticRelatedInformation(
              new vscode.Location(previewUri, new vscode.Range(at(other[0]), 0, at(other[0]), 0)), other[1])];
          }
          add(previewUri, d);
          const mapped = y.line && r.lineMap ? r.lineMap[Math.min(y.line, r.lineMap.length) - 1] : null;
          if (mapped == null) continue; // no map, or a line it couldn't trace
          const sourceLine = mapped - 1;
          const here = new vscode.Location(previewUri, new vscode.Range(at(y.line), 0, at(y.line), 0));
          const k = `${sourceLine}|${d.message}`;
          if (!onSource.has(k)) {
            const s = make(sourceLine, d.message, vscode.DiagnosticSeverity.Warning);
            s.relatedInformation = [];
            onSource.set(k, s);
            add(state.uri, s);
          }
          onSource.get(k).relatedInformation.push(new vscode.DiagnosticRelatedInformation(here, 'in the rendered preview'));
        }
      }
    }
    state.pendingPreview = null;
    for (const { uri, list } of byUri.values()) {
      if (uri.toString() === previewUri.toString()) setPreviewDiagnosticsWhenShown(state, uri, list);
      else diagnostics.set(uri, list);
    }
    diagnosedUris.set(key, [...byUri.values()].map((v) => v.uri));
  }

  // The preview's diagnostics are placed by the *new* text's line numbers,
  // but VS Code applies the new text asynchronously, after onDidChange --
  // and treats it as an edit, shifting any diagnostics already on the
  // document along with it. Set before the text lands, they'd end up on the
  // wrong lines. So they're held until the open preview document actually
  // shows the text they were computed for (or set at once if it isn't open
  // or already shows it).
  function setPreviewDiagnosticsWhenShown(state, uri, list) {
    const text = previewText(state);
    const doc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString());
    if (!doc || doc.getText() === text) {
      diagnostics.set(uri, list);
      return;
    }
    state.pendingPreview = { uri, list, text };
  }

  function previewText(state) {
    const r = state.result;
    if (!r) return '# Rendering…\n';
    if (r.fatal) return `# Salt rendered preview\n#\n# ${r.fatal.split('\n').join('\n# ')}\n`;
    const head = headerLines(state);
    return r.error ? `${head.join('\n')}\n` : `${head.join('\n')}\n${r.rendered}${variablesSection(r)}`;
  }

  // The template's variables (#65), after the rendered output as a second
  // YAML document, so the rendered part stays exactly what Jinja printed.
  function variablesSection(r) {
    if (!r.variables || !vscode.workspace.getConfiguration('saltSyntax.preview').get('showVariables', true)) return '';
    const gap = r.rendered === '' || r.rendered.endsWith('\n') ? '' : '\n';
    return `${gap}---\n# Template variables -- not rendered output: the values ${r.context.file} ends up with (what \`{% from %}\` would import)\n${r.variables}`;
  }


  context.subscriptions.push(
    changed,
    diagnostics,
    vscode.workspace.registerTextDocumentContentProvider(SCHEME, {
      onDidChange: changed.event,
      provideTextDocumentContent(uri) {
        const state = states.get(sourceOfPreview(uri));
        return state ? previewText(state) : '# This preview’s source file is no longer open.\n';
      }
    })
  );

  function stateFor(uri) {
    const key = uri.toString();
    if (!states.has(key)) {
      states.set(key, { uri, result: null, running: false, pending: false });
      // A file's answers from before profiles move into the active profile
      // (what the profile already has wins), once.
      const legacy = context.globalState.get(answersKey(key));
      if (legacy) {
        refreshProfiles();
        const answers = activeAnswers();
        for (const [id, value] of Object.entries(legacy)) if (!(id in answers)) answers[id] = value;
        context.globalState.update(answersKey(key), undefined);
        saveProfiles();
      }
    }
    return states.get(key);
  }

  const renderAll = () => {
    for (const key of states.keys()) render(key);
  };

  // Profile actions (#73), from the panel's profile bar, its title-bar
  // buttons and the command palette. Prompts and confirmations are VS
  // Code's own -- a webview can't show modal dialogs.
  async function switchProfile(name) {
    refreshProfiles();
    if (name === undefined) {
      const NEW = '$(add) New profile…';
      const picked = await vscode.window.showQuickPick(
        [...Object.keys(profiles.profiles).map((p) => ({ label: p, description: p === profiles.active ? 'active' : `${Object.keys(profiles.profiles[p]).length} answers` })), { label: NEW }],
        { placeHolder: 'Preview profile to render with' }
      );
      if (!picked) return;
      if (picked.label === NEW) return newProfile();
      name = picked.label;
    }
    refreshProfiles();
    if (!profiles.profiles[name] || name === profiles.active) return;
    profiles.active = name;
    await saveProfiles();
    renderAll();
    postState();
  }

  const askName = (prompt, value) =>
    vscode.window.showInputBox({
      prompt,
      value,
      validateInput: (v) => (!v.trim() ? 'A name is needed.' : v.trim() !== value && profiles.profiles[v.trim()] ? `There's already a profile "${v.trim()}".` : null)
    });

  async function newProfile() {
    refreshProfiles();
    const name = ((await askName('Name for the new preview profile -- e.g. the kind of minion it stands for (rhel-eu)')) || '').trim();
    if (!name) return;
    const copy = `Copy of "${profiles.active}"`;
    const start = await vscode.window.showQuickPick(['Start empty', copy], { placeHolder: `Profile "${name}": start from` });
    if (!start) return;
    refreshProfiles();
    profiles.profiles[name] = start === copy ? { ...activeAnswers() } : {};
    profiles.active = name;
    await saveProfiles();
    renderAll();
    postState();
  }

  async function renameProfile() {
    refreshProfiles();
    const old = profiles.active;
    const name = ((await askName(`Rename preview profile "${old}" to`, old)) || '').trim();
    if (!name || name === old) return;
    refreshProfiles();
    if (!profiles.profiles[old] || profiles.profiles[name]) return; // gone, or taken, meanwhile
    profiles.profiles = Object.fromEntries(Object.entries(profiles.profiles).map(([p, a]) => [p === old ? name : p, a]));
    profiles.active = name;
    await saveProfiles();
    renderAll();
    postState();
  }

  async function deleteProfile() {
    refreshProfiles();
    const name = profiles.active;
    const others = Object.keys(profiles.profiles).filter((p) => p !== name);
    if (!others.length) {
      vscode.window.showInformationMessage(`"${name}" is the only preview profile, so it stays -- use Clear Answers to empty it.`);
      return;
    }
    const count = Object.keys(activeAnswers()).length;
    const ok = await vscode.window.showWarningMessage(`Delete preview profile "${name}" and its ${count} answer${count === 1 ? '' : 's'}?`, { modal: true }, 'Delete');
    if (ok !== 'Delete') return;
    refreshProfiles();
    delete profiles.profiles[name];
    if (!Object.keys(profiles.profiles).length) profiles.profiles.default = {};
    if (!profiles.profiles[profiles.active]) profiles.active = Object.keys(profiles.profiles)[0];
    await saveProfiles();
    renderAll();
    postState();
  }

  async function clearAnswers() {
    refreshProfiles();
    const count = Object.keys(activeAnswers()).length;
    if (!count) {
      vscode.window.showInformationMessage(`Preview profile "${profiles.active}" has no answers to clear.`);
      return;
    }
    const ok = await vscode.window.showWarningMessage(`Clear all ${count} answer${count === 1 ? '' : 's'} in preview profile "${profiles.active}"?`, { modal: true }, 'Clear');
    if (ok !== 'Clear') return;
    refreshProfiles();
    profiles.profiles[profiles.active] = {};
    await saveProfiles();
    renderAll();
    postState();
  }

  function postState() {
    if (!panel) return;
    const state = current && states.get(current);
    if (!state) {
      panel.webview.postMessage({ type: 'empty' });
      return;
    }
    const r = state.result || {};
    const answers = activeAnswers();
    const questions = (r.questions || []).map((q) => ({ ...q, lines: (state.lines || {})[q.id] || [], value: answers[q.id] || '' }));
    const asked = new Set(questions.map((q) => q.id));
    const unused = Object.keys(answers).filter((id) => !asked.has(id) && answers[id] !== '').map((id) => ({ id, value: answers[id] }));
    panel.webview.postMessage({
      type: 'state',
      file: r.context ? r.context.file : path.basename(state.uri.fsPath),
      fatal: r.fatal || null,
      error: r.error || null,
      yamlErrors: [
        ...(r.error ? [] : (r.strictErrors || []).map(describeStrictError)),
        ...yamlErrorsOf(r).map((y) => describeYamlError(y, headerLines(state).length))
      ],
      warnings: r.warnings || [],
      rendering: !state.result,
      kinds: KIND_LABELS,
      questions,
      unused,
      profiles: Object.keys(profiles.profiles),
      profile: profiles.active
    });
  }

  function setAnswer(id, value) {
    refreshProfiles();
    const answers = activeAnswers();
    if (value === '' || value === undefined) delete answers[id];
    else answers[id] = value;
    saveProfiles();
    // The profile is shared: every open preview may read this input.
    renderAll();
  }

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('saltSyntax.previewInputs', {
      resolveWebviewView(view) {
        panel = view;
        view.webview.options = { enableScripts: true };
        view.webview.html = panelHtml(view.webview);
        view.webview.onDidReceiveMessage((m) => {
          if (m.type === 'answer') setAnswer(m.id, m.value);
          if (m.type === 'ready') postState();
          if (m.type === 'profile') {
            const action = { switch: () => switchProfile(m.name), new: newProfile, rename: renameProfile, delete: deleteProfile, clear: clearAnswers }[m.action];
            if (action) action();
          }
          if (m.type === 'reveal' && current) {
            const state = states.get(current);
            vscode.window.showTextDocument(state.uri, { selection: new vscode.Range(m.line - 1, 0, m.line - 1, 0), viewColumn: vscode.ViewColumn.One });
          }
        });
        view.onDidDispose(() => (panel = null));
      }
    }, { webviewOptions: { retainContextWhenHidden: true } }),
    // Back in this window: show what another one changed meanwhile.
    vscode.window.onDidChangeWindowState((e) => {
      if (e.focused && refreshProfiles()) {
        renderAll();
        postState();
      }
    }),
    vscode.commands.registerCommand('saltSyntax.preview.switchProfile', () => switchProfile()),
    vscode.commands.registerCommand('saltSyntax.preview.newProfile', newProfile),
    vscode.commands.registerCommand('saltSyntax.preview.renameProfile', renameProfile),
    vscode.commands.registerCommand('saltSyntax.preview.deleteProfile', deleteProfile),
    vscode.commands.registerCommand('saltSyntax.preview.clearAnswers', clearAnswers)
  );

  async function openPreview() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !isSaltLanguage(editor.document.languageId)) {
      vscode.window.showInformationMessage('Salt Syntax: open a .sls or Salt Jinja file to preview how it renders.');
      return;
    }
    const sourceUri = editor.document.uri;
    stateFor(sourceUri);
    current = sourceUri.toString();
    render(current);
    const doc = await vscode.workspace.openTextDocument(previewUriFor(sourceUri));
    await vscode.languages.setTextDocumentLanguage(doc, 'yaml');
    await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true, preview: false });
    if (panel) {
      panel.show(true);
    } else {
      // First open: the panel has to be focused once to be created; hand
      // focus straight back to the formula.
      await vscode.commands.executeCommand('saltSyntax.previewInputs.focus');
      await vscode.window.showTextDocument(editor.document, { viewColumn: editor.viewColumn, preserveFocus: false });
    }
    postState();
  }

  // Scroll sync (#48): scrolling the formula scrolls its preview to the
  // matching rendered line and back, through the renderer's line map (or by
  // the same fraction of the file when there's none). Toggled by
  // saltSyntax.preview.scrollSync -- the lock/unlock button on the preview.
  // Scrolling one editor makes VS Code report the other one scrolled too;
  // those echoes are ignored for a moment, so the two don't chase each other.
  const scrolledByUs = new Map(); // document uri string -> when we last scrolled it
  const SYNC_ECHO_MS = 300;
  const scrollSyncOn = () => vscode.workspace.getConfiguration('saltSyntax.preview').get('scrollSync', true);

  function syncScroll(fromEditor) {
    if (!scrollSyncOn() || !fromEditor.visibleRanges.length) return;
    const uri = fromEditor.document.uri;
    if (Date.now() - (scrolledByUs.get(uri.toString()) || 0) < SYNC_ECHO_MS) return;
    const fromPreview = uri.scheme === SCHEME;
    const state = states.get(fromPreview ? sourceOfPreview(uri) : uri.toString());
    const r = state && state.result;
    if (!r || r.fatal || r.error) return;
    const target = (fromPreview ? state.uri : previewUriFor(state.uri)).toString();
    const other = vscode.window.visibleTextEditors.find((e) => e.document.uri.toString() === target);
    if (!other) return;
    const top = fromEditor.visibleRanges[0].start.line;
    const head = headerLines(state).length;
    const map = r.lineMap || proportionalMap(r.rendered, other.document.lineCount, fromEditor.document.lineCount, fromPreview);
    const line = fromPreview ? sourceLineOf(map, head, top) : previewLineOf(map, head, top);
    scrolledByUs.set(target, Date.now());
    other.revealRange(new vscode.Range(line, 0, line, 0), vscode.TextEditorRevealType.AtTop);
  }

  // Where a preview line came from (#59): { uri, line } (0-based) in the
  // template that produced it -- the formula itself, a macro library, an
  // included file -- or null (header, no map, a line the mapping couldn't
  // trace). `calling` also gives the formula line that pulled it in.
  function originOf(state, previewLine) {
    const r = state.result;
    const head = headerLines(state).length;
    const i = previewLine - head;
    if (!r.lineOrigins || i < 0 || i >= renderedLineCount(r)) return null; // (the variables section, #65)
    const origin = r.lineOrigins[Math.min(i, r.lineOrigins.length - 1)];
    const calling = r.lineMap && r.lineMap[Math.min(i, r.lineMap.length - 1)];
    if (!origin) return null;
    return {
      uri: origin[0] === 0 ? state.uri : vscode.Uri.file(r.lineFiles[origin[0]]),
      line: origin[1] - 1,
      calling: calling ? { uri: state.uri, line: calling - 1 } : null
    };
  }

  const editorFor = (uri) => vscode.window.visibleTextEditors.find((e) => e.document.uri.toString() === uri.toString());

  // Character origins (#60), for Go to Source Line only: rendered on demand
  // when it's used -- the same render with every piece of template text and
  // every {{ }} output traced to its source character -- and used only if it
  // produced exactly the text the preview shows. Null otherwise.
  async function charOriginsFor(state) {
    const r = state.result;
    if (!r || r.fatal || r.error || state.lastSource === undefined) return null;
    const traced = await runRenderer({ ...renderRequest(state, state.lastSource, state.saltVersion || '3008'), charOrigins: true });
    return traced && traced.charOrigins && traced.rendered === r.rendered ? traced : null;
  }

  // The run of a preview line that `character` falls in -- { run, uri, line
  // (0-based), col } with `col` that character's own column for template
  // text, the tag's for an expression's output -- or null.
  function charOriginAt(state, traced, previewLine, character) {
    const i = previewLine - headerLines(state).length;
    if (i >= renderedLineCount(state.result)) return null; // the variables section (#65)
    const runs = traced && i >= 0 ? traced.charOrigins[i] : null;
    const run = runs && runs.find((x) => character >= x[0] && character < x[1]);
    if (!run) return null;
    return {
      run,
      uri: run[2] === 0 ? state.uri : vscode.Uri.file(traced.charFiles[run[2]]),
      line: run[3] - 1,
      col: run[5] === 'E' ? run[4] : run[4] + (character - run[0])
    };
  }

  // Go to Source Line (#50, #59): from the preview's cursor line to the
  // template line that produced it -- in the formula, or the macro library /
  // included file it really came from -- selected, in the formula's own
  // column (Go to Definition would open it in the preview's), or wherever
  // that file is already open.
  async function goToSource() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.scheme !== SCHEME) return;
    const state = states.get(sourceOfPreview(editor.document.uri));
    const r = state && state.result;
    if (!r || r.fatal || r.error) return;
    const line = editor.selection.active.line;
    const head = headerLines(state).length;
    if (line < head || line - head >= renderedLineCount(r)) return; // header, or the variables section (#65)
    // Character origins (#60): straight to the character, where known.
    const exact = charOriginAt(state, await charOriginsFor(state), line, editor.selection.active.character);
    if (exact && exact.run[5] !== 'X') {
      await vscode.workspace.openTextDocument(exact.uri);
      const open = editorFor(exact.uri) || editorFor(state.uri);
      await vscode.window.showTextDocument(exact.uri, {
        viewColumn: open ? open.viewColumn : vscode.ViewColumn.One,
        selection: new vscode.Range(exact.line, exact.col, exact.line, exact.col + (exact.run[5] === 'E' ? exact.run[6].length : 1))
      });
      return;
    }
    const origin = originOf(state, line);
    if (!origin) {
      vscode.window.showInformationMessage("Salt Syntax: this line can't be traced to its source (the template text is transformed on its way to the output, e.g. passed through tojson).");
      return;
    }
    const target = await vscode.workspace.openTextDocument(origin.uri);
    const open = editorFor(origin.uri) || editorFor(state.uri);
    await vscode.window.showTextDocument(origin.uri, {
      viewColumn: open ? open.viewColumn : vscode.ViewColumn.One,
      selection: new vscode.Range(origin.line, 0, origin.line, target.lineAt(origin.line).text.length)
    });
  }

  // Click to reveal (#59, saltSyntax.preview.clickToSource): a mouse click
  // in the preview highlights and reveals the line it came from -- in that
  // file if it's open, else the formula line that pulled it in -- leaving
  // the cursor in the preview. Moving by keyboard clears the highlight.
  const clickHighlight = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: new vscode.ThemeColor('editor.rangeHighlightBackground')
  });
  let highlighted = null; // editor currently carrying clickHighlight
  const clearHighlight = () => {
    if (highlighted) highlighted.setDecorations(clickHighlight, []);
    highlighted = null;
  };
  function revealClicked(e) {
    if (e.textEditor.document.uri.scheme !== SCHEME) return;
    const state = states.get(sourceOfPreview(e.textEditor.document.uri));
    const r = state && state.result;
    clearHighlight();
    if (e.kind !== vscode.TextEditorSelectionChangeKind.Mouse || !r || r.fatal || r.error) return;
    if (!vscode.workspace.getConfiguration('saltSyntax.preview').get('clickToSource', true)) return;
    const origin = originOf(state, e.selections[0].active.line);
    if (!origin) return;
    const target = editorFor(origin.uri) ? origin : origin.calling;
    const editor = target && editorFor(target.uri);
    if (!editor) return;
    // Scroll sync would otherwise move the preview to follow.
    scrolledByUs.set(target.uri.toString(), Date.now());
    const range = new vscode.Range(target.line, 0, target.line, 0);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    editor.setDecorations(clickHighlight, [range]);
    highlighted = editor;
  }

  function setScrollSync(on) {
    return vscode.workspace.getConfiguration('saltSyntax.preview').update('scrollSync', on, vscode.ConfigurationTarget.Global);
  }

  const timers = new Map();
  context.subscriptions.push(
    clickHighlight,
    vscode.commands.registerCommand('saltSyntax.preview.goToSource', goToSource),
    vscode.window.onDidChangeTextEditorSelection(revealClicked),
    vscode.commands.registerCommand('saltSyntax.preview.lockScroll', () => setScrollSync(true)),
    vscode.commands.registerCommand('saltSyntax.preview.unlockScroll', () => setScrollSync(false)),
    vscode.window.onDidChangeTextEditorVisibleRanges((e) => syncScroll(e.textEditor)),
    vscode.commands.registerCommand('saltSyntax.openRenderedPreview', openPreview),
    vscode.workspace.onDidChangeTextDocument((e) => {
      const key = e.document.uri.toString();
      if (e.document.uri.scheme === SCHEME) {
        // The preview just took on new text: place the diagnostics waiting
        // for exactly that text (see setPreviewDiagnosticsWhenShown).
        const state = states.get(sourceOfPreview(e.document.uri));
        const pending = state && state.pendingPreview;
        if (pending && e.document.getText() === pending.text) {
          diagnostics.set(pending.uri, pending.list);
          state.pendingPreview = null;
        }
        // New text moves the preview on its own: that's not the user
        // scrolling it. Line it up with the formula again instead.
        scrolledByUs.set(e.document.uri.toString(), Date.now());
        const sourceEditor = state && vscode.window.visibleTextEditors.find((ed) => ed.document.uri.toString() === state.uri.toString());
        if (sourceEditor) syncScroll(sourceEditor);
        return;
      }
      if (!states.has(key)) return;
      clearTimeout(timers.get(key));
      timers.set(key, setTimeout(() => render(key), 400));
    }),
    // An imported file (map.jinja, defaults.yaml, ...) is read from disk, so
    // saving any file re-renders every open preview.
    vscode.workspace.onDidSaveTextDocument(() => {
      for (const key of states.keys()) render(key);
    }),
    // Where 3006 and 3008 differ (e.g. which compiler errors exist), the
    // checks follow saltSyntax.saltVersion -- re-check when it changes.
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('saltSyntax.saltVersion') || e.affectsConfiguration('saltSyntax.preview.showVariables')) {
        for (const key of states.keys()) render(key);
      }
    }),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (!editor) return;
      const uri = editor.document.uri;
      const key = uri.scheme === SCHEME ? sourceOfPreview(uri) : uri.toString();
      if (states.has(key) && key !== current) {
        current = key;
        postState();
      }
    })
  );
}

// Scroll sync's line mapping (#48). `map` holds the source line (1-based)
// behind each rendered line; the preview shows `head` header lines first.
// The preview line for a formula's top line: where the nearest source line
// at or below it first renders (a loop body's first pass, not a macro
// defined further down that happened to print earlier).
function previewLineOf(map, head, sourceLine) {
  if (sourceLine <= 0 || !map.length) return 0;
  let best = -1;
  map.forEach((s, i) => {
    if (s - 1 >= sourceLine && (best < 0 || s < map[best])) best = i;
  });
  return (best < 0 ? map.length - 1 : best) + head;
}

// The formula line for a preview's top line: the source line that
// produced it (the header maps to the top).
// A line the mapping couldn't trace (null, #59) takes the nearest traced
// line -- the one above when two are equally near.
function sourceLineOf(map, head, previewLine) {
  if (previewLine < head || !map.length) return 0;
  const i = Math.min(previewLine - head, map.length - 1);
  for (let d = 0; d < map.length; d++) {
    if (map[i - d] != null) return map[i - d] - 1;
    if (map[i + d] != null) return map[i + d] - 1;
  }
  return 0;
}

// Without a line map: a stand-in that spreads the rendered lines evenly
// over the formula's, so both scroll by the same fraction of the file.
function proportionalMap(rendered, otherLineCount, ownLineCount, fromPreview) {
  const renderedCount = (rendered || '').split('\n').length;
  const sourceCount = Math.max(1, fromPreview ? otherLineCount : ownLineCount);
  return Array.from({ length: renderedCount }, (_, i) => 1 + Math.floor((i * sourceCount) / renderedCount));
}

// How many preview lines the rendered output takes: a final newline's empty
// last line is where the variables section (#65) starts, if there is one.
function renderedLineCount(r) {
  const lines = (r.rendered || '').split('\n').length;
  return r.variables && (r.rendered === '' || r.rendered.endsWith('\n')) ? lines - 1 : lines;
}

function panelHtml(webview) {
  const nonce = Array.from({ length: 24 }, () => Math.random().toString(36)[2]).join('');
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>
  body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); padding: 4px 12px 12px; }
  .file { opacity: .8; margin: 4px 0 8px; }
  .msg { padding: 6px 8px; margin: 6px 0; border-left: 3px solid var(--vscode-editorWarning-foreground); background: var(--vscode-textBlockQuote-background); white-space: pre-wrap; }
  .msg.err { border-color: var(--vscode-editorError-foreground); }
  h3 { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; opacity: .75; margin: 14px 0 4px; font-weight: 600; }
  .row { display: grid; grid-template-columns: 14px minmax(180px, 34%) 1fr auto; gap: 8px; align-items: center; padding: 2px 0; }
  .dot { width: 8px; height: 8px; border-radius: 50%; justify-self: center; }
  .dot.answered { background: var(--vscode-testing-iconPassed, #3fb950); }
  .dot.default { background: var(--vscode-editorWarning-foreground, #d29922); }
  .dot.unknown { background: var(--vscode-editorError-foreground, #f85149); }
  .key { font-family: var(--vscode-editor-font-family); overflow-wrap: anywhere; }
  .where { opacity: .6; font-size: 11px; margin-left: 6px; cursor: pointer; }
  .where:hover { text-decoration: underline; }
  input { width: 100%; box-sizing: border-box; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent); padding: 3px 6px; font-family: var(--vscode-editor-font-family); }
  input:focus { outline: 1px solid var(--vscode-focusBorder); }
  button { background: none; border: none; color: var(--vscode-foreground); opacity: .6; cursor: pointer; }
  button:hover { opacity: 1; }
  .hint { opacity: .6; font-size: 11px; margin-top: 12px; }
  .profile { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 4px 0 8px; }
  .profile select { background: var(--vscode-dropdown-background); color: var(--vscode-dropdown-foreground); border: 1px solid var(--vscode-dropdown-border, transparent); padding: 2px 4px; font-family: inherit; }
  .profile button { opacity: .8; padding: 2px 6px; border: 1px solid var(--vscode-button-secondaryBackground, transparent); border-radius: 2px; }
  summary { cursor: pointer; }
  summary h3 { display: inline; }
  .empty { opacity: .7; margin-top: 12px; }
</style></head>
<body>
<div id="root"><div class="empty">Open a .sls or Salt Jinja file and run <b>Salt Syntax: Open Rendered Preview</b> (or the preview button in the editor title bar).</div></div>
<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
const root = document.getElementById('root');
const timers = {};
let otherOpen = false;
function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); }
  for (const k of kids) if (k !== null && k !== undefined) e.append(k);
  return e;
}
function send(id, value) { clearTimeout(timers[id]); vscode.postMessage({ type: 'answer', id, value }); }
function row(q, kinds) {
  const status = q.answered ? 'answered' : (q.default !== null ? 'default' : 'unknown');
  const title = q.answered ? 'Answered' : (q.default !== null ? 'Not answered: the default in the code is used' : 'Not answered and no default: renders as a «placeholder»');
  const input = el('input', { value: q.value, placeholder: q.default !== null ? 'default: ' + q.default : 'no default — type a YAML value', 'data-id': q.id, spellcheck: 'false' });
  input.addEventListener('input', () => { clearTimeout(timers[q.id]); timers[q.id] = setTimeout(() => send(q.id, input.value), 600); });
  input.addEventListener('change', () => send(q.id, input.value));
  const where = q.lines.length ? el('span', { class: 'where', title: 'Jump to line', onclick: () => vscode.postMessage({ type: 'reveal', line: q.lines[0] }) }, 'line ' + q.lines.join(', ')) : el('span', { class: 'where', title: 'Read in an imported file or through a computed key' }, 'via import / computed');
  return el('div', { class: 'row' },
    el('div', { class: 'dot ' + status, title }),
    el('div', {}, el('span', { class: 'key' }, q.key), where),
    input,
    el('button', { title: 'Clear answer', onclick: () => { input.value = ''; send(q.id, ''); } }, '✕'));
}
function render(s) {
  // Keep whatever input has focus (and its caret) intact across updates.
  const active = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.id;
  const caret = active ? document.activeElement.selectionStart : null;
  const typed = active ? document.activeElement.value : null; // may not be sent yet
  root.replaceChildren();
  // The profile every preview renders with (#73): switch, add, rename,
  // delete, or clear it -- the extension asks for names and confirmations.
  const select = el('select', { title: 'Answer set every preview renders with' });
  for (const p of s.profiles) { const o = el('option', { value: p }, p); if (p === s.profile) o.selected = true; select.append(o); }
  select.addEventListener('change', () => vscode.postMessage({ type: 'profile', action: 'switch', name: select.value }));
  const act = (action, label, title) => el('button', { title, onclick: () => vscode.postMessage({ type: 'profile', action }) }, label);
  root.append(el('div', { class: 'profile' }, el('span', {}, 'Profile'), select,
    act('new', 'New…', 'New profile, empty or a copy of this one'),
    act('rename', 'Rename…', 'Rename this profile'),
    act('delete', 'Delete', 'Delete this profile and its answers'),
    act('clear', 'Clear answers', 'Wipe every answer in this profile')));
  root.append(el('div', { class: 'file' }, s.file));
  if (s.fatal) { root.append(el('div', { class: 'msg err' }, s.fatal)); return; }
  if (s.error) root.append(el('div', { class: 'msg' }, 'Render error' + (s.error.line ? ' (' + (s.error.file || '') + ' line ' + s.error.line + ')' : '') + ': ' + s.error.message));
  for (const y of s.yamlErrors) root.append(el('div', { class: 'msg' }, y));
  for (const w of s.warnings) root.append(el('div', { class: 'msg' }, w));
  if (s.rendering) root.append(el('div', { class: 'empty' }, 'Rendering…'));
  const byKind = {};
  for (const q of s.questions) (byKind[q.kind] = byKind[q.kind] || []).push(q);
  for (const kind of Object.keys(s.kinds)) {
    if (!byKind[kind]) continue;
    root.append(el('h3', {}, s.kinds[kind] + ' (' + byKind[kind].length + ')'));
    for (const q of byKind[kind]) root.append(row(q, s.kinds));
  }
  if (!s.rendering && !s.questions.length && !s.error) root.append(el('div', { class: 'empty' }, 'This file’s Jinja reads no external inputs.'));
  if (s.unused.length) {
    // Answers other files read, or none does any more -- collapsed, kept
    // open across updates once opened.
    const other = el('details', { id: 'other' }, el('summary', {}, el('h3', {}, 'Other answers in this profile (' + s.unused.length + ')')));
    if (otherOpen) other.open = true;
    other.addEventListener('toggle', () => { otherOpen = other.open; });
    for (const u of s.unused) other.append(el('div', { class: 'row' }, el('div', {}), el('div', {}, el('span', { class: 'key' }, u.id.replace('|', ': '))), el('div', { class: 'where' }, u.value), el('button', { title: 'Forget this answer', onclick: () => send(u.id, '') }, '✕')));
    root.append(other);
  }
  root.append(el('div', { class: 'hint' }, 'Values are YAML: 8080, true, "text", [a, b], {key: value}. Answers belong to the profile, shared by every file, and are kept until cleared.'));
  if (active) { const again = root.querySelector('input[data-id="' + CSS.escape(active) + '"]'); if (again) { again.value = typed; again.focus(); if (caret !== null) again.setSelectionRange(caret, caret); } }
}
window.addEventListener('message', (e) => {
  if (e.data.type === 'state') render(e.data);
  if (e.data.type === 'empty') root.replaceChildren(el('div', { class: 'empty' }, 'Open a .sls or Salt Jinja file and run Salt Syntax: Open Rendered Preview.'));
});
vscode.postMessage({ type: 'ready' });
</script></body></html>`;
}

module.exports = { register, previewLineOf, sourceLineOf, proportionalMap };
