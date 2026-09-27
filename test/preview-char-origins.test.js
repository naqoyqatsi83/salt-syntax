// Character origins in the preview (#60, experimental): the hover says where
// a character came from; empty lines left by tag-only lines get a hint.
// Renders for real, so it needs python3 with jinja2 + pyyaml (else skipped).
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { load, doc, until, Position } = require('./helpers/vscode');

const probe = spawnSync(process.env.PYTHON || 'python3', ['-c', 'import jinja2, yaml'], { encoding: 'utf8' });
if (probe.status !== 0) {
  console.log('skipped: python3 with jinja2 + pyyaml not available');
  process.exit(77);
}

const ROOT = path.join(__dirname, 'fixtures', 'origins');
const FILE = path.join(ROOT, 'o', 'init.sls');

(async () => {
  const h = await load({ config: { 'saltSyntax.preview.fileRoots': [ROOT] } });
  const provider = () => h.reg.contentProviders['salt-preview'];
  const source = doc(`${fs.readFileSync(FILE, 'utf8')}{% if true %}\nz: 1\n{% endif %}\n`, { path: FILE });
  h.vscode.workspace.textDocuments.push(source);
  h.vscode.window.activeTextEditor = { document: source, viewColumn: 1 };
  await h.reg.commands['saltSyntax.openRenderedPreview']();
  const previewDoc = h.reg.opened[0];
  await until(() => !/Rendering/.test(provider().provideTextDocumentContent(previewDoc.uri)), 'first render');
  previewDoc.setText(provider().provideTextDocumentContent(previewDoc.uri));
  await h.change(previewDoc);
  const lines = previewDoc.getText().split('\n');
  const hover = h.reg.hover.find((x) => x.sel.scheme === 'salt-preview').provider;
  const at = (line, character) => {
    const r = hover.provideHover(previewDoc, new Position(line, character));
    return r && r.contents.value;
  };

  // An expression's output, and template text from another file (a space,
  // shown under a caret in its source line).
  const y = lines.indexOf('y: 8081');
  assert.strictEqual(at(y, 4), 'Output of `{{ data.port + 1 }}` · init.sls line 5');
  const nop = lines.indexOf('  test.nop');
  assert.strictEqual(at(nop, 0), 'Template text: a space from lib.jinja line 4, column 1\n\n```\n  test.nop\n^\n```');
  assert.match(at(y, 0), /^Template text: `y` from init\.sls line 5, column 1/);

  // Empty lines left by tag-only lines: information on the preview line,
  // with the fix where it helps, linked to the tag.
  const hints = (h.reg.collections['salt-preview'].get(previewDoc.uri) || []).filter((d) => d.code === 'blank-line');
  const ifHint = hints.find((d) => d.message.includes('{% if true %}'));
  assert.ok(ifHint, 'the if line');
  assert.strictEqual(ifHint.message, 'Empty line: the newline after `{% if true %}` (init.sls line 6) -- `{%- if true %}` would remove it.');
  assert.strictEqual(ifHint.severity, h.vscode.DiagnosticSeverity.Information);
  assert.strictEqual(lines[ifHint.range.start.line], '', 'on the empty line');
  assert.deepStrictEqual([ifHint.relatedInformation[0].location.uri.fsPath, ifHint.relatedInformation[0].location.range.start.line], [FILE, 5]);
  console.log('ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
