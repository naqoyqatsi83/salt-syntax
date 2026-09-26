"""Requisite targets and extend: IDs that no state in the file or the files
it includes defines (#23) -- through a full render, so includes really are
rendered, each with its own sls/tpldir."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "helpers"))
from preview import FIXTURES, Checks, render  # noqa: E402

c = Checks()
root = os.path.join(FIXTURES, "refs")
init = os.path.join(root, "app", "init.sls")
source = open(init).read()
lines = source.split("\n")
for version in ("3006", "3008"):
    r = render(source, init, [root], version=version)
    c.eq(r["error"], None, f"{version}: renders")
    refs = [(p["line"], p["message"]) for p in r["yamlErrors"] if not p.get("reject", True) and "no state in this file" in p["message"]]
    c.eq([lines[line - 1].strip() for line, _m in refs],
         ["- pkg: nope", "- service: app.db.missing", "- app.nothing", "- sls: app.other", "- file: pos*", "app.db.nothere:"],
         f"{version}: exactly the dangling references, on their lines")
    first = refs[0][1]
    want = ("The following requisites were not found: require: pkg: nope" if version == "3006" else
            "Referenced state does not exist for requisite [require: (pkg: nope)] in state [app.service] in SLS [app]")
    c.true(first.startswith(want), f"{version}: Salt's wording: {first}")
    c.true(refs[-1][1].startswith("Cannot extend ID 'app.db.nothere' in 'base:app'."), f"{version}: extend: {refs[-1][1]}")
    # Inputs asked while rendering the include don't leak into this file's panel.
    c.eq([q for q in r["questions"] if "db" in q["key"]], [], f"{version}: included file's inputs not listed")

# An include that can't be rendered -> its states are unknown -> no reference warnings at all.
broken = source.replace("  - .db\n", "  - .db\n  - .broken\n")
os.makedirs(os.path.join(root, "app"), exist_ok=True)
with open(os.path.join(root, "app", "broken.sls"), "w") as fh:
    fh.write("{% if %}\n")
try:
    r = render(broken, init, [root])
    c.eq([p["message"] for p in r["yamlErrors"] if "no state in this file" in p["message"]], [], "unrenderable include disables the check")
finally:
    os.remove(os.path.join(root, "app", "broken.sls"))
c.done()
