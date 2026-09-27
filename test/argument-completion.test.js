// Argument completion after `-` (#58): the enclosing state function's real
// arguments (required first, defaults quoted as in #55), then the arguments
// every state accepts (Salt's own requisite/runtime keywords), minus the
// ones the block already has.
const assert = require('assert');
const { load, doc, Position } = require('./helpers/vscode');

(async () => {
  const h = await load();
  const args = h.provider('completion', (c) => c.triggers.includes('-'));
  // Completion at the `-` line marked with `|` (the rest of the text stays).
  const at = (text) => {
    const lines = text.split('\n');
    const line = lines.findIndex((l) => l.includes('|'));
    const col = lines[line].indexOf('|');
    lines[line] = lines[line].replace('|', '');
    const items = args.provideCompletionItems(doc(lines.join('\n')), new Position(line, col)) || [];
    items.sort((a, b) => (a.sortText || a.label).localeCompare(b.sortText || b.label));
    return { labels: items.map((i) => i.label), get: (l) => items.find((i) => i.label === l) };
  };
  const pkg = '{{ sls }}.state_id:\n  pkg.installed:\n    - name: package_name\n    - |';

  // pkg.installed: its own arguments, not file's; `name` is already there.
  let r = at(pkg);
  for (const a of ['version', 'refresh', 'pkgs', 'sources', 'reinstall']) assert.ok(r.labels.includes(a), `pkg.installed: ${a}`);
  for (const a of ['makedirs', 'mode', 'source']) assert.ok(!r.labels.includes(a), `pkg.installed: no ${a}`);
  assert.ok(!r.labels.includes('name'), 'already in the block');
  assert.match(r.get('refresh').detail, /pkg\.installed/);
  assert.strictEqual(r.get('refresh').insertText.value, 'refresh: ${1:None}', 'its default as a tab stop');
  // ... then what every state accepts, after the function's own.
  for (const a of ['require', 'watch', 'onchanges', 'onfail', 'prereq', 'use', 'listen', 'require_in', 'onlyif', 'unless', 'creates', 'order', 'names', 'retry', 'failhard', 'check_cmd', 'reload_modules', 'runas']) {
    assert.ok(r.labels.includes(a), `global: ${a}`);
  }
  assert.ok(r.labels.indexOf('version') < r.labels.indexOf('require'), "the function's own first");
  assert.strictEqual(r.get('require').insertText.value, 'require: ${0}');
  assert.ok(!r.labels.some((l) => l.startsWith('__') || l === 'fun' || l === 'state'), 'no internal keywords');

  // Typing the space after the dash closes VS Code's list; the space is a
  // trigger too, so `- ` opens it again -- and any other space gets nothing.
  assert.ok(h.reg.completion.find((c) => c.triggers.includes('-')).triggers.includes(' '), "' ' triggers");
  assert.ok(at(pkg).labels.length > 0, "'- ' offers");
  assert.deepStrictEqual(at('x:\n  pkg.installed:\n    - name: some |').labels, [], 'a space in a value: nothing');
  assert.deepStrictEqual(at('x:\n  pkg.installed: |').labels, [], 'a space after a key: nothing');

  // Right after the dash: the space is inserted too (#57).
  assert.strictEqual(at(pkg.replace('- |', '-|')).get('refresh').insertText.value, ' refresh: ${1:None}');

  // Required arguments first, marked.
  r = at('x:\n  acl.absent:\n    - |');
  assert.strictEqual(r.labels[0], 'acl_type', 'required first');
  assert.match(r.get('acl_type').detail, /required/);

  // Arguments already in the block -- above or below the cursor, not nested
  // values -- are left out; Jinja and comment lines are skipped.
  r = at('x:\n  pkg.installed:\n    - refresh: True\n    - require:\n      - pkg: other\n    {% if grains.os == "Debian" %}\n    # comment\n    - |\n    - version: 1.0\n    {% endif %}\ny:\n  pkg.installed:\n    - reinstall: True');
  for (const a of ['refresh', 'require', 'version']) assert.ok(!r.labels.includes(a), `already there: ${a}`);
  assert.ok(!r.labels.includes('pkg') && r.labels.includes('reinstall'), "nested values and the next state don't count");

  // Defaults YAML would misread are quoted (#55).
  assert.strictEqual(at('x:\n  cron.present:\n    - |').get('minute').insertText.value, "minute: ${1:'*'}");

  // A state function's own parameter that's also a global one: listed once, as the function's.
  r = at('x:\n  cmd.run:\n    - |');
  assert.strictEqual(r.labels.filter((l) => l === 'runas').length, 1);
  assert.match(r.get('runas').detail, /cmd\.run/);
  assert.ok(r.labels.includes('onlyif'), 'cmd.run: onlyif as a global');

  // Salt's other way to write it: `module:` with the function as a bare list item.
  assert.ok(at('x:\n  pkg:\n    - installed\n    - |').labels.includes('refresh'), 'pkg: / - installed');

  // No known function above: only what every state accepts.
  r = at('x:\n  nosuch.thing:\n    - |');
  assert.ok(r.labels.includes('require') && !r.labels.includes('refresh'), 'unknown function: globals only');
  assert.strictEqual(at('- |').labels.includes('require'), true, 'no state at all: globals');

  // Per Salt version: no_log only in 3008; 3006 has its own signatures.
  assert.ok(at(pkg).labels.includes('no_log'), '3008: no_log');
  h.config['saltSyntax.saltVersion'] = '3006';
  assert.ok(!at(pkg).labels.includes('no_log'), '3006: no no_log');
  assert.ok(at('x:\n  boto_ec2.instance_present:\n    - |').labels.includes('image_id'), '3006 dataset');
  delete h.config['saltSyntax.saltVersion'];

  // Not after a value.
  assert.deepStrictEqual(at('x:\n  pkg.installed:\n    - name: x|').labels, []);
  console.log('ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
