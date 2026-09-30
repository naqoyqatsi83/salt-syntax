"""The preview's Salt functions against Salt's own implementations (#72).

The functions the preview computes rather than asks about -- the merge
helpers (defaults.*, slsutil.*), grains/pillar.filter_by -- and the lookups
it answers from the panel (pillar.get, grains.get, config.get, ...) are
extracted from Salt's source at the pinned 3006 and 3008 tags (fetched into
test/.cache), run with __pillar__ / __grains__ / __opts__ set to the same
data the preview gets as answers, and required to give identical results --
the same value, the same changes to their arguments (Salt's merges work in
place), or the same exception type.
"""
import ast
import collections.abc
import copy
import fnmatch
import logging
import os
import sys
import types

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "helpers"))
from preview import Checks, renderer, salt_source  # noqa: E402

import yaml  # noqa: E402 - after the helper, which skips the test without it


def load(version, path, ns):
    """Every top-level function (and UPPERCASE constant) of one Salt source
    file, executed into `ns`; decorators dropped."""
    for node in ast.parse(salt_source(version, path)).body:
        if isinstance(node, ast.FunctionDef):
            node.decorator_list = []
            exec(compile(ast.Module([node], []), path, "exec"), ns)
        elif isinstance(node, ast.Assign) and all(isinstance(t, ast.Name) and t.id.isupper() for t in node.targets):
            try:
                exec(compile(ast.Module([node], []), path, "exec"), ns)
            except Exception:  # noqa: BLE001 - constants that need more of Salt are skipped
                pass
    return ns


class SaltException(Exception):
    pass


def salt_modules(version, pillar, grains, opts):
    """{'mod.fn': Salt's function} for one version, with its dunders set."""
    salt = types.SimpleNamespace(utils=types.SimpleNamespace())
    base = {"salt": salt, "copy": copy, "fnmatch": fnmatch, "log": logging.getLogger("salt"), "logging": logging,
            "Mapping": collections.abc.Mapping, "MutableMapping": collections.abc.MutableMapping,
            "Sequence": collections.abc.Sequence, "DEFAULT_TARGET_DELIM": ":", "SaltException": SaltException,
            "SaltInvocationError": SaltException, "CommandExecutionError": SaltException, "deepcopy": copy.deepcopy,
            # For config.py's DEFAULTS table (built at import from these).
            "os": os, "_HOSTS_FILE": "/etc/hosts", "syspaths": types.SimpleNamespace(SRV_ROOT_DIR="/srv")}
    data = load(version, "salt/utils/data.py", dict(base, __name__="salt.utils.data"))
    dictupdate = load(version, "salt/utils/dictupdate.py", dict(base, __name__="salt.utils.dictupdate"))
    salt.utils.data = types.SimpleNamespace(**{k: v for k, v in data.items() if callable(v)})
    salt.utils.dictupdate = types.SimpleNamespace(**{k: v for k, v in dictupdate.items() if callable(v)})
    salt.utils.args = types.SimpleNamespace(yamlify_arg=lambda v: yaml.safe_load(v) if isinstance(v, str) else v)
    salt.utils.secret = types.SimpleNamespace(expose=lambda v: v, serial=lambda v: v,
                                              mask_pillar=types.SimpleNamespace(get=lambda: False))
    sys.modules["salt"], sys.modules["salt.utils"], sys.modules["salt.utils.args"] = salt, salt.utils, salt.utils.args
    dunders = {"__pillar__": pillar, "__grains__": grains, "__opts__": opts, "dictupdate": salt.utils.dictupdate,
               "sdb": types.SimpleNamespace(sdb_get=lambda v, opts: v), "NOT_SET": object()}
    out = {}
    for mod, names in (("defaults", ["merge", "update", "deepcopy"]), ("slsutil", ["update", "merge", "merge_all"]),
                       ("pillar", ["get", "item", "filter_by"]), ("grains", ["get", "item", "filter_by"]),
                       ("config", ["get", "option"])):
        ns = load(version, f"salt/modules/{mod}.py", dict(base, **dunders, __name__=f"salt.modules.{mod}"))
        for name in names:
            out[f"{mod}.{name}"] = ns[name]
    out["pillar.fetch"], out["grains.fetch"] = out["pillar.get"], out["grains.get"]  # `fetch = get` in both modules
    return out


