"""The renderer's line map: which source line produced each rendered line,
for scroll sync between a formula and its preview (#48)."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "helpers"))
from preview import FIXTURES, Checks, render  # noqa: E402

c = Checks()


def one(src, answers=None):
    return render(src, os.path.join(FIXTURES, "errors", "f", "init.sls"), [os.path.join(FIXTURES, "errors")], answers)


# One entry per rendered line (the text after the last newline included), 1-based.
r = one("a: 1\nb: 2\n")
c.eq(r["lineMap"], [1, 2, 2], "plain text: line for line")

# A loop's body maps each repetition back to the same source lines.
r = one("{% for i in [1, 2] %}\ns{{ i }}:\n  test.nop\n{% endfor %}\nend:\n  test.nop\n")
c.eq(r["lineMap"], [1, 2, 3, 1, 2, 3, 4, 5, 6, 6], "loop body repeats its lines")

# A value printed over several lines belongs to the line that printed it.
r = one('x: |\n  {{ "a\\nb" | indent(2) }}\ny: 1\n')
c.eq(r["rendered"], "x: |\n  a\n  b\ny: 1\n", "multi-line value rendered")
c.eq(r["lineMap"], [1, 2, 2, 3, 3], "multi-line value maps to its expression's line")

# Captured blocks ({% load_yaml %}, {% set %}...{% endset %}, {% filter %})
# aren't printed where they stand, so their lines get no marker -- and the
# captured value stays untouched.
r = one("{% load_yaml as cfg %}\nk: v\n{% endload %}\nout: {{ cfg.k }}\n{% set t %}\nx\n{% endset %}\nlen: {{ t | length }}\n")
c.eq(r["rendered"], "\nout: v\n\nlen: 3\n", "captured blocks render as usual")
c.eq(r["lineMap"], [3, 4, 7, 8, 8], "captured blocks' lines are skipped")

# Where markers would change the output (here: a macro's text through
# tojson), there's no map rather than a wrong one -- and the preview's own
# render is untouched either way.
r = one('{% macro m() %}\nq\n{% endmacro %}v: {{ m() | tojson }}\n')
c.eq(r["rendered"], 'v: "\\nq\\n"\n', "rendered text unaffected")
c.eq(r["lineMap"], None, "no map when marked output differs")

# The mapping render doesn't add questions or warnings of its own.
r = one("a: {{ pillar['x'] }}\n")
c.eq([q["id"] for q in r["questions"]], ["pillar|x"], "one question, once")
c.eq(r["lineMap"], [1, 1], "map alongside a placeholder")

# No map for a failed render.
c.eq(one("{% if %}")["lineMap"], None, "render error: no map")
c.done()
