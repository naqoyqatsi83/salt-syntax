// Line origins across templates (#59): Go to Source Line (F12) opens the
// file a rendered line really came from -- a macro library, an included
// template -- and a mouse click in the preview highlights and reveals that
// source line without leaving the preview.
// Renders for real, so it needs python3 with jinja2 + pyyaml (else skipped).
const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');
const { load, doc, until } = require('./helpers/vscode');

const probe = spawnSync(process.env.PYTHON || 'python3', ['-c', 'import jinja2, yaml'], { encoding: 'utf8' });
if (probe.status !== 0) {
  console.log('skipped: python3 with jinja2 + pyyaml not available');
  process.exit(77);
}

const ROOT = path.join(__dirname, 'fixtures', 'origins');
const FILE = path.join(ROOT, 'o', 'init.sls');
const LIB = path.join(ROOT, 'o', 'lib.jinja');

(async () => {
  const h = await load({ config: { 'saltSyntax.preview.fileRoots': [ROOT] } });
  const provider = () => h.reg.contentProviders['salt-preview'];
  const source = doc(require('fs').readFileSync(FILE, 'utf8'), { path: FILE });
  h.vscode.workspace.textDocuments.push(source);
  h.vscode.window.activeTextEditor = { document: source, viewColumn: 1 };
  await h.reg.commands['saltSyntax.openRenderedPreview']();
  const previewDoc = h.reg.opened[0];
  previewDoc.setText(await (async () => {
    await until(() => !/Rendering/.test(provider().provideTextDocumentContent(previewDoc.uri)), 'first render');
    return provider().provideTextDocumentContent(previewDoc.uri);
  })());
  await h.change(previewDoc);
  const line = (text) => previewDoc.getText().split('\n').indexOf(text);

  // Editors on screen: the formula in column 2, the preview in column 1.
  const editor = (d, viewColumn) => {
    const ed = { document: d, viewColumn, visibleRanges: [], revealed: [], decorated: [] };
    ed.revealRange = (range) => ed.revealed.push(range.start.line);
    ed.setDecorations = (type, ranges) => ed.decorated.push(ranges.map((r) => r.start.line));
    return ed;
  };
  const formula = editor(source, 2);
  const preview = editor(previewDoc, 1);
  h.vscode.window.visibleTextEditors.push(formula, preview);
  const shown = [];
  h.vscode.window.showTextDocument = async (u, opts) => (shown.push([u.fsPath || u.toString(), opts.viewColumn, opts.selection.start.line]), {});
  const goFrom = async (n) => {
    h.vscode.window.activeTextEditor = { document: previewDoc, viewColumn: 1, selection: new h.vscode.Selection(n, 0, n, 0) };
    await h.reg.commands['saltSyntax.preview.goToSource']();
  };

  // F12 on a line a macro produced: into lib.jinja (line 3 -> 0-based 2),
  // in the formula's column; on an included line: part.sls; on the main
  // file's own line: the formula.
  await goFrom(line('x:'));
  assert.deepStrictEqual(shown.pop(), [LIB, 2, 2], 'macro line -> lib.jinja');
  await goFrom(line('included:'));
  assert.deepStrictEqual(shown.pop(), [path.join(ROOT, 'o', 'part.sls'), 2, 0], 'included line -> part.sls');
  await goFrom(line('y: 8081'));
  assert.deepStrictEqual(shown.pop().slice(1), [2, 4], 'own line -> the formula');

  // A click in the preview: highlight + reveal the source line. lib.jinja
  // isn't open -> the formula's calling line ({{ nop('x') }}, 0-based 1).
  await h.select(preview, line('x:'));
  assert.deepStrictEqual([formula.revealed.pop(), formula.decorated.pop()], [1, [1]], 'click: calling line in the formula');
  assert.strictEqual(h.vscode.window.activeTextEditor.document, previewDoc, 'focus stays in the preview');
  // lib.jinja open in column 3 -> revealed there instead.
  const lib = editor(await h.vscode.workspace.openTextDocument(h.vscode.Uri.file(LIB)), 3);
  h.vscode.window.visibleTextEditors.push(lib);
  await h.select(preview, line('x:'));
  assert.deepStrictEqual([lib.revealed.pop(), lib.decorated.pop()], [2, [2]], 'click: the macro line in lib.jinja');
  assert.deepStrictEqual(formula.decorated.pop(), [], "the formula's highlight moves away");
  // Moving by keyboard clears it; the header maps to nothing.
  await h.select(preview, line('y: 8081'), 'Keyboard');
  assert.deepStrictEqual(lib.decorated.pop(), [], 'keyboard: highlight cleared');
  const reveals = formula.revealed.length;
  await h.select(preview, 0);
  assert.strictEqual(formula.revealed.length, reveals, 'header: nothing');
  // saltSyntax.preview.clickToSource off: clicks do nothing.
  h.config['saltSyntax.preview.clickToSource'] = false;
  await h.select(preview, line('y: 8081'));
  assert.strictEqual(formula.revealed.length, reveals, 'setting off');
  console.log('ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
