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
    const fixes = quickFixes(d, list);
    const all = fixes.find((a) => /all/i.test(a.title)) || fixes[0]; // one issue: no fix-all
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

  // #52: {# #} comment lines follow the nesting too (commented-out tags don't).
  assert.deepStrictEqual(lines(`{% for x in y %}\n{# about x #}\n  {# fine #}\n{% endfor %}`), [2], 'comment line checked');

  // #52: the inside style -- tags at column 0, the keyword two columns right
  // of the enclosing tag's, with or without the dash.
  const style = (check, write = 'outside') => {
    h.config['saltSyntax.jinjaIndentCheckStyle'] = check;
    h.config['saltSyntax.jinjaIndentStyle'] = write;
  };
  const tofs = [
    '{%- macro files_switch(source_files) %}',
    '{%-   for p in paths %}',
    '{#-     a comment #}',
    '{%-     if p %}',
    '{%        set x = 1 %}',
    '{%-     endif %}',
    '{{ p }}',
    '{%-   endfor %}',
    '{%- endmacro %}'
  ].join('\n');
  const tofsOutside = [
    '{%- macro files_switch(source_files) %}',
    '  {%- for p in paths %}',
    '    {#- a comment #}',
    '    {%- if p %}',
    '      {% set x = 1 %}',
    '    {%- endif %}',
    '{{ p }}',
    '  {%- endfor %}',
    '{%- endmacro %}'
  ].join('\n');
  const goodInside = `{% if condition %}\n{%   for item in items %}\n{%     if condition %}\n${blk}\n{%     else %}\n${blk}\n{%     endif %}\n{%   endfor %}\n${blk}\n{% else %}\n${blk}\n{% endif %}`;
  style('inside');
  assert.deepStrictEqual(lines(tofs), [], 'inside: the TOFS macro is right');
  assert.deepStrictEqual(lines(goodInside), [], 'inside: plain {% aligned like {%-');
  assert.deepStrictEqual(lines(good), [2, 3, 7, 11, 12], 'inside: outside-style nesting flagged');
  assert.match(warnings(tofsOutside).list[0].message,
    /expected the tag at the start of the line with 3 spaces after "\{%-" \(inside \{% macro %\} on line 1\), found 2 spaces before it and 1 after/);
  assert.strictEqual(fixAll(tofsOutside), tofs, 'inside: fix-all converts to the inside style');
  assert.strictEqual(fixAll(good), goodInside);
  style('outside');
  assert.deepStrictEqual(lines(tofs), [2, 3, 4, 5, 6, 8], 'outside: inside-style nesting flagged');
  assert.strictEqual(fixAll(tofs), tofsOutside, 'outside: fix-all converts to the outside style');
  assert.strictEqual(fixAll(goodInside), good);

  // Either style, one per file: the first tag that fits only one style decides.
  const insideFirst = '{%- for p in ps %}\n{%-   if p %}\n    {%- set x = 1 %}\n{%-   endif %}\n{%- endfor %}';
  const outsideFirst = '{%- for p in ps %}\n  {%- if p %}\n{%-     set x = 1 %}\n  {%- endif %}\n{%- endfor %}';
  style('either');
  assert.deepStrictEqual(lines(insideFirst), [3], 'either: an inside file, one outside tag flagged');
  assert.deepStrictEqual(lines(outsideFirst), [3], 'either: an outside file, one inside tag flagged');
  assert.strictEqual(fixAll(insideFirst), '{%- for p in ps %}\n{%-   if p %}\n{%-     set x = 1 %}\n{%-   endif %}\n{%- endfor %}', 'fixed to the file\'s style');
  // Nothing decides (every nested tag wrong in both): jinjaIndentStyle does.
  const flat = '{% for x in y %}\n{% set z = x %}\n{% endfor %}';
  assert.deepStrictEqual(lines(flat), [2]);
  assert.strictEqual(fixAll(flat.replace('{% set', '{% if a %}\n{% set').replace('{% endfor', '{% endif %}\n{% endfor')), '{% for x in y %}\n  {% if a %}\n    {% set z = x %}\n  {% endif %}\n{% endfor %}');
  style('either', 'inside');
  assert.strictEqual(fixAll(flat.replace('{% set', '{% if a %}\n{% set').replace('{% endfor', '{% endif %}\n{% endfor')), '{% for x in y %}\n{%   if a %}\n{%     set z = x %}\n{%   endif %}\n{% endfor %}');
  // Mixing allowed: each tag passes in either style; fixes follow jinjaIndentStyle.
  style('mixed', 'inside');
  assert.deepStrictEqual(lines(insideFirst), [], 'mixed: both files pass');
  assert.deepStrictEqual(lines(outsideFirst), []);
  assert.deepStrictEqual(lines(flat), [2]);
  assert.strictEqual(fixAll(flat), '{% for x in y %}\n{%   set z = x %}\n{% endfor %}');
  delete h.config['saltSyntax.jinjaIndentCheckStyle'];
  delete h.config['saltSyntax.jinjaIndentStyle'];
  // The default is 'either': a vendored inside-style macro passes as is,
  // and outside-style mistakes are still caught.
  assert.deepStrictEqual(lines(tofs), [], 'default: the TOFS macro passes');
  assert.deepStrictEqual(lines(bad), [3, 7, 11], 'default: outside-style nesting still checked');

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
