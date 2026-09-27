// The Salt version switch (#54): saltSyntax.saltVersion picks the dataset
// state completion uses (the preview's checks follow it too -- see the
// preview tests), and Salt Syntax: Set Salt Version sets it.
const assert = require('assert');
const { load, doc, Position } = require('./helpers/vscode');

(async () => {
  const h = await load();
  const state = h.provider('completion', (c) => c.triggers.length === 1 && c.triggers[0] === '.');
  const complete = (text) => {
    const lines = text.split('\n');
    return state.provideCompletionItems(doc(text), new Position(lines.length - 1, lines[lines.length - 1].length)) || [];
  };
  const modules = () => complete('id:\n  ').map((i) => i.label);
  const functions = (mod) => complete(`id:\n  ${mod}.`).filter((i) => !i.label.endsWith('(full)')).map((i) => i.label);
  const fullArgs = (mod, fn) => complete(`id:\n  ${mod}.`).find((i) => i.label === `${fn} (full)`).insertText.value.split('\n').length - 1;

  // Default: 3008.2 -- 128 modules; boto_* was split out into salt-extensions.
  assert.strictEqual(modules().length, 128, '3008: module count');
  assert.deepStrictEqual(functions('boto_ec2'), [], '3008: no boto_ec2');
  assert.ok(functions('file').includes('managed'));
  assert.strictEqual(fullArgs('file', 'managed'), 49, '3008: file.managed arguments');

  // 3006.27 (LTS): 353 modules, boto_* included, its own signatures.
  h.config['saltSyntax.saltVersion'] = '3006';
  assert.strictEqual(modules().length, 353, '3006: module count');
  assert.ok(functions('boto_ec2').includes('instance_present'), '3006: boto_ec2');
  assert.strictEqual(fullArgs('file', 'managed'), 38, '3006: file.managed arguments');

  // An unknown value falls back to 3008.
  h.config['saltSyntax.saltVersion'] = '3007';
  assert.strictEqual(modules().length, 128, 'unknown version: 3008');

  // Set Salt Version: both lines offered, the current one marked; the pick
  // is written globally and completion follows at once.
  delete h.config['saltSyntax.saltVersion'];
  let offered;
  h.vscode.window.showQuickPick = async (items) => ((offered = items), items.find((i) => i.value === '3006'));
  await h.reg.commands['saltSyntax.setSaltVersion']();
  assert.deepStrictEqual(offered.map((i) => [i.label, i.description]), [['3008.x', 'current'], ['3006.x', '']]);
  assert.strictEqual(h.config['saltSyntax.saltVersion'], '3006');
  assert.deepStrictEqual(h.reg.configWrites[h.reg.configWrites.length - 1], { languageId: undefined, key: 'saltSyntax.saltVersion', value: '3006', target: h.vscode.ConfigurationTarget.Global });
  assert.strictEqual(modules().length, 353, 'completion follows the command');
  // Cancelled: nothing written.
  const writes = h.reg.configWrites.length;
  h.vscode.window.showQuickPick = async () => undefined;
  await h.reg.commands['saltSyntax.setSaltVersion']();
  assert.strictEqual(h.reg.configWrites.length, writes, 'cancel writes nothing');
  console.log('ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
