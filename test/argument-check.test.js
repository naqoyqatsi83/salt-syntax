// The state-argument check (#62): an argument the enclosing function doesn't
// take. Salt fails such a state ("'x' is an invalid keyword argument for
// 'mod.fn'", salt.utils.args.format_call) unless the function takes
// **kwargs -- then only a near-miss of a real parameter gets a hint.
const assert = require('assert');
const { load, doc } = require('./helpers/vscode');

(async () => {
  const h = await load();
  const check = (text) => {
    const d = doc(text);
    h.open(d);
    return { d, list: h.reg.collections['salt-syntax-arguments'].get(d.uri) || [] };
  };
  const found = (text) => check(text).list.map((x) => [x.range.start.line, text.split('\n')[x.range.start.line].slice(x.range.start.character, x.range.end.character), x.severity]);
  const W = h.vscode.DiagnosticSeverity.Warning;
  const I = h.vscode.DiagnosticSeverity.Information;
  const fixes = (text) => {
    const { d, list } = check(text);
    return h.reg.codeActions.flatMap((c) => c.provider.provideCodeActions(d, null, { diagnostics: list }) || [])
      .filter((a) => a.diagnostics && a.diagnostics[0].code === 'argument')
      .map((a) => [a.title, a.edit.edits.map((e) => [e.range.start.line, e.range.start.character, e.range.end.character, e.text])]);
  };
  const user = (arg) => `bob:\n  user.present:\n    - name: bob\n    - ${arg}: x\n`;

  // A function without **kwargs: Salt fails the state -- a warning on the key.
  assert.deepStrictEqual(found(user('shel')), [[3, 'shel', W]]);
  assert.match(check(user('shel')).list[0].message, /^'shel' is an invalid keyword argument for 'user\.present' -- Salt fails this state/);
  assert.deepStrictEqual(fixes(user('shel')), [["Change to 'shell'", [[3, 6, 10, 'shell']]]], 'quick fix: the closest real one');
  assert.deepStrictEqual(fixes(user('zzzzzzzz')), [], 'nothing close: no guess');
  // Its real parameters, and what every state accepts, are fine.
  for (const ok of ['shell', 'uid', 'require', 'watch_in', 'onchanges_any', 'onlyif', 'unless', 'order', 'names', 'failhard', 'reload_modules', 'fire_event']) {
    assert.deepStrictEqual(found(user(ok)), [], `valid: ${ok}`);
  }

  // A function with **kwargs takes any extra option: only a near-miss of a
  // real parameter gets a hint (not a warning), a real extra option nothing.
  const pkg = (arg) => `nginx:\n  pkg.installed:\n    - ${arg}: [a]\n`;
  assert.deepStrictEqual(found(pkg('pakgs')), [[2, 'pakgs', I]]);
  assert.match(check(pkg('pakgs')).list[0].message, /^'pakgs' isn't a parameter of 'pkg\.installed' -- did you mean 'pkgs'\?/);
  assert.deepStrictEqual(fixes(pkg('pakgs')), [["Change to 'pkgs'", [[2, 6, 11, 'pkgs']]]]);
  assert.deepStrictEqual(found(pkg('hold')), [], 'a real extra option (hold)');

  // Not checked: keys built by Jinja, nested values (a requisite's list),
  // unknown functions. Jinja/comment lines in between don't matter, and
  // Salt's `mod:` + `- fn` form works too.
  assert.deepStrictEqual(found('x:\n  user.present:\n    - {{ key }}: v\n    - require:\n      - pkg: other\n'), []);
  assert.deepStrictEqual(found('x:\n  nosuch.fn:\n    - shel: x\n'), [], 'unknown function');
  assert.deepStrictEqual(found('x:\n  user.present:\n    {% if a %}\n    # c\n    - shel: x\n    {% endif %}\n').map((f) => f[1]), ['shel']);
  assert.deepStrictEqual(found('x:\n  user:\n    - present\n    - shel: x\n').map((f) => f[1]), ['shel'], 'mod: / - fn form');

  // Per Salt version: user.present's `local` is 3008-only.
  assert.deepStrictEqual(found(user('local')), [], '3008: local is valid');
  h.config['saltSyntax.saltVersion'] = '3006';
  assert.deepStrictEqual(found(user('local')).map((f) => f[1]), ['local'], '3006: local is not');
  delete h.config['saltSyntax.saltVersion'];

  // saltSyntax.argumentCheck off clears it; on restores it.
  const { d } = check(user('shel'));
  h.vscode.workspace.textDocuments.push(d);
  h.config['saltSyntax.argumentCheck'] = false;
  await h.fireConfig('saltSyntax.argumentCheck');
  assert.strictEqual(h.reg.collections['salt-syntax-arguments'].get(d.uri), undefined, 'setting off');
  h.config['saltSyntax.argumentCheck'] = true;
  await h.fireConfig('saltSyntax.argumentCheck');
  assert.strictEqual(h.reg.collections['salt-syntax-arguments'].get(d.uri).length, 1, 'setting on');
  // ... and follows saltSyntax.saltVersion as it changes.
  const local = doc(user('local'));
  h.vscode.workspace.textDocuments.push(local);
  h.open(local);
  h.config['saltSyntax.saltVersion'] = '3006';
  await h.fireConfig('saltSyntax.saltVersion');
  assert.strictEqual((h.reg.collections['salt-syntax-arguments'].get(local.uri) || []).length, 1, 're-checked on a version switch');
  console.log('ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
