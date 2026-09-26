// The non-ASCII check (#16), its quick fixes and the convert command.
const assert = require('assert');
const { load, doc } = require('./helpers/vscode');

(async () => {
  const h = await load();
  const text = '# Install – the “nginx” package now\nnginx:\n  pkg.installed:\n    - name: café​\n    - comment: 日本 ok\n    - x: é Ａ ﬁ\nplain: ascii';
  const d = doc(text);
  await h.open(d);
  const list = h.reg.collections['salt-syntax-non-ascii'].get(d.uri);
  assert.strictEqual(list.length, 9, 'one warning per run of non-ASCII characters');
  assert.match(list[0].message, /U\+2013.*replace with `-`/);
  assert.match(list.find((x) => /U\+65E5/.test(x.message)).message, /No ASCII equivalent/);
  assert.ok(list.every((x) => x.severity === 1), 'warnings');

  const actions = h.reg.codeActions.flatMap((c) => c.provider.provideCodeActions(d, null, { diagnostics: list }) || []);
  assert.ok(actions.some((a) => a.title === 'Replace with ASCII `"`'), 'per-character quick fix');
  assert.ok(actions.some((a) => /Convert all non-ASCII/.test(a.title)), 'convert-all quick fix');

  h.vscode.window.activeTextEditor = { document: d };
  await h.reg.commands['saltSyntax.convertToAscii']();
  const out = text.split('\n');
  for (const e of [...h.reg.appliedEdit.edits].reverse()) {
    const l = e.range.start.line;
    out[l] = out[l].slice(0, e.range.start.character) + e.text + out[l].slice(e.range.end.character);
  }
  assert.strictEqual(out.join('\n'), '# Install - the "nginx" package now\nnginx:\n  pkg.installed:\n    - name: cafe\n    - comment: 日本 ok\n    - x: e A fi\nplain: ascii');

  await h.open(doc('café', { languageId: 'python', path: '/w/x.py' }));
  assert.strictEqual(h.reg.collections['salt-syntax-non-ascii'].get('file:/w/x.py'), undefined, 'non-Salt files ignored');
  h.vscode.workspace.textDocuments.push(d);
  h.config['saltSyntax.nonAsciiCheck'] = false;
  await h.fireConfig('saltSyntax.nonAsciiCheck');
  assert.strictEqual(h.reg.collections['salt-syntax-non-ascii'].get(d.uri), undefined, 'setting off clears');
  console.log('ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
