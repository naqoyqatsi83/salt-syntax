# -*- coding: utf-8 -*-
# vim: ft=sls

{#- Get the tplroot from tpldir #}
{%- set tplroot = tpldir.split('/')[0] %}
{%- from tplroot ~ "/lib/map.jinja" import formula with context %}

{{ sls }}.service_dead:
  service.dead:
    - names: {{ formula.service.names | json }}
    - enable: False

{{ sls }}.pkg_absent:
  pkg.removed:
    - name: {{ formula.pkg }}
    - require:
      - service: {{ sls }}.service_dead

{{ sls }}.umount_opt_formula:
  mount.unmounted:
    - name: /opt/formula
    - persist: True

{{ sls }}.remove_lvformula:
  lvm.lv_absent:
    - name: lvformula
    - vgname: rootvg

{{ sls }}.formula_files_absent:
  file.absent:
    - names:
      - /opt/formula
      - /etc/formula
      - /var/log/formula_installer.log
      - /var/log/formula_installer_script.log
    - require:
      - pkg: {{ sls }}.pkg_absent
    - onlyif:
      - test -e /opt/formula || test -e /etc/formula || test -e /var/log/formula_installer.log || test -e /var/log/formula_installer_script.log
