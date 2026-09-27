{#- Whitespace demo for the rendered preview's character origins (#60,
    experimental): open the preview (Ctrl+K V), hover the blank lines and the
    stray spaces, and look at the hints on the empty lines. #}
{%- set users = ['alice', 'bob'] %}
{% set shell = '/bin/bash' %}

{% for user in users %}
{{ user }}:
  user.present:
    - shell: {{ shell }}
    {% if user == 'alice' %}
    - groups:
      - wheel
    {% endif %}

{% endfor %}
