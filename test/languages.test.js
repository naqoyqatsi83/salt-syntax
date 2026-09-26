// sls vs salt-jinja feature split, and YAML auto-detection (#26, #27).
const assert = require('assert');
const { load, doc, sleep } = require('./helpers/vscode');

(async () => {
  const h = await load();
  const langs = (sel) => (Array.isArray(sel) ? sel : [sel]).map((s) => s.language).sort().join(',');
  assert.strictEqual(langs(h.reg.completion.find((c) => c.triggers.includes('.')).sel), 'sls', 'module.function completion: sls only');
  assert.strictEqual(langs(h.reg.completion.find((c) => c.triggers.includes('-')).sel), 'sls', 'requisite completion: sls only');
  assert.strictEqual(langs(h.reg.completion.find((c) => c.triggers.includes('|')).sel), 'salt-jinja,sls', 'Jinja completion: both');
  assert.strictEqual(langs(h.reg.highlight[0].sel), 'salt-jinja,sls');
  assert.strictEqual(langs(h.reg.onType[0].sel), 'salt-jinja,sls');
  h.reg.codeActions.forEach((c) => assert.strictEqual(langs(c.sel), 'salt-jinja,sls'));

  // Checks run on salt-jinja documents too.
  await h.open(doc('{% for x in y %}\n{% set z = 1 %}\n{% endfor %}\nn: "café"', { languageId: 'salt-jinja', path: '/w/map.jinja' }));
  assert.strictEqual(h.reg.collections['salt-syntax-jinja-indent'].get('file:/w/map.jinja').length, 1);
  assert.strictEqual(h.reg.collections['salt-syntax-non-ascii'].get('file:/w/map.jinja').length, 1);

  // YAML auto-detect: only a line *starting* with {% / {#, only plain yaml.
  const open = async (text, languageId, p) => {
    const d = doc(text, { languageId, path: p });
    await h.open(d);
    await sleep(0);
    return d;
  };
  const map = await open('formula:\n  pkg: nginx\n  {% if grains.os == "Ubuntu" %}\n  svc: nginx\n  {% endif %}', 'yaml', '/w/defaults.yaml');
  await open('{#- defaults #}\na: 1', 'yaml', '/w/c.yaml');
  await open('steps:\n  - run: echo ${{ github.sha }}\n    when: "{{ x }}"\n    y: "{% if a %}b{% endif %}"', 'yaml', '/w/ci.yaml');
  await open('- hosts: all\n{% raw %}', 'ansible', '/w/play.yml');
  await open('{% if a %}', 'json', '/w/x.json');
  assert.deepStrictEqual(h.reg.languageSwitches, [['file:/w/defaults.yaml', 'salt-jinja'], ['file:/w/c.yaml', 'salt-jinja']]);
  // switched back to YAML by hand -> VS Code reopens it as yaml -> not re-switched
  await h.open(map);
  assert.strictEqual(h.reg.languageSwitches.length, 2);
  h.config['saltSyntax.detectJinjaInYaml'] = false;
  await open('{% set a = 1 %}', 'yaml', '/w/off.yaml');
  assert.strictEqual(h.reg.languageSwitches.length, 2, 'setting off');
  console.log('ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
