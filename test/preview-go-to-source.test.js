// Go to Formula Line (#50): from a preview line to the formula line that
// produced it, in the formula's own column, through the line map (#48).
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

const ROOT = path.join(__dirname, 'fixtures', 'errors');
const FILE = path.join(ROOT, 'f', 'init.sls');

(async () => {
  const h = await load({ config: { 'saltSyntax.preview.fileRoots': [ROOT] } });
  const provider = () => h.reg.contentProviders['salt-preview'];
  const source = doc('a: test.nop\n', { path: FILE });
  h.vscode.workspace.textDocuments.push(source);
  h.vscode.window.activeTextEditor = { document: source, viewColumn: 1 };
  await h.reg.commands['saltSyntax.openRenderedPreview']();
  const previewDoc = h.reg.opened[0];
  provider().onDidChange((u) =>
    setTimeout(() => {
      previewDoc.setText(provider().provideTextDocumentContent(u));
      h.change(previewDoc);
    }, 30)
  );
  const edit = async (text, want) => {
    source.setText(text);
    await h.change(source);
    await until(() => previewDoc.getText().includes(want) && previewDoc.getText() === provider().provideTextDocumentContent(previewDoc.uri), `render showing ${want}`);
  };
  // The formula sits in column 2 here, the preview in column 1: the jump
  // has to go to the formula's column, wherever that is.
  h.vscode.window.visibleTextEditors.push({ document: source, viewColumn: 2, visibleRanges: [] });
  const shown = [];
  h.vscode.window.showTextDocument = async (d, opts) => (shown.push([d.toString(), opts.viewColumn, opts.selection]), {});
  const goFrom = async (line) => {
    h.vscode.window.activeTextEditor = { document: previewDoc, viewColumn: 1, selection: new h.vscode.Selection(line, 0, line, 0) };
    await h.reg.commands['saltSyntax.preview.goToSource']();
  };
  const lines = () => previewDoc.getText().split('\n');

  await edit('{% for i in [1, 2] %}\ns{{ i }}:\n  test.nop\n{% endfor %}\nend:\n  test.nop\n', 'end:');
  await goFrom(lines().indexOf('s2:'));
  const [where, column, sel] = shown.pop();
  assert.deepStrictEqual([where, column], [source.uri.toString(), 2], "the formula, in its own column");
  assert.deepStrictEqual([sel.start.line, sel.start.character, sel.end.line, sel.end.character], [1, 0, 1, 's{{ i }}:'.length], 'the loop line, selected');
  await goFrom(lines().lastIndexOf('  test.nop'));
  assert.strictEqual(shown.pop()[2].start.line, 5, 'last line');

  // The header maps to nothing.
  await goFrom(0);
  assert.strictEqual(shown.length, 0, 'header: no jump');

  // No line map: says so rather than guessing.
  await edit('{% macro m() %}\nq\n{% endmacro %}v: {{ m() | tojson }}\n', 'v:');
  await goFrom(lines().findIndex((l) => l.startsWith('v:')));
  assert.strictEqual(shown.length, 0, 'no map: no jump');
  assert.match(h.reg.info.pop(), /can't be traced/);
  console.log('ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
