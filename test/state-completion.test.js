// State completion (#54): `module.` -> its functions, the full state block
// (inserted through saltstack-sls.insertStateBlock), the (full) variant,
// required arguments, nesting under an existing ID, and the requisite keys.
const assert = require('assert');
const { load, doc, Position } = require('./helpers/vscode');

(async () => {
  const h = await load();
  const state = h.provider('completion', (c) => c.triggers.length === 1 && c.triggers[0] === '.');
  const requisite = h.provider('completion', (c) => c.triggers.length === 1 && c.triggers[0] === '-');
  const end = (text) => {
    const lines = text.split('\n');
    return new Position(lines.length - 1, lines[lines.length - 1].length);
  };
  const complete = (text) => state.provideCompletionItems(doc(text), end(text));
  const item = (text, label) => (complete(text) || []).find((i) => i.label === label);
  // Runs a top-level item's command the way VS Code would: deletes what was
  // typed, inserts the snippet. Returns [[from, to] deleted, snippet, column].
  const insert = async (text, it) => {
    const done = {};
    h.vscode.window.activeTextEditor = {
      document: doc(text),
      selection: { active: end(text) },
      edit: async (f) => f({ delete: (r) => (done.deleted = [r.start.character, r.end.character]) }),
      insertSnippet: async (s, at) => Object.assign(done, { snippet: s.value, column: at.character })
    };
    await h.reg.commands[it.command.command](...it.command.arguments);
    return [done.deleted, done.snippet, done.column];
  };
  const argLines = (snippet) => snippet.split('\n').filter((l) => /^\s*- /.test(l));

  // Column 0: each function twice -- basic and (full) -- sorted together.
  const managed = item('file.', 'managed');
  const managedFull = item('file.', 'managed (full)');
  assert.ok(managed && managedFull, 'basic and full offered');
  assert.deepStrictEqual([managed.filterText, managedFull.filterText], ['managed', 'managed'], 'both match what was typed');
  assert.ok(managed.sortText < managedFull.sortText, 'basic right above full');
  assert.deepStrictEqual(managed.command.arguments, ['file', 'managed', 'basic', false]);
  assert.match(managed.documentation.value, /\{\{ sls \}\}\.<state_id>:\n {2}file\.managed:\n {4}- name: \/path\/to\/file\n/, 'documentation previews the block');

  // The full block: the state ID, the curated arguments, all as tab stops.
  assert.deepStrictEqual(await insert('file.', managed), [
    [0, 5],
    "{{ sls }}.${1:state_id}:\n  file.managed:\n    - name: ${2:/path/to/file}\n    - source: ${3:salt://path/to/source}\n    - user: ${4:root}\n    - group: ${5:root}\n    - mode: ${6:'0644'}$0",
    0
  ], 'file.managed block');

  // (full): every parameter of the real signature, with its real default.
  const full = (await insert('file.', managedFull))[1];
  assert.strictEqual(argLines(full).length, 49, 'file.managed accepts 49 arguments beyond name (3008.2)');
  assert.match(full, /- keep_source: \$\{\d+:True\}/);

  // Basic always includes what Salt requires, curated entry or not.
  assert.match((await insert('acl.', item('acl.', 'absent')))[1], /- name: \$\{2:name\}\n {4}- acl_type: \$\{3:acl_type\}\$0$/, 'acl.absent: required acl_type merged in');
  // No (full) where there's nothing beyond name -- but archive.extracted has plenty.
  assert.ok(item('alias.', 'absent') && !item('alias.', 'absent (full)'), 'no redundant full');
  assert.ok(item('archive.', 'extracted (full)'), 'archive.extracted has a full variant');

  // test.*: bare in basic, `name` shown in full.
  assert.strictEqual((await insert('test.', item('test.', 'nop')))[1], '{{ sls }}.${1:state_id}:\n  test.nop\n$0');
  assert.match((await insert('test.', item('test.', 'nop (full)')))[1], /test\.nop:\n {4}- name: \$\{2:name\}/);

  // Under an existing state ID: just the function stub, no command.
  const stub = item('my_state:\n  file.', 'managed');
  assert.strictEqual(stub.command, undefined);
  assert.strictEqual(stub.insertText.value, "managed:\n  - name: ${1:/path/to/file}\n  - source: ${2:salt://path/to/source}\n  - user: ${3:root}\n  - group: ${4:root}\n  - mode: ${5:'0644'}$0");
  assert.strictEqual(item('my_state:\n  test.', 'nop').insertText.value, 'nop\n$0');

  // Indentation with no state ID above is accidental: full block, reset to column 0.
  const stray = item('# a comment\n  file.', 'managed');
  assert.deepStrictEqual(stray.command.arguments, ['file', 'managed', 'basic', true]);
  const [deleted, , column] = await insert('# a comment\n  file.', stray);
  assert.deepStrictEqual([deleted, column], [[0, 7], 0], 'stray indentation deleted');
  h.config['saltSyntax.smartTopLevelDetection'] = false;
  assert.strictEqual(item('# a comment\n  file.', 'managed').command, undefined, 'smartTopLevelDetection off: indentation means nested');
  delete h.config['saltSyntax.smartTopLevelDetection'];

  // prependSlsToStateId off: a bare state ID.
  h.config['saltSyntax.prependSlsToStateId'] = false;
  assert.match((await insert('file.', item('file.', 'managed')))[1], /^\$\{1:state_id\}:\n/);
  assert.match(item('file.', 'managed').documentation.value, /\n<state_id>:\n/);
  delete h.config['saltSyntax.prependSlsToStateId'];

  // Module names on a function line (2-6 spaces), not at column 0; unknown modules get nothing.
  const mods = complete('my_state:\n  fi') || [];
  const file = mods.find((i) => i.label === 'file');
  assert.ok(file, 'module names offered');
  assert.deepStrictEqual(file.commitCharacters, ['.']);
  assert.strictEqual(complete('fi'), undefined, 'not at column 0');
  assert.strictEqual(complete('nosuch.'), undefined, 'unknown module');

  // Requisite and common argument keys after "- ".
  const keys = requisite.provideCompletionItems(doc('    - '), new Position(0, 6)) || [];
  for (const k of ['require', 'watch', 'onchanges', 'onlyif', 'unless', 'name', 'names']) {
    assert.ok(keys.some((i) => i.label === k), `requisite key ${k}`);
  }
  assert.strictEqual(keys.find((i) => i.label === 'require').insertText.value, 'require: ${0}');
  assert.strictEqual(requisite.provideCompletionItems(doc('    - name: x'), new Position(0, 13)), undefined, 'not after a value');
  // Right after the dash (#57): the space a list item needs is inserted too.
  const noSpace = requisite.provideCompletionItems(doc('    -'), new Position(0, 5)) || [];
  assert.strictEqual(noSpace.find((i) => i.label === 'require').insertText.value, ' require: ${0}', "'-' then pick: '- require: '");
  const typed = requisite.provideCompletionItems(doc('    -re'), new Position(0, 7)) || [];
  assert.strictEqual(typed.find((i) => i.label === 'require').insertText.value, ' require: ${0}', "'-re' then pick: '- require: '");
  console.log('ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