def preview_functions(r, pillar, grains, opts):
    """The preview's salt[...] with the same data given as panel answers."""
    answers = {}
    for kind, data in (("pillar", pillar), ("grains", grains), ("config", opts)):
        for key, value in data.items():
            answers[f"{kind}|{key}"] = yaml.safe_dump(value)
    funcs = r.SaltFunctions(r.Session(answers), None)
    return lambda name: funcs[name]


def outcome(func, args, kwargs):
    """(result or exception type, the arguments afterwards)."""
    try:
        ret = ("ok", func(*args, **kwargs))
    except Exception as exc:  # noqa: BLE001
        # Salt's SaltException and the preview's stand-in both abort the
        # render as "Jinja error: ...".
        ret = ("raises", "SaltError" if type(exc).__name__ == "SaltException" else type(exc).__name__)
    return ret, (args, kwargs)


PILLAR = {"app": {"port": 8, "hosts": ["a", "b"], "tls": {"on": True}}, "users": [{"name": "u1"}, {"name": "u2"}],
          "region": "eu-west", "roles": ["web", "db"], "8080": "num-key"}
GRAINS = {"os_family": "RedHat", "os": "Fedora", "roles": ["db"], "id": "grain-id", "ip4": ["10.0.0.1"]}
OPTS = {"id": "minion1", "master": "salt.example", "nested": {"k": "v"}}

D = {"pkg": {"name": "p", "opts": ["a"]}, "svc": "s", "files": ["x"]}
LOOKUP = {"RedHat": {"pkg": {"name": "p-rh"}}, "Debian": {"pkg": {"name": "p-deb"}}, "default": {"pkg": {"name": "p0"}},
          "base": {"svc": "s-base", "pkg": {"name": "p-base", "v": 1}}}
