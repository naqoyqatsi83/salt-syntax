{% from "o/lib.jinja" import nop %}
{{ nop('x') }}
{% include "o/part.sls" %}
{% import_yaml "o/data.yaml" as data %}
y: {{ data.port + 1 }}
