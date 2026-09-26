// Scroll sync between a formula and its rendered preview (#48): the line
// map's mapping both ways, the echo guard, re-syncing after a re-render,
// the no-map fallback, and the lock/unlock toggle.
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ECHO_MS = 350; // a bit over the extension's echo guard

// Pure mapping, both ways (map: source line per rendered line, 1-based).
const { previewLineOf, sourceLineOf, proportionalMap } = require('../src/preview');
const loopMap = [1, 2, 3, 1, 2, 3, 4, 5, 6, 6];
assert.strictEqual(previewLineOf(loopMap, 2, 0), 0, 'top of the formula: top of the preview, header included');
assert.strictEqual(previewLineOf(loopMap, 2, 1), 1 + 2, "a loop line: its first pass");
assert.strictEqual(previewLineOf(loopMap, 2, 4), 7 + 2, 'after the loop');
assert.strictEqual(previewLineOf([50, 51, 2, 3], 0, 1), 2, 'a macro defined below that printed first is skipped');
assert.strictEqual(previewLineOf(loopMap, 2, 99), loopMap.length - 1 + 2, 'past the end: the last line');
assert.strictEqual(sourceLineOf(loopMap, 2, 1), 0, 'header: top of the formula');
assert.strictEqual(sourceLineOf(loopMap, 2, 2 + 4), 1, 'second pass of the loop: the loop body line');
assert.deepStrictEqual(proportionalMap('a\nb\nc\nd', 2, 99, true), [1, 1, 2, 2], 'no map: spread evenly');

(async () => {
  const h = await load({ config: { 'saltSyntax.preview.fileRoots': [ROOT] } });
  const provider = () => h.reg.contentProviders['salt-preview'];
  const source = doc('a: test.nop\n', { path: FILE });
  h.vscode.workspace.textDocuments.push(source);
  h.vscode.window.activeTextEditor = { document: source, viewColumn: 1 };
  await h.reg.commands['saltSyntax.openRenderedPreview']();
  const previewDoc = h.reg.opened[0];
  // Like VS Code: the preview takes on new text a moment after onDidChange.
  provider().onDidChange((u) =>
    setTimeout(() => {
      previewDoc.setText(provider().provideTextDocumentContent(u));
      h.change(previewDoc);
    }, 30)
  );
  const editor = (d) => {
    const ed = { document: d, visibleRanges: [new h.vscode.Range(0, 0, 30, 0)], revealed: [] };
    ed.revealRange = (range, how) => ed.revealed.push([range.start.line, how]);
    return ed;
  };
  const src = editor(source);
  const pre = editor(previewDoc);
  h.vscode.window.visibleTextEditors.push(src, pre);
  // Waits until the preview shows the new render (`want` is in it).
  const edit = async (text, want) => {
    source.setText(text);
    await h.change(source);
    await until(() => previewDoc.getText().includes(want) && previewDoc.getText() === provider().provideTextDocumentContent(previewDoc.uri), `render showing ${want}`);
    await sleep(ECHO_MS);
  };
  const scroll = async (ed, line) => {
    ed.visibleRanges = [new h.vscode.Range(line, 0, line + 30, 0)];
    await h.scroll(ed, line);
  };
  const last = (ed) => ed.revealed[ed.revealed.length - 1];
  const previewLine = (text) => previewDoc.getText().split('\n').indexOf(text);

  await edit('{% for i in [1, 2] %}\ns{{ i }}:\n  test.nop\n{% endfor %}\nend:\n  test.nop\n', 'end:');
  // Formula -> preview: to the matching rendered line, at the top.
  await scroll(src, 4);
  assert.deepStrictEqual(last(pre), [previewLine('end:'), h.vscode.TextEditorRevealType.AtTop], 'formula scroll moves the preview');
  // The preview's echo of that doesn't scroll the formula back.
  await scroll(pre, previewLine('end:'));
  assert.deepStrictEqual(src.revealed, [], 'echo ignored');
  // Preview -> formula, once the echo window is over.
  await sleep(ECHO_MS);
  await scroll(pre, previewLine('s2:'));
  assert.deepStrictEqual(last(src), [1, h.vscode.TextEditorRevealType.AtTop], "preview scroll moves the formula to the loop line");

  // A re-render lines the preview up with the formula again.
  await sleep(ECHO_MS);
  src.visibleRanges = [new h.vscode.Range(5, 0, 35, 0)];
  const before = pre.revealed.length;
  await edit('{% for i in [1, 2, 3] %}\ns{{ i }}:\n  test.nop\n{% endfor %}\nend:\n  test.nop\n', 's3:');
  assert.ok(pre.revealed.length > before, 're-render re-syncs');
  assert.strictEqual(last(pre)[0], previewDoc.getText().split('\n').lastIndexOf('  test.nop'), "the formula's line 6, now further down the preview");

  // No map (marked render differs): proportional fallback still scrolls.
  await edit('{% macro m() %}\nq\n{% endmacro %}v: {{ m() | tojson }}\nw: 1\nx: 2\n', 'x: 2');
  const n = pre.revealed.length;
  await scroll(src, 4);
  assert.strictEqual(pre.revealed.length, n + 1, 'fallback scrolls too');

  // Unlocked: nothing follows; locked again: it does.
  await h.reg.commands['saltSyntax.preview.unlockScroll']();
  await sleep(ECHO_MS);
  await scroll(src, 0);
  assert.strictEqual(pre.revealed.length, n + 1, 'unlocked: preview stays put');
  await h.reg.commands['saltSyntax.preview.lockScroll']();
  await scroll(src, 0);
  assert.deepStrictEqual(last(pre)[0], 0, 'locked again: follows');
  console.log('ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
