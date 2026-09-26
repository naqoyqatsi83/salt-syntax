{{ sls }}.pkg:
  pkg.installed:
    - name: postgresql

{{ sls }}.service:
  service.running:
    - name: postgresql
    - require:
      - pkg: {{ sls }}.pkg
