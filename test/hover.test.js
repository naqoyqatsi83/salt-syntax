// Hover info (#61): on a state function -- its signature with defaults,
// required parameters, whether it takes other options (**kwargs), a link to
// its page in Salt's docs -- and on an argument key: that parameter, or a
// global one (requisites, onlyif, names, ...) with its docs section.
const assert = require('assert');
const { load, doc, Position } = require('./helpers/vscode');

(async () => {
  const h = await load();
  const hover = h.reg.hover[0].provider;
  // Hover at the `|` (removed from the text).
  const at = (text) => {
    const lines = text.split('\n');
    const line = lines.findIndex((l) => l.includes('|'));
    const col = lines[line].indexOf('|');
    lines[line] = lines[line].replace('|', '');
    const r = hover.provideHover(doc(lines.join('\n')), new Position(line, col));
    return r && { text: r.contents.value, range: [r.range.start.line, r.range.start.character, r.range.end.character] };
  };
  const docs = 'https://docs.saltproject.io/en/3008/ref/states';

  // A state function: signature (name first, then Salt's order, real
  // defaults), **kwargs, the docs link -- over the whole `mod.fn`.
  let r = at('nginx:\n  pkg.ins|talled:\n    - name: nginx\n');
  assert.deepStrictEqual(r.range, [1, 2, 15], 'the whole pkg.installed');
  assert.match(r.text, /^\*\*pkg\.installed\*\* · Salt 3008/);
  assert.match(r.text, /pkg\.installed\(name, version=None, refresh=None, .*update_holds=False, \*\*kwargs\)/s);
  assert.match(r.text, /also takes other options \(`\*\*kwargs`\)/);
  assert.ok(r.text.includes(`(${docs}/all/salt.states.pkg.html#salt.states.pkg.installed)`), 'docs link');
  // A function without **kwargs says Salt rejects anything else; required ones are marked.
  r = at('x:\n  acl.abs|ent:\n    - acl_type: user\n');
  assert.match(r.text, /acl\.absent\(name, acl_type, acl_name='', perms='', recurse=False\)/);
  assert.match(r.text, /Required: `name`, `acl_type`/);
  assert.match(r.text, /Takes no other arguments/);
  assert.ok(r.text.includes(`${docs}/all/salt.states.linux_acl.html#salt.states.linux_acl.absent`), 'module file differs from its name (linux_acl.py)');
  // Defaults quoted the way Python shows them.
  assert.match(at('x:\n  file.man|aged:\n').text, /sig_backend='gpg'/);
  // The short form, a function without arguments: no colon, on its own line
  // or on the ID's.
  r = at('x:\n  test.succeed_with_ch|anges\n');
  assert.deepStrictEqual(r.range, [1, 2, 27]);
  assert.match(r.text, /^\*\*test\.succeed_with_changes\*\*/);
  r = at('{{ sls }}.x: test.n|op\n');
  assert.deepStrictEqual(r.range, [0, 13, 21]);
  assert.match(r.text, /^\*\*test\.nop\*\*/);
  // At column 0 it's a state ID, whatever it looks like.
  assert.strictEqual(at('pkg.inst|alled:\n  test.nop\n'), undefined);
  // Salt's `mod:` + `- fn` form: hover the function item.
  assert.match(at('x:\n  pkg:\n    - inst|alled\n').text, /^\*\*pkg\.installed\*\*/);

  // An argument key: the function's parameter, with its default or "required".
  r = at('x:\n  pkg.installed:\n    - ref|resh: True\n');
  assert.deepStrictEqual(r.range, [2, 6, 13]);
  assert.match(r.text, /^`refresh` — parameter of \*\*pkg\.installed\*\*, default `None`/);
  assert.match(at('x:\n  acl.absent:\n    - acl_t|ype: user\n').text, /parameter of \*\*acl\.absent\*\*, required/);
  // ... or one every state accepts, linked to its section of Salt's docs.
  r = at('x:\n  pkg.installed:\n    - requ|ire:\n      - pkg: other\n');
  assert.match(r.text, /^`require` — Salt requisite, accepted by every state/);
  assert.ok(r.text.includes(`${docs}/requisites.html#require`));
  assert.ok(at('x:\n  pkg.installed:\n    - watch_|in:\n').text.includes(`${docs}/requisites.html#the-in-version-of-requisites`));
  assert.ok(at('x:\n  pkg.installed:\n    - onl|yif: true\n').text.includes(`${docs}/requisites.html#onlyif`));
  assert.ok(at('x:\n  pkg.installed:\n    - na|mes:\n').text.includes(`${docs}/highstate.html#names-declaration`));
  assert.ok(at('x:\n  pkg.installed:\n    - or|der: 1\n').text.includes(`${docs}/ordering.html#the-order-option`));

  // Nothing on values, unknown functions or unknown keys (the argument check covers those).
  assert.strictEqual(at('x:\n  pkg.installed:\n    - refresh: Tr|ue\n'), undefined);
  assert.strictEqual(at('x:\n  nosuch.fu|n:\n'), undefined);
  assert.strictEqual(at('x:\n  pkg.installed:\n    - pak|gs: [a]\n'), undefined);

  // Salt 3006: its own data and docs.
  h.config['saltSyntax.saltVersion'] = '3006';
  r = at('x:\n  boto_ec2.instance_pres|ent:\n');
  assert.match(r.text, /^\*\*boto_ec2\.instance_present\*\* · Salt 3006/);
  assert.ok(r.text.includes('https://docs.saltproject.io/en/3006/ref/states/all/salt.states.boto_ec2.html#salt.states.boto_ec2.instance_present'));
  delete h.config['saltSyntax.saltVersion'];
  assert.strictEqual(at('x:\n  boto_ec2.instance_pres|ent:\n'), undefined, '3008: no boto_ec2');
  console.log('ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
