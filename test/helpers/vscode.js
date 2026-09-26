// Shared, lenient mock of the `vscode` API for the test harnesses.
//
// load() installs the mock (so `require('vscode')` inside src/ gets it),
// loads src/extension.js fresh, and returns the mock plus a registry of
// everything the extension registered: providers, commands, listeners,
// diagnostic collections, content providers, webview views. APIs a test
// doesn't care about are no-ops, so a test doesn't break just because the
// extension starts registering something new.
//
// Documents are plain objects from doc(); nothing here talks to a real
// editor, so behaviour that only VS Code itself decides (e.g. where exactly
// it puts the cursor after an edit) still needs a check in the real editor.

const Module = require('module');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'src');

class Position {
  constructor(line, character) {
    this.line = line;
    this.character = character;
  }
}

class Range {
  constructor(a, b, c, d) {
    if (a instanceof Position) {
      this.start = a;
      this.end = b;
    } else {
      this.start = new Position(a, b);
      this.end = new Position(c, d);
    }
  }
}

class Selection extends Range {
  // (anchor, active) positions, or four numbers like VS Code's.
  constructor(anchor, active, ...rest) {
    if (typeof anchor === 'number') [anchor, active] = [new Position(anchor, active), new Position(rest[0], rest[1])];
    super(anchor, active || anchor);
    this.anchor = anchor;
    this.active = active || anchor;
    this.isEmpty = this.start.line === this.end.line && this.start.character === this.end.character;
  }
}

class EventEmitter {
  constructor() {
    this.listeners = [];
    this.event = (f) => {
      this.listeners.push(f);
      return { dispose() {} };
    };
  }
  fire(value) {
    this.listeners.forEach((f) => f(value));
  }
  dispose() {}
}

const kind = (value) => ({ value, contains: (other) => other.value === value || other.value.startsWith(`${value}.`) });

// Anything not modelled: a no-op returning a disposable.
const lenient = (obj) => new Proxy(obj, { get: (t, k) => (k in t ? t[k] : () => ({ dispose() {} })) });

const uri = (p, scheme = 'file', query = '') => ({ scheme, path: p, fsPath: p, query, toString: () => `${scheme}:${p}${query ? `?${query}` : ''}` });

