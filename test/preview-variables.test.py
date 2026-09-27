"""The template's variables after rendering (#65): what `{% from %}` would
import -- for a map.jinja, the map itself."""
import os
import sys

import yaml

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "helpers"))
from preview import FIXTURES, Checks, render  # noqa: E402

c = Checks()
root = os.path.join(FIXTURES, "errors")


def one(src, answers=None):
    return render(src, os.path.join(root, "f", "map.jinja"), [root], answers)


MAP = """{%- set os_map = {'RedHat': {'pkg': 'chrony', 'service': 'chronyd'}, 'Debian': {'pkg': 'chrony', 'service': 'chrony'}} %}
{%- set chrony = salt['grains.filter_by'](os_map, grain='os_family') %}
{%- macro helper() %}x{% endmacro %}
{%- set _hidden = 1 %}
{%- from "f/lib.jinja" import imported %}
"""
lib = os.path.join(root, "f", "lib.jinja")
open(lib, "w").write("{% set imported = 1 %}\n")
try:
    # The map follows the grain answered in the panel.
    r = one(MAP, {"grains|os_family": "Debian"})
    v = yaml.safe_load(r["variables"])
    c.eq(v["chrony"], {"pkg": "chrony", "service": "chrony"}, "Debian's map")
    c.eq(yaml.safe_load(one(MAP, {"grains|os_family": "RedHat"})["variables"])["chrony"]["service"], "chronyd", "RedHat's")
    c.eq(list(v), ["os_map", "chrony"], "exported data only: no macro, no _private, not what it imports")
    c.true("&" not in r["variables"] and "*" not in r["variables"], "every value written out, no anchors/aliases")
    c.eq([q["id"] for q in one(MAP)["questions"]], ["grains|os_family"], "the grain is asked for")
    # Undefined values: their placeholder, without being counted as a use.
    r = one("{% set missing = nothing %}{% set html = 'a<b' | tojson %}")
    c.eq(yaml.safe_load(r["variables"]), {"missing": "«variable:nothing»", "html": '"a\\u003cb"'}, "placeholder, Markup as text")
    c.eq(r["strictErrors"], [], "showing it isn't a use")
    # The rendered output itself is untouched; nothing to show, nothing shown.
    r = one("a: 1\n{% set x = 2 %}")
    c.eq(r["rendered"], "a: 1\n", "rendered as before")
    c.eq(one("a: 1\n")["variables"], None, "no variables: none")
    c.eq(one("{% if %}")["variables"], None, "render error: none")
finally:
    os.remove(lib)
c.done()
