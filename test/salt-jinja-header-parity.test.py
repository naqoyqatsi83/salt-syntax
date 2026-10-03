"""The preview's per-file `#jinja2: {...}` header against Salt's own (#78).

Salt 3006.28 / 3008.3 read Jinja environment options (trim_blocks, ...) from
a `#jinja2:` line at the top of the template being rendered and remove it
(parse_jinja_file_opts() in salt/utils/templates.py's render_jinja_tmpl).
That function and the opt_jinja_env_helper() it uses are extracted from
Salt's source at the pinned tags, then the template is rendered the way
render_jinja_tmpl does it. The preview's output must be identical, and its
line map has to stay true to the source with the header line gone.
"""
import ast
import json
import logging
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "helpers"))
from preview import FIXTURES, Checks, render, salt_source  # noqa: E402

import jinja2  # noqa: E402 - after the helper, which skips the test without it
import jinja2.sandbox  # noqa: E402


def salt_render(version, tmplstr):
    """tmplstr rendered as render_jinja_tmpl does, with its header handling."""
    tree = ast.parse(salt_source(version, "salt/utils/templates.py"))
    outer = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "render_jinja_tmpl")
    ns = {"jinja2": jinja2, "json": json, "log": logging.getLogger("salt"), "env_args": {}}
    for node in ast.walk(outer):
        if isinstance(node, ast.FunctionDef) and node.name in ("opt_jinja_env_helper", "parse_jinja_file_opts"):
            exec(compile(ast.Module([node], []), "templates.py", "exec"), ns)
    newline = "\n" if tmplstr.endswith("\n") else False
    tmplstr = ns["parse_jinja_file_opts"](tmplstr)
    env = jinja2.sandbox.SandboxedEnvironment(undefined=jinja2.StrictUndefined,
                                              extensions=["jinja2.ext.do", "jinja2.ext.loopcontrols"], **ns["env_args"])
    output = env.from_string(tmplstr).render()
    if newline:  # "Workaround a bug in Jinja that removes the final newline"
        output += newline
    return output


def preview(src):
    return render(src, os.path.join(FIXTURES, "errors", "f", "init.sls"), [os.path.join(FIXTURES, "errors")])


LOOP = "thing:\n{% for n in range(1, 3) %}\n  - some thing {{ n }}\n{% endfor %}\nafter: 1\n"
OPTS = '{"lstrip_blocks": true, "trim_blocks": true}'
TEMPLATES = [
    # Salt's own documented examples, and without a header.
    f"#jinja2: {OPTS}\n{LOOP}",
    f"#!jinja|yaml\n#jinja2: {OPTS}\n{LOOP}",
    LOOP,
    # Only line 1, or line 2 below a renderer shebang -- not an interpreter's.
    f"a: 1\n#jinja2: {OPTS}\n{LOOP}",
    f"#!/usr/bin/env salt\n#jinja2: {OPTS}\n{LOOP}",
    # Not an override: malformed, not an object, empty.
    "#jinja2: {trim_blocks: true}\n" + LOOP,
    '#jinja2: ["trim_blocks"]\n' + LOOP,
    "#jinja2:\n" + LOOP, "#jinja2:   \n" + LOOP,
    # Keys: case-insensitive, unknown ones skipped, one option alone.
    '#jinja2: {"TRIM_BLOCKS": true, "nope": 1}\n' + LOOP,
    '#jinja2: {"lstrip_blocks": true}\n' + LOOP,
    '#jinja2: {"trim_blocks": false}\n' + LOOP,
    # Other delimiters -- the header's own line included.
    '#jinja2: {"comment_start_string": "<#", "comment_end_string": "#>"}\n<# c #>{# kept #}\nx: 1\n',
    '#jinja2: {"variable_start_string": "[[", "variable_end_string": "]]"}\nv: [[ 1 + 1 ]] {{ 3 }}\n',
    # The header as the last line, with and without a newline.
    f"#jinja2: {OPTS}", f"#jinja2: {OPTS}\n", f"#!jinja|yaml\n#jinja2: {OPTS}",
    # A blank line after the header stays, trim_blocks or not.
    f"#jinja2: {OPTS}\n\n{LOOP}", f"#!jinja|yaml\n#jinja2: {OPTS}\n\n\n{LOOP}",
    # A header further down is text, as is a second one.
    f"#jinja2: {OPTS}\n#jinja2: {OPTS}\n{LOOP}",
]

c = Checks()
for version in ("3006", "3008"):
    for src in TEMPLATES:
        c.eq(preview(src)["rendered"], salt_render(version, src), f"Salt {version}: {src!r}")

# The line map: the header line is gone from the output, every other line
# still maps to its own source line (1-based).
r = preview(f"#!jinja|yaml\n#jinja2: {OPTS}\n{LOOP}")
c.eq(r["rendered"], "#!jinja|yaml\nthing:\n  - some thing 1\n  - some thing 2\nafter: 1\n", "header removed, options applied")
c.eq(r["lineMap"], [1, 3, 5, 5, 7, 7], "lines map past the removed header")
r = preview(f"#jinja2: {OPTS}\na: 1\n{{{{ raise('boom') }}}}\n")
c.eq(r["error"] and r["error"]["line"], 3, "a template error keeps its line")

# What Salt only logs, the preview shows.
c.true(any("malformed '#jinja2:'" in w for w in preview("#jinja2: {x}\na: 1\n")["warnings"]), "malformed header: warning")
c.true(any("nope is not recognized" in w for w in preview('#jinja2: {"nope": 1}\na: 1\n')["warnings"]), "unknown key: warning")
c.eq(preview(LOOP)["warnings"], [], "no header: no warning")
c.done()
