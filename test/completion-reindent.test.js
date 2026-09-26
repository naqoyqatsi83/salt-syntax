// Jinja completions re-indent their line to the nesting depth (#24).
const assert = require('assert');
const { load, doc, Position } = require('./helpers/vscode');

(async () => {
  const h = await load();
  const jinja = h.provider('completion', (c) => c.triggers.includes('|'));
  const complete = (text, line) => {
    const col = text.split('\n')[line].length;
    const items = jinja.provideCompletionItems(doc(text), new Position(line, col)) || [];
    const out = {};
    for (const it of items) {
      const e = it.additionalTextEdits && it.additionalTextEdits[0];
      out[it.label] = e ? `${e.range.start.line}:${e.range.start.character}-${e.range.end.character} -> ${e.newText.length}sp` : null;
    }
    return out;
  };
  const blk = `{{ sls }}.state_id:\n  file.managed:\n    - name: /path/to/file`;
  const pre = `{% if condition %}\n  {% for item in items %}\n    {% if condition %}\n`;
  const post = `\n${blk}\n    {% else %}\n${blk}\n    {% endif %}\n  {% endfor %}\n{% endif %}`;
  let r = complete(`${pre}  set${post}`, 3);
  assert.strictEqual(r['set (inline)'], '3:0-2 -> 6sp', 'bare set inside the inner if');
  assert.strictEqual(r['set … endset'], '3:0-2 -> 6sp');
  r = complete(`${pre}{% e${post}`, 3);
  assert.strictEqual(r.else, '3:0-0 -> 4sp', 'else level with its if');
  assert.strictEqual(r.endif, '3:0-0 -> 4sp');
  assert.strictEqual(r.endfor, '3:0-0 -> 2sp', 'endfor level with the for');
  assert.strictEqual(r.set, '3:0-0 -> 6sp');
  assert.strictEqual(complete(`${pre}      set${post}`, 3)['set (inline)'], null, 'already right');
  assert.strictEqual(complete('a: 1\n  set', 1)['set (inline)'], null, 'top level left alone');
  assert.strictEqual(complete(`${pre}    - name: {% se${post}`, 3).set, null, 'mid-line left alone');
  assert.strictEqual(complete('{% if a %}\n\t\tset\n{% endif %}', 1)['set (inline)'], '1:0-2 -> 2sp', 'tabs replaced');
  console.log('ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
