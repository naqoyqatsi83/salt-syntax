// The template's variables in the preview (#65): after the rendered output,
// as a second YAML document; F12 there does nothing; a setting turns it off.
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
  const source = doc("{% set users = ['alice', 'bob'] %}\na: 1\n", { path: FILE });
  h.vscode.workspace.textDocuments.push(source);
  h.vscode.window.activeTextEditor = { document: source, viewColumn: 1 };
  await h.reg.commands['saltSyntax.openRenderedPreview']();
  const previewDoc = h.reg.opened[0];
  const text = () => provider().provideTextDocumentContent(previewDoc.uri);
  await until(() => text().includes('a: 1'), 'render');

  // After the rendered text, a second YAML document with the variables.
  const lines = text().split('\n');
  const sep = lines.indexOf('---');
  assert.ok(sep > 0, 'a --- separator');
  assert.deepStrictEqual(lines.slice(sep - 1, sep), ['a: 1'], 'right after the rendered output');
  assert.match(lines[sep + 1], /^# Template variables -- not rendered output: the values f\/init\.sls ends up with/);
  assert.deepStrictEqual(lines.slice(sep + 2, sep + 5), ['users:', '- alice', '- bob']);

  // F12 on a variables line: nothing.
  previewDoc.setText(text());
  await h.change(previewDoc);
  const shown = [];
  h.vscode.window.showTextDocument = async (u, opts) => shown.push(opts);
  h.vscode.window.activeTextEditor = { document: previewDoc, viewColumn: 2, selection: new h.vscode.Selection(sep + 2, 0, sep + 2, 0) };
  await h.reg.commands['saltSyntax.preview.goToSource']();
  assert.deepStrictEqual([shown, h.reg.info], [[], []], 'no jump, no message');

  // saltSyntax.preview.showVariables off: just the rendered output.
  h.config['saltSyntax.preview.showVariables'] = false;
  await h.fireConfig('saltSyntax.preview.showVariables');
  await until(() => !text().includes('---'), 'section gone');
  assert.ok(text().endsWith('a: 1\n'));
  console.log('ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
