// Matching Jinja block highlight (#20).
const assert = require('assert');
const { load, doc } = require('./helpers/vscode');

(async () => {
  const h = await load();
  const provider = h.provider('highlight');
  // The text of every highlight for the cursor placed on `needle` (nth occurrence).
  const hl = (text, needle, nth = 0) => {
    let idx = -1;
    for (let i = 0; i <= nth; i++) idx = text.indexOf(needle, idx + 1);
    assert.ok(idx >= 0, `needle ${needle}`);
    const d = doc(text);
    return provider.provideDocumentHighlights(d, d.positionAt(idx + 1)).map((x) => text.slice(d.offsetAt(x.range.start), d.offsetAt(x.range.end)));
  };
  const src = `{% if a %}
{% for x in xs %}
  {%- if x %}
  - {{ x }}
  {%- elif y -%}
  {% else %}
  {%- endif %}
{% else %}
  none
{% endfor %}
{% elif b %}
{% set v = 1 %}
{% set blk %}text{% endset %}
{#% if commented %#}
{# {% if inComment %} #}
{% raw %}{% if literal %}{% endraw %}
# {% if yamlCommented %}
# {% endif %}
{% else %}
{% endif %}
pkg: {{ sls }}.pkg_absent
other: pkg
pkg_absent: pkg-x`;
  const outer = ['{% if a %}', '{% elif b %}', '{% else %}', '{% endif %}'];
  assert.deepStrictEqual(hl(src, '{% if a'), outer);
  assert.deepStrictEqual(hl(src, '{% endif %}', 1), outer, 'outer endif');
  const forBlock = ['{% for x in xs %}', '{% else %}', '{% endfor %}'];
  assert.deepStrictEqual(hl(src, '{% for'), forBlock);
  assert.deepStrictEqual(hl(src, '{% else %}', 1), forBlock, "for's own else");
  const inner = ['{%- if x %}', '{%- elif y -%}', '{% else %}', '{%- endif %}'];
  assert.deepStrictEqual(hl(src, '{%- elif'), inner);
  assert.deepStrictEqual(hl(src, '{% else %}', 0), inner, "inner if's else");
  assert.deepStrictEqual(hl(src, '{% set blk'), ['{% set blk %}', '{% endset %}']);
  assert.deepStrictEqual(hl(src, '{% raw'), ['{% raw %}', '{% endraw %}']);
  assert.deepStrictEqual(hl(src, '{% if yamlCommented'), ['{% if yamlCommented %}', '{% endif %}']);
  assert.deepStrictEqual(hl(src, 'set v'), ['set', 'set'], 'inline set: word fallback, not endset');
  for (const n of ['if commented', 'if inComment', 'if literal']) {
    const r = hl(src, n);
    assert.ok(r.length > 0 && r.every((x) => x === 'if'), `${n} -> ${JSON.stringify(r)}`);
  }
  assert.deepStrictEqual(hl(src, 'pkg:'), ['pkg', 'pkg', 'pkg'], 'word fallback follows wordPattern');
  assert.deepStrictEqual(hl(`{% for x\n   in xs %}\n{% endfor %}\n{% if z %}`, 'endfor'), ['{% for x\n   in xs %}', '{% endfor %}'], 'multi-line tag');
  assert.deepStrictEqual(hl(`{% if z %}\nfoo`, '{% if'), ['{% if z %}'], 'unclosed block');
  const d = doc('a:\n\n');
  assert.deepStrictEqual(provider.provideDocumentHighlights(d, d.positionAt(3)), []);
  console.log('ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
