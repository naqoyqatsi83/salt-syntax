// EXPERIMENTAL (#23, see docs/design/jinja-render-preview.md): rendered
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
const KIND_LABELS = { grains: 'Grains', pillar: 'Pillar', config: 'Config / opts', salt: 'Salt function calls', variable: 'Undefined variables' };

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

  async function render(uriString) {
    const state = states.get(uriString);
    if (!state) return;
    if (state.running) {
      state.pending = true;
      return;
    }
    state.running = true;
    const doc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uriString);
    const source = doc ? doc.getText() : state.lastSource || '';
    state.lastSource = source;
    const saltVersion = vscode.workspace.getConfiguration('saltSyntax').get('saltVersion', '3008');
    state.result = await runRenderer({
      source, path: state.uri.fsPath, roots: fileRoots(state.uri), answers: state.answers,
      saltVersion, stateData: stateDataFor(saltVersion)
    });
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
      `# Salt rendered preview (experimental) — ${r.context.file}  (sls: ${r.context.sls}, tpldir: ${r.context.tpldir || '.'}, checked as Salt ${state.saltVersion || '3008'})`,
      `# ${qs.length} external input${qs.length === 1 ? '' : 's'}: ${qs.length - open.length} answered, ${open.length - noDefault.length} using the default in the code, ${noDefault.length} unknown (shown as «kind:key»). Fill them in the Salt Preview panel.`
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

  // - "Salt would reject this output" (duplicate ID, invalid YAML): an
  //   error on that line of the preview, linking to the first occurrence.
  //   It can't go on the source: a rendered line can't be traced back to
  //   the template line (or loop) that produced it.
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
        const printedAt = e.marker ? renderedLines.flatMap((l, n) => (l.includes(e.marker) ? [n + head.length] : [])) : [];
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
        for (const y of yamlErrorsOf(r)) {
          const d = make(y.line ? at(y.line) : 0, `${yamlProblemLead(y)}: ${y.message}`, vscode.DiagnosticSeverity.Warning);
          const other = y.firstLine ? [y.firstLine, 'first defined here'] : y.gaveUpLine ? [y.gaveUpLine, 'the parser gave up here'] : null;
          if (other) {
            d.relatedInformation = [new vscode.DiagnosticRelatedInformation(
              new vscode.Location(previewUri, new vscode.Range(at(other[0]), 0, at(other[0]), 0)), other[1])];
          }
          add(previewUri, d);
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
    if (r.fatal) return `# Salt rendered preview (experimental)\n#\n# ${r.fatal.split('\n').join('\n# ')}\n`;
    const head = headerLines(state);
    return r.error ? `${head.join('\n')}\n` : `${head.join('\n')}\n${r.rendered}`;
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
      states.set(key, { uri, answers: context.globalState.get(answersKey(key), {}), result: null, running: false, pending: false });
    }
    return states.get(key);
  }

  function postState() {
    if (!panel) return;
    const state = current && states.get(current);
    if (!state) {
      panel.webview.postMessage({ type: 'empty' });
      return;
    }
    const r = state.result || {};
    const questions = (r.questions || []).map((q) => ({ ...q, lines: (state.lines || {})[q.id] || [], value: state.answers[q.id] || '' }));
    const asked = new Set(questions.map((q) => q.id));
    const unused = Object.keys(state.answers).filter((id) => !asked.has(id) && state.answers[id] !== '').map((id) => ({ id, value: state.answers[id] }));
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
      unused
    });
  }

  function setAnswer(id, value) {
    const state = current && states.get(current);
    if (!state) return;
    if (value === '' || value === undefined) delete state.answers[id];
    else state.answers[id] = value;
    context.globalState.update(answersKey(current), state.answers);
    render(current);
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
          if (m.type === 'reveal' && current) {
            const state = states.get(current);
            vscode.window.showTextDocument(state.uri, { selection: new vscode.Range(m.line - 1, 0, m.line - 1, 0), viewColumn: vscode.ViewColumn.One });
          }
        });
        view.onDidDispose(() => (panel = null));
      }
    }, { webviewOptions: { retainContextWhenHidden: true } })
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

  const timers = new Map();
  context.subscriptions.push(
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
      if (e.affectsConfiguration('saltSyntax.saltVersion')) for (const key of states.keys()) render(key);
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
  .empty { opacity: .7; margin-top: 12px; }
</style></head>
<body>
<div id="root"><div class="empty">Open a .sls or Salt Jinja file and run <b>Salt Syntax: Open Rendered Preview</b> (or the preview button in the editor title bar).</div></div>
<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
const root = document.getElementById('root');
const timers = {};
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
    root.append(el('h3', {}, 'Answers not used by this render (' + s.unused.length + ')'));
    for (const u of s.unused) root.append(el('div', { class: 'row' }, el('div', {}), el('div', {}, el('span', { class: 'key' }, u.id.replace('|', ': '))), el('div', { class: 'where' }, u.value), el('button', { title: 'Forget this answer', onclick: () => send(u.id, '') }, '✕')));
  }
  root.append(el('div', { class: 'hint' }, 'Values are YAML: 8080, true, "text", [a, b], {key: value}. Answers are remembered per file.'));
  if (active) { const again = root.querySelector('input[data-id="' + CSS.escape(active) + '"]'); if (again) { again.value = typed; again.focus(); if (caret !== null) again.setSelectionRange(caret, caret); } }
}
window.addEventListener('message', (e) => {
  if (e.data.type === 'state') render(e.data);
  if (e.data.type === 'empty') root.replaceChildren(el('div', { class: 'empty' }, 'Open a .sls or Salt Jinja file and run Salt Syntax: Open Rendered Preview.'));
});
vscode.postMessage({ type: 'ready' });
</script></body></html>`;
}

module.exports = { register };
