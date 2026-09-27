"""State completion inserts valid YAML (#55): every function's basic and
(full) snippet, in both Salt versions, parses -- and means what the
argument defaults mean. A string default reads back as that same string
(not an alias, a comment, a mapping or a boolean), and the snippet's own
${n:...} syntax survives whatever the default contains."""
import json
import os
import re
import subprocess
import sys

try:
    import yaml
except ImportError:
    print("skipped: pyyaml not available")
    sys.exit(77)

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# Every function's snippets, through the extension's own completion (the
# nested stub: "fn:\n  - key: ${n:default}..."), with the dataset's raw
# defaults for the (full) variant to compare against.
DUMP = r"""
const { load, doc, Position } = require('./test/helpers/vscode');
const src = require('fs').readFileSync('src/extension.js', 'utf8');
const grab = (name) => {
  const start = src.indexOf('{', src.indexOf(`const ${name} = `));
  let depth = 0, i = start;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) break;
  }
  return eval(`(${src.slice(start, i + 1)})`);
};
(async () => {
  const h = await load();
  const state = h.provider('completion', (c) => c.triggers.length === 1 && c.triggers[0] === '.');
  const out = [];
  for (const version of ['3008', '3006']) {
    h.config['saltSyntax.saltVersion'] = version;
    const full = grab(`FULL_FUNCTION_FIELDS_${version}`);
    const mods = state.provideCompletionItems(doc('id:\n  '), new Position(1, 2)).map((i) => i.label);
    for (const mod of mods) {
      for (const it of state.provideCompletionItems(doc(`id:\n  ${mod}.`), new Position(1, mod.length + 3)) || []) {
        const key = `${mod}.${it.filterText}`;
        const isFull = it.label.endsWith('(full)');
        const raw = isFull ? (mod === 'test' ? [['name', 'name'], ...(full[key] || [])] : full[key]) : null;
        out.push({ version, key, full: isFull, snippet: it.insertText.value, raw });
      }
    }
  }
  process.stdout.write(JSON.stringify(out));
})();
"""

PLACEHOLDER = re.compile(r"\$\{\d+:((?:\\.|[^\\}])*)\}")
# Defaults written as Python literals: YAML's reading of them is the point.
LITERAL = re.compile(r"None|True|False|-?\d+(\.\d+)?|\[.*\]|\{\s*\}|\{.*:.*\}|'.*'|\".*\"|\(.*\)", re.S)

out = subprocess.run([os.environ.get("NODE", "node"), "-e", DUMP], cwd=ROOT, capture_output=True, text=True, check=True)
entries = json.loads(out.stdout)
failures = []
for e in entries:
    where = f"{e['version']} {e['key']}{' (full)' if e['full'] else ''}"
    text = PLACEHOLDER.sub(lambda m: re.sub(r"\\(.)", r"\1", m.group(1)), e["snippet"])
    if not text.endswith("$0") or "${" in text:
        failures.append(f"{where}: snippet syntax broken: {e['snippet']!r}")
        continue
    text = text[:-2]
    if ":" not in text.split("\n")[0]:
        continue  # a bare test.* basic: no arguments
    try:
        args = yaml.safe_load(f"{e['key']}{text[text.index(':'):]}")[e["key"]]
    except yaml.YAMLError as err:
        failures.append(f"{where}: invalid YAML ({str(err).splitlines()[0]})")
        continue
    for i, arg in enumerate(args):
        (name, value), = arg.items()
        if value is None:
            failures.append(f"{where}: - {name}: reads as null")
        elif e["raw"] and not LITERAL.fullmatch(e["raw"][i][1]) and value != e["raw"][i][1]:
            failures.append(f"{where}: - {name}: default {e['raw'][i][1]!r} reads as {value!r}")

print(f"{len(entries)} snippets checked, {len(failures)} failures")
for f in failures[:40]:
    print("  " + f)
sys.exit(1 if failures else 0)
