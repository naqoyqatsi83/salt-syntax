// Preview profiles (#73): named answer sets shared by every preview, one
// active; switching, adding, renaming, deleting and clearing them from the
// panel; the move of a file's old per-file answers into the profile; and
// profiles kept across a restart.
// Renders for real, so it needs Python with jinja2 + pyyaml (else skipped).
const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');
const { load, doc, until } = require('./helpers/vscode');

const probe = spawnSync(process.env.PYTHON || 'python3', ['-c', 'import jinja2, yaml'], { encoding: 'utf8' });
if (probe.status !== 0) {
  console.log('skipped: python3 with jinja2 + pyyaml not available');
  process.exit(77);
}

const ROOT = path.join(__dirname, 'fixtures', 'errors');
const A = path.join(ROOT, 'f', 'init.sls');
const B = path.join(ROOT, 'f', 'other.sls');

async function start(stored) {
  const h = await load({ config: { 'saltSyntax.preview.fileRoots': [ROOT] }, globalState: stored });
  const posted = [];
  let fromPanel;
  h.reg.webviews['saltSyntax.previewInputs'].resolveWebviewView({
    webview: { options: {}, cspSource: '', postMessage: (m) => posted.push(m), onDidReceiveMessage: (f) => (fromPanel = f) },
    onDidDispose: () => {},
    show: () => {}
  });
  const provider = () => h.reg.contentProviders['salt-preview'];
  // Opens a file's preview; returns a function giving its current text.
  const preview = async (file, text) => {
    const source = doc(text, { path: file });
    h.vscode.workspace.textDocuments.push(source);
    h.vscode.window.activeTextEditor = { document: source, viewColumn: 1 };
    await h.reg.commands['saltSyntax.openRenderedPreview']();
    const uri = h.reg.opened[h.reg.opened.length - 1].uri;
    return () => provider().provideTextDocumentContent(uri);
  };
  const lastState = () => posted.filter((m) => m.type === 'state').pop();
  const panel = (m) => fromPanel(m);
  // VS Code's prompts: each call answers with the next scripted reply.
  const replies = { showInputBox: [], showQuickPick: [], showWarningMessage: [] };
  for (const fn of Object.keys(replies)) h.vscode.window[fn] = async () => replies[fn].shift();
  return { h, preview, lastState, panel, replies };
}

const shows = (get, text) => until(() => !/Rendering/.test(get()) && get().includes(text), `preview showing ${JSON.stringify(text)}`);

(async () => {
  // A file's answers from before profiles (kept per file) move into the
  // active profile the first time it's previewed.
  const legacyKey = `saltPreview.answers:file:${A}`;
  let s = await start({ [legacyKey]: { 'variable|x': 'legacy' } });
  const a = await s.preview(A, 'a: {{ x }}\n');
  await shows(a, 'a: legacy');
  assert.strictEqual(s.h.context.globalState.get(legacyKey), undefined, 'old per-file answers moved out');
  assert.match(a(), /answered \(profile "default"\)/, 'the header names the profile');

  // One answer, every preview: the profile is shared.
  const b = await s.preview(B, 'b: {{ x }}\n');
  await shows(b, 'b: legacy');
  s.panel({ type: 'answer', id: 'variable|x', value: 'shared' });
  await shows(a, 'a: shared');
  await shows(b, 'b: shared');
  assert.deepStrictEqual([s.lastState().profiles, s.lastState().profile], [['default'], 'default']);

  // New profile, empty: nothing answered there.
  s.replies.showInputBox.push('rhel-eu');
  s.replies.showQuickPick.push('Start empty');
  s.panel({ type: 'profile', action: 'new' });
  await until(() => s.lastState().profile === 'rhel-eu' && /«variable:x»|\\xABvariable:x/.test(a()), 'new empty profile active');
  assert.match(a(), /profile "rhel-eu"/);
  s.panel({ type: 'answer', id: 'variable|x', value: 'rhel' });
  await shows(b, 'b: rhel');

  // Switching back: the other profile's answers again.
  s.panel({ type: 'profile', action: 'switch', name: 'default' });
  await shows(a, 'a: shared');
  assert.deepStrictEqual(s.lastState().profiles, ['default', 'rhel-eu']);

  // A copy starts with the current answers; rename keeps them.
  s.replies.showInputBox.push('debian-us');
  s.replies.showQuickPick.push('Copy of "default"');
  s.panel({ type: 'profile', action: 'new' });
  await until(() => s.lastState().profile === 'debian-us', 'copy active');
  await shows(a, 'a: shared');
  s.replies.showInputBox.push('debian-eu');
  s.panel({ type: 'profile', action: 'rename' });
  await until(() => s.lastState().profile === 'debian-eu', 'renamed');
  assert.deepStrictEqual(s.lastState().profiles, ['default', 'rhel-eu', 'debian-eu'], 'renamed in place');

  // Clear: only once confirmed.
  s.replies.showWarningMessage.push(undefined);
  await s.h.reg.commands['saltSyntax.preview.clearAnswers']();
  assert.ok(a().includes('a: shared'), 'cancelled: answers kept');
  s.replies.showWarningMessage.push('Clear');
  await s.h.reg.commands['saltSyntax.preview.clearAnswers']();
  await until(() => /«variable:x»|\\xABvariable:x/.test(a()), 'cleared');
  assert.deepStrictEqual(s.lastState().unused, []);

  // Delete: confirmed; the next profile becomes active. The last one stays.
  s.replies.showWarningMessage.push('Delete');
  await s.h.reg.commands['saltSyntax.preview.deleteProfile']();
  await until(() => s.lastState().profile === 'default', 'deleted, default active');
  await shows(a, 'a: shared');
  assert.deepStrictEqual(s.lastState().profiles, ['default', 'rhel-eu']);

  // Switch from the command palette.
  s.replies.showQuickPick.push({ label: 'rhel-eu' });
  await s.h.reg.commands['saltSyntax.preview.switchProfile']();
  await shows(a, 'a: rhel');

  // VS Code restarted: the profiles and which one is active are still there.
  const stored = s.h.context.globalState.store;
  s = await start(stored);
  const again = await s.preview(A, 'a: {{ x }}\n');
  await shows(again, 'a: rhel');
  assert.deepStrictEqual([s.lastState().profiles, s.lastState().profile], [['default', 'rhel-eu'], 'rhel-eu']);
  s.replies.showWarningMessage.push('Delete');
  await s.h.reg.commands['saltSyntax.preview.deleteProfile']();
  await shows(again, 'a: shared');
  s.replies.showWarningMessage.push('Delete');
  await s.h.reg.commands['saltSyntax.preview.deleteProfile']();
  assert.deepStrictEqual(s.lastState().profiles, ['default'], 'the only profile is never deleted');
  console.log('ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
