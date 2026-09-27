"""Shared helpers for the rendered preview's Python tests.

Any test importing this is skipped (exit 77, see test/run.js) when the
renderer's own requirements -- jinja2 and pyyaml -- aren't installed.
"""
import importlib.util
import json
import os
import subprocess
import sys
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
RENDERER = os.path.join(ROOT, "src", "preview", "render.py")
FIXTURES = os.path.join(ROOT, "test", "fixtures")
CACHE = os.path.join(ROOT, "test", ".cache")

# The Salt releases the extension's datasets (and these checks) are pinned to.
SALT_TAGS = {"3006": "v3006.27", "3008": "v3008.2"}


def skip(reason):
    print(f"skipped: {reason}")
    sys.exit(77)


try:
    import jinja2  # noqa: F401
    import yaml  # noqa: F401
except ImportError as exc:
    skip(f"python package '{exc.name}' not installed (pip install jinja2 pyyaml)")


def renderer():
    """src/preview/render.py as a module, for calling its functions directly."""
    spec = importlib.util.spec_from_file_location("render", RENDERER)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def render(source, path, roots, answers=None, version="3008", state_data=None, char_origins=False):
    """A full render through the script, exactly as the extension runs it
    (with char_origins: as Go to Source Line asks for it, #60)."""
    request = {"source": source, "path": path, "roots": roots, "answers": answers or {},
               "saltVersion": version, "stateData": state_data, "charOrigins": char_origins}
    out = subprocess.run([sys.executable, RENDERER], input=json.dumps(request), capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def datasets():
    """{version: state data} -- exactly what src/extension.js sends the
    preview (stateDataFor: functions, mandatory, strict), via node with the
    test suite's vscode mock."""
    node = os.environ.get("NODE", "node")
    script = r"""
const { load } = require('./test/helpers/vscode');
load().then(() => {
  const { stateDataFor } = require('./src/extension.js');
  process.stdout.write(JSON.stringify({ '3006': stateDataFor('3006'), '3008': stateDataFor('3008') }));
});"""
    out = subprocess.run([node, "-e", script], cwd=ROOT, capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def salt_source(version, path):
    """A file of Salt's own source at the pinned tag, from test/.cache or
    downloaded into it. Skips the test when it's neither cached nor
    reachable."""
    tag = SALT_TAGS[version]
    local = os.path.join(CACHE, "salt", tag, path)
    if not os.path.isfile(local):
        url = f"https://raw.githubusercontent.com/saltstack/salt/{tag}/{path}"
        try:
            with urllib.request.urlopen(url, timeout=30) as resp:
                data = resp.read()
        except OSError as exc:
            skip(f"Salt source not cached and not downloadable ({url}: {exc})")
        os.makedirs(os.path.dirname(local), exist_ok=True)
        with open(local, "wb") as fh:
            fh.write(data)
    with open(local, encoding="utf-8") as fh:
        return fh.read()


class Checks:
    """Tiny assertion collector: every failure is reported, not just the first."""

    def __init__(self):
        self.failures = []

    def eq(self, got, want, what):
        if got != want:
            self.failures.append(f"{what}:\n    got:  {got!r}\n    want: {want!r}")

    def true(self, cond, what):
        if not cond:
            self.failures.append(what)

    def done(self):
        for f in self.failures:
            print("FAIL", f)
        if self.failures:
            sys.exit(1)
        print("ok")
