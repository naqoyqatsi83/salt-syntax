"""The preview's Salt filters against Salt's own implementations (#23).

Extracts every @jinja_filter function (plus the module-level helpers and
constants they use) from Salt's source at the pinned 3006 and 3008 tags --
fetched into test/.cache -- runs it next to the preview's implementation on
the same inputs, and requires identical results (or the same exception
type). The few Salt internals those functions call are stood in for by the
real Salt function where it's self-contained, or a minimal equivalent.
"""
import ast
import collections
import collections.abc
import fnmatch
import io
import os
import re
import shlex
import sys
import types
import uuid
import warnings
from collections import OrderedDict

import yaml
from markupsafe import Markup

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "helpers"))
from preview import Checks, renderer, salt_source  # noqa: E402

MODULES = ["data", "dictupdate", "hashutils", "jinja", "path", "stringutils", "yamlencoding"]


class SaltException(Exception):
    pass


def load_salt_filters(version):
    """{filter name: Salt's function} for one version, executed from source."""
    salt = types.SimpleNamespace()
    salt.utils = types.SimpleNamespace()
    spaces, found = {}, {}
    for mod in MODULES:
        src = salt_source(version, f"salt/utils/{mod}.py")
        tree = ast.parse(src)
        ns = {"salt": salt, "re": re, "shlex": shlex, "uuid": uuid, "warnings": warnings, "io": io, "sys": sys, "os": os,
              "yaml": yaml, "Markup": Markup, "Hashable": collections.abc.Hashable, "OrderedDict": OrderedDict,
              "fnmatch": fnmatch, "collections": collections, "SaltException": SaltException,
              "SaltInvocationError": SaltException, "CaseInsensitiveDict": _CaseInsensitiveDict,
              "DEFAULT_TARGET_DELIM": ":", "__name__": f"salt.utils.{mod}",
              "__salt_system_encoding__": "utf-8", "base64": __import__("base64"), "hashlib": __import__("hashlib"),
              "hmac": __import__("hmac"), "posixpath": __import__("posixpath"), "binascii": __import__("binascii")}
        for node in tree.body:
            if isinstance(node, ast.Assign) and all(isinstance(t, ast.Name) and t.id.isupper() for t in node.targets):
                try:
                    exec(compile(ast.Module([node], []), mod, "exec"), ns)
                except Exception:  # noqa: BLE001 - constants that need more of Salt are skipped
                    pass
            if isinstance(node, ast.FunctionDef):
                # A function can carry several @jinja_filter names (to_num / str_to_num).
                names = [dec.args[0].value if dec.args else node.name for dec in node.decorator_list
                         if isinstance(dec, ast.Call) and getattr(dec.func, "id", "") == "jinja_filter"]
                node.decorator_list = []
                exec(compile(ast.Module([node], []), mod, "exec"), ns)
                for filter_name in names:
                    found[filter_name] = (mod, node.name)
        spaces[mod] = ns
        setattr(salt.utils, mod, types.SimpleNamespace(**{k: v for k, v in ns.items() if callable(v)}))
    salt.utils.platform = types.SimpleNamespace(is_windows=lambda: False)
    salt.utils.json = types.SimpleNamespace(dumps=__import__("json").dumps)
    salt.utils.args = types.SimpleNamespace(yamlify_arg=lambda v: yaml.safe_load(v) if isinstance(v, str) else v,
                                            clean_kwargs=lambda **kw: kw, invalid_kwargs=lambda kw: None)
    salt.utils.data.decode = lambda x, *a, **k: x
    # Some filters do `import salt.utils.args` inline.
    for name, mod in (("salt", salt), ("salt.utils", salt.utils), ("salt.utils.args", salt.utils.args)):
        sys.modules[name] = mod
    return {name: spaces[mod][fn] for name, (mod, fn) in found.items()}


class _CaseInsensitiveDict(dict):
    def __init__(self, data):
        super().__init__({str(k).lower(): v for k, v in data.items()})

    def get(self, key, default=None):
        return super().get(str(key).lower(), default)


def outcome(func, args, kwargs):
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            return ("ok", func(*args, **kwargs))
    except Exception as exc:  # noqa: BLE001
        # Salt's SaltException/SaltInvocationError and the preview's stand-in
        # count as the same: both abort the render as "Jinja error: ...".
        return ("raises", "SaltError" if type(exc).__name__ == "SaltException" else type(exc).__name__)