// A text document; `text` may be changed later via doc.setText().
function doc(text, { languageId = 'sls', path: p = '/w/f.sls', scheme = 'file' } = {}) {
  let lines = text.split('\n');
  const d = {
    uri: uri(p, scheme),
    languageId,
    get lineCount() {
      return lines.length;
    },
    setText(t) {
      text = t;
      lines = t.split('\n');
    },
    lineAt: (x) => ({ text: lines[typeof x === 'number' ? x : x.line] }),
    getText(r) {
      if (!r) return text;
      const out = [];
      for (let l = r.start.line; l <= r.end.line && l < lines.length; l++) {
        const s = l === r.start.line ? r.start.character : 0;
        const e = l === r.end.line ? r.end.character : lines[l].length;
        out.push(lines[l].slice(s, e));
      }
      return out.join('\n');
    },
    offsetAt: (p2) => lines.slice(0, p2.line).reduce((n, l) => n + l.length + 1, 0) + p2.character,
    positionAt(o) {
      let l = 0;
      while (l < lines.length - 1 && o > lines[l].length) {
        o -= lines[l].length + 1;
        l++;
      }
      return new Position(l, o);
    },
    // Mirrors language-configuration.json's wordPattern closely enough.
    getWordRangeAtPosition(p2) {
      const re = /[^\-`~!@#%^&*()=+[{\]}\\|;:'",.<>/?\s]+/g;
      let m;
      while ((m = re.exec(lines[p2.line]))) {
        if (m.index <= p2.character && p2.character <= m.index + m[0].length) {
          return new Range(p2.line, m.index, p2.line, m.index + m[0].length);
        }
      }
      return undefined;
    }
  };
  return d;
}

function createVscode(config) {
  const reg = {
    completion: [],
    codeActions: [],
    highlight: [],
    onType: [],
    commands: {},
    executed: [],
    listeners: { open: [], change: [], close: [], save: [], config: [], active: [], visibleRanges: [] },
    collections: {},
    contentProviders: {},
    webviews: {},
    languageSwitches: [],
    info: []
  };
  const on = (name) => (f) => {
    reg.listeners[name].push(f);
    return { dispose() {} };
  };
  const vscode = lenient({
    Position,
    Range,
    Selection,
    EventEmitter,
    Location: class {
      constructor(u, range) {
        this.uri = u;
        this.range = range;
      }
    },
    Diagnostic: class {
      constructor(range, message, severity) {
        this.range = range;
        this.message = message;
        this.severity = severity;
      }
    },
    DiagnosticRelatedInformation: class {
      constructor(location, message) {
        this.location = location;
        this.message = message;
      }
    },
    DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
    TextEditorRevealType: { Default: 0, InCenter: 1, InCenterIfOutsideViewport: 2, AtTop: 3 },
    CodeAction: class {
      constructor(title, k) {
        this.title = title;
        this.kind = k;
      }
    },
    CodeActionKind: { QuickFix: kind('quickfix'), SourceFixAll: kind('source.fixAll') },
    WorkspaceEdit: class {
      constructor() {
        this.edits = [];
      }
      replace(u, range, text) {
        this.edits.push({ uri: u, range, text });
      }
      insert(u, position, text) {
        this.edits.push({ uri: u, range: new Range(position, position), text });
      }
    },
    TextEdit: { replace: (range, newText) => ({ range, newText }), insert: (position, newText) => ({ range: new Range(position, position), newText }) },
    SnippetString: class {
      constructor(value) {
        this.value = value;
      }
    },
    CompletionItem: class {
      constructor(label, k) {
        this.label = label;
        this.kind = k;
      }
    },
    CompletionItemKind: new Proxy({}, { get: (t, k) => String(k) }),
    DocumentHighlight: class {
      constructor(range, k) {
        this.range = range;
        this.kind = k;
      }
    },
    DocumentHighlightKind: { Text: 0, Read: 1, Write: 2 },
    ConfigurationTarget: { Global: 1, Workspace: 2, WorkspaceFolder: 3 },
    ViewColumn: { Active: -1, Beside: -2, One: 1, Two: 2 },
    Uri: { file: (p) => uri(p), from: (o) => uri(o.path, o.scheme, o.query || '') },
    languages: lenient({
      createDiagnosticCollection(name) {
        const c = {
          map: new Map(),
          set: (u, list) => c.map.set(u.toString(), list),
          delete: (u) => c.map.delete(u.toString()),
          get: (u) => c.map.get(typeof u === 'string' ? u : u.toString()),
          dispose() {}
        };
        reg.collections[name] = c;
        return c;
      },
      registerCompletionItemProvider: (sel, provider, ...triggers) => (reg.completion.push({ sel, provider, triggers }), { dispose() {} }),
      registerCodeActionsProvider: (sel, provider) => (reg.codeActions.push({ sel, provider }), { dispose() {} }),
      registerDocumentHighlightProvider: (sel, provider) => (reg.highlight.push({ sel, provider }), { dispose() {} }),
      registerOnTypeFormattingEditProvider: (sel, provider, ...triggers) => (reg.onType.push({ sel, provider, triggers }), { dispose() {} }),
      async setTextDocumentLanguage(d, languageId) {
        reg.languageSwitches.push([d.uri.toString(), languageId]);
        return d;
      }
    }),
    window: lenient({
      activeTextEditor: null,
      onDidChangeActiveTextEditor: on('active'),
      // Editors on screen: tests push { document, visibleRanges, revealRange }.
      visibleTextEditors: [],
      onDidChangeTextEditorVisibleRanges: on('visibleRanges'),
      showInformationMessage: (m) => reg.info.push(m),
      showTextDocument: async () => ({}),
      registerWebviewViewProvider: (id, provider) => ((reg.webviews[id] = provider), { dispose() {} })
    }),
    workspace: lenient({
      textDocuments: [],
      getConfiguration: (section) => ({
        get: (k, d) => {
          const full = section ? `${section}.${k}` : k;
          return full in config ? config[full] : d;
        },
        inspect: () => ({}),
        update: async (k, v) => {
          config[section ? `${section}.${k}` : k] = v;
        }
      }),
      getWorkspaceFolder: () => undefined,
      onDidOpenTextDocument: on('open'),
      onDidChangeTextDocument: on('change'),
      onDidCloseTextDocument: on('close'),
      onDidSaveTextDocument: on('save'),
      onDidChangeConfiguration: on('config'),
      registerTextDocumentContentProvider: (scheme, provider) => ((reg.contentProviders[scheme] = provider), { dispose() {} }),
      // A virtual document (e.g. the rendered preview) opened from its
      // content provider; kept in textDocuments like VS Code does.
      async openTextDocument(u) {
        // An already-open file is returned as is, like VS Code does.
        const open = vscode.workspace.textDocuments.find((d) => d.uri.toString() === u.toString());
        if (open && !reg.contentProviders[u.scheme]) return open;
        const provider = reg.contentProviders[u.scheme];
        const d = doc(provider ? provider.provideTextDocumentContent(u) : '', { languageId: 'plaintext', path: u.path, scheme: u.scheme });
        d.uri = u;
        vscode.workspace.textDocuments.push(d);
        reg.opened = reg.opened || [];
        reg.opened.push(d);
        return d;
      },
      applyEdit: async (edit) => ((reg.appliedEdit = edit), true)
    }),
    commands: lenient({
      registerCommand: (n, f) => ((reg.commands[n] = f), { dispose() {} }),
      executeCommand: async (n, ...args) => {
        reg.executed.push([n, ...args]);
      }
    })
  });
  return { vscode, reg };
}

const memento = () => {
  const store = {};
  return { get: (k, d) => (k in store ? store[k] : d), update: async (k, v) => (store[k] = JSON.parse(JSON.stringify(v))), store };
};

// Installs the mock and activates src/extension.js. `config` holds settings
// by full name ('saltSyntax.nonAsciiCheck': false), and can be changed later
// (then call fireConfig('saltSyntax.x') to notify the extension).
async function load({ config = {} } = {}) {
  const { vscode, reg } = createVscode(config);
  const original = Module._load;
  Module._load = function (request, ...rest) {
    return request === 'vscode' ? vscode : original.call(this, request, ...rest);
  };
  for (const key of Object.keys(require.cache)) {
    if (key.startsWith(SRC)) delete require.cache[key];
  }
  const ext = require(path.join(SRC, 'extension.js'));
  const context = { subscriptions: [], globalState: memento(), workspaceState: memento() };
  await ext.activate(context);
  const fire = (name, event) => Promise.all(reg.listeners[name].map((f) => f(event)));
  return {
    vscode,
    reg,
    config,
    context,
    // Tell the extension a document was opened / changed / closed / saved.
    open: (d) => fire('open', d),
    change: (d, contentChanges = []) => fire('change', { document: d, contentChanges }),
    close: (d) => fire('close', d),
    // Tell the extension an editor scrolled (so its top line is `line`).
    scroll: (textEditor, line) => fire('visibleRanges', { textEditor, visibleRanges: [new vscode.Range(line, 0, line + 30, 0)] }),
    save: (d) => fire('save', d),
    fireConfig: (setting) => fire('config', { affectsConfiguration: (s) => s === setting || setting.startsWith(`${s}.`) }),
    // The provider registered for a given kind; `pick` filters (e.g. by trigger characters).
    provider: (k, pick = () => true) => {
      const found = reg[k].find(pick);
      if (!found) throw new Error(`no ${k} provider registered`);
      return found.provider;
    }
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Polls `predicate` until true (or fails after `ms`), for async renders.
async function until(predicate, what, ms = 8000) {
  for (let waited = 0; waited < ms; waited += 25) {
    if (await predicate()) return;
    await sleep(25);
  }
  throw new Error(`timed out waiting for: ${what}`);
}

module.exports = { load, doc, uri, Position, Range, Selection, sleep, until, SRC };
