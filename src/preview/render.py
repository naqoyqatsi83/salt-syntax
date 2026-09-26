#!/usr/bin/env python3
"""Render a Salt template for the rendered preview (#23).

Reads one JSON request on stdin, writes one JSON result on stdout:

  request  {"source": str, "path": str, "roots": [str], "answers": {id: str}}
  result   {"rendered": str, "questions": [...], "warnings": [...],
            "error": {...} | null, "yamlErrors": [{...}], "context": {...}}

Real Jinja2 does the rendering, with Salt's Jinja environment emulated:
Salt's context variables (sls, tpldir, ...) derived from the file's path,
import_yaml / import_json / import_text / load_* tags, template imports
resolved against the file roots (salt:// and ./relative paths included),
Salt's common filters, and a mock `salt` / `grains` / `pillar` / `opts`.

Nothing Salt-side is executed. Every *external* value -- a grain, a pillar
key, a config/opts value, any other salt[...] call's result, an undefined
variable -- becomes a "question": answered from `answers` if the user gave
one (YAML text, so 8080 / true / [a, b] / {k: v} all work), else the
default written in the code if there is one, else a visible placeholder
like «grains:os». Pure-logic helpers (grains.filter_by, the merge
functions) are computed instead of asked.
"""
import io
import json
import os
import re
import shlex
import sys

try:
    from markupsafe import Markup  # what Jinja's own Markup is (jinja2.utils no longer re-exports it in 3.1)
    import jinja2
    import jinja2.sandbox
    import yaml
except ImportError as exc:  # pragma: no cover - reported to the user
    json.dump({"fatal": f"The rendered preview needs Python 3 with the '{exc.name}' package "
                        f"(pip install jinja2 pyyaml). Python used: {sys.executable}"}, sys.stdout)
    sys.exit(0)

MISSING = object()


class Placeholder(str):
    """Stand-in for a value nobody answered: renders as «kind:key», and
    indexing / attribute access on it yields further placeholders, so the
    template keeps rendering instead of failing on the first unknown."""

    def __getitem__(self, key):
        if isinstance(key, (int, slice)):
            return str.__getitem__(self, key)
        return Placeholder(f"{self[:-1]}:{key}»")

    def __getattr__(self, name):
        if name.startswith("_"):
            raise AttributeError(name)
        return Placeholder(f"{self[:-1]}.{name}»")


class Session:
    def __init__(self, answers):
        self.raw_answers = answers
        self.questions = {}  # id -> question, in first-asked order
        self.warnings = []
        self.strict_errors = []  # where Salt's StrictUndefined would fail the render

    def answer(self, qid):
        text = self.raw_answers.get(qid)
        if text is None or str(text).strip() == "":
            return MISSING
        try:
            return yaml.safe_load(text)
        except yaml.YAMLError:
            return str(text)

    def ask(self, kind, key, default=MISSING):
        qid = f"{kind}|{key}"
        value = self.answer(qid)
        if qid not in self.questions:
            self.questions[qid] = {
                "id": qid,
                "kind": kind,
                "key": key,
                "default": None if default is MISSING else dump_inline(default),
                "answered": value is not MISSING,
            }
        if value is not MISSING:
            return value
        if default is not MISSING:
            return default
        return Placeholder(f"«{kind}:{key}»")

    def resolve_nested(self, kind, key, delimiter=":"):
        """An answer for `key`, or one assembled from answers to its
        sub-keys (a:b, a:c -> {b: .., c: ..}), or found inside an answered
        parent key -- so users can answer at whatever level is handy."""
        exact = self.answer(f"{kind}|{key}")
        if exact is not MISSING:
            return exact
        prefix = f"{kind}|{key}{delimiter}"
        children = {k[len(prefix):]: k for k in self.raw_answers if k.startswith(prefix)}
        built = {}
        for sub, full in children.items():
            val = self.answer(full)
            if val is MISSING:
                continue
            node = built
            parts = sub.split(delimiter)
            for p in parts[:-1]:
                node = node.setdefault(p, {})
            node[parts[-1]] = val
        if built:
            return built
        parts = key.split(delimiter)
        for i in range(len(parts) - 1, 0, -1):
            parent = self.answer(f"{kind}|{delimiter.join(parts[:i])}")
            if parent is MISSING:
                continue
            node = parent
            for p in parts[i:]:
                if isinstance(node, dict) and p in node:
                    node = node[p]
                else:
                    return MISSING
            return node
        return MISSING

    def lookup(self, kind, key, default=MISSING, delimiter=":"):
        qid = f"{kind}|{key}"
        found = self.resolve_nested(kind, key, delimiter)
        if qid not in self.questions:
            self.questions[qid] = {
                "id": qid,
                "kind": kind,
                "key": key,
                "default": None if default is MISSING else dump_inline(default),
                "answered": found is not MISSING,
            }
        if found is not MISSING:
            return found
        if default is not MISSING:
            return default
        return Placeholder(f"«{kind}:{key}»")


def dump_inline(value):
    if isinstance(value, Placeholder):
        return str(value)
    try:
        text = yaml.safe_dump(value, default_flow_style=True, allow_unicode=True).strip()
    except yaml.YAMLError:
        return repr(value)
    return text[:-4].strip() if text.endswith("...") else text


def deep_merge(dest, upd, merge_lists=False):
    if not isinstance(dest, dict) or not isinstance(upd, dict):
        return upd
    out = dict(dest)
    for k, v in upd.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = deep_merge(out[k], v, merge_lists)
        elif merge_lists and isinstance(v, list) and isinstance(out.get(k), list):
            out[k] = out[k] + [x for x in v if x not in out[k]]
        else:
            out[k] = v
    return out


class Lookup:
    """grains / pillar / opts as the template sees them: dict-like, every
    read turned into a question."""

    def __init__(self, session, kind):
        self._s = session
        self._kind = kind

    def get(self, key, default=None, *args, **kwargs):
        return self._s.lookup(self._kind, str(key), default, kwargs.get("delimiter", ":"))

    def __getitem__(self, key):
        return self._s.lookup(self._kind, str(key))

    def __getattr__(self, name):
        if name.startswith("_"):
            raise AttributeError(name)
        return self._s.lookup(self._kind, name)

    def __contains__(self, key):
        return self._s.resolve_nested(self._kind, str(key)) is not MISSING

    def items(self):
        return dict(self._s.lookup(self._kind, "(all)", {})).items()

    def keys(self):
        return dict(self._s.lookup(self._kind, "(all)", {})).keys()

    def values(self):
        return dict(self._s.lookup(self._kind, "(all)", {})).values()

    def __iter__(self):
        return iter(self.keys())


class SaltFunctions:
    """The `salt` dunder: salt['mod.fn'](...) and salt.mod.fn(...)."""

    def __init__(self, session, lookups):
        self._s = session
        self._l = lookups

    def __getitem__(self, name):
        return self._function(str(name))

    def __getattr__(self, mod):
        if mod.startswith("_"):
            raise AttributeError(mod)
        return _SaltModule(self, mod)

    def __contains__(self, name):
        return True

    def _function(self, name):
        s, l = self._s, self._l
        builtin = {
            "pillar.get": lambda key, default="", merge=False, delimiter=":", **kw: s.lookup("pillar", key, default, delimiter),
            "pillar.fetch": lambda key, default="", **kw: s.lookup("pillar", key, default),
            "pillar.item": lambda *keys, **kw: {k: s.lookup("pillar", k) for k in keys},
            "pillar.items": lambda *a, **kw: dict(s.lookup("pillar", "(all)", {})),
            "grains.get": lambda key, default="", delimiter=":", **kw: s.lookup("grains", key, default, delimiter),
            "grains.item": lambda *keys, **kw: {k: s.lookup("grains", k) for k in keys},
            "grains.items": lambda *a, **kw: dict(s.lookup("grains", "(all)", {})),
            "grains.filter_by": self._filter_by,
            "config.get": lambda key, default="", **kw: s.lookup("config", key, default),
            "config.option": lambda key, default="", **kw: s.lookup("config", key, default),
            "slsutil.merge": lambda dest, upd, strategy="smart", merge_lists=False, **kw: deep_merge(dest, upd, merge_lists),
            "slsutil.update": lambda dest, upd, recursive_update=True, merge_lists=False: deep_merge(dest, upd, merge_lists),
            "defaults.merge": lambda dest, src, merge_lists=True, in_place=True, **kw: deep_merge(dest, src, merge_lists),
            "defaults.deep_merge": lambda tgt, src, merge_lists=False: deep_merge(tgt, src, merge_lists),
        }
        if name in builtin:
            return builtin[name]

        def call(*args, **kwargs):
            shown = [repr(a) for a in args] + [f"{k}={v!r}" for k, v in kwargs.items()]
            return s.ask("salt", f"{name}({', '.join(shown)})")

        return call

    def _filter_by(self, lookup_dict, grain="os_family", merge=None, default="default", base=None):
        value = self._s.lookup("grains", grain)
        ret = lookup_dict.get(value, lookup_dict.get(default)) if isinstance(lookup_dict, dict) else None
        if isinstance(base, dict):
            ret = deep_merge(base, ret or {})
        elif base is not None and isinstance(lookup_dict, dict) and base in lookup_dict:
            ret = deep_merge(lookup_dict[base], ret or {})
        if merge:
            ret = deep_merge(ret or {}, merge)
        return ret


