// The Jinja indentation check (#24) and its quick fixes.
const assert = require('assert');
const { load, doc } = require('./helpers/vscode');

(async () => {
  const h = await load();
  const warnings = (text) => {
    const d = doc(text);
    h.open(d);
    return { d, list: h.reg.collections['salt-syntax-jinja-indent'].get(d.uri) || [] };
  };
  const lines = (text) => warnings(text).list.map((x) => x.range.start.line + 1);
  const quickFixes = (d, list) => h.reg.codeActions.flatMap((c) => c.provider.provideCodeActions(d, null, { diagnostics: list }) || []);
  const fixAll = (text) => {
    const { d, list } = warnings(text);
    if (!list.length) return text;
    const all = quickFixes(d, list).find((a) => /all/i.test(a.title));
    const out = text.split('\n');
    for (const e of all.edit.edits) out[e.range.start.line] = e.text + out[e.range.start.line].slice(e.range.end.character);
    return out.join('\n');
  };

  const blk = `{{ sls }}.state_id:\n  file.managed:\n    - name: /path/to/file`;
  const good = `{% if condition %}\n  {% for item in items %}\n    {% if condition %}\n${blk}\n    {% else %}\n${blk}\n    {% endif %}\n  {% endfor %}\n${blk}\n{% else %}\n${blk}\n{% endif %}`;
  const bad = good.replace('    {% if condition %}', '{% if condition %}').replace('    {% else %}', '{% else %}').replace('    {% endif %}', '{% endif %}');
  assert.deepStrictEqual(lines(good), [], 'correct example: no warnings');
  assert.deepStrictEqual(lines(bad), [3, 7, 11], 'inner if/else/endif flagged');
  assert.match(warnings(bad).list[0].message, /expected 4 spaces \(inside \{% for %\} on line 2\), found 0/);
  assert.strictEqual(fixAll(bad), good, 'fix-all restores the correct version');

  assert.deepStrictEqual(lines(`{% if a %}\n{% set x = 1 %}\n  {% include 'y.sls' %}\n  {% else %}\n{% endif %}`), [2, 4], 'set/include inside, top-level else');
  assert.deepStrictEqual(lines(`f:\n  file.managed:\n    - contents: |\n        {% for u in us %}\n          {% if u %}\n        a\n          {% endif %}\n        {% endfor %}`), [], 'Jinja in a YAML block scalar nests from where it starts');
  assert.deepStrictEqual(lines(`{% for x in y %}\n  - name: {% if x %}a{% else %}b{% endif %}\n{#% if nope %#}\n  {% raw %}\n{% if literal %}\n  {% endraw %}\n{% endfor %}`), [], 'mid-line, commented-out and raw tags not checked');
  assert.match(warnings(`{% if a %}\n\t\t{% set x = 1 %}\n{% endif %}`).list[0].message, /tab indentation/);
  assert.deepStrictEqual(lines(`{% for x\n   in y %}\n{% set z = x %}\n{% endfor %}`), [3], 'multi-line tag');

  const { d } = warnings(bad);
  h.vscode.workspace.textDocuments.push(d);
  h.config['saltSyntax.jinjaIndentCheck'] = false;
  await h.fireConfig('saltSyntax.jinjaIndentCheck');
  assert.strictEqual(h.reg.collections['salt-syntax-jinja-indent'].get(d.uri), undefined, 'setting off clears');
  h.config['saltSyntax.jinjaIndentCheck'] = true;
  await h.fireConfig('saltSyntax.jinjaIndentCheck');
  assert.strictEqual(h.reg.collections['salt-syntax-jinja-indent'].get(d.uri).length, 3, 'setting on restores');
  console.log('ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
