// Ctrl+/ (saltSyntax.toggleComment): single-line tag toggle, and multi-line
// blocks neutralizing {% %} tags (#19).
const assert = require('assert');
const { load, Position, Range } = require('./helpers/vscode');

(async () => {
  const h = await load();
  const toggle = h.reg.commands['saltSyntax.toggleComment'];
  let lines;
  const run = async (text, sl, sc, el, ec) => {
    lines = text.split('\n');
    h.reg.executed.length = 0;
    h.vscode.window.activeTextEditor = {
      document: { languageId: 'sls', lineAt: (i) => ({ text: lines[typeof i === 'number' ? i : i.line] }) },
      selections: [1],
      selection: new Range(new Position(sl, sc), new Position(el, ec)),
      edit: async (cb) => {
        const edits = [];
        cb({ replace: (r, t) => edits.push({ r, t }) });
        for (const { r, t } of edits.reverse()) {
          const before = lines.slice(0, r.start.line).concat([lines[r.start.line].slice(0, r.start.character)]).join('\n');
          const after = [lines[r.end.line].slice(r.end.character)].concat(lines.slice(r.end.line + 1)).join('\n');
          lines = (before + t + after).split('\n');
        }
        return true;
      }
    };
    await toggle();
    return lines.join('\n');
  };
  const fellThrough = () => h.reg.executed.some(([n]) => n === 'editor.action.commentLine');

  const src = `{% if condition %}\n{{ sls }}.state_id:\n  file.managed:\n    - name: /path/to/file\n{% else %}\n{{ sls }}.state_id:\n  file.managed:\n    - name: /path/to/file\n{% endif %}`;
  const want = `# {#% if condition %#}\n# {{ sls }}.state_id:\n#   file.managed:\n#     - name: /path/to/file\n# {#% else %#}\n# {{ sls }}.state_id:\n#   file.managed:\n#     - name: /path/to/file\n# {#% endif %#}`;
  const n = src.split('\n').length - 1;
  assert.strictEqual(await run(src, 0, 0, n, 12), want, 'comment a block, neutralizing its tags');
  assert.strictEqual(await run(want, 0, 0, n, 5), src, 'round trip');
  assert.strictEqual(await run(`${src}\ntail: 1`, 0, 0, n + 1, 0), `${want}\ntail: 1`, 'selection ending at column 0 excludes that line');
  const ind = `  {%- for x in y %}\n\n    - {{ x }}\n  {%- endfor %}`;
  const indWant = `  # {#%- for x in y %#}\n\n  #   - {{ x }}\n  # {#%- endfor %#}`;
  assert.strictEqual(await run(ind, 0, 0, 3, 16), indWant, 'indented block, blank line, whitespace control');
  assert.strictEqual(await run(indWant, 0, 0, 3, 5), ind);
  await run(`a: 1\nb: {{ x }}`, 0, 0, 1, 3);
  assert.ok(fellThrough(), 'no statement tags -> VS Code line comment');
  assert.strictEqual(await run(`{% if x %}`, 0, 3, 0, 3), `{#% if x %#}`, 'single-line tag toggle');
  await run(`a: 1`, 0, 0, 0, 0);
  assert.ok(fellThrough(), 'no tag on the line -> VS Code line comment');
  console.log('ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