class _SaltModule:
    def __init__(self, funcs, mod):
        self._f = funcs
        self._mod = mod

    def __getattr__(self, fn):
        if fn.startswith("_"):
            raise AttributeError(fn)
        return self._f._function(f"{self._mod}.{fn}")


# --- Salt's Jinja tags, rewritten into plain Jinja before compiling --------
# Line breaks are never added or removed, so line numbers stay true.
IMPORT_TAG = re.compile(r"\{%(-?)\s*import_(yaml|json|text)\s+(.+?)\s+as\s+(\w+)\s*(-?)%\}")
LOAD_OPEN = re.compile(r"\{%(-?)\s*load_(yaml|json|text)\s+as\s+(\w+)\s*(-?)%\}")
LOAD_CLOSE = re.compile(r"\{%(-?)\s*endload\s*(-?)%\}")


def preprocess(source):
    source = IMPORT_TAG.sub(lambda m: f"{{%{m[1]} set {m[4]} = __salt_import_{m[2]}({m[3]}) {m[5]}%}}", source)
    out, pos, stack = [], 0, []
    for m in re.finditer(f"{LOAD_OPEN.pattern}|{LOAD_CLOSE.pattern}", source):
        out.append(source[pos:m.start()])
        if m.group(3):  # opening load_* tag
            stack.append((m.group(2), m.group(3)))
            out.append(f"{{%{m.group(1)} set {m.group(3)} {m.group(4)}%}}")
        elif stack:
            kind, name = stack.pop()
            out.append(f"{{%{m.group(5)} endset %}}{{% set {name} = {name}|load_{kind} {m.group(6)}%}}")
        else:
            out.append(m.group(0))
        pos = m.end()
    out.append(source[pos:])
    return "".join(out)


class SaltSafeLoader(yaml.SafeLoader):
    """Parses the rendered output the way Salt's own loader does
    (salt/utils/yamlloader.py, SaltYamlSafeLoader.construct_mapping): after
    flattening merge keys, a key appearing twice in the same mapping -- at
    any level, e.g. two states rendered with the same ID -- is an error.
    Plain yaml.safe_load silently keeps the last one, so without this the
    preview would call "fine" a file Salt refuses to run.

    Salt stops at the first conflict; this records every one (in
    `conflicts`) so the preview can point at all of them at once. The
    message is still Salt's own."""

    def __init__(self, stream):
        super().__init__(stream)
        self.conflicts = []

    def construct_mapping(self, node, deep=False):
        if not isinstance(node, yaml.MappingNode):
            return super().construct_mapping(node, deep)
        self.flatten_mapping(node)
        mapping = {}
        first_seen = {}
        for key_node, value_node in node.value:
            key = self.construct_object(key_node, deep=deep)
            try:
                hash(key)
            except TypeError:
                raise yaml.constructor.ConstructorError(
                    "while constructing a mapping", node.start_mark,
                    f"found unacceptable key {key_node.value}", key_node.start_mark)
            value = self.construct_object(value_node, deep=deep)
            if key in mapping:
                self.conflicts.append({
                    "message": f"found conflicting ID '{key}'",
                    "line": key_node.start_mark.line + 1,
                    "firstLine": first_seen[key] + 1,
                })
                continue
            mapping[key] = value
            first_seen[key] = key_node.start_mark.line
        return mapping


def _load_conflicts(text):
    loader = SaltSafeLoader(text)
    try:
        loader.get_single_data()
    finally:
        loader.dispose()
    return loader.conflicts


def _syntax_problem(exc):
    """A YAML syntax error, placed where the broken construct *starts*.
    For "while scanning ..." errors PyYAML's problem mark is only where it
    gave up (e.g. the next key after a stray bare line), while the context
    mark is the line actually at fault -- so that's the one reported, with
    the give-up line alongside."""
    pm, cm = exc.problem_mark, exc.context_mark
    if cm is not None and exc.context and exc.context.startswith("while scanning"):
        line, gave_up = cm.line + 1, (pm.line + 1 if pm else None)
    else:
        mark = pm or cm
        line, gave_up = (mark.line + 1 if mark else None), None
    message = f"{exc.context}, {exc.problem}" if exc.context and exc.problem else str(exc.problem or exc)
    return {"message": message, "line": line, "gaveUpLine": gave_up if gave_up != line else None}


def custom_state_modules(roots):
    """State modules a formula ships itself: `<root>/_states/*.py`, by file
    name and by any __virtualname__ -- Salt syncs these to minions, so the
    core module list doesn't cover them."""
    names = set()
    for root in roots:
        folder = os.path.join(root, "_states")
        if not os.path.isdir(folder):
            continue
        for entry in os.listdir(folder):
            if not entry.endswith(".py") or entry.startswith("_"):
                continue
            names.add(entry[:-3])
            try:
                with open(os.path.join(folder, entry), encoding="utf-8", errors="replace") as fh:
                    m = re.search(r"""^__virtualname__\s*=\s*['"]([\w]+)['"]""", fh.read(), re.M)
                if m:
                    names.add(m.group(1))
            except OSError:
                pass
    return names


def _sls_available(roots, pattern, limit=5000):
    """Whether an SLS name (fnmatch pattern, like Salt's include matching)
    exists under the roots, as <name>.sls or <name>/init.sls. Literal names
    are checked directly; globs walk only the directory their literal
    prefix names, and at most `limit` files -- the fallback root can be a
    home directory."""
    import fnmatch
    if not re.search(r"[*?\[]", pattern):
        rel = pattern.replace(".", os.sep)
        return any(os.path.isfile(os.path.join(root, rel + ".sls")) or
                   os.path.isfile(os.path.join(root, rel, "init.sls")) for root in roots)
    prefix = re.split(r"[*?\[]", pattern, 1)[0].rsplit(".", 1)[0] if "." in pattern.split("*")[0] else ""
    seen = 0
    for root in roots:
        base = os.path.join(root, prefix.replace(".", os.sep)) if prefix else root
        for dirpath, _dirs, files in os.walk(base):
            for f in files:
                seen += 1
                if seen > limit:
                    return True  # too big to tell -- don't cry wolf
                if not f.endswith(".sls"):
                    continue
                rel = os.path.relpath(os.path.join(dirpath, f), root)[:-4].replace(os.sep, ".")
                if rel.endswith(".init"):
                    rel = rel[: -len(".init")]
                if fnmatch.fnmatch(rel, pattern):
                    return True
    return False