CASES = {
    "defaults.merge": [([D, {"pkg": {"name": "q"}, "new": 1}], {}), ([D, {"files": ["y", "x"]}], {}),
                       ([D, {"files": ["y", "x"]}], {"merge_lists": True}), ([D, {"svc": {"x": 1}}], {}),
                       ([D, {"pkg": {"name": "q"}}], {"in_place": False}), ([None, {"a": 1}], {}),
                       ([None, {"a": 1}], {"in_place": False}), ([D, None], {}), ([D, "region_2"], {}),
                       ([{}, {"a": {"b": 1}}], {})],
    "defaults.update": [([{"h1": {"index": "f"}, "h2": {}}, {"enabled": True, "extra": ["t"]}], {}),
                        ([{"h1": {"extra": ["s"]}}, {"extra": ["t"]}], {}),
                        ([{"h1": {"extra": ["s"]}}, {"extra": ["t"]}], {"merge_lists": False, "in_place": False})],
    "defaults.deepcopy": [([D], {})],
    "slsutil.update": [([D, {"pkg": {"v": 2}}], {}), ([D, {"pkg": {"v": 2}}], {"recursive_update": False}),
                       ([D, {"files": ["y"]}], {"merge_lists": True}), ([{"a": 1}, {"b": {"c": 1}}], {}),
                       ([D, ["not", "a", "dict"]], {})],
    "slsutil.merge": [([D, {"pkg": {"v": 2}}], {}), ([D, {"pkg": {"v": 2}}], {"strategy": "recurse"}),
                      ([D, {"pkg": {"v": 2}, "svc": "t"}], {"strategy": "overwrite"}),
                      ([D, {"pkg": {"v": 2}}], {"strategy": "list"}), ([D, {"files": ["y"]}], {"merge_lists": True}),
                      ([D, {"pkg": 1}], {"strategy": "none"})],
    "slsutil.merge_all": [([[D, {"pkg": {"v": 2}}, {"svc": "t"}]], {}), ([[]], {})],
    "grains.filter_by": [([LOOKUP], {}), ([LOOKUP], {"grain": "os"}), ([LOOKUP], {"grain": "nope"}),
                         ([LOOKUP], {"grain": "nope", "default": "Debian"}), ([LOOKUP], {"base": "base"}),
                         ([LOOKUP], {"merge": {"pkg": {"extra": 1}}}), ([LOOKUP], {"merge": "x"}),
                         ([{"Red*": 1, "*": 2}], {}), ([{"web": "w", "db": "d"}], {"grain": "roles"}),
                         ([{"10.*": "net10"}], {"grain": "ip4"}), ([{"RedHat": "s"}], {"base": "RedHat"}),
                         ([{"RedHat": "s", "base": {"a": 1}}], {"base": "base"})],
    "pillar.filter_by": [([{"eu-*": "eu", "default": "other"}, "region"], {}), ([{"web": 1}], {"pillar": "roles"}),
                         ([{"x": 1, "default": 0}, "nope"], {}), ([{"8": "p8"}, "app:port"], {})],
    "pillar.get": [(["app:port"], {}), (["app:missing", "d"], {}), (["app:hosts:1"], {}), (["users:0:name"], {}),
                   (["users:5:name", "d"], {}), (["users:name"], {}), (["8080"], {}), (["app:tls:on"], {}), (["app"], {"default": {"x": 1, "port": 0}, "merge": True}),
                   (["app:hosts"], {"default": ["z", "a"], "merge": True}), (["app"], {"default": "x", "merge": True}),
                   (["app"], {"default": ["x"], "merge": True}), (["nope"], {}), (["app/tls/on"], {"delimiter": "/"}),
                   (["app"], {"default": {"tls": {"v": 1}}, "merge": True, "merge_nested_lists": True})],
    "pillar.fetch": [(["app:port"], {})],
    "pillar.item": [(["app:port", "nope"], {}), (["region"], {"default": "d"}), (["x:y"], {"default": "d"})],
    "grains.get": [(["os"], {}), (["roles:0"], {}), (["nope", "dflt"], {}), (["ip4"], {})],
    "grains.fetch": [(["os_family"], {})],
    "grains.item": [(["os", "nope"], {}), (["os"], {"default": "d"})],
    "config.get": [(["id"], {}), (["os"], {}), (["app:port"], {}), (["nested:k"], {}), (["nope", "d"], {}),
                   (["id"], {"omit_opts": True}), (["id"], {"omit_opts": True, "omit_grains": True}),
                   (["app/port"], {"delimiter": "/"}), (["region"], {"omit_pillar": True})],
    "config.option": [(["id"], {}), (["app"], {}), (["app:port"], {}), (["nope"], {}), (["nope"], {"default": "d"}),
                      (["os"], {"omit_grains": True}), (["id"], {"omit_all": True})],
}

logging.getLogger("salt").addHandler(logging.NullHandler())  # Salt's "Merge will be skipped" errors
logging.getLogger("salt").propagate = False
c = Checks()
r = renderer()
for version in ("3006", "3008"):
    for name, cases in CASES.items():
        for args, kwargs in cases:
            # Fresh data for each side: the merges change their arguments,
            # and a lookup may hand back (and a later case change) the data.
            fresh = lambda: copy.deepcopy((PILLAR, GRAINS, OPTS, args, kwargs))  # noqa: E731
            p1, g1, o1, a1, k1 = fresh()
            p2, g2, o2, a2, k2 = fresh()
            theirs = outcome(salt_modules(version, p1, g1, o1)[name], a1, k1)
            ours = outcome(preview_functions(r, p2, g2, o2)(name), a2, k2)
            c.eq(ours, theirs, f"Salt {version}: {name}{tuple(args)}{kwargs or ''}")
c.done()
