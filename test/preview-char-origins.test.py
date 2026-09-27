"""Character origins in the rendered preview (#60, experimental): where each
rendered character came from, and hints for empty lines left by tag-only
lines."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "helpers"))
from preview import FIXTURES, Checks, render  # noqa: E402

c = Checks()


def one(src):
    return render(src, os.path.join(FIXTURES, "errors", "f", "init.sls"), [os.path.join(FIXTURES, "errors")])


def described(r):
    """Each rendered line as (text, [(chars, kind, line, col[, tag])])."""
    out = []
    for text, runs in zip(r["rendered"].split("\n"), r["charOrigins"]):
        out.append((text, [((text + "\n")[a:b], kind, line, col, *rest) for a, b, _f, line, col, kind, *rest in runs] if runs else runs))
    return out


# Template text maps character by character; an expression's output maps to
# its {{ }} tag. Whitespace control is applied as without markers.
r = one("{%- for i in [1, 2] %}\n  a{{ i }}: {{ i * 10 }}   \n{%- endfor %}\n")
c.eq(r["rendered"], "\n  a1: 10\n  a2: 20\n", "rendered as usual")
d = described(r)
c.eq(d[1], ("  a1: 10", [("  a", "T", 2, 0), ("1", "E", 2, 3, "{{ i }}"), (": ", "T", 2, 10), ("10", "E", 2, 12, "{{ i * 10 }}"),
                          ("\n", "T", 1, 22)]), "line 1: text and expressions")
c.eq(d[0], ("", [("\n", "T", 1, 22)]), "the newline after the for tag")

# Text captured by {% set %} isn't marked: its value is unchanged.
r = one("{% set s %}  x  {{ 1 }}{% endset %}len: {{ s | length }}\n")
c.eq(r["rendered"], "len: 6\n", "captured text unchanged")
c.eq(described(r)[0][1][1][1:4], ("E", 1, 40), "len: its expression")

# Text a filter changes on the way is flagged as such.
r = one("{% filter upper %}abc{% endfilter %}\n{% macro m() %}ab{% endmacro %}{{ m() | upper }}\n")
c.eq(r["rendered"], "ABC\nAB\n", "filtered")
c.eq(described(r)[1][1][0][:2], ("AB", "X"), "changed by a filter: X")

# Empty lines from tag-only lines, with the `{%-` fix where it trims a newline
# that's really printed right before the tag.
r = one("a: 1\n{% if true %}\nb: 2\n{% else %}\nc: 3\n{% endif %}\n")
hints = [(h["line"], h["sourceLine"], h["tag"], h["fix"]) for h in r["blankLineHints"]]
c.eq(hints, [(2, 2, "{% if true %}", "{%- if true %}"), (4, 6, "{% endif %}", None)],
     "if: fixable (a's newline is printed before it); endif: its preceding newline is in the unrendered else")
c.eq([h["fix"] for h in one("{% set x = 1 %}\na: 1\n")["blankLineHints"]], [None], "first line: nothing before it to trim")
# Per occurrence: in a loop, an iteration where the if is false leaves a line
# made of two source lines (the if's indentation, the endif's newline) -- no
# hint there; where it's true, the endif line's hint and fix hold.
loop = one("{%- for u in ['a', 'b'] %}\n{{ u }}:\n  x:\n    {% if u == 'a' %}\n    - y\n    {% endif %}\n{%- endfor %}\n")
c.eq(loop["rendered"], "\na:\n  x:\n    \n    - y\n    \nb:\n  x:\n    \n", "rendered")
c.eq([(h["line"], h["sourceLine"], h["fix"]) for h in loop["blankLineHints"]],
     [(1, 1, None), (4, 4, "{%- if u == 'a' %}")],
     "the for line's newline first (nothing before it), a's if line; lines made of two source lines -- "
     "an indentation plus the loop's next newline (6, 9) -- get none")
c.eq(one("a: 1\n{%- if true %}\nb: 2\n{%- endif %}\n")["blankLineHints"], [], "already trimmed: no hints")
c.eq([h["tag"] for h in one("a: 1\n{# note #}\nb: 2\n")["blankLineHints"]], ["{# note #}"], "comment lines too")
multi = one("a: 1\n{% set x = [\n  1,\n] %}\nb: 2\n")["blankLineHints"]
c.eq([(h["sourceLine"], h["tag"], h["fix"]) for h in multi], [(2, "{% set x = [\n  1,\n] %}", "{%- set x = ["), ], "a multi-line tag: from its first line")

# Salt's own tags are quoted as written, not as rewritten for Jinja.
init = os.path.join(FIXTURES, "origins", "o", "init.sls")
r = render(open(init).read(), init, [os.path.join(FIXTURES, "origins")])
c.eq([h["tag"] for h in r["blankLineHints"] if h["sourceLine"] == 4], ['{% import_yaml "o/data.yaml" as data %}'], "import_yaml as written")
# ... and text from other templates maps into them (the macro in lib.jinja).
d = described(r)
x = next(runs for text, runs in d if text == "x:")
c.eq([(chars, kind, line) for chars, kind, line, *_ in x], [("x", "E", 3), (":\n", "T", 3)], "a macro's line")
c.true(r["charFiles"][1].endswith("lib.jinja"), "in lib.jinja")
c.done()
