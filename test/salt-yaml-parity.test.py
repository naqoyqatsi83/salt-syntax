"""The preview's YAML loading against Salt's own loader (#74).

Salt reads pillar, import_yaml / load_yaml data and the rendered SLS with
SaltYamlSafeLoader (salt/utils/yamlloader.py), not standard YAML: leading
zeros aren't octal (`mode: 0755` is 755), timestamps stay strings, merge
keys are flattened its own way, a duplicate key is an error. Salt's loader
is executed from its source at the pinned 3006 and 3008 tags (fetched into
test/.cache) and must load every document here exactly as the preview's
salt_yaml_load does -- the same value, or an error with the same problem.
"""
import os
import sys
import types

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "helpers"))
from preview import Checks, renderer, salt_source  # noqa: E402

import yaml  # noqa: E402 - after the helper, which skips the test without it


def salt_loader(version):
    salt = types.ModuleType("salt")
    salt.utils = types.ModuleType("salt.utils")
    salt.utils.stringutils = types.SimpleNamespace(to_unicode=lambda v: v)
    sys.modules.update({"salt": salt, "salt.utils": salt.utils, "salt.utils.stringutils": salt.utils.stringutils})
    ns = {"__name__": "salt.utils.yamlloader"}
    exec(compile(salt_source(version, "salt/utils/yamlloader.py"), "yamlloader.py", "exec"), ns)
    return lambda text: yaml.load(text, Loader=ns["SaltYamlSafeLoader"])


def outcome(load, text):
    try:
        return ("ok", load(text))
    except yaml.YAMLError as exc:
        return ("raises", type(exc).__name__, getattr(exc, "problem", str(exc)))


DOCS = [
    # Integers with leading zeros: not octal.
    "mode: 0755", "mode: 755", "mode: '0755'", "a: 0", "a: 00", "a: 0000", "a: 007", "a: -0755", "a: +0755",
    "a: 0x1f", "a: 0b101", "a: 0o755", "a: 0755.5", "a: 01_0", "a: 1_000", "a: 0:30", "a: 190:20:30",
    "l: [0644, 0755, 8, 010]", "0644: key",
    # Timestamps stay strings.
    "d: 2024-01-01", "t: 2001-12-14t21:59:43.10-05:00", "t: 2001-12-14 21:59:43.10 -5",
    # Other scalars, as standard YAML.
    "a: yes", "a: off", "a: ~", "a: .inf", "a: 1e3", "a: !!str 0755", "a: !!int '0755'", "a: !!float 1",
    # Merge keys.
    "base: &b {x: 1, y: 2}\nm:\n  <<: *b\n  y: 3",
    "a: &a {x: 1}\nb: &b {x: 2, z: 2}\nm:\n  <<: [*a, *b]\n  w: 0",
    "a: &a {x: 1, y: 1}\nm:\n  y: 2\n  <<: *a",
    "m:\n  <<: 5", "m:\n  <<: [1]",
    # Duplicate and unhashable keys.
    "a: 1\na: 2", "s:\n  x: 1\n  x: 1", "? [1]\n: x",
    # Structure.
    "- a\n- {b: [1, {c: 0600}]}", "", "just text", "a: |\n  0755\n",
]

c = Checks()
r = renderer()
for version in ("3006", "3008"):
    salt = salt_loader(version)
    for doc in DOCS:
        c.eq(outcome(r.salt_yaml_load, doc), outcome(salt, doc), f"Salt {version}: {doc!r}")
c.done()