def include_problems(text, roots, sls, rel_file, saltenv="base"):
    """render_state()'s include handling (identical in 3006 and 3008):
    resolve each `include:` entry -- relative ones (`.foo`) against this
    SLS, globs with fnmatch -- and flag those not available under the file
    roots, with Salt's messages. Entries for another saltenv
    (`- otherenv: foo`) can't be seen from here and are skipped."""
    try:
        root = yaml.compose(text, Loader=yaml.SafeLoader)
    except yaml.YAMLError:
        return []
    if not isinstance(root, yaml.MappingNode) or not roots:
        return []
    found = []
    for key, value in root.value:
        if not (isinstance(key, yaml.ScalarNode) and key.value == "include" and isinstance(value, yaml.SequenceNode)):
            continue
        for item in value.value:
            if isinstance(item, yaml.MappingNode):
                if len(item.value) != 1 or item.value[0][0].value != saltenv:
                    continue
                node = item.value[0][1]
            else:
                node = item
            if not (isinstance(node, yaml.ScalarNode) and node.value):
                continue
            inc = node.value
            if inc.startswith("."):
                m = re.match(r"^(\.+)(.*)$", inc)
                levels, rest = m.groups()
                comps = sls.split(".")
                if rel_file.endswith("/init.sls") or rel_file == "init.sls":
                    comps.append("init")
                if len(levels) > len(comps):
                    found.append({"message": f"Attempted relative include of '{inc}' within SLS '{saltenv}:{sls}' goes "
                                             "beyond top level package", "line": node.start_mark.line + 1, "reject": True})
                    continue
                inc = ".".join(comps[: -len(levels)] + [rest])
            if not _sls_available(roots, inc):
                found.append({"message": f"Unknown include: Specified SLS {saltenv}: {inc} is not available on the salt "
                                         f"master in saltenv(s): {saltenv}", "line": node.start_mark.line + 1, "reject": True})
    return found


# --- Requisites and extend: pointing at states that exist ------------------
# A requisite's target must be a state in the same run; this can only see the
# file and what it includes, so a miss is *suspicious* -- in a highstate,
# another SLS from top.sls could define it.

# Requisites whose target Salt looks up (3006: the "requisites were not
# found" check in State.check_requisite; 3008: RequisiteGraph.add_requisites).
REFERENCE_REQUISITES = {
    "3006": ("require", "watch", "prereq", "onfail", "onchanges", "require_any", "watch_any", "onfail_any",
             "onchanges_any", "prerequired"),
    "3008": ("require", "require_any", "watch", "watch_any", "prereq", "onfail", "onfail_any", "onfail_all",
             "onchanges", "onchanges_any"),
}


def _is_glob(value):
    return any(ch in value for ch in "*?[")


def _resolve_includes(root_node, sls, rel_file, roots):
    """(sls name, path) for every include of this rendered SLS that exists
    under the roots (globs expanded) -- the same resolution include_problems()
    checks; entries for another saltenv are skipped."""
    import fnmatch
    found = []
    for key, value in root_node.value:
        if not (isinstance(key, yaml.ScalarNode) and key.value == "include" and isinstance(value, yaml.SequenceNode)):
            continue
        for item in value.value:
            node = item.value[0][1] if isinstance(item, yaml.MappingNode) and len(item.value) == 1 and item.value[0][0].value == "base" else item
            if not (isinstance(node, yaml.ScalarNode) and node.value):
                continue
            inc = node.value
            if inc.startswith("."):
                m = re.match(r"^(\.+)(.*)$", inc)
                comps = sls.split(".") + (["init"] if rel_file.endswith("init.sls") else [])
                if len(m.group(1)) > len(comps):
                    continue
                inc = ".".join(comps[: -len(m.group(1))] + [m.group(2)])
            for root in roots:
                if _is_glob(inc):
                    for dirpath, _dirs, files in os.walk(root):
                        for f in files:
                            if f.endswith(".sls"):
                                rel = os.path.relpath(os.path.join(dirpath, f), root)[:-4].replace(os.sep, ".")
                                name = rel[: -len(".init")] if rel.endswith(".init") else rel
                                if fnmatch.fnmatch(name, inc):
                                    found.append((name, os.path.join(dirpath, f)))
                    continue
                for cand in (inc.replace(".", os.sep) + ".sls", os.path.join(inc.replace(".", os.sep), "init.sls")):
                    if os.path.isfile(os.path.join(root, cand)):
                        found.append((inc, os.path.join(root, cand)))
                        break
    return found


def _states_of(root_node):
    """What a rendered SLS defines: {ids}, {(module, id or name)}."""
    ids, pairs = set(), set()
    for id_node, body in root_node.value:
        if not isinstance(id_node, yaml.ScalarNode) or id_node.value in SLS_SPECIAL_KEYS:
            continue
        sid = id_node.value
        ids.add(sid)
        if isinstance(body, yaml.ScalarNode) and "." in body.value:
            pairs.add((body.value.split(".", 1)[0], sid))
            continue
        if not isinstance(body, yaml.MappingNode):
            continue
        for key, args in body.value:
            if not isinstance(key, yaml.ScalarNode) or key.value.startswith("__"):
                continue
            module = key.value.split(".", 1)[0]
            pairs.add((module, sid))
            for arg in args.value if isinstance(args, yaml.SequenceNode) else []:
                if not isinstance(arg, yaml.MappingNode):
                    continue
                for k, v in arg.value:
                    if k.value == "name" and isinstance(v, yaml.ScalarNode):
                        pairs.add((module, v.value))
                    if k.value == "names" and isinstance(v, yaml.SequenceNode):
                        for n in v.value:
                            name = n.value if isinstance(n, yaml.ScalarNode) else n.value[0][0].value if isinstance(n, yaml.MappingNode) and n.value else None
                            if name is not None:
                                pairs.add((module, str(name)))
    return ids, pairs


def reference_problems(text, version, sls, roots, rel_file, render_included, limit=50):
    """Requisite targets and extended IDs that no state in this file or the
    files it includes (transitively, rendered via `render_included(path, sls)`)
    defines. Skipped entirely when an included file can't be rendered --
    its states would be unknown."""
    import fnmatch
    try:
        root = yaml.compose(text, Loader=yaml.SafeLoader)
    except yaml.YAMLError:
        return []
    if not isinstance(root, yaml.MappingNode):
        return []
    ids, pairs = _states_of(root)
    known_sls, seen_paths = {sls}, set()
    queue = _resolve_includes(root, sls, rel_file, roots)
    included_ids, included_pairs = set(), set()
    while queue:
        name, path = queue.pop(0)
        if path in seen_paths:
            continue
        seen_paths.add(path)
        if len(seen_paths) > limit:
            return []
        known_sls.add(name)
        rendered = render_included(path, name)
        try:
            node = yaml.compose(rendered, Loader=yaml.SafeLoader) if rendered is not None else None
        except yaml.YAMLError:
            node = None
        if rendered is None or (node is not None and not isinstance(node, yaml.MappingNode)):
            return []
        if node is None:
            continue
        i, p = _states_of(node)
        included_ids |= i
        included_pairs |= p
        rel = next((os.path.relpath(path, r) for r in roots if not os.path.relpath(path, r).startswith("..")), path)
        queue.extend(_resolve_includes(node, name, rel.replace(os.sep, "/"), roots))
    all_ids, all_pairs = ids | included_ids, pairs | included_pairs
    hint = (" -- no state in this file or the files it includes defines it; fine only if another SLS in the same "
            "run (e.g. from top.sls) does")
    found = []
    for id_node, body in root.value:
        if not isinstance(id_node, yaml.ScalarNode):
            continue
        if id_node.value == "extend" and isinstance(body, yaml.MappingNode):
            for ext_id, ext_body in body.value:
                module = next((k.value.split(".", 1)[0] for k, _v in ext_body.value if isinstance(k, yaml.ScalarNode) and not k.value.startswith("__")), None) if isinstance(ext_body, yaml.MappingNode) else None
                if ext_id.value not in included_ids and (module is None or (module, ext_id.value) not in included_pairs):
                    found.append({"message": f"Cannot extend ID '{ext_id.value}' in 'base:{sls}'. It is not part of the high state." + hint,
                                  "line": ext_id.start_mark.line + 1, "reject": False})
            continue
        if id_node.value in SLS_SPECIAL_KEYS or not isinstance(body, yaml.MappingNode):
            continue
        for _key, args in body.value:
            for arg in args.value if isinstance(args, yaml.SequenceNode) else []:
                if not (isinstance(arg, yaml.MappingNode) and len(arg.value) == 1):
                    continue
                rtype, targets = arg.value[0][0].value, arg.value[0][1]
                if rtype not in REFERENCE_REQUISITES[version] or not isinstance(targets, yaml.SequenceNode):
                    continue
                for target in targets.value:
                    if isinstance(target, yaml.ScalarNode):
                        key, val = "id", target.value
                    elif isinstance(target, yaml.MappingNode) and len(target.value) == 1 and isinstance(target.value[0][1], yaml.ScalarNode):
                        key, val = target.value[0][0].value, target.value[0][1].value
                    else:
                        continue  # malformed: the compiler checks report it
                    if key == "sls":
                        ok = _is_glob(val) or val in known_sls
                    elif key == "id":
                        ok = any(fnmatch.fnmatch(i, val) for i in all_ids) if _is_glob(val) else val in all_ids
                    else:
                        ok = any(m == key and fnmatch.fnmatch(n, val) for m, n in all_pairs) if _is_glob(val) else (key, val) in all_pairs
                    if ok:
                        continue
                    state_name = id_node.value
                    message = (f"The following requisites were not found: {rtype}: {key}: {val}" if version == "3006" else
                               f"Referenced state does not exist for requisite [{rtype}: ({key}: {val})] in state "
                               f"[{state_name}] in SLS [{sls}]")
                    found.append({"message": message + hint, "line": target.start_mark.line + 1, "reject": False})
    return found


