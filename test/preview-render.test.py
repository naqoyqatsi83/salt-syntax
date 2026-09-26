"""The preview's renderer: Salt's Jinja environment, inputs, errors (#23)."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "helpers"))
from preview import FIXTURES, Checks, render  # noqa: E402

c = Checks()
nginx_root = FIXTURES
init = os.path.join(FIXTURES, "nginx", "init.sls")
source = open(init).read()

# Unanswered: context from the path, map.jinja + import_yaml processed for real,
# only the genuinely external values asked for, defaults pre-filled.
r = render(source, init, [nginx_root])
c.eq(r["error"], None, "no render error")
c.eq((r["context"]["sls"], r["context"]["tpldir"]), ("nginx", "nginx"), "sls/tpldir from the path")
c.eq([q["id"] for q in r["questions"]], ["pillar|nginx:lookup", "grains|os_family", "pillar|nginx:sites", "variable|banner_text"],
     "questions reached by this render")
c.eq({q["id"]: q["default"] for q in r["questions"]}["pillar|nginx:sites"], "[]", "default shown")
c.true("- name: nginx" in r["rendered"], "package name from defaults.yaml")
c.true('"\\xABvariable:banner_text\\xBB"' in r["rendered"], "unknown variable: a visible placeholder, escaped by yaml_dquote exactly as Salt's does")
c.eq([e["message"] for e in r["strictErrors"]], ["Jinja variable 'banner_text' is undefined"], "StrictUndefined, as Salt")

# Answered: follow-up questions appear as the render reaches them (render-until-unknown).
answers = {"grains|os_family": "RedHat", "grains|osmajorrelease": "9", "pillar|nginx:sites": "[shop, blog]",
           "pillar|nginx:sites:blog:port": "8443", "variable|banner_text": "Managed by Salt",
           "salt|cmd.run('getsebool httpd_can_network_connect')": "httpd_can_network_connect --> on", "pillar|nginx:lookup": "{pkg: nginx-custom}"}
r = render(source, init, [nginx_root], answers)
out = r["rendered"]
for want in ["- name: nginx-custom", "/etc/nginx/conf.d/shop.conf", 'contents: "listen 80"', 'contents: "listen 8443"',
             "nginx.selinux:", '- unless: "httpd_can_network_connect --> on"', '- contents: "Managed by Salt"']:
    c.true(want in out, f"answered render contains {want!r}")
ids = [q["id"] for q in r["questions"]]
c.true("pillar|nginx:sites:shop:port" in ids and "grains|osmajorrelease" in ids, "follow-up questions")
c.eq(r["strictErrors"], [], "answered variable no longer undefined")
c.true("variable|banner_text" in ids, "an answered variable stays listed")


def one(src, answers=None):
    return render(src, os.path.join(FIXTURES, "errors", "f", "init.sls"), [os.path.join(FIXTURES, "errors")], answers)


# Errors, in Salt's wording, with file and line.
e = one("a: 1\nb: 2\n{% if x %}\nc: 3")["error"]
c.eq((e["message"].split(":")[0], e["line"]), ("Jinja syntax error", 3), "syntax error")
e = one('{% from "nope/map.jinja" import m %}\na: 1')["error"]
c.true(e["message"].startswith("Jinja error: nope/map.jinja") and e["line"] == 1, f"missing import: {e}")
e = one('{% from "f/map.jinja" import m %}\na: {{ m.a }}\n')["error"]
c.eq((e["message"], os.path.basename(e["file"]), e["line"]), ("Jinja error: division by zero", "map.jinja", 2), "error inside an import")
e = one('a: {{ "x" | not_a_salt_filter }}')["error"]
c.eq((e["message"], e["line"]), ("Jinja syntax error: No filter named 'not_a_salt_filter'.", 1), "unknown filter fails the render, as in Salt")

# Salt's sandbox, raise(), match/equalto (identical in 3006 and 3008).
r = one('s:\n  test.nop:\n    - name: {{ "".__class__ }}\n')
c.eq([(x["message"], x["line"]) for x in r["strictErrors"]],
     [("Jinja syntax error: access to attribute '__class__' of 'str' object is unsafe.", 3)], "sandbox, with its line")
c.eq(one('{{ raise("Windows is not supported") }}\n')["error"]["message"], "Jinja error: Windows is not supported", "raise()")
c.true("True True False" in one('s:\n  test.nop:\n    - name: {{ "web01" is match("web\\\\d+") }} {{ 1 is equalto 1 }} {{ "db1" is match("web") }}\n')["rendered"],
       "match / equalto")

# StrictUndefined: what fails the render in Salt, and what doesn't.
r = one('{% set d = {"k": 1} %}\nx: {{ d.nokey }}\n{% if d.other %}y: 1{% endif %}\n{% for i in undefined_list %}{% endfor %}\n')
c.eq([(x["message"], x["line"]) for x in r["strictErrors"]],
     [("Jinja variable 'dict object' has no attribute 'nokey'", 2), ("Jinja variable 'dict object' has no attribute 'other'", 3),
      ("Jinja variable 'undefined_list' is undefined", 4)], "missing key printed / tested / iterated")
c.eq(one('{% if nothing is defined %}a: 1{% endif %}\nb: {{ nothing | default("d") }}\n')["strictErrors"], [], "is defined / default are fine")
c.eq(one('{% from "f/map.jinja" import m %}')["error"]["message"], "Jinja error: division by zero", "import still evaluated")
c.done()
