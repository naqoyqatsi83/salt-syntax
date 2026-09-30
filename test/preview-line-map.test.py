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

# Where markers change the output (here: a macro's text through tojson),
# only the lines that differ lose their mapping (#59) -- and the preview's
# own render is untouched either way.
r = one('{% macro m() %}\nq\n{% endmacro %}v: {{ m() | tojson }}\n')
c.eq(r["rendered"], 'v: "\\nq\\n"\n', "rendered text unaffected")
c.eq(r["lineMap"], [None, 3], "only the changed line loses its mapping")
r = one('a: 1\n{% macro m() %}\nq\n{% endmacro %}v: {{ m() | tojson }}\nw: 2\n')
c.eq(r["lineMap"], [1, None, 5, 5], "the lines around it keep theirs")
c.eq([o and o[1] for o in r["lineOrigins"]], [1, None, 5, 5], "origins too")

# The mapping render doesn't add questions or warnings of its own.
r = one("a: {{ pillar['x'] }}\n")
c.eq([q["id"] for q in r["questions"]], ["pillar|x"], "one question, once")
c.eq(r["lineMap"], [1, 1], "map alongside a placeholder")

# Text from other templates (#59): each rendered line's real file and line
# -- a macro in a .jinja library, an {% include %} -- while lineMap keeps
# pointing at the main file's line that pulled it in. import_yaml data is
# read unmarked, so its values don't change.
origins_root = os.path.join(FIXTURES, "origins")
init = os.path.join(origins_root, "o", "init.sls")
r = render(open(init).read(), init, [origins_root])
c.eq(r["rendered"], "\n\nx:\n  test.nop\n\nincluded:\n  test.nop\n\n\ny: 8081\n", "rendered as usual; import_yaml value intact (a number, used in arithmetic)")
c.eq(r["lineMap"], [1, 2, 2, 2, 2, 3, 3, 3, 4, 5, 5], "main-file map: the calling lines")
files = [os.path.relpath(f, origins_root).replace(os.sep, "/") if f else f for f in r["lineFiles"]]
named = [[files[f], line] for f, line in r["lineOrigins"]]
c.eq(named, [["o/init.sls", 1], ["o/lib.jinja", 2], ["o/lib.jinja", 3], ["o/lib.jinja", 4], ["o/init.sls", 2],
             ["o/part.sls", 1], ["o/part.sls", 2], ["o/init.sls", 3], ["o/init.sls", 4], ["o/init.sls", 5], ["o/init.sls", 5]],
     "origins: macro lines in lib.jinja, included lines in part.sls")
c.eq(files[0], "o/init.sls", "the main file is file 0")
c.true(all(os.path.isabs(f) for f in r["lineFiles"]), "absolute paths")
crlf = render(open(init).read().replace("\n", "\r\n"), init, [origins_root])
c.eq((crlf["rendered"], crlf["lineMap"], crlf["lineOrigins"]), (r["rendered"], r["lineMap"], r["lineOrigins"]),
     "a CRLF source (an editor buffer on Windows): the same output and maps")

# No map for a failed render.
c.eq(one("{% if %}")["lineMap"], None, "render error: no map")
c.eq(one("{% if %}")["lineOrigins"], None, "render error: no origins")
c.done()
