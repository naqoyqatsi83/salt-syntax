// Which Salt release added a state function or argument (#79): from Salt's
// docs (versionadded), or the line's release history where the docs don't
// say. One that not every release of the line has gets a note in
// completion, hover, and a Hint on its use (saltSyntax.versionHints).
const assert = require('assert');
const { load, doc, Position } = require('./helpers/vscode');

(async () => {
  const h = await load();
  const H = h.vscode.DiagnosticSeverity.Hint;
  const hints = (text) => {
    const d = doc(text);
    h.open(d);
    return (h.reg.collections['salt-syntax-versions'].get(d.uri) || [])
      .map((x) => [x.range.start.line, text.split('\n')[x.range.start.line].slice(x.range.start.character, x.range.end.character), x.severity]);
  };
  const message = (text) => {
    const d = doc(text);
    h.open(d);
    return h.reg.collections['salt-syntax-versions'].get(d.uri)[0].message;
  };
  const hover = h.reg.hover.find((x) => x.sel.language === 'sls').provider;
  const at = (text) => {
    const lines = text.split('\n');
    const line = lines.findIndex((l) => l.includes('|'));
    const col = lines[line].indexOf('|');
    lines[line] = lines[line].replace('|', '');
    const r = hover.provideHover(doc(lines.join('\n')), new Position(line, col));
    return r && r.contents.value;
  };
  const args = h.provider('completion', (c) => c.triggers.includes('-'));
  const argItem = (text, label) => {
    const lines = text.split('\n');
    return args.provideCompletionItems(doc(text), new Position(lines.length - 1, lines[lines.length - 1].length)).find((i) => i.label === label);
  };
  const fns = h.provider('completion', (c) => c.triggers.length === 1 && c.triggers[0] === '.');
  const fnItem = (mod, fn) => fns.provideCompletionItems(doc(`id:\n  ${mod}.`), new Position(1, mod.length + 3)).find((i) => i.label === fn);
  const use = (fn, arg) => `x:\n  ${fn}:\n    - name: /etc/x\n    - ${arg}: v\n`;
  const setVersion = async (v) => {
    h.config['saltSyntax.saltVersion'] = v;
    await h.fireConfig('saltSyntax.saltVersion');
  };

  // --- 3006 ---------------------------------------------------------------
  await setVersion('3006');
  // file.append's encoding: new in 3006.28 (the docs say so). No **kwargs:
  // older 3006 releases fail the state.
  assert.deepStrictEqual(hints(use('file.append', 'encoding')), [[3, 'encoding', H]]);
  assert.match(message(use('file.append', 'encoding')), /^'encoding' is new in Salt 3006\.28: older 3006 releases fail this state \("'encoding' is an invalid keyword argument for 'file\.append'"\)/);
  // Not marked: what every 3006 release has, whatever its docs version.
  assert.deepStrictEqual(hints(use('file.append', 'ignore_whitespace')), [], 'added in 2015.8.4');
  assert.deepStrictEqual(hints(use('user.present', 'password_lock')), [], 'added in 3006.0 itself');
  assert.deepStrictEqual(hints(use('file.append', 'nosuch')), [], 'unknown arguments are the argument check\'s');
  // Where the docs don't say: the line's release history (user.present's
  // persist_home, 3006.17; chocolatey.installed's virus_check, 3006.22).
  assert.match(message(use('user.present', 'persist_home')), /^'persist_home' is new in Salt 3006\.17: older 3006 releases fail this state/);
  assert.match(message(use('chocolatey.installed', 'virus_check')), /^'virus_check' is new in Salt 3006\.22/);
  // cmd.run's password: a named parameter only since 3006.26, but the docs
  // date it 3000 -- it worked through **kwargs all along. Not marked.
  assert.deepStrictEqual(hints('x:\n  cmd.run:\n    - name: ls\n    - password: p\n'), []);
  // A function new in the line, in each form it's written.
  assert.deepStrictEqual(hints('x:\n  lgpo_reg.refresh_policy:\n    - name: x\n'), [[1, 'lgpo_reg.refresh_policy', H]]);
  assert.deepStrictEqual(hints('x: lgpo_reg.refresh_policy\n'), [[0, 'lgpo_reg.refresh_policy', H]]);
  assert.deepStrictEqual(hints('x:\n  lgpo_reg:\n    - refresh_policy\n'), [[2, 'refresh_policy', H]]);
  assert.match(message('x:\n  lgpo_reg.refresh_policy\n'), /^'lgpo_reg\.refresh_policy' is new in Salt 3006\.26: older 3006 releases don't have it/);
  // Salt's `mod:` + `- fn` form for an argument too.
  assert.deepStrictEqual(hints('x:\n  file:\n    - append\n    - encoding: utf-8\n'), [[3, 'encoding', H]]);

  // Completion: the release, dimmed next to the item, and the note.
  let item = argItem('x:\n  file.append:\n    - ', 'encoding');
  assert.strictEqual(item.detail, 'file.append · Salt 3006.28+');
  assert.match(item.documentation.value, /^⚠ 'encoding' is new in Salt 3006\.28/);
  item = argItem('x:\n  file.append:\n    - ', 'ignore_whitespace');
  assert.strictEqual(item.detail, 'file.append', 'nothing for an old one');
  assert.strictEqual(item.documentation, undefined);
  assert.strictEqual(fnItem('lgpo_reg', 'refresh_policy').detail, 'lgpo_reg.refresh_policy · Salt 3006.26+');
  assert.strictEqual(fnItem('file', 'append').detail, 'file.append');

  // Hover: the docs' version for any argument, the note for a recent one,
  // and the function's recent arguments.
  let text = at('x:\n  file.append:\n    - enc|oding: utf-8\n');
  assert.match(text, /parameter of \*\*file\.append\*\*, default `None` · Salt 3006 · added in 3006\.28 ·/);
  assert.match(text, /\n\n⚠ 'encoding' is new in Salt 3006\.28/);
  text = at('x:\n  file.append:\n    - ignore_w|hitespace: True\n');
  assert.match(text, /· added in 2015\.8\.4 ·/);
  assert.doesNotMatch(text, /⚠/);
  text = at('x:\n  file.app|end:\n');
  assert.match(text, /Not in every 3006 release: `encoding` \(3006\.28\), `encoding_errors` \(3006\.28\)\./);
  assert.match(at('x:\n  file.rep|lace:\n'), /^\*\*file\.replace\*\* · Salt 3006 · added in 0\.17\.0 ·/);
  assert.match(at('x:\n  lgpo_reg.refresh_po|licy:\n'), /\n\n⚠ 'lgpo_reg\.refresh_policy' is new in Salt 3006\.26/);

  // --- 3008 ---------------------------------------------------------------
  await setVersion('3008');
  // file.append has no encoding in 3008 at all.
  assert.deepStrictEqual(hints(use('file.append', 'encoding')), []);
  // A backport: file.replace's encoding is "3006.26" in the docs, but 3008
  // only got it in 3008.1.
  assert.match(message(use('file.replace', 'encoding')), /^'encoding' is new in Salt 3008\.1: older 3008 releases fail this state/);
  // 3007.0 and 3008.0 additions are in every 3008 release.
  assert.deepStrictEqual(hints('x:\n  file.managed:\n    - name: /x\n    - signature: s\n    - sig_backend: gpg\n'), []);
  assert.match(at('x:\n  file.managed:\n    - sig_b|ackend: gpg\n'), /· added in 3008\.0 ·/);
  assert.deepStrictEqual(hints('x:\n  dsc_resource.managed:\n    - name: x\n'), [[1, 'dsc_resource.managed', H]]);
  assert.strictEqual(fnItem('dsc_resource', 'managed').detail, 'dsc_resource.managed · Salt 3008.1+');

  // Off: no hints (completion and hover keep theirs).
  h.config['saltSyntax.versionHints'] = false;
  await h.fireConfig('saltSyntax.versionHints');
  assert.deepStrictEqual(hints(use('file.replace', 'encoding')), []);
  assert.strictEqual(argItem('x:\n  file.replace:\n    - ', 'encoding').detail, 'file.replace · Salt 3008.1+');
  console.log('ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