def check_rendered_yaml(text, version="3008", sls="", state_data=None, roots=(), rel_file="", render_included=None):
    """Every reason Salt's YAML loading would reject `text`, in line order:
    syntax errors and every conflicting ID. Salt stops at the first; here a
    syntax error's line is blanked (line numbers kept) and the text checked
    again, a few times over, so one broken line doesn't hide the problems
    after it. The blanking only ever affects this check, never the preview."""
    lines = text.splitlines(True)
    problems, blanked, conflicts = [], set(), []
    for _ in range(10):
        try:
            conflicts = _load_conflicts("".join(lines))
            break
        except yaml.MarkedYAMLError as exc:
            syntax = _syntax_problem(exc)
            problems.append(syntax)
            line = syntax["line"]
            if not line or line in blanked or line > len(lines):
                break
            blanked.add(line)
            lines[line - 1] = "\n"
        except yaml.YAMLError as exc:
            problems.append({"message": str(exc), "line": None})
            break
    problems.extend(conflicts)
    checked = "".join(lines)
    problems.extend(compiler_problems(checked, version, sls, state_data, frozenset(custom_state_modules(roots))))
    problems.extend(include_problems(checked, roots, sls, rel_file))
    if render_included is not None:
        problems.extend(reference_problems(checked, version, sls, roots, rel_file, render_included))
    return sorted(problems, key=lambda p: (p["line"] is None, p["line"] or 0))


# --- Salt's state compiler checks ----------------------------------------
# Ported from Salt's own _handle_state_decls() (identical in 3006.27 and
# 3008.2) and verify_high() (3006.27: State.verify_high; 3008.2:
# _verify_high), in that order, run on the rendered
# YAML's node tree so each problem can be pinned to its line. The messages
# are Salt's own, for the selected saltSyntax.saltVersion line.

# Top-level SLS keys Salt handles before verify_high -- not state IDs.
SLS_SPECIAL_KEYS = {"include", "exclude", "extend"}

# Requisite keywords whose value verify_high checks: 3006 only knows these
# four; 3008 checks every RequisiteType (salt/utils/requisite.py) plus
# onfail_stop (STATE_REQUISITE_KEYWORDS).
REQUISITES = {
    "3006": {"require", "watch", "prereq", "onchanges"},
    "3008": {"onfail", "onfail_any", "onfail_all", "require", "require_any", "onchanges",
             "onchanges_any", "watch", "watch_any", "prereq", "prerequired", "listen", "onfail_stop"},
}


def _is_empty(node):
    # Nothing at all after the colon -- as opposed to an explicit null / ~,
    # which is somebody's deliberate choice.
    return isinstance(node, yaml.ScalarNode) and node.tag == "tag:yaml.org,2002:null" and node.value == ""


def compiler_problems(text, version, sls, state_data=None, custom_modules=frozenset()):
    """What Salt's state compiler would reject in the rendered data, what
    would fail a state when it runs (unknown function, missing required
    parameter -- with `state_data` = the selected version's
    {functions: {mod: [fn]}, mandatory: {"mod.fn": [param]}}), plus things
    it accepts but are almost certainly mistakes (an argument rendered
    empty, a module core Salt doesn't have). Each: {message, line, reject,
    lead?}."""
    try:
        root = yaml.compose(text, Loader=yaml.SafeLoader)
    except yaml.YAMLError:
        return []
    if not isinstance(root, yaml.MappingNode):
        return []
    v3006 = version == "3006"
    requisites = REQUISITES["3006" if v3006 else "3008"]
    value_of = yaml.SafeLoader("")  # to turn nodes into the Python values Salt sees
    py = lambda node: value_of.construct_object(node, deep=True)  # noqa: E731
    found = []

    def reject(node, message):
        found.append({"message": message, "line": node.start_mark.line + 1, "reject": True})

    functions = (state_data or {}).get("functions") or {}
    mandatory = (state_data or {}).get("mandatory") or {}

    def check_call(mod, fn, node, given, args_known):
        """State.verify_data() (identical in 3006 and 3008) when the state
        runs: the function must exist, and every parameter without a
        default must be in the state's data -- `name` always is, it
        defaults to the ID. Skipped for a formula's custom _states module
        (it may define or override anything)."""
        if not functions or mod in custom_modules:
            return
        full = f"{mod}.{fn}"
        if mod not in functions:
            found.append({
                "message": f"'{mod}' isn't a state module in Salt {version} -- Salt fails the state (\"State '{full}' "
                           f"was not found in SLS '{sls}'\") unless a salt-extension package or a custom _states "
                           "module on the minion provides it",
                "line": node.start_mark.line + 1,
                "reject": False,
            })
            return
        if fn not in functions[mod]:
            found.append({"message": f"State '{full}' was not found in SLS '{sls}'",
                          "line": node.start_mark.line + 1, "reject": True, "lead": "state"})
            return
        if args_known:
            for param in mandatory.get(full, []):
                if param not in given:
                    found.append({"message": f"Missing parameter {param} for state {full}",
                                  "line": node.start_mark.line + 1, "reject": True, "lead": "state"})

    for id_node, body in root.value:
        id_ = py(id_node)
        if isinstance(id_, str) and (id_ in SLS_SPECIAL_KEYS or id_.startswith("__")):
            continue
        if not isinstance(id_, str):
            kind = type(id_).__name__
            reject(id_node, f"ID '{id_}' in SLS '{sls}' is not formed as a string, but is a {kind}. It may need to be quoted"
                   if v3006 else
                   f"ID '{id_}' in SLS '{sls}' is not formed as a string, but is type {kind}. It may need to be quoted.")
        # _handle_state_decls() (identical in 3006 and 3008) runs first: the
        # short form `id: mod.fn` becomes {mod: [fn]}; any other non-mapping
        # body is an error; `mod.fn: [args]` becomes `mod: [args..., fn]`,
        # and a second `mod.other:` for the same module is an error.
        if isinstance(body, yaml.ScalarNode) and body.tag == "tag:yaml.org,2002:str" and "." in body.value:
            mod, fn = body.value.split(".", 1)
            check_call(mod, fn, body, {"name"}, True)
            continue
        if not isinstance(body, yaml.MappingNode):
            message = f"ID {id_} in SLS {sls} is not a dictionary"
            if _is_empty(body):
                message += " -- nothing rendered under this ID (a variable, loop or if that produced no body?)"
            reject(id_node, message)
            continue
        entries, seen_mods = [], set()
        for key_node, value in body.value:
            state = py(key_node)
            if not isinstance(state, str):
                continue
            fn = None
            if not state.startswith("_") and isinstance(value, yaml.SequenceNode):
                if "." in state:
                    mod, fn = state.split(".", 1)
                    if mod in seen_mods:
                        reject(key_node, f"ID '{id_}' in SLS '{sls}' contains multiple state declarations of the same type")
                        continue
                    seen_mods.add(mod)
                    state = mod
                else:
                    seen_mods.add(state)
            entries.append((state, key_node, value, fn))
        for state, key_node, value, padded_fn in entries:
            if state.startswith("__"):
                continue
            if _is_empty(value) and not v3006:
                reject(key_node, f"ID '{id_}' in SLS '{sls}' contains a short declaration ({state}) with a trailing "
                                 "colon. When not passing any arguments to a state, the colon must be omitted.")
                continue
            if not isinstance(value, yaml.SequenceNode):
                message = f"State '{id_}' in SLS '{sls}' is not formed as a list"
                if _is_empty(value):
                    message += f" -- '{state}:' has a trailing colon with nothing after it (write '{state}' or '{state}: []')"
                reject(key_node, message)
                continue
            funs = 1 if "." in state else 0
            fun_names = [state.split(".", 1)[1]] if "." in state else []
            fun_nodes = [key_node] if "." in state else []
            given = {"name"}  # compile_high_data() starts every state's data with its ID as `name`
            args_known = True
            for arg in value.value:
                arg_value = py(arg)
                if isinstance(arg_value, str):
                    funs += 1
                    fun_names.append(arg_value)
                    fun_nodes.append(arg)
                    if " " in arg_value.strip():
                        reject(arg, f'The function "{arg_value}" in state "{id_}" in SLS "{sls}" has whitespace, a '
                                    'function with whitespace is not supported, perhaps this is an argument that is '
                                    'missing a ":"')
                    continue
                if not isinstance(arg, yaml.MappingNode) or not arg.value:
                    continue
                argfirst = py(arg.value[0][0])
                arg_val_node = arg.value[0][1]
                given.update(str(py(k)) for k, _v in arg.value)
                # `names:` entries can carry their own arguments ({name: [{arg: v}]});
                # don't guess at what each expanded state ends up with.
                if argfirst == "names" and isinstance(arg_val_node, yaml.SequenceNode) and any(
                        isinstance(n, yaml.MappingNode) for n in arg_val_node.value):
                    args_known = False
                if not v3006 and argfirst == "names" and not isinstance(arg_val_node, yaml.SequenceNode):
                    reject(arg, f"The 'names' argument in state '{id_}' in SLS '{sls}' needs to be formed as a list")
                if argfirst in requisites:
                    if not isinstance(arg_val_node, yaml.SequenceNode):
                        reject(arg, f"The {argfirst} statement in state '{id_}' in SLS '{sls}' needs to be formed as a list")
                    else:
                        for req in arg_val_node.value:
                            req_value = py(req)
                            if isinstance(req_value, str):
                                continue  # a bare ID
                            if not isinstance(req_value, dict) or (not v3006 and len(req_value) != 1):
                                reject(req, f"Requisite declaration {req_value} in SLS {sls} is not formed as a single key dictionary"
                                       if v3006 else
                                       f"Requisite declaration {req_value} in state {id_} in SLS {sls} is not formed as a single key dictionary")
                                continue
                            req_key, req_val = next(iter(req_value.items()))
                            if "." in str(req_key):
                                reject(req, f"Invalid requisite type '{req_key}' in state '{id_}', in SLS '{sls}'. Requisite "
                                            f"types must not contain dots, did you mean '{str(req_key)[: str(req_key).find('.')]}'?")
                            try:
                                hash(req_val)
                            except TypeError:
                                reject(req, f'Illegal requisite "{req_val}", is SLS {sls}' if v3006 else
                                            f'Illegal requisite "{req_val}" in SLS "{sls}", please check your syntax.')
                    if len(arg.value) != 1:
                        reject(arg, f"Multiple dictionaries defined in argument of state '{id_}' in SLS '{sls}'")
                # Not a Salt error, but almost always a variable that rendered
                # empty: Salt runs the state with this argument as None.
                for k, v in arg.value:
                    if _is_empty(v) and py(k) not in requisites:
                        found.append({
                            "message": f"'{py(k)}' has no value -- it rendered empty (a variable that came out empty?); "
                                       "Salt would pass it as None",
                            "line": k.start_mark.line + 1,
                            "reject": False,
                        })
            # The function from `mod.fn:` was appended after the list's items.
            if padded_fn is not None:
                funs += 1
                fun_names.append(padded_fn)
                fun_nodes.append(key_node)
            if funs == 1 and "." not in state:
                check_call(state, str(fun_names[0]), fun_nodes[0], given, args_known)
            if not funs:
                if v3006 and state in ("require", "watch"):
                    continue
                reject(key_node, f"No function declared in state '{id_}' in SLS '{sls}'")
            elif funs > 1:
                reject(key_node, f"Too many functions declared in state '{id_}' in SLS '{sls}'. Please choose one of "
                                 "the following: " + ", ".join(str(f) for f in fun_names))
    return found


