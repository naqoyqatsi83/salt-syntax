#!/usr/bin/env python3
"""EXPERIMENTAL (#23): render a Salt template for the rendered preview.

Reads one JSON request on stdin, writes one JSON result on stdout:

  request  {"source": str, "path": str, "roots": [str], "answers": {id: str}}
  result   {"rendered": str, "questions": [...], "warnings": [...],
            "error": {...} | null, "yamlError": {...} | null, "context": {...}}

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
import json
import os
import re
import shlex
import sys

try:
    import jinja2
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
    preview would call "fine" a file Salt refuses to run. The message is
    Salt's own and points at the second occurrence, as Salt's does; the
    first occurrence's line rides along as `first_line`."""

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
                exc = yaml.constructor.ConstructorError(
                    "while constructing a mapping", node.start_mark,
                    f"found conflicting ID '{key}'", key_node.start_mark)
                exc.first_line = first_seen[key] + 1
                raise exc
            mapping[key] = value
            first_seen[key] = key_node.start_mark.line
        return mapping


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


class SaltEnvironment(jinja2.Environment):
    def join_path(self, template, parent):
        # Salt supports imports relative to the importing template.
        if template.startswith(("./", "../")):
            return os.path.normpath(os.path.join(os.path.dirname(parent), template)).replace(os.sep, "/")
        return template


def salt_filters():
    def regex_replace(value, regex, repl, ignorecase=False, multiline=False):
        flags = (re.I if ignorecase else 0) | (re.M if multiline else 0)
        return re.sub(regex, repl, str(value), flags=flags)

    def regex_search(value, regex, ignorecase=False, multiline=False):
        m = re.search(regex, str(value), flags=(re.I if ignorecase else 0) | (re.M if multiline else 0))
        return m.groups() if m else None

    def regex_match(value, regex, ignorecase=False, multiline=False):
        m = re.match(regex, str(value), flags=(re.I if ignorecase else 0) | (re.M if multiline else 0))
        return m.groups() if m else None

    def unique(values):
        out = []
        for v in values:
            if v not in out:
                out.append(v)
        return out

    return {
        "yaml": lambda v, flow_style=True: dump_inline(v) if flow_style else yaml.safe_dump(v, default_flow_style=False),
        "json": lambda v, sort_keys=True, indent=None: json.dumps(v, sort_keys=sort_keys, indent=indent, default=str),
        "tojson": lambda v, *a, **k: json.dumps(v, default=str),
        "yaml_encode": dump_inline,
        "yaml_dquote": lambda v: json.dumps(str(v), ensure_ascii=False),
        "yaml_squote": lambda v: "'" + str(v).replace("'", "''") + "'",
        "load_yaml": lambda v: yaml.safe_load(str(v)),
        "load_json": lambda v: json.loads(str(v)),
        "load_text": lambda v: str(v),
        "regex_replace": regex_replace,
        "regex_search": regex_search,
        "regex_match": regex_match,
        "unique": unique,
        "to_bool": lambda v: str(v).strip().lower() in ("1", "true", "yes", "on", "y"),
        "sequence": lambda v: v if isinstance(v, (list, tuple)) else [v],
        "is_list": lambda v: isinstance(v, (list, tuple)),
        "quote": lambda v: shlex.quote(str(v)),
    }


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
    session = Session(req.get("answers") or {})
    roots = [os.path.abspath(r) for r in req.get("roots") or []]
    rel_main, ctx = context_for(req["path"], roots)

    grains, pillar, opts = Lookup(session, "grains"), Lookup(session, "pillar"), Lookup(session, "config")

    class RecordingUndefined(jinja2.Undefined):
        """An undefined *variable* is an input too (e.g. something an
        including template was expected to pass in) -- ask for it."""

        def __init__(self, hint=None, obj=jinja2.utils.missing, name=None, exc=jinja2.exceptions.UndefinedError):
            super().__init__(hint, obj, name, exc)
            self._is_variable = obj is jinja2.utils.missing and bool(name) and not hint
            if self._is_variable:
                session.ask("variable", name)

        def __str__(self):
            # Visible like any other unanswered input, not silently "".
            return f"«variable:{self._undefined_name}»" if self._is_variable else ""

    env = SaltEnvironment(
        loader=SaltLoader(roots, {rel_main: req["source"]}),
        undefined=RecordingUndefined,
        extensions=["jinja2.ext.do", "jinja2.ext.loopcontrols"],
        keep_trailing_newline=True,
    )
    env.filters.update(salt_filters())

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

    result = {"rendered": "", "error": None, "yamlError": None, "context": dict(ctx, file=rel_main, roots=roots)}
    # Salt ships filters this emulation doesn't: stub each unknown one as a
    # pass-through (with a warning) and retry, rather than stopping cold.
    for _ in range(20):
        try:
            result["rendered"] = env.get_template(rel_main).render()
            break
        except jinja2.TemplateAssertionError as exc:
            m = re.search(r"No (filter|test) named '([^']+)'", str(exc))
            if not m:
                raise_to_result(result, exc, rel_main)
                break
            kind, name = m.groups()
            (env.filters if kind == "filter" else env.tests)[name] = (lambda v, *a, **k: v) if kind == "filter" else (lambda v, *a, **k: False)
            session.warnings.append(f"Salt {kind} '{name}' isn't emulated here -- treated as a pass-through.")
            if env.cache is not None:
                env.cache.clear()
        except Exception as exc:  # noqa: BLE001 - every failure is reported, not raised
            raise_to_result(result, exc, rel_main)
            break

    if result["error"] is None:
        try:
            yaml.load(result["rendered"], Loader=SaltSafeLoader)
        except yaml.MarkedYAMLError as exc:
            mark = exc.problem_mark or exc.context_mark
            result["yamlError"] = {"message": str(exc.problem or exc), "line": mark.line + 1 if mark else None,
                                   "firstLine": getattr(exc, "first_line", None)}
        except yaml.YAMLError as exc:
            result["yamlError"] = {"message": str(exc), "line": None}

    for qid in injected:
        if qid not in session.questions:
            session.ask("variable", qid.split("|", 1)[1])
    result["questions"] = list(session.questions.values())
    result["warnings"] = session.warnings
    json.dump(result, sys.stdout, default=str)


def raise_to_result(result, exc, rel_main):
    file, line = error_location(exc, sys.exc_info()[2], rel_main)
    result["error"] = {"message": f"{type(exc).__name__}: {exc}", "file": file, "line": line}


if __name__ == "__main__":
    main()
