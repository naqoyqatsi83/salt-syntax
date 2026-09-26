// The static inputs extractor behind the preview panel's line numbers (#23).
const assert = require('assert');
const path = require('path');
const { extractTemplateInputs, groupTemplateInputs } = require(path.join(__dirname, '..', 'src', 'templateInputs.js'));

const state = `{% from tpldir ~ "/map.jinja" import formula with context %}
{% set port = pillar.get('app:port', 8080) %}
{% set users = salt['pillar.get']('users', []) %}
{% for user in users %}
{% set home = salt['pillar.get']('users:' ~ user ~ ':home', '/home/' ~ user) %}
{{ sls }}.{{ user }}:
  user.present:
    - shell: {{ pillar['shells']['default'] }}
{% endfor %}
{% if grains['os_family'] == 'RedHat' and grains.get('osmajorrelease', 0) >= 8 %}
    - name: echo {{ salt['cmd.run']('hostname -f') }}
    - unless: {{ salt.file.file_exists('/etc/done') }}
{% endif %}
{% set ip = salt['network.ip_addrs'](cidr=pillar.net.cidr)[0] %}
{% set master = salt['config.get']('master', 'salt') %}
{% set id = opts['id'] %}
{# {{ salt['cmd.run']('in a comment -- ignored') }} #}
{#% set x = pillar.get('toggled_off') %#}
{% raw %}{{ pillar.get('raw_ignored') }}{% endraw %}
note: "{{ 'the word pillar.get in a string' }}"
env: {{ saltenv }}`;
const g = Object.fromEntries(groupTemplateInputs(extractTemplateInputs(state)).map((c) => [c.id, c.keys]));
const keys = (cat) => (g[cat] || []).map((k) => k.key);
assert.deepStrictEqual(keys('pillar'), ['app:port', 'users', "'users:' ~ user ~ ':home'", 'shells:default', 'net:cidr']);
assert.strictEqual(g.pillar[0].default, '8080');
assert.strictEqual(g.pillar[2].dynamic, true, 'computed key flagged dynamic');
assert.deepStrictEqual(keys('grains'), ['os_family', 'osmajorrelease'], 'in document order');
assert.deepStrictEqual(keys('config'), ['master', 'id']);
assert.deepStrictEqual(keys('salt'), ["cmd.run('hostname -f')", "file.file_exists('/etc/done')", 'network.ip_addrs(cidr=pillar.net.cidr)']);
assert.deepStrictEqual(g.salt.map((k) => k.dynamic), [false, false, true]);
assert.deepStrictEqual(keys('context'), ['tpldir', 'sls', 'saltenv']);
const all = JSON.stringify(g);
for (const ignored of ['in a comment', 'toggled_off', 'raw_ignored', 'the word']) assert.ok(!all.includes(ignored), `${ignored} ignored`);
console.log('ok');