class SaltLoader(jinja2.BaseLoader):
    def __init__(self, roots, overrides):
        self.roots = roots
        self.overrides = overrides  # template name -> unsaved editor text

    def get_source(self, environment, template):
        name = template[len("salt://"):] if template.startswith("salt://") else template
        name = name.lstrip("/")
        if name in self.overrides:
            return preprocess(self.overrides[name]), name, lambda: False
        for root in self.roots:
            path = os.path.join(root, name)
            if os.path.isfile(path):
                with open(path, encoding="utf-8") as fh:
                    return preprocess(fh.read()), path, lambda: False
        raise jinja2.TemplateNotFound(f"{name} (looked in: {', '.join(self.roots)})")


class SaltEnvironment(jinja2.sandbox.SandboxedEnvironment):
    # Salt renders SLS in Jinja's sandbox (salt/utils/templates.py, both
    # 3006 and 3008), so unsafe attribute access (`''.__class__`, ...)
    # fails there with a SecurityError -- and does here too.
    def join_path(self, template, parent):
        # Salt supports imports relative to the importing template.
        if template.startswith(("./", "../")):
            return os.path.normpath(os.path.join(os.path.dirname(parent), template)).replace(os.sep, "/")
        return template


# --- Salt's Jinja filters ---------------------------------------------------
# Salt registers 92 filters in 3008.2 (90 in 3006.27: no to_entries /
# from_entries), from salt/utils/{data,dateutils,dictupdate,files,hashutils,
# http,jinja,network,path,stringutils,user,yamlencoding}.py plus its
# SerializerExtension -- with identical signatures in both versions. The
# pure ones are implemented here to behave exactly like Salt's (checked
# against Salt's own code by test/salt-filter-parity.test.py); the ones
# whose result depends on the minion or the moment -- DNS, HTTP, files,
# users, randomness, the current time, and the networking helpers' many
# option modes -- are asked for in the panel instead, like salt[...] calls.

ENVIRONMENT_FILTERS = [
    "dns_check", "http_query", "which", "file_hashsum", "get_uid", "list_files", "is_bin_file", "is_text_file",
    "is_empty", "random_hash", "rand_str", "random_str", "random_sample", "random_shuffle", "gen_mac", "strftime",
    "date_format", "ipaddr", "ipv4", "ipv6", "ip_host", "is_ip", "is_ipv4", "is_ipv6", "ipwrap", "network_hosts",
    "network_size", "filter_by_networks", "mac_str_to_bytes", "json_query", "mysql_to_dict", "json_encode_dict",
    "json_encode_list", "json_decode_dict", "json_decode_list",
]
SALT_UUID_NAMESPACE = "91633EBF-1C86-5E33-935A-28061F4B480E"  # salt/utils/jinja.py GLOBAL_UUID


def _hashable(x):
    try:
        hash(x)
        return True
    except TypeError:
        return False


def _unique(values):
    if _hashable(values):
        return set(values)
    out = []
    for v in values:
        if v not in out:
            out.append(v)
    return out


def _is_iter(thing, ignore=(str,)):
    if ignore and isinstance(thing, ignore):
        return False
    try:
        iter(thing)
        return True
    except TypeError:
        return False


def _flatten(data, levels=None, preserve_nulls=False, _ids=None):
    _ids = set() if _ids is None else _ids
    if id(data) in _ids:
        raise RecursionError("Reference cycle detected. Check input list.")
    _ids.add(id(data))
    out = []
    for el in data:
        if not preserve_nulls and el in (None, "None", "null"):
            continue
        if _is_iter(el):
            if levels is None:
                out.extend(_flatten(el, preserve_nulls=preserve_nulls, _ids=_ids))
            elif levels >= 1:
                out.extend(_flatten(el, levels=int(levels) - 1, preserve_nulls=preserve_nulls, _ids=_ids))
            else:
                out.append(el)
        else:
            out.append(el)
    return out


