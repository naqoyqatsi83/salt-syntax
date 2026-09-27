// The editor-settings toggles (#54): showWhitespace, enforceLfLineEndings,
// enforceFinalNewline and enforceIndentSize write language-scoped overrides
// for both Salt languages. On (the default) means no override -- except the
// indentation trio, which writes its values so a global editor.tabSize
// can't win; off writes VS Code's own default explicitly.
const assert = require('assert');
const { load } = require('./helpers/vscode');

(async () => {
  const h = await load();
  const langs = ['sls', 'salt-jinja'];
  const overrides = (lang) => h.reg.languageConfig[lang] || {};
  const indentOn = { 'editor.tabSize': 2, 'editor.insertSpaces': true, 'editor.detectIndentation': false };
  const toggle = async (setting, on) => {
    h.config[`saltSyntax.${setting}`] = on;
    await h.fireConfig(`saltSyntax.${setting}`);
  };

  // Activation with everything on: only the indentation trio is written.
  for (const lang of langs) assert.deepStrictEqual(overrides(lang), indentOn, `activation: ${lang}`);
  assert.strictEqual(h.reg.configWrites.length, 6, '3 settings x 2 languages');

  // Off writes VS Code's own default; on again removes the override.
  const cases = [
    ['showWhitespace', { 'editor.renderWhitespace': 'selection' }],
    ['enforceLfLineEndings', { 'files.eol': 'auto' }],
    ['enforceFinalNewline', { 'files.insertFinalNewline': false, 'files.trimFinalNewlines': false }]
  ];
  for (const [setting, off] of cases) {
    await toggle(setting, false);
    for (const lang of langs) assert.deepStrictEqual(overrides(lang), { ...indentOn, ...off }, `${setting} off: ${lang}`);
    await toggle(setting, true);
    for (const lang of langs) assert.deepStrictEqual(overrides(lang), indentOn, `${setting} on again: ${lang}`);
  }

  // enforceIndentSize off: VS Code's defaults, written explicitly too.
  await toggle('enforceIndentSize', false);
  for (const lang of langs) {
    assert.deepStrictEqual(overrides(lang), { 'editor.tabSize': 4, 'editor.insertSpaces': true, 'editor.detectIndentation': true }, `enforceIndentSize off: ${lang}`);
  }
  await toggle('enforceIndentSize', true);
  for (const lang of langs) assert.deepStrictEqual(overrides(lang), indentOn);

  // Nothing is rewritten when nothing changed: an unrelated setting, or a
  // toggle event with the value as it already is.
  const writes = h.reg.configWrites.length;
  await h.fireConfig('saltSyntax.saltVersion');
  await h.fireConfig('saltSyntax.showWhitespace');
  assert.strictEqual(h.reg.configWrites.length, writes, 'no redundant writes');
  console.log('ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
