"""Character origins (#60): where each rendered character came from, for Go
to Source Line -- computed only when a request asks for them."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "helpers"))
from preview import FIXTURES, Checks, render  # noqa: E402

c = Checks()


def one(src):
    return render(src, os.path.join(FIXTURES, "errors", "f", "init.sls"), [os.path.join(FIXTURES, "errors")], char_origins=True)


# Not asked for: not computed (the preview's own renders don't pay for them).
c.eq(render("a: 1\n", os.path.join(FIXTURES, "errors", "f", "init.sls"), [os.path.join(FIXTURES, "errors")])["charOrigins"], None,
     "only on request")


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

# Text from other templates maps into them (the macro in lib.jinja).
init = os.path.join(FIXTURES, "origins", "o", "init.sls")
r = render(open(init).read(), init, [os.path.join(FIXTURES, "origins")], char_origins=True)
d = described(r)
x = next(runs for text, runs in d if text == "x:")
c.eq([(chars, kind, line) for chars, kind, line, *_ in x], [("x", "E", 3), (":\n", "T", 3)], "a macro's line")
c.true(r["charFiles"][1].endswith("lib.jinja"), "in lib.jinja")
c.done()