def _traverse(data, key, default=None, delimiter=":"):
    ptr = data
    if isinstance(key, str):
        key = key.split(delimiter)
    if isinstance(key, int):
        key = [key]
    for each in key:
        if isinstance(ptr, list):
            try:
                idx = int(each)
            except ValueError:
                found = next((d[each] for d in ptr if isinstance(d, dict) and each in d), MISSING)
            else:
                found = next((d[idx] for d in ptr if isinstance(d, dict) and idx in d), MISSING)
                if found is MISSING:
                    try:
                        found = ptr[idx]
                    except IndexError:
                        return default
            if found is MISSING:
                return default
            ptr = found
        else:
            try:
                ptr = ptr[each]
            except KeyError:
                try:  # salt.utils.args.yamlify_arg: "1" can reach an int key
                    loaded = yaml.safe_load(each) if isinstance(each, str) else each
                except yaml.YAMLError:
                    return default
                if loaded == each:
                    return default
                try:
                    ptr = ptr[loaded]
                except (KeyError, TypeError):
                    return default
            except TypeError:
                return default
    return ptr


def _dict_path(in_dict, keys, delimiter):
    """dictupdate._dict_rpartition(): the dict holding the last key (creating
    the ones on the way), and that key."""
    if delimiter not in keys:
        return in_dict, keys
    head, _, last = keys.rpartition(delimiter)
    ptr = in_dict
    for k in head.split(delimiter):
        ptr = ptr.setdefault(k, {})
    return ptr, last


def _set_dict_key_value(in_dict, keys, value, delimiter=":", ordered_dict=False):
    ptr, last = _dict_path(in_dict, keys, delimiter)
    ptr[last] = value
    return in_dict


def _grow_dict_key_value(method, empty):
    def grow(in_dict, keys, value, delimiter=":", ordered_dict=False):
        ptr, last = _dict_path(in_dict, keys, delimiter)
        if last not in ptr or ptr[last] is None:
            ptr[last] = empty()
        getattr(ptr[last], method)(value)
        return in_dict
    return grow


def _to_bool(val):
    if val is None:
        return False
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.lower() in ("yes", "1", "true")
    if isinstance(val, int):
        return val > 0
    if not _hashable(val):
        return len(val) > 0
    return False


def _indent(s, width=4, first=False, blank=False, indentfirst=None):
    if indentfirst is not None:
        first = indentfirst
    pad, nl = " " * width, "\n"
    if isinstance(s, Markup):
        pad, nl = Markup(pad), Markup(nl)
    s += nl
    if blank:
        rv = (nl + pad).join(s.splitlines())
    else:
        lines = s.splitlines()
        rv = lines.pop(0)
        if lines:
            rv += nl + nl.join(pad + line if line else line for line in lines)
    return pad + rv if first else rv


def _regex(func, version):
    def run(txt, rgx, ignorecase=False, multiline=False):
        m = func(rgx, txt, (re.I if ignorecase else 0) | (re.M if multiline else 0))
        if not m:
            return None
        # 3006 returns just the groups -- () for a pattern without any; 3007+
        # return the whole match in that case.
        if version == "3006" or m.groups():
            return m.groups()
        return (m.group(),)
    return run


def _yaml_quoted(write):
    def quote(text):
        out = io.StringIO()
        getattr(yaml.emitter.Emitter(out, width=sys.maxsize), write)(str(text))
        return out.getvalue()
    return quote


def _yaml_encode(data):
    node = yaml.representer.SafeRepresenter().represent_data(data)
    if not isinstance(node, yaml.ScalarNode):
        raise TypeError(f"yaml_encode() only works with YAML scalar data; failed for {type(data)}")
    return _yaml_quoted("write_double_quoted")(node.value) if node.tag.rsplit(":", 1)[-1] == "str" else node.value


def _human_to_bytes(size, default_unit="B", handle_metric=False):
    m = re.match(r"(?P<value>[0-9.]*)\s*(?P<unit>.*)$", str(size).strip())
    value, unit = m.group("value"), m.group("unit").lower() or default_unit.lower()
    try:
        value = int(value)
    except ValueError:
        try:
            value = float(value)
        except ValueError:
            return 0
    dec = False
    if re.match(r"[kmgtpezy]b$", unit):
        dec = bool(handle_metric)
    elif not re.match(r"(b|[kmgtpezy](ib)?)$", unit):
        return 0
    p = "bkmgtpezy".index(unit[0])
    value *= 10 ** (p * 3) if dec else 2 ** (p * 10)
    return int(value)


def _to_num(text):
    try:
        return int(text)
    except ValueError:
        try:
            return float(text)
        except ValueError:
            return text


def _is_hex(value):
    try:
        int(value, 16)
        return True
    except (TypeError, ValueError):
        return False


def _camel_to_snake(s):
    res = s[0].lower()
    for i, letter in enumerate(s[1:], 1):
        if letter.isupper() and (s[i - 1].islower() or (i != len(s) - 1 and s[i + 1].islower())):
            res += "_"
        res += letter.lower()
    return res


def _expr_match(line, expr):
    import fnmatch
    if fnmatch.fnmatch(line, expr):
        return True
    try:
        return bool(re.match(rf"\A{expr}\Z", line))
    except re.error:
        return False


def _check_whitelist_blacklist(value, whitelist=None, blacklist=None):
    lists = []
    for lst in (blacklist, whitelist):
        lst = [lst] if isinstance(lst, str) else (lst or [])
        if not hasattr(lst, "__iter__"):
            raise TypeError(f"Expecting iterable list, but got {type(lst).__name__} ({lst})")
        lists.append(lst)
    blacklist, whitelist = lists
    black = any(_expr_match(value, e) for e in blacklist)
    white = any(_expr_match(value, e) for e in whitelist)
    if blacklist and not whitelist:
        return not black
    if whitelist and not blacklist:
        return white
    if blacklist and whitelist:
        return not black and white
    return True


def _b(text):
    return text if isinstance(text, bytes) else str(text).encode("utf-8")


def _base64_decode(instr):
    import base64
    decoded = base64.b64decode(_b(instr))
    try:
        return decoded.decode("utf-8")
    except UnicodeDecodeError:
        return decoded


def _path_join(*parts, **kwargs):
    import posixpath  # minions this previews for are overwhelmingly POSIX
    parts = [posixpath.normpath(str(p)) for p in parts]
    if not parts:
        return ""
    root = parts.pop(0)
    if not parts:
        return posixpath.normpath(root)
    return posixpath.normpath(posixpath.join(root, *[p.lstrip("/") for p in parts]))


def _from_entries(entries):
    ret = {}
    for entry in entries:
        lowered = {str(k).lower(): v for k, v in entry.items()}
        for key in ("key", "name"):
            if lowered.get(key):
                ret[lowered[key]] = lowered.get("value")
                break
    return ret


class SaltException(Exception):
    """Salt's own exception (salt.exceptions.SaltException) -- not a Jinja
    error, so a render it aborts reads "Jinja error: ...", as in Salt."""


def _to_entries(data):
    if isinstance(data, dict):
        return [{"key": k, "value": v} for k, v in data.items()]
    if isinstance(data, list):
        return [{"key": i, "value": v} for i, v in enumerate(data)]
    raise SaltException("Input data must be a dict or list")


