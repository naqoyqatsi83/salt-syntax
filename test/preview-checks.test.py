"""Checks on the rendered output: YAML problems, empty values, state calls
against the per-version datasets, includes (#23)."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "helpers"))
from preview import FIXTURES, Checks, datasets, renderer  # noqa: E402

c = Checks()
r = renderer()
ds = datasets()
roots = [os.path.join(FIXTURES, "includes")]


def problems(text, version="3008", sls="web.service", rel="web/service.sls"):
    return [(p["line"], "state" if p.get("lead") == "state" else "reject" if p.get("reject", True) else "suspicious", p["message"])
            for p in r.check_rendered_yaml(text, version, sls, ds[version], roots, rel)]


def lines(text, **kw):
    return [(line, kind) for line, kind, _ in problems(text, **kw)]


# YAML: every problem, each on the line at fault.
base = ["include:", "  - web.config", "", "x.svc:", "  test.nop: []", "", "x.___a:", "  test.nop: []"]
tail = ["", "x.___a:", "  test.nop: []", "", "x.___b:", "  test.nop: []"]
E = "\U0001F60A"
text = "\n".join(base + [E] + tail) + "\n"
got = problems(text)
c.eq([(line, text.split("\n")[line - 1]) for line, _k, _m in got], [(9, E), (11, "x.___a:")], "stray line before a duplicate: both, each where it is")
c.true("while scanning a simple key" in got[0][2] and "conflicting ID 'x.___a'" in got[1][2], "messages")
text = "\n".join(base + tail + ["", "x.___b:", "  test.nop: []", "", "x.svc:", "  test.nop: []"]) + "\n"
c.eq([m.split("'")[1] for _l, _k, m in problems(text)], ["x.___a", "x.___b", "x.svc"], "every duplicate, not just the first")
c.eq(lines("a:\n  test.nop:\n    - env:\n        A: 1\n        A: 2\n"), [(5, "reject")], "nested duplicate")
c.eq([(line, m.split(" (")[0]) for line, _k, m in problems("b: &b {a: 1}\nt:\n  test.nop:\n    - <<: *b\n      a: 2\n") if "conflicting" in m],
     [(5, "found conflicting ID 'a'")], "merge key then override: rejected like Salt")

# Values that rendered empty.
c.eq(lines("a:\n  file.managed:\n    - name: \n    - contents: ~\n    - require:\n      - pkg: vim\n"), [(3, "suspicious")], "empty argument only")

# State calls against the selected version's datasets.
c.eq(lines("a:\n  pkg.instaled:\n    - name: vim\n"), [(2, "state")], "unknown function")
c.eq(lines("a: pkg.instaled\n"), [(1, "state")], "unknown function, short form")
c.eq(lines("a:\n  pkgz.installed: []\n"), [(2, "suspicious")], "unknown module: suspicious")
c.eq(lines("a:\n  boto_vpc.present:\n    - cidr_block: 10.0.0.0/16\n", version="3006"), [], "boto_vpc exists in 3006")
c.eq(lines("a:\n  boto_vpc.present:\n    - cidr_block: 10.0.0.0/16\n", version="3008"), [(2, "suspicious")], "...but not in 3008 core")
c.eq(problems("a:\n  acl.absent:\n    - perms: rw\n")[0][2], "Missing parameter acl_type for state acl.absent", "missing parameter")
c.eq(lines("a:\n  acl.absent:\n    - acl_type: user\n    - acl_name: bob\n    - perms: rw\n"), [], "parameters given")
c.eq(lines("/etc/x:\n  file.managed: []\n"), [], "name defaults to the ID")
c.eq(lines("a:\n  acl.absent:\n    - names:\n      - x:\n        - acl_type: user\n"), [], "names: with per-name args skipped")
c.eq(lines("a:\n  mycorp.present: []\nb:\n  corp_states.present: []\n"), [], "custom _states module (file name and __virtualname__)")

# Includes, resolved like render_state().
inc = "include:\n  - web.config\n  - web.nope\n  - .config\n  - ..service\n  - web.*\n  - nope.*\n  - otherenv: whatever\n  - ....toofar\n"
got = problems(inc)
c.eq([line for line, _k, _m in got], [3, 5, 7, 9], "missing, relative-missing, glob-missing, too far up")
c.true(got[0][2] == "Unknown include: Specified SLS base: web.nope is not available on the salt master in saltenv(s): base", got[0][2])
c.true(got[1][2].startswith("Unknown include: Specified SLS base: service "), "..service resolves to 'service'")
c.true("goes beyond top level package" in got[3][2], "beyond top level")
c.eq(lines("include:\n  - .service\n", sls="web", rel="web/init.sls"), [], "init.sls counts as a level for relative includes")
c.done()
