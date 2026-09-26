// TextMate grammar regressions (#47): tokenized with VS Code's own engine,
// asserting the scopes each past grammar fix established.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadTokenizer, ROOT } = require('./helpers/tokenizer');

const has = (tok, scope) => tok.scopes.some((s) => s === scope || s.startsWith(`${scope}.`));
const tokenOf = (line, text) => {
  const t = line.find((x) => x.text === text || x.text.trim() === text);
  assert.ok(t, `token ${JSON.stringify(text)} in ${JSON.stringify(line.map((x) => x.text))}`);
  return t;
};

(async () => {
  const tok = await loadTokenizer();

  // Baseline: no invalid tokens anywhere in the example formula, and the Salt
  // Jinja grammar (which includes source.sls) tokenizes identically.
  const example = fs.readFileSync(path.join(ROOT, 'examples', 'uninstall_formula.sls'), 'utf8');
  const sls = tok(example);
  assert.deepStrictEqual(sls.flat().filter((t) => t.scopes.some((s) => s.includes('invalid'))), [], 'no invalid tokens');
  assert.deepStrictEqual(tok(example, 'source.salt-jinja'), sls, 'Salt Jinja grammar = sls grammar');

  // #28: a colon inside a Jinja tag doesn't make the line a YAML key.
  let [line] = tok("{% set state = {'all_ok': true} %}");
  assert.ok(line.every((t) => !has(t, 'entity.name.tag.sls')), '#28: no YAML key on a {% set %} with a dict');
  assert.ok(has(tokenOf(line, ':'), 'meta.scope.jinja.tag'), '#28: the colon stays inside the Jinja tag');
  [line] = tok("{{ salt['pillar.get']('app:port', 80) }}.state:");
  assert.ok(has(tokenOf(line, '.state'), 'entity.name.tag.sls'), '#28: key ends at the real colon, after the tag');

  // #34: a comment containing a colon stays a comment.
  [line] = tok('  # Detect something bla:');
  assert.ok(has(tokenOf(line, '# Detect something bla:'), 'comment.line.number-sign.sls'), '#34');

  // #33: a block scalar's content is text, not keys; keys resume after it.
  const block = tok('cmd:\n  cmd.run:\n    - name: |\n        echo "a: b"\n    - cwd: /tmp');
  assert.ok(block[3].every((t) => !has(t, 'entity.name.tag.sls')), '#33: no key inside the block scalar');
  assert.ok(has(block[3][0], 'string.unquoted.block.sls'), '#33: block content is a block string');
  assert.ok(has(tokenOf(block[4], 'cwd'), 'entity.name.tag.sls'), '#33: next argument is a key again');

  // #35: a plain top-level key's value is scoped.
  [line] = tok('plain_key: true');
  assert.ok(has(tokenOf(line, 'true'), 'constant.language.sls'), '#35');

  // Jinja-led state IDs are keys, with the Jinja highlighted inside them.
  [line] = tok('{{ sls }}.state_id:');
  assert.ok(has(tokenOf(line, 'sls'), 'entity.name.tag.sls') && has(tokenOf(line, 'sls'), 'variable.other.jinja'), 'Jinja-led key');
  // A toggled-off tag ({#% %#}) is a Jinja comment.
  [line] = tok('{#% if x %#}');
  assert.ok(line.every((t) => has(t, 'comment.block.jinja')), 'toggled-off tag is a comment');
  console.log('ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