def salt_filters(version, session):
    import base64
    import hashlib
    import hmac
    import uuid as uuidlib

    def load_yaml(value):
        try:
            return yaml.safe_load(str(value))
        except yaml.YAMLError as exc:
            raise jinja2.exceptions.TemplateRuntimeError(f"Encountered error loading yaml: {exc}")

    def load_json(value):
        try:
            return json.loads(str(value))
        except (ValueError, TypeError, AttributeError):
            raise jinja2.exceptions.TemplateRuntimeError(f"Unable to load json from {value}")

    def format_yaml(value, flow_style=True):
        text = yaml.safe_dump(value, default_flow_style=flow_style, allow_unicode=True).strip()
        return Markup(text[:-4] if text.endswith("\n...") else text)

    def tojson(val, indent=None, **options):
        options.setdefault("ensure_ascii", True)
        if indent is not None:
            options["indent"] = indent
        return (json.dumps(val, **options).replace("<", "\\u003c").replace(">", "\\u003e")
                .replace("&", "\\u0026").replace("'", "\\u0027"))

    def lst_avg(lst):
        return float(sum(lst) / len(lst)) if not _hashable(lst) else float(lst)

    def digest(algo):
        return lambda instr: hashlib.new(algo, _b(instr)).hexdigest()

    filters = {
        # SerializerExtension
        "yaml": format_yaml,
        "json": lambda value, sort_keys=True, indent=None: Markup(json.dumps(value, sort_keys=sort_keys, indent=indent).strip()),
        "load_yaml": load_yaml,
        "load_json": load_json,
        "load_text": lambda value: str(value),
        # salt/utils/jinja.py
        "skip": lambda data: "",
        "sequence": lambda data: data if isinstance(data, (list, tuple, set, dict)) else [data],
        "to_bool": _to_bool,
        "indent": _indent,
        "tojson": tojson,
        "quote": lambda txt: shlex.quote(txt),
        "regex_escape": lambda value: re.escape(value),
        "regex_search": _regex(re.search, version),
        "regex_match": _regex(re.match, version),
        "regex_replace": lambda txt, rgx, val, ignorecase=False, multiline=False:
            re.compile(rgx, (re.I if ignorecase else 0) | (re.M if multiline else 0)).sub(val, txt),
        "uuid": lambda val: str(uuidlib.uuid5(uuidlib.UUID(SALT_UUID_NAMESPACE), str(val))),
        "unique": _unique,
        "min": lambda obj: min(obj),
        "max": lambda obj: max(obj),
        "avg": lst_avg,
        "union": lambda a, b: set(a) | set(b) if _hashable(a) and _hashable(b) else _unique(a + b),
        "intersect": lambda a, b: set(a) & set(b) if _hashable(a) and _hashable(b) else _unique([e for e in a if e in b]),
        "difference": lambda a, b: set(a) - set(b) if _hashable(a) and _hashable(b) else _unique([e for e in a if e not in b]),
        "symmetric_difference": lambda a, b: set(a) ^ set(b) if _hashable(a) and _hashable(b) else
            _unique([e for e in _unique(a + b) if e not in _unique([x for x in a if x in b])]),
        "method_call": lambda obj, f_name, *a, **kw: getattr(obj, f_name, lambda *x, **y: None)(*a, **kw),
        # salt/utils/data.py
        "compare_dicts": lambda old=None, new=None: {
            k: ({"old": "", "new": new[k]} if k not in old else {"new": "", "old": old[k]} if k not in new else {"old": old[k], "new": new[k]})
            for k in set(new or {}).union(old or {}) if k not in old or k not in new or new[k] != old[k]},
        "compare_lists": lambda old=None, new=None: {
            **({"new": [i for i in new if i not in old]} if any(i not in old for i in new) else {}),
            **({"old": [i for i in old if i not in new]} if any(i not in new for i in old) else {})},
        "exactly_n_true": lambda iterable, amount=1: (lambda it: all(any(it) for _ in range(amount)) and not any(it))(iter(iterable)),
        "exactly_one_true": lambda iterable: (lambda it: any(it) and not any(it))(iter(iterable)),
        "flatten": _flatten,
        "is_iter": _is_iter,
        "is_list": lambda value: isinstance(value, list),
        "sorted_ignorecase": lambda to_sort: sorted(to_sort, key=lambda x: x.lower()),
        "substring_in_list": lambda s, lst: any(s in x for x in lst),
        "traverse": _traverse,
        # salt/utils/dictupdate.py
        "set_dict_key_value": _set_dict_key_value,
        "update_dict_key_value": _grow_dict_key_value("update", dict),
        "append_dict_key_value": _grow_dict_key_value("append", list),
        "extend_dict_key_value": _grow_dict_key_value("extend", list),
        # salt/utils/stringutils.py
        "to_num": _to_num,
        "str_to_num": _to_num,
        "is_hex": _is_hex,
        "contains_whitespace": lambda text: any(x.isspace() for x in text),
        "human_to_bytes": _human_to_bytes,
        "to_camelcase": lambda s, uppercamel=False: (lambda w: (w[0].capitalize() if uppercamel else w[0]) + "".join(x.capitalize() for x in w[1:]))(s.split("_")),
        "to_snake_case": _camel_to_snake,
        "check_whitelist_blacklist": _check_whitelist_blacklist,
        "to_bytes": lambda s, encoding=None, errors="strict": s if isinstance(s, bytes) else str(s).encode(encoding or "utf-8", errors),
        # salt/utils/hashutils.py
        "base64_encode": lambda instr: base64.b64encode(_b(instr)).decode("utf-8"),
        "base64_decode": _base64_decode,
        "md5": digest("md5"),
        "sha1": digest("sha1"),
        "sha256": digest("sha256"),
        "sha512": digest("sha512"),
        "hmac": lambda string, shared_secret, challenge_hmac:
            base64.b64encode(hmac.new(_b(shared_secret), _b(string), hashlib.sha256).digest()) == _b(challenge_hmac),
        "hmac_compute": lambda string, shared_secret: hmac.new(_b(shared_secret), _b(string), hashlib.sha256).hexdigest(),
        # salt/utils/path.py
        "path_join": _path_join,
        # salt/utils/yamlencoding.py
        "yaml_dquote": _yaml_quoted("write_double_quoted"),
        "yaml_squote": _yaml_quoted("write_single_quoted"),
        "yaml_encode": _yaml_encode,
    }
    if version != "3006":  # added in 3007
        filters["to_entries"] = _to_entries
        filters["from_entries"] = _from_entries

    def environment_filter(name):
        # Its result depends on the minion or the moment: an input to answer.
        def ask(value, *args, **kwargs):
            shown = [repr(value)] + [repr(a) for a in args] + [f"{k}={v!r}" for k, v in kwargs.items()]
            return session.ask("filter", f"{name}({', '.join(shown)})")
        return ask

    for name in ENVIRONMENT_FILTERS:
        filters[name] = environment_filter(name)
    return filters


def context_for(path, roots):
    """Salt's per-file context variables, from the path relative to the
    first root that contains it."""
    rel = None
    for root in roots:
        try:
            r = os.path.relpath(path, root)
        except ValueError:
            continue
        if not r.startswith(".."):
            rel = r.replace(os.sep, "/")
            break
    if rel is None:
        rel = os.path.basename(path)
    tpldir = os.path.dirname(rel)
    base = re.sub(r"\.sls$", "", rel)
    if base.endswith("/init"):
        base = base[: -len("/init")]
    sls = base.replace("/", ".")
    return rel, {
        "sls": sls,
        "slspath": tpldir,
        "sls_path": tpldir.replace("/", "_"),
        "slsdotpath": tpldir.replace("/", "."),
        "slscolonpath": tpldir.replace("/", ":"),
        "tpldir": tpldir,
        "tplpath": rel,
        "tplfile": rel,
        "tpldot": tpldir.replace("/", "."),
        "saltenv": "base",
        "env": "base",
    }


def _compiling():
    """True while Jinja's compiler is on the call stack (constant folding)."""
    frame = sys._getframe(1)
    while frame is not None:
        if frame.f_code.co_filename.replace("\\", "/").endswith("jinja2/compiler.py"):
            return True
        frame = frame.f_back
    return False


def template_location():
    """(template file, line) of the template code running right now, from
    the live call stack -- Jinja's compiled modules carry their template as
    __jinja_template__, which maps a compiled line back to a template line."""
    frame = sys._getframe(1)
    while frame is not None:
        template = frame.f_globals.get("__jinja_template__")
        if template is not None:
            return template.filename or template.name, template.get_corresponding_lineno(frame.f_lineno)
        frame = frame.f_back
    return None, None


def error_location(exc, tb, rel_main):
    """(file, line) of the template frame an exception came from."""
    lineno = getattr(exc, "lineno", None)
    name = getattr(exc, "filename", None) or getattr(exc, "name", None)
    if lineno:
        return (name or rel_main), lineno
    found = (None, None)
    while tb is not None:
        code = tb.tb_frame.f_code
        if code.co_filename.endswith((".sls", ".jinja", ".yaml", ".yml")) or code.co_filename == rel_main:
            found = (code.co_filename, tb.tb_lineno)
        tb = tb.tb_next
    return found