D = {"a": {"b": [{"c": 1}, {"d": 2}]}, "n": {1: "one"}}
CASES = {
    "skip": [(["x"], {})],
    "sequence": [(["x"], {}), ([["x"]], {}), ([{"a": 1}], {}), ([(1, 2)], {})],
    "to_bool": [([v], {}) for v in (None, True, "yes", "YES", "on", "1", "true", "no", 0, 5, -1, [], [0], {}, 1.5)],
    "indent": [(["a\nb\n\nc"], {}), (["a\nb"], {"width": 2, "first": True}), (["a\n\nb"], {"blank": True}), (["x"], {"indentfirst": True})],
    "tojson": [([{"a": "<&'>", "b": [1, 2]}], {}), ([{"x": 1}], {"indent": 2}), (["ünï"], {})],
    "quote": [(["it's here"], {}), (["plain"], {})],
    "regex_escape": [(["a.b*c"], {})],
    "regex_search": [(["abc123", r"\d+"], {}), (["abc", r"(b)(c)"], {}), (["abc", "x"], {}), (["ABC", "b"], {"ignorecase": True})],
    "regex_match": [(["abc123", r"\d+"], {}), (["abc123", r"(a)bc"], {})],
    "regex_replace": [(["a1b2", r"\d", "#"], {}), (["AbA", "a", "x"], {"ignorecase": True})],
    "uuid": [(["hello"], {})],
    "unique": [([[1, 2, 2, 3, 1]], {}), ([(1, 1, 2)], {}), (["aab"], {})],
    "min": [([[3, 1, 2]], {})], "max": [([[3, 1, 2]], {})], "avg": [([[1, 2, 4]], {}), ([5], {})],
    "union": [([[1, 2], [2, 3]], {}), ([(1, 2), (2, 3)], {})],
    "intersect": [([[1, 2, 3], [2, 3, 4]], {})], "difference": [([[1, 2, 3], [2]], {})],
    "symmetric_difference": [([[1, 2, 3], [2, 3, 4]], {}), ([(1, 2), (2, 3)], {})],
    "method_call": [(["a,b", "split", ","], {}), (["x", "nope"], {})],
    "compare_dicts": [([{"a": 1, "b": 2}, {"a": 1, "b": 3, "c": 4}], {})],
    "compare_lists": [([[1, 2], [2, 3]], {}), ([[1], [1]], {})],
    "exactly_n_true": [([[1, 1, 0]], {"amount": 2}), ([[1, 1, 1]], {"amount": 2})],
    "exactly_one_true": [([[0, 1, 0]], {}), ([[1, 1]], {})],
    "flatten": [([[1, [2, [3, None]], "null"]], {}), ([[1, [2, [3]]]], {"levels": 1}), ([[1, None]], {"preserve_nulls": True})],
    "is_iter": [([[1]], {}), (["s"], {}), ([5], {})], "is_list": [([[1]], {}), ([(1,)], {})],
    "sorted_ignorecase": [([["b", "A", "c"]], {})],
    "substring_in_list": [(["ab", ["xaby", "z"]], {}), (["q", ["x"]], {})],
    "traverse": [([D, "a:b:1:d"], {}), ([D, "a:b:c"], {}), ([D, "a:x"], {"default": "dflt"}), ([D, "n:1"], {}), ([[10, 20], "1"], {})],
    "set_dict_key_value": [([{}, "a:b:c", 1], {}), ([{"a": 1}, "a", 2], {})],
    "update_dict_key_value": [([{"a": {"b": {"x": 1}}}, "a:b", {"y": 2}], {}), ([{}, "a", {"y": 2}], {})],
    "append_dict_key_value": [([{"a": {"l": [1]}}, "a:l", 2], {}), ([{}, "a:l", 1], {})],
    "extend_dict_key_value": [([{"a": [1]}, "a", [2, 3]], {})],
    "to_num": [(["5"], {}), (["5.5"], {}), (["x"], {})], "str_to_num": [(["7"], {})],
    "is_hex": [(["ff"], {}), (["0x1A"], {}), (["zz"], {}), ([12], {})],
    "contains_whitespace": [(["a b"], {}), (["ab"], {})],
    "human_to_bytes": [(["2 KiB"], {}), (["1 KB"], {}), (["1 KB"], {"handle_metric": True}), (["5"], {}), (["x"], {}), (["3 foo"], {})],
    "to_camelcase": [(["snake_case_here"], {}), (["snake_case"], {"uppercamel": True})],
    "to_snake_case": [(["camelCaseHTTPServer"], {}), (["Simple"], {})],
    "check_whitelist_blacklist": [(["web01"], {"whitelist": ["web*"]}), (["db1"], {"blacklist": "db.*"}), (["x"], {})],
    "to_bytes": [(["abc"], {}), ([b"x"], {})],
    "base64_encode": [(["hello"], {})], "base64_decode": [(["aGVsbG8="], {})],
    "md5": [(["x"], {})], "sha1": [(["x"], {})], "sha256": [(["x"], {})], "sha512": [(["x"], {})],
    "hmac": [(["msg", "key", "bad"], {})], "hmac_compute": [(["msg", "key"], {})],
    "path_join": [(["/a", "b", "/c"], {}), (["a/./b", "../c"], {})],
    "yaml_dquote": [(['he said "hi" «x»'], {})], "yaml_squote": [(["it's"], {})],
    "yaml_encode": [(["text"], {}), ([5], {}), ([True], {}), ([None], {})],
    "to_entries": [([{"a": 1}], {}), ([["x"]], {}), (["nope"], {})],
    "from_entries": [([[{"key": "a", "value": 1}, {"Name": "b", "Value": 2}]], {})],
}

c = Checks()
r = renderer()
for version in ("3006", "3008"):
    salt = load_salt_filters(version)
    ours = r.salt_filters(version, None)
    env_only = set(r.ENVIRONMENT_FILTERS)
    c.eq(sorted(set(salt) - set(ours)), [], f"Salt {version}: every Salt filter is registered")
    for name, cases in CASES.items():
        if name not in salt:
            c.true(name not in ours, f"Salt {version} has no {name!r}, so the preview mustn't either")
            continue
        for args, kwargs in cases:
            fresh = lambda: __import__("copy").deepcopy((args, kwargs))  # noqa: E731 - dictupdate filters mutate
            a1, k1 = fresh()
            a2, k2 = fresh()
            c.eq(outcome(ours[name], a2, k2), outcome(salt[name], a1, k1), f"Salt {version}: {name}{tuple(args)}{kwargs or ''}")
    untested = sorted(set(salt) - set(CASES) - env_only - {"yaml", "json", "load_yaml", "load_json", "load_text"})
    c.eq(untested, [], f"Salt {version}: every pure filter has parity cases")
c.done()
