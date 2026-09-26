// Typing `{{` auto-closes to `{{ | }}` (#37).
const assert = require('assert');
const { load, doc, Position, Selection, sleep } = require('./helpers/vscode');

(async () => {
  const h = await load();
  let inserted = [];
  // A change `text` just happened; the editor shows `lines`, cursors at `cursors`.
  const typed = async (text, lines, cursors, languageId = 'sls') => {
    inserted = [];
    const d = doc(lines.join('\n'), { languageId });
    h.vscode.window.activeTextEditor = {
      document: d,
      selections: cursors.map(([l, c]) => new Selection(new Position(l, c))),
      insertSnippet: (snip, where, opts) => (inserted.push({ snip: snip.value, where: where.map((p) => `${p.line}:${p.character}`), opts }), Promise.resolve(true))
    };
    await h.change(d, [{ text }]);
    await sleep(10);
    return inserted;
  };
  assert.deepStrictEqual(await typed('{ }}', ['name: {{ }}'], [[0, 8]]), [{ snip: ' ', where: ['0:8'], opts: { undoStopBefore: false, undoStopAfter: false } }]);
  assert.deepStrictEqual(await typed('% %}', ['{% %}'], [[0, 2]]), [], '{% left alone');
  assert.deepStrictEqual(await typed('# #}', ['{# #}'], [[0, 2]]), [], '{# left alone');
  assert.deepStrictEqual(await typed('{{ x }}', ['a: {{ x }}'], [[0, 10]]), [], 'pasted expression');
  assert.deepStrictEqual(await typed('', ['a: {{ }}'], [[0, 5]]), [], 'deleting back to {{| }}');
  assert.deepStrictEqual(await typed('{ }}', ['{{ }}'], [[0, 2]], 'python'), [], 'non-Salt file');
  assert.deepStrictEqual((await typed('{ }}', ['a: {{ }}', 'b: {{ }}'], [[0, 5], [1, 5]]))[0].where, ['0:5', '1:5'], 'multiple cursors');
  h.config['saltSyntax.padJinjaExpressions'] = false;
  assert.deepStrictEqual(await typed('{ }}', ['{{ }}'], [[0, 2]]), [], 'setting off');
  console.log('ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