def main():
    req = json.load(sys.stdin)
    # Which Salt line's rules to apply where they differ (saltSyntax.saltVersion).
    salt_version = "3006" if str(req.get("saltVersion", "3008")) == "3006" else "3008"
    session = Session(req.get("answers") or {})
    roots = [os.path.abspath(r) for r in req.get("roots") or []]
    rel_main, ctx = context_for(req["path"], roots)

    grains, pillar, opts = Lookup(session, "grains"), Lookup(session, "pillar"), Lookup(session, "config")

    class RecordingUndefined(jinja2.Undefined):
        """An undefined value, handled the way the preview needs:

        - An undefined *variable* is an input too (something an including
          template, or a file.managed `context:`, was expected to pass in),
          so it's asked for, and printed as a visible «variable:name».
        - Salt renders with jinja2.StrictUndefined unless the master sets
          allow_undefined (salt/utils/templates.py), so printing, comparing,
          iterating or truth-testing an undefined value -- variable or a
          missing key/attribute -- fails the whole render there. Here the
          render carries on (so the rest stays visible) but each such use is
          recorded, with its template line, as a strict error. `is defined`
          and `| default(...)` never reach these methods, as in Salt."""

        def __init__(self, hint=None, obj=jinja2.utils.missing, name=None, exc=jinja2.exceptions.UndefinedError):
            super().__init__(hint, obj, name, exc)
            self._is_variable = obj is jinja2.utils.missing and bool(name) and not hint
            if self._is_variable:
                session.ask("variable", name)

        def _strict(self, marker=None):
            file, line = template_location()
            if file is None and _compiling():
                # Jinja folds constant expressions (`"".__class__`) while
                # compiling; with Salt's StrictUndefined that raises, and Jinja
                # then leaves the expression to render time -- do the same, so
                # it's evaluated (and reported, with its line) while rendering.
                raise RuntimeError("undefined value during constant folding")
            # Salt's own wording (salt/utils/templates.py): an UndefinedError is
            # "Jinja variable ...", a sandbox SecurityError "Jinja syntax error: ...".
            if issubclass(self._undefined_exception, jinja2.exceptions.SecurityError):
                message = f"Jinja syntax error: {self._undefined_message}"
            else:
                message = f"Jinja variable {self._undefined_message}"
            for err in session.strict_errors:
                if (err["message"], err["file"], err["line"]) == (message, file, line):
                    if marker and not err["marker"]:
                        err["marker"] = marker
                        err["markers"] = [marker, marker.replace("«", "\\xAB").replace("»", "\\xBB"),
                                          marker.replace("«", "\\u00ab").replace("»", "\\u00bb")]
                    return
            # `marker`: the placeholder printed into the output, so the
            # preview can also point at the rendered line(s) it ended up on --
            # `markers` adds how Salt's escaping filters spell it (yaml_dquote
            # / yaml_encode: \xAB..\xBB; json / tojson: \u00ab..\u00bb).
            markers = [marker, marker.replace("«", "\\xAB").replace("»", "\\xBB"),
                       marker.replace("«", "\\u00ab").replace("»", "\\u00bb")] if marker else []
            session.strict_errors.append({"message": message, "file": file, "line": line, "marker": marker, "markers": markers})

        def __str__(self):
            # Visible, never silently "": Salt would have produced no output
            # at all here (the render fails), so a marker loses nothing.
            if self._is_variable:
                marker = f"«variable:{self._undefined_name}»"
            else:
                marker = f"«undefined:{self._undefined_name}»" if self._undefined_name else "«undefined»"
            self._strict(marker)
            return marker

        def __iter__(self):
            self._strict()
            return iter(())

        def __len__(self):
            self._strict()
            return 0

        def __bool__(self):
            self._strict()
            return False

        def __eq__(self, other):
            self._strict()
            return type(self) is type(other)

        def __ne__(self, other):
            self._strict()
            return not self.__eq__(other)

        __hash__ = jinja2.Undefined.__hash__

        def __contains__(self, item):
            self._strict()
            return False

    env = SaltEnvironment(
        loader=SaltLoader(roots, {rel_main: req["source"]}),
        undefined=RecordingUndefined,
        extensions=["jinja2.ext.do", "jinja2.ext.loopcontrols"],
        keep_trailing_newline=True,
    )
    env.filters.update(salt_filters(salt_version, session))

    # Salt's own Jinja global and tests (salt/utils/jinja.py, identical in
    # 3006.27 and 3008.2).
    def jinja_raise(msg):
        raise jinja2.exceptions.TemplateError(msg)

    def test_match(txt, rgx, ignorecase=False, multiline=False):
        return bool(re.compile(rgx, (re.I if ignorecase else 0) | (re.M if multiline else 0)).match(txt))

    env.globals["raise"] = jinja_raise
    env.tests["match"] = test_match
    env.tests["equalto"] = lambda value, other: value == other

    def import_serialized(kind):
        # import_yaml & co. render the imported file with Jinja first (as
        # Salt does), in the importing template's context.
        def load(context, path):
            name = env.join_path(str(path), context.name)
            text = env.get_template(name).render(context.get_all())
            return {"yaml": yaml.safe_load, "json": json.loads, "text": str}[kind](text)
        return jinja2.pass_context(load)

    env.globals.update(ctx)
    env.globals.update({
        "salt": SaltFunctions(session, {"grains": grains, "pillar": pillar}),
        "grains": grains,
        "pillar": pillar,
        "opts": opts,
        "__salt_import_yaml": import_serialized("yaml"),
        "__salt_import_json": import_serialized("json"),
        "__salt_import_text": import_serialized("text"),
    })
    # Answered undefined variables are injected like any other global -- at
    # which point they're no longer undefined, so they're listed afterwards
    # (below) to stay editable.
    injected = []
    for qid in session.raw_answers:
        if qid.startswith("variable|"):
            val = session.answer(qid)
            if val is not MISSING:
                env.globals[qid.split("|", 1)[1]] = val
                injected.append(qid)

    result = {"rendered": "", "error": None, "yamlErrors": [], "context": dict(ctx, file=rel_main, roots=roots)}
    # Salt ships filters this emulation doesn't: stub each unknown one as a
    # pass-through (with a warning) and retry, rather than stopping cold.
    # Every filter Salt has is registered above, so an unknown one fails the
    # render here exactly as in Salt ("No filter named ...").
    try:
        result["rendered"] = env.get_template(rel_main).render()
    except Exception as exc:  # noqa: BLE001 - every failure is reported, not raised
        raise_to_result(result, exc, rel_main)

    if result["error"] is None:
        def render_included(path, _sls):
            """Another SLS rendered for its state IDs: its own context (sls,
            tpldir, ...), the same answers; anything it asks, warns about or
            records is dropped, so the panel only shows this file's inputs.
            None if it can't be rendered."""
            saved = (dict(session.questions), list(session.warnings), list(session.strict_errors))
            try:
                rel = next((os.path.relpath(path, r) for r in roots if not os.path.relpath(path, r).startswith("..")), None)
                if rel is None:
                    return None
                return env.get_template(rel.replace(os.sep, "/")).render(**context_for(path, roots)[1])
            except Exception:  # noqa: BLE001 - an unrenderable include just disables the check
                return None
            finally:
                session.questions, session.warnings, session.strict_errors = saved

        result["yamlErrors"] = check_rendered_yaml(result["rendered"], salt_version, ctx["sls"],
                                                   req.get("stateData"), roots, rel_main, render_included)

    for qid in injected:
        if qid not in session.questions:
            session.ask("variable", qid.split("|", 1)[1])
    result["questions"] = list(session.questions.values())
    result["warnings"] = session.warnings
    result["strictErrors"] = session.strict_errors
    json.dump(result, sys.stdout, default=str)


def raise_to_result(result, exc, rel_main):
    file, line = error_location(exc, sys.exc_info()[2], rel_main)
    # Salt's own wording for a failed render (salt/utils/templates.py).
    if isinstance(exc, jinja2.exceptions.UndefinedError):
        message = f"Jinja variable {exc}"
    elif isinstance(exc, (jinja2.exceptions.TemplateRuntimeError, jinja2.exceptions.TemplateSyntaxError,
                          jinja2.exceptions.SecurityError)):
        message = f"Jinja syntax error: {exc}"
    else:
        message = f"Jinja error: {exc}"
    result["error"] = {"message": message, "file": file, "line": line}


if __name__ == "__main__":
    main()
