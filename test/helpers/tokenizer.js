// Tokenizes text with VS Code's own TextMate engine (vscode-textmate +
// vscode-oniguruma) and this extension's grammars. The two packages are
// dev-only, so they're installed on demand into test/.cache (git-ignored);
// a test using this exits 77 ("skipped", see test/run.js) if they can't be.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const CACHE = path.join(ROOT, 'test', '.cache', 'tm');
const GRAMMARS = {
  'source.sls': path.join(ROOT, 'syntaxes', 'sls.tmLanguage.json'),
  'source.salt-jinja': path.join(ROOT, 'syntaxes', 'salt-jinja.tmLanguage.json')
};

function requirePackages() {
  const mod = (name) => path.join(CACHE, 'node_modules', name);
  if (!fs.existsSync(mod('vscode-textmate')) || !fs.existsSync(mod('vscode-oniguruma'))) {
    fs.mkdirSync(CACHE, { recursive: true });
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const res = spawnSync(npm, ['install', '--no-save', '--no-audit', '--no-fund', '--prefix', CACHE, 'vscode-textmate@9', 'vscode-oniguruma@2'], { encoding: 'utf8' });
    if (res.status !== 0) {
      console.log(`skipped: couldn't install vscode-textmate / vscode-oniguruma into test/.cache (${(res.stderr || res.error || '').toString().trim().split('\n').pop()})`);
      process.exit(77);
    }
  }
  return { vsctm: require(mod('vscode-textmate')), oniguruma: require(mod('vscode-oniguruma')), wasm: path.join(mod('vscode-oniguruma'), 'release', 'onig.wasm') };
}

// Returns tokenize(text, scopeName) -> one array per line of
// { text, scopes } (scopes without the grammar's root scope).
async function loadTokenizer() {
  const { vsctm, oniguruma, wasm } = requirePackages();
  await oniguruma.loadWASM(fs.readFileSync(wasm).buffer);
  const registry = new vsctm.Registry({
    onigLib: Promise.resolve({ createOnigScanner: (s) => new oniguruma.OnigScanner(s), createOnigString: (s) => new oniguruma.OnigString(s) }),
    loadGrammar: async (scope) => (GRAMMARS[scope] ? vsctm.parseRawGrammar(fs.readFileSync(GRAMMARS[scope], 'utf8'), GRAMMARS[scope]) : null)
  });
  const grammars = {};
  for (const scope of Object.keys(GRAMMARS)) grammars[scope] = await registry.loadGrammar(scope);
  return (text, scope = 'source.sls') => {
    let stack = vsctm.INITIAL;
    return text.split('\n').map((line) => {
      const r = grammars[scope].tokenizeLine(line, stack);
      stack = r.ruleStack;
      return r.tokens.map((t) => ({ text: line.slice(t.startIndex, t.endIndex), scopes: t.scopes.slice(1) }));
    });
  };
}

module.exports = { loadTokenizer, ROOT };
