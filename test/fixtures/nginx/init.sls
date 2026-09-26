{%- from tpldir ~ "/map.jinja" import nginx with context %}
{{ sls }}.pkg:
  pkg.installed:
    - name: {{ nginx.pkg }}

{% for site in salt['pillar.get']('nginx:sites', []) %}
{{ sls }}.site.{{ site }}:
  file.managed:
    - name: {{ nginx.config_dir }}/{{ site }}.conf
    - contents: "listen {{ salt['pillar.get']('nginx:sites:' ~ site ~ ':port', nginx.port) }}"
{% endfor %}

{% if grains['os_family'] == 'RedHat' and grains.get('osmajorrelease', 0)|int >= 8 %}
{{ sls }}.selinux:
  cmd.run:
    - name: setsebool -P httpd_can_network_connect 1
    - unless: {{ salt['cmd.run']('getsebool httpd_can_network_connect') | yaml_dquote }}
{% endif %}
{{ sls }}.motd:
  file.managed:
    - name: /etc/motd
    - contents: {{ banner_text | yaml_dquote }}
