// The rendered preview's VS Code side (#23): diagnostics placement on the
// source and the preview, the panel, answering inputs, and the timing of
// preview diagnostics vs. VS Code applying the preview's new text.
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
  const diags = h.reg.collections['salt-preview'];
  const posted = [];
  let fromPanel;
  h.reg.webviews['saltSyntax.previewInputs'].resolveWebviewView({
    webview: { options: {}, cspSource: '', postMessage: (m) => posted.push(m), onDidReceiveMessage: (f) => (fromPanel = f) },
    onDidDispose: () => {},
    show: () => {}
  });
  const lastState = () => posted.filter((m) => m.type === 'state').pop();

  // Like VS Code: the preview document takes on new text a moment after the
  // provider's onDidChange, then onDidChangeTextDocument fires for it.
  let previewDoc;
  const provider = () => h.reg.contentProviders['salt-preview'];
  const source = doc('a: test.nop\n', { path: FILE });
  h.vscode.workspace.textDocuments.push(source);
  h.vscode.window.activeTextEditor = { document: source, viewColumn: 1 };
  await h.reg.commands['saltSyntax.openRenderedPreview']();
  previewDoc = h.reg.opened[0];
  const setsWhileStale = [];
  const realSet = diags.set;
  diags.set = (u, list) => {
    if (u.scheme === 'salt-preview' && previewDoc.getText() !== provider().provideTextDocumentContent(previewDoc.uri)) setsWhileStale.push(u.toString());
    realSet(u, list);
  };
  provider().onDidChange((u) =>
    setTimeout(() => {
      previewDoc.setText(provider().provideTextDocumentContent(u));
      h.change(previewDoc);
    }, 30)
  );
  const previewLines = () => previewDoc.getText().split('\n');
  const onPreview = () => diags.get(previewDoc.uri) || [];
  const edit = async (text, settled) => {
    source.setText(text);
    await h.change(source);
    await until(async () => previewDoc.getText() === provider().provideTextDocumentContent(previewDoc.uri) && !/Rendering/.test(previewDoc.getText()) && (await settled()), `render of ${JSON.stringify(text.slice(0, 40))}`);
  };

  // Duplicate IDs + an unemulated filter: errors on the preview's lines.
  const E = '\u{1F60A}';
  await edit(`a:\n  test.nop\n{% for i in ['x', 'y', 'x'] %}\n{{ sls }}.{{ i }}:\n  test.nop\n{% endfor %}\nb:\n  test.nop:\n    - name: {{ 'v' | not_a_salt_filter }}\n`, () => onPreview().length === 2);
  let lines = previewLines();
  const dup = onPreview().find((d) => /conflicting/.test(d.message));
  assert.strictEqual(lines[dup.range.start.line], 'f.x:', 'on the second duplicate');
  assert.strictEqual(lines[dup.relatedInformation[0].location.range.start.line], 'f.x:', 'related info on the first');
  assert.ok(dup.relatedInformation[0].location.range.start.line < dup.range.start.line);
  assert.match(lines[onPreview().find((d) => /not_a_salt_filter/.test(d.message)).range.start.line], /not_a_salt_filter/, 'warning on its header line');
  assert.ok(onPreview().every((d) => d.severity === 1), 'all amber (Warning)');
  assert.strictEqual(lastState().yamlErrors[0], lines.find((l) => l.startsWith('# ⚠ Salt would reject')).replace('# ⚠ ', ''), 'panel = header');

  // A stray line before a duplicate: both reported, each on its own line.
  await edit(`a:\n  test.nop\nf.x:\n  test.nop\n${E}\n\nf.x:\n  test.nop\n`, () => onPreview().length === 2 && previewLines().includes(E));
  lines = previewLines();
  assert.deepStrictEqual(onPreview().map((d) => lines[d.range.start.line]), [E, 'f.x:']);

  // An argument that rendered empty.
  await edit(`{{ sls }}.state_id:\n  file.managed:\n    - name: \n`, () => onPreview().length === 1 && /state_id/.test(previewDoc.getText()));
  assert.match(onPreview()[0].message, /^Suspicious output: 'name' has no value/);
  assert.strictEqual(previewLines()[onPreview()[0].range.start.line], '    - name: ');

  // Undefined variable: on the source line and the rendered line; answering clears it.
  await edit(`{{ sls }}.state_id:\n  file.managed:\n    - name: {{ nothing }}\n`, () => !!diags.get(source.uri));
  assert.strictEqual(diags.get(source.uri)[0].range.start.line, 2);
  assert.match(diags.get(source.uri)[0].message, /^Salt would fail to render this: Jinja variable 'nothing' is undefined/);
  assert.deepStrictEqual(onPreview().filter((d) => /fail to render/.test(d.message)).map((d) => previewLines()[d.range.start.line]), ['    - name: «variable:nothing»']);
  fromPanel({ type: 'answer', id: 'variable|nothing', value: '/etc/x' });
  await until(() => !diags.get(source.uri), 'answer clears the warning');

  // Render errors land on the source line, or in the imported file.
  await edit(`a: 1\nb: {{ oops( }}\n`, () => !!diags.get(source.uri));
  assert.strictEqual(diags.get(source.uri)[0].range.start.line, 1);
  await edit(`{% from "f/map.jinja" import m %}\na: {{ m.a }}\n`, () => !!diags.get(`file:${path.join(ROOT, 'f', 'map.jinja')}`));
  assert.strictEqual(diags.get(`file:${path.join(ROOT, 'f', 'map.jinja')}`)[0].range.start.line, 1);
  assert.ok(!diags.get(source.uri), 'source diagnostic cleared');

  // Edits that change the line count: diagnostics still land right (b3b1728).
  const base = `a:\n  test.nop\n{% for item in ['a', 'b'] %}\n{{ sls }}.___{{ item }}:\n  test.nop\n\n{{ sls }}.___{{ loop.index }}:\n  test.nop\n\n{% endfor %}\n\n{{ sls }}.___a:\n  test.nop\n{{ sls }}.___{{ kokot }}:\n  test.nop\n`;
  for (const text of [base, base.replace('\n\n{% endfor %}', '\n{% endfor %}'), base.replace('\n\n{{ sls }}.___a', '\n{{ sls }}.___a')]) {
    await edit(text, () => onPreview().length === 2);
    lines = previewLines();
    for (const d of onPreview()) {
      if (/conflicting ID '([^']+)'/.test(d.message)) assert.strictEqual(lines[d.range.start.line], `${d.message.match(/conflicting ID '([^']+)'/)[1]}:`);
      else assert.ok(lines[d.range.start.line].includes('«variable:kokot»'), lines[d.range.start.line]);
    }
  }
  assert.deepStrictEqual(setsWhileStale, [], 'preview diagnostics never set before the new text landed');

  // Fixed -> everything cleared.
  await edit('a: test.nop\n', () => onPreview().length === 0 && !diags.get(source.uri));
  console.log('ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
