// Unknown state functions in the editor, with a dictionary (#64): Salt's
// own modules for the selected version, the workspace's _states/*.py, and
// saltSyntax.knownStateFunctions (user + workspace) are known; anything else
// is a warning, with "Change to" and spell-checker style "Add to
// dictionary" quick fixes.
const assert = require('assert');
const path = require('path');
const { load, doc, Position } = require('./helpers/vscode');

const STATES = path.join(__dirname, 'fixtures', 'custom', '_states');

(async () => {
  const h = await load();
  h.vscode.workspace.workspaceFolders = [{ uri: h.vscode.Uri.file(path.join(__dirname, 'fixtures', 'custom')) }];
  // A file appearing under _states/, as VS Code reports it: the watcher fires.
  const addStateFile = async (name) => {
    const u = h.vscode.Uri.file(path.join(STATES, name));
    h.reg.files.push(u);
    await Promise.all(h.reg.watchers.flatMap((w) => w.handlers.map((fn) => fn(u))));
    await new Promise((r) => setTimeout(r, 400)); // the rescan is debounced
  };
  const check = (x, text) => {
    const d = doc(text);
    x.open(d);
    return { d, list: x.reg.collections['salt-syntax-functions'].get(d.uri) || [] };
  };
  const found = (x, text) => check(x, text).list.map((d) => [d.range.start.line, text.split('\n')[d.range.start.line].slice(d.range.start.character, d.range.end.character)]);
  const fixes = (x, text) => {
    const { d, list } = check(x, text);
    return x.reg.codeActions.flatMap((c) => c.provider.provideCodeActions(d, null, { diagnostics: list }) || [])
      .filter((a) => a.diagnostics && a.diagnostics[0].code === 'function');
  };

  // Salt's own: a typo is a warning, "Change to" first and preferred, then
  // "Add to dictionary" -- workspace first, then user.
  assert.deepStrictEqual(found(h, 'x:\n  pkg.instaled:\n    - name: a\n'), [[1, 'pkg.instaled']]);
  assert.match(check(h, 'x:\n  pkg.instaled:\n').list[0].message, /^'pkg\.instaled' isn't a state function in Salt 3008 -- did you mean 'pkg\.installed'\?/);
  let f = fixes(h, 'x:\n  pkg.instaled:\n');
  assert.deepStrictEqual(f.map((a) => a.title), [
    "Change to 'pkg.installed'",
    "Add 'pkg.instaled' to the workspace dictionary",
    "Add 'pkg.instaled' to the user dictionary"
  ], 'order: the likely fix first; no whole-module entry for a core module');
  assert.strictEqual(f[0].isPreferred, true);
  assert.deepStrictEqual(f[0].edit.edits.map((e) => [e.range.start.line, e.range.start.character, e.range.end.character, e.text]), [[1, 2, 14, 'pkg.installed']]);
  assert.deepStrictEqual([f[1].command.command, ...f[1].command.arguments], ['saltSyntax.addKnownStateFunction', 'pkg.instaled', 'workspace']);

  // Real ones pass; so do all three ways to write a state.
  for (const ok of ['x:\n  pkg.installed:\n', 'x:\n  test.nop\n', 'x: test.nop\n', 'x:\n  pkg:\n    - installed\n']) {
    assert.deepStrictEqual(found(h, ok), [], JSON.stringify(ok));
  }
  assert.deepStrictEqual(found(h, 'x: test.nopp\n'), [[0, 'test.nopp']], 'short form on the ID line');
  assert.deepStrictEqual(found(h, 'x:\n  pkg:\n    - instaled\n    - name: a\n'), [[2, 'instaled']], 'mod: / - fn form');
  assert.deepStrictEqual(found(h, 'extend:\n  x:\n    file.managd:\n'), [[2, 'file.managd']], 'under extend:');
  // Never function names: argument values, include entries, Jinja-built names.
  for (const no of ['x:\n  file.managed:\n    - context:\n        some.key: 1\n', 'x:\n  file.managed:\n    - context:\n        some.key:\n          - a\n', 'include:\n  - a.b\n', 'x:\n  {{ m }}.installed:\n', 'x:\n  pkg.{{ fn }}:\n']) {
    assert.deepStrictEqual(found(h, no), [], JSON.stringify(no));
  }
  // `mod:` + `- fn`: only an item of that module's own list, not deeper.
  assert.deepStrictEqual(found(h, 'x:\n  tofs:\n    files:\n      sub:\n        - alt_file\n'), [], 'a deeper bare item is data');
  // Not state files: pillar data (a `pillar` folder) and top files.
  const inFile = (p, text) => {
    const d = doc(text, { path: p });
    h.open(d);
    return h.reg.collections['salt-syntax-functions'].get(d.uri) || [];
  };
  assert.deepStrictEqual(inFile('/srv/pillar/app.sls', 'app:\n  settings:\n    - thing\n  pkg.instaled:\n'), [], 'pillar');
  assert.deepStrictEqual(inFile('/srv/salt/top.sls', "base:\n  webserver:\n    - nginx\n"), [], 'top.sls');
  assert.strictEqual(inFile('/srv/salt/web/init.sls', 'x:\n  pkg.instaled:\n').length, 1, 'a state file elsewhere is checked');

  // A module core Salt doesn't have: the whole module can go in the dictionary too.
  assert.match(check(h, 'x:\n  nosuch.thing:\n').list[0].message, /^'nosuch' isn't a state module in Salt 3008, your formula's _states or your dictionary/);
  assert.deepStrictEqual(fixes(h, 'x:\n  nosuch.thing:\n').map((a) => a.title), [
    "Add 'nosuch.thing' to the workspace dictionary",
    "Add 'nosuch.thing' to the user dictionary",
    "Add module 'nosuch.*' to the workspace dictionary",
    "Add module 'nosuch.*' to the user dictionary"
  ]);

  // The workspace's _states/*.py: by file name and __virtualname__, its
  // public functions (__func_alias__ applied; _private and mod_* hooks not).
  assert.ok(h.reg.watchers.some((w) => w.glob === '**/_states/*.py'), 'watching _states/*.py');
  await addStateFile('mycompany_app.py');
  const c = h;
  assert.deepStrictEqual(found(c, 'x:\n  mycompany_app.deployed:\n  y:\n'), [], 'a _states function');
  assert.deepStrictEqual(found(c, 'x:\n  mycompany_app.list:\n'), [], '__func_alias__');
  assert.deepStrictEqual(found(c, 'x:\n  mycompany_app.mod_watch:\n').map((x) => x[1]), ['mycompany_app.mod_watch'], 'hooks are not state functions');
  assert.match(check(c, 'x:\n  mycompany_app.deplyoed:\n').list[0].message, /did you mean 'mycompany_app\.deployed'\?/, 'typos in your own modules too');
  // Another one: known once the watcher has fired.
  assert.deepStrictEqual(found(c, 'x:\n  vault_ext.secret_present:\n').map((x) => x[1]), ['vault_ext.secret_present'], 'not yet');
  await addStateFile('vault_things.py');
  assert.deepStrictEqual(found(c, 'x:\n  vault_ext.secret_present:\n'), [], '__virtualname__');
  // ... and completion offers them.
  const complete = c.provider('completion', (p) => p.triggers.length === 1 && p.triggers[0] === '.');
  assert.deepStrictEqual((complete.provideCompletionItems(doc('mycompany_app.'), new Position(0, 14)) || []).map((i) => i.label).sort(), ['deployed', 'list', 'removed']);

  // The dictionary: user and workspace entries, a whole module with `.*`.
  c.config['saltSyntax.knownStateFunctions'] = ['other_mod.*', 'thing.done'];
  c.reg.workspaceConfig['saltSyntax.knownStateFunctions'] = ['team.deployed'];
  await c.fireConfig('saltSyntax.knownStateFunctions');
  for (const ok of ['x:\n  other_mod.anything:\n', 'x:\n  thing.done:\n', 'x:\n  team.deployed:\n']) assert.deepStrictEqual(found(c, ok), [], ok);
  assert.match(check(c, 'x:\n  thing.dnoe:\n').list[0].message, /did you mean 'thing\.done'\?/, 'typos against the dictionary');

  // Adding: the quick fix's command writes the entry where it says.
  await c.reg.commands['saltSyntax.addKnownStateFunction']('new_mod.fn', 'workspace');
  assert.deepStrictEqual(c.reg.workspaceConfig['saltSyntax.knownStateFunctions'], ['team.deployed', 'new_mod.fn']);
  await c.reg.commands['saltSyntax.addKnownStateFunction']('pkg.instaled', 'user');
  assert.deepStrictEqual(c.config['saltSyntax.knownStateFunctions'], ['other_mod.*', 'thing.done', 'pkg.instaled']);
  await c.fireConfig('saltSyntax.knownStateFunctions');
  assert.deepStrictEqual(found(c, 'x:\n  new_mod.fn:\n'), [], 'added');

  // Removing: Manage lists every entry with its scope, all checked, the one
  // that looks like a typo of a real function marked; unchecked ones go.
  let offered;
  c.vscode.window.showQuickPick = async (items) => ((offered = items), items.filter((i) => i.label !== 'pkg.instaled' && i.label !== 'team.deployed'));
  await c.reg.commands['saltSyntax.manageKnownStateFunctions']();
  assert.deepStrictEqual(offered.map((i) => [i.label, i.description, i.picked]), [
    ['other_mod.*', 'user', true], ['thing.done', 'user', true], ['pkg.instaled', 'user', true],
    ['team.deployed', 'workspace', true], ['new_mod.fn', 'workspace', true]
  ]);
  assert.match(offered.find((i) => i.label === 'pkg.instaled').detail, /looks like 'pkg\.installed'/);
  assert.deepStrictEqual(c.config['saltSyntax.knownStateFunctions'], ['other_mod.*', 'thing.done']);
  assert.deepStrictEqual(c.reg.workspaceConfig['saltSyntax.knownStateFunctions'], ['new_mod.fn']);

  // Per Salt version; and saltSyntax.functionCheck off clears it.
  assert.deepStrictEqual(found(c, 'x:\n  boto_ec2.instance_present:\n').map((x) => x[1]), ['boto_ec2.instance_present'], '3008: no boto_ec2');
  c.config['saltSyntax.saltVersion'] = '3006';
  assert.deepStrictEqual(found(c, 'x:\n  boto_ec2.instance_present:\n'), [], '3006: boto_ec2');
  delete c.config['saltSyntax.saltVersion'];
  const { d } = check(c, 'x:\n  pkg.instaled:\n');
  c.vscode.workspace.textDocuments.push(d);
  c.config['saltSyntax.functionCheck'] = false;
  await c.fireConfig('saltSyntax.functionCheck');
  assert.strictEqual(c.reg.collections['salt-syntax-functions'].get(d.uri), undefined, 'setting off');
  console.log('ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
