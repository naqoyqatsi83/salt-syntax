// Enter handling (#25, #36): the on-type formatter re-indents after Enter.
const assert = require('assert');
const { load, doc, Position } = require('./helpers/vscode');

(async () => {
  const h = await load();
  const onType = h.provider('onType');
  assert.deepStrictEqual(h.reg.onType[0].triggers, ['\n']);

  // Split `line` (0-based) at column `col`; VS Code's generic auto-indent put
  // `auto` in front of the moved text. Returns the new line's final indentation.
  const enterAt = (src, line, col, auto) => {
    const d = doc(src);
    h.change(d); // the text before Enter, as the extension last saw it
    const lines = src.split('\n');
    const before = lines[line].slice(0, col);
    const after = lines[line].slice(col);
    lines.splice(line, 1, before, auto + after.trimStart());
    d.setText(lines.join('\n'));
    h.change(d);
    const edits = onType.provideOnTypeFormattingEdits(d, new Position(line + 1, auto.length), '\n');
    const moved = auto + after.trimStart();
    const text = edits.length ? edits[0].newText + moved.slice(edits[0].range.end.character) : moved;
    return text.match(/^ */)[0].length;
  };

  const src = `{% set items = ['a','b','c'] %}
{% for item in items %}
{{ sls }}.___{{ item }}:
  test.succeed_with_changes

{{ sls }}.___{{ loop.index }}:
  test.fail_with_changes
{% endfor %}
{% if x %}
  {% for y in ys %}
a: 1
    {% if z %}
b: 2
    {% else %}
c: 3
    {% endif %}
  {% endfor %}
{% endif %}`;

  // A pushed-down Jinja tag lands at its nesting depth (#36).
  assert.strictEqual(enterAt(src, 7, 0, '  '), 0, 'endfor after a state body -> level with its for');
  assert.strictEqual(enterAt(src, 13, 4, ''), 4, 'nested else -> level with its if');
  assert.strictEqual(enterAt(src, 15, 0, '    '), 4, 'nested endif');
  assert.strictEqual(enterAt(src, 16, 0, ''), 2, 'endfor inside an if');
  assert.strictEqual(enterAt(src, 8, 0, '  '), 0, 'top-level tag keeps its original indentation');

  // Any other pushed-down line keeps the indentation it had (#36).
  const yamlSrc = `{% for item in items %}\n{{ sls }}.___{{ item }}:\n  test.succeed_with_changes\n\n{{ sls }}.___{{ loop.index }}:\n  file.managed:\n    - name: /x\n{% endfor %}`;
  assert.strictEqual(enterAt(yamlSrc, 4, 0, '  '), 0, 'state ID after a state body');
  assert.strictEqual(enterAt(yamlSrc, 6, 0, '  '), 4, 'indented - name: from column 0');
  assert.strictEqual(enterAt(yamlSrc, 6, 2, ''), 4, 'from inside its indentation');
  assert.strictEqual(enterAt(yamlSrc, 6, 8, '      '), 6, 'a mid-line split is left to VS Code');

  // A blank line after a tag line follows nesting (#25).
  const lines = src.split('\n');
  lines.splice(2, 0, '');
  const d = doc(lines.join('\n'));
  h.change(d);
  assert.strictEqual(onType.provideOnTypeFormattingEdits(d, new Position(2, 0), '\n')[0].newText, '  ', 'blank line after {% for %}');

  // saltSyntax.jinjaEnterIndent = column0
  h.config['saltSyntax.jinjaEnterIndent'] = 'column0';
  assert.strictEqual(enterAt(src, 13, 4, ''), 0, 'column0 mode');
  console.log('ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
