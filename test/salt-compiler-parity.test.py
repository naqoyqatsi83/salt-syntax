"""The preview's state-compiler checks against Salt's own code (#23).

Runs Salt's real _handle_state_decls() and verify_high() -- extracted from
salt/state.py at the pinned 3006 and 3008 tags (downloaded into
test/.cache) -- and the preview's compiler_problems() on the same rendered
data, and requires the same set of error messages from both. Skipped when
the source can't be fetched and isn't cached.
"""
import os
import sys
import textwrap
from collections import OrderedDict

import yaml

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "helpers"))
from preview import Checks, renderer, salt_source  # noqa: E402

REQUISITES_3008 = frozenset(["onfail", "onfail_any", "onfail_all", "require", "require_any", "onchanges", "onchanges_any",
                             "watch", "watch_any", "prereq", "prerequired", "listen", "onfail_stop"])


def _extract(src, header, until):
    i = src.index(header)
    return textwrap.dedent(src[i:src.index(until, i)])


def _hashable(x):
    try:
        hash(x)
        return True
    except TypeError:
        return False


def salt_errors(rendered, version, sls):
    """Salt's own errors for this rendered SLS. Salt stops at
    _handle_state_decls errors; the rest is verified too here, as the preview
    reports every problem."""
    src = salt_source(version, "salt/state.py")
    ns = {"ishashable": _hashable, "HashableOrderedDict": OrderedDict, "OrderedDict": OrderedDict}
    if version == "3008":
        ns["STATE_REQUISITE_KEYWORDS"] = REQUISITES_3008
        exec(_extract(src, "def _verify_high(", "class StateError"), ns)
        verify = ns["_verify_high"]
    else:
        exec(_extract(src, "    def verify_high(self, high):", "    def order_chunks"), ns)
        verify = lambda high: ns["verify_high"](None, high)  # noqa: E731
    exec(_extract(src, "    def _handle_state_decls(self, state, sls, saltenv, errors):", "    def _handle_extend"), ns)
    high = yaml.safe_load(rendered) or {}
    for k in ("include", "exclude", "extend"):
        high.pop(k, None)
    errors = []
    ns["_handle_state_decls"](None, high, sls, "base", errors)
    high = {k: v for k, v in high.items() if isinstance(v, dict)}
    return sorted(e.strip() for e in errors + verify(high))


CASES = {
    "missing colon in arg": "a:\n  file.managed:\n    - name /etc/x\n    - source: salt://x\n",
    "two functions": "a:\n  pkg.installed:\n    - latest\n    - name: vim\n",
    "no function": "a:\n  pkg:\n    - name: vim\n",
    "not a list": "a:\n  file.managed: /etc/x\n",
    "trailing colon": "a:\n  pkg.installed:\n",
    "no body": "a:\nb:\n  test.nop: []\n",
    "string body without a dot": "a: nodot\n",
    "short form": "a: test.nop\n",
    "int / bool IDs": "1234:\n  test.nop: []\nyes:\n  test.nop: []\n",
    "require not a list": "a:\n  test.nop:\n    - require: b\n",
    "requisite type with a dot": "a:\n  test.nop:\n    - require:\n      - pkg.installed: vim\n",
    "illegal requisite value": "a:\n  test.nop:\n    - require:\n      - pkg: [x, y]\n",
    "multi-key requisite entry": "a:\n  test.nop:\n    - require:\n      - pkg: vim\n        file: /x\n",
    "requisite argument with 2 keys": "a:\n  test.nop:\n    - require:\n      - pkg: vim\n      unrelated: 1\n",
    "onfail not a list": "a:\n  test.nop:\n    - onfail: b\n",
    "names not a list": "a:\n  test.nop:\n    - names: x\n",
    "same module twice": "a:\n  file.managed:\n    - name: /x\n  file.comment:\n    - regex: ^x\n",
    "argument with 2 keys (valid)": "a:\n  file.managed:\n    - name: /x\n      source: salt://x\n",
    "empty argument (suspicious only)": "a:\n  file.managed:\n    - name:\n",
    "clean": "include:\n  - other\na:\n  file.managed:\n    - name: /x\n    - require:\n      - pkg: vim\n      - b\nb: test.nop\n",
}

c = Checks()
r = renderer()
for version in ("3006", "3008"):
    for name, text in CASES.items():
        ours = sorted(p["message"].split(" -- ")[0].strip() for p in r.compiler_problems(text, version, "f.x") if p["reject"])
        c.eq(ours, salt_errors(text, version, "f.x"), f"Salt {version}: {name}")
c.done()
