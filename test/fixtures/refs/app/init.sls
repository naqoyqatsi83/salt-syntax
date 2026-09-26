include:
  - .db

{{ sls }}.config:
  file.managed:
    - names:
      - /etc/app/a.conf
      - /etc/app/b.conf:
        - source: salt://app/b.conf

{{ sls }}.service:
  service.running:
    - name: app
    - require:
      - file: {{ sls }}.config
      - file: /etc/app/b.conf
      - pkg: postgresql
      - service: app.db.service
      - app.db.pkg
      - id: app.config
      - sls: app.db
      - sls: app.*
      - pkg: postgre*
      - pkg: nope
      - service: app.db.missing
      - app.nothing
      - sls: app.other
      - file: pos*

extend:
  app.db.service:
    service.running:
      - enable: True
  app.db.nothere:
    pkg.installed: []
