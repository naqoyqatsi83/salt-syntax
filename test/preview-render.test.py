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
# pillar.filter_by branches on a pillar key, asked for as pillar -- not as an opaque call.
fb = '{% set r = salt["pillar.filter_by"]({"eu": {"m": "m1"}, "us": {"m": "m2"}, "default": {"m": "m0"}}, pillar="region") %}\nm: {{ r.m }}\n'
r = one(fb)
c.eq([q["id"] for q in r["questions"]], ["pillar|region"], "pillar.filter_by asks for its pillar key")
c.true("m: m0" in r["rendered"], "unanswered: the default entry")
c.true("m: m2" in one(fb, {"pillar|region": "us"})["rendered"], "answered: the matching entry")
# The merge helpers change their target in place, as Salt's do (dictupdate.update):
# `{% do salt['defaults.merge'](d, extra) %}` is how map.jinja files use them.
mp = ('{% set d = {"pkg": {"name": "p"}, "files": ["a"]} %}'
      '{% set os = salt["grains.filter_by"]({"RedHat": {"pkg": {"name": "p-rh"}}}) or {} %}{% do salt["defaults.merge"](d, os) %}'
      '{% set r = salt["pillar.filter_by"]({"r*": {"masters": {"linux": "m1"}}}, pillar="region") or {} %}{% do salt["defaults.merge"](d, r) %}'
      '{% do salt["slsutil.update"](d, {"files": ["b"]}, merge_lists=True) %}'
      '{% set c = salt["grains.filter_by"]({"x": d}, default="x", merge={"extra": 1}) %}'
      '{% set copy = salt["slsutil.merge"](d, {"extra": 2}) %}\n'
      'v: {{ d.pkg.name }} {{ d.masters.linux }} {{ d.files | join(",") }} {{ d.extra }} {{ copy.extra }} {{ c is sameas d }}\n')
c.true("v: p-rh m1 a,b 1 2 True" in one(mp, {"grains|os_family": "RedHat", "pillar|region": "region_1"})["rendered"],
       "defaults.merge / slsutil.update / filter_by merge= in place, fnmatch keys, slsutil.merge a copy")
c.eq((one('{% do salt["defaults.merge"]({}, "region_2") %}')["error"] or {}).get("message"),
     "Jinja error: Cannot update using non-dict types in dictupdate.update()", "merging a non-dict fails, as in Salt")
# The lookup functions, as Salt's (salt/modules/{config,pillar,grains}.py) and the
# Jinja globals, which are plain dicts in Salt.
lk = ('a: {{ salt["config.get"]("app:port", 1) }} {{ salt["config.get"]("id") }} {{ salt["config.option"]("app:port") | tojson }}\n'
      'b: {{ salt["pillar.get"]("app", {"port": 0, "host": "h"}, merge=True) | tojson }} {{ salt["pillar.get"]("app", {"x": 1}) | tojson }}\n'
      'c: {{ salt["grains.fetch"]("os") }} {{ salt["pillar.item"]("nope", default="d") | tojson }}\n'
      'd: {{ pillar.get("app:port", "dflt") }} {{ pillar.get("app") | tojson }}\n')
r = one(lk, {"pillar|app": "{port: 8}", "config|id": "minion1", "grains|os": "Fedora"})
out = r["rendered"]
c.true("a: 8 minion1 \"\"" in out, f"config.get falls back to pillar, config.option doesn't follow ':': {out!r}")
c.true('b: {"port": 8, "host": "h"} {"port": 8}' in out, f"pillar.get merge=True merges over a dict default: {out!r}")
c.true('c: Fedora {"nope": "d"}' in out, f"grains.fetch, pillar.item default=: {out!r}")
c.true('d: dflt {"port": 8}' in out, f"pillar.get('a:b') on the pillar dict: a literal key, the default: {out!r}")
c.eq([w for w in r["warnings"] if "plain dict" in w][:1],
     ["pillar.get('app:port') (init.sls line 4): `pillar` is a plain dict in Salt, so ':' isn't followed and this returns the default "
      "-- use salt['pillar.get']('app:port') for a nested key"], "and warns about it")
c.eq([e["message"] for e in one("x: {{ env }}\n")["strictErrors"]], ["Jinja variable 'env' is undefined"], "no `env` in Salt's context")
top = render("x: {{ tpldir }}|{{ slspath }}|{{ sls }}\n", os.path.join(FIXTURES, "errors", "top.sls"), [os.path.join(FIXTURES, "errors")])
c.true("x: .||top" in top["rendered"], f"tpldir is '.' at the root, as generate_sls_context: {top['rendered']!r}")
# Non-ASCII source, sent the way the extension sends it (UTF-8, not \u-escaped),
# read right whatever the platform's stdin encoding (cp1252 on Windows).
import json, subprocess  # noqa: E401,E402
req = {"source": "a: café \U0001F60A\n", "path": os.path.join(FIXTURES, "errors", "f", "init.sls"), "roots": [os.path.join(FIXTURES, "errors")]}
out = subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), "..", "src", "preview", "render.py")],
                     input=json.dumps(req, ensure_ascii=False).encode("utf-8"), capture_output=True,
                     env=dict(os.environ, PYTHONIOENCODING="cp1252", PYTHONUTF8="0"))
c.eq(ascii(json.loads(out.stdout or b"{}").get("rendered")), ascii(req["source"]), f"non-ASCII source intact: {out.stderr[-300:]!r}")

# YAML as Salt reads it (#74): a leading zero isn't octal -- in an answer (pillar) and in load_yaml / import_yaml data.
oc = one('s:\n  file.managed:\n    - mode: {{ salt["pillar.get"]("m") }}\n    - dir_mode: {{ ("d: 0755" | load_yaml).d }}\n',
         {"pillar|m": "0644"})["rendered"]
c.true("- mode: 644" in oc and "- dir_mode: 755" in oc, f"0644 / 0755 read as 644 / 755, not octal 420 / 493: {oc!r}")

# What Salt's render_jinja_tmpl adds to Jinja (#75): the `list` test, `odict`, `show_full_context`.
r = one('a: {{ [1] is list }} {{ (1,) is list }} {{ {} is list }}\nb: {{ odict([("z", 1), ("a", 2)]) | tojson }}\n'
        'c: {{ show_full_context().sls }} {{ show_full_context().pillar | tojson }}\n', {"pillar|(all)": "{k: v}"})
c.eq((r["error"], r["rendered"]), (None, 'a: True False False\nb: {"z": 1, "a": 2}\nc: f {"k": "v"}\n'), "list test, odict, show_full_context")
c.done()
